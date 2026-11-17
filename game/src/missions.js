// The story: six jobs for fixer Dario Venn. Mara Reyes, getaway driver,
// owes him a debt and works it off one job at a time. One clear job: define
// each job's stages, drive the stage machine, and spawn the enemies a job
// needs. The game owns the state; this file owns the script.

import { MISSIONS, COMBAT, PLAYER } from './config.js';
import { distance } from './random.js';

const DARIO = 'Dario Venn';
const MARA = 'Mara Reyes';

// The six jobs. Each stage is one objective: reach a point, hold it, kill
// a set of enemies, or survive a timer. `wanted` sets the heat when the
// stage starts; `say` is the line shown when it starts.
export const JOB_LIST = [
  {
    id: 1, name: 'First Fare', reward: MISSIONS.reward[0],
    intro: [`${DARIO}: "Mara. A client waits on the Marina promenade. Fetch them, then bring them to my hideout. No cops, no fuss."`],
    stages: [
      { type: 'reach', text: 'Pick up the client at Marina Beach', spot: 'marina', radius: 70 },
      { type: 'reach', text: 'Drive the client to the hideout', spot: 'hideout', radius: 70 },
    ],
  },
  {
    id: 2, name: 'The Pickup', reward: MISSIONS.reward[1],
    intro: [`${DARIO}: "A package waits under the Solana Park bandstand. Walk in quiet, grab it, drive it to Old Town. The Kestrels are watching."`],
    stages: [
      { type: 'reach', text: 'Collect the package in Solana Park (on foot)', spot: 'park', radius: 60, onFoot: true },
      { type: 'reach', text: 'Deliver the package to Old Town', spot: 'oldtown', radius: 70 },
    ],
  },
  {
    id: 3, name: 'Hot Wheels', reward: MISSIONS.reward[2],
    intro: [`${DARIO}: "A cherry-red Comet sits outside the Northside garage. It is not theirs anymore. Bring it to me — fast. The clock starts when you touch it."`],
    stages: [
      { type: 'steal', text: 'Steal the red Comet at the Northside garage', spot: 'northside', radius: 60 },
      { type: 'reach', text: 'Deliver the Comet to the hideout before time runs out', spot: 'hideout', radius: 70, timer: MISSIONS.deliverySeconds },
    ],
  },
  {
    id: 4, name: 'Block Party', reward: MISSIONS.reward[3],
    intro: [`${DARIO}: "The Kestrels crashed the park party. Four of them, armed. Clear them out, Mara. The park is yours after."`],
    stages: [
      { type: 'kill', text: 'Clear out the Kestrels in Solana Park', spot: 'park', radius: 320, enemies: 4 },
    ],
  },
  {
    id: 5, name: 'The Long Way Home', reward: MISSIONS.reward[4],
    intro: [`${DARIO}: "SPPD has your plate, Mara. Three stars and climbing. Lose them — lay low, or pay a payphone — then get home."`],
    stages: [
      { type: 'escape', text: 'Lose the heat: get your wanted level to zero', wanted: 3, timer: MISSIONS.escapeSeconds + 60 },
    ],
  },
  {
    id: 6, name: 'The Solara Job', reward: MISSIONS.reward[5],
    intro: [`${DARIO}: "The big one. Harbor Bank, ten seconds at the vault door, then run. Four stars, Mara. Make them count."`],
    stages: [
      { type: 'hold', text: 'Hold the vault door at Harbor Bank (10s)', spot: 'port', radius: 80, holdSeconds: 10, wanted: 4 },
      { type: 'reach', text: 'Escape to the hideout with the money', spot: 'hideout', radius: 70 },
    ],
  },
];

// Start a job: set the first stage, show the intro, arm its pieces.
export function startJob(game, job) {
  game.mission = {
    job,
    stageIndex: 0,
    stage: null,
    stageTimer: 0,
    holdTimer: 0,
    killed: 0,
    needed: 0,
  };
  // A job starts with a full magazine: a shootout must be winnable.
  game.player.ammo = PLAYER.maxAmmo;
  game.say(job.intro[0]);
  armStage(game);
  return game.mission;
}

