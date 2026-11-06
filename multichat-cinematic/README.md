# GRANDE – Multi-Chat Cinematic (13 Sekunden)

**Ergebnis:** [`GRANDE_MULTICHAT_CINEMATIC.mp4`](GRANDE_MULTICHAT_CINEMATIC.mp4)
1920 × 1080 · 60 fps · exakt 13,0 s · H.264 · AAC Stereo 48 kHz · keine Texte, Logos oder Untertitel

Ein Ich-Perspektiven-Hörerlebnis: Party → Rausch → Schießerei → Zusammenbruch → Blackout.
Das Bild ist fast vollständig schwarz. Der Ton trägt die Szene.

## Ablauf

| Zeit | Bild | Ton |
|---|---|---|
| 0–4 s | Extrem unscharfe rote, violette und blaue Partylichter pulsieren zum Beat | Basslastige Clubmusik (126 BPM, Four-on-the-Floor-Kick), deutsches Stimmengewirr aus allen Richtungen, Frauen lachen, Gläser klirren. **„Hey, alles gut bei dir?“** (Frau, flirtend, links). **„Komm, wir gehen tanzen!“** (zweite Frau, rechts, nach einem Lachen) |
| 4–7 s | Doppelsicht, Schwanken, schwere Augenlider | Musik leiert (Tape-Wobble), wird dumpf, gesättigt und dröhnend. **„Ey, hörst du mir überhaupt zu?“** direkt am linken Ohr. **„Was ist denn mit dir los?“** wird aus dem Hintergrund gerufen. Verlangsamte, verhallte Satzfetzen überlagern sich |
| 7–10 s | Lichter flackern, kurze Mündungsblitze, Erschütterung | Musik bricht bei 7,0 s abrupt ab. 11 Schüsse aus verschiedenen Richtungen und Entfernungen, Glasbruch, umfallende Stühle, rennende Schritte, panische Schreie. **„Scheiße! Was ist das?!“** · **„Runter! Alle runter!“** · **„Lauft! Lauft!“** · „Raus hier! Schnell!“ · „Hilfe!“ · „Oh Gott, oh Gott!“ |
| 10–11 s | Lichter erlöschen | Alles wird stark gedämpft, ein hoher Tinnitus-Ton setzt ein, dazu ein tiefer Herzschlag. Die Stimmen entfernen sich |
| 11–13 s | Komplett schwarz | Der Herzschlag verlangsamt sich, ein letztes dumpfes Pochen bei 12,35 s, ab 12,9 s absolute digitale Stille |

## Woher der Ton stammt (bitte lesen)

* **Stimmen:** Alle deutschen Stimmen sind **neuronale Text-to-Speech-Stimmen**, keine echten Sprachaufnahmen. Verwendet werden die Piper-Stimmen aus [`rhasspy/piper-voices`](https://huggingface.co/rhasspy/piper-voices):
  * Frauen: `kerstin`, `eva_k`, `ramona`
  * Männer: `thorsten`, `thorsten_emotional` (Stil „angry“), `karlsson`, `pavoque`

  Jede Hauptzeile wurde per Spracherkennung (Whisper) auf Verständlichkeit geprüft. Das Multisprecher-Modell `mls` wurde verworfen, weil es auf Deutsch unverständlich klang.
  TTS kann nicht wirklich schreien. Die Schreie sind deshalb bearbeitete TTS-Stimmen: höher, schneller, mit Zittern, Präsenzanhebung und Sättigung.
* **Effekte und Musik:** Diese sind **prozedural synthetisiert** (numpy/scipy), nicht aus einer lizenzierten Bibliothek. In dieser Umgebung gab es keinen Zugriff auf Sound-Libraries.
  Synthetisiert wurden: Schüsse (Knall, Körper, Raumreflexionen), Glasbruch (Scherben-Resonanzen), Stühle, Schritte, Club-Track, Gläser, Tinnitus und Herzschlag.
* **Räumlichkeit:** Laufzeit- und Pegelunterschiede zwischen den Ohren (ITD/ILD), Kopfschatten, Nah- und Fernfeld, Raumhall. Dazu kommt ein Sidechain-Ducking, mit dem die Hauptdialoge im Chaos verständlich bleiben.

**Am besten mit Kopfhörern anhören.**

## Neu bauen

```bash
cd multichat-cinematic
./build.sh          # lädt Stimmen (~450 MB), erzeugt Ton + Bild, muxt das MP4 (~3 Minuten)
```

Echte Sprachaufnahmen oder lizenzierte SFX lassen sich später einsetzen. In `audio.py` ersetzt man dafür den jeweiligen `say(...)`-Aufruf bzw. die Effektfunktion durch das Laden einer WAV-Datei. Die Platzierung (Zeit, Richtung, Entfernung) bleibt dabei erhalten.
