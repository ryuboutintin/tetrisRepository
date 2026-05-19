/**
 * Board state and rendering helpers.
 * The board is a 2D array of either 0 (empty) or a color string.
 */
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function drawCell(ctx, x, y, color) {
    const px = x * BLOCK;
    const py = y * BLOCK;

    ctx.fillStyle = color;
    ctx.fillRect(px, py, BLOCK, BLOCK);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(px, py, BLOCK, 4);
    ctx.fillRect(px, py, 4, BLOCK);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(px, py + BLOCK - 4, BLOCK, 4);
    ctx.fillRect(px + BLOCK - 4, py, 4, BLOCK);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, BLOCK - 1, BLOCK - 1);
}

function drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(120, 144, 220, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK + 0.5, 0);
        ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
        ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK + 0.5);
        ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
        ctx.stroke();
    }
}

function drawBoard(ctx, board) {
    ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    drawGrid(ctx);
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                drawCell(ctx, x, y, board[y][x]);
            }
        }
    }
}

function drawPiece(ctx, piece) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                drawCell(ctx, piece.x + x, piece.y + y, piece.color);
            }
        }
    }
}

function drawNext(ctx, piece) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!piece) return;

    const size = piece.shape.length;
    const cell = Math.floor(ctx.canvas.width / 5);
    const offsetX = Math.floor((ctx.canvas.width - size * cell) / 2);
    const offsetY = Math.floor((ctx.canvas.height - size * cell) / 2);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!piece.shape[y][x]) continue;
            const px = offsetX + x * cell;
            const py = offsetY + y * cell;

            ctx.fillStyle = piece.color;
            ctx.fillRect(px, py, cell, cell);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(px, py, cell, 3);
            ctx.fillRect(px, py, 3, cell);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(px, py + cell - 3, cell, 3);
            ctx.fillRect(px + cell - 3, py, 3, cell);

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
        }
    }
}

function collides(board, piece) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (!piece.shape[y][x]) continue;
            const bx = piece.x + x;
            const by = piece.y + y;
            if (bx < 0 || bx >= COLS || by >= ROWS) return true;
            if (by >= 0 && board[by][bx]) return true;
        }
    }
    return false;
}

function lockPiece(board, piece) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x] && piece.y + y >= 0) {
                board[piece.y + y][piece.x + x] = piece.color;
            }
        }
    }
}

function clearLines(board) {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            cleared++;
            y++;
        }
    }
    return cleared;
}
