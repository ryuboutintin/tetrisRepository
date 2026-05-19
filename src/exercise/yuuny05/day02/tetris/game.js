const COLS = 10, ROWS = 20, BLOCK = 30;

const COLORS = [
  null,
  '#00d4ff', // I
  '#f7d800', // O
  '#a855f7', // T
  '#22c55e', // S
  '#ef4444', // Z
  '#3b82f6', // J
  '#f97316', // L
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[2,2],[2,2]],
  [[0,3,0],[3,3,3],[0,0,0]],
  [[0,4,4],[4,4,0],[0,0,0]],
  [[5,5,0],[0,5,5],[0,0,0]],
  [[6,0,0],[6,6,6],[0,0,0]],
  [[0,0,7],[7,7,7],[0,0,0]],
];

const SCORE_TABLE = [0, 100, 300, 500, 800];

// DOM
const startScreen  = document.getElementById('start-screen');
const gameScreen   = document.getElementById('game-screen');
const idInput      = document.getElementById('id-input');
const startBtn     = document.getElementById('start-btn');
const playerName   = document.getElementById('player-name');
const scoreEl      = document.getElementById('score-value');
const levelEl      = document.getElementById('level-value');
const pauseBtn     = document.getElementById('pause-btn');
const muteBtn      = document.getElementById('mute-btn');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlaySub   = document.getElementById('overlay-sub');
const overlayBtn   = document.getElementById('overlay-btn');

const boardCanvas = document.getElementById('board');
const ctx         = boardCanvas.getContext('2d');
const nextCanvas  = document.getElementById('next-canvas');
const nctx        = nextCanvas.getContext('2d');

let board, score, level, lines, piece, next, pos, paused, gameOver, loopId, username;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randPiece() {
  const idx = Math.floor(Math.random() * 7) + 1;
  return { shape: PIECES[idx].map(r => [...r]), color: idx };
}

function rotate(shape) {
  const n = shape.length, m = shape[0].length;
  const result = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let r = 0; r < n; r++)
    for (let c = 0; c < m; c++)
      result[c][n - 1 - r] = shape[r][c];
  return result;
}

function collides(b, p, px, py) {
  for (let r = 0; r < p.length; r++)
    for (let c = 0; c < p[r].length; c++)
      if (p[r][c]) {
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && b[ny][nx]) return true;
      }
  return false;
}

function merge(b, p, px, py, color) {
  for (let r = 0; r < p.length; r++)
    for (let c = 0; c < p[r].length; c++)
      if (p[r][c] && py + r >= 0)
        b[py + r][px + c] = color;
}

function clearLines(b) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[r].every(v => v !== 0)) {
      b.splice(r, 1);
      b.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function spawnPiece() {
  piece = next;
  next  = randPiece();
  pos   = { x: Math.floor((COLS - piece.shape[0].length) / 2), y: -1 };
  if (collides(board, piece.shape, pos.x, pos.y)) endGame();
}

function drop() {
  if (paused || gameOver) return;
  pos.y++;
  if (collides(board, piece.shape, pos.x, pos.y)) {
    pos.y--;
    merge(board, piece.shape, pos.x, pos.y, piece.color);
    const cleared = clearLines(board);
    if (cleared > 0) {
      score += SCORE_TABLE[cleared] * level;
      lines += cleared;
      level  = Math.floor(lines / 10) + 1;
      scoreEl.textContent = score.toLocaleString();
      levelEl.textContent = level;
    }
    spawnPiece();
  }
  draw();
}

function hardDrop() {
  while (!collides(board, piece.shape, pos.x, pos.y + 1)) pos.y++;
  drop();
}

function moveLeft()  { if (!collides(board, piece.shape, pos.x - 1, pos.y)) pos.x--; draw(); }
function moveRight() { if (!collides(board, piece.shape, pos.x + 1, pos.y)) pos.x++; draw(); }
function rotatePiece() {
  const r = rotate(piece.shape);
  if (!collides(board, r, pos.x, pos.y)) piece.shape = r;
  draw();
}

function ghostY() {
  let gy = pos.y;
  while (!collides(board, piece.shape, pos.x, gy + 1)) gy++;
  return gy;
}

function drawBlock(context, x, y, colorIdx, alpha = 1) {
  if (colorIdx === 0) return;
  context.globalAlpha = alpha;
  context.fillStyle = COLORS[colorIdx];
  context.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, 6);
  context.globalAlpha = 1;
}

