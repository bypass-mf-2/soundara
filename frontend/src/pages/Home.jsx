import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import BASE_URL from "../api.js";
import FrequencySelector, { PRESETS } from "../components/FrequencySelector.jsx";

export default function Home() {

  const navigate = useNavigate();
  const [purchasedTracks, setPurchasedTracks] = useState([]);
  // Persistent user state
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const USER_ID = user?.id;
  const MIN_PRICE_CENTS = 170;

  const ensurePriceCents = (track) => {
    if (track.price_cents !== undefined) return track;
    if (!track.size_bytes) track.size_bytes = 0;
    const sizeMB = track.size_bytes / (1024 * 1024);
    const pricePerMB = track.existing ? 0.06 : 0.08;
    let price_cents = Math.ceil(sizeMB * pricePerMB * 100);
    price_cents = Math.max(price_cents, MIN_PRICE_CENTS);
    if (track.custom_freqs) price_cents += 150;
    track.price_cents = price_cents;
    return track;
  };

  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [trackName, setTrackName] = useState("");
  const [mode, setMode] = useState("alpha");
  const [useCustomFreq, setUseCustomFreq] = useState(false);
  const [customFreqHz, setCustomFreqHz] = useState(10);
  const [message, setMessage] = useState("");
  const [library, setLibrary] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewUser, setReviewUser] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [playlist, setPlaylist] = useState([]);
  const bannedWords = ["Fuck", "Fucking", "Shit", "Bastard", "Retard"];
  const [lastProcessed, setLastProcessed] = useState(null);
  const [tosAccepted, setTosAccepted] = useState(
    localStorage.getItem("tosAccepted") === "true"
  );
  const [platformStats, setPlatformStats] = useState(null);
  const [freeTrialUsed, setFreeTrialUsed] = useState(false);
  const [songSuggestions, setSongSuggestions] = useState([]);

  const frequencies = PRESETS;

  // Load library
  const loadLibrary = () => {
    fetch(`${BASE_URL}/library/`)
      .then(res => res.json())
      .then(data => {
        const pricedData = data.map(ensurePriceCents);
        const sorted = pricedData.sort((a, b) => b.plays - a.plays);
        setLibrary(sorted);
      })
      .catch(err => console.log("Failed to load library", err));
  };

  useEffect(() => { loadLibrary(); }, []);

  // Load platform stats for social proof
  useEffect(() => {
    fetch(`${BASE_URL}/public/stats`)
      .then((r) => r.json())
      .then(setPlatformStats)
      .catch(() => {});
  }, []);

  // Check free trial status
  useEffect(() => {
    if (!USER_ID) return;
    fetch(`${BASE_URL}/free_trial/${USER_ID}`)
      .then((r) => r.json())
      .then((data) => setFreeTrialUsed(data.used))
      .catch(() => {});
  }, [USER_ID]);

  // Song title autocomplete
  useEffect(() => {
    if (trackName.length < 2) { setSongSuggestions([]); return; }
    const timer = setTimeout(() => {
      fetch(`${BASE_URL}/song_search?q=${encodeURIComponent(trackName)}`)
        .then((r) => r.json())
        .then(setSongSuggestions)
        .catch(() => setSongSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [trackName]);

  // Claim free trial
  const handleFreeTrial = async (track) => {
    try {
      const res = await fetch(`${BASE_URL}/free_trial/${USER_ID}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Free trial claimed! Track added to your library.");
        setFreeTrialUsed(true);
      } else {
        alert(data.detail || "Failed to claim free trial.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
    const wasReturningFromPolicy = sessionStorage.getItem("showTosPopup");
    if (wasReturningFromPolicy) {
      setTosAccepted(false);
      sessionStorage.removeItem("showTosPopup");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !url) return alert("Upload a file or enter a URL");
    if (!trackName) return alert("Enter a track name");

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (url) formData.append("url", url);
    formData.append("track_name", trackName);
    formData.append("mode", useCustomFreq ? "custom" : mode);
    if (useCustomFreq) formData.append("custom_freq_hz", customFreqHz);

    setMessage("Processing...");
    try {
      const res = await fetch(`${BASE_URL}/process_audio/`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.status !== "success") {
        setMessage("Error processing audio");
      } else {
        setMessage("Track processed successfully!");
        setFile(null);
        setUrl("");
        setTrackName("");

        const processedTrack = {
          name: data.track,
          mode: data.mode,
          filename_preview: data.filename_preview,
          filename_full: data.filename_full,
          size_bytes: data.size_bytes || 0,
          existing: false,
          custom_freqs: data.custom_freqs || false
        };

        const pricedTrack = ensurePriceCents(processedTrack);
        setLastProcessed(pricedTrack);
        loadLibrary();
      }
    } catch (err) {
      setMessage("Upload failed: " + err.message);
    }
  };

  // Stripe payment
  const handleBuy = async (track) => {
    if (!user || !user.id) {
      alert("You must be logged in to buy a track!");
      return;
    }
    try {
      if (track.price_cents === undefined)
        track.price_cents = ensurePriceCents(track).price_cents;

      const res = await fetch(`${BASE_URL}/create_checkout_session/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: {
            name: track.name,
            mode: track.mode,
            filename_full: track.filename_full,
            filename_preview: track.filename_preview,
            custom_freqs: track.custom_freqs || false,
            size_bytes: track.size_bytes || 0
          },
          user_id: user.id,
          user_email: user.email,
        })
      });
      const data = await res.json();

      if (!data.url) {
        alert(`Free user! Track "${data.track}" added to your library.`);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error creating checkout session: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.log(err);
      alert("Payment failed: " + err.message);
    }
  };

  // Add track to user's library
  const handleAddToLibrary = async (track) => {
    try {
      const res = await fetch(`${BASE_URL}/user_library/${USER_ID}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      if (res.ok) alert(`${track.name} added to your library!`);
      else alert("Failed to add track.");
    } catch (err) {
      console.log(err);
      alert("Error adding track to library.");
    }
  };

  // Reviews
  const handleAddReview = (e) => {
    e.preventDefault();
    if (!reviewUser || !reviewComment) return alert("Enter name & comment");
    if (bannedWords.some(word => reviewComment.toLowerCase().includes(word.toLowerCase()))) {
      alert("Comment contains inappropriate language.");
      return;
    }
    setReviews(prev => [...prev, { user: reviewUser, rating: reviewRating, comment: reviewComment }]);
    setReviewUser("");
    setReviewRating(5);
    setReviewComment("");
  };

  const addToPlaylist = (track) => setPlaylist(prev => [...prev, track]);

  return (
    <div style={{ padding: "20px" }}>

      {/* Social Proof Stats */}
      {platformStats && (
        <div style={{
          display: "flex", justifyContent: "center", gap: 40, padding: "15px 0",
          marginBottom: 20, borderBottom: "1px solid #333",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#4bab07" }}>{platformStats.total_tracks}</div>
            <div style={{ fontSize: 12, color: "#aaa" }}>Tracks Created</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#007bff" }}>{platformStats.total_users}</div>
            <div style={{ fontSize: 12, color: "#aaa" }}>Users</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#ff6b35" }}>{platformStats.total_plays}</div>
            <div style={{ fontSize: 12, color: "#aaa" }}>Total Plays</div>
          </div>
        </div>
      )}

      {/* Free Trial Banner */}
      {!freeTrialUsed && (
        <div style={{
          background: "linear-gradient(90deg, #1a3a1a, #0a2a0a)", border: "1px solid #4bab07",
          borderRadius: 8, padding: "12px 20px", marginBottom: 20, textAlign: "center",
        }}>
          <strong style={{ color: "#4bab07" }}>First track free!</strong>
          <span style={{ marginLeft: 10, color: "#ccc" }}>Process any song and get it added to your library at no cost.</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "20px" }}>

        {/* Upload */}
        <div style={{ flex: 1 }}>
          <h2>Upload Track</h2>
          <form onSubmit={handleSubmit}>
            <input type="file" onChange={e => setFile(e.target.files[0])} /><br />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="YouTube URL" /><br />
            <FrequencySelector
              mode={mode}
              onModeChange={setMode}
              customFreqHz={customFreqHz}
              onCustomFreqChange={setCustomFreqHz}
              useCustom={useCustomFreq}
              onUseCustomChange={setUseCustomFreq}
            />
            <div style={{ position: "relative", display: "inline-block" }}>
              <input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="Track Name"
                onBlur={() => setTimeout(() => setSongSuggestions([]), 200)} />
              {songSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "#1a1a1a", border: "1px solid #444", borderRadius: 4, maxHeight: 150, overflowY: "auto",
                }}>
                  {songSuggestions.map((s, i) => (
                    <div key={i} style={{ padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #333" }}
                      onMouseDown={() => { setTrackName(s); setSongSuggestions([]); }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div><br />
            <button type="submit">Process</button>
          </form>

          <p>{message}</p>

          {lastProcessed && (
            <div style={{ marginTop: "20px", padding: "10px", border: "1px solid #ccc" }}>
              <h3>Processed Track</h3>
              <p>
                {lastProcessed.name} ({lastProcessed.mode}) - $
                {((lastProcessed.price_cents) / 100).toFixed(2)}
              </p>
              <audio controls src={`${BASE_URL}/library/file/${lastProcessed.filename_preview}`} />
              <br />
              {purchasedTracks.includes(lastProcessed.filename_full) ? (
                <a
                  href={`${BASE_URL}/library/file/${lastProcessed.filename_full}`}
                  download={lastProcessed.filename_full}
                >
                  Download
                </a>
              ) : (
                <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                  {!freeTrialUsed && (
                    <button onClick={() => handleFreeTrial(lastProcessed)}
                      style={{ backgroundColor: "#4bab07", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>
                      Claim Free Trial
                    </button>
                  )}
                  <button onClick={() => handleBuy(lastProcessed)}>
                    Buy to Download (${((lastProcessed.price_cents) / 100).toFixed(2)})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Frequencies */}
        <div style={{ flex: 1 }}>
          <h2>Frequencies</h2>
          {frequencies.map(freq => (
            <div key={freq.id} onClick={() => navigate(`/about#${freq.id}`)}
              style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px", cursor: "pointer" }}>
              <strong>{freq.name}</strong>
              <span style={{ marginLeft: "0px", color: "#4bab07" }}>({freq.hertz})</span>
              <p style={{ fontSize: "14px" }}>{freq.desc}</p>
            </div>
          ))}
        </div>

        {/* Library */}
        <div style={{ flex: 1 }}>
          <h2>Library</h2>
          {library.length === 0 ? <p>No tracks available.</p> :
            library.map((track, i) => (
              <div key={i} style={{ border: "1px solid #ccc", marginBottom: "8px", padding: "5px" }}>
                <p>{track.name} ({track.mode}) - Plays: {track.plays} - ${((track.price_cents || 0) / 100).toFixed(2)}</p>
                <audio
                  controls
                  src={`${BASE_URL}/library/file/${track.filename_preview}?user_id=${USER_ID}`}
                  onPlay={() => {
                    fetch(`${BASE_URL}/track_event/`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "audio_play", track: track.name })
                    });
                  }}
                />
                <button onClick={() => handleBuy(track)}>Buy</button>
              </div>
            ))}
        </div>
      </div>

      {/* Playlist */}
      <div style={{ marginTop: "30px" }}>
        <h2>Playlist</h2>
        {playlist.length === 0 ? <p>No tracks added.</p> :
          playlist.map((track, i) => (
            <div key={i}>
              <p>{track.name} ({track.mode})</p>
              <audio controls src={`${BASE_URL}/library/file/${track.filename_full}`} />
            </div>
          ))
        }
      </div>

      {/* Reviews */}
      <div style={{ marginTop: "40px" }}>
        <h2>Reviews</h2>
        <form onSubmit={handleAddReview}>
          <input placeholder="Name" value={reviewUser} onChange={e => setReviewUser(e.target.value)} />
          <select value={reviewRating} onChange={e => setReviewRating(+e.target.value)}>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ⭐</option>)}
          </select>
          <input placeholder="Comment" value={reviewComment} onChange={e => setReviewComment(e.target.value)} />
          <button>Add</button>
        </form>
        {reviews.length === 0 ? <p>No reviews yet.</p> :
          reviews.map((r, i) => (
            <div key={i}>
              <strong>{r.user}</strong> ⭐ {r.rating}
              <p>{r.comment}</p>
            </div>
          ))
        }
      </div>

      {/* Terms of Service Popup */}
      {user && !tosAccepted && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "#fff",
            padding: "40px 30px",
            maxWidth: "480px",
            width: "90%",
            borderRadius: "12px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            lineHeight: "1.6"
          }}>
            <h2 style={{ marginBottom: "20px" }}>Welcome!</h2>
            <p style={{ marginBottom: "25px" }}>
              Please review our <Link to="/terms">Terms of Service</Link>, <Link to="/privacy">Privacy Policy</Link>, and <Link to="/dmca">DMCA Policy</Link> before continuing.
            </p>
            <button
              onClick={() => {
                setTosAccepted(true);
                localStorage.setItem("tosAccepted", "true");
              }}
              style={{
                padding: "12px 25px",
                fontSize: "16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#007bff",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              I Agree
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        marginTop: "60px",
        paddingTop: "20px",
        borderTop: "1px solid #ccc",
        textAlign: "center",
        fontSize: "14px"
      }}>
        <Link to="/terms">Terms of Service</Link> |{" "}
        <Link to="/privacy">Privacy Policy</Link> |{" "}
        <Link to="/dmca">DMCA Policy</Link>
      </footer>

    </div>
  );
}