const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const restartButton = document.getElementById("restart");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const COLORS = {
  I: "#7cf7d4",
  O: "#ffd166",
  T: "#b39cff",
  S: "#6ee7a8",
  Z: "#ff6b6b",
  J: "#7ea1ff",
  L: "#ffb86b",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

let board;
let currentPiece;
let nextDrop = 0;
let dropInterval = 700;
let score = 0;
let lines = 0;
let level = 1;
let isGameOver = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(""));
}

function createPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    matrix: SHAPES[type].map((row) => [...row]),
    x: Math.floor((COLS - SHAPES[type][0].length) / 2),
    y: 0,
  };
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collide(piece, offsetX = 0, offsetY = 0, testMatrix = piece.matrix) {
  for (let y = 0; y < testMatrix.length; y++) {
    for (let x = 0; x < testMatrix[y].length; x++) {
      if (!testMatrix[y][x]) continue;

      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      const boardY = currentPiece.y + y;
      const boardX = currentPiece.x + x;
      if (boardY >= 0) board[boardY][boardX] = currentPiece.type;
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(""));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(120, 700 - (level - 1) * 55);
  }
}

function spawnPiece() {
  currentPiece = createPiece();
  if (collide(currentPiece)) {
    isGameOver = true;
    overlay.classList.remove("hidden");
  }
}

function dropPiece() {
  if (collide(currentPiece, 0, 1)) {
    mergePiece();
    clearLines();
    spawnPiece();
  } else {
    currentPiece.y += 1;
  }
}

function movePiece(direction) {
  if (!collide(currentPiece, direction, 0)) {
    currentPiece.x += direction;
  }
}

function rotatePiece() {
  const rotated = rotateMatrix(currentPiece.matrix);
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    if (!collide(currentPiece, kick, 0, rotated)) {
      currentPiece.matrix = rotated;
      currentPiece.x += kick;
      return;
    }
  }
}

function hardDrop() {
  while (!collide(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    score += 1;
  }
  dropPiece();
}

function drawBlock(x, y, type, alpha = 1) {
  const color = COLORS[type];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillRect(x, y, BLOCK, BLOCK);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, BLOCK - 2, BLOCK - 2);
  ctx.restore();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(COLS * BLOCK, y * BLOCK);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#08101f");
  gradient.addColorStop(1, "#050913");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) drawBlock(x * BLOCK, y * BLOCK, cell, 0.95);
    });
  });

  currentPiece.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      const boardY = currentPiece.y + y;
      if (boardY < 0) return;
      drawBlock((currentPiece.x + x) * BLOCK, boardY * BLOCK, currentPiece.type);
    });
  });
}

function updateStats() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 700;
  isGameOver = false;
  overlay.classList.add("hidden");
  spawnPiece();
  updateStats();
}

function gameLoop(timestamp) {
  if (!isGameOver && timestamp > nextDrop) {
    dropPiece();
    nextDrop = timestamp + dropInterval;
    updateStats();
  }

  drawBoard();
  updateStats();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") {
    resetGame();
    return;
  }

  if (isGameOver) return;

  switch (event.key) {
    case "ArrowLeft":
      movePiece(-1);
      break;
    case "ArrowRight":
      movePiece(1);
      break;
    case "ArrowDown":
      dropPiece();
      score += 1;
      break;
    case "ArrowUp":
      rotatePiece();
      break;
    case " ":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }

  updateStats();
});

restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(gameLoop);
