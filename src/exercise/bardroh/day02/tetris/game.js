const COLS = 10;
const ROWS = 20;
const CELL = 30;

const PIECES = [
  { shape: [[1,1,1,1]], color: '#22d3ee' },         // I
  { shape: [[1,1],[1,1]], color: '#facc15' },        // O
  { shape: [[0,1,0],[1,1,1]], color: '#a855f7' },    // T
  { shape: [[0,1,1],[1,1,0]], color: '#22c55e' },    // S
  { shape: [[1,1,0],[0,1,1]], color: '#ef4444' },    // Z
  { shape: [[1,0,0],[1,1,1]], color: '#3b82f6' },    // J
  { shape: [[0,0,1],[1,1,1]], color: '#f97316' },    // L
];

const SCORE_TABLE = [0, 100, 300, 500, 800];

// ── DOM refs ──────────────────────────────────────────────
const canvas    = document.getElementById('board');
const ctx       = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx   = nextCanvas.getContext('2d');
const scoreEl   = document.getElementById('score');
const levelEl   = document.getElementById('level');
const linesEl   = document.getElementById('lines');
const startBtn  = document.getElementById('start-btn');
const muteBtn   = document.getElementById('mute-btn');
const overlay   = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const overlaySub  = document.getElementById('overlay-sub');

// ── Game state ────────────────────────────────────────────
let board, current, next, score, level, lines, dropInterval, rafId, running;

// ── Music (Korobeiniki / Tetris A Theme) ──────────────────
const BEAT_SEC = 60 / 144; // BPM 144

const NOTE_FREQ = {
  A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33,
  E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

// [note, beats]  q=1  e=0.5  h=2  q.=1.5
const MELODY = [
  // Section A (bars 1–4)
  ['E5',1],['B4',.5],['C5',.5],['D5',1],['C5',.5],['B4',.5],
  ['A4',1],['A4',.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
  ['B4',1.5],['C5',.5],['D5',1],['E5',1],
  ['C5',1],['A4',1],['A4',2],
  // Section B (bars 5–8)
  ['D5',1.5],['F5',.5],['A5',1],['G5',.5],['F5',.5],
  ['E5',1.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
  ['B4',1],['B4',.5],['C5',.5],['D5',1],['E5',1],
  ['C5',1],['A4',1],['A4',2],
];

const MELODY_DUR = MELODY.reduce((s, [, b]) => s + b, 0) * BEAT_SEC; // ~13.3s

let audioCtx    = null;
let masterGain  = null;
let musicTimer  = null;
let muted       = false;
let musicIteration = 0;
let musicStartTime = 0;

function initAudio() {
  if (audioCtx) return;
  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.25;
  masterGain.connect(audioCtx.destination);
}

function scheduleNote(freq, start, dur) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.4, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.88);
  osc.start(start);
  osc.stop(start + dur);
}

function scheduleMelodyAt(startTime) {
  let t = startTime;
  MELODY.forEach(([note, beats]) => {
    scheduleNote(NOTE_FREQ[note], t, beats * BEAT_SEC * 0.9);
    t += beats * BEAT_SEC;
  });
}

function startMusic() {
  initAudio();
  musicIteration = 0;
  musicStartTime = audioCtx.currentTime + 0.05;

  function loop() {
    const iterStart = musicStartTime + musicIteration * MELODY_DUR;
    scheduleMelodyAt(iterStart);
    musicIteration++;
    const msUntilNext = (iterStart + MELODY_DUR - audioCtx.currentTime - 0.2) * 1000;
    musicTimer = setTimeout(loop, Math.max(0, msUntilNext));
  }
  loop();
}

function stopMusic() {
  clearTimeout(musicTimer);
  musicTimer = null;
}

function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.25;
  muteBtn.textContent = muted ? '🔇' : '🔊';
}

// ── Game logic ────────────────────────────────────────────
function newBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: p.shape,
    color: p.color,
    x: Math.floor((COLS - p.shape[0].length) / 2),
    y: 0,
  };
}

function rotate(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

function isValid(shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  }
  return true;
}

function lock() {
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const ny = current.y + r;
      if (ny < 0) { endGame(); return; }
      board[ny][current.x + c] = current.color;
    }
  }
  clearLines();
  current = next;
  next = randomPiece();
  if (!isValid(current.shape, current.x, current.y)) endGame();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    score += SCORE_TABLE[cleared] * level;
    lines += cleared;
    level  = Math.floor(lines / 10) + 1;
    resetDropInterval();
    updateStats();
  }
}

function ghostY() {
  let gy = current.y;
  while (isValid(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

// ── Rendering ─────────────────────────────────────────────
function drawCell(context, x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1e1e3a';
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(canvas.width, r * CELL); ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(ctx, c, r, board[r][c]);
    }
  }

  // ghost
  const gy = ghostY();
  ctx.globalAlpha = 0.25;
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (current.shape[r][c]) drawCell(ctx, current.x + c, gy + r, current.color);
    }
  }
  ctx.globalAlpha = 1;

  // current piece
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (current.shape[r][c]) drawCell(ctx, current.x + c, current.y + r, current.color);
    }
  }
}

function drawNext() {
  const nc = nextCanvas.width / CELL;
  const nr = nextCanvas.height / CELL;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const offX = Math.floor((nc - next.shape[0].length) / 2);
  const offY = Math.floor((nr - next.shape.length) / 2);
  for (let r = 0; r < next.shape.length; r++) {
    for (let c = 0; c < next.shape[r].length; c++) {
      if (next.shape[r][c]) drawCell(nextCtx, offX + c, offY + r, next.color);
    }
  }
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ── Loop & timing ─────────────────────────────────────────
function dropIntervalMs() {
  return Math.max(100, 1000 - (level - 1) * 80);
}

function resetDropInterval() {
  clearInterval(dropInterval);
  dropInterval = setInterval(() => {
    if (!running) return;
    if (isValid(current.shape, current.x, current.y + 1)) current.y++;
    else lock();
  }, dropIntervalMs());
}

function loop() {
  drawBoard();
  drawNext();
  rafId = requestAnimationFrame(loop);
}

// ── Game flow ─────────────────────────────────────────────
function startGame() {
  board   = newBoard();
  score   = 0; level = 1; lines = 0;
  running = true;
  next    = randomPiece();
  current = randomPiece();
  updateStats();
  overlay.classList.add('hidden');
  startBtn.textContent = 'RESTART';
  stopMusic();
  startMusic();
  resetDropInterval();
  if (rafId) cancelAnimationFrame(rafId);
  loop();
}

function endGame() {
  running = false;
  clearInterval(dropInterval);
  stopMusic();
  overlayText.textContent = 'GAME OVER';
  overlaySub.textContent  = `Score: ${score}`;
  overlay.classList.remove('hidden');
}

// ── Input ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!running) return;
  switch (e.key) {
    case 'ArrowLeft':
      if (isValid(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (isValid(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      if (isValid(current.shape, current.x, current.y + 1)) current.y++;
      else lock();
      break;
    case 'ArrowUp': {
      const rotated = rotate(current.shape);
      if (isValid(rotated, current.x, current.y)) current.shape = rotated;
      break;
    }
    case ' ':
      e.preventDefault();
      current.y = ghostY();
      lock();
      break;
  }
});

startBtn.addEventListener('click', startGame);
muteBtn.addEventListener('click', toggleMute);
