let audioContext;
let mediaRecorder;
let audioChunks = [];
let audioBuffer = null;  // Initialize as null
let source = null;       // Initialize source as null
let pitchShift = 1;
let isPlaying = false;
let loopEnabled = true;  // Loop enabled by default

let pitchControl = document.getElementById("pitch");

document.getElementById("start-record").addEventListener("click", startRecording);
document.getElementById("stop-record").addEventListener("click", stopRecording);
pitchControl.addEventListener("input", updatePitch);

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

    source.connect(audioContext.destination);
    source.start(0);

    isPlaying = true;

    // Detect when playback is finished
    source.onended = () => {
      isPlaying = false;
    };
  }
}
