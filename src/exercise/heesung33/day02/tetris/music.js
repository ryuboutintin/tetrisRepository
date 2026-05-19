const TetrisMusic = (() => {
    let audioCtx = null;
    let isPlaying = false;
    let schedulerId = null;
    let currentNote = 0;
    let nextNoteTime = 0;
    let gainNode = null;

    const BPM = 140;
    const NOTE_DURATION = 60 / BPM / 2;

    // Korobeiniki (테트리스 테마) - 음계를 주파수로
    const NOTE_FREQ = {
        'E4': 329.63, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66,
        'C4#': 277.18, 'A3': 220.00, 'A3#': 233.08,
        'E3': 164.81, 'F4': 349.23, 'G4': 392.00,
        'D4#': 311.13, 'B4': 493.88, 'C5': 523.25,
        'REST': 0
    };

    // 테트리스 A타입 멜로디 (Korobeiniki)
    const melody = [
        { note: 'E4', dur: 2 }, { note: 'B3', dur: 1 }, { note: 'C4', dur: 1 },
        { note: 'D4', dur: 2 }, { note: 'C4', dur: 1 }, { note: 'B3', dur: 1 },
        { note: 'A3', dur: 2 }, { note: 'A3', dur: 1 }, { note: 'C4', dur: 1 },
        { note: 'E4', dur: 2 }, { note: 'D4', dur: 1 }, { note: 'C4', dur: 1 },
        { note: 'B3', dur: 2 }, { note: 'B3', dur: 1 }, { note: 'C4', dur: 1 },
        { note: 'D4', dur: 2 }, { note: 'E4', dur: 2 },
        { note: 'C4', dur: 2 }, { note: 'A3', dur: 2 },
        { note: 'A3', dur: 2 }, { note: 'REST', dur: 2 },

        { note: 'REST', dur: 1 }, { note: 'D4', dur: 2 }, { note: 'F4', dur: 1 },
        { note: 'A3', dur: 1 }, { note: 'G4', dur: 1 }, { note: 'F4', dur: 1 },
        { note: 'E4', dur: 3 }, { note: 'C4', dur: 1 },
        { note: 'E4', dur: 2 }, { note: 'D4', dur: 1 }, { note: 'C4', dur: 1 },
        { note: 'B3', dur: 2 }, { note: 'B3', dur: 1 }, { note: 'C4', dur: 1 },
        { note: 'D4', dur: 2 }, { note: 'E4', dur: 2 },
        { note: 'C4', dur: 2 }, { note: 'A3', dur: 2 },
        { note: 'A3', dur: 2 }, { note: 'REST', dur: 2 },
    ];

    // 베이스 라인
    const bassLine = [
        { note: 'E3', dur: 4 }, { note: 'A3', dur: 4 },
        { note: 'A3', dur: 4 }, { note: 'A3', dur: 4 },
        { note: 'E3', dur: 4 }, { note: 'E3', dur: 4 },
        { note: 'A3', dur: 4 }, { note: 'A3', dur: 4 },
        { note: 'E3', dur: 4 }, { note: 'A3', dur: 4 },
    ];

    function init() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.3;
            gainNode.connect(audioCtx.destination);
        }
    }

    function playNote(freq, startTime, duration, type = 'square', volume = 0.3) {
        if (freq === 0) return;

        const osc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        noteGain.gain.setValueAtTime(volume, startTime);
        noteGain.gain.setValueAtTime(volume, startTime + duration * 0.7);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.95);

        osc.connect(noteGain);
        noteGain.connect(gainNode);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    let bassCurrent = 0;
    let bassTime = 0;

    function scheduleNotes() {
        while (nextNoteTime < audioCtx.currentTime + 0.2) {
            const melodyNote = melody[currentNote % melody.length];
            const melodyDuration = melodyNote.dur * NOTE_DURATION;
            const freq = NOTE_FREQ[melodyNote.note];

            playNote(freq, nextNoteTime, melodyDuration, 'square', 0.25);

            // 베이스
            if (bassTime <= nextNoteTime) {
                const bassNote = bassLine[bassCurrent % bassLine.length];
                const bassDuration = bassNote.dur * NOTE_DURATION;
                const bassFreq = NOTE_FREQ[bassNote.note];
                if (bassFreq) {
                    playNote(bassFreq * 0.5, bassTime, bassDuration, 'triangle', 0.2);
                }
                bassTime += bassDuration;
                bassCurrent++;
            }

            nextNoteTime += melodyDuration;
            currentNote++;
        }
    }

    function start() {
        init();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (isPlaying) return;
        isPlaying = true;
        currentNote = 0;
        bassCurrent = 0;
        nextNoteTime = audioCtx.currentTime + 0.1;
        bassTime = nextNoteTime;
        schedulerId = setInterval(scheduleNotes, 100);
    }

    function stop() {
        isPlaying = false;
        if (schedulerId) {
            clearInterval(schedulerId);
            schedulerId = null;
        }
    }

    function toggle() {
        if (isPlaying) {
            stop();
        } else {
            start();
        }
        return isPlaying;
    }

    return { start, stop, toggle, isPlaying: () => isPlaying };
})();
