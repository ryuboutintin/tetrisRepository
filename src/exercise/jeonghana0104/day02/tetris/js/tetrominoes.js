/**
 * Tetromino definitions.
 * STANDARD: classic 7 pieces (I, O, T, S, Z, L, J).
 * BONUS: extra pieces sprinkled in for variety (PLUS, U, BAR3).
 * All shapes are square matrices so rotateMatrix() works uniformly.
 */
const TETROMINOES = {
    I:    { color: '#3ae0ee', shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
    O:    { color: '#f5d23a', shape: [[1,1],[1,1]] },
    T:    { color: '#b870f5', shape: [[0,1,0],[1,1,1],[0,0,0]] },
    S:    { color: '#5ce26b', shape: [[0,1,1],[1,1,0],[0,0,0]] },
    Z:    { color: '#ef5b6a', shape: [[1,1,0],[0,1,1],[0,0,0]] },
    L:    { color: '#f59a3a', shape: [[0,0,1],[1,1,1],[0,0,0]] },
    J:    { color: '#5b8bef', shape: [[1,0,0],[1,1,1],[0,0,0]] },
    PLUS: { color: '#ff6dde', shape: [[0,1,0],[1,1,1],[0,1,0]] },
    U:    { color: '#ffd166', shape: [[1,0,1],[1,0,1],[1,1,1]] },
    BAR3: { color: '#7fffd4', shape: [[0,0,0],[1,1,1],[0,0,0]] },
};

const STANDARD_KEYS = ['I','O','T','S','Z','L','J'];
const BONUS_KEYS = ['PLUS','U','BAR3'];
const BONUS_RATE = 0.2;

function makeTetromino(key) {
    const def = TETROMINOES[key];
    return {
        key,
        color: def.color,
        shape: def.shape.map(row => row.slice()),
    };
}

function randomTetromino() {
    const useBonus = Math.random() < BONUS_RATE;
    const pool = useBonus ? BONUS_KEYS : STANDARD_KEYS;
    const key = pool[Math.floor(Math.random() * pool.length)];
    return makeTetromino(key);
}

function rotateMatrix(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            result[x][n - 1 - y] = matrix[y][x];
        }
    }
    return result;
}
