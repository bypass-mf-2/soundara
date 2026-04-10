import { useState, useEffect } from "react";
import BASE_URL from "../api.js";
import MultiTrackMixer from "../components/tools/MultiTrackMixer.jsx";
import BeatSequencer from "../components/tools/BeatSequencer.jsx";
import EffectsProcessor from "../components/tools/EffectsProcessor.jsx";

const TABS = ["Upload", "Mixer", "Beat Maker", "Effects"];
const GENRES = ["ambient", "electronic", "lo-fi", "classical", "meditation", "nature", "hip-hop", "rock", "pop", "other"];

export default function MusicTools() {
  const [activeTab, setActiveTab] = useState("Upload");

  // Upload state
  const [file, setFile] = useState(null);
  const [trackName, setTrackName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("ambient");
  const [description, setDescription] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [myUploads, setMyUploads] = useState([]);
  const [communityTracks, setCommunityTracks] = useState([]);

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const USER_ID = user?.id;

  useEffect(() => {
    if (USER_ID) {
      fetch(`${BASE_URL}/community/all/${USER_ID}`)
        .then(r => r.json())
        .then(data => setMyUploads(data))
        .catch(() => {});
    }
    fetch(`${BASE_URL}/community/`)
      .then(r => r.json())
      .then(data => setCommunityTracks(data))
      .catch(() => {});
  }, [USER_ID]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !trackName || !artistName) return alert("Fill in all required fields");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("track_name", trackName);
    formData.append("artist_name", artistName);
    formData.append("genre", genre);
    formData.append("description", description);
    formData.append("user_id", USER_ID);

    setUploadMessage("Uploading...");
    try {
      const res = await fetch(`${BASE_URL}/community/upload/`, { method: "POST", body: formData });
      if (!res.ok) {
        throw new Error(`Server ${res.status}: ${res.statusText || "upload rejected"}`);
      }
      const data = await res.json();
      if (data.status === "success") {
        setUploadMessage("Upload successful! Your track is pending review.");
        setFile(null);
        setTrackName("");
        setDescription("");
        // Refresh uploads
        const refreshed = await fetch(`${BASE_URL}/community/all/${USER_ID}`).then(r => r.json());
        setMyUploads(refreshed);
      } else {
        setUploadMessage("Upload failed: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      setUploadMessage("Upload failed: " + err.message);
    }
  };

  const handleBuyCommunity = async (track) => {
    if (!USER_ID) return alert("You must be logged in");
    try {
      const res = await fetch(`${BASE_URL}/create_community_checkout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: track.id, user_id: USER_ID, user_email: user?.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.detail || "Checkout failed");
    } catch (err) {
      alert("Payment failed: " + err.message);
    }
  };

  const statusColor = (s) => s === "approved" ? "#4caf50" : s === "rejected" ? "#f44336" : "#ffa500";

  const tabStyle = (tab) => ({
    padding: "8px 20px",
    cursor: "pointer",
    background: activeTab === tab ? "#646cff" : "#2a2a2a",
    color: "#fff",
    border: "none",
    borderRadius: "6px 6px 0 0",
    fontSize: "14px",
    fontWeight: activeTab === tab ? "bold" : "normal",
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>Music Tools</h2>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "0" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>{tab}</button>
        ))}
      </div>

      <div style={{ border: "1px solid #555", borderRadius: "0 6px 6px 6px", padding: "20px", background: "#1a1a1a" }}>

        {/* ===== Upload Tab ===== */}
        {activeTab === "Upload" && (
          <div>
            <h3>Upload Original Content</h3>
            <p style={{ fontSize: "13px", color: "#888" }}>
              Share your music with the Soundara community. Uploads are reviewed before publishing.
            </p>

            <form onSubmit={handleUpload} style={{ maxWidth: "500px" }}>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Audio File *</label>
                <input type="file" accept="audio/*" onChange={e => setFile(e.target.files[0])} />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Track Name *</label>
                <input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="Track name"
                  style={{ width: "100%", padding: "6px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px" }} />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Artist Name *</label>
                <input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Your artist name"
                  style={{ width: "100%", padding: "6px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px" }} />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Genre</label>
                <select value={genre} onChange={e => setGenre(e.target.value)}
                  style={{ width: "100%", padding: "6px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}>
                  {GENRES.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Description (optional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your track..." maxLength={500}
                  style={{ width: "100%", padding: "6px", background: "#2a2a2a", color: "#fff", border: "1px solid #555", borderRadius: "4px", height: "60px", resize: "vertical" }} />
              </div>
              <button type="submit" style={{ padding: "8px 20px", cursor: "pointer" }}>Upload</button>
            </form>
            {uploadMessage && <p style={{ marginTop: "10px", color: uploadMessage.includes("success") ? "#4caf50" : "#ffa500" }}>{uploadMessage}</p>}

            {/* My Uploads */}
            {myUploads.length > 0 && (
              <div style={{ marginTop: "30px" }}>
                <h4>Your Uploads</h4>
                {myUploads.map(track => (
                  <div key={track.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", border: "1px solid #444", borderRadius: "4px", marginBottom: "6px" }}>
                    <span style={{ flex: 1 }}>{track.name}</span>
                    <span style={{ fontSize: "12px", color: "#888" }}>{track.genre}</span>
                    <span style={{ fontSize: "12px", color: statusColor(track.status), fontWeight: "bold" }}>
                      {track.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "12px", color: "#888" }}>{track.plays} plays</span>
                  </div>
                ))}
              </div>
            )}

            {/* Community Tracks */}
            {communityTracks.length > 0 && (
              <div style={{ marginTop: "30px" }}>
                <h4>Community Tracks</h4>
                {communityTracks.map(track => (
                  <div key={track.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", border: "1px solid #444", borderRadius: "4px", marginBottom: "6px" }}>
                    <span style={{ flex: 1 }}>{track.name} <span style={{ color: "#888", fontSize: "12px" }}>by {track.artist}</span></span>
                    <span style={{ fontSize: "12px", color: "#888" }}>{track.genre}</span>
                    <audio controls src={`${BASE_URL}/community/file/${track.filename_preview}`} style={{ height: "30px" }} />
                    <button onClick={() => handleBuyCommunity(track)} style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>Buy</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Mixer Tab ===== */}
        {activeTab === "Mixer" && <MultiTrackMixer />}

        {/* ===== Beat Maker Tab ===== */}
        {activeTab === "Beat Maker" && <BeatSequencer />}

        {/* ===== Effects Tab ===== */}
        {activeTab === "Effects" && <EffectsProcessor />}
      </div>
    </div>
  );
}
