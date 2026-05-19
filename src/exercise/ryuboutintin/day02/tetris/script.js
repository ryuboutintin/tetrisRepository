const landingView = document.getElementById("landing-view");
const gameView = document.getElementById("game-view");
const playButton = document.getElementById("play-button");
const restartButton = document.getElementById("restart-button");
const muteButton = document.getElementById("mute-button");
const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const overlayElement = document.getElementById("overlay");
const overlayTitleElement = document.getElementById("overlay-title");
const overlayMessageElement = document.getElementById("overlay-message");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const EMPTY = 0;
const DROP_INTERVAL = 650;
const LINE_SCORES = [0, 100, 300, 500, 800];
const NOTE_FREQUENCIES = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
};

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

const colors = {
  0: null,
  1: "#ff6b6b",
  2: "#ffd166",
  3: "#06d6a0",
  4: "#4cc9f0",
  5: "#4361ee",
  6: "#f72585",
  7: "#f77f00",
};

const tetrominoes = "TJLOSZI";

const shapes = {
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ],
  O: [
    [4, 4],
    [4, 4],
  ],
  S: [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0],
  ],
  Z: [
    [6, 6, 0],
    [0, 6, 6],
    [0, 0, 0],
  ],
  I: [
    [0, 0, 0, 0],
    [7, 7, 7, 7],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
};

const bgmSequence = [
  { melody: "E5", bass: "E3", beats: 1 },
  { melody: "B4", bass: "B3", beats: 0.5 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "D5", bass: "D4", beats: 1 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "B4", bass: "B3", beats: 0.5 },
  { melody: "A4", bass: "A3", beats: 1 },
  { melody: "A4", bass: "A3", beats: 0.5 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "E5", bass: "E3", beats: 1 },
  { melody: "D5", bass: "D4", beats: 0.5 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "B4", bass: "B3", beats: 1 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "D5", bass: "D4", beats: 0.5 },
  { melody: "E5", bass: "E3", beats: 1 },
  { melody: "C5", bass: "C4", beats: 1 },
  { melody: "A4", bass: "A3", beats: 1 },
  { melody: "A4", bass: "A3", beats: 1 },
  { melody: "rest", bass: "E3", beats: 0.5 },
  { melody: "D5", bass: "D4", beats: 1 },
  { melody: "F5", bass: "F3", beats: 0.5 },
  { melody: "A5", bass: "A3", beats: 1.5 },
  { melody: "G5", bass: "G3", beats: 0.5 },
  { melody: "F5", bass: "F3", beats: 0.5 },
  { melody: "E5", bass: "E3", beats: 1 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "E5", bass: "E3", beats: 0.5 },
  { melody: "D5", bass: "D4", beats: 1 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "B4", bass: "B3", beats: 0.5 },
  { melody: "B4", bass: "G3", beats: 1 },
  { melody: "C5", bass: "C4", beats: 0.5 },
  { melody: "D5", bass: "D4", beats: 0.5 },
  { melody: "E5", bass: "E3", beats: 1 },
  { melody: "C5", bass: "C4", beats: 1 },
  { melody: "A4", bass: "A3", beats: 1 },
  { melody: "A4", bass: "A3", beats: 1 },
];

let board = createBoard();
let score = 0;
let lastDropTime = 0;
let animationFrameId = 0;
let gameOver = false;
let hasStartedGame = false;

let audioContext = null;
let masterGain = null;
let bassGain = null;
let bgmTimer = null;
let isMuted = false;

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
};

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function createPiece() {
  const type = tetrominoes[Math.floor(Math.random() * tetrominoes.length)];
  return shapes[type].map((row) => [...row]);
}

function resetPlayer() {
  player.matrix = createPiece();
  player.pos.y = 0;
  player.pos.x = Math.floor((COLS - player.matrix[0].length) / 2);

  if (collides(board, player)) {
    gameOver = true;
    showOverlay("Game Over", "Enter 키 또는 버튼으로 다시 시작하세요.");
    cancelAnimationFrame(animationFrameId);
  }
}

function collides(grid, activePlayer) {
  const { matrix, pos } = activePlayer;
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (
        matrix[y][x] !== EMPTY &&
        (grid[y + pos.y] && grid[y + pos.y][x + pos.x]) !== EMPTY
      ) {
        return true;
      }
    }
  }
  return false;
}

function merge(grid, activePlayer) {
  activePlayer.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== EMPTY) {
        grid[y + activePlayer.pos.y][x + activePlayer.pos.x] = value;
      }
    });
  });
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function playerRotate() {
  const rotated = rotate(player.matrix);
  const originalX = player.pos.x;
  let offset = 1;

  player.matrix = rotated;
  while (collides(board, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > player.matrix[0].length) {
      player.matrix = rotate(rotate(rotate(player.matrix)));
      player.pos.x = originalX;
      return;
    }
  }
}

function playerMove(direction) {
  player.pos.x += direction;
  if (collides(board, player)) {
    player.pos.x -= direction;
  }
}

