const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const finalScoreElement = document.getElementById('final-score');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');

context.scale(20, 20);
nextContext.scale(20, 20);

// Colors & Pieces
const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

function createPiece(type) {
    const pieces = {
        'I': [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
        'L': [[0, 5, 0], [0, 5, 0], [0, 5, 5]],
        'J': [[0, 7, 0], [0, 7, 0], [7, 7, 0]],
        'O': [[6, 6], [6, 6]],
        'Z': [[4, 4, 0], [0, 4, 4], [0, 0, 0]],
        'S': [[0, 3, 3], [3, 3, 0], [0, 0, 0]],
        'T': [[0, 1, 0], [1, 1, 1], [0, 0, 0]]
    };
    return pieces[type];
}

// State
let arena = createMatrix(12, 20);
let player = { pos: {x: 0, y: 0}, matrix: null, score: 0, level: 1 };
let nextPieceMatrix = null;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = true;

function getNextPiece() {
    const pieces = 'ILJOTSZ';
    return createPiece(pieces[pieces.length * Math.random() | 0]);
}

// UI Handlers
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

function startGame() {
    arena = createMatrix(12, 20);
    player.score = 0;
    player.level = 1;
    dropInterval = 1000;
    updateScore();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    nextPieceMatrix = getNextPiece();
    playerReset();
    isPaused = false;
    requestAnimationFrame(update);
}

function endGame() {
    isPaused = true;
    finalScoreElement.innerText = player.score;
    gameOverScreen.classList.remove('hidden');
}

// Logic (Reuse existing functions with minor tweaks)
function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const cx = x + offset.x;
                const cy = y + offset.y;
                const color = colors[value];
                
                // Main block body
                ctx.fillStyle = color;
                ctx.fillRect(cx, cy, 1, 1);
                
                // Highlight (Top/Left for 3D effect)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(cx, cy, 1, 0.15); // Top
                ctx.fillRect(cx, cy, 0.15, 1); // Left
                
                // Shadow (Bottom/Right for 3D effect)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(cx, cy + 0.85, 1, 0.15); // Bottom
                ctx.fillRect(cx + 0.85, cy, 0.15, 1); // Right
            }
        });
    });
}

function drawNextPiece() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPieceMatrix) return;
    
    // Center the piece
    const offsetX = (nextCanvas.width/20 - nextPieceMatrix[0].length) / 2;
    const offsetY = (nextCanvas.height/20 - nextPieceMatrix.length) / 2;
    
    drawMatrix(nextPieceMatrix, {x: offsetX, y: offsetY}, nextContext);
}

function drawGrid() {
    context.strokeStyle = '#222';
    context.lineWidth = 0.05;
    for (let x = 0; x <= 12; x++) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 20);
        context.stroke();
    }
    for (let y = 0; y <= 20; y++) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(12, y);
        context.stroke();
    }
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawMatrix(arena, {x: 0, y: 0}, context);
    drawMatrix(player.matrix, player.pos, context);
    drawNextPiece();
}

function playerReset() {
    player.matrix = nextPieceMatrix;
    nextPieceMatrix = getNextPiece();
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    if (collide(arena, player)) {
        endGame();
    }
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        player.score += rowCount * 10;
        if (player.score >= player.level * 100) {
            player.level++;
            // Exponential speed increase: 1000ms base, 15% reduction per level, min 50ms
            dropInterval = Math.max(50, 1000 * Math.pow(0.85, player.level - 1));
        }
        rowCount *= 2;
    }
}

function updateScore() {
    scoreElement.innerText = player.score;
    levelElement.innerText = player.level;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function update(time = 0) {
    if (isPaused) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    if (isPaused) return;
    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate(1);
});
