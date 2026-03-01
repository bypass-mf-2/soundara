export default function ModeSelector({ mode, setMode }) {
  return (
    <select value={mode} onChange={(e) => setMode(e.target.value)}>
      <option value="alpha">Alpha</option>
      <option value="beta">Beta</option>
      <option value="theta">Theta</option>
      <option value="delta">Delta</option>
      <option value="schumann">Schumann Resonance</option>
    </select>
  );
}
