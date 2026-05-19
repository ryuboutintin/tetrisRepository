const AudioEngine = (() => {
  let actx = null;
  let masterGain = null;
  let loopTimer = null;
  let playing = false;
  let muted = false;

  const BPM = 144;
  const Q  = 60 / BPM;       // quarter note
  const E  = Q / 2;          // eighth note
  const H  = Q * 2;          // half note
  const DQ = Q * 1.5;        // dotted quarter

  // Korobeiniki (Tetris Theme A) — note frequencies
  const A3=220.00, B3=246.94;
  const C4=261.63, D4=293.66, E4=329.63, F4=349.23, G4=392.00;
  const A4=440.00, B4=493.88;
  const C5=523.25, D5=587.33, E5=659.25, F5=698.46, G5=783.99;
  const A5=880.00;
  const R=0; // rest

  // [frequency, duration]
  const MELODY = [
    // Part A — phrase 1
    [E5,Q],[B4,E],[C5,E],[D5,Q],[C5,E],[B4,E],
    [A4,Q],[A4,E],[C5,E],[E5,Q],[D5,E],[C5,E],
    [B4,DQ],[C5,E],[D5,Q],[E5,Q],
    [C5,Q],[A4,Q],[A4,H],
    // Part A — phrase 2
    [R,E],[D5,E],[F5,Q],[A5,Q],[G5,E],[F5,E],
    [E5,DQ],[C5,E],[E5,Q],[D5,E],[C5,E],
    [B4,Q],[B4,E],[C5,E],[D5,Q],[E5,Q],
    [C5,Q],[A4,Q],[A4,H],
  ];

  // Simple bass line that follows chord roots
  const BASS = [
    [A3,H],[A3,H],
    [A3,H],[A3,H],
    [E4,H],[E4,H],
    [A3,H],[A3,H],
    [D4,H],[D4,H],
    [A3,H],[A3,H],
    [E4,H],[E4,H],
    [A3,H],[A3,H],
  ];

  const TOTAL_SEC = MELODY.reduce((s, [, d]) => s + d, 0);

  function init() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = muted ? 0 : 0.13;
    masterGain.connect(actx.destination);
  }

  function scheduleTrack(notes, type, gainLevel, t0) {
    let t = t0;
    for (const [freq, dur] of notes) {
      if (freq > 0) {
        const osc = actx.createOscillator();
        const env = actx.createGain();
        osc.connect(env);
        env.connect(masterGain);
        osc.type = type;
        osc.frequency.value = freq;
        env.gain.setValueAtTime(gainLevel, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.88);
        osc.start(t);
        osc.stop(t + dur);
      }
      t += dur;
    }
  }

  function scheduleLoop() {
    if (!playing) return;
    const t0 = actx.currentTime + 0.02;
    scheduleTrack(MELODY, 'square', 0.4, t0);
    scheduleTrack(BASS,   'sine',   0.25, t0);
    loopTimer = setTimeout(scheduleLoop, TOTAL_SEC * 1000);
  }

  return {
    play() {
      init();
      if (actx.state === 'suspended') actx.resume();
      if (playing) return;
      playing = true;
      scheduleLoop();
    },

    stop() {
      playing = false;
      clearTimeout(loopTimer);
      if (masterGain) {
        masterGain.gain.setTargetAtTime(0, actx.currentTime, 0.15);
      }
    },

    setMute(val) {
      muted = val;
      if (masterGain) {
        masterGain.gain.setTargetAtTime(muted ? 0 : 0.13, actx.currentTime, 0.1);
      }
    },

    isMuted() { return muted; },
    isPlaying() { return playing; },
  };
})();
