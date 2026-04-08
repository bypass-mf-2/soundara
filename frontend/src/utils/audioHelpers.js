/**
 * Load an audio file into an AudioBuffer
 */
export async function loadAudioBuffer(file, audioContext) {
  const arrayBuffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Encode an AudioBuffer to a WAV Blob
 */
export function renderToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channel data
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate an impulse response for reverb
 */
export function generateImpulseResponse(audioContext, duration = 2, decay = 2) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/**
 * Draw a waveform on a canvas element
 */
export function drawWaveform(canvas, audioBuffer, color = "#646cff") {
  const ctx = canvas.getContext("2d");
  const data = audioBuffer.getChannelData(0);
  const width = canvas.width;
  const height = canvas.height;
  const step = Math.ceil(data.length / width);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  const mid = height / 2;
  for (let i = 0; i < width; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const val = data[i * step + j] || 0;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    ctx.moveTo(i, mid + min * mid);
    ctx.lineTo(i, mid + max * mid);
  }
  ctx.stroke();
}

/**
 * Synthesize a basic drum sound
 */
export function synthesizeDrum(audioContext, type = "kick") {
  const sampleRate = audioContext.sampleRate;
  const duration = type === "kick" ? 0.5 : type === "snare" ? 0.3 : 0.1;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "kick") {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const freq = 150 * Math.exp(-t * 10);
      data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5);
    }
  } else if (type === "snare") {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const tone = Math.sin(2 * Math.PI * 200 * t);
      data[i] = (noise * 0.7 + tone * 0.3) * Math.exp(-t * 10);
    }
  } else if (type === "hihat") {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40);
    }
  } else if (type === "clap") {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const env = t < 0.02 ? 1 : Math.exp(-(t - 0.02) * 15);
      data[i] = noise * env;
    }
  }

  return buffer;
}
