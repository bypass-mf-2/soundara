import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [trackName, setTrackName] = useState("");
  const [mode, setMode] = useState("alpha");
  const [message, setMessage] = useState("");
  const [library, setLibrary] = useState([]);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [reviewUser, setReviewUser] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const bannedWords = ["Fuck", "Fucking", "Shit", "Bastard","Retard"]

  // Frequencies data
  const frequencies = [
    { id: "alpha", name: "Alpha", desc: "Relaxed focus & creativity" },
    { id: "beta", name: "Beta", desc: "Alertness & problem-solving" },
    { id: "theta", name: "Theta", desc: "Deep meditation & intuition" },
    { id: "delta", name: "Delta", desc: "Deep sleep & recovery" },
    { id: "schumann", name: "Schumann", desc: "Earth’s natural frequency" }
  ];

  const loadLibrary = () => {
    fetch("http://localhost:8000/library/")
      .then(res => res.json())
      .then(data => setLibrary(data))
      .catch(err => console.log("Failed to load library", err));
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !url) return alert("Upload a file or enter a URL");
    if (!trackName) return alert("Enter a track name");

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (url) formData.append("url", url);
    formData.append("track_name", trackName);
    formData.append("mode", mode);

    setMessage("Processing...");

    try {
      const res = await fetch("http://localhost:8000/process_audio/", {
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
        loadLibrary();
      }
    } catch (err) {
      setMessage("Upload failed: " + err.message);
    }
  };

  const handleAddReview = (e) => {
  e.preventDefault();
  if (!reviewUser || !reviewComment) return alert("Enter your name and comment");

  // Simple profanity filter
  const containsBadWords = bannedWords.some(word =>
    reviewComment.toLowerCase().includes(word)
  );

  if (containsBadWords) {
    alert("Your comment contains inappropriate language and cannot be posted.");
    return;
  }

  const newReview = {
    user: reviewUser,
    rating: reviewRating,
    comment: reviewComment
  };

  setReviews(prev => [...prev, newReview]);
  setReviewUser("");
  setReviewRating(5);
  setReviewComment("");
};

  return (
    <div style={{ padding: "20px" }}>
      
      {/* ===== TOP SECTION ===== */}
      <div style={{ display: "flex", gap: "20px" }}>

        {/* Upload */}
        <div style={{ flex: 1 }}>
          <h2>Upload</h2>
          <form onSubmit={handleSubmit}>
            <input type="file" onChange={e => setFile(e.target.files[0])} /><br />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="YouTube URL" /><br />
            <select value={mode} onChange={e => setMode(e.target.value)}>
              {frequencies.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select><br />
            <input value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="Track Name" /><br />
            <button type="submit">Process</button>
          </form>
          <p>{message}</p>
        </div>

        {/* Frequencies */}
        <div style={{ flex: 1 }}>
          <h2>Frequencies</h2>
          {frequencies.map(freq => (
            <div
              key={freq.id}
              onClick={() => navigate(`/about#${freq.id}`)}
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
                cursor: "pointer"
              }}
            >
              <strong>{freq.name}</strong>
              <p style={{ fontSize: "14px" }}>{freq.desc}</p>
            </div>
          ))}
        </div>

        {/* Library */}
        <div style={{ flex: 1 }}>
          <h2>Library</h2>
          {library.map((track, i) => (
            <div key={i}>
              <p>{track.name} ({track.mode})</p>
              <audio controls src={`http://localhost:8000/library/file/${track.file}`} />
            </div>
          ))}
        </div>
      </div>

      {/* ===== REVIEWS ===== */}
      <div style={{ marginTop: "40px" }}>
        <h2>Reviews</h2>

        <form onSubmit={handleAddReview}>
          <input placeholder="Name" value={reviewUser} onChange={e => setReviewUser(e.target.value)} />
          <select value={reviewRating} onChange={e => setReviewRating(+e.target.value)}>
            {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ⭐</option>)}
          </select>
          <input placeholder="Comment" value={reviewComment} onChange={e => setReviewComment(e.target.value)} />
          <button>Add</button>
        </form>

        {reviews.length === 0 && <p>No reviews yet.</p>}
        {reviews.map((r, i) => (
          <div key={i}>
            <strong>{r.user}</strong> ⭐ {r.rating}
            <p>{r.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}