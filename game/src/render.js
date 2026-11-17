// Drawing: the world, the HUD and the minimap. One clear job: turn the
// game state into pixels every frame. The simulation never draws; this file
// never simulates.

import { WORLD, ROAD_WIDTH, PALETTE, MINIMAP } from './config.js';
import { clamp } from './random.js';

export class Renderer {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hud; // DOM elements, by id
    this.minimap = hud.minimap.getContext('2d');
    this.lastObjective = null;
    this.lastDistrict = null;
  }

  draw(game) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const cam = game.camera;
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 - cam.x, height / 2 - cam.y);

    const view = {
      x0: cam.x - width / 2 - 80,
      y0: cam.y - height / 2 - 80,
      x1: cam.x + width / 2 + 80,
      y1: cam.y + height / 2 + 80,
    };
    this.drawGround(ctx, view, game.city);
    this.drawRoads(ctx, view, game.city);
    this.drawParks(ctx, view, game.city);
    this.drawBuildings(ctx, view, game.city);
    this.drawPayphones(ctx, view, game);
    this.drawWaypoint(ctx, game);
    this.drawCars(ctx, view, game);
    this.drawPeds(ctx, view, game);
    this.drawEnemies(ctx, view, game);
    this.drawPlayer(ctx, game);
    this.drawBullets(ctx, game);
    this.drawParticles(ctx, game);
    ctx.restore();

    this.drawMinimap(game);
    this.updateHud(game);
    this.updateOverlays(game);
  }

  // Sand on the west edge, grass everywhere else, sea beyond the sand.
  drawGround(ctx, view, city) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(view.x0, view.y0, 300 - view.x0, view.y1 - view.y0);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(view.x0, view.y0, 120 - view.x0, view.y1 - view.y0);
    // The shoreline.
    ctx.fillStyle = '#f5e6b8';
    ctx.fillRect(112, view.y0, 8, view.y1 - view.y0);
    void city;
  }

  drawRoads(ctx, view, city) {
    const half = ROAD_WIDTH / 2;
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of city.verticalRoads) {
      if (rx + half < view.x0 || rx - half > view.x1) continue;
      ctx.fillRect(rx - half, view.y0, ROAD_WIDTH, view.y1 - view.y0);
    }
    for (const ry of city.horizontalRoads) {
      if (ry + half < view.y0 || ry - half > view.y1) continue;
      ctx.fillRect(view.x0, ry - half, view.x1 - view.x0, ROAD_WIDTH);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of city.verticalRoads) {
      if (rx < view.x0 || rx > view.x1) continue;
      for (let y = Math.floor(view.y0 / 48) * 48; y < view.y1; y += 48) {
        ctx.fillRect(rx - 2, y, 4, 24);
      }
    }
    for (const ry of city.horizontalRoads) {
      if (ry < view.y0 || ry > view.y1) continue;
      for (let x = Math.floor(view.x0 / 48) * 48; x < view.x1; x += 48) {
        ctx.fillRect(x, ry - 2, 24, 4);
      }
    }
  }

  drawParks(ctx, view, city) {
    for (const park of city.parks) {
      if (park.x + park.w < view.x0 || park.x > view.x1 || park.y + park.h < view.y0 || park.y > view.y1) continue;
      if (park.dock) {
        // The port: concrete yard with shipping containers.
        ctx.fillStyle = '#8d929c';
        ctx.fillRect(park.x, park.y, park.w, park.h);
        const colors = ['#c65f4e', '#4e7fb8', '#d8b13c', '#5e8a5a'];
        for (let i = 0; i < 10; i++) {
          const cx = park.x + 30 + (i % 5) * 90;
          const cy = park.y + 30 + Math.floor(i / 5) * 130;
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(cx, cy, 70, 34);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          for (let s = 0; s < 4; s++) ctx.fillRect(cx + 6, cy + 6 + s * 8, 58, 2);
        }
        continue;
      }
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.strokeStyle = '#4e7d3a';
      ctx.lineWidth = 3;
      ctx.strokeRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of city.trees) {
      if (tree.x < view.x0 || tree.x > view.x1 || tree.y < view.y0 || tree.y > view.y1) continue;
      ctx.fillStyle = '#2f6b2f';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4e9a3d';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBuildings(ctx, view, city) {
    for (const b of city.buildings) {
      if (b.x + b.w < view.x0 || b.x > view.x1 || b.y + b.h < view.y0 || b.y > view.y1) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Roof edge and windows.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.fillStyle = PALETTE.glass;
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(b.x + 14 + i * 46, b.y + 18 + j * 46, 22, 16);
        }
      }
      if (b.tower) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
      }
    }
  }

  drawPayphones(ctx, view, game) {
    for (const phone of game.city.payphones) {
      if (phone.x < view.x0 || phone.x > view.x1 || phone.y < view.y0 || phone.y > view.y1) continue;
      ctx.fillStyle = '#1d6fb8';
      ctx.fillRect(phone.x - 8, phone.y - 12, 16, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', phone.x, phone.y + 4);
    }
  }

  // The mission waypoint: a pulsing diamond on the map and an arrow at the
  // screen edge when it is off screen.
  drawWaypoint(ctx, game) {
    const wp = game.waypoint;
    if (!wp || wp.x === null) return;
    const t = performance.now() / 300;
    const pulse = 10 + Math.sin(t) * 4;
    ctx.save();
    ctx.translate(wp.x, wp.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.mission;
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 34 + Math.sin(t) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawCars(ctx, view, game) {
    for (const car of game.cars) {
      if (car.x < view.x0 || car.x > view.x1 || car.y < view.y0 || car.y > view.y1) continue;
      this.drawCar(ctx, car, car === game.player.car);
    }
  }

  drawCar(ctx, car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = car.kind === 'truck' ? 84 : CAR_LEN;
    const wid = CAR_WID;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(len * 0.12, -wid / 2 + 4, len * 0.2, wid - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-len * 0.28, -wid / 2 + 4, len * 0.3, wid - 8);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
    ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
    if (car.driver === 'police') {
      const blink = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2d2d' : '#2f7fe8';
      ctx.fillRect(-6, -wid / 2 - 2, 12, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPPD', 0, 3);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, len / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (car.smoke > 0.2) {
      ctx.fillStyle = `rgba(60,60,60,${0.25 + car.smoke * 0.4})`;
      ctx.beginPath();
      ctx.arc(-len / 2 - 6, 0, 6 + car.smoke * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPeds(ctx, view, game) {
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (ped.x < view.x0 || ped.x > view.x1 || ped.y < view.y0 || ped.y > view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 8, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemies(ctx, view, game) {
    for (const e of game.enemies) {
      if (e.health <= 0) continue;
      if (e.x < view.x0 || e.x > view.x1 || e.y < view.y0 || e.y > view.y1) continue;
      ctx.fillStyle = '#3a2a2a';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff2d2d';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(e.x - 14, e.y - 22, 28 * Math.max(0, e.health / 60), 4);
    }
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    if (p.car) return; // drawn with the cars
    if (p.health <= 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: red jacket, the getaway driver's mark.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerOutline;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Aim direction.
    ctx.rotate(p.aim);
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 14, 4);
    ctx.restore();
    // Name tag.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MARA', p.x, p.y - 20);
  }

  drawBullets(ctx, game) {
    ctx.fillStyle = '#ffe9a8';
    for (const b of game.bullets) {
      ctx.fillRect(b.x - 3, b.y - 1, 6, 2);
    }
  }

  drawParticles(ctx, game) {
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The minimap: the whole city, the player, police, enemies and waypoint.
  drawMinimap(game) {
    const mm = this.minimap;
    const size = MINIMAP.size;
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    mm.fillStyle = 'rgba(16,19,26,0.85)';
    mm.fillRect(0, 0, size, size);
    mm.fillStyle = '#2e7f9e';
    mm.fillRect(0, 0, 120 * sx, size);
    mm.fillStyle = '#7fae62';
    mm.fillRect(120 * sx, 0, size - 120 * sx, size);
    mm.strokeStyle = '#3a3f4a';
    mm.lineWidth = 1;
    for (const rx of game.city.verticalRoads) {
      mm.beginPath();
      mm.moveTo(rx * sx, 0);
      mm.lineTo(rx * sx, size);
      mm.stroke();
    }
    for (const ry of game.city.horizontalRoads) {
      mm.beginPath();
      mm.moveTo(0, ry * sy);
      mm.lineTo(size, ry * sy);
      mm.stroke();
    }
    if (game.waypoint && game.waypoint.x !== null) {
      mm.fillStyle = PALETTE.mission;
      mm.beginPath();
      mm.arc(game.waypoint.x * sx, game.waypoint.y * sy, 4, 0, Math.PI * 2);
      mm.fill();
    }
    for (const cop of game.policeCars) {
      mm.fillStyle = '#2f7fe8';
      mm.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
    }
    for (const e of game.enemies) {
      if (e.health <= 0) continue;
      mm.fillStyle = '#ff2d2d';
      mm.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4);
    }
    const p = game.player;
    const px = (p.car ? p.car.x : p.x) * sx;
    const py = (p.car ? p.car.y : p.y) * sy;
    mm.fillStyle = '#fff';
    mm.beginPath();
    mm.arc(px, py, 4, 0, Math.PI * 2);
    mm.fill();
    mm.fillStyle = PALETTE.player;
    mm.beginPath();
    mm.arc(px, py, 2.5, 0, Math.PI * 2);
    mm.fill();
    // Camera viewport.
    mm.strokeStyle = 'rgba(255,255,255,0.6)';
    mm.strokeRect(
      (game.camera.x - this.canvas.width / 2) * sx,
      (game.camera.y - this.canvas.height / 2) * sy,
      this.canvas.width * sx,
      this.canvas.height * sy,
    );
  }

  // The DOM HUD: stars, cash, health, ammo, speed, district, objective.
  updateHud(game) {
    const h = this.hud;
    const p = game.player;
    const stars = '★'.repeat(game.wanted.level) + '☆'.repeat(5 - game.wanted.level);
    h.stars.textContent = stars;
    h.stars.style.color = game.wanted.level > 0 ? '#ff5a4a' : '#8a8f98';
    h.cash.textContent = `$${game.cash.toLocaleString('en-US')}`;
    h.healthFill.style.width = `${Math.max(0, p.health)}%`;
    h.healthFill.style.background = p.health > 50 ? '#58b368' : p.health > 25 ? '#ffb03a' : '#ff5a4a';
    h.ammo.textContent = `Ammo ${p.ammo}`;
    const speed = p.car ? Math.round(Math.abs(p.car.speed) * 0.12) : 0;
    h.speed.textContent = p.car ? `${speed} mph` : 'On foot';
    const district = game.city.district(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y);
    if (district !== this.lastDistrict) {
      this.lastDistrict = district;
      h.district.textContent = district;
    }
    const objective = game.mission ? game.mission.stage.text : 'No active job — open the map and take a job from Dario';
    if (objective !== this.lastObjective) {
      this.lastObjective = objective;
      h.objective.textContent = objective;
    }
    if (game.mission && game.mission.stage.timer) {
      h.timer.textContent = `⏱ ${Math.max(0, Math.ceil(game.mission.stageTimer))}s`;
      h.timer.style.display = '';
    } else {
      h.timer.style.display = 'none';
    }
    if (game.toastTimer > 0) {
      h.toast.textContent = game.toast;
      h.toast.style.opacity = '1';
    } else {
      h.toast.style.opacity = '0';
    }
    const nearPhone = game.nearPayphone && game.wanted.level > 0;
    h.hint.textContent = nearPhone
      ? 'Press E — pay $200 at the payphone to drop a wanted star'
      : p.car
        ? 'E — leave the car · Click — shoot · Space — handbrake'
        : (game.nearCar ? 'E — steal the car' : 'WASD — move · Shift — run · Click — shoot');
  }

  // Show exactly one overlay for the current state.
  updateOverlays(game) {
    const h = this.hud;
    const show = (el, on) => { el.style.display = on ? 'flex' : 'none'; };
    show(h.titleScreen, game.state === 'title');
    show(h.pauseScreen, game.state === 'paused');
    show(h.bustedScreen, game.state === 'busted');
    show(h.wastedScreen, game.state === 'wasted');
    show(h.completeScreen, game.state === 'complete');
    h.hudBox.style.display = game.state === 'playing' ? 'block' : 'none';
    if (game.state === 'title') {
      h.saveInfo.textContent = game.hasSave()
        ? `Continue — ${game.missionsDone.size} of 6 jobs done, $${game.cash.toLocaleString('en-US')}`
        : 'New game — Mara owes Dario Venn $5,000. Six jobs to clear it.';
      h.jobList.textContent = JOB_NAMES.map((name, i) => `${game.missionsDone.has(i + 1) ? '✓' : '·'} ${i + 1}. ${name}`).join('  ');
    }
  }
}

const CAR_LEN = 64;
const CAR_WID = 30;
const JOB_NAMES = ['First Fare', 'The Pickup', 'Hot Wheels', 'Block Party', 'The Long Way Home', 'The Solara Job'];
