import { useState, useEffect } from "react";
import BASE_URL from "../api.js";

export default function CreatorDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const USER_ID = user?.id;

  const [onboardStatus, setOnboardStatus] = useState({ onboarded: false, has_account: false });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!USER_ID) return;

    Promise.all([
      fetch(`${BASE_URL}/creator/onboard/status/${USER_ID}`).then(r => r.json()),
      fetch(`${BASE_URL}/creator/dashboard/${USER_ID}`).then(r => r.json()),
    ])
      .then(([status, dash]) => {
        setOnboardStatus(status);
        setDashboard(dash);
      })
      .catch(err => console.error("Failed to load creator data:", err))
      .finally(() => setLoading(false));
  }, [USER_ID]);

  const handleOnboard = async () => {
    try {
      const res = await fetch(`${BASE_URL}/creator/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, email: user?.email, name: user?.name }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to start onboarding: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      alert("Onboarding failed: " + err.message);
    }
  };

  if (!USER_ID) return <div style={{ padding: "20px" }}><p>Please log in to access the Creator Dashboard.</p></div>;
  if (loading) return <div style={{ padding: "20px" }}><p>Loading...</p></div>;

  const statusColor = (s) => s === "approved" ? "#4caf50" : s === "rejected" ? "#f44336" : "#ffa500";

  return (
    <div style={{ padding: "20px" }}>
      <h2>Creator Dashboard</h2>

      {/* Stripe Connect Status */}
      <div style={{ border: "1px solid #555", borderRadius: "8px", padding: "20px", marginBottom: "20px", background: "#1a1a1a" }}>
        <h3 style={{ marginTop: 0 }}>Payment Setup</h3>
        {onboardStatus.onboarded ? (
          <p style={{ color: "#4caf50" }}>Stripe Connect is active. You will receive 70% of each sale automatically.</p>
        ) : (
          <div>
            <p style={{ color: "#888" }}>
              Connect your Stripe account to receive payments when users purchase your tracks.
              You'll receive 70% of each sale, with 30% going to the platform.
            </p>
            <button onClick={handleOnboard} style={{ padding: "10px 20px", cursor: "pointer", fontSize: "14px" }}>
              {onboardStatus.has_account ? "Complete Stripe Setup" : "Connect with Stripe"}
            </button>
          </div>
        )}
      </div>

      {/* Earnings Overview */}
      {dashboard && (
        <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px", border: "1px solid #555", borderRadius: "8px", padding: "15px", background: "#1a1a1a", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#646cff" }}>
              {dashboard.tracks?.length || 0}
            </div>
            <div style={{ fontSize: "13px", color: "#888" }}>Tracks Uploaded</div>
          </div>
          <div style={{ flex: "1 1 150px", border: "1px solid #555", borderRadius: "8px", padding: "15px", background: "#1a1a1a", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#32cd32" }}>
              {dashboard.total_plays}
            </div>
            <div style={{ fontSize: "13px", color: "#888" }}>Total Plays</div>
          </div>
          <div style={{ flex: "1 1 150px", border: "1px solid #555", borderRadius: "8px", padding: "15px", background: "#1a1a1a", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ffa500" }}>
              ${(dashboard.balance_available_cents / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "13px", color: "#888" }}>Available Balance</div>
          </div>
          <div style={{ flex: "1 1 150px", border: "1px solid #555", borderRadius: "8px", padding: "15px", background: "#1a1a1a", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#888" }}>
              ${(dashboard.balance_pending_cents / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "13px", color: "#888" }}>Pending Balance</div>
          </div>
        </div>
      )}

      {/* Track List */}
      {dashboard?.tracks?.length > 0 && (
        <div>
          <h3>Your Tracks</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #555" }}>
                <th style={{ textAlign: "left", padding: "8px", color: "#888", fontSize: "12px" }}>TRACK</th>
                <th style={{ textAlign: "left", padding: "8px", color: "#888", fontSize: "12px" }}>GENRE</th>
                <th style={{ textAlign: "center", padding: "8px", color: "#888", fontSize: "12px" }}>STATUS</th>
                <th style={{ textAlign: "center", padding: "8px", color: "#888", fontSize: "12px" }}>PLAYS</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.tracks.map(track => (
                <tr key={track.id} style={{ borderBottom: "1px solid #333" }}>
                  <td style={{ padding: "8px" }}>
                    {track.name}
                    {track.description && <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{track.description}</p>}
                  </td>
                  <td style={{ padding: "8px", fontSize: "13px", color: "#888" }}>{track.genre}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ color: statusColor(track.status), fontSize: "12px", fontWeight: "bold" }}>
                      {track.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center", fontSize: "13px" }}>{track.plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dashboard?.tracks?.length === 0 && (
        <p style={{ color: "#888" }}>You haven't uploaded any tracks yet. Head to Music Tools to upload your first track!</p>
      )}
    </div>
  );
}
