import React from "react";
import contactImage from "../assets/TrevorGoodwill.JPEG";

// Contact.jsx
export default function Contact() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Contact</h1>
      <p>This project was created by Trevor Goodwill.</p>
      {/* Display the picture */}
      <img 
        src={contactImage} 
        alt="Contact" 
        style={{ maxWidth: "100%", height: "auto", marginTop: "20px" }}
      />
      <p>Trevor Goodwill is in his first year as a cadet at the United States Air Force Academy in Colorado Springs, Colorado.</p>
      <p>I am very excited to be publishing this and it has been a lot of work. If you are interested as well and want to help
        my contact is 518-801-4833/trevorm.goodwill@gmail.com. It took a lot of work to learn how to code and
        create websites, so forgive if it isn't the nicest for a good while.
      </p>
      <p>However, feedback is always welcomed.</p>
    </div>
  );
}