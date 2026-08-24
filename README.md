# ⛳ Golf Swing Analysis

A web app for analyzing golf swings: load a swing video and play it back in
**slow motion**. **Lines and circles in various colors** can be drawn directly
on the video to check e.g. the spine angle, head position, or swing path.

The app is a pure **static website** (HTML/CSS/JavaScript, no build step) – it
runs locally in the browser, on desktop as well as on iPhone/iPad (iOS) and
Android. **Nothing is uploaded**; all data stays on your device.

## Features

- 📂 **Open video** by click or drag & drop (MP4/WebM/MOV, etc.)
- ✂️ **Trim video**: cut off the start and end (set start/end), save as a file or analyze directly
- 🐢 **Playback speed** continuously adjustable from **0.1× to 1×** (slider + quick presets: 0.1× / 0.25× / 0.5× / 1×)
- ⏮⏭ **Single-frame stepping**: tap once for one frame, press and hold to step through frame by frame; the current frame number is shown in the player (also with `←`/`→`)
- 📏 **Lines** and ⭕ **circles** in 9 colors drawn directly on the video (mouse or touch)
- 🖐 **Move**: drag individual grips (line endpoints, circle center/edge) – or grab the whole line/circle and move it (key `M`)
- ✏️ **Stroke width**: adjustable per line/circle from 1× to 3× – toolbar for new shapes, −/+ in the list (keys `[`/`]`)
- 👁 **Time window** per overlay (from/to): lines/circles only appear during a specific part of the swing – by default they are always visible
- 🎚 **Timeline slider** directly below the video to jump to any position (frames update live while dragging)
- ↩ **Undo**, delete individually or all, visibility toggle per element
- 💾 **Export/import** overlays as JSON (e.g., to share with your coach)
- 📦 **.glf project format**: save the video together with the trim and all overlays in one file and reopen it later – lossless, because the original video is included
- ⌨️ **Keyboard**: `Space` play/pause · `←`/`→` single frame · `L`/`C`/`M` tool · `[`/`]` thickness · `Esc` cancel · `Ctrl+Z` undo

## Run locally

Simplest: open `index.html` in your browser (double-click). Alternatively, use
a local server:

```sh
# Python
python3 -m http.server 8000
# then open http://localhost:8000
```

## Use on your phone (iPhone / Android)

### Android – use the web app in the browser (no install needed)

You don't need an app for this – the web app runs directly in Chrome:

1. On your computer, start a local server in the project folder:

   ```sh
   python3 -m http.server 8000
   ```

2. Find your computer's IP address in the Wi-Fi network
   (`ipconfig` on Windows, `ifconfig`/`ip a` on Mac/Linux, e.g. `192.168.1.42`).

3. On the Android phone (same Wi-Fi), open in Chrome:

   ```
   http://192.168.1.42:8000
   ```

4. Optional, for an app-like shortcut on the home screen:
   Chrome menu (⋮) → **„Add to Home screen“** → the shortcut opens the web app
   directly.

Everything runs locally – the video and your overlays stay on your phone.

### iPhone – use the web app (no install needed)

The iPhone has no APK like Android, so the web app is the way to go:

1. Start the local server on your computer (see above).
2. On the iPhone (same Wi-Fi), open `http://192.168.1.42:8000` in Safari.
3. Share button → **„Add to Home Screen“** – the web app then opens
   app-like from its own icon on the home screen.

Everything still runs locally – no upload, no account.

### Install on your phone as an offline app (no web server needed)

The app is an installable web app (PWA): open it once on your phone, add it to
the home screen – afterwards it starts from its own icon and **works offline**
without a web server and without internet.

1. On the phone, open **https://BarciBarci.github.io/Golfswing/**.
2. Add the app to the home screen:
   - **Android (Chrome):** menu ⋮ → **„Add to Home screen“** (or **„Install
     app“** when it is offered) – an icon appears on the home screen.
   - **iPhone (Safari):** Share button (□↑) → **„Add to Home Screen“**.
