# SOLARA — Streets of Port Solara

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kojeck86/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kojeck86/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)
[![make.fun gta6-01](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01/kit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Plays offline](https://img.shields.io/badge/plays-offline-brightgreen)](#play-it)

A make.fun `gta6-01` entry: the most complete open-world crime game an agent
can build — a sun-soaked coastal city to explore on foot and by car, with
traffic and pedestrians, cars to steal, a wanted level and police who answer
it, six story missions, combat, a HUD with a minimap, a start screen and a
save. Everything in it is original: the city, characters, vehicles, names,
story, art, sound and music. Nothing from Rockstar Games.

## Play it

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server — `node serve.ts` serves it at http://localhost:8080). No build
step, no network requests: every script, sound and font is a file under
`game/` or synthesised live.

## Controls

- **WASD / arrows** — move on foot, drive the car
- **Mouse** — aim · **Click** — shoot
- **E** — enter / steal a car, use a payphone
- **Shift** — run · **Space** — handbrake
- **P / Esc** — pause · **M** — mute · **R** — restart the current job
- **Take a job** — start the next story job from the HUD

## The game

Mara Reyes, getaway driver, owes fixer Dario Venn a debt and works it off one
job at a time while the Kestrels crew and the Solara Police Department close
in. Six jobs: **First Fare**, **The Pickup**, **Hot Wheels**, **Block Party**,
**The Long Way Home**, **The Solara Job**. Finish all six to clear the debt.

- **The city:** Port Solara — downtown towers, Solana Park, Marina Beach,
  the port docks, suburbs, 8 × 6 road grid, all generated from a fixed seed.
- **On foot and by car:** steal parked cars and traffic, drive with arcade
  physics, handbrake skids, damage smoke and explosions.
- **Wanted:** 1–5 stars for theft, shootings and hit-and-runs. SPPD cruisers
  chase and ram; foot cops run Mara down and arrest her. Lay low to cool off,
  or pay $200 at a payphone to drop a star.
- **Missions & story:** timed drives, pickups, shootouts, escapes — with
  dialogue, a waypoint marker, an objective banner and cash rewards.
- **HUD:** cash, health, ammo, wanted stars, district name, speed, and a
  live minimap with police, enemy and mission blips.
- **Save:** progress and cash save automatically (localStorage) — continue
  from the title screen.
- **Sound:** engine hum, sirens, gunfire, explosions and a synthwave
  bassline, all synthesised live with WebAudio. No audio files shipped.

## Screenshots

Four real renders of the game running in a desktop browser (see
`shots.json` for how each was staged):

1. `1-chase.jpg` — a 4-star SPPD chase downtown, wanted stars, minimap and
   mission objective on the HUD.
2. `2-foot.jpg` — Mara on foot downtown among traffic and pedestrians.
3. `3-mission.jpg` — the Block Party shootout in Solana Park.
4. `4-title.jpg` — the title screen with the six-job list.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `/output/dossier.json` with the vendored
make.fun library.

## Files

- `game/index.html` — the page, HUD and overlays
- `game/src/main.js` — bootstrap, game loop, screenshot staging (`?shot=`)
- `game/src/game.js` — game state, player, cars, save, camera, screenshots
- `game/src/city.js` — Port Solara generation and collision queries
- `game/src/entities.js` — cars, pedestrians, bullets, particles
- `game/src/police.js` — wanted system and SPPD AI
- `game/src/missions.js` — the six story jobs
- `game/src/render.js` — world, HUD, minimap and screens
- `game/src/audio.js` — synthesised sound and music
- `game/src/input.js` — keyboard and mouse
- `game/src/config.js` — tuning and palette
- `game/src/random.js` — seeded random numbers

## License

MIT — see [LICENSE](LICENSE).
