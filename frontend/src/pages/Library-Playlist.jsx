import React, { useState, useEffect } from "react";
import { usePlayer } from "../PlayerContext.jsx";

export default function Library({ user }) {
  const USER_ID = user?.id;
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [renamingPlaylist, setRenamingPlaylist] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedPlaylistForAdd, setSelectedPlaylistForAdd] = useState("default");

  const {
    playlists,
    currentPlaylist,
    setCurrentPlaylist,
    currentIndex,
    isPlaying,
    playTrack,
    pauseTrack,
    addToPlaylist,
    removeFromPlaylist,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    playLibrary,
  } = usePlayer();

  useEffect(() => {
    if(!USER_ID) return;
    fetch(`http://localhost:8000/user_library/${USER_ID}`)
      .then(res => res.json())
      .then(data => setTracks(data))
      .catch(err => console.error("Failed to fetch library:", err));
  }, [USER_ID]);

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const ok = createPlaylist(newPlaylistName.trim());
    if (!ok) alert("Playlist name already exists.");
    else setNewPlaylistName("");
  };

  const handleRename = (name) => {
    const ok = renamePlaylist(name, renameValue.trim());
    if (!ok) alert("Name already taken or invalid.");
    else setRenamingPlaylist(null);
  };

  const playlistNames = Object.keys(playlists).filter(p => p !== "__library__");

  return (
    <div style={{ padding: "20px" }}>
      {/* ── Library ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <h2 style={{ margin: 0 }}>My Library</h2>
        <button onClick={() => playLibrary(tracks)} disabled={tracks.length === 0}>
          ▶️ Play All
        </button>
      </div>

      {(!tracks || tracks.length === 0) && (
        <p>Library is empty. This will update when you get songs.</p>
      )}

      {tracks.map((track, i) => {
        const isCurrentTrack = currentPlaylist === "__library__" && currentIndex === i;
        return (
          <div key={i} style={{ border: "1px solid #ccc", padding: "8px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => isCurrentTrack && isPlaying ? pauseTrack() : playTrack(i, "__library__")}>
              {isCurrentTrack && isPlaying ? "⏸" : "▶️"}
            </button>
            <span style={{ flex: 1 }}>{track.name} ({track.mode})</span>

            {/* Add to playlist dropdown */}
            <select value={selectedPlaylistForAdd} onChange={e => setSelectedPlaylistForAdd(e.target.value)}>
              {playlistNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button onClick={() => addToPlaylist(track, selectedPlaylistForAdd)}>+ Add</button>
          </div>
        );
      })}

      {/* ── Playlists ── */}
      <div style={{ marginTop: "30px" }}>
        <h2>Playlists</h2>

        {/* Create new playlist */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            value={newPlaylistName}
            onChange={e => setNewPlaylistName(e.target.value)}
            placeholder="New playlist name..."
            onKeyDown={e => e.key === "Enter" && handleCreatePlaylist()}
          />
          <button onClick={handleCreatePlaylist}>Create</button>
        </div>

        {playlistNames.map(name => {
          const pl = playlists[name] || [];
          const isActive = currentPlaylist === name;
          return (
            <div key={name} style={{ border: "1px solid #ccc", borderRadius: "6px", padding: "10px", marginBottom: "12px" }}>

              {/* Playlist header */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                {renamingPlaylist === name ? (
                  <>
                    <input value={renameValue} onChange={e => setRenameValue(e.target.value)} />
                    <button onClick={() => handleRename(name)}>Save</button>
                    <button onClick={() => setRenamingPlaylist(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <strong style={{ flex: 1 }}>{name} ({pl.length} tracks)</strong>
                    <button onClick={() => { setCurrentPlaylist(name); playTrack(0, name); }} disabled={pl.length === 0}>
                      ▶️ Play All
                    </button>
                    {name !== "default" && (
                      <>
                        <button onClick={() => { setRenamingPlaylist(name); setRenameValue(name); }}>✏️</button>
                        <button onClick={() => deletePlaylist(name)}>🗑️</button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Tracks in playlist */}
              {pl.length === 0 && <p style={{ fontSize: "13px", color: "#888" }}>No tracks yet.</p>}
              {pl.map((track, i) => {
                const isCurrentTrack = isActive && currentIndex === i;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", borderTop: "1px solid #eee" }}>
                    <button onClick={() => isCurrentTrack && isPlaying ? pauseTrack() : playTrack(i, name)}>
                      {isCurrentTrack && isPlaying ? "⏸" : "▶️"}
                    </button>
                    <span style={{ flex: 1 }}>{track.name} ({track.mode})</span>
                    <button onClick={() => removeFromPlaylist(track.filename_full, name)}>✕</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
