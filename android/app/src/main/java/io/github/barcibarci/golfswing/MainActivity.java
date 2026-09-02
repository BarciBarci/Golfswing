package io.github.barcibarci.golfswing;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Golf Swing Analysis for Android.
 *
 * This is a thin wrapper around the existing static web app (index.html /
 * app.js / styles.css, which live in the repository root and are embedded into
 * this APK unchanged at build time). It adds the native plumbing that a
 * WebView does not provide out of the box:
 *
 *  - a system file picker for <input type="file"> (video / .glf / JSON),
 *  - saving of "downloads" (.glf projects, overlay JSON) to the public
 *    Downloads folder (the web app saves via blob: URLs, which the WebView
 *    cannot download by itself),
 *  - JS dialogs (alert/confirm), which the app uses for feedback.
 *
 * The app works fully offline and requests no Internet permission.
 */
public class MainActivity extends Activity {

    private static final int REQ_OPEN_FILE = 9101;
    private static final int REQ_STORAGE_PERMISSION = 9102;

    private static final String ASSET_INDEX = "file:///android_asset/index.html";
    private static final String HOOK_ASSET = "injected/download-hook.js";

    /** "Downloads" collection of the media provider (MediaStore.Downloads, API 29+). */
    private static final Uri DOWNLOADS_COLLECTION =
            Uri.parse("content://media/external/downloads");
    private static final String DOWNLOAD_SUBDIR = Environment.DIRECTORY_DOWNLOADS + "/GolfSwingAnalysis";

    private final Handler ui = new Handler(Looper.getMainLooper());

    private WebView webView;

    // Active <input type="file"> chooser (one at a time).
    private ValueCallback<Uri[]> filePathCallback;

    // State of an in-progress native save. The web app triggers one download
    // at a time; the SaveBridge streams the data in chunks.
    private final Object saveLock = new Object();
    private OutputStream saveStream;
    private Uri saveUri;          // MediaStore target (Android 10+)
    private File saveFile;        // legacy public-Downloads target (Android 8/9)
    private String saveBaseName;

    private CountDownLatch permissionLatch;

