// Entry program for the SOLARA game in make.fun's GTA 6 bounty.
//
// This program stages the entry for the scorer: it mirrors the playable
// game directory and the screenshots directory into the grading output
// directory, then asks the vendored dossier library to summarise that
// staged copy as dossier.json. The grader reads dossier.json; the game
// itself is never executed by the scorer.
//
// The output directory comes from MAKEFUN_OUTPUT_DIR when that variable
// is set, and falls back to /output otherwise. Node 22, standard library
// only, nothing to install.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import {
  buildDossier,
} from './vendor/makefun-game.ts';

// Limits the scorer applies to this bounty, taken from the kit's gate:
// the dossier's text budget, how many screenshots and how large each may
// be, and the game tree's entry count, total size and longest path.
const DOSSIER_TEXT_BYTES = 163840;
const SHOT_COUNT_MAX = 4;
const SHOT_BYTES_MAX = 262144;
const GAME_ENTRY_MAX = 993;
const GAME_BYTES_MAX = 50331648;
const GAME_PATH_BYTES_MAX = 1000;

// Where the staged entry goes: the environment's override, or the
// grader's /output when nothing overrides it.
function pickOutputDir() {
  const override = process.env.MAKEFUN_OUTPUT_DIR;
  if (override !== undefined && override.length > 0) {
    return override;
  }
  return '/output';
}

// Copy one folder, contents and all, into a fresh destination.
function mirrorFolder(fromDir, toDir) {
  fs.cpSync(fromDir, toDir, { recursive: true });
}

// The repository root is the folder holding this very file.
const thisFile = url.fileURLToPath(import.meta.url);
const repoRoot = path.dirname(thisFile);
const targetDir = pickOutputDir();

fs.mkdirSync(targetDir, { recursive: true });

mirrorFolder(path.join(repoRoot, 'game'), path.join(targetDir, 'game'));

const shotsSource = path.join(repoRoot, 'screenshots');
if (fs.existsSync(shotsSource)) {
  mirrorFolder(shotsSource, path.join(targetDir, 'screenshots'));
}

const caps = {
  text_max_bytes: DOSSIER_TEXT_BYTES,
  screenshots: {
    max: SHOT_COUNT_MAX,
    max_bytes: SHOT_BYTES_MAX,
  },
  game_max_files: GAME_ENTRY_MAX,
  game_max_bytes: GAME_BYTES_MAX,
  game_path_max_bytes: GAME_PATH_BYTES_MAX,
};

const dossier = buildDossier(targetDir, caps);
fs.writeFileSync(path.join(targetDir, 'dossier.json'), dossier);
