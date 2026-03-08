import React, { useState } from "react";
import contactImage from "../assets/TrevorGoodwill.JPEG";

export default function Contact() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !interest) return alert("Please fill all required fields");

    try {
      const res = await fetch("http://localhost:8000/submit_survey/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, interest, notes })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("Thank you for joining! We'll reach out soon.");
        setName(""); setEmail(""); setInterest(""); setNotes("");
        setShowForm(false);
      } else {
        alert("Failed to submit survey. Try again later.");
      }
    } catch (err) {
      alert("Error submitting survey: " + err.message);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Contact</h1>
      <p>This project was created by Trevor Goodwill.</p>
      <img 
        src={contactImage} 
        alt="Contact" 
        style={{ maxWidth: "100%", height: "auto", marginTop: "20px" }}
      />
      <p>Trevor Goodwill is in his first year as a cadet at the United States Air Force Academy in Colorado Springs, Colorado.</p>
      <p>
        I am very excited to be publishing this and it has been a lot of work. If you are interested as well and want to help,
        my contact is 518-801-4833 / trevorm.goodwill@gmail.com.
      </p>
      <p>However, feedback is always welcomed.</p>

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
        </form>
      )}
    </div>
  );
}