function draw() {
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c]);

  const gy = ghostY();
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        drawBlock(ctx, pos.x + c, gy + r, piece.color, 0.2);

  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        drawBlock(ctx, pos.x + c, pos.y + r, piece.color);

  drawNext();
}

function drawNext() {
  nctx.fillStyle = '#1e1e2e';
  nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const ns   = next.shape;
  const offX = Math.floor((4 - ns[0].length) / 2);
  const offY = Math.floor((4 - ns.length) / 2);
  const nb   = 28;

  for (let r = 0; r < ns.length; r++)
    for (let c = 0; c < ns[r].length; c++)
      if (ns[r][c]) {
        const x = (offX + c) * nb + 4;
        const y = (offY + r) * nb + 4;
        nctx.fillStyle = COLORS[ns[r][c]];
        nctx.fillRect(x + 1, y + 1, nb - 2, nb - 2);
        nctx.fillStyle = 'rgba(255,255,255,0.15)';
        nctx.fillRect(x + 1, y + 1, nb - 2, 5);
      }
}

function getSpeed() {
  return Math.max(100, 800 - (level - 1) * 70);
}

function loop() {
  drop();
  loopId = setTimeout(loop, getSpeed());
}

function startGame() {
  board    = createBoard();
  score    = 0;
  level    = 1;
  lines    = 0;
  paused   = false;
  gameOver = false;
  scoreEl.textContent = '0';
  levelEl.textContent = '1';
  next = randPiece();
  spawnPiece();
  clearTimeout(loopId);
  loopId = setTimeout(loop, getSpeed());
  AudioEngine.play();
  draw();
}

function endGame() {
  gameOver = true;
  clearTimeout(loopId);
  AudioEngine.stop();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = score.toLocaleString() + '점';
  overlaySub.textContent   = username + '님의 최종 점수입니다';
  overlayBtn.textContent   = '다시 시작';
  overlay.classList.add('show');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  pauseBtn.textContent = paused ? '계속하기 (P)' : '일시정지 (P)';
  if (paused) {
    clearTimeout(loopId);
    overlayTitle.textContent = 'PAUSE';
    overlayScore.textContent = '';
    overlaySub.textContent   = 'P 키를 눌러 계속하세요';
    overlayBtn.textContent   = '계속하기';
    overlay.classList.add('show');
  } else {
    overlay.classList.remove('show');
    loopId = setTimeout(loop, getSpeed());
  }
}

function toggleMute() {
  AudioEngine.setMute(!AudioEngine.isMuted());
  muteBtn.textContent = AudioEngine.isMuted() ? '🔇 음소거 해제 (M)' : '🔊 음소거 (M)';
}

// 이벤트
startBtn.addEventListener('click', () => {
  const val = idInput.value.trim();
  if (!val) { idInput.focus(); return; }
  username = val;
  playerName.textContent     = username;
  startScreen.style.display  = 'none';
  gameScreen.style.display   = 'flex';
  startGame();
});

idInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') startBtn.click();
});

pauseBtn.addEventListener('click', togglePause);
muteBtn.addEventListener('click', toggleMute);

overlayBtn.addEventListener('click', () => {
  overlay.classList.remove('show');
  if (gameOver) {
    startGame();
  } else {
    togglePause();
  }
});

document.addEventListener('keydown', e => {
  if (gameScreen.style.display === 'none') return;
  if (paused && e.key !== 'p' && e.key !== 'P') return;
  switch (e.key) {
    case 'ArrowLeft':         e.preventDefault(); moveLeft();    break;
    case 'ArrowRight':        e.preventDefault(); moveRight();   break;
    case 'ArrowDown':         e.preventDefault(); drop();        break;
    case 'ArrowUp':
    case 'z': case 'Z':       e.preventDefault(); rotatePiece(); break;
    case ' ':                 e.preventDefault(); hardDrop();    break;
    case 'p': case 'P':       togglePause(); break;
    case 'm': case 'M':       toggleMute();  break;
  }
});