3. Start the app from the home-screen icon. The first visit (with internet)
   caches the app; **from then on it opens offline** – no server, no
   connection required.

Everything still runs on the phone itself: videos are chosen from the device
file picker and **never leave the phone**. When you push an update to GitHub,
wait about a minute, then open the app online once – the new version is
loaded automatically and cached again.

**Alternative without the hosted page:** Download the repository as a ZIP
(GitHub → green **„Code“** button → **„Download ZIP“**), unpack it and open
`index.html` locally – on Android with **Firefox** (the file manager offers
„Open with Firefox“), on iPhone with an HTML viewer app (e.g. „Documents“).
The app is designed to work from `file://` as well.

### Tip: host on GitHub Pages instead

Once the project is pushed to GitHub (see below), the same page is available
anywhere via `https://BarciBarci.github.io/Golfswing/` – no computer in the
same Wi-Fi needed. „Add to Home Screen“ works there the same way.

## Publish on GitHub

The app needs no backend and works directly via GitHub Pages:

1. Create a new repository on GitHub (e.g. `Golfswing`).
2. Initialize a Git repository in this folder and push:

   ```sh
   git init
   git add .
   git commit -m "Golf swing analysis"
   git branch -M main
   git remote add origin https://github.com/BarciBarci/Golfswing.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Source: Branch `main` / folder `/ (root)`** and save.
4. The app is then available at `https://BarciBarci.github.io/Golfswing/` – also from your phone.

## How to use

1. **Select a video or a .glf project** – by click (🎥/📁) or drag & drop (the file stays on your device).
2. **Step 1 – Trim:** cut off the start and/or end (scrub to a position and press “Start = position”/“End = position”, or type the times). Optionally “💾 Save as file”. Then “Apply & Analyze”.
3. **Step 2 – Analysis:** set the speed (e.g. 0.25×), jump with the slider or step frame by frame (`⏮`/`⏭`). The slider is limited to the trimmed range; at its end playback jumps back to the trim start.
4. Choose the 📏 or ⭕ tool, pick a color and stroke width (▬), and draw directly on the video.
5. In the **Overlays** list, set a time window per element, toggle visibility, adjust width, or delete it.
6. Optionally, **export**/import the overlays as JSON, or save the whole project as a **.glf** file.

**Tip for posture analysis:** Pause e.g. at the top of the backswing, draw a
line along the spine, and set the time window (from/to) tightly around that
moment. While playing, you can see at exactly the right position whether the
alignment is correct.

## Project structure

```
Golfswing/
├── index.html   # UI structure
├── styles.css   # Styling (dark theme, mobile-optimized)
├── app.js       # Logic: video, trim, speed, drawing, .glf
├── LICENSE      # MIT license
└── README.md
```

## Trimming the video

After opening a video, the app always starts in **Step 1 – Prepare trim**: this
is where you cut away the beginning and the end, so that only the actual swing
(e.g. from address to finish) remains for the analysis.

**Setting the trim range**

- Scrub or play the video to the desired position and press **“Start =
  position”** or **“End = position”** – or type the times in seconds directly
  into the Start/End fields (empty = beginning/end of the video).
- The timeline slider below the video shows you exactly what is kept: the
  **kept part is green**, the cut-off parts are **gray**.
- **▶ Play** browses the whole video; **Play range** plays only the selected
  range. The resulting length is displayed next to the buttons.

**Finishing the trim**

- **“Apply & Analyze”** – the cut is applied (in memory) and the analysis
  starts immediately. From now on the timeline slider is limited to the trimmed
  range, and when playback reaches the end it **jumps back to the trim start**
  so you can watch the swing again and again. The frame-step buttons (⏮/⏭)
  also stay inside the trimmed range.
