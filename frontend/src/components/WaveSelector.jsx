// frontend/src/components/WaveSelector.jsx
import { trackEvent } from "../trackEvent";

function WaveSelector({ mode, setMode }) {
  const handleChange = (e) => {
    const selectedMode = e.target.value;
    setMode(selectedMode);

    // Track the event
    trackEvent({
      type: "mode_change",
      mode: selectedMode
    });
  };

  return (
    <div>
      <label>Wave Mode:</label>
      <select value={mode} onChange={handleChange}>
        <option value="gamma">Gamma (30–100 Hz)</option>
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