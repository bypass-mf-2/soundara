import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import BASE_URL from "../api.js";

export default function Success() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const user = params.get("user");
  const trackFile = params.get("track");
  const trackName = params.get("track_name"); // optional, if you send it
  const subscription = params.get("subscription"); // "limited" or "unlimited"

  useEffect(() => {
    if (!user) return;

    const updateLibrary = async () => {
      try {
        // 1️⃣ Add track if applicable
        if (trackFile && trackName) {
          await fetch(`${BASE_URL}/user_library/${user}/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: trackFile,
              name: trackName,
            }),
          });
        }

        // 2️⃣ Activate subscription if applicable
        if (subscription) {
          await fetch(`${BASE_URL}/user_subscriptions/${user}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: subscription }),
          });
        }

        alert("Purchase successful!");
        navigate("/"); // back to home so library updates
      } catch (err) {
        console.error(err);
        alert("Something went wrong updating your library or subscription.");
      }
    };

    updateLibrary();
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h1>Payment Successful</h1>
      <p>Your track or subscription has been added to your account.</p>
    </div>
  );
}