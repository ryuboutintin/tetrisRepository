class Game {
  constructor(gameCanvas, nextCanvas, uiEls, onGameOver) {
    this.board      = new Board();
    this.renderer   = new Renderer(gameCanvas, nextCanvas);
    this.ui         = uiEls; // { score, best, lines, level }
    this.onGameOver = onGameOver; // callback(finalScore)
    this.input      = new Input({
      onLeft:  () => this._moveLeft(),
      onRight: () => this._moveRight(),
      onDown:  () => this._softDrop(),
      onUp:    () => this._rotate(),
      onSpace: () => this._hardDrop(),
    });

    this._rafId = null;
  }

  start() {
    this.board.reset();
    this.score        = 0;
    this.lines        = 0;
    this.level        = 1;
    this.gameOver     = false;
    this.dropInterval = 800;
    this.lastDrop     = performance.now();
    this.current      = this.board.spawn();
    this.next         = this.board.spawn();

    this.input.bind();
    this._updateUI();
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  // ── 이동 ────────────────────────────────────────────────────
  _moveLeft()  { if (!this.board.collides(this.current, -1)) this.current.x--; }
  _moveRight() { if (!this.board.collides(this.current,  1)) this.current.x++; }

  _softDrop() {
    if (!this.board.collides(this.current, 0, 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this._lock();
    }
    this.lastDrop = performance.now();
    this._updateUI();
  }

  _hardDrop() {
    while (!this.board.collides(this.current, 0, 1)) {
      this.current.y++;
      this.score += 2;
    }
    this._lock();
    this.lastDrop = performance.now();
    this._updateUI();
  }

  _rotate() {
    const rotated = rotate(this.current.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this.board.collides(this.current, kick, 0, rotated)) {
        this.current.shape  = rotated;
        this.current.x     += kick;
        return;
      }
    }
  }

  // ── 고정 ────────────────────────────────────────────────────
  _lock() {
    const { overflow, cleared } = this.board.lock(this.current);

    if (overflow) { this._endGame(); return; }

    if (cleared > 0) {
      const pts = [0, 100, 300, 500, 800][cleared] * this.level;
      this.score += pts;
      this.lines += cleared;
      this.level        = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 800 - (this.level - 1) * 70);
    }

    this.current = this.next;
    this.next    = this.board.spawn();

    if (this.board.collides(this.current, 0, 0)) this._endGame();

    this._updateUI();
  }

  _endGame() {
    this.gameOver = true;
    this.input.unbind();
    if (this.onGameOver) this.onGameOver(this.score);
  }

  // ── 루프 ────────────────────────────────────────────────────
  _loop(now) {
    if (!this.gameOver) {
      if (now - this.lastDrop >= this.dropInterval) {
        if (!this.board.collides(this.current, 0, 1)) {
          this.current.y++;
        } else {
          this._lock();
        }
        this.lastDrop = now;
      }
      this.renderer.drawBoard(this.board, this.current);
      this.renderer.drawNext(this.next);
    }
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  _updateUI() {
    this.ui.score.textContent = this.score.toLocaleString();
    this.ui.lines.textContent = this.lines;
    this.ui.level.textContent = this.level;
  }
}
