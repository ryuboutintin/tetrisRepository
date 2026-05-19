const canvas = document.getElementById('blocks-canvas');
const ctx = canvas.getContext('2d');
const S = 30;
const GAP = 16;

const PIECES = [
  { shape: [[1,1,1,1]],          color: '#00cfcf' },
  { shape: [[1,1],[1,1]],         color: '#f0c040' },
  { shape: [[0,1,0],[1,1,1]],     color: '#a040f0' },
  { shape: [[0,1,1],[1,1,0]],     color: '#40c040' },
  { shape: [[1,1,0],[0,1,1]],     color: '#e03030' },
  { shape: [[1,0,0],[1,1,1]],     color: '#4080f0' },
  { shape: [[0,0,1],[1,1,1]],     color: '#f07020' },
];

const totalWidth = PIECES.reduce((w, p) => w + p.shape[0].length * S + GAP, -GAP);
let ox = Math.floor((canvas.width - totalWidth) / 2);

PIECES.forEach(({ shape, color }) => {
  const cols = shape[0].length;
  const rows = shape.length;
  const oy = Math.floor((canvas.height - rows * S) / 2);

  shape.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      const x = ox + c * S, y = oy + r * S;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, S - 2, S - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + 1, y + 1, S - 2, 5);
    })
  );
  ox += cols * S + GAP;
});
