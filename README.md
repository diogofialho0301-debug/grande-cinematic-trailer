# GRANDE — Official FiveM Roleplay Trailer (30 seconds)

**Deliverable:** [`GRANDE_OFFICIAL_TRAILER.mp4`](GRANDE_OFFICIAL_TRAILER.mp4) — 1920×1080, 60 fps, exactly 30.0 s, H.264 High + AAC 320 kb/s stereo.

## Important: about the footage

There was **no GTA V / FiveM gameplay footage** in this project, so the trailer contains **no real gameplay**.
Every shot is a procedural 3D scene built for this trailer: the city, cars, characters and lighting are generated in code with Three.js, rendered in headless Chromium, and graded in a custom post-processing pipeline. All sound effects and the score are synthesised in Python.

If you later capture real in-game footage (Rockstar Editor or a FiveM cinematic camera), the edit decision list below gives the exact slots and durations to replace shot-for-shot. Each slot lists the gameplay clip that is missing.

## Edit / timeline

| Time | Section | Shot (procedural) | Gameplay clip to capture |
|---|---|---|---|
| 0.00–5.00 | The Beginning | Fade from black, aerial push over the night city with gold searchlights. Title: **EVERY CITY HAS A STORY.** | Drone / heli aerial of Los Santos at night |
| 5.00–6.00 | The Lifestyle | Gold supercar low tracking shot | Supercar driving through downtown |
| 6.00–6.75 | | Nightclub crowd, LED wall, beams | Nightclub interior |
| 6.75–7.50 | | Penthouse, silhouette over the skyline | Penthouse interior |
| 7.50–8.25 | | Street race, bumper cam | Street race |
| 8.25–9.00 | | Red-carpet arrival with camera flashes | Characters in luxury outfits |
| 9.00–10.00 | | Sunset coast, palms, skyline. Title: **WRITE YOUR OWN.** | Sunset beach / coast road |
| 10.00–11.25 | The Dark Side | Masked crew preparing a heist under a swinging lamp | Robbery preparation |
| 11.25–12.00 | | Police cruisers blast past the camera | Police convoy |
| 12.00–13.00 | | Helicopter searchlight sweeping the streets | Police helicopter |
| 13.00–14.00 | | Underground meeting between two crews | Criminal meeting |
| 14.00–14.75 | | Distant muzzle flashes, crash zoom | Distant shoot-out |
| 14.75–17.00 | | High-speed chase: front-quarter tracking, then cars blast past | Police pursuit |
| 17.00–24.00 | Your World | Law enforcement, criminal organizations, EMS, business owners, civilian life, luxury & nightlife. Titles: **YOUR LIFE. / YOUR RULES. / YOUR STORY.** | One clip per role |
| 24.00–30.00 | The Reveal | Music stops, black, impact. Gold particles, smoke, and metallic 3D **GRANDE**. Tagline: **THE CITY IS YOURS.** Fade to black. | (keep as is) |

## How it was made

```
trailer/
  src/            Three.js scenes (city, vehicles, figures, 22 shots), post-processing, typography
  render.js       headless Chromium capture driver (parallel workers -> video segments)
  audio.py        procedural sound design + score (numpy), locked to the picture edit
  build.sh        full pipeline -> GRANDE_OFFICIAL_TRAILER.mp4
  assets/fonts/   Cinzel, Montserrat, Bebas Neue (SIL Open Font License)
```

* **Picture:** Each frame averages 2–5 temporal sub-frames with sub-pixel jitter, which gives real motion blur and anti-aliasing. After that come HDR bloom, anamorphic lens streaks, chromatic aberration, ACES tone mapping, a black-and-gold split-tone grade, vignette, film grain and 2.39:1 letterboxing.
* **Sound:** The city ambience, distant and Doppler-shifted sirens, V8 engine start and revs, exhaust pops, helicopter rotor, gunshots and tyre screech are all synthesised. So are the score's elements: whooshes, braams, taiko and drums, bass ostinato, choir pads, risers, the hard stop at 24.0 s, and the final sub-drop impact with a metallic "shing". Convolution reverbs use generated impulse responses.

### Rebuild

Requirements: Node 18+, Python 3 with numpy, ffmpeg, and Playwright with Chromium.

```bash
cd trailer
npm install
./build.sh                # full render (≈1–2 h on 4 CPU cores with software WebGL)
SKIP_RENDER=1 ./build.sh  # re-mux after an audio-only change
node render.js --stills 200,900,1700 --out stills   # preview single frames
```