function playerDrop() {
  player.pos.y += 1;
  if (collides(board, player)) {
    player.pos.y -= 1;
    merge(board, player);
    clearLines();
    resetPlayer();
  }
  lastDropTime = 0;
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x] === EMPTY) {
        continue outer;
      }
    }

    const row = board.splice(y, 1)[0].fill(EMPTY);
    board.unshift(row);
    cleared += 1;
    y += 1;
  }

  if (cleared > 0) {
    score += LINE_SCORES[cleared] || cleared * 200;
    scoreElement.textContent = score;
  }
}

function drawCell(x, y, value) {
  if (value === EMPTY) {
    context.fillStyle = "rgba(255, 255, 255, 0.03)";
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    context.strokeStyle = "rgba(255, 255, 255, 0.04)";
    context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    return;
  }

  context.fillStyle = colors[value];
  context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.fillRect(x * BLOCK_SIZE + 4, y * BLOCK_SIZE + 4, BLOCK_SIZE - 8, 8);

  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 2;
  context.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      drawCell(x + offset.x, y + offset.y, value);
    });
  });
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      drawCell(x, y, board[y][x]);
    }
  }

  if (player.matrix) {
    drawMatrix(player.matrix, player.pos);
  }
}

function update(time = 0) {
  if (gameOver) {
    draw();
    return;
  }

  const deltaTime = time - lastDropTime;
  if (deltaTime > DROP_INTERVAL) {
    playerDrop();
    lastDropTime = time;
  }

  draw();
  animationFrameId = requestAnimationFrame(update);
}

function showOverlay(title, message) {
  overlayTitleElement.textContent = title;
  overlayMessageElement.textContent = message;
  overlayElement.classList.remove("hidden");
}

function hideOverlay() {
  overlayElement.classList.add("hidden");
}

function restartGame() {
  if (!hasStartedGame) {
    return;
  }

  board = createBoard();
  score = 0;
  scoreElement.textContent = score;
  gameOver = false;
  lastDropTime = 0;
  hideOverlay();
  resetPlayer();
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(update);
}

function showGameView() {
  landingView.classList.add("hidden");
  landingView.classList.remove("screen-active");
  gameView.classList.remove("hidden");
  gameView.classList.add("screen-active");
}

function updateMuteButton() {
  muteButton.textContent = isMuted ? "BGM 음소거 해제" : "BGM 음소거";
  muteButton.setAttribute("aria-pressed", String(isMuted));
}

function ensureAudio() {
  if (audioContext) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  bassGain = audioContext.createGain();

  masterGain.gain.value = 0.12;
  bassGain.gain.value = 0.08;

  bassGain.connect(masterGain);
  masterGain.connect(audioContext.destination);
}

function createPulseOscillator(frequency, waveform, startTime, duration, gainValue, destination) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function scheduleLoop() {
  if (!audioContext) {
    return;
  }

  const beatDuration = 60 / 138;
  let cursor = audioContext.currentTime + 0.04;

  bgmSequence.forEach((step, index) => {
    const duration = beatDuration * step.beats;

    if (step.melody !== "rest") {
      createPulseOscillator(
        NOTE_FREQUENCIES[step.melody],
        index % 2 === 0 ? "square" : "triangle",
        cursor,
        duration * 0.92,
        0.06,
        masterGain
      );
    }

    createPulseOscillator(
      NOTE_FREQUENCIES[step.bass],
      "triangle",
      cursor,
      duration * 0.88,
      0.035,
      bassGain
    );

    cursor += duration;
  });

  const loopDuration = cursor - audioContext.currentTime;
  bgmTimer = window.setTimeout(scheduleLoop, Math.max((loopDuration - 0.12) * 1000, 0));
}

async function startBgm() {
  ensureAudio();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  window.clearTimeout(bgmTimer);
  scheduleLoop();
}

async function startGame() {
  showGameView();
  hasStartedGame = true;
  restartGame();
  await startBgm();
}

function toggleMute() {
  if (!masterGain || !audioContext) {
    return;
  }

  isMuted = !isMuted;
  const nextVolume = isMuted ? 0.0001 : 0.12;
  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  masterGain.gain.setTargetAtTime(nextVolume, audioContext.currentTime, 0.05);
  updateMuteButton();
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Enter"].includes(event.key) || event.code === "Space") {
    event.preventDefault();
  }

  if (!hasStartedGame) {
    if (event.key === "Enter") {
      startGame();
    }
    return;
  }

  if (event.key === "Enter") {
    restartGame();
    return;
  }

  if (gameOver) {
    return;
  }

  if (event.key === "ArrowLeft") {
    playerMove(-1);
  } else if (event.key === "ArrowRight") {
    playerMove(1);
  } else if (event.key === "ArrowDown") {
    playerDrop();
  } else if (event.key === "ArrowUp" || event.code === "Space") {
    playerRotate();
  }
});

playButton.addEventListener("click", () => {
  startGame();
});
restartButton.addEventListener("click", restartGame);
muteButton.addEventListener("click", toggleMute);

updateMuteButton();
draw();
