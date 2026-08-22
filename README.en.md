# ⛳ Golf Swing Analysis

> 🇩🇪 [Deutsche Version](README.md)

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
- 🖐 **Move**: drag individual grips (line endpoints, circle center/edge) – or grab the whole line/circle and move it (key `M`)
- ✏️ **Stroke width**: adjustable per line/circle from 1× to 3× – toolbar for new shapes, −/+ in the list (keys `[`/`]`)
- 👁 **Time window** per overlay (from/to): lines/circles only appear during a specific part of the swing – by default they are always visible
- 🎚 **Timeline slider** directly below the video to jump to any position
- ↩ **Undo**, delete individually or all, visibility toggle per element
- 💾 **Export/import** overlays as JSON (e.g., to share with your coach)
- ⌨️ **Keyboard**: `Space` play/pause · `←`/`→` single frame · `L`/`C`/`M` tool · `[`/`]` thickness · `Esc` cancel · `Ctrl+Z` undo

## Run locally

Simplest: open `index.html` in your browser (double-click). Alternatively, use
a local server:

```sh
# Python
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish on GitHub

The app needs no backend and works directly via GitHub Pages:

1. Create a new repository on GitHub (e.g. `golf-schwunganalyse`).
2. Initialize a Git repository in this folder and push:

   ```sh
   git init
   git add .
   git commit -m "Golf swing analysis v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/golf-schwunganalyse.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Source: Branch `main` / folder `/ (root)`** and save.
4. The app is then available at `https://YOUR-USERNAME.github.io/golf-schwunganalyse/` – also from your phone.

## How to use

1. **Select a video** (the file stays on your device).
2. Set the speed below (e.g. 0.25×), jump to the desired position with the slider, or step through the swing frame by frame (`⏮`/`⏭`).
3. Choose the 📏 or ⭕ tool, pick a color and stroke width (▬), and draw directly on the video.
4. In the **Overlays** list, set a time window per element, toggle visibility, or delete it.
5. Optionally, **export**/import the overlays as JSON.

**Tip for posture analysis:** Pause e.g. at the top of the backswing, draw a
line along the spine, and set the time window (from/to) tightly around that
moment. While playing, you can see at exactly the right position whether the
alignment is correct.

## Project structure

```
golf-schwunganalyse/
├── index.html   # UI structure
├── styles.css   # Styling (dark theme, mobile-optimized)
├── app.js       # Logic: video, speed, drawing, time windows
└── README.md
```

## Notes

- **iOS:** The video is displayed inline via `playsinline`; please don't
  expect YouTube/download links – local files are loaded.
- **Formats:** MP4 with H.264 codec is most compatible. WebM works in
  Chrome/Firefox, MOV usually works too.
- **Privacy:** No servers, no analytics, no cookies – the app runs fully
  offline.

## Ideas for later

- Export a still frame as an image (with the drawn lines)
- Compare multiple videos in one session
- Play the swing in a loop