// Arm the current stage: waypoint, timer, enemies, wanted.
function armStage(game) {
  const m = game.mission;
  const stage = m.job.stages[m.stageIndex];
  m.stage = stage;
  m.stageTimer = stage.timer ?? 0;
  m.holdTimer = 0;
  m.killed = 0;
  if (stage.spot) {
    const spot = game.city.spots[stage.spot];
    game.setWaypoint(spot.x, spot.y, stage.text);
  } else {
    game.setWaypoint(null, null, stage.text);
  }
  if (stage.wanted) game.wanted.commit(stage.wanted);
  if (stage.type === 'kill') {
    m.needed = stage.enemies;
    // Civilians flee a shootout: clear the park so a stray bullet cannot
    // start a wanted spiral in the middle of the job.
    const spot = game.city.spots[stage.spot];
    game.peds = game.peds.filter((ped) => distance(ped.x, ped.y, spot.x, spot.y) > stage.radius + 120);
    spawnEnemies(game, stage);
  }
  if (stage.type === 'steal') {
    spawnMarkedCar(game, stage);
  }
  game.say(stage.text);
}

// Spawn the job's enemies around the stage spot, on open ground — never
// inside a building, where they would be unshootable and stuck.
function spawnEnemies(game, stage) {
  const spot = game.city.spots[stage.spot];
  for (let i = 0; i < stage.enemies; i++) {
    const angle = (i / stage.enemies) * Math.PI * 2;
    const p = game.city.findOpen(spot.x + Math.cos(angle) * 180, spot.y + Math.sin(angle) * 180, 16);
    game.spawnEnemy(p.x, p.y);
  }
}

// Spawn the red Comet the player must steal, parked at the stage spot.
function spawnMarkedCar(game, stage) {
  const spot = game.city.spots[stage.spot];
  game.markedCar = game.spawnParkedCar(spot.x + 40, spot.y, 0, 'sport', '#d21f3c', true);
}

// Drive the stage machine. Returns 'done' when the job finishes, 'failed'
// when its timer runs out, else null.
export function updateJob(game, dt) {
  const m = game.mission;
  if (!m) return null;
  const stage = m.stage;
  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;

  if (stage.timer) {
    m.stageTimer -= dt;
    if (m.stageTimer <= 0) {
      game.say('Too slow. The job is blown.');
      return 'failed';
    }
  }

  if (stage.type === 'reach') {
    const spot = game.city.spots[stage.spot];
    if (stage.onFoot && game.player.car) {
      // Must be on foot for this pickup: remind, do not complete.
    } else if (distance(px, py, spot.x, spot.y) < stage.radius) {
      return advance(game);
    }
  } else if (stage.type === 'steal') {
    if (game.player.car === game.markedCar) {
      game.wanted.commit(1);
      game.say('The Comet is yours. Go — the clock is ticking.');
      return advance(game);
    }
  } else if (stage.type === 'kill') {
    if (m.killed >= m.needed) return advance(game);
  } else if (stage.type === 'hold') {
    const spot = game.city.spots[stage.spot];
    if (distance(px, py, spot.x, spot.y) < stage.radius) {
      m.holdTimer += dt;
      if (m.holdTimer >= stage.holdSeconds) return advance(game);
    } else {
      m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
    }
  } else if (stage.type === 'escape') {
    if (game.wanted.level === 0) return advance(game);
  }
  return null;
}

// Move to the next stage, or finish the job.
function advance(game) {
  const m = game.mission;
  m.stageIndex += 1;
  if (m.stageIndex >= m.job.stages.length) {
    return 'done';
  }
  armStage(game);
  return null;
}

// Finish a job: pay the reward, save, clear the heat, open the next job.
export function finishJob(game) {
  const m = game.mission;
  const job = m.job;
  game.cash += job.reward;
  game.missionsDone.add(job.id);
  game.wanted.clear();
  game.mission = null;
  game.markedCar = null;
  game.setWaypoint(null, null, '');
  game.say(`${job.name} done — $${job.reward} in the pocket. Debt: $${game.debt()}.`);
  game.save();
  if (game.missionsDone.size >= JOB_LIST.length) {
    game.state = 'complete';
    game.say('Debt cleared. Port Solara is yours, Mara.');
  }
}

// Fail a job: heat stays, the job can be retried from the pause menu.
export function failJob(game) {
  game.mission = null;
  game.markedCar = null;
  game.setWaypoint(null, null, '');
}

