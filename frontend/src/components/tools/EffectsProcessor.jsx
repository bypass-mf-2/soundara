import { useState, useRef, useCallback } from "react";
import { loadAudioBuffer, renderToWav, generateImpulseResponse } from "../../utils/audioHelpers.js";

export default function EffectsProcessor() {
  const [fileName, setFileName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [effects, setEffects] = useState({
    reverb: { enabled: false, decay: 2, duration: 2 },
    delay: { enabled: false, time: 0.3, feedback: 0.4 },
    eq: { enabled: false, type: "peaking", frequency: 1000, gain: 0 },
    distortion: { enabled: false, amount: 50 },
  });

  const audioContextRef = useRef(null);
  const bufferRef = useRef(null);
  const sourceRef = useRef(null);
  const nodesRef = useRef({});

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const handleFileLoad = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ctx = getAudioContext();
    try {
      bufferRef.current = await loadAudioBuffer(file, ctx);
      setFileName(file.name);
    } catch (err) {
      alert("Failed to load audio: " + err.message);
    }
    e.target.value = "";
  };

  const updateEffect = (name, key, value) => {
    setEffects(prev => ({
      ...prev,
      [name]: { ...prev[name], [key]: value },
    }));
  };

  const buildEffectsChain = (ctx, destination) => {
    let lastNode = destination;
    const nodes = {};

    // Distortion (first in chain = last connected)
    if (effects.distortion.enabled) {
      const shaper = ctx.createWaveShaper();
      const amount = effects.distortion.amount;
      const samples = 44100;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = "4x";
      shaper.connect(lastNode);
      lastNode = shaper;
      nodes.distortion = shaper;
    }

    // EQ
    if (effects.eq.enabled) {
      const filter = ctx.createBiquadFilter();
      filter.type = effects.eq.type;
      filter.frequency.value = effects.eq.frequency;
      filter.gain.value = effects.eq.gain;
      filter.Q.value = 1;
      filter.connect(lastNode);
      lastNode = filter;
      nodes.eq = filter;
    }

    // Delay
    if (effects.delay.enabled) {
      const delay = ctx.createDelay(5);
      delay.delayTime.value = effects.delay.time;
      const feedbackGain = ctx.createGain();
      feedbackGain.gain.value = effects.delay.feedback;
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.5;

      // Dry path
      dryGain.connect(lastNode);
      // Wet path
      delay.connect(wetGain);
      wetGain.connect(lastNode);
      // Feedback loop
      delay.connect(feedbackGain);
      feedbackGain.connect(delay);

      // Create a splitter node
      const split = ctx.createGain();
      split.connect(dryGain);
      split.connect(delay);
      lastNode = split;
      nodes.delay = { delay, feedbackGain, dryGain, wetGain, split };
    }

    // Reverb
    if (effects.reverb.enabled) {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulseResponse(ctx, effects.reverb.duration, effects.reverb.decay);
      const dryGain = ctx.createGain();
      dryGain.gain.value = 0.7;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.3;

      dryGain.connect(lastNode);
      convolver.connect(wetGain);
      wetGain.connect(lastNode);

      const split = ctx.createGain();
      split.connect(dryGain);
      split.connect(convolver);
      lastNode = split;
      nodes.reverb = { convolver, dryGain, wetGain, split };
    }

    nodesRef.current = nodes;
    return lastNode;
  };

  const handlePlay = () => {
    if (!bufferRef.current) return;
    handleStop();

    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    const chainInput = buildEffectsChain(ctx, ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = bufferRef.current;
    source.connect(chainInput);
    source.onended = () => setIsPlaying(false);
    source.start(0);
    sourceRef.current = source;
    setIsPlaying(true);
  };

  const handleStop = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleExport = async () => {
    if (!bufferRef.current) return;
    const buffer = bufferRef.current;
    const sampleRate = buffer.sampleRate;
    const duration = buffer.duration + (effects.reverb.enabled ? effects.reverb.duration : 0) + (effects.delay.enabled ? 2 : 0);
    const offline = new OfflineAudioContext(buffer.numberOfChannels, sampleRate * duration, sampleRate);

    const chainInput = buildEffectsChain(offline, offline.destination);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(chainInput);
    source.start(0);

    const rendered = await offline.startRendering();
    const blob = renderToWav(rendered);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "effects_export.wav";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sliderStyle = { width: "120px", accentColor: "#646cff" };
  const sectionStyle = {
    border: "1px solid #444", borderRadius: "6px", padding: "12px",
    marginBottom: "10px", background: "#1e1e1e"
  };

  return (
    <div>
      <h3>Effects Processor</h3>
      <p style={{ fontSize: "13px", color: "#888" }}>Load a track and apply real-time effects.</p>

      {/* File load */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px" }}>
        <label style={{
          padding: "6px 14px", border: "2px dashed #555", borderRadius: "6px",
          cursor: "pointer", color: "#888", fontSize: "13px"
        }}>
          Load Audio
          <input type="file" accept="audio/*" onChange={handleFileLoad} style={{ display: "none" }} />
        </label>
        {fileName && <span style={{ fontSize: "13px", color: "#ccc" }}>{fileName}</span>}

        <button onClick={handlePlay} disabled={!bufferRef.current || isPlaying} style={{ padding: "6px 16px", cursor: "pointer" }}>
          Play
        </button>
        <button onClick={handleStop} disabled={!isPlaying} style={{ padding: "6px 16px", cursor: "pointer" }}>
          Stop
        </button>
        <button onClick={handleExport} disabled={!bufferRef.current} style={{ padding: "6px 16px", cursor: "pointer" }}>
          Export
        </button>
      </div>

      {/* Reverb */}
      <div style={sectionStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={effects.reverb.enabled}
            onChange={e => updateEffect("reverb", "enabled", e.target.checked)} />
          <strong>Reverb</strong>
        </label>
        {effects.reverb.enabled && (
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "12px" }}>
            <div>
              <label>Duration: {effects.reverb.duration.toFixed(1)}s</label>
              <input type="range" min={0.5} max={5} step={0.1} value={effects.reverb.duration}
                onChange={e => updateEffect("reverb", "duration", parseFloat(e.target.value))} style={sliderStyle} />
            </div>
            <div>
              <label>Decay: {effects.reverb.decay.toFixed(1)}</label>
              <input type="range" min={0.5} max={5} step={0.1} value={effects.reverb.decay}
                onChange={e => updateEffect("reverb", "decay", parseFloat(e.target.value))} style={sliderStyle} />
            </div>
          </div>
        )}
      </div>

      {/* Delay */}
      <div style={sectionStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={effects.delay.enabled}
            onChange={e => updateEffect("delay", "enabled", e.target.checked)} />
          <strong>Delay</strong>
        </label>
        {effects.delay.enabled && (
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "12px" }}>
            <div>
              <label>Time: {effects.delay.time.toFixed(2)}s</label>
              <input type="range" min={0.05} max={1} step={0.01} value={effects.delay.time}
                onChange={e => updateEffect("delay", "time", parseFloat(e.target.value))} style={sliderStyle} />
            </div>
            <div>
              <label>Feedback: {Math.round(effects.delay.feedback * 100)}%</label>
              <input type="range" min={0} max={0.9} step={0.01} value={effects.delay.feedback}
                onChange={e => updateEffect("delay", "feedback", parseFloat(e.target.value))} style={sliderStyle} />
            </div>
          </div>
        )}
      </div>

      {/* EQ */}
      <div style={sectionStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={effects.eq.enabled}
            onChange={e => updateEffect("eq", "enabled", e.target.checked)} />
          <strong>EQ</strong>
        </label>
        {effects.eq.enabled && (
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "12px" }}>
            <div>
              <label>Type</label>
              <select value={effects.eq.type} onChange={e => updateEffect("eq", "type", e.target.value)}
                style={{ background: "#2a2a2a", color: "#fff", border: "1px solid #555", padding: "3px", borderRadius: "3px" }}>
                <option value="lowpass">Lowpass</option>
                <option value="highpass">Highpass</option>
                <option value="bandpass">Bandpass</option>
                <option value="peaking">Peaking</option>
                <option value="lowshelf">Low Shelf</option>
                <option value="highshelf">High Shelf</option>
              </select>
            </div>
            <div>
              <label>Freq: {effects.eq.frequency}Hz</label>
              <input type="range" min={20} max={20000} step={1} value={effects.eq.frequency}
                onChange={e => updateEffect("eq", "frequency", parseInt(e.target.value))} style={sliderStyle} />
            </div>
            <div>
              <label>Gain: {effects.eq.gain}dB</label>
              <input type="range" min={-24} max={24} step={1} value={effects.eq.gain}
                onChange={e => updateEffect("eq", "gain", parseInt(e.target.value))} style={sliderStyle} />
            </div>
          </div>
        )}
      </div>

      {/* Distortion */}
      <div style={sectionStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={effects.distortion.enabled}
            onChange={e => updateEffect("distortion", "enabled", e.target.checked)} />
          <strong>Distortion</strong>
        </label>
        {effects.distortion.enabled && (
          <div style={{ marginTop: "8px", fontSize: "12px" }}>
            <label>Amount: {effects.distortion.amount}</label>
            <input type="range" min={0} max={100} step={1} value={effects.distortion.amount}
              onChange={e => updateEffect("distortion", "amount", parseInt(e.target.value))} style={sliderStyle} />
          </div>
        )}
      </div>
    </div>
  );
}
