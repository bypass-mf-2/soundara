import React, { useState } from "react";
import emailjs from "@emailjs/browser";

export default function Envision() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitStatus("Sending...");
    emailjs
      .send(
        "YOUR_SERVICE_ID",
        "YOUR_TEMPLATE_ID",
        { name, email, interest, notes },
        "YOUR_PUBLIC_KEY"
      )
      .then(() => {
        setSubmitStatus("Submitted successfully!");
        setName("");
        setEmail("");
        setInterest("");
        setNotes("");
      })
      .catch(() => {
        setSubmitStatus("Failed to send. Please try again.");
      });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Future Projection</h2>
      <p>Here we show version one which hopes to come shortly after release
        and version two which will come later on.
      </p>
      <h3>Soundara V1:</h3>

      <h4>Custom Frequencies:</h4>
      <p>Instead of the preset frequencies, users will be able to input their 
        own frequencies and create custom tracks. This will allow for more personalized
        experiences and the ability to target specific brainwave states.
        </p>
        <p>However this will come at a greater price per track due to customization.</p>

        <h4>Specific Mode Playlists:</h4>
      <p>Specific mode playlists will available like "Focus Mode" or "Sleep Mode" which 
        will be curated by our team and based on user feedback. These playlists will be 
        optimized for their specific use cases and will provide a more tailored experience
         for users.</p>
        <p>These mode playlists will be free and selectable.</p>

        <h3>Soundara V2:</h3>

      <h4>Search Database</h4>
      <p>In version two, users will be able to search our database of tracks by specific
        frequencies, moods, or use cases. This will allow users to easily find tracks that
        fit their specific needs and preferences.</p>
        <p>Additionally, when uploading a song/track, you can use the search function 
          to find the song you want. Therefore making much easier to name the
          and the author.
          </p>

        <h4>Additional Music tools</h4>
      <p>Users will have a broader access to remix tools and beat creations. Allowing
        for there own song creations.
      </p>
      <h4>Direct upload</h4>  
      <p>Users who create original content either using the platform tools or from
        another source will be able to directly upload their tracks to the platform and share
        them with the community. This will foster a sense of community and allow for a wider variety
        of tracks to be available on the platform.
      </p>
      <h4>Royalty</h4>  
      <p>Following the direct upload, users will be able to profit from these
        direct uploads and creations. This will incentivize users to create and share high-quality content on the platform, and will also allow them to earn money from their creations.
      </p>

      <h3>Soundara V3</h3>
      <h4>AI Generated Tracks</h4>
      <p>In version three, we hope to implement AI generated tracks based on user preferences and feedback. This will allow for a more personalized and dynamic experience for users, as the AI will be able to create tracks that are tailored to their specific needs and preferences.</p>
      <h4>Mobile App</h4>
      <p>We are also planning to develop a mobile app for Soundara, which will allow users to access the platform on the go and create a more convenient experience for managing their binaural beats and meditation sessions.
        This will be more convenient and mobile friendly for users who want to use the platform while traveling or away from their computer.
      </p>
      <h2>Bottom Line</h2>
      <p>Overall, these future projections for Soundara aim to enhance the user experience by providing more customization options, a wider variety of tracks, and opportunities for users to create and share their own content. We are excited to continue developing and improving the platform based on user feedback and needs.</p>
      <p>We will be releasing version one shortly after launch and version two will come later on as we continue to develop the platform.</p>
      <p><strong>If you want to join the development team to improve Soundara, please contact us with the interest form below.</strong></p>
      <p>Thank you for being a part of the Soundara community and we look forward to sharing these exciting updates with you in the future!</p>
      {/* ===== Button to toggle survey form ===== */}
      <button 
        onClick={() => setShowForm(!showForm)}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          marginTop: "20px",
          cursor: "pointer"
        }}
      >
        {showForm ? "Close Survey" : "Join & Show Interest"}
      </button>

      {/* ===== Survey Form ===== */}
      {showForm && (
        <form 
          onSubmit={handleSubmit} 
          style={{ marginTop: "20px", border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}
        >
          <h3>Join Our Team Survey</h3>
          <input 
            type="text" 
            placeholder="Your Name" 
            value={name} 
            onChange={e => setName(e.target.value)}
            style={{ display:"block", marginBottom:"10px", width:"100%", padding:"8px" }}
          />
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            style={{ display:"block", marginBottom:"10px", width:"100%", padding:"8px" }}
          />
          <select 
            value={interest} 
            onChange={e => setInterest(e.target.value)}
            style={{ display:"block", marginBottom:"10px", width:"100%", padding:"8px" }}
          >
            <option value="">Select your area of interest</option>
            <option value="programming">Programming</option>
            <option value="design">Design</option>
            <option value="marketing">Marketing</option>
            <option value="other">Other</option>
          </select>
          <textarea 
            placeholder="Additional notes (optional)" 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            style={{ display:"block", marginBottom:"10px", width:"100%", padding:"8px", height:"80px" }}
          />
          <button type="submit" style={{ padding:"10px 20px", cursor:"pointer" }}>Submit</button>
          {submitStatus && (
            <p style={{ marginTop: "10px", color: submitStatus.includes("success") ? "#4caf50" : submitStatus === "Sending..." ? "#999" : "#f44336" }}>
              {submitStatus}
            </p>
          )}
        </form>
      )}
    </div>

  );
}