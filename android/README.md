# Golf Swing Analysis – Android-App (F-Droid)

Dieser Ordner enthält eine eigenständige **Android-App** für die Golf-Schwung-Analyse.
Sie ist ein schlanker Wrapper um die **bestehende Web-App** im Repository-Root
(`index.html`, `app.js`, `styles.css`, …):

- Die Web-Dateien bleiben **unangetastet** und sind die **einzige Quelle** – sie
  werden bei jedem Android-Build unverändert in die APK eingebettet
  (Gradle-Task `syncWebAssets`). Desktop- und Web-Version funktionieren also
  exakt wie bisher weiter.
- Die Android-App läuft **komplett offline**, benötigt **keine Internet-Berechtigung**
  und enthält **keine Werbung/Tracker** – das passt zu den Anforderungen von
  [F-Droid](https://f-droid.org/).

---

## Was die Android-App kann

Alle Funktionen der Web-App sind dabei: Video laden, Trimmen (im Speicher),
Zeitlupe ab 0,1×, Einzelbild-Schritte, Linien/Kreise zeichnen, Overlays
verwalten, als `.glf`-Projekt oder JSON speichern, wieder öffnen, …

Dafür ergänzt der Wrapper die Dinge, die ein WebView nicht von sich aus kann:

| Funktion | Umsetzung |
|---|---|
| Video / `.glf` / JSON öffnen | System-Dateiauswahl (`ACTION_OPEN_DOCUMENT`); große Videos werden als `content://`-URI gestreamt, nicht kopiert |
| `.glf`-Projekte & JSON-Export speichern | Die App speichert über `blob:`-URLs („Download“). Der WebView kann das nicht – ein eingebetteter JS-Hook (`app/src/main/assets/injected/download-hook.js`) fängt die Downloads ab und schreibt die Datei **in den öffentlichen Ordner `Downloads/GolfSwingAnalysis/`** |
| `alert`/`confirm`-Dialoge der App | Native Android-Dialoge |

### Bekannte Einschränkungen (WebView, bewusst so gelöst)

- **„💾 Save as file“** (Trim als eigenständiges Video neu encodieren) und das
  Einbetten eines *beschnittenen* Videos in eine `.glf`-Datei brauchen
  `MediaRecorder`/`captureStream`, das Android WebView nicht anbietet. Die App
  zeigt dann ihre eingebaute Meldung an; Trimmen & Analysieren funktionieren
  trotzdem. Tipp: **„Reset trim“** wählen und dann **„💾 Save .glf“** – das
  speichert das Original-Video verlustfrei zusammen mit allen Linien/Kreisen
  (ohne aktiven Schnitt, daher sofort und ohne Re-Encoding).
- **Ziehen & Loslassen** (Drag & Drop) von Dateien in das Fenster gibt es in
  Android nicht – dafür gibt es die Buttons „🎥 Load video“ / „📁 Load .glf
  project“.
- **HEVC/H.265-Videos** (Handy-Kamera): Die Wiedergabe hängt vom Gerät ab –
  nicht jedes Gerät/WebView kann HEVC dekodieren. MP4/H.264 ist am sichersten.

---

## Projektstruktur

```
android/
├── app/
│   ├── build.gradle            # baut die APK; bettet die Web-App aus ../.. ein
│   └── src/main/
│       ├── AndroidManifest.xml # KEINE Internet-Berechtigung
│       ├── assets/injected/download-hook.js   # Download-Interception (nur Android)
│       ├── java/io/github/barcibarci/golfswing/MainActivity.java
│       └── res/                # Theme, Strings, Launcher-Icons
├── gradle/                     # Gradle-Wrapper 8.7 (offizielles Wrapper-JAR + SHA-256)
├── tools/make_icons.py         # erzeugt die Launcher-Icons aus icons/icon-512.png
├── gradle.properties           # VERSION_CODE / VERSION_NAME  ← Release-Version
└── README.md                   # diese Datei
```

Die eigentliche Anwendungslogik liegt **nicht** in diesem Ordner, sondern im
Repository-Root (Web-App) – hier wird sie nur verpackt.

---

## Bauen

Voraussetzungen: JDK 17+, Android SDK (Platform 34). Der Gradle-Wrapper lädt
beim ersten Build Gradle 8.7 herunter (einmalig, Internet nötig). Der Download
wird über `distributionSha256Sum` in `gradle/wrapper/gradle-wrapper.properties`
gegen die offizielle Prüfsumme verifiziert (F-Droid verlangt das).

**Mit Android Studio:** „Open“ → Ordner `android/` wählen.

**Von der Kommandozeile:**

```sh
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Zum Installieren auf dem Handy (USB-Debugging oder APK kopieren):

```sh
adb install app/build/outputs/apk/debug/app-debug.apk
```

Ein Release-APK (unsigniert, für F-Droid irrelevant – F-Droid signiert selbst):

```sh
./gradlew assembleRelease
```

> Hinweis: `assembleDebug` ist mit dem Debug-Schlüssel signiert und direkt
> installierbar. Für die Weitergabe außerhalb von F-Droid müsstest du selbst
> signieren (`signingConfigs` im `app/build.gradle`).

---

## Neue Version veröffentlichen (für F-Droid wichtig)

1. In `android/gradle.properties` `VERSION_CODE` (+1) und `VERSION_NAME`
   anpassen.
2. Änderungen committen und mit einem Tag versehen, das zum `VERSION_NAME`
   passt:

   ```sh
   git tag android-v1.0.0
   git push origin main --tags
   ```

   (Erste Android-Version ist aktuell `1.0.0` → Tag `android-v1.0.0`.)
3. Optional Launcher-Icons neu erzeugen, falls sich `icons/icon-512.png`
   geändert hat:

   ```sh
   python3 android/tools/make_icons.py
   ```

---

## Zu F-Droid hinzufügen

F-Droid baut Apps nicht aus diesem Repository, sondern aus dem separaten
[f-droid/fdroiddata](https://gitlab.com/fdroid/fdroiddata)-Repository. Dafür
wird dort einmalig eine Metadaten-Datei angelegt
(`metadata/io.github.barcibarci.golfswing.yml`). Der Inhalt (Vorschlag):

```yaml
Categories:
  - Science & Education
  - Sports & Health
License: MIT
WebSite: https://BarciBarci.github.io/Golfswing/
SourceCode: https://github.com/BarciBarci/Golfswing
IssueTracker: https://github.com/BarciBarci/Golfswing/issues
Changelog: https://github.com/BarciBarci/Golfswing/releases

AutoName: Golf Swing Analysis
Summary: Analyze golf swing videos offline in slow motion
Description: |-
  Golf Swing Analysis plays back a swing video in slow motion (down to
  0.1x), lets you trim it and draw lines and circles directly on the video
  to check posture, spine angle, head position or swing path. Lines and
  circles can be limited to a time window, projects can be saved as .glf
  files together with the video and reopened at any time.

  The app is an offline wrapper around the open-source static web app.
  Videos and projects never leave the device - no Internet permission, no
  trackers, no analytics.

RepoType: git
Repo: https://github.com/BarciBarci/Golfswing

Builds:
  - versionName: 1.0.0
    versionCode: 1
    commit: android-v1.0.0
    subdir: android
    gradle:
      - yes

AutoUpdateMode: Version
UpdateCheckMode: Tags ^android-v
UpdateCheckData:
  android/gradle.properties|VERSION_CODE=(\d+)|.|VERSION_NAME=([^\r\n]+)
CurrentVersion: 1.0.0
CurrentVersionCode: 1
```

Vorgehen:

1. Alle Änderungen (inkl. `android/`) nach GitHub pushen und den Release-Tag
   `android-v1.0.0` setzen (muss zum `VERSION_NAME` passen):

   ```sh
   git add android/ README.md
   git commit -m "Add Android app (F-Droid WebView wrapper)"
   git push origin main
   git tag android-v1.0.0
   git push origin android-v1.0.0
   ```

2. In das [fdroiddata-Repository](https://gitlab.com/fdroid/fdroiddata)
   wechseln, dort `metadata/io.github.barcibarci.golfswing.yml` anlegen (Inhalt
   wie oben – der erste Eintrag unter `Builds` referenziert den Tag
   `android-v1.0.0`) und einen **Merge-Request** einreichen. Wer das nicht per
   GitLab machen möchte, kann stattdessen ein Issue im fdroiddata-Repo öffnen
   und die YAML-Datei dort einfügen.

   Die F-Droid-Maintainer bauen die App dann testweise und nehmen sie nach
   erfolgreichem Build in den Katalog auf (Details: [Offizielle
   Anleitung](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/)).

3. Nach der Aufnahme erkennt F-Droid neue Versionen automatisch: `VERSION_CODE`
   und `VERSION_NAME` in `android/gradle.properties` erhöhen, Tag
   `android-vX.Y.Z` setzen und pushen – fertig.

Weitere Empfehlungen für eine saubere Aufnahme:

- Die Versionsnummern (`VERSION_CODE`/`VERSION_NAME`) und der Tag müssen
  zusammenpassen und bei jeder Veröffentlichung erhöht werden.
- Das fdroiddata-Repository verlangt öffentlichen Quellcode und eine freie
  Lizenz (hier MIT, siehe `LICENSE`) – beides ist erfüllt.
- Beschreibungen & Icon im Fastlane-Format liegen bereits im Repo-Root
  (`fastlane/metadata/android/en-US/`) – sie werden beim Bau automatisch mit
  übernommen und sind übersetzbar. Screenshots können später unter
  `fastlane/metadata/android/en-US/images/phoneScreenshots/` ergänzt werden
  (Details: [All About Descriptions, Graphics and
  Screenshots](https://f-droid.org/docs/All_About_Descriptions_Graphics_and_Screenshots/)).
- Große Binärdateien (Testvideos) bitte nicht einchecken – sie würden bei
  jedem F-Droid-Build mitgeklont.
