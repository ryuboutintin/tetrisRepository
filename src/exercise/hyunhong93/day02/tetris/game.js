// ─── BGM (Korobeiniki / Tetris Theme A) ──────────────────────────────────────
const BGM = (() => {
  const BPM = 160, BEAT = 60 / BPM;

  const NOTES = [
    // Phrase 1
    [659.25,1.0],[493.88,0.5],[523.25,0.5],[587.33,1.0],[523.25,0.5],[493.88,0.5],
    [440.00,1.0],[440.00,0.5],[523.25,0.5],[659.25,1.0],[587.33,0.5],[523.25,0.5],
    [493.88,1.5],[523.25,0.5],[587.33,1.0],[659.25,1.0],
    [523.25,1.0],[440.00,1.0],[440.00,2.0],
    // Phrase 2
    [0,0.5],[587.33,1.0],[698.46,0.5],[880.00,1.0],[783.99,0.5],[698.46,0.5],
    [659.25,1.5],[523.25,0.5],[659.25,1.0],[587.33,0.5],[523.25,0.5],
    [493.88,1.0],[493.88,0.5],[523.25,0.5],[587.33,1.0],[659.25,1.0],
    [523.25,1.0],[440.00,1.0],[440.00,2.0],
  ];

  let actx = null, master = null, loopTimer = null, muted = false;

  function init() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = 0.12;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
  }

  function playNote(freq, t, dur) {
    const osc = actx.createOscillator();
    const g   = actx.createGain();
    osc.connect(g);
    g.connect(master);
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.92);
    osc.start(t);
    osc.stop(t + dur);
  }

  function schedule(from) {
    clearTimeout(loopTimer);
    let t = from;
    for (const [f, b] of NOTES) {
      const d = b * BEAT;
      if (f > 0) playNote(f, t, d);
      t += d;
    }
    const loopDur = t - from;
    loopTimer = setTimeout(() => schedule(t), (loopDur - 0.3) * 1000);
  }

  return {
    play() {
      init();
      muted = false;
      master.gain.value = 0.12;
      schedule(actx.currentTime + 0.05);
    },
    stop() {
      clearTimeout(loopTimer);
      loopTimer = null;
      if (actx) { actx.close(); actx = null; master = null; }
    },
    silence()  { if (master) master.gain.value = 0; },
    restore()  { if (master && !muted) master.gain.value = 0.12; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.12;
      return muted;
    },
    isMuted: () => muted,
  };
})();

// ─── Game constants ───────────────────────────────────────────────────────────
const COLS = 10, ROWS = 20, CELL = 30;

const TETROMINOES = [
  { shape: [[1,1,1,1]],              color: '#00cfcf' },
  { shape: [[1,1],[1,1]],             color: '#f0c040' },
  { shape: [[0,1,0],[1,1,1]],         color: '#a040f0' },
  { shape: [[0,1,1],[1,1,0]],         color: '#40c040' },
  { shape: [[1,1,0],[0,1,1]],         color: '#e03030' },
  { shape: [[1,0,0],[1,1,1]],         color: '#4080f0' },
  { shape: [[0,0,1],[1,1,1]],         color: '#f07020' },
];

const SCORE_TABLE = [0, 100, 300, 500, 800];

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('board');
const ctx      = canvas.getContext('2d');
const nCanvas  = document.getElementById('next-canvas');
const nCtx     = nCanvas.getContext('2d');
const overlay  = document.getElementById('overlay');
const btn      = document.getElementById('btn');
const muteBtn  = document.getElementById('mute-btn');

// ─── State ────────────────────────────────────────────────────────────────────
let board, piece, next, score, level, lines, dropTimer, dropInterval, raf, paused, running;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return { shape: t.shape, color: t.color,
           x: Math.floor((COLS - t.shape[0].length) / 2), y: 0 };
}

function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
  );
}

