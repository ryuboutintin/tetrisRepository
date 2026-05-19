/* ─────────────────────────────────────────
   Constants & Shapes
───────────────────────────────────────── */
const COLS = 10, ROWS = 20, CELL = 30;

const SHAPES = {
  I: { cells: [[0,1],[1,1],[2,1],[3,1]], color: '#00cfcf' },
  O: { cells: [[0,0],[1,0],[0,1],[1,1]], color: '#f0c000' },
  T: { cells: [[1,0],[0,1],[1,1],[2,1]], color: '#a000f0' },
  S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: '#00f050' },
  Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: '#f00030' },
  J: { cells: [[0,0],[0,1],[1,1],[2,1]], color: '#0050f0' },
  L: { cells: [[2,0],[0,1],[1,1],[2,1]], color: '#f07000' },
};
const PIECE_KEYS = Object.keys(SHAPES);
const SCORE_TABLE = [0, 100, 300, 500, 800];

/* ─────────────────────────────────────────
   Web Audio — Tetris Theme (Korobeiniki)
───────────────────────────────────────── */
let audioCtx = null;
let musicLoopId = 0;
let masterGain = null;

const BPM   = 160;
const Q     = 60000 / BPM;
const E     = Q / 2;
const DQ    = Q * 1.5;

const F = {
  A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  A5: 880.00, _: 0,
};

const MELODY = [
  [F.E5,DQ],[F.B4,E],[F.C5,E],[F.D5,E],
  [F.C5,E],[F.B4,E],[F.A4,DQ],[F.A4,E],
  [F.C5,E],[F.E5,DQ],[F.D5,E],[F.C5,E],
  [F.B4,DQ],[F.C5,E],[F.D5,Q],
  [F.E5,Q],[F.C5,Q],[F.A4,Q],[F.A4,Q],[F._,Q],

  [F.D5,DQ],[F.F5,E],[F.A5,DQ],[F.G5,E],
  [F.F5,E],[F.E5,DQ],[F.C5,E],
  [F.E5,DQ],[F.D5,E],[F.C5,E],
  [F.B4,DQ],[F.B4,E],[F.C5,E],[F.D5,Q],
  [F.E5,Q],[F.C5,Q],[F.A4,Q],[F.A4,Q],[F._,Q],
];

function playMusic() {
  const id = ++musicLoopId;

  function scheduleLoop(startTime) {
    if (musicLoopId !== id) return;

    let t = startTime;
    const gap = 0.005;

    MELODY.forEach(([freq, durMs]) => {
      const dur = durMs / 1000;
      if (freq > 0) {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(masterGain);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.setValueAtTime(0.18, t + dur - gap);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        osc.start(t);
        osc.stop(t + dur);
      }
      t += dur;
    });

    const totalDur = MELODY.reduce((s, [, d]) => s + d / 1000, 0);
    const loopDelay = (startTime + totalDur - audioCtx.currentTime) * 1000;
    setTimeout(() => {
      if (musicLoopId === id) scheduleLoop(audioCtx.currentTime + 0.05);
    }, loopDelay - 100);
  }

  scheduleLoop(audioCtx.currentTime + 0.05);
}

function stopMusic() {
  musicLoopId++;
}

/* ─────────────────────────────────────────
   Landing Page
───────────────────────────────────────── */
function loadBest() {
  return parseInt(localStorage.getItem('tetris_best') || '0', 10);
}

function saveBest(s) {
  if (s > loadBest()) localStorage.setItem('tetris_best', s);
}

document.getElementById('best-score-el').textContent = loadBest();

function enterGame() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('game-wrapper').style.display = 'flex';

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(audioCtx.destination);
}

/* ─────────────────────────────────────────
   Canvas & Game State
───────────────────────────────────────── */
const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nCtx = nextCanvas.getContext('2d');

let grid, piece, nextPiece, score, lines, level, dropTimer, lastTime, running, animId;
let clearAnim = null;
const CLEAR_ANIM_MS = 500;

