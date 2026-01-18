const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const toggleButton = document.getElementById("toggle");
const statusText = document.getElementById("status");
const resultText = document.getElementById("result");

const overlayContext = overlay.getContext("2d");
const captureCanvas = document.createElement("canvas");
const captureContext = captureCanvas.getContext("2d", { willReadFrequently: true });

let scanning = false;
let animationFrameId = null;
let activeStream = null;
let lastDetected = "";
let lastScanTime = 0;

const updateStatus = (message) => {
  statusText.textContent = message;
};

const updateResult = (message) => {
  resultText.textContent = message;
};

const stopCamera = () => {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  scanning = false;
  toggleButton.textContent = "Start scanning";
  updateStatus("Camera stopped.");
};

const drawOverlay = (location) => {
  overlayContext.clearRect(0, 0, overlay.width, overlay.height);
  if (!location) {
    return;
  }
  overlayContext.strokeStyle = "#22d3ee";
  overlayContext.lineWidth = 4;
  overlayContext.beginPath();
  overlayContext.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
  overlayContext.lineTo(location.topRightCorner.x, location.topRightCorner.y);
  overlayContext.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
  overlayContext.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
  overlayContext.closePath();
  overlayContext.stroke();
};

const scanFrame = (timestamp) => {
  if (!scanning) {
    return;
  }

  const throttleMs = 80;
  if (timestamp - lastScanTime < throttleMs) {
    animationFrameId = requestAnimationFrame(scanFrame);
    return;
  }
  lastScanTime = timestamp;

  if (video.readyState >= 2) {
    const { videoWidth, videoHeight } = video;
    if (videoWidth && videoHeight) {
      captureCanvas.width = videoWidth;
      captureCanvas.height = videoHeight;
      overlay.width = videoWidth;
      overlay.height = videoHeight;

      captureContext.drawImage(video, 0, 0, videoWidth, videoHeight);
      const imageData = captureContext.getImageData(0, 0, videoWidth, videoHeight);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        if (code.data !== lastDetected) {
          lastDetected = code.data;
          updateResult(code.data);
        }
        updateStatus("QR code detected.");
        drawOverlay(code.location);
      } else {
        updateStatus("Scanning for codes...");
        drawOverlay(null);
      }
    }
  }

  animationFrameId = requestAnimationFrame(scanFrame);
};

const startCamera = async () => {
  if (scanning) {
    return;
  }
  try {
    updateStatus("Requesting camera access...");
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
      },
      audio: false,
    });
    video.srcObject = activeStream;
    await video.play();
    scanning = true;
    toggleButton.textContent = "Stop scanning";
    updateStatus("Scanning for codes...");
    animationFrameId = requestAnimationFrame(scanFrame);
  } catch (error) {
    updateStatus("Unable to access camera. Check permissions.");
    console.error(error);
  }
};

toggleButton.addEventListener("click", () => {
  if (scanning) {
    stopCamera();
  } else {
    startCamera();
  }
});

window.addEventListener("beforeunload", () => {
  stopCamera();
});
