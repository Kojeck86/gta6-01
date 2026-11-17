// SOLARA — the game itself. One clear job: own the state and run the
// simulation every frame — player, cars, police, missions, wanted, camera,
// save — and hand the drawing to the renderer. Nothing in here draws.

import { City } from './city.js';
import { Wanted, makePoliceCruiser, makeFootCop, updateCruiser, updateFootCop, wantedForce, spawnPoint } from './police.js';
import {
  makeCar, makePed, makeBullet, burst,
  updateTraffic, updatePlayerCar, updatePed, updateBullets, updateParticles,
} from './entities.js';
import { JOB_LIST, startJob, updateJob, finishJob, failJob, makeEnemy, updateEnemies } from './missions.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { PLAYER, CAR, WANTED, COMBAT, WORLD, CAMERA } from './config.js';
import { mulberry32, clamp, distance, angleDelta, intBetween, pick } from './random.js';

const SAVE_KEY = 'solara-save-v2';
const TOTAL_DEBT = 5000;

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.city = new City(20261117);
    this.wanted = new Wanted();
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas, hud);
    this.state = 'title';
    this.cash = PLAYER.startCash;
    this.missionsDone = new Set();
    this.mission = null;
    this.markedCar = null;
    this.waypoint = { x: null, y: null };
    this.toast = '';
    this.toastTimer = 0;
    this.saveTimer = 0;
    this.player = null;
    this.camera = { x: 2100, y: 1500 };
    this.cars = [];
    this.peds = [];
    this.policeCars = [];
    this.footCops = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.nearCar = null;
    this.nearPayphone = null;
    this.shotMode = null;
    this.loadSave();
    this.newGame();
  }

  // ------------------------------------------------------------ setup

  newGame() {
    const rng = mulberry32(20261117);
    const start = this.city.spots.start;
    this.player = {
      x: start.x, y: start.y, angle: 0, aim: 0,
      health: PLAYER.health, ammo: PLAYER.maxAmmo,
      car: null, fireTimer: 0,
    };
    this.camera = { x: start.x, y: start.y };
    this.cars = [];
    this.peds = [];
    this.policeCars = [];
    this.footCops = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.mission = null;
    this.markedCar = null;
    this.wanted.clear();
    this.setWaypoint(null, null, '');
    // Traffic and parked cars.
    for (let i = 0; i < 12; i++) {
      const p = this.city.randomRoadPoint(rng);
      const kind = pick(rng, ['sedan', 'sedan', 'taxi', 'truck', 'sport']);
      const car = makeCar(p.x, p.y, p.angle, kind, 'traffic');
      car.speed = CAR.trafficSpeed;
      this.cars.push(car);
    }
    for (let i = 0; i < 9; i++) {
      const spot = this.city.randomParkedSpot(rng);
      const kind = pick(rng, ['sedan', 'sedan', 'taxi', 'sport']);
      this.cars.push(makeCar(spot.x, spot.y, spot.angle, kind, 'parked'));
    }
    // Pedestrians on the sidewalks.
    for (let i = 0; i < 26; i++) {
      const p = this.city.randomRoadPoint(rng);
      this.peds.push(makePed(p.x + intBetween(rng, -70, 70), p.y + intBetween(rng, -70, 70), rng));
    }
    this.say('Port Solara. Six jobs to clear the debt.');
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.cash === 'number') this.cash = data.cash;
      if (Array.isArray(data.missionsDone)) this.missionsDone = new Set(data.missionsDone);
    } catch { /* no save, no problem */ }
  }

  hasSave() {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        missionsDone: [...this.missionsDone],
      }));
    } catch { /* storage unavailable: play on without saving */ }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.cash = PLAYER.startCash;
    this.missionsDone = new Set();
  }

  debt() {
    const earned = [...this.missionsDone].reduce((sum, id) => sum + JOB_LIST[id - 1].reward, 0);
    return Math.max(0, TOTAL_DEBT - earned);
  }

  // ------------------------------------------------------------ helpers

  say(text) {
    this.toast = text;
    this.toastTimer = 5;
  }

  setWaypoint(x, y, text) {
    this.waypoint = { x, y };
    if (text) this.say(text);
  }

  spawnEnemy(x, y) {
    const e = makeEnemy(x, y);
    this.enemies.push(e);
    return e;
  }

  spawnParkedCar(x, y, angle, kind, color, marked) {
    const car = makeCar(x, y, angle, kind, 'parked');
    if (color) car.color = color;
    if (marked) car.marked = true;
    this.cars.push(car);
    return car;
  }

  fireBullet(x, y, angle, from) {
    this.bullets.push(makeBullet(x, y, angle, from));
    if (from === 'player') this.audio.shot();
  }

  // Test/debug hook: move the player (used by the play-test script).
  teleport(x, y) {
    if (this.player.car) {
      this.player.car.x = x;
      this.player.car.y = y;
    }
    this.player.x = x;
    this.player.y = y;
    this.camera.x = x;
    this.camera.y = y;
  }

  startMission(id) {
    const job = JOB_LIST[id - 1];
    if (!job || this.missionsDone.has(id)) return false;
    startJob(this, job);
    return true;
  }

  nextJobId() {
    for (const job of JOB_LIST) if (!this.missionsDone.has(job.id)) return job.id;
    return null;
  }

  // ------------------------------------------------------------ update

  update(dt) {
    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this.state === 'title') {
      this.updateAmbient(dt);
      return;
    }
    if (this.state !== 'playing') return;
    this.updatePlaying(dt);
    this.input.endFrame();
  }

  // The title screen's living backdrop: traffic and pedestrians move.
  updateAmbient(dt) {
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.driver === 'traffic' && !updateTraffic(car, dt, this.city, null)) {
        const p = this.city.randomRoadPoint(Math.random);
        car.x = p.x; car.y = p.y; car.angle = p.angle;
      }
    }
    for (const ped of this.peds) updatePed(ped, dt, this.city, null);
    this.particles = updateParticles(this.particles, dt);
    this.camera.x += (this.player.x - this.camera.x) * Math.min(1, CAMERA.follow * dt);
    this.camera.y += (this.player.y - this.camera.y) * Math.min(1, CAMERA.follow * dt);
  }

  updatePlaying(dt) {
    const p = this.player;
    const input = this.input;

    // Pause, mute, restart.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.state = 'paused';
      return;
    }
    if (input.wasPressed('KeyM')) this.audio.setMuted(!this.audio.muted);
    if (input.wasPressed('KeyR') && !p.car) {
      // R on foot: restart the current job.
      if (this.mission) {
        failJob(this);
        this.startMission(this.nextJobId());
      }
    }

    // Aim follows the mouse.
    const rect = this.canvas.getBoundingClientRect();
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    p.aim = Math.atan2(input.mouseY - cy, input.mouseX - cx);
    void rect;

    // Interact: E enters/leaves cars and uses payphones.
    if (input.wasPressed('KeyE')) this.interact();

    // Move on foot or drive.
    if (p.car) {
      updatePlayerCar(p.car, dt, input, this.city);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      this.checkCarPedCollisions();
    } else {
      p.angle = p.aim;
      const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * speed * dt;
        dy = (dy / len) * speed * dt;
        const moved = this.city.moveCircle(p.x, p.y, dx, dy, PLAYER.radius);
        p.x = moved.x;
        p.y = moved.y;
      }
    }

    // Shoot.
    p.fireTimer -= dt;
    if (input.mouseDown && p.fireTimer <= 0 && p.ammo > 0 && this.state === 'playing') {
      p.fireTimer = COMBAT.fireInterval;
      p.ammo -= 1;
      const sx = p.car ? p.car.x + Math.cos(p.aim) * 40 : p.x + Math.cos(p.aim) * 22;
      const sy = p.car ? p.car.y + Math.sin(p.aim) * 40 : p.y + Math.sin(p.aim) * 22;
      this.fireBullet(sx, sy, p.aim, 'player');
      burst(this.particles, sx, sy, 3, ['#ffe9a8', '#ffb03a'], 120, 0.15, 3);
    }

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    updateEnemies(this, dt);
    this.updateBullets(dt);
    this.particles = updateParticles(this.particles, dt);

    // Missions.
    if (this.mission) {
      const result = updateJob(this, dt);
      if (result === 'done') {
        this.audio.jingle();
        finishJob(this);
      } else if (result === 'failed') {
        failJob(this);
      }
    }

    // Wanted heat.
    const committing = false;
    this.wanted.update(dt, committing);

    // Camera follows the player.
    this.camera.x += (p.x - this.camera.x) * Math.min(1, CAMERA.follow * dt);
    this.camera.y += (p.y - this.camera.y) * Math.min(1, CAMERA.follow * dt);

    // Audio.
    this.audio.unlock();
    this.audio.setEngine(p.car ? p.car.speed : 0, !!p.car);
    this.audio.setSiren(this.wanted.level, dt);
    this.audio.updateMusic(dt, true);

    // Nearby car / payphone for the hint line.
    this.nearCar = p.car ? null : this.nearestCar(p.x, p.y, 52);
    this.nearPayphone = null;
    for (const phone of this.city.payphones) {
      if (distance(p.x, p.y, phone.x, phone.y) < 60) this.nearPayphone = phone;
    }

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.save();
    }
  }

  interact() {
    const p = this.player;
    // At a payphone: drop a star for $200.
    if (!p.car && this.nearPayphone) {
      if (this.wanted.level === 0) {
        this.say('No heat to lose. The phone just rings.');
        return;
      }
      if (this.cash < WANTED.payphoneCost) {
        this.say(`A payphone costs $${WANTED.payphoneCost}. You have $${this.cash}.`);
        return;
      }
      this.cash -= WANTED.payphoneCost;
      this.wanted.dropStar();
      this.audio.pickup();
      this.say(`One star gone. ${this.wanted.level} left.`);
      return;
    }
    if (p.car) {
      // Leave the car.
      const car = p.car;
      car.driver = 'parked';
      p.car = null;
      const side = car.angle + Math.PI / 2;
      p.x = car.x + Math.cos(side) * 44;
      p.y = car.y + Math.sin(side) * 44;
      return;
    }
    const car = this.nearestCar(p.x, p.y, 52);
    if (!car) return;
    // Steal it. The marked Comet's heat comes from its mission stage.
    if (car !== this.markedCar) this.wanted.commit(WANTED.stealCar);
    car.driver = 'player';
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    this.audio.pickup();
  }

  nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.driver === 'player') continue;
      const d = distance(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  checkCarPedCollisions() {
    const p = this.player;
    if (!p.car || Math.abs(p.car.speed) < 200) return;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      if (distance(p.car.x, p.car.y, ped.x, ped.y) < 34) {
        ped.state = 'down';
        burst(this.particles, ped.x, ped.y, 10, ['#c0392b', '#e74c3c'], 160, 0.5, 4);
        this.wanted.commit(WANTED.hitAndRun);
        this.say('Hit and run! The SPPD saw that.');
      }
    }
  }

  updateTraffic(dt) {
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.driver !== 'traffic') continue;
      let ahead = null;
      for (const other of this.cars) {
        if (other === car || other.driver === 'parked') continue;
        if (distance(car.x, car.y, other.x, other.y) < 110) { ahead = other; break; }
      }
      if (!updateTraffic(car, dt, this.city, ahead)) {
        // Drove off the edge: respawn it elsewhere.
        const p = this.city.randomRoadPoint(Math.random);
        car.x = p.x; car.y = p.y; car.angle = p.angle;
        car.speed = CAR.trafficSpeed;
      }
    }
  }

  updatePeds(dt) {
    const danger = this.bullets.length > 0
      ? { x: this.bullets[this.bullets.length - 1].x, y: this.bullets[this.bullets.length - 1].y }
      : null;
    for (const ped of this.peds) updatePed(ped, dt, this.city, danger);
    // Keep the streets busy: replace peds that went down — but never spawn
    // one into an active shootout (its stage spot stays clear).
    if (this.peds.filter((ped) => ped.state !== 'down').length < 18) {
      const p = this.city.randomRoadPoint(Math.random);
      const killSpot = this.mission && this.mission.stage.type === 'kill'
        ? this.city.spots[this.mission.stage.spot]
        : null;
      if (!killSpot || distance(p.x, p.y, killSpot.x, killSpot.y) > 450) {
        this.peds.push(makePed(p.x, p.y, Math.random));
      }
    }
  }

  updatePolice(dt) {
    const p = this.player;
    const force = wantedForce(this.wanted.level, !!p.car);
    const rng = Math.random;
    // Spawn cruisers up to the wanted force.
    while (this.policeCars.length < force.cruisers) {
      const sp = spawnPoint(this.city, rng, p, 700);
      this.policeCars.push(makePoliceCruiser(sp.x, sp.y, sp.angle));
    }
    while (this.footCops.length < force.footCops) {
      const sp = spawnPoint(this.city, rng, p, 400);
      this.footCops.push(makeFootCop(sp.x, sp.y));
    }
    // No heat: the force stands down.
    if (this.wanted.level === 0) {
      this.policeCars = [];
      this.footCops = [];
      return;
    }
    // Cruisers chase and ram.
    for (const cruiser of this.policeCars) {
      const rammed = updateCruiser(cruiser, dt, p, this.city);
      if (rammed && cruiser.ramTimer <= 0) {
        cruiser.ramTimer = 0.8; // one ram per 0.8s: a hit, not a shredder
        if (p.car) {
          p.car.health -= 14;
          this.audio.thud();
          burst(this.particles, cruiser.x, cruiser.y, 6, ['#ffb03a', '#ff5a4a'], 140, 0.4, 4);
          if (p.car.health <= 0) this.explodeCar(p.car);
        } else {
          // A cruiser clipping Mara on foot: same cooldown, same hit.
          p.health -= 8;
          if (p.health <= 0) this.wasted();
        }
      }
    }
    // Foot cops chase on foot.
    for (const cop of this.footCops) {
      const result = updateFootCop(cop, dt, p, this.city);
      if (result === 'busted') {
        this.busted();
        return;
      }
    }
    // Drop units that fell too far behind.
    this.policeCars = this.policeCars.filter((c) => distance(c.x, c.y, p.x, p.y) < 1600);
    this.footCops = this.footCops.filter((c) => distance(c.x, c.y, p.x, p.y) < 1200);
  }

  explodeCar(car) {
    burst(this.particles, car.x, car.y, 40, ['#ff5a4a', '#ffb03a', '#3a3f4a'], 320, 0.9, 6);
    this.audio.thud();
    if (this.player.car === car) {
      this.player.car = null;
      this.player.health -= 25;
      this.player.x = car.x + 60;
      this.player.y = car.y;
      if (this.player.health <= 0) this.wasted();
    }
    this.cars = this.cars.filter((c) => c !== car);
    this.policeCars = this.policeCars.filter((c) => c !== car);
  }

  updateBullets(dt) {
    const p = this.player;
    this.bullets = updateBullets(this.bullets, dt, this.city);
    const kept = [];
    for (const b of this.bullets) {
      let hit = false;
      // Hit the player?
      if (b.from !== 'player' && !p.car) {
        if (distance(b.x, b.y, p.x, p.y) < 16) {
          p.health -= COMBAT.enemyDamage;
          burst(this.particles, p.x, p.y, 6, ['#c0392b'], 120, 0.4, 4);
          if (p.health <= 0) this.wasted();
          hit = true;
        }
      }
      // Hit the player's car?
      if (b.from !== 'player' && p.car) {
        if (distance(b.x, b.y, p.car.x, p.car.y) < 34) {
          p.car.health -= COMBAT.enemyDamage;
          if (p.car.health <= 0) this.explodeCar(p.car);
          hit = true;
        }
      }
      // Hit a pedestrian?
      if (!hit && b.from === 'player') {
        for (const ped of this.peds) {
          if (ped.state === 'down') continue;
          if (distance(b.x, b.y, ped.x, ped.y) < 12) {
            ped.state = 'down';
            burst(this.particles, ped.x, ped.y, 8, ['#c0392b'], 140, 0.5, 4);
            this.wanted.commit(WANTED.shootPed);
            hit = true;
            break;
          }
        }
      }
      // Hit an enemy?
      if (!hit && b.from === 'player') {
        for (const e of this.enemies) {
          if (e.health <= 0) continue;
          if (distance(b.x, b.y, e.x, e.y) < COMBAT.bulletRadius) {
            e.health -= COMBAT.bulletDamage;
            burst(this.particles, e.x, e.y, 6, ['#c0392b'], 120, 0.4, 4);
            if (e.health <= 0 && this.mission) this.mission.killed += 1;
            hit = true;
            break;
          }
        }
      }
      // Hit a cop on foot?
      if (!hit && b.from === 'player') {
        for (const cop of this.footCops) {
          if (distance(b.x, b.y, cop.x, cop.y) < 14) {
            this.wanted.commit(WANTED.shootCop);
            this.footCops = this.footCops.filter((c) => c !== cop);
            burst(this.particles, cop.x, cop.y, 8, ['#24344d', '#c0392b'], 140, 0.5, 4);
            hit = true;
            break;
          }
        }
      }
      // Hit a car?
      if (!hit) {
        for (const car of this.cars) {
          if (car.driver === 'player' && b.from === 'player') continue;
          if (distance(b.x, b.y, car.x, car.y) < 34) {
            car.health -= COMBAT.bulletDamage;
            burst(this.particles, b.x, b.y, 5, ['#ffb03a'], 120, 0.3, 3);
            if (car.health <= 0) this.explodeCar(car);
            hit = true;
            break;
          }
        }
      }
      if (!hit) kept.push(b);
    }
    this.bullets = kept;
  }

  busted() {
    this.state = 'busted';
    this.cash = Math.max(0, this.cash - 150);
    this.wanted.clear();
    this.policeCars = [];
    this.footCops = [];
    this.save();
  }

  wasted() {
    this.state = 'wasted';
    this.cash = Math.max(0, this.cash - 200);
    this.wanted.clear();
    this.policeCars = [];
    this.footCops = [];
    this.save();
  }

  // Back on the street after busted / wasted.
  respawn() {
    const start = this.city.spots.start;
    this.player.health = PLAYER.health;
    this.player.ammo = PLAYER.maxAmmo;
    if (this.player.car) {
      this.player.car.driver = 'parked';
      this.player.car = null;
    }
    this.player.x = start.x;
    this.player.y = start.y;
    this.camera.x = start.x;
    this.camera.y = start.y;
    this.enemies = [];
    this.state = 'playing';
    this.say('Back on the street. Stay sharp, Mara.');
  }

  // ------------------------------------------------------------ screenshots

  // Stage a deterministic scene for ?shot=chase|foot|mission|title.
  stageShot(name) {
    this.shotMode = name;
    this.newGame();
    const rng = mulberry32(7);
    if (name === 'title') {
      this.state = 'title';
      return;
    }
    this.state = 'playing';
    if (name === 'chase') {
      // Four-star chase downtown: Mara in a sports car, cruisers behind.
      // The escape job sets 3 stars; one more makes the 4-star frame.
      const spot = this.city.spots.start;
      const car = makeCar(spot.x, spot.y, 0, 'sport', 'player');
      car.color = '#d21f3c';
      this.cars.push(car);
      this.player.car = car;
      this.player.x = car.x;
      this.player.y = car.y;
      this.startMission(5);
      this.wanted.commit(1);
      for (let i = 0; i < 3; i++) {
        const c = makePoliceCruiser(spot.x - 120 - i * 90, spot.y + (i % 2 === 0 ? 40 : -40), 0);
        this.policeCars.push(c);
      }
      // A short drive east down the downtown avenue: far enough to show
      // speed, short enough to stay in the city.
      this.driveForward(90, 0);
      this.player.health = 100;
      if (this.player.car) this.player.car.health = 100;
    } else if (name === 'foot') {
      // Mara on foot downtown, traffic and pedestrians around her.
      this.player.x = 2100;
      this.player.y = 1500;
      this.player.aim = -0.4;
      this.startMission(2);
      this.stepWorld(90);
      this.player.health = 100;
    } else if (name === 'mission') {
      // The Block Party shootout in Solana Park.
      this.player.x = 2100;
      this.player.y = 1650;
      this.player.aim = 0.6;
      this.startMission(4);
      this.stepWorld(25);
      // A few shots in the air for the frame.
      this.fireBullet(this.player.x + 20, this.player.y, 0.5, 'player');
      this.fireBullet(this.player.x + 20, this.player.y, 0.9, 'player');
      this.stepWorld(8);
      // The staged frame shows the shootout, not its casualty.
      this.player.health = 100;
    }
    void rng;
  }

  // Drive the player's car forward for `steps` frames, steering gently.
  driveForward(steps, steerAngle) {
    const input = this.input;
    for (let i = 0; i < steps; i++) {
      input.up = true;
      input.left = false;
      input.right = false;
      if (this.player.car) {
        const want = steerAngle;
        const d = angleDelta(this.player.car.angle, want);
        if (d > 0.08) input.right = true;
        else if (d < -0.08) input.left = true;
      }
      this.updatePlaying(1 / 30);
    }
    input.up = false;
    input.left = false;
    input.right = false;
  }

  // Step the world forward with no input (traffic and peds move).
  stepWorld(steps) {
    for (let i = 0; i < steps; i++) this.updatePlaying(1 / 30);
  }
}