/* ─────────────────────────────────────────
   Tetromino Helpers
───────────────────────────────────────── */
function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  const { cells, color } = SHAPES[key];
  return { cells: cells.map(([x, y]) => [x, y]), color, x: 3, y: 0 };
}

function rotateCells(cells) {
  const maxX = Math.max(...cells.map(([x]) => x));
  return cells.map(([x, y]) => [y, maxX - x]);
}

function isValid(cells, ox, oy) {
  return cells.every(([x, y]) => {
    const nx = x + ox, ny = y + oy;
    return nx >= 0 && nx < COLS && ny < ROWS && (ny < 0 || !grid[ny][nx]);
  });
}

/* ─────────────────────────────────────────
   Game Logic
───────────────────────────────────────── */
function placePiece() {
  piece.cells.forEach(([x, y]) => {
    const nx = x + piece.x, ny = y + piece.y;
    if (ny >= 0) grid[ny][nx] = piece.color;
  });
  const toRemove = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every(Boolean)) toRemove.push(r);
  }
  if (toRemove.length > 0) startClearAnim(toRemove);
  else spawnNext();
}

function spawnNext() {
  piece = nextPiece;
  nextPiece = randomPiece();
  if (!isValid(piece.cells, piece.x, piece.y)) { gameOver(); return; }
  drawNext();
}

function startClearAnim(rows) {
  const particles = [];
  rows.forEach(r => {
    for (let c = 0; c < COLS; c++) {
      const color = grid[r][c];
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: (c + 0.5) * CELL,
          y: (r + 0.5) * CELL,
          vx: (Math.random() - 0.5) * 10,
          vy: Math.random() * -6 - 1,
          color,
          life: 1,
          decay: 0.025 + Math.random() * 0.02,
          size: Math.random() * 5 + 2,
        });
      }
    }
  });
  clearAnim = { rows, startTime: performance.now(), particles, count: rows.length };
}

function finalizeClear() {
  const removed = new Set(clearAnim.rows);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (removed.has(r)) { grid.splice(r, 1); grid.unshift(new Array(COLS).fill(null)); }
  }
  const count = clearAnim.count;
  lines += count;
  score += SCORE_TABLE[count] * level;
  level = Math.floor(lines / 10) + 1;
  updateStats();
  clearAnim = null;
  lastTime = performance.now();
  spawnNext();
}

function hardDrop() {
  let dy = 0;
  while (isValid(piece.cells, piece.x, piece.y + dy + 1)) dy++;
  piece.y += dy;
  placePiece();
  dropTimer = 0;
}

function moveDown() {
  if (isValid(piece.cells, piece.x, piece.y + 1)) {
    piece.y++;
  } else {
    placePiece();
  }
  dropTimer = 0;
}

function ghostY() {
  let dy = 0;
  while (isValid(piece.cells, piece.x, piece.y + dy + 1)) dy++;
  return piece.y + dy;
}

/* ─────────────────────────────────────────
   Rendering
───────────────────────────────────────── */
function drawCell(context, x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4);
  context.fillRect(x * CELL + 1, y * CELL + 1, 4, CELL - 2);
}

function drawBoard() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke();
  }

  grid.forEach((row, r) => row.forEach((color, c) => {
    if (color) drawCell(ctx, c, r, color);
  }));

  if (!running || clearAnim) return;

  // ghost
  const gy = ghostY();
  piece.cells.forEach(([x, y]) => {
    const nx = x + piece.x, ny = y + gy;
    if (ny >= 0) {
      ctx.strokeStyle = piece.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(nx * CELL + 1, ny * CELL + 1, CELL - 2, CELL - 2);
      ctx.globalAlpha = 1;
    }
  });

  // active piece
  piece.cells.forEach(([x, y]) => {
    const nx = x + piece.x, ny = y + piece.y;
    if (ny >= 0) drawCell(ctx, nx, ny, piece.color);
  });
}

