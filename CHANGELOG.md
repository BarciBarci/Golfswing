# Changelog

All notable changes to this project are documented in this file.

The current version is defined in `app.js` (`APP_VERSION`) and shown in the
footer of the app. When releasing: bump `APP_VERSION` here and in `app.js`,
then create a git tag `vX.Y.Z`.

## [1.1.0] – 2026-10-19

### Fixed
- **iOS Safari:** after loading a video no picture was shown, and dragging the
  timeline did not update the frame. iOS Safari only renders video frames after
  the video has played once – the video is now primed with a muted play/pause,
  so the first frame and every seek are visible.

### Added
- **iOS Safari:** saving a trimmed video now falls back to capturing a small
  canvas that draws the video (Safari has no `HTMLMediaElement.captureStream()`).
- **Phones:** the line/circle toolbar moves below the video instead of covering
  it; the stage height adapts accordingly.
- The app version is displayed in the footer and maintained in `app.js`.

## [1.0.0] – 2026-08-24

### Added
- First stable release: trim the video, slow motion (0.1×–1×), single-frame
  stepping, lines and circles with colors/stroke width/time windows, `.glf`
  project files, installable PWA with offline support.

### Fixed
- Recording in Firefox and Chrome (video-only codec strings).
- HEVC/H.265 videos show a clear message and conversion hint.
- Videos with infinite/unknown duration (broken WebM metadata) no longer
  freeze the page.
