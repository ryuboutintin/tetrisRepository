const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const NEXT_BLOCK = 24;
const DROP_INTERVAL = 650;

const COLORS = {
  I: "#45d7ff",
  J: "#4d79ff",
  L: "#ffae42",
  O: "#ffd84d",
  S: "#50dc82",
  T: "#b167ff",
  Z: "#ff5f7d",
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
};

const boardCanvas = document.querySelector("#board");
const boardContext = boardCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextContext = nextCanvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const linesElement = document.querySelector("#lines");
const landingPage = document.querySelector("#landingPage");
const gamePage = document.querySelector("#gamePage");
const playButton = document.querySelector("#playButton");
const musicButton = document.querySelector("#musicButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const shell = document.querySelector(".game-shell");

let board;
let activePiece;
let nextPiece;
let score;
let lines;
let lastTime;
let dropCounter;
let isPaused;
let isGameOver;
let hasStarted = false;
let animationId;
let audioContext;
let musicTimer;
let musicStep = 0;
let isMusicOn = false;
let nextNoteTime = 0;

const MELODY = [
  ["E5", 1], ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5], ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5], ["D5", 1], ["E5", 1], ["C5", 1], ["A4", 1],
  ["A4", 1], [null, 1],
  ["D5", 1], ["F5", 0.5], ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5], ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1], ["A4", 1], [null, 1],
];

const BASS = [
  "A2", "A2", "E3", "E3", "A2", "A2", "E3", "E3",
  "D3", "D3", "A2", "A2", "E3", "E3", "A2", "A2",
];

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const matrix = SHAPES[type].map((row) => [...row]);

  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function resetGame() {
  board = createBoard();
  activePiece = randomPiece();
  nextPiece = randomPiece();
  score = 0;
  lines = 0;
  lastTime = 0;
  dropCounter = 0;
  isPaused = false;
  isGameOver = false;
  hasStarted = true;
  shell.classList.remove("game-over");
  pauseButton.textContent = "II";
  updateStats();
  draw();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
}

function startGame() {
  landingPage.classList.add("is-hidden");
  gamePage.classList.remove("is-hidden");
  resetGame();
  startMusic();
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (!isPaused && !isGameOver) {
    dropCounter += deltaTime;
    if (dropCounter > DROP_INTERVAL) {
      moveDown();
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }

      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  activePiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        board[activePiece.y + y][activePiece.x + x] = activePiece.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared];
    updateStats();
  }
}

function spawnPiece() {
  activePiece = nextPiece;
  activePiece.x = Math.floor((COLS - activePiece.matrix[0].length) / 2);
  activePiece.y = 0;
  nextPiece = randomPiece();

  if (collides(activePiece)) {
    isGameOver = true;
    shell.classList.add("game-over");
  }
}

function moveDown() {
  if (collides(activePiece, 0, 1)) {
    mergePiece();
    clearLines();
    spawnPiece();
  } else {
    activePiece.y += 1;
  }

  dropCounter = 0;
}

function moveHorizontal(direction) {
  if (!collides(activePiece, direction, 0)) {
    activePiece.x += direction;
  }
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  const rotated = rotate(activePiece.matrix);
  const originalX = activePiece.x;
  const offsets = [0, -1, 1, -2, 2];

  for (const offset of offsets) {
    activePiece.x = originalX + offset;
    if (!collides(activePiece, 0, 0, rotated)) {
      activePiece.matrix = rotated;
      return;
    }
  }

  activePiece.x = originalX;
}

function hardDrop() {
  while (!collides(activePiece, 0, 1)) {
    activePiece.y += 1;
    score += 2;
  }

  moveDown();
  updateStats();
}

function updateStats() {
  scoreElement.textContent = score;
  linesElement.textContent = lines;
}

function drawCell(context, x, y, size, color) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 1;
  context.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
}

function drawGrid() {
  boardContext.strokeStyle = "#252934";
  boardContext.lineWidth = 1;

  for (let x = 0; x <= COLS; x += 1) {
    boardContext.beginPath();
    boardContext.moveTo(x * BLOCK + 0.5, 0);
    boardContext.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
    boardContext.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * BLOCK + 0.5);
    boardContext.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
    boardContext.stroke();
  }
}

function drawMatrix(context, matrix, originX, originY, size, type) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(context, originX + x, originY + y, size, COLORS[type]);
      }
    });
  });
}