function drawNext() {
  nCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const cs = 20;
  const cells = nextPiece.cells;
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const offX = Math.floor((5 - (maxX - minX + 1)) / 2) - minX;
  const offY = Math.floor((4 - (maxY - minY + 1)) / 2) - minY;
  cells.forEach(([x, y]) => {
    nCtx.fillStyle = nextPiece.color;
    nCtx.fillRect((x + offX) * cs + 1, (y + offY) * cs + 1, cs - 2, cs - 2);
    nCtx.fillStyle = 'rgba(255,255,255,0.15)';
    nCtx.fillRect((x + offX) * cs + 1, (y + offY) * cs + 1, cs - 2, 3);
    nCtx.fillRect((x + offX) * cs + 1, (y + offY) * cs + 1, 3, cs - 2);
  });
}

function updateStats() {
  document.getElementById('score-el').textContent = score;
  document.getElementById('lines-el').textContent = lines;
  document.getElementById('level-el').textContent = level;
}

function dropInterval() {
  return Math.max(100, 1000 - (level - 1) * 80);
}

function drawClearEffect(progress) {
  const { rows, particles } = clearAnim;

  const flashAlpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
  rows.forEach(r => {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.85})`;
    ctx.fillRect(0, r * CELL, COLS * CELL, CELL);
  });

  rows.forEach(r => {
    const gradient = ctx.createLinearGradient(0, r * CELL, COLS * CELL, r * CELL);
    gradient.addColorStop(0,   `rgba(255, 200, 50, ${flashAlpha * 0.4})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${flashAlpha * 0.5})`);
    gradient.addColorStop(1,   `rgba(255, 200, 50, ${flashAlpha * 0.4})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, r * CELL, COLS * CELL, CELL);
  });

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────
   Game Loop
───────────────────────────────────────── */
function gameLoop(timestamp) {
  if (!running) return;

  if (clearAnim) {
    const progress = Math.min((timestamp - clearAnim.startTime) / CLEAR_ANIM_MS, 1);
    clearAnim.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= p.decay;
    });
    clearAnim.particles = clearAnim.particles.filter(p => p.life > 0);
    drawBoard();
    drawClearEffect(progress);
    if (progress >= 1) finalizeClear();
    animId = requestAnimationFrame(gameLoop);
    return;
  }

  const dt = timestamp - lastTime;
  lastTime = timestamp;
  dropTimer += dt;
  if (dropTimer >= dropInterval()) {
    moveDown();
    dropTimer = 0;
  }
  drawBoard();
  animId = requestAnimationFrame(gameLoop);
}

function gameOver() {
  running = false;
  cancelAnimationFrame(animId);
  stopMusic();
  saveBest(score);
  document.getElementById('overlay-title').textContent = 'GAME OVER';
  document.getElementById('overlay-btn').textContent = 'RESTART';
  document.getElementById('overlay').classList.remove('hidden');
}

function startGame() {
  cancelAnimationFrame(animId);
  stopMusic();

  clearAnim = null;
  grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  score = 0; lines = 0; level = 1; dropTimer = 0;
  piece = randomPiece();
  nextPiece = randomPiece();
  running = true;
  updateStats();
  drawNext();
  document.getElementById('overlay').classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);

  playMusic();
}

/* ─────────────────────────────────────────
   Keyboard
───────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (!running) return;
  switch (e.key) {
    case 'ArrowLeft':
      if (isValid(piece.cells, piece.x - 1, piece.y)) piece.x--;
      e.preventDefault(); break;
    case 'ArrowRight':
      if (isValid(piece.cells, piece.x + 1, piece.y)) piece.x++;
      e.preventDefault(); break;
    case 'ArrowDown':
      moveDown();
      e.preventDefault(); break;
    case 'ArrowUp': {
      const rotated = rotateCells(piece.cells);
      if (isValid(rotated, piece.x, piece.y)) {
        piece.cells = rotated;
      } else if (isValid(rotated, piece.x - 1, piece.y)) {
        piece.cells = rotated; piece.x--;
      } else if (isValid(rotated, piece.x + 1, piece.y)) {
        piece.cells = rotated; piece.x++;
      }
      e.preventDefault(); break;
    }
    case ' ':
      hardDrop();
      e.preventDefault(); break;
  }
});
