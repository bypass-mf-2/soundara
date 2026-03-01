function AudioPlayer({ audioUrl }) {
  return (
    <div>
      <h3>Output</h3>
      <audio controls src={audioUrl} />
      <br />
      <a href={audioUrl} download="binaural_output.wav">
        Download
      </a>
    </div>
  );
}

export default AudioPlayer;
