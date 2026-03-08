// frontend/src/components/AudioUpload.jsx
import { trackEvent } from "../trackEvent"; // make sure this path is correct

function AudioUpload({ setFile }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1️⃣ Update the parent state
    setFile(file);

    // 2️⃣ Track the upload event
    trackEvent({
      type: "audio_upload",
      filename: file.name,
      size: file.size, // optional: track file size
      upload_time: new Date().toISOString(),
    });
  };

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
      />
    </div>
  );
}

export default AudioUpload;