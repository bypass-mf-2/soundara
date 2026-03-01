export default function FileUpload({ setAudioFile }) {
  return (
    <input
      type="file"
      accept="audio/*"
      onChange={(e) => setAudioFile(e.target.files[0])}
    />
  );
}