// One enemy: a Kestrel with a pistol.
export function makeEnemy(x, y) {
  return { x, y, angle: 0, health: COMBAT.enemyHealth, fireTimer: 1 + Math.random(), state: 'hunt' };
}

// Line of sight between two points: true when no building blocks the shot.
function hasLos(city, x1, y1, x2, y2) {
  const d = distance(x1, y1, x2, y2);
  const steps = Math.ceil(d / 16);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (city.hitsSolid(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2)) return false;
  }
  return true;
}

// One step along the road grid toward (tx, ty): at an intersection take the
// axis with the larger gap, on a road follow it, off-road head for the
// nearest road. The grid is connected, so this always arrives.
function roadStep(game, e, tx, ty, dt) {
  const speed = 190;
  const onV = game.city.verticalRoads.some((rx) => Math.abs(e.x - rx) < 40);
  const onH = game.city.horizontalRoads.some((ry) => Math.abs(e.y - ry) < 40);
  if (!onV && !onH) {
    // Off-road: head for the nearest road. If a building blocks the direct
    // line, try the compass directions one by one — a courtyard always has
    // a gap, and walking the wall finds it.
    const rp = game.city.nearestRoadPoint(e.x, e.y);
    const a = Math.atan2(rp.y - e.y, rp.x - e.x);
    let moved = game.city.moveCircle(e.x, e.y, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, 12);
    if (moved.x === e.x && moved.y === e.y) {
      for (let k = 0; k < 8 && moved.x === e.x && moved.y === e.y; k++) {
        const da = (k / 8) * Math.PI * 2;
        moved = game.city.moveCircle(e.x, e.y, Math.cos(da) * speed * dt, Math.sin(da) * speed * dt, 12);
      }
    }
    if (moved.x !== e.x || moved.y !== e.y) e.angle = Math.atan2(moved.y - e.y, moved.x - e.x);
    e.x = moved.x;
    e.y = moved.y;
    return;
  }
  // On the road grid: at an intersection take the axis with the larger gap,
  // on a single road follow it. The grid is connected, so this arrives.
  let mx = 0;
  let my = 0;
  if (onV && onH) {
    if (Math.abs(tx - e.x) > Math.abs(ty - e.y)) mx = Math.sign(tx - e.x);
    else my = Math.sign(ty - e.y);
  } else if (onV) {
    my = Math.sign(ty - e.y);
  } else {
    mx = Math.sign(tx - e.x);
  }
  const moved = game.city.moveCircle(e.x, e.y, mx * speed * dt, my * speed * dt, 12);
  if (moved.x !== e.x || moved.y !== e.y) e.angle = Math.atan2(moved.y - e.y, moved.x - e.x);
  e.x = moved.x;
  e.y = moved.y;
}

// Enemies hunt the player and shoot when they have line of sight.
export function updateEnemies(game, dt) {
  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;
  for (const e of game.enemies) {
    if (e.health <= 0) continue;
    const d = distance(e.x, e.y, px, py);
    e.angle = Math.atan2(py - e.y, px - e.x);
    if (hasLos(game.city, e.x, e.y, px, py)) {
      // Eyes on the target: close in and shoot.
      e.blindTimer = 0;
      // Hold a firing position and shoot from it: standing still is what
      // makes the enemy hittable, and it is what the player can punish.
      if (d > 320) {
        const speed = 170;
        const moved = game.city.moveCircle(e.x, e.y, Math.cos(e.angle) * speed * dt, Math.sin(e.angle) * speed * dt, 12);
        e.x = moved.x;
        e.y = moved.y;
      }
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && d < 460) {
        e.fireTimer = COMBAT.enemyFireInterval * (0.8 + Math.random() * 0.5);
        const spread = (Math.random() - 0.5) * (1 - COMBAT.enemyAccuracy) * 1.6;
        game.fireBullet(e.x, e.y, e.angle + spread, 'enemy');
      }
    } else {
      // No line of sight: the wall wins the staring contest. Reposition
      // along the roads toward the player's road instead of shooting bricks.
      e.blindTimer = (e.blindTimer || 0) + dt;
      e.fireTimer = Math.max(e.fireTimer, 0.3);
      if (e.blindTimer > 1.2) {
        const rp = game.city.nearestRoadPoint(px, py);
        roadStep(game, e, rp.x, rp.y, dt);
      }
    }
  }
  game.enemies = game.enemies.filter((e) => e.health > 0);
}