function isValid(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  return true;
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function merge() {
  piece.shape.forEach((row, r) =>
    row.forEach((v, c) => { if (v) board[piece.y + r][piece.x + c] = piece.color; })
  );
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++; r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += SCORE_TABLE[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateHUD();
  }
}

function spawn() {
  piece = next || randomPiece();
  next  = randomPiece();
  if (!isValid(piece.shape, piece.x, piece.y)) gameOver();
  drawNext();
}

function hardDrop() {
  while (isValid(piece.shape, piece.x, piece.y + 1)) piece.y++;
  lockAndSpawn();
}

function lockAndSpawn() { merge(); clearLines(); spawn(); }

// ─── Rendering ────────────────────────────────────────────────────────────────
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke();
  }

  board.forEach((row, r) =>
    row.forEach((color, c) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 4);
    })
  );

  let ghostY = piece.y;
  while (isValid(piece.shape, piece.x, ghostY + 1)) ghostY++;
  if (ghostY !== piece.y) {
    ctx.globalAlpha = 0.2;
    piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!v) return;
        ctx.fillStyle = piece.color;
        ctx.fillRect((piece.x + c) * CELL + 1, (ghostY + r) * CELL + 1, CELL - 2, CELL - 2);
      })
    );
    ctx.globalAlpha = 1;
  }

  piece.shape.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      const px = (piece.x + c) * CELL, py = (piece.y + r) * CELL;
      ctx.fillStyle = piece.color;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(px + 1, py + 1, CELL - 2, 4);
    })
  );
}

function drawNext() {
  nCtx.clearRect(0, 0, nCanvas.width, nCanvas.height);
  const s = next.shape, cw = 24;
  const offX = Math.floor((nCanvas.width  - s[0].length * cw) / 2);
  const offY = Math.floor((nCanvas.height - s.length    * cw) / 2);
  s.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      nCtx.fillStyle = next.color;
      nCtx.fillRect(offX + c * cw + 1, offY + r * cw + 1, cw - 2, cw - 2);
      nCtx.fillStyle = 'rgba(255,255,255,0.25)';
      nCtx.fillRect(offX + c * cw + 1, offY + r * cw + 1, cw - 2, 4);
    })
  );
}

function updateHUD() {
  document.getElementById('score-val').textContent = score.toLocaleString();
  document.getElementById('level-val').textContent = level;
  document.getElementById('lines-val').textContent = lines;
}

// ─── Game loop ────────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  if (!running || paused) return;
  const dt = ts - lastTime;
  dropTimer += dt;
  lastTime = ts;
  if (dropTimer >= dropInterval) {
    dropTimer = 0;
    if (isValid(piece.shape, piece.x, piece.y + 1)) piece.y++;
    else lockAndSpawn();
  }
  drawBoard();
  raf = requestAnimationFrame(loop);
}

function startGame() {
  BGM.stop();
  board = emptyBoard();
  score = 0; level = 1; lines = 0;
  dropTimer = 0; dropInterval = 1000;
  paused = false; running = true;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.style.display = 'none';
  btn.textContent = '재시작';
  if (raf) cancelAnimationFrame(raf);
  lastTime = performance.now();
  raf = requestAnimationFrame(loop);
  BGM.play();
}

function gameOver() {
  running = false;
  cancelAnimationFrame(raf);
  BGM.stop();
  overlay.innerHTML = `
    <h2>GAME OVER</h2>
    <p>점수: ${score.toLocaleString()}</p>
  `;
  overlay.style.display = 'flex';
  btn.textContent = '다시하기';
}

// ─── Controls ─────────────────────────────────────────────────────────────────
btn.addEventListener('click', startGame);

muteBtn.addEventListener('click', () => {
  const m = BGM.toggleMute();
  muteBtn.textContent = m ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', m);
});

document.addEventListener('keydown', e => {
  if (e.code === 'KeyM') {
    muteBtn.click();
    return;
  }

  if (!running || paused) {
    if (e.code === 'KeyP' && paused) {
      paused = false;
      BGM.restore();
      lastTime = performance.now();
      raf = requestAnimationFrame(loop);
    }
    return;
  }

  switch (e.code) {
    case 'ArrowLeft':
      if (isValid(piece.shape, piece.x - 1, piece.y)) piece.x--;
      break;
    case 'ArrowRight':
      if (isValid(piece.shape, piece.x + 1, piece.y)) piece.x++;
      break;
    case 'ArrowDown':
      if (isValid(piece.shape, piece.x, piece.y + 1)) piece.y++;
      else lockAndSpawn();
      break;
    case 'ArrowUp':
    case 'KeyZ': {
      const rot = rotate(piece.shape);
      for (const kick of [0, -1, 1, -2, 2]) {
        if (isValid(rot, piece.x + kick, piece.y)) {
          piece.shape = rot; piece.x += kick; break;
        }
      }
      break;
    }
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyP':
      paused = true;
      BGM.silence();
      cancelAnimationFrame(raf);
      ctx.fillStyle = 'rgba(13,13,26,0.72)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#a0a0ff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#555';
      ctx.fillText('P 키로 재개', canvas.width / 2, canvas.height / 2 + 32);
      break;
  }

  if (!paused) drawBoard();
});
