import { useState, useRef, useEffect, useCallback } from "react";
import { synthesizeDrum, renderToWav } from "../../utils/audioHelpers.js";

const INSTRUMENTS = ["kick", "snare", "hihat", "clap"];
const STEPS = 16;
const COLORS = {
  kick: "#ff4444",
  snare: "#44aaff",
  hihat: "#ffaa00",
  clap: "#aa44ff",
};

export default function BeatSequencer() {
  const [grid, setGrid] = useState(() =>
    INSTRUMENTS.map(() => new Array(STEPS).fill(false))
  );
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const audioContextRef = useRef(null);
  const buffersRef = useRef({});
  const timerRef = useRef(null);
  const stepRef = useRef(0);
  const nextNoteTimeRef = useRef(0);
  const gridRef = useRef(grid);

  // Keep gridRef in sync
  useEffect(() => { gridRef.current = grid; }, [grid]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      // Pre-synthesize drum sounds
      INSTRUMENTS.forEach(inst => {
        buffersRef.current[inst] = synthesizeDrum(audioContextRef.current, inst);
      });
    }
    return audioContextRef.current;
  }, []);

  const toggleCell = (row, col) => {
    setGrid(prev => {
      const updated = prev.map(r => [...r]);
      updated[row][col] = !updated[row][col];
      return updated;
    });
  };

  const scheduleNote = (ctx, instrumentIndex, time) => {
    const inst = INSTRUMENTS[instrumentIndex];
    const buffer = buffersRef.current[inst];
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(time);
  };

  const scheduler = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const secondsPerStep = 60 / bpm / 4; // 16th notes
    const lookahead = 0.1; // seconds

    while (nextNoteTimeRef.current < ctx.currentTime + lookahead) {
      const step = stepRef.current;
      const currentGrid = gridRef.current;

      // Schedule active instruments for this step
      INSTRUMENTS.forEach((_, instIdx) => {
        if (currentGrid[instIdx][step]) {
          scheduleNote(ctx, instIdx, nextNoteTimeRef.current);
        }
      });

      // Update visual step (approximate)
      const stepToShow = step;
      setTimeout(() => setCurrentStep(stepToShow), (nextNoteTimeRef.current - ctx.currentTime) * 1000);

      nextNoteTimeRef.current += secondsPerStep;
      stepRef.current = (stepRef.current + 1) % STEPS;
    }
  }, [bpm]);

  const handlePlay = () => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    stepRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime;
    setIsPlaying(true);

    timerRef.current = setInterval(scheduler, 25);
  };

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
    setCurrentStep(-1);
    stepRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Restart scheduler when BPM changes during playback
  useEffect(() => {
    if (isPlaying && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(scheduler, 25);
    }
  }, [bpm, isPlaying, scheduler]);

  const handleClear = () => {
    handleStop();
    setGrid(INSTRUMENTS.map(() => new Array(STEPS).fill(false)));
  };

  const handleExport = async () => {
    const ctx = getAudioContext();
    const secondsPerStep = 60 / bpm / 4;
    const totalDuration = secondsPerStep * STEPS;
    const sampleRate = ctx.sampleRate;

    const offline = new OfflineAudioContext(1, sampleRate * totalDuration, sampleRate);

    // Re-synthesize drums for offline context
    const offlineBuffers = {};
    INSTRUMENTS.forEach(inst => {
      offlineBuffers[inst] = synthesizeDrum(offline, inst);
    });

    for (let step = 0; step < STEPS; step++) {
      INSTRUMENTS.forEach((inst, instIdx) => {
        if (grid[instIdx][step]) {
          const source = offline.createBufferSource();
          source.buffer = offlineBuffers[inst];
          source.connect(offline.destination);
          source.start(step * secondsPerStep);
        }
      });
    }

    const rendered = await offline.startRendering();
    const blob = renderToWav(rendered);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beat_export.wav";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h3>Beat Sequencer</h3>
      <p style={{ fontSize: "13px", color: "#888" }}>Click cells to toggle beats. 16 steps per bar.</p>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px" }}>
        <button onClick={isPlaying ? handleStop : handlePlay} style={{ padding: "6px 16px", cursor: "pointer" }}>
          {isPlaying ? "Stop" : "Play"}
        </button>
        <button onClick={handleClear} style={{ padding: "6px 16px", cursor: "pointer" }}>Clear</button>
        <button onClick={handleExport} style={{ padding: "6px 16px", cursor: "pointer" }}>Export</button>

        <span style={{ marginLeft: "15px", fontSize: "13px" }}>BPM</span>
        <input type="range" min={60} max={200} value={bpm}
          onChange={e => setBpm(parseInt(e.target.value))}
          style={{ width: "100px", accentColor: "#646cff" }} />
        <input type="number" min={60} max={200} value={bpm}
          onChange={e => { const v = parseInt(e.target.value); if (v >= 60 && v <= 200) setBpm(v); }}
          style={{ width: "50px", padding: "3px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "3px" }} />
      </div>

      {/* Grid */}
      <div style={{ overflowX: "auto" }}>
        {/* Step indicators */}
        <div style={{ display: "flex", gap: "3px", marginBottom: "4px", paddingLeft: "60px" }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} style={{
              width: "32px", textAlign: "center", fontSize: "10px",
              color: currentStep === i ? "#fff" : "#555",
              fontWeight: currentStep === i ? "bold" : "normal",
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {INSTRUMENTS.map((inst, row) => (
          <div key={inst} style={{ display: "flex", gap: "3px", marginBottom: "3px", alignItems: "center" }}>
            <span style={{
              width: "55px", fontSize: "12px", textTransform: "capitalize",
              color: COLORS[inst], fontWeight: "bold"
            }}>
              {inst}
            </span>
            {Array.from({ length: STEPS }, (_, col) => (
              <div
                key={col}
                onClick={() => toggleCell(row, col)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  background: grid[row][col] ? COLORS[inst] : (col % 4 === 0 ? "#333" : "#222"),
                  border: currentStep === col ? "2px solid #fff" : "1px solid #444",
                  opacity: grid[row][col] ? 1 : 0.6,
                  transition: "background 0.05s",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
