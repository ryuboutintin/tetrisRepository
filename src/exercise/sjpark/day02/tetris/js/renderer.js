class Renderer {
  constructor(gameCanvas, nextCanvas) {
    this.ctx  = gameCanvas.getContext('2d');
    this.nctx = nextCanvas.getContext('2d');
    this.gameCanvas = gameCanvas;
    this.nextCanvas = nextCanvas;
  }

  _cell(ctx, c, r, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, 4);
    ctx.globalAlpha = 1;
  }

  _piece(ctx, shape, px, py, color, alpha) {
    shape.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell) this._cell(ctx, px + c, py + r, color, alpha);
      })
    );
  }

  drawBoard(board, current) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);

    // 격자
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);

    // 고정된 블록
    board.grid.forEach((row, r) =>
      row.forEach((color, c) => { if (color) this._cell(ctx, c, r, color); })
    );

    // 고스트 피스
    let ghostY = current.y;
    while (!board.collides(current, 0, ghostY - current.y + 1)) ghostY++;
    if (ghostY !== current.y)
      this._piece(ctx, current.shape, current.x, ghostY, current.color, 0.22);

    // 현재 피스
    this._piece(ctx, current.shape, current.x, current.y, current.color, 1);
  }

  drawNext(next) {
    const ctx = this.nctx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    const s    = next.shape;
    const offX = Math.floor((4 - s[0].length) / 2);
    const offY = Math.floor((4 - s.length)    / 2);
    this._piece(ctx, s, offX, offY, next.color, 1);
  }
}
