/**
 * Entry point: wires DOM, input handling, audio toggle, and the main loop.
 */
(function () {
    const boardCanvas = document.getElementById('board');
    const nextCanvas = document.getElementById('next');
    const holdCanvas = document.getElementById('hold');
    const boardCtx = boardCanvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');
    const holdCtx = holdCanvas.getContext('2d');

    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayText = document.getElementById('overlay-text');
    const scoreEl = document.getElementById('score');
    const linesEl = document.getElementById('lines');
    const levelEl = document.getElementById('level');
    const startBtn = document.getElementById('start-btn');
    const audioBtn = document.getElementById('audio-btn');

    const ui = {
        setScore: v => { scoreEl.textContent = v; },
        setLines: v => { linesEl.textContent = v; },
        setLevel: v => { levelEl.textContent = v; },
        showOverlay: (title, text) => {
            overlayTitle.textContent = title;
            overlayText.textContent = text;
            overlay.classList.remove('hidden');
        },
        hideOverlay: () => overlay.classList.add('hidden'),
    };

    const audio = new BGMPlayer();
    const game = new TetrisGame(boardCtx, nextCtx, holdCtx, ui, audio);

    game.render();
    ui.showOverlay('READY', 'Press Start to play');

    function refreshAudioBtn() {
        audioBtn.textContent = audio.muted ? '🔇 BGM' : '🔊 BGM';
        audioBtn.classList.toggle('muted', audio.muted);
    }
    refreshAudioBtn();

    function loop(now) {
        game.tick(now);
        game.render();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    startBtn.addEventListener('click', () => {
        ui.hideOverlay();
        game.start();
    });

    audioBtn.addEventListener('click', () => {
        audio.toggleMute();
        refreshAudioBtn();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'm' || e.key === 'M') {
            audio.toggleMute();
            refreshAudioBtn();
            e.preventDefault();
            return;
        }
        if (!game.running && e.key !== 'p' && e.key !== 'P') return;

        switch (e.key) {
            case 'ArrowLeft':  game.move(-1);   e.preventDefault(); break;
            case 'ArrowRight': game.move(1);    e.preventDefault(); break;
            case 'ArrowDown':  game.softDrop(); e.preventDefault(); break;
            case 'ArrowUp':    game.rotate();   e.preventDefault(); break;
            case ' ':          game.hardDrop(); e.preventDefault(); break;
            case 'c': case 'C': game.hold();        e.preventDefault(); break;
            case 'p': case 'P': game.togglePause(); e.preventDefault(); break;
        }
    });
})();