function drawBoard() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.fillStyle = "#111318";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) {
        drawCell(boardContext, x, y, BLOCK, COLORS[type]);
      }
    });
  });

  drawMatrix(boardContext, activePiece.matrix, activePiece.x, activePiece.y, BLOCK, activePiece.type);
}

function drawNext() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextContext.fillStyle = "#171a20";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const offsetX = Math.floor((4 - nextPiece.matrix[0].length) / 2);
  const offsetY = Math.floor((4 - nextPiece.matrix.length) / 2);
  drawMatrix(nextContext, nextPiece.matrix, offsetX, offsetY, NEXT_BLOCK, nextPiece.type);
}

function drawOverlay(text) {
  boardContext.fillStyle = "rgba(17, 19, 24, 0.72)";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.fillStyle = "#f4f6fb";
  boardContext.font = "700 28px Arial";
  boardContext.textAlign = "center";
  boardContext.fillText(text, boardCanvas.width / 2, boardCanvas.height / 2);
}

function draw() {
  if (!activePiece) {
    return;
  }

  drawBoard();
  drawNext();

  if (isPaused) {
    drawOverlay("PAUSED");
  }

  if (isGameOver) {
    drawOverlay("GAME OVER");
  }
}

function handleAction(action) {
  if (!hasStarted) {
    return;
  }

  if (isGameOver && action !== "restart") {
    return;
  }

  if (action === "pause") {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? "▶" : "II";
    return;
  }

  if (isPaused) {
    return;
  }

  if (action === "left") moveHorizontal(-1);
  if (action === "right") moveHorizontal(1);
  if (action === "down") moveDown();
  if (action === "rotate") rotatePiece();
  if (action === "drop") hardDrop();
}

function noteFrequency(note) {
  if (!note) {
    return 0;
  }

  const [, pitch, octave] = note.match(/^([A-G]#?)(\d)$/);
  const semitones = {
    C: -9,
    "C#": -8,
    D: -7,
    "D#": -6,
    E: -5,
    F: -4,
    "F#": -3,
    G: -2,
    "G#": -1,
    A: 0,
    "A#": 1,
    B: 2,
  };

  return 440 * 2 ** (Number(octave) - 4 + semitones[pitch] / 12);
}

function scheduleTone(note, startTime, duration, options = {}) {
  if (!note || !audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const volume = options.volume ?? 0.08;

  oscillator.type = options.type ?? "square";
  oscillator.frequency.value = noteFrequency(note);
  filter.type = "lowpass";
  filter.frequency.value = options.filter ?? 1200;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.92);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function scheduleMusic() {
  if (!audioContext || !isMusicOn) {
    return;
  }

  const beat = 0.24;

  while (nextNoteTime < audioContext.currentTime + 0.35) {
    const [note, length] = MELODY[musicStep % MELODY.length];
    const duration = beat * length;

    scheduleTone(note, nextNoteTime, duration, { volume: 0.075, type: "square", filter: 1500 });

    if (musicStep % 2 === 0) {
      const bassNote = BASS[Math.floor(musicStep / 2) % BASS.length];
      scheduleTone(bassNote, nextNoteTime, beat * 1.7, { volume: 0.045, type: "triangle", filter: 650 });
    }

    nextNoteTime += duration;
    musicStep += 1;
  }
}

async function startMusic() {
  if (!audioContext) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioEngine();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  if (isMusicOn) {
    return;
  }

  isMusicOn = true;
  musicButton.classList.remove("music-off");
  musicButton.setAttribute("aria-pressed", "true");
  musicButton.textContent = "♪";
  nextNoteTime = audioContext.currentTime + 0.05;
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 80);
}

function stopMusic() {
  isMusicOn = false;
  musicButton.classList.add("music-off");
  musicButton.setAttribute("aria-pressed", "false");
  musicButton.textContent = "♪";
  clearInterval(musicTimer);
}

function toggleMusic() {
  if (isMusicOn) {
    stopMusic();
  } else {
    startMusic();
  }
}

document.addEventListener("keydown", (event) => {
  const keys = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotate",
    " ": "drop",
    KeyP: "pause",
  };

  const action = keys[event.code];
  if (!action) {
    return;
  }

  event.preventDefault();
  handleAction(action);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

playButton.addEventListener("click", startGame);
musicButton.addEventListener("click", toggleMusic);
pauseButton.addEventListener("click", () => handleAction("pause"));
restartButton.addEventListener("click", resetGame);
