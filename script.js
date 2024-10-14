let audioContext;
let mediaRecorder;
let audioChunks = [];
let audioBuffer = null;  // Initialize as null
let source = null;       // Initialize source as null
let pitchShift = 1;
let isPlaying = false;
let loopEnabled = true;  // Loop enabled by default

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
let convolver;
let lowpassFilter;

async function startRecording() {
  // Stop the current playback if it's still playing
  if (isPlaying && source) {
    source.stop();
    isPlaying = false;
  }

  // Clear the previous audio buffer and source
  audioBuffer = null;
  source = null;

  // Initialize a new AudioContext and start recording
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  audioChunks = [];  // Reset the audio chunks to allow a new recording
  mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
  
  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/wav' });
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Auto-play the recording after it's stopped
    playRecording();

    // Re-enable start button to allow a new recording
    document.getElementById("start-record").disabled = false;
  };

  mediaRecorder.start();
  document.getElementById("start-record").disabled = true;
  document.getElementById("stop-record").disabled = false;

  // Create audio processing nodes
  gainNode = audioContext.createGain();
  convolver = audioContext.createConvolver();
  lowpassFilter = audioContext.createBiquadFilter();
  lowpassFilter.type = 'lowpass';
  lowpassFilter.frequency.value = parseFloat(lowpassControl.value);
  
  // Connect nodes in order: source -> lowpass -> gain -> convolver -> destination
  gainNode.connect(convolver);
  convolver.connect(audioContext.destination);
  lowpassFilter.connect(gainNode);
}

function stopRecording() {
  mediaRecorder.stop();
  document.getElementById("stop-record").disabled = true;
}

function updatePitch() {
  pitchShift = parseFloat(pitchControl.value);
  
  // Update the playback rate if the audio is playing
  if (isPlaying && source) {
    source.playbackRate.value = pitchShift;
  }
}

function updateVolume() {
  const volumeValue = parseFloat(volumeControl.value);
  gainNode.gain.value = volumeValue; // Update gain node value
}

async function updateReverb() {
  const reverbValue = parseFloat(reverbControl.value);

  if (reverbValue > 0) {
    try {
      // Fetch the impulse response file
      const response = await fetch("./in_the_silo.wav"); // Ensure the file exists and is reachable
      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.statusText);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      convolver.buffer = buffer; // Set the buffer for the convolver

      gainNode.connect(convolver); // Connect gain node to convolver
    } catch (error) {
      console.error('Error loading impulse response:', error);
    }
  } else {
    gainNode.disconnect(convolver); // Disconnect if reverb is off
  }
}

function updateLowpass() {
  const lowpassValue = parseFloat(lowpassControl.value);
  lowpassFilter.frequency.value = lowpassValue; // Update low pass filter frequency
}

function playRecording() {
  if (audioBuffer) {
    // Stop the current playback if already playing
    if (isPlaying && source) {
      source.stop();
      isPlaying = false;
    }

    // Create a new buffer source for playback
    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Set the playback rate based on the current pitch shift value
    source.playbackRate.value = pitchShift;

    // Loop the audio by default
    source.loop = loopEnabled;

    // Connect the source to the lowpass filter, then to the gain node
    source.connect(lowpassFilter);
    lowpassFilter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);

    isPlaying = true;

    // Detect when playback is finished
    source.onended = () => {
      isPlaying = false;
    };
  }
}
