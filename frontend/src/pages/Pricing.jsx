import { useEffect, useState } from "react";
import BASE_URL from "../api.js";

export default function Pricing() {
  const user = localStorage.getItem("userId"); // or however you track logged-in users
  const [userSub, setUserSub] = useState(null);

  // Fetch user's current subscription
  useEffect(() => {
    if (!user) return;
    const fetchSubscription = async () => {
      try {
        const res = await fetch(`${BASE_URL}/user_subscriptions/${user}`);
        if (res.ok) {
          const data = await res.json();
          setUserSub(data); // data = { plan: "limited" | "unlimited", tracks_used: int }
        }
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
      }
    };
    fetchSubscription();
  }, [user]);

  const handleSubscribe = async (plan) => {
    if (!user) {
      alert("Please log in to subscribe.");
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/create_subscription_session/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, plan })
      });

      const data = await response.json();
      if (data.url) window.location.href = data.url; // redirect to Stripe checkout
    } catch (err) {
      console.error(err);
      alert("Error creating subscription session.");
    }
  };

  const remainingTracks = userSub?.plan === "limited" ? 20 - (userSub.tracks_used || 0) : null;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Pricing</h2>

      <h3>Per Track Pricing</h3>
      <p>Tracks are $0.08 per MB. Popular tracks may have adjusted pricing based on demand.</p>

      <h3>Subscriptions</h3>
      <div style={{ marginBottom: "10px" }}>
        <strong>$12.99 / month</strong> – Limited to 20 tracks per month
        {userSub && userSub.plan === "limited" && (
          <span style={{ marginLeft: "10px", color: "green" }}>
            ({remainingTracks} tracks remaining this month)
          </span>
        )}
        <button
          style={{ marginLeft: "10px" }}
          onClick={() => handleSubscribe("limited")}
          disabled={userSub !== null}
        >
          {userSub && userSub.plan === "limited" ? "Current Plan" : "Subscribe"}
        </button>
      </div>
      <div>
        <strong>$16.99 / month</strong> – Unlimited tracks per month
        {userSub && userSub.plan === "unlimited" && (
          <span style={{ marginLeft: "10px", color: "green" }}> (Unlimited access)</span>
        )}
        <button
          style={{ marginLeft: "10px" }}
          onClick={() => handleSubscribe("unlimited")}
          disabled={userSub !== null}
        >
          {userSub && userSub.plan === "unlimited" ? "Current Plan" : "Subscribe"}
        </button>
      </div>
    </div>
  );
}