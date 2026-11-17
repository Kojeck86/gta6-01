// Port Solara: the city itself. One clear job: generate the whole map from a
// fixed seed and answer every spatial question the simulation asks — what is
// a road, what blocks movement, where the districts are, where things spawn.
// The city is deterministic: the same seed always builds the same streets.

import { WORLD, ROAD_WIDTH, BLOCK, ROAD_START, PALETTE } from './config.js';
import { mulberry32, intBetween, pick, clamp } from './random.js';

const BUILDING_NAMES = [
  'Solara Tower', 'Marina Hotel', 'Kestrel Arms', 'Venn Plaza', 'Coral Court',
  'Sunset Suites', 'Harbor Bank', 'Palm Court', 'The Driftwood', 'Cielo Offices',
  'Bayview Flats', 'Neon Rooms', 'The Galleon', 'Sol Bank', 'Pier 9 Storage',
  'Cactus Motel', 'Lumen Labs', 'The Anchorage', 'Rio Verde', 'The Palms',
];
const TOWER_COLORS = ['#b08d6a', '#9a7b8f', '#7d8ba0', '#a89a6d', '#8a6f5c', '#6f8a7d'];
const HOUSE_COLORS = ['#c9a37e', '#b98d7a', '#a8b08a', '#c2b49a', '#9fb3c8'];

// Districts, by region. The name shows in the HUD as the player moves.
function districtAt(x, y) {
  if (x < 300) return 'Marina Beach';
  if (x > 4200 && y > 3000) return 'The Port';
  if (x > 1500 && x < 2700 && y > 1200 && y < 2100) return 'Downtown';
  if (x > 1500 && x < 2700 && y > 2100 && y < 2700) return 'Solana Park';
  if (y < 900) return 'Northside';
  if (x > 3600) return 'Old Town';
  if (y > 2700) return 'Southside';
  return 'Midtown';
}

export class City {
  constructor(seed = 20261117) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.rng = rng;

    // Road centre lines: 8 vertical, 6 horizontal, 600 px apart.
    this.verticalRoads = [];
    for (let x = ROAD_START; x <= WORLD.width - ROAD_START; x += BLOCK) this.verticalRoads.push(x);
    this.horizontalRoads = [];
    for (let y = ROAD_START; y <= WORLD.height - ROAD_START; y += BLOCK) this.horizontalRoads.push(y);

