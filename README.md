A web app for analyzing golf swings: load a swing video and play it back in
**slow motion**. **Lines and circles in various colors** can be drawn directly
on the video to check e.g. the spine angle, head position, or swing path.

The app is a pure **static website** (HTML/CSS/JavaScript, no build step) – it
runs locally in the browser, on desktop as well as on iPhone/iPad (iOS) and
Android. **Nothing is uploaded**; all data stays on your device.

This Project it completely KI Generated with Deepseek V4 flash (paid). 
The german prompt was 

"Ich möchte eine golf schwunganalyse webapp schreiben, die sowohl von einem PC als auch einen handy (ios, Android) aufgerugen wird. Diese app soll spärer bei github hochgelanden werden und auch lokal laufen. Ziel ist eine Aufnahme eines Golfschwunges zu laden und mittels langsamer abspielen kombiniert mit auf den film überlagerter Linien und Kreise sehen zu können, ob die körperhalung richtig ist. Also nunächst muss man einen film öffnen. Den kann man dan un unterschiedlichen geschwindigkeiten (0,1 - 1 - fach) abspielen. unten soll auch ein sleider sein. Jederzeit kann man auf diesem Film gerade linien oder Kreise un unterschielidchen farben hinzufügen. diese sollen den Film überlagert sein."

and 

"zwei änderungswünsche: 1. den slider für die Zeit direkt unter dem video anordnen. Die Bedienung von linie und kreis kleiner und in einer zeile, so dass mehr von dem video sichtbar ist."



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
