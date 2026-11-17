// SOLARA — entry point. One clear job: size the canvas, wire the buttons,
// run the game loop, and stage demo scenes for screenshots (?shot=).

import { Game } from './game.js';

const canvas = document.getElementById('game');
const hud = {
  hudBox: document.getElementById('hud'),
  stars: document.getElementById('stars'),
  cash: document.getElementById('cash'),
  healthFill: document.getElementById('health-fill'),
  ammo: document.getElementById('ammo'),
  speed: document.getElementById('speed'),
  district: document.getElementById('district'),
  objective: document.getElementById('objective'),
  timer: document.getElementById('timer'),
  toast: document.getElementById('toast'),
  hint: document.getElementById('hint'),
  minimap: document.getElementById('minimap'),
  titleScreen: document.getElementById('title-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  bustedScreen: document.getElementById('busted-screen'),
  wastedScreen: document.getElementById('wasted-screen'),
  completeScreen: document.getElementById('complete-screen'),
  saveInfo: document.getElementById('save-info'),
  jobList: document.getElementById('job-list'),
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Looking away pauses the game instead of letting the SPPD catch Mara
// while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') {
    game.state = 'paused';
  }
});

const game = new Game(canvas, hud);

// Buttons on the overlays.
function startNextJobIfIdle() {
  if (!game.mission) {
    const next = game.nextJobId();
    if (next) game.startMission(next);
  }
}
document.getElementById('continue-btn').addEventListener('click', () => {
  game.audio.unlock();
  game.state = 'playing';
  startNextJobIfIdle();
});
document.getElementById('newgame-btn').addEventListener('click', () => {
  game.audio.unlock();
  game.clearSave();
  game.newGame();
  game.state = 'playing';
  startNextJobIfIdle();
});
document.getElementById('resume-btn').addEventListener('click', () => {
  game.state = 'playing';
});
document.getElementById('restart-job-btn').addEventListener('click', () => {
  const next = game.nextJobId();
  if (next) game.startMission(next);
  game.state = 'playing';
});
document.getElementById('quit-title-btn').addEventListener('click', () => {
  game.state = 'title';
});
document.getElementById('busted-btn').addEventListener('click', () => {
  game.respawn();
});
document.getElementById('wasted-btn').addEventListener('click', () => {
  game.respawn();
});
document.getElementById('freeroam-btn').addEventListener('click', () => {
  game.state = 'playing';
});
document.getElementById('job-btn').addEventListener('click', () => {
  const next = game.nextJobId();
  if (next) {
    game.startMission(next);
  } else {
    game.say('All six jobs are done. Port Solara is yours.');
  }
});

// Screenshot staging: ?shot=chase|foot|mission|title&seed=1
// (shots.json uses these so the cover shows the open world at its best.)
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.stageShot(shot);
}

// Debug hook for automated play-testing (read-only state, no cheats in play).
window.__solara = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  try {
    game.update(dt);
    game.renderer.draw(game);
  } catch (error) {
    // Never leave a black screen without a trace: report once, keep looping.
    if (!window.__solaraError) {
      window.__solaraError = String(error && error.message ? error.message : error);
      console.error('[solara]', error);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
