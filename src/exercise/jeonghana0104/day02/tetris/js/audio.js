/**
 * BGM player using Web Audio API.
 * Plays the classic Tetris theme (Korobeiniki — Russian folk song, public domain).
 * Notes are synthesized on the fly with oscillators (no audio files needed).
 *
 * Scheduling pattern: maintain `nextMelodyTime` / `nextBassTime` in AudioContext
 * time, and use a setTimeout-driven look-ahead to queue notes ~150 ms before they
 * need to play. This avoids drift from setTimeout jitter.
 */

const NOTE_FREQ = {
    D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
    A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
    A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
    A5: 880.00, B5: 987.77, C6: 1046.50,
    REST: 0,
};

// Korobeiniki main theme, ~150 BPM (quarter = 0.4s)
const Q = 0.4, EI = 0.2, DQ = 0.6, H = 0.8;

const MELODY = [
    ['E5',Q],['B4',EI],['C5',EI],['D5',Q],['C5',EI],['B4',EI],
    ['A4',Q],['A4',EI],['C5',EI],['E5',Q],['D5',EI],['C5',EI],
    ['B4',DQ],['C5',EI],['D5',Q],['E5',Q],
    ['C5',Q],['A4',Q],['A4',Q],['REST',Q],

    ['D5',Q],['F5',EI],['A5',Q],['G5',EI],['F5',EI],
    ['E5',DQ],['C5',EI],['E5',Q],['D5',EI],['C5',EI],
    ['B4',DQ],['C5',EI],['D5',Q],['E5',Q],
    ['C5',Q],['A4',Q],['A4',Q],['REST',Q],
];

// Simple I-iv-V bass pattern in A minor, 2 half notes per bar.
const BASS = [
    ['A3',H],['A3',H],
    ['A3',H],['A3',H],
    ['E3',H],['E3',H],
    ['A3',H],['A3',H],
    ['D3',H],['D3',H],
    ['A3',H],['A3',H],
    ['E3',H],['E3',H],
    ['A3',H],['A3',H],
];

class BGMPlayer {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.playing = false;
        this.timer = null;
        this.scheduleAhead = 0.15;
        this.lookahead = 25;
        this.melodyIdx = 0;
        this.bassIdx = 0;
        this.nextMelodyTime = 0;
        this.nextBassTime = 0;
    }

    ensureCtx() {
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return false;
            this.ctx = new Ctx();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.5;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return true;
    }

    start() {
        if (!this.ensureCtx()) return;
        if (this.playing) return;
        this.playing = true;
        this.melodyIdx = 0;
        this.bassIdx = 0;
        const t = this.ctx.currentTime + 0.05;
        this.nextMelodyTime = t;
        this.nextBassTime = t;
        this.tick();
    }

    stop() {
        this.playing = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) {
            this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.03);
        }
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    tick() {
        if (!this.playing) return;
        const limit = this.ctx.currentTime + this.scheduleAhead;

        while (this.nextMelodyTime < limit) {
            const [name, dur] = MELODY[this.melodyIdx];
            this.scheduleNote(NOTE_FREQ[name], this.nextMelodyTime, dur, 'square', 0.18);
            this.nextMelodyTime += dur;
            this.melodyIdx = (this.melodyIdx + 1) % MELODY.length;
        }

        while (this.nextBassTime < limit) {
            const [name, dur] = BASS[this.bassIdx];
            this.scheduleNote(NOTE_FREQ[name], this.nextBassTime, dur, 'triangle', 0.22);
            this.nextBassTime += dur;
            this.bassIdx = (this.bassIdx + 1) % BASS.length;
        }

        this.timer = setTimeout(() => this.tick(), this.lookahead);
    }

    scheduleNote(freq, when, dur, type, vol) {
        if (!freq) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, when);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(vol, when + 0.01);
        gain.gain.linearRampToValueAtTime(vol * 0.6, when + dur * 0.7);
        gain.gain.linearRampToValueAtTime(0, when + dur * 0.98);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(when);
        osc.stop(when + dur + 0.05);
    }
}
