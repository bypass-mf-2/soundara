import React from "react";

export default function About() {
  return (
    <div style={{ padding: "20px" }}>
      <div style={{ maxWidth: "800px", margin: "auto" }}>
        <h1>About Soundara</h1>
        <p>
          Soundara is a platform dedicated to creating immersive audio experiences.
          Our mission is to make high-quality binaural music accessible to everyone.
        </p>
        <p>
          You can upload your own tracks, explore our library, and enjoy personalized
          sound modes designed to enhance focus, relaxation, and sleep.
        </p>
        <p>
          This idea was originally inspired by experiments done by the Monroe Institute
          and the CIA in the 1980s. The program explored conscious enhancement, remote
          viewing, and altered states for intelligence gathering through hemi-sync,
          which is induced by binaural beats. Hemi-sync is the idea of syncing your
          left and right brain hemispheres together.
        </p>

        <h1 style={{ marginTop: "40px" }}>About Frequencies</h1>

        <section id="alpha" style={{ marginTop: "60px" }}>
          <h2>Alpha Waves</h2>
          <p>
            Alpha waves are associated with calm awareness, creativity, and
            relaxed focus. Ideal for studying and light meditation.
          </p>
        </section>

        <section id="beta" style={{ marginTop: "60px" }}>
          <h2>Beta Waves</h2>
          <p>
            Beta waves dominate during active thinking, problem solving,
            and alert mental states.
          </p>
        </section>

        <section id="theta" style={{ marginTop: "60px" }}>
          <h2>Theta Waves</h2>
          <p>
            Theta waves occur during deep meditation, intuition, and
            dream-like mental states.
          </p>
        </section>

        <section id="delta" style={{ marginTop: "60px" }}>
          <h2>Delta Waves</h2>
          <p>
            Delta waves are present during deep sleep and are linked to
            physical healing and recovery.
          </p>
        </section>

        <section id="schumann" style={{ marginTop: "60px" }}>
          <h2>Schumann Resonance</h2>
          <p>
            The Schumann Resonance (~7.83 Hz) is Earth’s natural frequency
            and is associated with grounding and balance.
          </p>
        </section>
      </div>
    </div>
  );
}