    // Buildings, parks and props, one block at a time.
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    let nameIndex = 0;
    for (let col = 0; col < this.verticalRoads.length - 1; col++) {
      for (let row = 0; row < this.horizontalRoads.length - 1; row++) {
        const x0 = this.verticalRoads[col] + ROAD_WIDTH / 2 + 24;
        const y0 = this.horizontalRoads[row] + ROAD_WIDTH / 2 + 24;
        const x1 = this.verticalRoads[col + 1] - ROAD_WIDTH / 2 - 24;
        const y1 = this.horizontalRoads[row + 1] - ROAD_WIDTH / 2 - 24;
        // The central block is Solana Park; the south-east corner is the port.
        if (col === 3 && row === 2) {
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, name: 'Solana Park' });
          for (let t = 0; t < 26; t++) {
            this.trees.push({ x: x0 + 30 + rng() * (x1 - x0 - 60), y: y0 + 30 + rng() * (y1 - y0 - 60), r: 12 + rng() * 14 });
          }
          continue;
        }
        if (col === 6 && row === 4) {
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, name: 'Port Yard', dock: true });
          continue;
        }
        const roll = rng();
        if (roll < 0.16) {
          // A small park with trees instead of buildings.
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, name: 'Pocket Park' });
          for (let t = 0; t < 8; t++) {
            this.trees.push({ x: x0 + 30 + rng() * (x1 - x0 - 60), y: y0 + 30 + rng() * (y1 - y0 - 60), r: 10 + rng() * 12 });
          }
          continue;
        }
        const downtown = districtAt((x0 + x1) / 2, (y0 + y1) / 2) === 'Downtown';
        const count = downtown ? 1 : intBetween(rng, 2, 4);
        const palette = downtown ? TOWER_COLORS : HOUSE_COLORS;
        if (count === 1) {
          const w = (x1 - x0) * (0.55 + rng() * 0.2);
          const h = (y1 - y0) * (0.55 + rng() * 0.2);
          const bx = x0 + ((x1 - x0) - w) / 2;
          const by = y0 + ((y1 - y0) - h) / 2;
          this.buildings.push(this.makeBuilding(bx, by, w, h, palette, downtown, nameIndex++));
        } else {
          const cols = 2;
          const rows = Math.ceil(count / cols);
          const cw = (x1 - x0) / cols;
          const ch = (y1 - y0) / rows;
          for (let i = 0; i < count; i++) {
            const cx = x0 + (i % cols) * cw;
            const cy = y0 + Math.floor(i / cols) * ch;
            const w = cw * (0.55 + rng() * 0.2);
            const h = ch * (0.55 + rng() * 0.2);
            this.buildings.push(this.makeBuilding(cx + (cw - w) / 2, cy + (ch - h) / 2, w, h, palette, false, nameIndex++));
          }
        }
      }
    }

    // Payphones: one at each of four busy corners.
    this.payphones = [
      { x: 2100, y: 1500, used: false },
      { x: 3300, y: 2100, used: false },
      { x: 1500, y: 2700, used: false },
      { x: 3900, y: 900, used: false },
    ];

    // Landmark spots the missions use.
    this.spots = {
      start: { x: 2100, y: 1500 }, // downtown crossing, where Mara begins
      marina: { x: 180, y: 1800 }, // the beach promenade
      park: { x: 2100, y: 1800 }, // Solana Park bandstand
      port: { x: 4350, y: 3150 }, // the docks
      northside: { x: 2700, y: 600 }, // Northside garage row
      oldtown: { x: 4050, y: 1500 }, // Old Town alley
      southside: { x: 1500, y: 3150 }, // Southside motel
      hideout: { x: 900, y: 2700 }, // the Kestrels' hideout
    };
  }

  makeBuilding(x, y, w, h, palette, tower, nameIndex) {
    return {
      x, y, w, h,
      color: pick(this.rng, palette),
      roof: PALETTE.buildingRoof,
      tower,
      name: BUILDING_NAMES[nameIndex % BUILDING_NAMES.length],
      district: districtAt(x + w / 2, y + h / 2),
    };
  }

  // Is the point (x, y) on a road (within half the road width of a line)?
  isRoad(x, y) {
    const half = ROAD_WIDTH / 2;
    for (const rx of this.verticalRoads) if (Math.abs(x - rx) <= half) return true;
    for (const ry of this.horizontalRoads) if (Math.abs(y - ry) <= half) return true;
    return false;
  }

  // Does a circle at (x, y) with radius r hit a building, the sea, or the edge?
  hitsSolid(x, y, r) {
    if (x < 120 + r || x > WORLD.width - r || y < r || y > WORLD.height - r) return true;
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  // Slide a circle out of buildings: try the x move, then the y move.
  moveCircle(x, y, dx, dy, r) {
    let nx = x + dx;
    let ny = y + dy;
    if (!this.hitsSolid(nx, y, r)) x = nx;
    if (!this.hitsSolid(x, ny, r)) y = ny;
    return { x, y };
  }

  // The nearest open ground to (x, y): search outward in rings so a spawn
  // never lands inside a building. A courtyard has a way out; this finds it.
  findOpen(x, y, r = 16) {
    if (!this.hitsSolid(x, y, r)) return { x, y };
    for (let ring = 30; ring <= 360; ring += 30) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = x + Math.cos(a) * ring;
        const py = y + Math.sin(a) * ring;
        if (!this.hitsSolid(px, py, r)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  // A random point on a road, for traffic and police spawns.
  randomRoadPoint(rng) {
    if (rng() < 0.5) {
      const rx = pick(rng, this.verticalRoads);
      return { x: rx + (rng() - 0.5) * 40, y: 200 + rng() * (WORLD.height - 400), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
    }
    const ry = pick(rng, this.horizontalRoads);
    return { x: 200 + rng() * (WORLD.width - 400), y: ry + (rng() - 0.5) * 40, angle: rng() < 0.5 ? 0 : Math.PI };
  }

  // The nearest point on a road to (x, y), for parking cars beside the kerb.
  nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of this.verticalRoads) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
    }
    for (const ry of this.horizontalRoads) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
    }
    return best;
  }

  // A random parked-car spot: beside a road, clear of buildings.
  randomParkedSpot(rng) {
    for (let tries = 0; tries < 20; tries++) {
      const p = this.randomRoadPoint(rng);
      const offset = 62;
      const px = p.angle === 0 || p.angle === Math.PI ? p.x : p.x + (rng() < 0.5 ? offset : -offset);
      const py = p.angle === 0 || p.angle === Math.PI ? p.y + (rng() < 0.5 ? offset : -offset) : p.y;
      if (!this.hitsSolid(px, py, 40) && this.isRoad(px, py)) return { x: px, y: py, angle: p.angle };
    }
    return { x: 2100, y: 1560, angle: 0 };
  }

  district(x, y) {
    return districtAt(clamp(x, 0, WORLD.width), clamp(y, 0, WORLD.height));
  }
}
