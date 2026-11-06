# Neue GRANDE-Website veröffentlichen – Schritt für Schritt

Deine aktuelle Website läuft bei **Netlify**. Die neue Website besteht nur aus normalen Dateien (HTML, Bilder, Videos). Du brauchst keine Programmierkenntnisse.

**Inhalt der ZIP-Datei**
* `website/`: **Diesen Ordner lädst du hoch.** Er enthält alle Seiten, Bilder, Videos und Schriften.
* `entwicklung/`: Nur für Entwickler (Werkzeug zum Neu-Erzeugen der Unterseiten). Diesen Ordner **nicht** hochladen.
* `ANLEITUNG.md`: Diese Anleitung.

---

## Schritt 0 – Sicherung der aktuellen Website (wichtig!)

1. Gehe auf **app.netlify.com** und melde dich an.
2. Öffne deine Seite **granderoleplay.ch**.
3. Klicke oben auf **Deploys**.
4. Klicke auf den obersten Eintrag mit dem Vermerk **Published**.
5. Klicke rechts auf **Download** (bzw. „…“ → *Download deploy*). Du erhältst eine ZIP-Datei mit deiner jetzigen Website.
6. Bewahre diese ZIP-Datei gut auf. Damit kannst du jederzeit zurück.

> Netlify speichert alte Versionen ohnehin. Du kannst später mit einem Klick zurück (siehe Schritt 4).

## Schritt 1 – Wichtige Datei aus der alten Website übernehmen

Deine aktuelle Website hat eine **Weiterleitung für den Serverstatus** (`/api/players`, `/api/info`). Ohne sie zeigt die neue Seite den Spielerstand nicht an.

1. Entpacke die Sicherung aus Schritt 0.
2. Suche darin die Datei **`_redirects`**. Sie kann auch **`netlify.toml`** heissen oder es gibt beide.
   * Die Datei beginnt mit einem Unterstrich bzw. heisst genau so. Auf dem Mac musst du eventuell versteckte Dateien einblenden (`Cmd + Shift + .`).
3. **Kopiere diese Datei(en)** in den Ordner `website/` der neuen ZIP.
4. Falls es in der Sicherung einen Ordner **`netlify/`** gibt (z. B. `netlify/functions`), kopiere auch diesen mit.

> Findest du keine solche Datei, wurde die Weiterleitung direkt in den Netlify-Einstellungen gemacht. Dann musst du nichts kopieren.

## Schritt 2 – Zuerst gefahrlos testen (empfohlen)

So siehst du die neue Website im Internet, **ohne** granderoleplay.ch zu verändern.

1. Gehe in Netlify auf **Sites** (Startübersicht).
2. Klicke auf **Add new site → Deploy manually**.
3. Ziehe den Ordner **`website`** in das Feld.
4. Nach wenigen Sekunden bekommst du eine Test-Adresse wie `https://irgendwas-123.netlify.app`.
5. Öffne sie am **PC und am Handy** und teste:
   * Startseite mit Video, Menü und alle Buttons
   * Serverstatus: Er funktioniert hier nur, wenn du in Schritt 1 die `_redirects`-Datei mitkopiert hast.
   * Regelwerk: Suche, Tabs, „Alle öffnen“
   * Discord-Links und „Jetzt spielen“

Gefällt dir alles, geht es weiter. Die Test-Seite kannst du danach in Netlify wieder löschen (*Site configuration → Delete site*).

## Schritt 3 – Live schalten auf granderoleplay.ch

**Fall A: Du lädst Dateien per Drag & Drop hoch.** Das ist der Fall, wenn bei *Deploys* kein GitHub/GitLab verbunden ist.
1. Öffne in Netlify deine Seite **granderoleplay.ch** → **Deploys**.
2. Ziehe den Ordner **`website`** (inkl. `_redirects` aus Schritt 1) in das Feld *„Drag and drop your site output folder here“*.
3. Warte, bis „Published“ erscheint. Fertig, die neue Website ist online.

**Fall B: Deine Seite ist mit GitHub verbunden.** Unter *Deploys* steht dann ein Repository.
1. Ersetze im Repository die alten Website-Dateien durch den Inhalt von `website/`.
2. **Lösche dabei nicht** `_redirects`, `netlify.toml` oder den Ordner `netlify/`.
3. Speichere bzw. pushe die Änderung. Netlify veröffentlicht automatisch.

Danach: Öffne **granderoleplay.ch** und drücke einmal **Strg + F5** (Mac: `Cmd + Shift + R`), damit dein Browser keine alte Version zeigt.

## Schritt 4 – Falls etwas nicht stimmt: zurück zur alten Version

1. Netlify → granderoleplay.ch → **Deploys**.
2. Klicke auf den **alten Deploy** (den vor dem neuen).
3. Klicke auf **Publish deploy**.
4. Nach wenigen Sekunden ist die alte Website wieder online.

---

## Gut zu wissen

* **Alte Links funktionieren weiter:** `/regelwerk`, `/philosophie`, `/impressum` und direkte Regel-Links wie `/regelwerk#p3`.
* **Serverstatus:** Er nutzt genau dieselben Datenquellen wie bisher (`/api/players`, `/api/info` und als Ersatz die FiveM-Serverliste). Er aktualisiert sich jede Minute.
* **Discord-Zahlen:** Mitglieder und Online kommen live von Discord. Ist Discord nicht erreichbar, werden die Zahlen einfach ausgeblendet; der Beitreten-Button funktioniert trotzdem.
  * Empfehlung für die Datenschutzerklärung (Punkt 4 „Discord“), ein Satz: *„Die Startseite zeigt die Mitgliederzahl unseres Discord-Servers an. Dazu ruft dein Browser die öffentliche Einladungsinformation bei Discord ab.“*
* **Schriften:** Sie liegen auf deinem eigenen Server. Es werden keine Daten an Google übertragen.
* **Hintergrundvideo austauschen:** Ersetze `website/assets/video/hero-loop.mp4` (PC) und `hero-loop-720.mp4` (Handy) durch eigene Ingame-Aufnahmen.
  * Gleicher Dateiname, MP4, 5–10 Sekunden, ohne Ton
  * Grösse: am besten unter 3 MB (PC) bzw. 1 MB (Handy)
* **Regelwerk ändern:** Bearbeite die Texte direkt in `website/regelwerk.html` (Suche nach dem Paragraphen). Das Inhaltsverzeichnis baut sich automatisch.
