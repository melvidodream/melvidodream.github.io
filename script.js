let audioContext;
let mediaRecorder;
let audioChunks = [];
let audioBuffer = null;
let source = null;
let pitchShift = 1;
let isPlaying = false;
let loopEnabled = true;

let pitchControl = document.getElementById("pitch");
let volumeControl = document.getElementById("volume");
let reverbControl = document.getElementById("reverb");
let lowpassControl = document.getElementById("lowpass");

document.getElementById("start-record").addEventListener("click", startRecording);
document.getElementById("stop-record").addEventListener("click", stopRecording);
pitchControl.addEventListener("input", updatePitch);
volumeControl.addEventListener("input", updateVolume);
reverbControl.addEventListener("input", updateReverb);
lowpassControl.addEventListener("input", updateLowpass);

let gainNode;
let reverbGainNode;  // Separate gain for reverb
let convolver;
let lowpassFilter;

async function startRecording() {
  if (isPlaying && source) {
    source.stop();
    isPlaying = false;
  }

  audioBuffer = null;
  source = null;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  audioChunks = [];
  mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
  
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/wav' });
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    playRecording();

    document.getElementById("start-record").disabled = false;
  };

  mediaRecorder.start();
  document.getElementById("start-record").disabled = true;
  document.getElementById("stop-record").disabled = false;

  // Create audio processing nodes
  gainNode = audioContext.createGain(); // Main gain node for dry signal
  reverbGainNode = audioContext.createGain(); // Gain node for reverb send
  convolver = audioContext.createConvolver(); // Convolver for reverb
  lowpassFilter = audioContext.createBiquadFilter();
  lowpassFilter.type = 'lowpass';
  lowpassFilter.frequency.value = parseFloat(lowpassControl.value);

  // Connect the dry signal to the output (audioContext.destination)
  gainNode.connect(audioContext.destination);

  // Connect reverb signal path in parallel
  reverbGainNode.connect(convolver);
  convolver.connect(audioContext.destination);
}

function stopRecording() {
  mediaRecorder.stop();
  document.getElementById("stop-record").disabled = true;
}

function updatePitch() {
  pitchShift = parseFloat(pitchControl.value);
  if (isPlaying && source) {
    source.playbackRate.value = pitchShift;
  }
}

function updateVolume() {
  const volumeValue = parseFloat(volumeControl.value);
  gainNode.gain.value = volumeValue;
}

async function updateReverb() {
  const reverbValue = parseFloat(reverbControl.value);

  if (reverbValue > 0) {
    try {
      const response = await fetch("./in_the_silo.wav"); // Ensure the file exists and is reachable
      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.statusText);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      convolver.buffer = buffer;

      // Control the reverb gain value for wet signal
      reverbGainNode.gain.setValueAtTime(reverbValue, audioContext.currentTime);
    } catch (error) {
      console.error('Error loading impulse response:', error);
    }
  } else {
    // If reverb is off, set gain to zero
    reverbGainNode.gain.setValueAtTime(0, audioContext.currentTime);
  }
}

function updateLowpass() {
  const lowpassValue = parseFloat(lowpassControl.value);
  lowpassFilter.frequency.value = lowpassValue;
}

function playRecording() {
  if (audioBuffer) {
    if (isPlaying && source) {
      source.stop();
      isPlaying = false;
    }

    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = pitchShift;
    source.loop = loopEnabled;

    // Dry signal path
    source.connect(lowpassFilter);
    lowpassFilter.connect(gainNode);

    // Wet signal path (parallel)
    source.connect(reverbGainNode);

    source.start(0);
    isPlaying = true;

    source.onended = () => {
      isPlaying = false;
    };
  }
}
