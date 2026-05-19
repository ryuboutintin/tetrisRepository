class Board {
  constructor() {
    this.grid = this._empty();
  }

  _empty() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  reset() {
    this.grid = this._empty();
  }

  spawn() {
    const def = PIECES[Math.floor(Math.random() * PIECES.length)];
    return {
      shape: def.shape,
      color: def.color,
      x: Math.floor(COLS / 2) - Math.floor(def.shape[0].length / 2),
      y: 0,
    };
  }

  collides(piece, dx = 0, dy = 0, shape = piece.shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = piece.x + c + dx;
        const ny = piece.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.grid[ny][nx]) return true;
      }
    }
    return false;
  }

  // 피스를 보드에 고정하고 클리어된 줄 수를 반환
  lock(piece) {
    const { shape, color, x, y } = piece;
    let overflow = false;

    shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        if (y + r < 0) { overflow = true; return; }
        this.grid[y + r][x + c] = color;
      });
    });

    if (overflow) return { overflow: true, cleared: 0 };

    // 완성된 줄 탐색 및 제거
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== null)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // 같은 인덱스 재검사
      }
    }

    return { overflow: false, cleared };
  }
}
