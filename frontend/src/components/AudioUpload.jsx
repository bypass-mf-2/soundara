function AudioUpload({ setFile }) {
  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files[0])}
      />
    </div>
  );
}

export default AudioUpload;
