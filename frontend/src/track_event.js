export async function trackEvent(event) {
  try {
    const response = await fetch("http://localhost:8000/track_event/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error("Failed to track event:", response.statusText);
      return;
    }

    const data = await response.json();
    console.log("Event tracked:", data);
  } catch (err) {
    console.error("Failed to track event:", err);
  }
}