import { useState } from "react";

const PRESETS = [
  { id: "gamma", name: "Gamma", hertz: "30-100Hz", desc: "High-level cognitive functioning" },
  { id: "alpha", name: "Alpha", hertz: "8-12Hz", desc: "Relaxed focus & creativity" },
  { id: "beta", name: "Beta", hertz: "12-30Hz", desc: "Alertness & problem-solving" },
  { id: "theta", name: "Theta", hertz: "4-8Hz", desc: "Deep meditation & intuition" },
  { id: "delta", name: "Delta", hertz: "0.5-4Hz", desc: "Deep sleep & recovery" },
  { id: "schumann", name: "Schumann", hertz: "7.83Hz", desc: "Earth's natural frequency" },
];

const ZONES = [
  { name: "Delta", min: 0.5, max: 4, color: "#6a0dad" },
  { name: "Theta", min: 4, max: 8, color: "#1e90ff" },
  { name: "Alpha", min: 8, max: 12, color: "#32cd32" },
  { name: "Beta", min: 12, max: 30, color: "#ffa500" },
  { name: "Gamma", min: 30, max: 100, color: "#ff4500" },
];

function getZone(hz) {
  return ZONES.find(z => hz >= z.min && hz < z.max) || ZONES[ZONES.length - 1];
}

export default function FrequencySelector({ mode, onModeChange, customFreqHz, onCustomFreqChange, useCustom, onUseCustomChange }) {
  const zone = getZone(customFreqHz);

  return (
    <div style={{ marginBottom: "10px" }}>
      {/* Toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
        <input
          type="checkbox"
          checked={useCustom}
          onChange={e => onUseCustomChange(e.target.checked)}
        />
        <span>Use Custom Frequency</span>
        {useCustom && <span style={{ color: "#ffa500", fontSize: "12px" }}>(+$1.50 surcharge)</span>}
      </label>

      {!useCustom ? (
        /* Preset mode dropdown */
        <select value={mode} onChange={e => onModeChange(e.target.value)} style={{ padding: "6px", width: "100%" }}>
          {PRESETS.map(f => (
            <option key={f.id} value={f.id}>{f.name} ({f.hertz}) - {f.desc}</option>
          ))}
        </select>
      ) : (
        /* Custom frequency controls */
        <div style={{ border: "1px solid #555", borderRadius: "8px", padding: "12px", background: "#1a1a1a" }}>
          {/* Zone labels bar */}
          <div style={{ display: "flex", marginBottom: "4px", borderRadius: "4px", overflow: "hidden" }}>
            {ZONES.map(z => (
              <div
                key={z.name}
                style={{
                  flex: z.max - z.min,
                  background: z.color,
                  color: "#fff",
                  textAlign: "center",
                  fontSize: "10px",
                  padding: "2px 0",
                  opacity: zone.name === z.name ? 1 : 0.4,
                }}
              >
                {z.name}
              </div>
            ))}
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0.5}
            max={100}
            step={0.1}
            value={customFreqHz}
            onChange={e => onCustomFreqChange(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: zone.color }}
          />

          {/* Text input + current zone */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.1}
              value={customFreqHz}
              onChange={e => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0.5 && val <= 100) onCustomFreqChange(val);
              }}
              style={{ width: "80px", padding: "4px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}
            />
            <span style={{ fontSize: "14px" }}>Hz</span>
            <span style={{ color: zone.color, fontWeight: "bold", fontSize: "14px" }}>
              {zone.name} Zone ({zone.min}-{zone.max}Hz)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { PRESETS };
