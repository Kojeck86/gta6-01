// The moving things in Port Solara: traffic cars, parked cars, pedestrians,
// bullets and particles. One clear job: the data and the per-frame movement
// of everything that is not the player and not the police.

import { CAR, WORLD } from './config.js';
import { clamp, distance, angleDelta, intBetween, pick, floatBetween } from './random.js';

const TRAFFIC_COLORS = ['#c8ccd4', '#7a9cc6', '#c65f4e', '#5e8a5a', '#d8b13c', '#8a7fb8', '#4e4a45'];
const PED_COLORS = ['#e8b04b', '#7fb069', '#c97b84', '#6a8caf', '#d9a066', '#9b7bb8'];

// A car: position, heading, speed, health, and who drives it.
export function makeCar(x, y, angle, kind, driver) {
  return {
    x, y, angle,
    speed: 0,
    kind, // 'sedan' | 'taxi' | 'truck' | 'sport' | 'cruiser'
    driver, // 'traffic' | 'parked' | 'player' | 'police'
    color: kind === 'taxi' ? '#f2c200' : kind === 'cruiser' ? '#24344d' : pick(Math.random, TRAFFIC_COLORS),
    health: CAR.maxHealth,
    smoke: 0,
    // Traffic AI state: which road it follows and where it turns.
    road: null,
    targetSpeed: CAR.trafficSpeed,
    stuck: 0,
  };
}

// A pedestrian on the sidewalk.
export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 40 + rng() * 50,
    color: pick(rng, PED_COLORS),
    state: 'walk', // 'walk' | 'flee' | 'down'
    target: null,
    panic: 0,
  };
}

// A bullet in flight.
export function makeBullet(x, y, angle, from) {
  return {
    x, y,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    life: 0.6,
    from, // 'player' | 'enemy' | 'cop'
  };
}

// A particle: smoke, sparks, blood, muzzle flash.
export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

// Drive a traffic car along the road grid: keep to its lane, turn at
// intersections, slow down for the car ahead. Returns false when the car
// should be recycled (it drove off the map's edge).
export function updateTraffic(car, dt, city, ahead) {
  if (car.driver !== 'traffic') return true;
  const target = car.targetSpeed;
  car.speed += clamp(target - car.speed, -CAR.brake * dt, CAR.accel * dt);
  // Slow for the car ahead on the same road.
  if (ahead && distance(car.x, car.y, ahead.x, ahead.y) < 90) {
    car.speed = Math.max(0, car.speed - CAR.brake * dt * 2);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Turn at an intersection sometimes; never drive into a building.
  const nearIntersection = city.verticalRoads.some((rx) => Math.abs(nx - rx) < 24)
    && city.horizontalRoads.some((ry) => Math.abs(ny - ry) < 24);
  if (nearIntersection && Math.random() < 0.02) {
    car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
  }
  if (nx < 150 || nx > WORLD.width - 60 || ny < 60 || ny > WORLD.height - 60) return false;
  if (city.hitsSolid(nx, ny, 24)) {
    // Bumped into a building corner: turn around.
    car.angle += Math.PI;
    car.speed *= 0.5;
    return true;
  }
  car.x = nx;
  car.y = ny;
  return true;
}

// Drive a car under player control: arcade steering with a handbrake.
export function updatePlayerCar(car, dt, input, city) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  let throttle = 0;
  if (input.up) throttle = 1;
  if (input.down) throttle = -0.55;
  const target = throttle * (throttle > 0 ? CAR.maxSpeed : CAR.reverseSpeed);
  const accel = throttle === 0 ? CAR.brake * 0.6 : CAR.accel;
  car.speed += clamp(target - car.speed, -accel * dt, accel * dt);
  if (input.handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const moving = Math.abs(car.speed) > 12;
  if (moving && steerInput !== 0) {
    const grip = input.handbrake ? 0.45 : 1;
    car.angle += steerInput * CAR.steer * grip * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 180);
  }
  const nx = car.x + forward * car.speed * dt;
  const ny = car.y + right * car.speed * dt;
  if (city.hitsSolid(nx, car.y, 22)) {
    car.speed *= 0.4;
  } else {
    car.x = nx;
  }
  if (city.hitsSolid(car.x, ny, 22)) {
    car.speed *= 0.4;
  } else {
    car.y = ny;
  }
  car.x = clamp(car.x, 130, WORLD.width - 20);
  car.y = clamp(car.y, 20, WORLD.height - 20);
  if (car.health < 40) car.smoke = Math.min(1, car.smoke + dt * 0.5);
}

// Walk a pedestrian: amble along sidewalks, flee from gunfire.
export function updatePed(ped, dt, city, danger) {
  if (ped.state === 'down') return;
  if (danger && distance(ped.x, ped.y, danger.x, danger.y) < 260) {
    ped.state = 'flee';
    ped.panic = 3;
  }
  if (ped.panic > 0) ped.panic -= dt;
  else if (ped.state === 'flee') ped.state = 'walk';
  const speed = ped.state === 'flee' ? 260 : ped.speed;
  if (ped.state === 'flee' && danger) {
    ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
  } else if (Math.random() < 0.01) {
    ped.angle += (Math.random() - 0.5) * 1.6;
  }
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!city.hitsSolid(nx, ny, 10)) {
    ped.x = clamp(nx, 130, WORLD.width - 10);
    ped.y = clamp(ny, 10, WORLD.height - 10);
  } else {
    ped.angle += Math.PI / 2;
  }
}

// Move bullets; returns the ones still flying.
export function updateBullets(bullets, dt, city) {
  const alive = [];
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (city.hitsSolid(b.x, b.y, 2)) {
      continue; // hit a wall: spark handled by the caller via particles
    }
    alive.push(b);
  }
  return alive;
}

// Move particles; returns the ones still alive.
export function updateParticles(particles, dt) {
  const alive = [];
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 2.5 * dt);
    p.vy *= Math.max(0, 1 - 2.5 * dt);
    p.life -= dt;
    if (p.life > 0) alive.push(p);
  }
  return alive;
}

// A burst of particles at a point (explosion, impact, blood).
export function burst(particles, x, y, count, colors, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push(makeParticle(
      x, y,
      Math.cos(a) * s, Math.sin(a) * s,
      life * (0.5 + Math.random() * 0.5),
      pick(Math.random, colors), size * (0.6 + Math.random() * 0.8),
    ));
  }
}
