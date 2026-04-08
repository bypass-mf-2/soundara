import { useState, useEffect, useRef } from "react";
import BASE_URL from "../api.js";

const MODES = ["", "gamma", "alpha", "beta", "theta", "delta", "schumann"];

export default function SearchBar({ onTrackSelect }) {
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query && !modeFilter) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (modeFilter) params.set("mode", modeFilter);
        const res = await fetch(`${BASE_URL}/search/?${params}`);
        const data = await res.json();
        setResults(data);
        setShowResults(true);
      } catch (err) {
        console.error("Search failed", err);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, modeFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: "15px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder="Search tracks..."
          value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => results.length > 0 && setShowResults(true)}
          style={{ flex: 1, padding: "8px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}
        />
        <select
          value={modeFilter}
          onChange={e => setModeFilter(e.target.value)}
          style={{ padding: "8px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}
        >
          <option value="">All Modes</option>
          {MODES.filter(Boolean).map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>

      {showResults && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#1a1a1a",
          border: "1px solid #555",
          borderRadius: "0 0 4px 4px",
          maxHeight: "300px",
          overflowY: "auto",
          zIndex: 100,
        }}>
          {results.map((track, i) => (
            <div
              key={i}
              onClick={() => { onTrackSelect?.(track); setShowResults(false); }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#2a2a2a"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span>{track.name}</span>
              <span style={{ color: "#888", fontSize: "12px" }}>
                {track.mode} | {track.plays} plays
              </span>
            </div>
          ))}
        </div>
      )}

      {showResults && query && results.length === 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#1a1a1a", border: "1px solid #555", padding: "10px", color: "#888"
        }}>
          No tracks found
        </div>
      )}
    </div>
  );
}
