/*
 * Golf Swing Analysis – Android download hook
 * =============================================
 * This file is ONLY used inside the Android app. It is injected by
 * MainActivity after the page has loaded and is never part of the desktop /
 * web version.
 *
 * Why it exists: Android's WebView cannot download "blob:" URLs on its own.
 * The web app saves files (.glf projects, overlay JSON, trimmed videos) by
 * clicking a temporary <a download href="blob:…"> element. This hook captures
 * those clicks, reads the blob in small pieces and streams it to the native
 * bridge (window.golfNative), which writes the file into the public Downloads
 * folder. All other downloads keep their normal behaviour.
 */
(function () {
    'use strict';
    if (window.__golfSwingAndroidSaveHook) return;
    window.__golfSwingAndroidSaveHook = true;

    var bridge = window.golfNative;
    if (!bridge) return;

    var CHUNK = 1024 * 1024;      // blob is read in 1 MB pieces (low memory)
    var B64_BATCH = 0x8000;       // base64 batches (limits String.fromCharCode.apply stack size)

    function base64FromBytes(bytes) {
        var binary = '';
        for (var i = 0; i < bytes.length; i += B64_BATCH) {
            binary += String.fromCharCode.apply(
                null,
                bytes.subarray(i, Math.min(i + B64_BATCH, bytes.length))
            );
        }
        return btoa(binary);
    }

    function notify(msg) {
        try { bridge.toast(msg); } catch (e) { /* ignore */ }
    }

    function saveBlob(href, name) {
        return fetch(href)
            .then(function (resp) {
                if (!resp.ok) throw new Error('read');
                return resp.blob();
            })
            .then(function (blob) {
                var started = bridge.beginSave(name, blob.type || '', blob.size);
                if (started !== 'ok') throw new Error(started || 'begin'); // native already informed the user

                var pos = 0;
                var total = blob.size;

                function writeNext() {
                    if (pos >= total) return Promise.resolve();
                    var end = Math.min(pos + CHUNK, total);
                    return blob.slice(pos, end).arrayBuffer().then(function (buf) {
                        if (!bridge.writeChunk(base64FromBytes(new Uint8Array(buf)))) {
                            throw new Error('write');
                        }
                        pos = end;
                        return writeNext();
                    });
                }

                return writeNext().then(function () {
                    var done = bridge.endSave();
                    if (done !== 'ok') throw new Error(done || 'end');
                }, function (err) {
                    try { bridge.abortSave(); } catch (e) { /* ignore */ }
                    throw err;
                });
            });
    }

    document.addEventListener('click', function (ev) {
        var target = ev.target;
        var a = target && target.closest ? target.closest('a[download]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (href.indexOf('blob:') !== 0) return; // leave non-blob downloads to the system
        ev.preventDefault();
        ev.stopPropagation();
        var name = a.getAttribute('download') || 'download';
        saveBlob(href, name).catch(function (err) {
            var code = err && err.message ? String(err.message) : '';
            // These two were already announced by the native side (permission
            // dialog / save-open failure) – showing them again would be noise.
            if (code === 'ERROR:permission' || code === 'ERROR:open') return;
            var text;
            if (!code || code === 'read') text = 'Saving failed – the file could not be read.';
            else if (code === 'write') text = 'Saving failed – could not write to storage.';
            else if (code === 'ERROR:write') text = 'Saving failed – the file could not be written.';
            else if (code === 'ERROR:nofile') text = 'Saving failed – please try again.';
            else text = 'Saving failed (' + code + ').';
            notify(text);
        });
    }, true);
})();