- **“💾 Save as file”** – records the trimmed range in real time and downloads
  a **standalone video file** (WebM in Chrome/Firefox, MP4 in Safari). This is
  a re-encoded copy: it takes as long as the range itself (e.g. 10 s for a 10 s
  swing) and has no overlays. Afterwards the trim is applied and the analysis
  continues. If your browser does not support recording, trimming still works
  – you just use “Apply & Analyze”.
- You can always go back: the green banner in the analysis view offers **“✏️
  Adjust trim”** (re-open the trim step with your current values) and **“Reset
  trim”** (analyze the whole video again).

**Tip:** Cut tightly around the swing. The analysis (slow motion, frame
stepping, overlays) then focuses exactly on the movement you want to check.

## Saving with lines and circles – the .glf project format

During the analysis you draw lines and circles on the video (color, stroke
width, time window, visibility). To save all of this **together with the
trimmed video**, use **“💾 Save .glf”** in the Overlays panel. A
`swing-analysis.glf` file is downloaded.

**What is stored in a .glf file:**

- the **video** – if a trim is active, the **trimmed range** is embedded
  (recorded once when saving, so saving takes as long as the range); without a
  trim, the original video is embedded (instant and lossless)
- the **trim** (start/end) if the full video is embedded
- **all overlays**: lines and circles with color, stroke width (1×–3×), time
  window (from/to) and visibility setting
- the **frame rate**, the current **playback speed** and the default **stroke
  width**

**Reopening a .glf project:** On the start screen choose **“📁 Load .glf
project”** or drag the file onto the drop zone. The video and all overlays are
restored and you continue directly in the analysis mode – a trim that was cut
is already part of the video.

**Saving time:** Without a trim, saving is immediate and lossless because the
original video is just copied into the file. With an active trim, the trimmed
range is recorded once in real time (like “Save as file”, with a progress
indicator) and that recording is embedded – so the .glf contains exactly the
trimmed video, and the overlay time windows are shifted to the new timeline.
In technical terms, a .glf file is a binary container: the magic bytes `GLF1`,
a JSON metadata block (trim, overlays, settings), followed by the video data.
It can only be opened by this app.

**Note on file size:** Because the .glf file contains the (trimmed) video, it
is at least as large as that video. For sharing with a coach, use cloud
storage or a USB stick rather than email.

**Difference to “Save as file”:** “Save as file” creates a standalone,
re-encoded video without overlays; “Save .glf” saves the complete, editable
project with all lines and circles.

## Notes

- **iOS:** The video is displayed inline via `playsinline`; please don't
  expect YouTube/download links – local files are loaded.
- **Formats:** MP4 with H.264 codec is most compatible. WebM works in
  Chrome/Firefox, MOV usually works too. Phone videos with rotation metadata
  are exported upright.
- **HEVC/H.265 videos:** Phone cameras often record HEVC/H.265. Chrome on
  Linux (and some Windows setups) cannot decode it – the app then shows
  „This video cannot be decoded by your browser.“. Convert such videos to
  MP4 (H.264), e.g. with ffmpeg:

  ```sh
  ffmpeg -i video.mp4 -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart video_h264.mp4
  ```

  …or set the phone camera to record H.264 instead of HEVC.
- **Saving the trim as a file:** exporting creates a re-encoded copy of the
  range (WebM in Chrome/Firefox, MP4 in Safari). Recording runs in real time.
  In browsers without support, trimming still works – the cut is then just
  applied for the analysis.
- **No audio in recorded videos:** the re-encoded trimmed videos (both “Save
  as file” and the trimmed video embedded in a .glf) are video-only – they do
  not contain the original sound track.
- **Rotation:** Videos that carry rotation metadata (recorded by a phone
  camera) may be recorded sideways in Chrome. Converting such a video first
  (see the HEVC note above) bakes the rotation in and it records upright.
- **Privacy:** No servers, no analytics, no cookies – the app runs fully
  offline.

## Ideas for later

- Export a still frame as an image (with the drawn lines)
- Compare multiple videos in one session
- Play the swing in a loop
