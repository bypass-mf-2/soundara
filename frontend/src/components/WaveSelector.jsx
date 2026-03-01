function WaveSelector({ mode, setMode }) {
  return (
    <div>
      <label>Wave Mode:</label>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="alpha">Alpha (8–12 Hz)</option>
        <option value="beta">Beta (13–30 Hz)</option>
        <option value="theta">Theta (4–7 Hz)</option>
        <option value="delta">Delta (0.5–3 Hz)</option>
        <option value="schumann">Schumann (7.83 Hz)</option>
      </select>
    </div>
  );
}

export default WaveSelector;
