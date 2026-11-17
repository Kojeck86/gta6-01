// Tuning and palette for SOLARA. One clear job: every magic number lives
// here, so balancing the game means editing this file, not hunting through
// the simulation.

// World size in pixels. The road grid is 8 columns by 6 rows of blocks.
export const WORLD = { width: 4800, height: 3600 };
export const ROAD_WIDTH = 96;
export const BLOCK = 600; // distance between road centre lines
export const ROAD_START = 300; // first road centre line, x and y

// Player on foot.
export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  maxAmmo: 160,
  startCash: 150,
};

// Cars: arcade handling. Speeds are px/s; accel is px/s^2.
export const CAR = {
  length: 64,
  width: 30,
  maxSpeed: 560,
  reverseSpeed: 160,
  accel: 420,
  brake: 700,
  steer: 2.6,
  grip: 6.5,
  trafficSpeed: 150,
  policeSpeed: 620,
  maxHealth: 100,
};

// Wanted system.
export const WANTED = {
  maxLevel: 5,
  stealCar: 1, // stars added for stealing a car
  shootPed: 1,
  shootCop: 2,
  hitAndRun: 1,
  coolOffSeconds: 22, // quiet seconds before heat starts falling
  decayPerSecond: 0.12, // heat (0..1) lost per quiet second
  payphoneCost: 200, // cash to drop one star at a payphone
  bustSeconds: 1.5, // cop contact time on foot before arrest
};

// Police.
export const POLICE = {
  cruiserPerLevel: 1, // cruisers kept on the player per wanted star
  footCopPerLevel: 1, // foot cops per star (only when the player is on foot)
  spawnDistance: 700, // spawn this far from the player, on a road
  ramDamage: 14,
  arrestRadius: 30,
};

// Combat.
export const COMBAT = {
  bulletSpeed: 900,
  bulletDamage: 34,
  bulletRadius: 18, // hit radius against enemies: a near-miss still counts
  enemyDamage: 16, // a Kestrel's bullet: the shootout is winnable on the move
  bulletRange: 520,
  fireInterval: 0.22, // seconds between pistol shots
  enemyHealth: 60,
  enemyFireInterval: 1.3,
  enemyAccuracy: 0.45,
};

// Missions.
export const MISSIONS = {
  reward: [300, 500, 800, 900, 1200, 2500],
  deliverySeconds: 75,
  escapeSeconds: 60,
};

// Camera and rendering.
export const CAMERA = { follow: 6.0, zoom: 1.0 };
export const MINIMAP = { size: 176 };

// Palette: a sun-soaked coastal city at golden hour.
export const PALETTE = {
  sea: '#2e7f9e',
  sand: '#e8d39a',
  grass: '#7fae62',
  park: '#69a24f',
  asphalt: '#3a3f4a',
  asphaltEdge: '#2c3038',
  roadLine: '#e8d24a',
  sidewalk: '#9aa0a8',
  buildingRoof: '#8a6f5c',
  buildingEdge: '#5d4a3e',
  glass: '#7fc4d8',
  player: '#e8452c',
  playerOutline: '#7a1d0e',
  police: '#24344d',
  policeLight: '#e8452c',
  policeLightB: '#2f7fe8',
  taxi: '#f2c200',
  hud: '#10131a',
  hudText: '#f5f1e6',
  accent: '#ffb03a',
  mission: '#ff5fa2',
};
