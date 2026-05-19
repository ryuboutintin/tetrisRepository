const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const COLORS = [
    null,
    '#00f0f0', // I
    '#0000f0', // J
    '#f0a000', // L
    '#f0f000', // O
    '#00f000', // S
    '#a000f0', // T
    '#f00000', // Z
];

const SHAPES = [
    [],
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
    [[1,0,0],[1,1,1],[0,0,0]],                   // J
    [[0,0,1],[1,1,1],[0,0,0]],                   // L
    [[1,1],[1,1]],                                // O
    [[0,1,1],[1,1,0],[0,0,0]],                   // S
    [[0,1,0],[1,1,1],[0,0,0]],                   // T
    [[1,1,0],[0,1,1],[0,0,0]],                   // Z
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

let board = [];
let score = 0;
let level = 1;
let lines = 0;
let currentPiece = null;
let nextPiece = null;
let gameInterval = null;
let paused = false;
let gameRunning = false;

function createBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
    const id = Math.floor(Math.random() * 7) + 1;
    const shape = SHAPES[id].map(row => [...row]);
    return {
        shape,
        color: id,
        x: Math.floor((COLS - shape[0].length) / 2),
        y: 0
    };
}

function rotate(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = shape[r][c];
        }
    }
    return rotated;
}

function isValid(piece, offsetX = 0, offsetY = 0, newShape = null) {
    const shape = newShape || piece.shape;
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const nx = piece.x + c + offsetX;
            const ny = piece.y + r + offsetY;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
            if (ny >= 0 && board[ny][nx]) return false;
        }
    }
    return true;
}

function lock() {
    const { shape, color, x, y } = currentPiece;
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const ny = y + r;
            if (ny < 0) {
                gameOver();
                return;
            }
            board[ny][x + c] = color;
        }
    }
    clearLines();
    spawnPiece();
}

function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            cleared++;
            r++;
        }
    }
    if (cleared > 0) {
        const points = [0, 100, 300, 500, 800];
        score += points[cleared] * level;
        lines += cleared;
        level = Math.floor(lines / 10) + 1;
        updateDisplay();
        updateSpeed();
    }
}

function updateSpeed() {
    if (gameInterval) clearInterval(gameInterval);
    const speed = Math.max(100, 800 - (level - 1) * 80);
    gameInterval = setInterval(tick, speed);
}

function spawnPiece() {
    currentPiece = nextPiece || randomPiece();
    nextPiece = randomPiece();
    drawNext();
    if (!isValid(currentPiece)) {
        gameOver();
    }
}

function tick() {
    if (paused) return;
    if (isValid(currentPiece, 0, 1)) {
        currentPiece.y++;
    } else {
        lock();
    }
    draw();
}

function hardDrop() {
    while (isValid(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 2;
    }
    lock();
    draw();
    updateDisplay();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c]) {
                drawBlock(ctx, c, r, COLORS[board[r][c]], BLOCK_SIZE);
            }
        }
    }

    if (currentPiece) {
        let ghostY = currentPiece.y;
        while (isValid(currentPiece, 0, ghostY - currentPiece.y + 1)) {
            ghostY++;
        }
        const { shape, x } = currentPiece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect((x + c) * BLOCK_SIZE, (ghostY + r) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    drawBlock(ctx, x + c, currentPiece.y + r, COLORS[currentPiece.color], BLOCK_SIZE);
                }
            }
        }
    }
}

function drawBlock(context, x, y, color, size) {
    const px = x * size;
    const py = y * size;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.fillRect(px + 1, py + 1, size - 2, 3);
    context.fillRect(px + 1, py + 1, 3, size - 2);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(px + size - 3, py + 1, 2, size - 2);
    context.fillRect(px + 1, py + size - 3, size - 2, 2);
}

function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    const { shape, color } = nextPiece;
    const size = 25;
    const offsetX = (nextCanvas.width - shape[0].length * size) / 2;
    const offsetY = (nextCanvas.height - shape.length * size) / 2;
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
                const px = offsetX + c * size;
                const py = offsetY + r * size;
                nextCtx.fillStyle = COLORS[color];
                nextCtx.fillRect(px + 1, py + 1, size - 2, size - 2);
                nextCtx.fillStyle = 'rgba(255,255,255,0.3)';
                nextCtx.fillRect(px + 1, py + 1, size - 2, 3);
                nextCtx.fillRect(px + 1, py + 1, 3, size - 2);
            }
        }
    }
}

function updateDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
}

function gameOver() {
    gameRunning = false;
    clearInterval(gameInterval);
    TetrisMusic.stop();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.add('active');
    if (musicBtn) musicBtn.textContent = '🔇 OFF';
}

function startGame() {
    createBoard();
    score = 0;
    level = 1;
    lines = 0;
    paused = false;
    gameRunning = true;
    updateDisplay();
    document.getElementById('gameOver').classList.remove('active');
    spawnPiece();
    draw();
    updateSpeed();
}

document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;

    if (e.key === 'p' || e.key === 'P') {
        paused = !paused;
        return;
    }
    if (paused) return;

    switch (e.key) {
        case 'ArrowLeft':
            if (isValid(currentPiece, -1, 0)) currentPiece.x--;
            break;
        case 'ArrowRight':
            if (isValid(currentPiece, 1, 0)) currentPiece.x++;
            break;
        case 'ArrowDown':
            if (isValid(currentPiece, 0, 1)) {
                currentPiece.y++;
                score += 1;
                updateDisplay();
            }
            break;
        case 'ArrowUp':
            const rotated = rotate(currentPiece.shape);
            if (isValid(currentPiece, 0, 0, rotated)) {
                currentPiece.shape = rotated;
            }
            break;
        case ' ':
            hardDrop();
            break;
    }
    e.preventDefault();
    draw();
});

document.getElementById('restartBtn').addEventListener('click', startGame);

const musicBtn = document.getElementById('musicToggle');
musicBtn.addEventListener('click', () => {
    const playing = TetrisMusic.toggle();
    musicBtn.textContent = playing ? '🔊 ON' : '🔇 OFF';
});

function startWithMusic() {
    startGame();
    TetrisMusic.start();
    musicBtn.textContent = '🔊 ON';
}

startWithMusic();
