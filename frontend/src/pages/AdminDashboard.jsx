import { useState, useEffect } from "react";
import BASE_URL from "../api.js";

const ADMIN_EMAIL = "trevorm.goodwill@gmail.com";

export default function AdminDashboard() {
  const [user] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (user?.email !== ADMIN_EMAIL) return;
    fetch(`${BASE_URL}/admin/stats?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user || user.email !== ADMIN_EMAIL) {
    return <div style={{ padding: 40, textAlign: "center" }}><h2>Access Denied</h2></div>;
  }
  if (loading) return <div style={{ padding: 40 }}>Loading dashboard...</div>;
  if (!stats) return <div style={{ padding: 40 }}>Failed to load stats.</div>;

  const tabs = ["overview", "events", "library", "subscriptions", "moderation"];

  return (
    <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
      <h1>Admin Dashboard</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #333" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderBottom: activeTab === tab ? "3px solid #4bab07" : "3px solid transparent",
              background: activeTab === tab ? "#1a1a1a" : "transparent",
              color: activeTab === tab ? "#4bab07" : "#aaa",
              cursor: "pointer",
              fontWeight: activeTab === tab ? "bold" : "normal",
              textTransform: "capitalize",
              fontSize: 14,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 15, marginBottom: 30 }}>
            {[
              { label: "Total Tracks", value: stats.total_tracks, color: "#4bab07" },
              { label: "Total Users", value: stats.total_users, color: "#007bff" },
              { label: "Total Plays", value: stats.total_plays, color: "#ff6b35" },
              { label: "Unique Visitors", value: stats.unique_visitors, color: "#9b59b6" },
              { label: "Active Subs", value: stats.active_subscriptions, color: "#e74c3c" },
              { label: "Total Events", value: stats.total_events, color: "#f39c12" },
            ].map((stat) => (
              <div key={stat.label} style={{ border: "1px solid #333", borderRadius: 8, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: "bold", color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: "#aaa", marginTop: 5 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <h3>Event Breakdown</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
            {Object.entries(stats.event_breakdown || {}).map(([type, count]) => (
              <div key={type} style={{ border: "1px solid #444", borderRadius: 6, padding: "8px 15px" }}>
                <strong>{type}</strong>: {count}
              </div>
            ))}
          </div>

          <h3>Daily Activity (Last 14 Days)</h3>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120, marginBottom: 20 }}>
            {Object.entries(stats.daily_events || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-14)
              .map(([date, count]) => {
                const maxCount = Math.max(...Object.values(stats.daily_events || { "": 1 }));
                const height = Math.max(4, (count / maxCount) * 100);
                return (
                  <div key={date} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div style={{ width: "100%", height, backgroundColor: "#4bab07", borderRadius: "3px 3px 0 0", minWidth: 20 }}
                      title={`${date}: ${count} events`} />
                    <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>{date.slice(5)}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <div>
          <h3>Recent Events (Last 50)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #444" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Time</th>
                <th style={{ textAlign: "left", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", padding: 8 }}>User</th>
                <th style={{ textAlign: "left", padding: 8 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent_events || []).map((ev, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: 6, color: "#888" }}>{ev.timestamp?.slice(0, 16).replace("T", " ")}</td>
                  <td style={{ padding: 6 }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11,
                      backgroundColor: ev.type === "login" ? "#1a3a1a" : ev.type === "audio_play" ? "#1a1a3a" : "#2a2a2a",
                      color: ev.type === "login" ? "#4bab07" : ev.type === "audio_play" ? "#007bff" : "#ccc",
                    }}>
                      {ev.type}
                    </span>
                  </td>
                  <td style={{ padding: 6 }}>{ev.name || ev.user || "-"}</td>
                  <td style={{ padding: 6, color: "#aaa" }}>{ev.track || ev.page || ev.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Library Tab */}
      {activeTab === "library" && (
        <div>
          <h3>All Tracks ({stats.library?.length || 0})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #444" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", padding: 8 }}>Mode</th>
                <th style={{ textAlign: "left", padding: 8 }}>Plays</th>
                <th style={{ textAlign: "left", padding: 8 }}>Size</th>
                <th style={{ textAlign: "left", padding: 8 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats.library || [])
                .sort((a, b) => (b.plays || 0) - (a.plays || 0))
                .map((track, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: 6 }}>{track.name}</td>
                    <td style={{ padding: 6, color: "#4bab07" }}>{track.mode}</td>
                    <td style={{ padding: 6 }}>{track.plays || 0}</td>
                    <td style={{ padding: 6, color: "#888" }}>{((track.size_bytes || 0) / 1024 / 1024).toFixed(1)} MB</td>
                    <td style={{ padding: 6, color: "#888" }}>{track.timestamp?.slice(0, 10)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === "subscriptions" && (
        <div>
          <h3>Active Subscriptions ({Object.keys(stats.subscriptions || {}).length})</h3>
          {Object.keys(stats.subscriptions || {}).length === 0 ? (
            <p style={{ color: "#888" }}>No active subscriptions yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>User ID</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Plan</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.subscriptions || {}).map(([userId, sub], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: 6, fontFamily: "monospace", fontSize: 11 }}>{userId.slice(0, 12)}...</td>
                    <td style={{ padding: 6, color: "#4bab07" }}>{sub.plan || sub.type || "unknown"}</td>
                    <td style={{ padding: 6, color: "#888" }}>{JSON.stringify(sub).slice(0, 80)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === "moderation" && (
        <div>
          <h3>Pending Uploads ({stats.pending_uploads?.length || 0})</h3>
          {(stats.pending_uploads || []).length === 0 ? (
            <p style={{ color: "#888" }}>No uploads pending review.</p>
          ) : (
            stats.pending_uploads.map((track) => (
              <div key={track.id} style={{ border: "1px solid #333", borderRadius: 8, padding: 15, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{track.name}</strong> by {track.artist}
                    <span style={{ marginLeft: 10, color: "#888", fontSize: 12 }}>{track.genre} | {track.timestamp?.slice(0, 10)}</span>
                    {track.description && <p style={{ color: "#aaa", fontSize: 13, margin: "5px 0 0" }}>{track.description}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        await fetch(`${BASE_URL}/community/moderate/${track.id}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "approved" }),
                        });
                        window.location.reload();
                      }}
                      style={{ padding: "6px 16px", backgroundColor: "#4bab07", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`${BASE_URL}/community/moderate/${track.id}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "rejected" }),
                        });
                        window.location.reload();
                      }}
                      style={{ padding: "6px 16px", backgroundColor: "#e74c3c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
