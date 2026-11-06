# GRANDE Roleplay – Website-Redesign (Vorschau)

Statische Website (HTML/CSS/JS, keine Abhängigkeiten) für **granderoleplay.ch**.
**Die Live-Website wurde nicht verändert.** Dieses Verzeichnis ist nur die Vorschau bzw. der neue Quellcode.

## Seiten
| Datei | Inhalt |
|---|---|
| `index.html` | Startseite: Hintergrundvideo, Die Stadt (Cayo Porto, Scripts, Kleidung, Mappings, Werkstätten, Jobs, Voice), Fraktionen & Jobs, Live-Status, Discord, Downloads, Regeln, Philosophie |
| `regelwerk.html` | Regelwerk – Regeltext 1:1 von der Live-Seite (`source/regelwerk_original.html`), neu: Inhaltsverzeichnis, Fortschrittsbalken, „Alle öffnen“, Link-Kopieren je Paragraph, Tab-Links (`#streaming`, `#fraktionen`) |
| `philosophie.html`, `impressum.html` | Originaltexte im neuen Design |

`tools/build_pages.py` erzeugt die drei Unterseiten neu (z. B. nach einer Regelwerk-Änderung in `source/regelwerk_original.html`).

## Wichtig vor dem Live-Gang
* Die bestehende Netlify-Konfiguration (`_redirects` bzw. `netlify.toml` mit den `/api/players`-, `/api/info`-Weiterleitungen) **muss erhalten bleiben**. Der Live-Status nutzt exakt dieselben Quellen wie bisher.
* Schriften sind selbst gehostet (keine Anfragen an Google) – passt zur Datenschutzerklärung „kein Tracking“.
* Neu: Discord-Mitgliederzahl über die öffentliche Discord-Einladungs-API (`discord.com/api/v10/invites/granderoleplay`). Falls gewünscht, in der Datenschutzerklärung ergänzen.
* Hintergrundvideo `assets/video/hero-loop.mp4` stammt aus dem GRANDE-Trailer (prozedural, keine echte Gameplay-Aufnahme). Echte Ingame-Aufnahmen können 1:1 ersetzt werden (MP4, H.264, ~5–10 s Loop, max. ~3 MB).
