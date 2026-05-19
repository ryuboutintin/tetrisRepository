/**
 * Core game state and loop.
 * Scoring: 1/2/3/4 lines -> 100/300/500/800 (× level).
 * Hold: C-key swaps current piece with held piece; locked once per spawn.
 */
const LINE_SCORES = [0, 100, 300, 500, 800];

class TetrisGame {
    constructor(boardCtx, nextCtx, holdCtx, ui, audio) {
        this.boardCtx = boardCtx;
        this.nextCtx = nextCtx;
        this.holdCtx = holdCtx;
        this.ui = ui;
        this.audio = audio;
        this.reset();
    }

    reset() {
        this.board = createBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 800;
        this.lastDrop = 0;
        this.current = null;
        this.next = randomTetromino();
        this.held = null;
        this.holdLocked = false;
        this.running = false;
        this.paused = false;
        this.gameOver = false;
    }

    start() {
        this.reset();
        this.spawnPiece();
        this.running = true;
        this.paused = false;
        this.gameOver = false;
        this.lastDrop = performance.now();
        if (this.audio) this.audio.start();
        this.updateUI();
        this.render();
    }

    spawnPiece() {
        this.current = this.next;
        this.current.x = Math.floor((COLS - this.current.shape[0].length) / 2);
        this.current.y = -1;
        this.next = randomTetromino();
        this.holdLocked = false;
        if (collides(this.board, this.current)) {
            this.endGame();
        }
    }

    endGame() {
        this.running = false;
        this.gameOver = true;
        if (this.audio) this.audio.stop();
        this.ui.showOverlay('GAME OVER', `Final Score: ${this.score}`);
    }

    hold() {
        if (!this.running || this.paused) return;
        if (this.holdLocked) return;

        const currentKey = this.current.key;
        if (this.held === null) {
            this.held = makeTetromino(currentKey);
            this.spawnPiece();
        } else {
            const swapped = makeTetromino(this.held.key);
            swapped.x = Math.floor((COLS - swapped.shape[0].length) / 2);
            swapped.y = -1;
            this.held = makeTetromino(currentKey);
            this.current = swapped;
            if (collides(this.board, this.current)) {
                this.endGame();
                return;
            }
        }
        this.holdLocked = true;
    }

    move(dx) {
        if (!this.running || this.paused) return;
        this.current.x += dx;
        if (collides(this.board, this.current)) {
            this.current.x -= dx;
        }
    }

    rotate() {
        if (!this.running || this.paused) return;
        const original = this.current.shape;
        this.current.shape = rotateMatrix(this.current.shape);
        if (collides(this.board, this.current)) {
            this.current.shape = original;
        }
    }

    softDrop() {
        if (!this.running || this.paused) return;
        this.current.y++;
        if (collides(this.board, this.current)) {
            this.current.y--;
            this.lockAndAdvance();
        } else {
            this.score += 1;
        }
        this.lastDrop = performance.now();
    }

    hardDrop() {
        if (!this.running || this.paused) return;
        let dropped = 0;
        while (!collides(this.board, this.current)) {
            this.current.y++;
            dropped++;
        }
        this.current.y--;
        this.score += Math.max(0, dropped - 1) * 2;
        this.lockAndAdvance();
        this.lastDrop = performance.now();
    }

    lockAndAdvance() {
        lockPiece(this.board, this.current);
        const cleared = clearLines(this.board);
        if (cleared > 0) {
            this.score += LINE_SCORES[cleared] * this.level;
            this.lines += cleared;
            const newLevel = Math.floor(this.lines / 10) + 1;
            if (newLevel !== this.level) {
                this.level = newLevel;
                this.dropInterval = Math.max(100, 800 - (this.level - 1) * 70);
            }
        }
        this.spawnPiece();
    }

    togglePause() {
        if (!this.running) return;
        this.paused = !this.paused;
        if (this.paused) {
            this.ui.showOverlay('PAUSED', 'Press P to resume');
        } else {
            this.ui.hideOverlay();
            this.lastDrop = performance.now();
        }
    }

    tick(now) {
        if (!this.running || this.paused) return;
        if (now - this.lastDrop >= this.dropInterval) {
            this.current.y++;
            if (collides(this.board, this.current)) {
                this.current.y--;
                this.lockAndAdvance();
            }
            this.lastDrop = now;
        }
    }

    render() {
        drawBoard(this.boardCtx, this.board);
        if (this.current) drawPiece(this.boardCtx, this.current);
        drawNext(this.nextCtx, this.next);
        if (this.holdCtx) drawNext(this.holdCtx, this.held);
        this.updateUI();
    }

    updateUI() {
        this.ui.setScore(this.score);
        this.ui.setLines(this.lines);
        this.ui.setLevel(this.level);
    }
}
