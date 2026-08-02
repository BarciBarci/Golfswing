A web app for analyzing golf swings: load a swing video and play it back in
**slow motion**. **Lines and circles in various colors** can be drawn directly
on the video to check e.g. the spine angle, head position, or swing path.

The app is a pure **static website** (HTML/CSS/JavaScript, no build step) – it
runs locally in the browser, on desktop as well as on iPhone/iPad (iOS) and
Android. **Nothing is uploaded**; all data stays on your device.

## Features

- 📂 **Open video** by click or drag & drop (MP4/WebM/MOV, etc.)
- 🐢 **Playback speed** continuously adjustable from **0.1× to 1×** (slider + quick presets: 0.1× / 0.25× / 0.5× / 1×)
- ⏮⏭ **Single-frame stepping** forward/backward for precise swing analysis
- 📏 **Lines** and ⭕ **circles** in 9 colors drawn directly on the video (mouse or touch)
- 👁 **Time window** per overlay (from/to): lines/circles only appear during a specific part of the swing – by default they are always visible
- 🎚 **Timeline slider** directly below the video to jump to any position
- ↩ **Undo**, delete individually or all, visibility toggle per element
- 💾 **Export/import** overlays as JSON (e.g., to share with your coach)
- ⌨️ **Keyboard**: `Space` play/pause · `←`/`→` single frame · `L`/`C` tool · `Esc` cancel · `Ctrl+Z` undo

## Run locally

Simplest: open `index.html` in your browser (double-click). Alternatively, use
a local server:

```sh
# Python
python3 -m http.server 8000
# then open http://localhost:8000