    // ------------------------------------------------------------------
    // Activity lifecycle
    // ------------------------------------------------------------------

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);          // needed for file:///android_asset/
        settings.setAllowContentAccess(true);       // files picked via content:// URIs
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setLoadWithOverviewMode(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith("file:///android_asset/")) {
                    injectDownloadHook();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // Only the main frame: sub-resource errors (icons, fonts…) are
                // harmless and must not replace the page.
                if (request != null && request.isForMainFrame()
                        && view.getUrl() != null && view.getUrl().startsWith("file:///android_asset/")) {
                    view.loadDataWithBaseURL(null,
                            "<html><body style='background:#0f1115;color:#e8e8e8;"
                                    + "font-family:sans-serif;padding:24px'>"
                                    + "<h2>Could not load the app</h2>"
                                    + "<p>The web app is missing from this APK. Please rebuild "
                                    + "from a full repository checkout.</p></body></html>",
                            "text/html", "utf-8", null);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null); // cancel any previous request
                }
                filePathCallback = callback;
                return launchFilePicker(fileChooserParams);
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                showJsDialog(message, result, false);
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                showJsDialog(message, result, true);
                return true;
            }
        });

        webView.addJavascriptInterface(new SaveBridge(), "golfNative");

        webView.loadUrl(ASSET_INDEX);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------
    // File picker (videos, .glf projects, JSON imports)
    // ------------------------------------------------------------------

    private boolean launchFilePicker(WebChromeClient.FileChooserParams params) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);

        String[] mimes = pickerMimeTypes(params.getAcceptTypes());
        if (mimes.length == 1) {
            intent.setType(mimes[0]);
        } else {
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
        }

        boolean multiple = params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
        if (multiple) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        try {
            startActivityForResult(intent, REQ_OPEN_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
                filePathCallback = null;
            }
            toast("No file picker is installed on this device.");
            return false;
        }
    }

    /**
     * The web app accepts MIME types like "video/*" but also file extensions
     * (".glf"), which the system picker cannot filter. Whenever an extension
     * appears, the picker is opened for all files so that .glf projects (which
     * have an unknown MIME type on the device) stay selectable.
     */
    private static String[] pickerMimeTypes(String[] acceptTypes) {
        Set<String> out = new LinkedHashSet<>();
        boolean needsWildcard = false;
        if (acceptTypes != null) {
            for (String accept : acceptTypes) {
                if (accept == null) continue;
                String type = accept.trim().toLowerCase(Locale.ROOT);
                if (type.isEmpty()) continue;
                if (type.indexOf('/') > 0) {
                    out.add(type);
                } else {
                    needsWildcard = true; // ".glf" / ".json"
                }
            }
        }
        if (needsWildcard || out.isEmpty()) {
            return new String[]{"*/*"};
        }
        return out.toArray(new String[0]);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_OPEN_FILE) {
            ValueCallback<Uri[]> callback = filePathCallback;
            filePathCallback = null;
            if (callback == null) return;

            List<Uri> uris = new ArrayList<>();
            if (resultCode == RESULT_OK && data != null) {
                if (data.getData() != null) uris.add(data.getData());
                ClipData clip = data.getClipData();
                if (clip != null) {
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        Uri uri = clip.getItemAt(i).getUri();
                        if (uri != null) uris.add(uri);
                    }
                }
            }
            if (uris.isEmpty()) {
                callback.onReceiveValue(null);
                return;
            }
            for (Uri uri : uris) {
                takeReadPermission(uri);
            }
            callback.onReceiveValue(uris.toArray(new Uri[0]));
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void takeReadPermission(Uri uri) {
        try {
            getContentResolver().takePersistableUriPermission(uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException | UnsupportedOperationException e) {
            // Best effort – not all providers support persistable grants. The
            // temporary grant for this session is enough for the web app.
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_STORAGE_PERMISSION) {
            CountDownLatch latch = permissionLatch;
            permissionLatch = null;
            if (latch != null) latch.countDown();
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    // ------------------------------------------------------------------
    // Native file saving ("Downloads")
    // ------------------------------------------------------------------

    /** Returns true when the storage permission is available for this save. */
    private boolean ensureStoragePermission() {
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P) return true; // MediaStore needs nothing
        if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED) return true;

        final CountDownLatch latch = new CountDownLatch(1);
        permissionLatch = latch;
        ui.post(new Runnable() {
            @Override
            public void run() {
                requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                        REQ_STORAGE_PERMISSION);
            }
        });
        try {
            return latch.await(120, TimeUnit.SECONDS)
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        == PackageManager.PERMISSION_GRANTED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private void openSaveTarget(String name, String mime) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put("relative_path", DOWNLOAD_SUBDIR); // MediaColumns.RELATIVE_PATH (API 29+)
            Uri uri = getContentResolver().insert(DOWNLOADS_COLLECTION, values);
            if (uri == null) throw new IOException("the Downloads folder could not be used");
            OutputStream out = getContentResolver().openOutputStream(uri);
            if (out == null) throw new IOException("the file could not be opened for writing");
            synchronized (saveLock) {
                saveUri = uri;
                saveFile = null;
                saveStream = out;
            }
        } else {
            File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    "GolfSwingAnalysis");
            if (!dir.isDirectory() && !dir.mkdirs()) {
                throw new IOException("the Downloads folder could not be created");
            }
            File target = uniqueFile(dir, name);
            synchronized (saveLock) {
                saveFile = target;
                saveUri = null;
                saveStream = new FileOutputStream(target);
            }
        }
        saveBaseName = name;
    }

    private void closeSave(boolean deletePartial) {
        OutputStream stream;
        Uri uri;
        File file;
        synchronized (saveLock) {
            stream = saveStream;
            uri = saveUri;
            file = saveFile;
            saveStream = null;
            saveUri = null;
            saveFile = null;
        }
        if (stream != null) {
            try { stream.close(); } catch (IOException ignored) { }
        }
        if (deletePartial) {
            if (uri != null) {
                try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            } else if (file != null && file.exists()) {
                file.delete();
            }
        }
    }

    private static File uniqueFile(File dir, String name) {
        String base = name;
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            base = name.substring(0, dot);
            ext = name.substring(dot);
        }
        File candidate = new File(dir, name);
        int i = 1;
        while (candidate.exists()) {
            candidate = new File(dir, base + " (" + i + ")" + ext);
            i++;
        }
        return candidate;
    }

    /** Human-readable name of a MediaStore entry, falling back to the requested name. */
    private String queryDisplayName(Uri uri, String fallback) {
        try {
            android.database.Cursor cursor = getContentResolver().query(
                    uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (idx >= 0 && !cursor.isNull(idx)) {
                            return cursor.getString(idx);
                        }
                    }
                } finally {
                    cursor.close();
                }
            }
        } catch (Exception ignored) { }
        return fallback;
    }

    private void scanLegacyFile(File file) {
        try {
            sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(file)));
        } catch (Exception ignored) { }
    }

    private static String sanitizeFileName(String name) {
        if (name == null) return "download";
        String cleaned = name.replaceAll("[/\\\\\\p{Cntrl}]", "_").trim();
        if (cleaned.isEmpty() || cleaned.equals(".") || cleaned.equals("..")) {
            return "download";
        }
        return cleaned;
    }

    // ------------------------------------------------------------------
    // Native <-> JS bridge for blob downloads
    // ------------------------------------------------------------------

    private class SaveBridge {

        @android.webkit.JavascriptInterface
        public void toast(String message) {
            MainActivity.this.toast(message);
        }

        @android.webkit.JavascriptInterface
        public String beginSave(String name, String mime, long size) {
            closeSave(true); // a previous, unfinished save is abandoned
            saveBaseName = null;

            String cleanName = sanitizeFileName(name);
            String cleanMime = (mime == null || mime.trim().isEmpty())
                    ? "application/octet-stream" : mime;

            if (!ensureStoragePermission()) {
                toast("To save files, please grant the storage permission and try again.");
                return "ERROR:permission";
            }
            try {
                openSaveTarget(cleanName, cleanMime);
                return "ok";
            } catch (IOException e) {
                toast("Saving failed – " + e.getMessage());
                return "ERROR:open";
            }
        }

        @android.webkit.JavascriptInterface
        public boolean writeChunk(String base64) {
            OutputStream stream;
            synchronized (saveLock) {
                stream = saveStream;
            }
            if (stream == null) return false;
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                stream.write(data);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @android.webkit.JavascriptInterface
        public void abortSave() {
            closeSave(true);
        }

        @android.webkit.JavascriptInterface
        public String endSave() {
            OutputStream stream;
            Uri uri;
            File file;
            synchronized (saveLock) {
                stream = saveStream;
                uri = saveUri;
                file = saveFile;
                saveStream = null;
                saveUri = null;
                saveFile = null;
            }
            if (stream == null) return "ERROR:nofile";

            try {
                stream.flush();
                stream.close();
            } catch (IOException e) {
                if (file != null && file.exists()) file.delete();
                return "ERROR:write";
            }

            String shown;
            if (uri != null) {
                String displayName = queryDisplayName(uri, saveBaseName);
                shown = DOWNLOAD_SUBDIR + "/" + displayName;
            } else {
                shown = "Downloads/GolfSwingAnalysis/" + file.getName();
                scanLegacyFile(file);
            }
            final String message = "Saved: " + shown;
            ui.post(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
                }
            });
            return "ok";
        }
    }

    // ------------------------------------------------------------------
    // Download-hook injection & small helpers
    // ------------------------------------------------------------------

    private void injectDownloadHook() {
        if (webView == null) return;
        final String hook = readAsset(HOOK_ASSET);
        if (hook == null) return;
        try {
            webView.evaluateJavascript(hook, null);
        } catch (Exception ignored) { }
    }

    private String readAsset(String path) {
        try {
            InputStream in = getAssets().open(path);
            try {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int read;
                while ((read = in.read(chunk)) != -1) {
                    buffer.write(chunk, 0, read);
                }
                return buffer.toString("UTF-8");
            } finally {
                in.close();
            }
        } catch (IOException e) {
            return null;
        }
    }

    private void showJsDialog(String message, JsResult result, boolean confirm) {
        ui.post(() -> {
            AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
            builder.setTitle(getString(R.string.app_name));
            builder.setMessage(message);
            if (confirm) {
                builder.setPositiveButton(android.R.string.ok,
                        (dialog, which) -> result.confirm());
                builder.setNegativeButton(android.R.string.cancel,
                        (dialog, which) -> result.cancel());
            } else {
                builder.setPositiveButton(android.R.string.ok,
                        (dialog, which) -> result.confirm());
            }
            AlertDialog dialog = builder.create();
            dialog.setOnCancelListener(d -> result.cancel());
            dialog.show();
        });
    }

    private void toast(final String message) {
        ui.post(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
    }
}
