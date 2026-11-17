// The Solara Police Department: wanted levels, cruisers that chase and ram,
// foot cops that run the player down. One clear job: turn crimes into heat
// and heat into a response the player can feel — and escape.

import { POLICE, WANTED, CAR, WORLD } from './config.js';
import { clamp, distance, angleDelta } from './random.js';
import { makeCar } from './entities.js';

// A police cruiser (a car with a police driver) or a foot cop.
export function makePoliceCruiser(x, y, angle) {
  const car = makeCar(x, y, angle, 'cruiser', 'police');
  car.targetSpeed = CAR.policeSpeed;
  car.ramTimer = 0; // seconds until this cruiser can ram again
  return car;
}

export function makeFootCop(x, y) {
  return { x, y, angle: 0, speed: 250, state: 'chase', bustTimer: 0, hitTimer: 0, color: '#24344d' };
}

// Wanted state: level 0..5 and heat 0..1 inside the level.
export class Wanted {
  constructor() {
    this.level = 0;
    this.heat = 0;
    this.quiet = 0; // seconds since the last crime
  }

  // A crime was committed: raise the level (and reset the quiet timer).
  commit(stars) {
    if (stars <= 0) return;
    this.level = Math.min(WANTED.maxLevel, this.level + stars);
    this.heat = 1;
    this.quiet = 0;
  }

  // Per-frame: cool off when quiet, drop a level when the heat is gone.
  update(dt, committing) {
    if (committing) {
      this.quiet = 0;
      return;
    }
    this.quiet += dt;
    if (this.quiet > WANTED.coolOffSeconds && this.level > 0) {
      this.heat -= WANTED.decayPerSecond * dt;
      if (this.heat <= 0) {
        this.level -= 1;
        this.heat = this.level > 0 ? 1 : 0;
        this.quiet = 0;
      }
    }
  }

  // Drop one star (payphone) or clear everything (mission reward).
  dropStar() {
    if (this.level > 0) {
      this.level -= 1;
      this.heat = this.level > 0 ? 1 : 0;
      this.quiet = 0;
    }
  }

  clear() {
    this.level = 0;
    this.heat = 0;
    this.quiet = 0;
  }
}

// Steer a cruiser toward the player: pursuit with ramming. Returns true
// when the cruiser touches the player's car (a ram).
export function updateCruiser(cruiser, dt, player, city) {
  if (cruiser.ramTimer > 0) cruiser.ramTimer -= dt;
  const tx = player.car ? player.car.x : player.x;
  const ty = player.car ? player.car.y : player.y;
  const want = Math.atan2(ty - cruiser.y, tx - cruiser.x);
  const turn = clamp(angleDelta(cruiser.angle, want), -1, 1);
  const dist = distance(cruiser.x, cruiser.y, tx, ty);
  const targetSpeed = dist > 420 ? CAR.policeSpeed : CAR.policeSpeed * 0.75;
  cruiser.speed += clamp(targetSpeed - cruiser.speed, -CAR.brake * dt, CAR.accel * dt);
  cruiser.angle += turn * 3.1 * dt * Math.min(1, Math.abs(cruiser.speed) / 200 + 0.3);
  const nx = cruiser.x + Math.cos(cruiser.angle) * cruiser.speed * dt;
  const ny = cruiser.y + Math.sin(cruiser.angle) * cruiser.speed * dt;
  if (!city.hitsSolid(nx, ny, 22)) {
    cruiser.x = nx;
    cruiser.y = ny;
  } else {
    cruiser.angle += 0.6;
    cruiser.speed *= 0.5;
  }
  cruiser.x = clamp(cruiser.x, 130, WORLD.width - 20);
  cruiser.y = clamp(cruiser.y, 20, WORLD.height - 20);
  return dist < 58;
}

// Chase the player on foot. Returns 'busted' when the cop holds the player
// long enough, 'touch' when contact just started, else null.
export function updateFootCop(cop, dt, player, city) {
  if (cop.hitTimer > 0) cop.hitTimer -= dt;
  const d = distance(cop.x, cop.y, player.x, player.y);
  const want = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.angle = want;
  const speed = d > 200 ? cop.speed : cop.speed * 0.85;
  const nx = cop.x + Math.cos(want) * speed * dt;
  const ny = cop.y + Math.sin(want) * speed * dt;
  const moved = city.moveCircle(cop.x, cop.y, nx - cop.x, ny - cop.y, 12);
  cop.x = moved.x;
  cop.y = moved.y;
  if (d < POLICE.arrestRadius) {
    cop.bustTimer += dt;
    if (cop.bustTimer >= WANTED.bustSeconds) return 'busted';
    return 'touch';
  }
  cop.bustTimer = Math.max(0, cop.bustTimer - dt * 2);
  return null;
}

// How many cruisers and foot cops the wanted level calls for.
export function wantedForce(level, playerInCar) {
  return {
    cruisers: Math.min(level * POLICE.cruiserPerLevel, 6),
    footCops: playerInCar ? 0 : Math.min(level * POLICE.footCopPerLevel, 4),
  };
}

// A spawn point for a new unit: on a road, a good distance from the player,
// roughly in the direction the player is heading.
export function spawnPoint(city, rng, player, dist) {
  for (let tries = 0; tries < 12; tries++) {
    const p = city.randomRoadPoint(rng);
    const d = distance(p.x, p.y, player.x, player.y);
    if (d > dist * 0.7 && d < dist * 1.6) return p;
  }
  const p = city.randomRoadPoint(rng);
  return p;
}
