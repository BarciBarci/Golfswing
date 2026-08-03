# ⛳ Golf-Schwunganalyse

> 🇬🇧 [English version](README.en.md)

Eine Web-App zur Analyse von Golfschwüngen: Ein Schwung-Video wird geladen und
kann in **Zeitlupe** abgespielt werden. Direkt auf dem Film lassen sich **Linien
und Kreise in verschiedenen Farben** zeichnen, um z. B. die Wirbelsäulenachse,
die Kopfposition oder den Schwungweg zu kontrollieren.

Die App ist eine reine **statische Webseite** (HTML/CSS/JavaScript ohne
Build-Schritt) – sie läuft lokal im Browser, auf dem PC genauso wie auf
iPhone/iPad (iOS) und Android. Es wird **nichts hochgeladen**; alle Daten
bleiben auf dem Gerät.

## Funktionen

- 📂 **Video öffnen** per Klick oder Drag & Drop (MP4/WebM/MOV u. a.)
- 🐢 **Geschwindigkeit** stufenlos von **0,1× bis 1×** (Slider + Schnellwahl: 0,1× / 0,25× / 0,5× / 1×)
- ⏮⏭ **Einzelbild-Schritt** vor/zurück für die genaue Schwunganalyse
- 📏 **Linien** und ⭕ **Kreise** in 9 Farben direkt auf dem Video zeichnen (Maus oder Touch)
- 🖐 **Verschieben**: Griffpunkte (Linienenden, Kreismitte/-rand) einzeln ziehen – oder die ganze Linie bzw. den ganzen Kreis packen und verschieben (Taste `M`)
- 👁 **Zeitfenster** pro Überlagerung (von/bis): Linien/Kreise erscheinen nur in einem bestimmten Schwungabschnitt – standardmäßig sind sie immer sichtbar
- 🎚 **Zeitleisten-Slider** direkt unter dem Video zum Springen an jede Stelle
- ↩ **Rückgängig**, Löschen einzeln oder alle, Sichtbarkeit pro Element
- 💾 **Export/Import** der Überlagerungen als JSON (z. B. zum Teilen mit dem Trainer)
- ⌨️ **Tastatur**: `Leertaste` Abspielen/Pause · `←`/`→` Einzelbild · `L`/`C`/`M` Werkzeug · `Esc` Abbruch · `Strg+Z` Rückgängig

## Lokal starten

Am einfachsten: `index.html` im Browser öffnen (Doppelklick). Alternativ mit
einem lokalen Server:

```sh
# Python
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

## Auf GitHub veröffentlichen

Die App braucht kein Backend und funktioniert direkt über GitHub Pages:

1. Neues Repository auf GitHub anlegen (z. B. `golf-schwunganalyse`).
2. In diesem Ordner ein Git-Repository initialisieren und pushen:

   ```sh
   git init
   git add .
   git commit -m "Golf-Schwunganalyse v1"
   git branch -M main
   git remote add origin https://github.com/DEIN-USERNAME/golf-schwunganalyse.git
   git push -u origin main
   ```

3. Auf GitHub: **Settings → Pages → Source: Branch `main` / Ordner `/ (root)`** wählen und speichern.
4. Die App ist dann unter `https://DEIN-USERNAME.github.io/golf-schwunganalyse/` erreichbar – auch vom Handy.

## Bedienung

1. **Video auswählen** (Datei bleibt lokal).
2. Tempo unten einstellen (z. B. 0,25×), per Slider zur gewünschten Stelle springen oder ein Bild pro Schritt (`⏮`/`⏭`) navigieren.
3. Werkzeug 📏 oder ⭕ wählen, Farbe antippen und direkt auf dem Video ziehen.
4. In der Liste **Überlagerungen** pro Element: Zeitfenster setzen, Sichtbarkeit umschalten oder löschen.
5. Optional: Überlagerungen als JSON **exportieren**/importieren.

**Tipp für die Haltungskontrolle:** Pausiere z. B. am Top of Backswing, zeichne
eine Linie entlang der Wirbelsäule und setze als Zeitfenster „von/bis“ eng um
diesen Moment. So siehst du beim Abspielen genau an der richtigen Position, ob
die Achse stimmt.

## Projektstruktur

```
golf-schwunganalyse/
├── index.html   # Aufbau der Oberfläche
├── styles.css   # Gestaltung (dunkles Theme, mobiloptimiert)
├── app.js       # Logik: Video, Geschwindigkeit, Zeichnen, Zeitfenster
└── README.md
```

## Hinweise

- **iOS:** Das Video wird über `playsinline` im Player angezeigt; bitte keine
  YouTube-/Download-Links erwarten – es werden lokale Dateien geladen.
- **Formate:** Am besten kompatibel ist MP4 mit H.264-Codec. WebM funktioniert
  in Chrome/Firefox, MOV meist ebenfalls.
- **Datenschutz:** Keine Server, keine Analyse, keine Cookies – die App läuft
  komplett offline.

## Ideen für später

- Standbild als Bild exportieren (mit eingezeichneten Linien)
- Mehrere Videos in einer Sitzung vergleichen
- Schwung in einer Schleife abspielen (Loop)
