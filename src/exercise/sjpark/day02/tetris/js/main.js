const LS_KEY = 'tetris_best';

// ── 최고 점수 ────────────────────────────────────────────────
function loadBest()       { return parseInt(localStorage.getItem(LS_KEY) || '0', 10); }
function saveBest(score)  { localStorage.setItem(LS_KEY, score); }

// ── DOM 참조 ─────────────────────────────────────────────────
const landingEl   = document.getElementById('landing');
const appEl       = document.getElementById('app');
const overlayEl   = document.getElementById('overlay');
const landingBest = document.getElementById('landing-best');
const bestValEl   = document.getElementById('best-val');
const ovScoreEl   = document.getElementById('ov-score');
const ovBestEl    = document.getElementById('ov-best');
const ovRecordEl  = document.getElementById('ov-record');

// ── 화면 전환 헬퍼 ───────────────────────────────────────────
function showLanding() {
  const best = loadBest();
  landingBest.textContent = best.toLocaleString();
  overlayEl.classList.remove('show');
  appEl.classList.add('hidden');
  landingEl.classList.remove('hidden');
}

function showGame() {
  landingEl.classList.add('hidden');
  appEl.classList.remove('hidden');
}

// ── 게임 오버 콜백 ───────────────────────────────────────────
function handleGameOver(finalScore) {
  let best      = loadBest();
  const isRecord = finalScore > best;

  if (isRecord) {
    best = finalScore;
    saveBest(best);
    bestValEl.textContent = best.toLocaleString();
    landingBest.textContent = best.toLocaleString();
  }

  ovScoreEl.textContent = finalScore.toLocaleString();
  ovBestEl.textContent  = best.toLocaleString();
  ovRecordEl.classList.toggle('hidden', !isRecord);
  overlayEl.classList.add('show');
}

// ── 게임 인스턴스 ────────────────────────────────────────────
let game;

function initGame() {
  const best = loadBest();
  bestValEl.textContent = best.toLocaleString();

  game = new Game(
    document.getElementById('game-canvas'),
    document.getElementById('next-canvas'),
    {
      score: document.getElementById('score-val'),
      best:  bestValEl,
      lines: document.getElementById('lines-val'),
      level: document.getElementById('level-val'),
    },
    handleGameOver
  );
}

function startGame() {
  overlayEl.classList.remove('show');
  showGame();
  game.start();
}

// ── 이벤트 바인딩 ────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', () => {
  overlayEl.classList.remove('show');
  game.start();
});
document.getElementById('home-btn').addEventListener('click', showLanding);

window.addEventListener('load', () => {
  initGame();
  showLanding();
});
