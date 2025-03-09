// DOM Elements
const videoElement = document.getElementById('video');
const outputCanvas = document.getElementById('output');
const recordedVideo = document.getElementById('recorded');
const recordedOutputCanvas = document.getElementById('recordedOutput');
const startBtn = document.getElementById('startBtn');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const poseInfoDiv = document.getElementById('poseInfo');
const recordedWrapper = document.querySelector('.recorded-wrapper');
const showFrameBtn = document.getElementById('showFrameBtn');
const selectPoseBtn = document.getElementById('selectPoseBtn');
const selectedPoseModeBtn = document.getElementById('selectedPoseModeBtn');
const selectedPoseMode = document.getElementById('selectedPoseMode');
const selectedPoseCanvas = document.getElementById('selectedPoseCanvas');
const selectedPoseInfo = document.getElementById('selectedPoseInfo');
const clearPoseBtn = document.getElementById('clearPoseBtn');
const startComparisonBtn = document.getElementById('startComparisonBtn');
const poseComparisonModeBtn = document.getElementById('poseComparisonModeBtn');
const poseComparisonMode = document.getElementById('poseComparisonMode');
const comparisonVideo = document.getElementById('comparisonVideo');
const comparisonCanvas = document.getElementById('comparisonCanvas');
const referencePoseCanvas = document.getElementById('referencePoseCanvas');
const matchScore = document.getElementById('matchScore');
const matchDetails = document.getElementById('matchDetails');
const startCameraBtn = document.getElementById('startCameraBtn');
const stopComparisonBtn = document.getElementById('stopComparisonBtn');
const recordComparisonBtn = document.getElementById('recordComparisonBtn');
const stopComparisonRecordingBtn = document.getElementById('stopComparisonRecordingBtn');
const downloadComparisonBtn = document.getElementById('downloadComparisonBtn');

// Frame viewer elements
const frameSlider = document.getElementById('frameSlider');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const maxFrameLabel = document.getElementById('maxFrameLabel');
const frameCanvas = document.getElementById('frameCanvas');

// Mode selector elements
const cameraModeBtn = document.getElementById('cameraModeBtn');
const analysisModeBtn = document.getElementById('analysisModeBtn');
const frameModeBtn = document.getElementById('frameModeBtn');
const cameraModeDiv = document.getElementById('cameraMode');
const analysisModeDiv = document.getElementById('analysisMode');
const frameModeDiv = document.getElementById('frameMode');

// Canvas contexts
const ctx = outputCanvas.getContext('2d');
const recordedCtx = recordedOutputCanvas.getContext('2d');
const frameCtx = frameCanvas.getContext('2d');

// Global variables
let stream;
let detector;
let mediaRecorder;
let recordedBlob;
let isRecording = false;
let isAnalyzing = false;
let animationId;
let currentMode = 'camera'; // 'camera' or 'frame' or 'selectedPose' or 'comparison'
let timeUpdateHandler = null; // Reference to timeupdate event handler
let selectedPose = null; // Store the selected pose data
let comparisonAnimationId = null;

// Variables for comparison recording
let comparisonMediaRecorder = null;
let comparisonRecordedChunks = [];
let comparisonRecordedBlob = null;
let isRecordingComparison = false;

// COCO keypoint connections for skeleton drawing (used by MoveNet)
const KEYPOINT_CONNECTIONS = [
    // Removed nose connections
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'], ['right_shoulder', 'right_elbow'],
    ['left_elbow', 'left_wrist'], ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
    ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle']
];

// Set up event listeners
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing app...');
    
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('Browser API navigator.mediaDevices.getUserMedia not available');
        alert('Your browser does not support the required features. Please use a modern browser like Chrome, Firefox, or Edge.');
        return;
    }
    
    console.log('TensorFlow.js version:', tf.version);
    
    // Check if pose-detection is loaded
    if (typeof poseDetection === 'undefined') {
        console.error('Pose Detection library is not loaded. Please check your internet connection and try again.');
        alert('Error: Pose Detection library could not be loaded. Please check your internet connection and try again.');
        return;
    }
    
    console.log('Pose Detection library is loaded');
    
    // Set canvas size to avoid scaling issues
    outputCanvas.width = 640;
    outputCanvas.height = 480;
    recordedOutputCanvas.width = 640;
    recordedOutputCanvas.height = 480;
    frameCanvas.width = 640;
    frameCanvas.height = 480;
    
    // Initialize pose detector
    await initPoseDetector();
    
    // Add event listeners for mode switching
    cameraModeBtn.addEventListener('click', () => switchMode('camera'));
    analysisModeBtn.addEventListener('click', () => switchMode('analysis'));
    frameModeBtn.addEventListener('click', () => switchMode('frame'));
    selectedPoseModeBtn.addEventListener('click', () => switchMode('selectedPose'));
    poseComparisonModeBtn.addEventListener('click', () => switchMode('comparison'));
    
    // Add event listener for the Show Frame button
    document.getElementById('showFrameBtn').addEventListener('click', showFrame);
    selectPoseBtn.addEventListener('click', selectPose);
});

// Switch between camera, analysis, frame selection, selected pose, and comparison modes
function switchMode(mode) {
    if (mode === currentMode) return;
    
    console.log(`Switching to ${mode} mode`);
    
    try {
        // Check if we're trying to switch to a mode that requires a recorded video
        if ((mode === 'analysis' || mode === 'frame') && (!recordedBlob || recordedBlob.size === 0)) {
            alert('Please record a video first before switching to ' + (mode === 'analysis' ? 'Analysis' : 'Frame Selection') + ' Mode.');
            return;
        }
        
        // Check if we're trying to switch to selected pose mode without a selected pose
        if (mode === 'selectedPose' && !selectedPose) {
            alert('Please select a pose first before switching to Selected Pose Mode.');
            return;
        }
        
        // Check if we're trying to switch to comparison mode without a selected pose
        if (mode === 'comparison' && !selectedPose) {
            alert('Please select a pose first before switching to Pose Comparison Mode.');
            return;
        }
        
        // If we're leaving comparison mode, stop the camera
        if (currentMode === 'comparison') {
            stopComparisonCamera();
        }
        
    currentMode = mode;
    
    // Update button states
    cameraModeBtn.classList.toggle('active', mode === 'camera');
        analysisModeBtn.classList.toggle('active', mode === 'analysis');
    frameModeBtn.classList.toggle('active', mode === 'frame');
        selectedPoseModeBtn.classList.toggle('active', mode === 'selectedPose');
        poseComparisonModeBtn.classList.toggle('active', mode === 'comparison');
    
    // Show/hide appropriate sections
    cameraModeDiv.style.display = mode === 'camera' ? 'block' : 'none';
        analysisModeDiv.style.display = mode === 'analysis' ? 'block' : 'none';
    frameModeDiv.style.display = mode === 'frame' ? 'block' : 'none';
        selectedPoseMode.style.display = mode === 'selectedPose' ? 'block' : 'none';
        poseComparisonMode.style.display = mode === 'comparison' ? 'block' : 'none';
        
        // Show/hide pose information panel
        const infoPanel = document.querySelector('.info-panel');
        infoPanel.style.display = (mode === 'selectedPose' || mode === 'comparison') ? 'none' : 'block';
    
    // Handle mode-specific actions
        if (mode === 'selectedPose' && selectedPose) {
            displaySelectedPose();
        }
        
        if (mode === 'comparison' && selectedPose) {
            displayReferencePose();
        }
        
    if (mode === 'camera') {
        // If we're switching to camera mode, stop any ongoing analysis
        if (isAnalyzing) {
            stopAnalysis();
        }
        } else if (mode === 'analysis') {
            // If we're switching to analysis mode, stop the camera stream if it's active
            if (stream) {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                console.log('Camera stream stopped');
            }
            
            // Prepare the recorded video for analysis
            prepareVideoAnalysis();
        } else if (mode === 'frame') {
            // If we're switching to frame mode, stop any ongoing processes
            if (isAnalyzing) {
                stopAnalysis();
            }
            
            if (stream) {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                console.log('Camera stream stopped');
            }
            
            // Clear the frame canvas
            if (frameCtx) {
                frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
            }
            
            // Start frame extraction process
            console.log('Starting frame extraction for Frame Selection Mode...');
            
            // Show a loading message
            currentTimeDisplay.textContent = 'Extracting frames...';
            
            // Disable the Show Frame button during extraction
            showFrameBtn.disabled = true;
            showFrameBtn.textContent = 'Extracting Frames...';
            
            // Extract frames in the background
            setTimeout(async () => {
                try {
                    // Reset the video element first to ensure it's in a good state
                    await resetVideoElement();
                    
                    const success = await extractFramesFromVideo();
                    if (success) {
                        console.log('Frame extraction completed successfully');
    } else {
                        console.error('Frame extraction failed');
                        alert('Failed to extract frames from the video. Please try again or record a new video.');
                        // Switch back to camera mode if extraction fails
            switchMode('camera');
        }
                } catch (error) {
                    console.error('Error during frame extraction:', error);
                    alert('An error occurred during frame extraction: ' + error.message);
                    // Switch back to camera mode if extraction fails
                    switchMode('camera');
                } finally {
                    // Re-enable the Show Frame button
                    showFrameBtn.disabled = false;
                    showFrameBtn.textContent = 'Show Frame';
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error switching modes:', error);
        alert('Error switching to ' + mode + ' mode: ' + error.message);
    }
}

// Stop ongoing analysis
function stopAnalysis() {
    if (isAnalyzing) {
        isAnalyzing = false;
        
        if (recordedVideo && !recordedVideo.paused) {
            recordedVideo.pause();
        }
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        console.log('Analysis stopped');
    }
}

// Prepare video analysis when switching to analysis mode
function prepareVideoAnalysis() {
    if (!recordedBlob || !detector) {
        console.error('No recorded video or detector not initialized');
        return;
    }
    
    console.log('Preparing video analysis');
    
    // Start video analysis if not already analyzing
    if (!isAnalyzing) {
        isAnalyzing = true;
        startVideoAnalysis();
    }
}

// Initialize pose detector
async function initPoseDetector() {
    try {
        console.log('Initializing pose detector...');
        
        // Create detector
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
            enableSmoothing: true,
            minPoseScore: 0.25
            }
        );
        
        console.log('Pose detector initialized successfully');
        startBtn.disabled = false;
        return true;
    } catch (error) {
        console.error('Error initializing pose detector:', error);
        alert('Error initializing pose detector. Please check the console for details.');
        return false;
    }
}

// Start the camera
async function startCamera() {
    try {
        console.log('Requesting camera access...');
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            },
            audio: true
        });
        
        console.log('Camera access granted');
        videoElement.srcObject = stream;
                    await videoElement.play();
        
        // Update UI
                        startBtn.disabled = true;
        recordBtn.disabled = false;
                        
        // Start pose detection
        isAnalyzing = true;
                        detectPoseInRealTime();
        
        return true;
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error accessing camera: ' + error.message + '\nPlease make sure you have a camera connected and have granted permission.');
        startBtn.disabled = false;
        return false;
    }
}

// Detect pose in real-time
async function detectPoseInRealTime() {
    if (!detector) {
        console.error('Pose detector not initialized');
        return;
    }
    
    if (videoElement.paused || videoElement.ended) {
        console.log('Video is paused or ended, stopping pose detection');
        return;
    }
    
    try {
        // Make sure the video is ready
        if (videoElement.readyState < 2) {
            console.log('Video not ready yet, waiting...');
            animationId = requestAnimationFrame(detectPoseInRealTime);
            return;
        }
        
        // Update canvas dimensions to match the video's actual display size
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        const displayWidth = videoElement.clientWidth;
        const displayHeight = videoElement.clientHeight;
        
        // Set canvas dimensions to match the video display size
        outputCanvas.width = displayWidth;
        outputCanvas.height = displayHeight;
        
        // Detect poses
        console.log('Estimating poses on video frame');
        const poses = await detector.estimatePoses(videoElement, {
            flipHorizontal: false
        });
        
        console.log('Poses detected:', poses.length > 0 ? 'Yes' : 'No');
        
        // Clear canvas
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        
        // Draw results
        if (poses.length > 0) {
            console.log('Drawing pose with keypoints:', poses[0].keypoints.length);
            
            // Scale keypoints to match the display size
            const scaledPose = {
                ...poses[0],
                keypoints: poses[0].keypoints.map(keypoint => ({
                    ...keypoint,
                    x: (keypoint.x / videoWidth) * displayWidth,
                    y: (keypoint.y / videoHeight) * displayHeight
                }))
            };
            
            drawPose(scaledPose, ctx);
            updatePoseInfo(scaledPose);
        }
        
        // Continue detection
        animationId = requestAnimationFrame(detectPoseInRealTime);
    } catch (error) {
        console.error('Error in pose detection:', error);
        // Try to continue despite errors
        animationId = requestAnimationFrame(detectPoseInRealTime);
    }
}

// Draw pose keypoints and skeleton
function drawPose(pose, context, color = { keypoints: '#ff0000', skeleton: '#00ff00' }) {
    if (!pose || !pose.keypoints) return;
    
    // Define the keypoints we want to display
    const keyPointsToDisplay = [
        'nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee',
        'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    // Draw the skeleton connections
    if (pose.keypoints && pose.keypoints.length > 0) {
        const keypointMap = {};
        pose.keypoints.forEach(keypoint => {
            keypointMap[keypoint.name] = keypoint;
        });
        
        // Draw the skeleton lines
        KEYPOINT_CONNECTIONS.forEach(([start, end]) => {
            const startKeypoint = keypointMap[start];
            const endKeypoint = keypointMap[end];
            
            if (startKeypoint && endKeypoint && 
                startKeypoint.score > 0.3 && endKeypoint.score > 0.3) {
                context.beginPath();
                context.moveTo(startKeypoint.x, startKeypoint.y);
                context.lineTo(endKeypoint.x, endKeypoint.y);
                context.lineWidth = 2;
                context.strokeStyle = color.skeleton;
                context.stroke();
            }
        });
    }
    
    // Draw only the keypoints we're interested in
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.3 && keyPointsToDisplay.includes(keypoint.name)) {
            // Draw keypoint
            context.beginPath();
            context.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            context.fillStyle = color.keypoints;
            context.fill();
            
            // Remove text label rendering
            // No longer displaying keypoint names
        }
    });
}

// Update pose information display
function updatePoseInfo(pose) {
    if (!pose || !pose.keypoints) return;
    
    // Define the keypoints we want to display
    const keyPointsToDisplay = [
        'nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee',
        'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    // Clear previous info
    poseInfoDiv.innerHTML = '';
    
    // Display confidence score
    const scoreElement = document.createElement('div');
    scoreElement.classList.add('keypoint');
    scoreElement.textContent = `Overall confidence: ${(pose.score * 100).toFixed(1)}%`;
    poseInfoDiv.appendChild(scoreElement);
    
    // Display keypoint positions with confidence > 50% (only for keypoints we're interested in)
    for (const keypoint of pose.keypoints) {
        if (keypoint.score > 0.5 && keyPointsToDisplay.includes(keypoint.name)) {
            const keypointElement = document.createElement('div');
            keypointElement.classList.add('keypoint');
            keypointElement.textContent = `${keypoint.name}: (${Math.round(keypoint.x)}, ${Math.round(keypoint.y)}) - ${(keypoint.score * 100).toFixed(1)}%`;
            poseInfoDiv.appendChild(keypointElement);
        }
    }
}

// Start recording
function startRecording() {
    if (!stream) {
        console.error('[DIAGNOSIS] No active stream to record');
        alert('No camera stream available. Please start the camera first.');
        return;
    }
    
    console.log('[DIAGNOSIS] Starting recording process...');
    console.log('[DIAGNOSIS] Stream tracks:', stream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted
    })));
    
    try {
        // Check for supported MIME types
        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];
        
        console.log('[DIAGNOSIS] Checking supported MIME types...');
        let selectedMimeType = null;
        for (const mimeType of mimeTypes) {
            const isSupported = MediaRecorder.isTypeSupported(mimeType);
            console.log(`[DIAGNOSIS] MIME type ${mimeType}: ${isSupported ? 'supported' : 'not supported'}`);
            if (isSupported) {
                selectedMimeType = mimeType;
                break;
            }
        }
        
        if (!selectedMimeType) {
            console.warn('[DIAGNOSIS] None of the preferred MIME types are supported, using default');
            selectedMimeType = '';  // Let the browser choose
        }
        
        // Create media recorder with options
        const options = {
            mimeType: selectedMimeType,
            videoBitsPerSecond: 2500000  // 2.5 Mbps
        };
        
        console.log('[DIAGNOSIS] Creating MediaRecorder with options:', options);
        mediaRecorder = new MediaRecorder(stream, options);
        console.log('[DIAGNOSIS] MediaRecorder created successfully');
        
        // Set up data handling
        const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
            console.log(`[DIAGNOSIS] Data available event, data size: ${e.data ? e.data.size : 'null'} bytes, type: ${e.data ? e.data.type : 'null'}`);
        if (e.data && e.data.size > 0) {
            chunks.push(e.data);
                console.log(`[DIAGNOSIS] Added chunk, total chunks: ${chunks.length}`);
            } else {
                console.warn('[DIAGNOSIS] Received empty data chunk');
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('[DIAGNOSIS] MediaRecorder error:', event.error);
            alert('Recording error: ' + event.error);
            stopRecording();
        };
    
    mediaRecorder.onstop = () => {
            console.log(`[DIAGNOSIS] Recording stopped, collected ${chunks.length} chunks`);
            
            if (chunks.length === 0) {
                console.error('[DIAGNOSIS] No data was recorded');
                alert('No video data was recorded. Please try again.');
                return;
            }
            
            console.log('[DIAGNOSIS] Creating blob from chunks...');
            recordedBlob = new Blob(chunks, { type: selectedMimeType || 'video/webm' });
            console.log('[DIAGNOSIS] Recording saved, size:', recordedBlob.size, 'bytes, type:', recordedBlob.type);
            
            if (recordedBlob.size === 0) {
                console.error('[DIAGNOSIS] Recorded blob is empty');
                alert('The recorded video is empty. Please try again with a different browser or check your camera permissions.');
                return;
            }
            
            console.log('[DIAGNOSIS] Creating object URL from blob...');
        const videoURL = URL.createObjectURL(recordedBlob);
            console.log('[DIAGNOSIS] Setting video source to new URL...');
        recordedVideo.src = videoURL;
            
            // Make sure the video loads properly
            recordedVideo.onloadedmetadata = () => {
                console.log('[DIAGNOSIS] Recorded video metadata loaded:', {
                    duration: recordedVideo.duration,
                    dimensions: `${recordedVideo.videoWidth}x${recordedVideo.videoHeight}`,
                    readyState: recordedVideo.readyState
                });
                
                // Enable analyze button only if we have valid video data
                if (recordedVideo.duration > 0 && recordedVideo.videoWidth > 0) {
                    console.log('[DIAGNOSIS] Video appears valid, enabling analyze button');
        analyzeBtn.disabled = false;
                } else {
                    console.error('[DIAGNOSIS] Recorded video has invalid properties');
                    alert('The recorded video appears to be invalid. Please try again.');
                }
            };
            
            recordedVideo.onerror = (error) => {
                console.error('[DIAGNOSIS] Error loading recorded video:', error);
                console.error('[DIAGNOSIS] Video error details:', recordedVideo.error);
                alert('Error loading the recorded video. Please try again.');
            };
            
            // Force the video to load
            console.log('[DIAGNOSIS] Forcing video to load...');
            recordedVideo.load();
        };
        
        // Start recording with timeslice to get data periodically
        console.log('[DIAGNOSIS] Starting MediaRecorder with 1000ms timeslice...');
        mediaRecorder.start(1000);  // Get data every second
    isRecording = true;
    
    // Update UI
    recordBtn.disabled = true;
    stopBtn.disabled = false;
        
        console.log('[DIAGNOSIS] Recording started successfully');
    } catch (error) {
        console.error('[DIAGNOSIS] Error starting recording:', error);
        alert('Failed to start recording: ' + error.message);
        recordBtn.disabled = false;
    }
}

// Stop recording
function stopRecording() {
    if (!mediaRecorder || !isRecording) {
        console.error('No active recording to stop');
        return;
    }
    
    mediaRecorder.stop();
    isRecording = false;
    console.log('Recording stopped');
    
    // Update UI
    stopBtn.disabled = true;
    recordBtn.disabled = false;
}

// Analyze recorded video
async function analyzeRecordedVideo() {
    if (!recordedBlob || !detector) {
        console.error('No recorded video or detector not initialized');
        return;
    }
    
    // Stop recording if it's active
    if (isRecording) {
        stopRecording();
    }
    
    // Stop real-time pose detection
    if (isAnalyzing) {
        isAnalyzing = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }
    
    // Switch to analysis mode
    switchMode('analysis');
}

// Start the video analysis process
async function startVideoAnalysis() {
    try {
        // Play the recorded video
        await recordedVideo.play();
        console.log('Recorded video is playing for analysis');
        
        // Make sure the frame slider is initialized
        if (totalFrames === 0) {
            estimateFrameRate();
            initFrameSlider();
        }
        
        // Analyze each frame
        analyzeFrame();
    } catch (error) {
        console.error('Error playing recorded video:', error);
        isAnalyzing = false;
        analyzeBtn.disabled = false;
    }
}

// Analyze a single frame of the recorded video
async function analyzeFrame() {
    if (recordedVideo.paused || recordedVideo.ended) {
            isAnalyzing = false;
            analyzeBtn.disabled = false;
            console.log('Video analysis complete');
        return;
    }
    
    try {
        // Make sure the video is ready
        if (recordedVideo.readyState < 2) {
            console.log('Recorded video not ready yet, waiting...');
            requestAnimationFrame(analyzeFrame);
            return;
        }
        
        // Update canvas dimensions to match the video's actual display size
        const videoWidth = recordedVideo.videoWidth;
        const videoHeight = recordedVideo.videoHeight;
        const displayWidth = recordedVideo.clientWidth;
        const displayHeight = recordedVideo.clientHeight;
        
        // Set canvas dimensions to match the video display size
        recordedOutputCanvas.width = displayWidth;
        recordedOutputCanvas.height = displayHeight;
        
        // Detect poses on current frame
        console.log('Estimating poses on recorded video frame');
        const poses = await detector.estimatePoses(recordedVideo, {
            flipHorizontal: false
        });
        
        console.log('Poses detected in recorded video:', poses.length > 0 ? 'Yes' : 'No');
        
        // Clear canvas
        recordedCtx.clearRect(0, 0, recordedOutputCanvas.width, recordedOutputCanvas.height);
        
        // Draw results
        if (poses.length > 0) {
            console.log('Drawing pose on recorded video with keypoints:', poses[0].keypoints.length);
            
            // Scale keypoints to match the display size
            const scaledPose = {
                ...poses[0],
                keypoints: poses[0].keypoints.map(keypoint => ({
                    ...keypoint,
                    x: (keypoint.x / videoWidth) * displayWidth,
                    y: (keypoint.y / videoHeight) * displayHeight
                }))
            };
            
            drawPose(scaledPose, recordedCtx);
            updatePoseInfo(scaledPose);
        }
        
        // Continue analysis
        requestAnimationFrame(analyzeFrame);
    } catch (error) {
        console.error('Error analyzing frame:', error);
        // Try to continue despite errors
        requestAnimationFrame(analyzeFrame);
    }
}

// Initialize frame slider
function initFrameSlider() {
    if (!recordedVideo || !recordedBlob) {
        console.error('No recorded video available');
        return;
    }
    
    console.log('Initializing time slider');
    
    // Make sure the recorded video has the correct source
    if (!recordedVideo.src || recordedVideo.src === '') {
        const videoURL = URL.createObjectURL(recordedBlob);
        recordedVideo.src = videoURL;
    }
    
    // Define event handlers
    const loadMetadataHandler = () => {
        // Update slider range based on video duration
        updateSliderRange();
        
        // Remove the event listener to avoid multiple calls
        recordedVideo.removeEventListener('loadedmetadata', loadMetadataHandler);
    };
    
    const handleSliderInput = () => {
        const timePosition = parseFloat(frameSlider.value);
        // Only update the time display, don't show the frame yet
        currentTimeDisplay.textContent = timePosition.toFixed(1);
    };
    
    // Remove any existing event listeners to avoid duplicates
    recordedVideo.removeEventListener('loadedmetadata', loadMetadataHandler);
    recordedVideo.removeEventListener('durationchange', updateSliderRange);
    frameSlider.removeEventListener('input', handleSliderInput);
    
    // Add event listener for metadata loading
    if (recordedVideo.readyState >= 1) {
        // Metadata is already loaded
        loadMetadataHandler();
    } else {
        // Wait for metadata to load
        recordedVideo.addEventListener('loadedmetadata', loadMetadataHandler);
    }
    
    // Add event listener for slider change
    frameSlider.addEventListener('input', handleSliderInput);
    
    // Add event listener for duration change
    recordedVideo.addEventListener('durationchange', updateSliderRange);
    
    // Remove any existing timeupdate event listeners
    if (timeUpdateHandler) {
        recordedVideo.removeEventListener('timeupdate', timeUpdateHandler);
        timeUpdateHandler = null;
    }
}

// Display video at a specific time position
async function displayAtTime(timePosition) {
    console.log(`[SEEK-DEBUG] ====== START SEEK OPERATION ======`);
    console.log(`[SEEK-DEBUG] displayAtTime called with timePosition: ${timePosition.toFixed(3)}`);
    
    // Generate a unique ID for this seek operation to track it through logs
    const seekId = Math.random().toString(36).substring(2, 8);
    console.log(`[SEEK-DEBUG] [${seekId}] Seek operation started`);
    
    if (!recordedVideo || recordedVideo.readyState < 2) {
        console.error(`[SEEK-DEBUG] [${seekId}] Video not ready for time display, readyState:`, recordedVideo ? recordedVideo.readyState : 'null');
        throw new Error('Video not ready for time display');
    }
    
    // Ensure time position is within valid range
    const duration = recordedVideo.duration;
    if (isNaN(duration) || duration <= 0) {
        console.error(`[SEEK-DEBUG] [${seekId}] Invalid video duration:`, duration);
        throw new Error('Invalid video duration');
    }
    
    // Clamp time position to valid range
    const originalTimePosition = timePosition;
    timePosition = Math.max(0, Math.min(timePosition, duration));
    if (originalTimePosition !== timePosition) {
        console.log(`[SEEK-DEBUG] [${seekId}] Time position clamped from ${originalTimePosition.toFixed(3)} to ${timePosition.toFixed(3)}`);
    }
    
    // Update time display
    currentTimeDisplay.textContent = timePosition.toFixed(1);
    
    console.log(`[SEEK-DEBUG] [${seekId}] Seeking to time ${timePosition.toFixed(3)} seconds (video duration: ${duration.toFixed(3)} seconds)`);
    console.log(`[SEEK-DEBUG] [${seekId}] Video state before seek:`, {
        currentTime: recordedVideo.currentTime.toFixed(3),
        paused: recordedVideo.paused,
        seeking: recordedVideo.seeking,
        readyState: recordedVideo.readyState,
        networkState: recordedVideo.networkState,
        error: recordedVideo.error,
        ended: recordedVideo.ended
    });
    
    // Pause the video if it's playing
    if (!recordedVideo.paused) {
        recordedVideo.pause();
        console.log(`[SEEK-DEBUG] [${seekId}] Video paused before seeking`);
    }
    
    try {
        // Set video to the specific time
        const previousTime = recordedVideo.currentTime;
        
        // Force a small wait before seeking to ensure any previous operations have completed
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log(`[SEEK-DEBUG] [${seekId}] Waited 50ms before seeking`);
        
        // Set the current time
        console.log(`[SEEK-DEBUG] [${seekId}] Setting currentTime from ${previousTime.toFixed(3)} to ${timePosition.toFixed(3)}`);
        recordedVideo.currentTime = timePosition;
        
        // Log immediately after setting currentTime
        console.log(`[SEEK-DEBUG] [${seekId}] Immediately after setting currentTime:`, {
            currentTime: recordedVideo.currentTime.toFixed(3),
            seeking: recordedVideo.seeking,
            readyState: recordedVideo.readyState
        });
        
        // Wait for the seeked event to ensure the video has moved to the correct position
        console.log(`[SEEK-DEBUG] [${seekId}] Waiting for seeked event...`);
        
        // Set up a monitoring interval to track the video state during seeking
        const monitoringInterval = setInterval(() => {
            console.log(`[SEEK-DEBUG] [${seekId}] Seeking in progress:`, {
                currentTime: recordedVideo.currentTime.toFixed(3),
                seeking: recordedVideo.seeking,
                readyState: recordedVideo.readyState
            });
        }, 100);
        
        await Promise.race([
            new Promise(resolve => {
                const seekedHandler = () => {
                    clearInterval(monitoringInterval);
                    recordedVideo.removeEventListener('seeked', seekedHandler);
                    console.log(`[SEEK-DEBUG] [${seekId}] Seeked event received`);
                    resolve();
                };
                recordedVideo.addEventListener('seeked', seekedHandler);
            }),
            new Promise((_, reject) => setTimeout(() => {
                clearInterval(monitoringInterval);
                console.log(`[SEEK-DEBUG] [${seekId}] Seek timeout after 5 seconds`);
                reject(new Error('Seek timeout'));
            }, 5000))
        ]);
        
        // Verify that the seek was successful
        const actualTime = recordedVideo.currentTime;
        const timeDifference = Math.abs(actualTime - timePosition);
        
        // Log the actual time position after seeking
        console.log(`[SEEK-DEBUG] [${seekId}] Actual time position after seeking: ${actualTime.toFixed(3)} seconds (difference: ${timeDifference.toFixed(3)} seconds)`);
        console.log(`[SEEK-DEBUG] [${seekId}] Video state after seek:`, {
            currentTime: recordedVideo.currentTime.toFixed(3),
            paused: recordedVideo.paused,
            seeking: recordedVideo.seeking,
            readyState: recordedVideo.readyState,
            networkState: recordedVideo.networkState,
            error: recordedVideo.error,
            ended: recordedVideo.ended
        });
        
        // If the seek was not accurate enough, try again with a small adjustment
        if (timeDifference > 0.1) {
            console.warn(`[SEEK-DEBUG] [${seekId}] Seek was not accurate enough, trying with adjustment`);
            const adjustedTime = timePosition + 0.01;
            
            // Force a small wait before seeking again
            await new Promise(resolve => setTimeout(resolve, 50));
            console.log(`[SEEK-DEBUG] [${seekId}] Waited 50ms before adjusted seeking`);
            
            recordedVideo.currentTime = adjustedTime;
            console.log(`[SEEK-DEBUG] [${seekId}] Adjusted time to ${adjustedTime.toFixed(3)}`);
            
            // Wait for the seeked event again
            console.log(`[SEEK-DEBUG] [${seekId}] Waiting for seeked event after adjustment...`);
            
            // Set up another monitoring interval
            const adjustedMonitoringInterval = setInterval(() => {
                console.log(`[SEEK-DEBUG] [${seekId}] Adjusted seeking in progress:`, {
                    currentTime: recordedVideo.currentTime.toFixed(3),
                    seeking: recordedVideo.seeking,
                    readyState: recordedVideo.readyState
                });
            }, 100);
            
            await Promise.race([
                new Promise(resolve => {
                    const seekedHandler = () => {
                        clearInterval(adjustedMonitoringInterval);
                        recordedVideo.removeEventListener('seeked', seekedHandler);
                        console.log(`[SEEK-DEBUG] [${seekId}] Seeked event received after adjustment`);
                        resolve();
                    };
                    recordedVideo.addEventListener('seeked', seekedHandler);
                }),
                new Promise((_, reject) => setTimeout(() => {
                    clearInterval(adjustedMonitoringInterval);
                    console.log(`[SEEK-DEBUG] [${seekId}] Adjusted seek timeout after 3 seconds`);
                    reject(new Error('Adjusted seek timeout'));
                }, 3000))
            ]);
            
            console.log(`[SEEK-DEBUG] [${seekId}] Adjusted time position: ${recordedVideo.currentTime.toFixed(3)} seconds`);
        }
        
        // Force a small wait before capturing the frame
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log(`[SEEK-DEBUG] [${seekId}] Waited 50ms before capturing frame`);
        
        // Capture the frame
        console.log(`[SEEK-DEBUG] [${seekId}] Calling captureVideoFrame()`);
        await captureVideoFrame(seekId);
        console.log(`[SEEK-DEBUG] [${seekId}] captureVideoFrame() completed`);
        console.log(`[SEEK-DEBUG] ====== END SEEK OPERATION ======`);
    } catch (error) {
        console.error(`[SEEK-DEBUG] [${seekId}] Error during seek operation:`, error);
        console.log(`[SEEK-DEBUG] ====== SEEK OPERATION FAILED ======`);
        throw error; // Re-throw to be handled by the caller
    }
}

// Capture the current video frame and display it in the frame canvas
async function captureVideoFrame(seekId = 'unknown') {
    console.log(`[FRAME-DEBUG] [${seekId}] ====== START FRAME CAPTURE ======`);
    console.log(`[FRAME-DEBUG] [${seekId}] captureVideoFrame called, video currentTime: ${recordedVideo ? recordedVideo.currentTime.toFixed(3) : 'N/A'}`);
    
    if (!recordedVideo || recordedVideo.readyState < 2) {
        console.error(`[FRAME-DEBUG] [${seekId}] Video not ready for frame capture, readyState:`, recordedVideo ? recordedVideo.readyState : 'null');
        throw new Error('Video not ready for frame capture');
    }
    
    try {
        // Get video dimensions
        const videoWidth = recordedVideo.videoWidth;
        const videoHeight = recordedVideo.videoHeight;
        
        console.log(`[FRAME-DEBUG] [${seekId}] Video dimensions: ${videoWidth}x${videoHeight}`);
        
        if (videoWidth === 0 || videoHeight === 0) {
            console.error(`[FRAME-DEBUG] [${seekId}] Invalid video dimensions:`, videoWidth, 'x', videoHeight);
            throw new Error('Invalid video dimensions');
        }
        
        // Set canvas dimensions to match video
        frameCanvas.width = videoWidth;
        frameCanvas.height = videoHeight;
        console.log(`[FRAME-DEBUG] [${seekId}] Canvas dimensions set to: ${frameCanvas.width}x${frameCanvas.height}`);
        
        // Clear the canvas before drawing
        frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        console.log(`[FRAME-DEBUG] [${seekId}] Canvas cleared`);
        
        // Make sure the video is still at the correct position
        const currentTime = recordedVideo.currentTime;
        console.log(`[FRAME-DEBUG] [${seekId}] Current video time before drawing: ${currentTime.toFixed(3)}`);
        
        // Create a snapshot of the video element's properties
        const videoSnapshot = {
            currentTime: recordedVideo.currentTime,
            paused: recordedVideo.paused,
            seeking: recordedVideo.seeking,
            readyState: recordedVideo.readyState,
            networkState: recordedVideo.networkState,
            videoWidth: recordedVideo.videoWidth,
            videoHeight: recordedVideo.videoHeight,
            error: recordedVideo.error
        };
        console.log(`[FRAME-DEBUG] [${seekId}] Video snapshot before drawing:`, videoSnapshot);
        
        // Draw the video frame to the canvas
        try {
            console.log(`[FRAME-DEBUG] [${seekId}] Attempting to draw video frame to canvas`);
            
            // Create a data URL of the video frame before drawing to canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = videoWidth;
            tempCanvas.height = videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(recordedVideo, 0, 0, videoWidth, videoHeight);
            const frameDataUrl = tempCanvas.toDataURL('image/jpeg', 0.5);
            console.log(`[FRAME-DEBUG] [${seekId}] Created frame data URL (length: ${frameDataUrl.length})`);
            
            // Now draw to the actual frame canvas
            frameCtx.drawImage(recordedVideo, 0, 0, videoWidth, videoHeight);
            console.log(`[FRAME-DEBUG] [${seekId}] Successfully captured frame at time: ${currentTime.toFixed(3)} seconds`);
            
            // Check if the canvas has actual content
            try {
                const imageData = frameCtx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
                const hasContent = imageData.data.some(pixel => pixel !== 0);
                console.log(`[FRAME-DEBUG] [${seekId}] Canvas has content: ${hasContent}`);
            } catch (imageDataError) {
                console.error(`[FRAME-DEBUG] [${seekId}] Error checking canvas content:`, imageDataError);
            }
        } catch (drawError) {
            console.error(`[FRAME-DEBUG] [${seekId}] Error drawing video to canvas:`, drawError);
            // Try with a small delay and try again
            console.log(`[FRAME-DEBUG] [${seekId}] Waiting 100ms before retrying...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`[FRAME-DEBUG] [${seekId}] Retrying draw after delay`);
            
            frameCtx.drawImage(recordedVideo, 0, 0, videoWidth, videoHeight);
            console.log(`[FRAME-DEBUG] [${seekId}] Successfully captured frame after delay at time: ${recordedVideo.currentTime.toFixed(3)} seconds`);
        }
        
        // Detect poses on the current frame if detector is available
        if (detector) {
            console.log(`[FRAME-DEBUG] [${seekId}] Detector available, attempting pose detection`);
            try {
                console.log(`[FRAME-DEBUG] [${seekId}] Calling detector.estimatePoses()`);
        const poses = await detector.estimatePoses(recordedVideo, {
            flipHorizontal: false
        });
                console.log(`[FRAME-DEBUG] [${seekId}] Pose detection complete, found ${poses.length} poses`);
        
                // Draw pose if detected
        if (poses.length > 0) {
                    console.log(`[FRAME-DEBUG] [${seekId}] Detected pose with ${poses[0].keypoints.length} keypoints at time ${currentTime.toFixed(3)}`);
                    drawPose(poses[0], frameCtx);
                    console.log(`[FRAME-DEBUG] [${seekId}] Pose drawn on canvas`);
                    
                    // Update pose info if in frame mode
                    if (currentMode === 'frame') {
            updatePoseInfo(poses[0]);
                        console.log(`[FRAME-DEBUG] [${seekId}] Pose info updated`);
                    }
    } else {
                    console.log(`[FRAME-DEBUG] [${seekId}] No pose detected at time ${currentTime.toFixed(3)}`);
                }
            } catch (poseError) {
                console.error(`[FRAME-DEBUG] [${seekId}] Error detecting pose for frame:`, poseError);
                // Continue without pose detection - we still want to show the frame
            }
        } else {
            console.log(`[FRAME-DEBUG] [${seekId}] No detector available, skipping pose detection`);
        }
        
        console.log(`[FRAME-DEBUG] [${seekId}] captureVideoFrame completed successfully`);
        console.log(`[FRAME-DEBUG] [${seekId}] ====== END FRAME CAPTURE ======`);
    } catch (error) {
        console.error(`[FRAME-DEBUG] [${seekId}] Error capturing video frame:`, error);
        console.log(`[FRAME-DEBUG] [${seekId}] ====== FRAME CAPTURE FAILED ======`);
        throw error; // Re-throw to be handled by the caller
    }
}

// Event listeners
startBtn.addEventListener('click', startCamera);
recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
analyzeBtn.addEventListener('click', analyzeRecordedVideo);
showFrameBtn.addEventListener('click', showFrame);
selectPoseBtn.addEventListener('click', selectPose);
selectedPoseModeBtn.addEventListener('click', () => switchMode('selectedPose'));
poseComparisonModeBtn.addEventListener('click', () => switchMode('comparison'));
clearPoseBtn.addEventListener('click', clearSelectedPose);
startComparisonBtn.addEventListener('click', () => switchMode('comparison'));
startCameraBtn.addEventListener('click', startComparisonCamera);
stopComparisonBtn.addEventListener('click', () => switchMode('selectedPose'));
recordComparisonBtn.addEventListener('click', startComparisonRecording);
stopComparisonRecordingBtn.addEventListener('click', stopComparisonRecording);
downloadComparisonBtn.addEventListener('click', downloadComparisonVideo);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
});

// Update slider range based on video duration
function updateSliderRange() {
    if (!recordedVideo || recordedVideo.readyState < 1) {
        console.error('[DIAGNOSIS] Video not ready for slider update');
        return;
    }
    
    // If we have extracted frames, use those for the slider instead of video duration
    if (window.extractedFrames && window.extractedFrames.length > 0) {
        console.log('[DIAGNOSIS] Using extracted frames for slider range:', window.extractedFrames.length, 'frames');
        
        const totalFrames = window.extractedFrames.length - 1;
        
        // Update slider attributes
        frameSlider.min = 0;
        frameSlider.max = totalFrames;
        frameSlider.step = 1;
        frameSlider.value = 0;
        
        // Update labels
        maxFrameLabel.textContent = totalFrames;
        currentTimeDisplay.textContent = '0.0';
        
        return;
    }
    
    // Otherwise use video duration if it's valid
    const duration = recordedVideo.duration;
    if (!isNaN(duration) && isFinite(duration) && duration > 0) {
        console.log('[DIAGNOSIS] Updating slider range with video duration:', duration, 'seconds');
        
        // Update slider attributes
        frameSlider.min = 0;
        frameSlider.max = duration;
        frameSlider.step = 0.1;
        frameSlider.value = 0;
        
        // Update labels
        maxFrameLabel.textContent = duration.toFixed(1) + 's';
        currentTimeDisplay.textContent = '0.0';
    } else {
        console.error('[DIAGNOSIS] Invalid video duration for slider update:', duration);
        
        // Use a default range for invalid durations
        frameSlider.min = 0;
        frameSlider.max = 100;
        frameSlider.step = 1;
        frameSlider.value = 0;
        
        // Update labels
        maxFrameLabel.textContent = '100';
        currentTimeDisplay.textContent = '0.0';
    }
}

// Reset video element if it gets into a bad state
async function resetVideoElement() {
    if (!recordedVideo || !recordedBlob) {
        console.error('[DIAGNOSIS] No recorded video or blob available for reset');
        return false;
    }
    
    if (recordedBlob.size === 0) {
        console.error('[DIAGNOSIS] Recorded blob is empty, cannot reset video');
        return false;
    }
    
    try {
        console.log('[DIAGNOSIS] Starting video element reset...');
        console.log('[DIAGNOSIS] Video element before reset:', {
            src: recordedVideo.src ? 'set' : 'empty',
            readyState: recordedVideo.readyState,
            paused: recordedVideo.paused,
            duration: isFinite(recordedVideo.duration) ? recordedVideo.duration : 'non-finite',
            videoWidth: recordedVideo.videoWidth,
            videoHeight: recordedVideo.videoHeight,
            error: recordedVideo.error ? recordedVideo.error.message : null,
            networkState: recordedVideo.networkState
        });
        
        // Pause the video
        recordedVideo.pause();
        
        // Remove the src and load to reset completely
        console.log('[DIAGNOSIS] Removing video source and loading...');
        recordedVideo.removeAttribute('src');
        recordedVideo.load();
        
        // Create a new source URL
        console.log('[DIAGNOSIS] Creating new object URL from blob...');
        console.log('[DIAGNOSIS] Blob details:', {
            size: recordedBlob.size,
            type: recordedBlob.type
        });
        
        const videoURL = URL.createObjectURL(recordedBlob);
        console.log('[DIAGNOSIS] Created new video URL:', videoURL ? 'success' : 'failed');
        
        // Set the new source
        console.log('[DIAGNOSIS] Setting video source and loading...');
        recordedVideo.src = videoURL;
        
        // Force the browser to load the video
        recordedVideo.load();
        
        // Wait for metadata to load
        console.log('[DIAGNOSIS] Waiting for video metadata to load...');
        await new Promise((resolve, reject) => {
            const metadataHandler = () => {
                recordedVideo.removeEventListener('loadedmetadata', metadataHandler);
                console.log('[DIAGNOSIS] Video metadata loaded successfully');
                resolve();
            };
            
            const errorHandler = (error) => {
                recordedVideo.removeEventListener('error', errorHandler);
                console.error('[DIAGNOSIS] Error loading video:', error);
                console.error('[DIAGNOSIS] Video error details:', recordedVideo.error);
                reject(new Error('Video loading error: ' + (recordedVideo.error ? recordedVideo.error.message : 'unknown error')));
            };
            
            recordedVideo.addEventListener('loadedmetadata', metadataHandler);
            recordedVideo.addEventListener('error', errorHandler);
            
            // Add a timeout
            const timeoutId = setTimeout(() => {
                recordedVideo.removeEventListener('loadedmetadata', metadataHandler);
                recordedVideo.removeEventListener('error', errorHandler);
                console.warn('[DIAGNOSIS] Video metadata load timeout reached');
                reject(new Error('Video metadata load timeout'));
            }, 10000); // Increased timeout to 10 seconds
            
            // Also resolve if we already have metadata
            if (recordedVideo.readyState >= 1) {
                clearTimeout(timeoutId);
                console.log('[DIAGNOSIS] Video already has metadata, resolving immediately');
                resolve();
            }
        });
        
        // Check if the duration is valid
        if (!isFinite(recordedVideo.duration) || recordedVideo.duration <= 0) {
            console.error('[DIAGNOSIS] Invalid video duration after metadata load:', recordedVideo.duration);
            // Don't reject, we'll try to continue anyway
        }
        
        // Wait for enough data to be loaded
        console.log('[DIAGNOSIS] Waiting for video data to load...');
        await new Promise((resolve, reject) => {
            const loadedHandler = () => {
                recordedVideo.removeEventListener('loadeddata', loadedHandler);
                console.log('[DIAGNOSIS] Video data loaded successfully');
                resolve();
            };
            
            recordedVideo.addEventListener('loadeddata', loadedHandler);
            
            // Add a timeout
            const timeoutId = setTimeout(() => {
                recordedVideo.removeEventListener('loadeddata', loadedHandler);
                // Don't reject, just resolve with a warning
                console.warn('[DIAGNOSIS] Video data load timeout, but continuing anyway');
                resolve();
            }, 10000);
            
            // Also resolve if we already have data
            if (recordedVideo.readyState >= 2) {
                clearTimeout(timeoutId);
                console.log('[DIAGNOSIS] Video already has data, resolving immediately');
                resolve();
            }
        });
        
        // Update the slider range based on the new video duration
        if (isFinite(recordedVideo.duration) && recordedVideo.duration > 0) {
            updateSliderRange();
        } else {
            console.warn('[DIAGNOSIS] Skipping slider update due to invalid duration');
        }
        
        // Log the video state after reset
        console.log('[DIAGNOSIS] Video element after reset:', {
            src: recordedVideo.src ? 'set' : 'empty',
            readyState: recordedVideo.readyState,
            paused: recordedVideo.paused,
            duration: isFinite(recordedVideo.duration) ? recordedVideo.duration : 'non-finite',
            videoWidth: recordedVideo.videoWidth,
            videoHeight: recordedVideo.videoHeight,
            error: recordedVideo.error ? recordedVideo.error.message : null,
            networkState: recordedVideo.networkState
        });
        
        // Test if the video can be seeked
        console.log('[DIAGNOSIS] Testing if video is seekable...');
        if (recordedVideo.seekable && recordedVideo.seekable.length > 0) {
            console.log('[DIAGNOSIS] Video is seekable, range:', 
                recordedVideo.seekable.start(0).toFixed(2), 'to', 
                recordedVideo.seekable.end(0).toFixed(2));
        } else {
            console.warn('[DIAGNOSIS] Video is not seekable!');
        }
        
        console.log('[DIAGNOSIS] Video reset successful');
        return true;
    } catch (error) {
        console.error('[DIAGNOSIS] Error during video reset:', error);
        return false;
    }
}

// Extract frames from video and store them for direct access
async function extractFramesFromVideo() {
    if (!recordedVideo || !recordedBlob) {
        console.error('[DIAGNOSIS] No recorded video available for frame extraction');
        alert('No video has been recorded. Please record a video first.');
        return false;
    }
    
    if (recordedBlob.size === 0) {
        console.error('[DIAGNOSIS] Recorded video blob is empty');
        alert('The recorded video appears to be empty. Please try recording again.');
        return false;
    }
    
    console.log('[DIAGNOSIS] Starting frame extraction process...');
    
    try {
        // Reset the video element to ensure it's in a good state
        console.log('[DIAGNOSIS] Attempting to reset video element...');
        const resetSuccess = await resetVideoElement();
        console.log('[DIAGNOSIS] Reset video result:', resetSuccess);
        
        if (!resetSuccess) {
            throw new Error('Failed to reset video element');
        }
        
        // Make sure the video is loaded
        if (recordedVideo.readyState < 2) {
            console.log('[DIAGNOSIS] Video not fully loaded (readyState < 2), waiting...');
            try {
                await new Promise((resolve, reject) => {
                    const loadedHandler = () => {
                        recordedVideo.removeEventListener('loadeddata', loadedHandler);
                        console.log('[DIAGNOSIS] Video loadeddata event fired');
                        resolve();
                    };
                    recordedVideo.addEventListener('loadeddata', loadedHandler);
                    
                    // Add a timeout to avoid waiting forever
                    setTimeout(() => {
                        recordedVideo.removeEventListener('loadeddata', loadedHandler);
                        console.log('[DIAGNOSIS] Video load timeout reached');
                        reject(new Error('Video load timeout during frame extraction'));
                    }, 10000);
                });
            } catch (loadError) {
                console.error('[DIAGNOSIS] Error waiting for video to load:', loadError);
                throw new Error('Video failed to load: ' + loadError.message);
            }
        }
        
        // Get video dimensions
        const videoWidth = recordedVideo.videoWidth;
        const videoHeight = recordedVideo.videoHeight;
        
        console.log(`[DIAGNOSIS] Video state after loading:`, {
            readyState: recordedVideo.readyState,
            duration: isFinite(recordedVideo.duration) ? recordedVideo.duration.toFixed(2) + 's' : 'Infinity',
            dimensions: `${videoWidth}x${videoHeight}`,
            currentTime: recordedVideo.currentTime,
            paused: recordedVideo.paused,
            ended: recordedVideo.ended,
            error: recordedVideo.error
        });
        
        // Check for valid video dimensions
        if (videoWidth <= 0 || videoHeight <= 0) {
            console.error('[DIAGNOSIS] Invalid video dimensions:', videoWidth, 'x', videoHeight);
            throw new Error(`Invalid video dimensions: ${videoWidth}x${videoHeight}`);
        }
        
        // Create a temporary canvas for frame extraction
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoWidth;
        tempCanvas.height = videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Create an array to store the extracted frames
        window.extractedFrames = [];
        
        // Pause the video
        recordedVideo.pause();
        
        // Update UI to show progress
        currentTimeDisplay.textContent = 'Preparing...';
        
        // Use a time-based approach for frame extraction
        console.log('[DIAGNOSIS] Using time-based frame extraction method...');
        
        // Set video to the beginning
        recordedVideo.currentTime = 0;
        
        // Wait for the video to be ready at the beginning
        await new Promise(resolve => {
            if (recordedVideo.readyState >= 2) {
                resolve();
            } else {
                const readyHandler = () => {
                    recordedVideo.removeEventListener('canplay', readyHandler);
                    resolve();
                };
                recordedVideo.addEventListener('canplay', readyHandler);
            }
        });
        
        // Capture the first frame
        tempCtx.drawImage(recordedVideo, 0, 0, videoWidth, videoHeight);
        const firstFrameDataUrl = tempCanvas.toDataURL('image/jpeg', 0.5);
        window.extractedFrames.push({
            index: 0,
            time: 0,
            dataUrl: firstFrameDataUrl
        });
        
        // Set up variables for frame capture
        let capturedFrames = 1; // We already captured the first frame
        let lastCaptureTime = 0;
        let playbackStartTime = Date.now();
        let videoEnded = false;
        
        // For videos with Infinity duration, we'll use a fixed number of frames
        const targetFrameCount = 30; // Aim to capture 30 frames
        const estimatedInterval = 0.1; // Capture a frame roughly every 0.1 seconds
        
        // Create a promise that will resolve when all frames are captured
        const capturePromise = new Promise((resolve, reject) => {
            const timeUpdateHandler = () => {
                try {
                    const currentTime = recordedVideo.currentTime;
                    const elapsedRealTime = (Date.now() - playbackStartTime) / 1000;
                    
                    // Only capture a new frame if enough time has passed since the last capture
                    if (currentTime > lastCaptureTime + estimatedInterval) {
                        // Capture frame
                        tempCtx.drawImage(recordedVideo, 0, 0, videoWidth, videoHeight);
                        const frameDataUrl = tempCanvas.toDataURL('image/jpeg', 0.5);
                        window.extractedFrames.push({
                            index: capturedFrames,
                            time: currentTime,
                            dataUrl: frameDataUrl
                        });
                        capturedFrames++;
                        lastCaptureTime = currentTime;
                        
                        // Update progress - since we don't know the total, use captured frames
                        const progress = Math.min(Math.round((capturedFrames / targetFrameCount) * 100), 99);
                        currentTimeDisplay.textContent = `${progress}%`;
                        
                        // Log progress
                        if (capturedFrames % 5 === 0) {
                            console.log(`[DIAGNOSIS] Captured ${capturedFrames} frames, current time: ${currentTime.toFixed(2)}s, real time: ${elapsedRealTime.toFixed(2)}s`);
                        }
                        
                        // If we've captured enough frames or the video has been playing for too long, stop
                        if (capturedFrames >= targetFrameCount || elapsedRealTime > 30) {
                            console.log(`[DIAGNOSIS] Reached target frame count or time limit`);
                            cleanup();
                            resolve();
                        }
                    }
                } catch (error) {
                    console.error('[DIAGNOSIS] Error in timeUpdateHandler:', error);
                    cleanup();
                    reject(error);
                }
            };
            
            const endedHandler = () => {
                console.log('[DIAGNOSIS] Video playback ended');
                videoEnded = true;
                cleanup();
                resolve();
            };
            
            const errorHandler = (error) => {
                console.error('[DIAGNOSIS] Video playback error:', error);
                cleanup();
                reject(new Error('Video playback error during frame capture'));
            };
            
            // Add event listeners
            recordedVideo.addEventListener('timeupdate', timeUpdateHandler);
            recordedVideo.addEventListener('ended', endedHandler);
            recordedVideo.addEventListener('error', errorHandler);
            
            // Function to clean up event listeners
            function cleanup() {
                recordedVideo.removeEventListener('timeupdate', timeUpdateHandler);
                recordedVideo.removeEventListener('ended', endedHandler);
                recordedVideo.removeEventListener('error', errorHandler);
        recordedVideo.pause();
            }
            
            // Start playback
            playbackStartTime = Date.now();
            recordedVideo.play().catch(error => {
                console.error('[DIAGNOSIS] Error starting video playback:', error);
                cleanup();
                reject(new Error('Failed to start video playback: ' + error.message));
            });
            
            // Set a timeout in case the video doesn't end properly
            setTimeout(() => {
                if (!videoEnded) {
                    console.log('[DIAGNOSIS] Frame capture timeout reached (30 seconds)');
                    cleanup();
                    resolve();
                }
            }, 30000); // 30 second timeout
        });
        
        // Wait for all frames to be captured
        await capturePromise;
        
        console.log(`[DIAGNOSIS] Frame extraction complete. Captured ${window.extractedFrames.length} frames.`);
        
        // Check if we extracted any frames
        if (window.extractedFrames.length === 0) {
            console.error('[DIAGNOSIS] No frames were successfully extracted');
            throw new Error('No frames could be extracted from the video');
        }
        
        // Sort frames by time
        window.extractedFrames.sort((a, b) => a.time - b.time);
        
        // Set progress to 100%
        currentTimeDisplay.textContent = '100%';
        
        console.log(`[DIAGNOSIS] Frame extraction successful. Extracted ${window.extractedFrames.length} frames.`);
        
        // Update the slider to use the extracted frames
        updateFrameSliderForExtractedFrames();
        
        return true;
    } catch (error) {
        console.error('[DIAGNOSIS] Error extracting frames:', error);
        alert('Failed to extract frames from the video: ' + error.message);
        return false;
    }
}

// Handle slider input events
function handleSliderInput(event) {
    const frameIndex = parseInt(event.target.value);
    if (window.extractedFrames && frameIndex >= 0 && frameIndex < window.extractedFrames.length) {
        const frameTime = window.extractedFrames[frameIndex].time;
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const ms = Math.floor((seconds % 1) * 10);
            return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
        };
        currentTimeDisplay.textContent = formatTime(frameTime);
    }
}

// Update the slider to use the extracted frames
function updateFrameSliderForExtractedFrames() {
    if (!window.extractedFrames || window.extractedFrames.length === 0) {
        console.error('No extracted frames available');
        return;
    }
    
    const totalFrames = window.extractedFrames.length - 1;
    
    // Update slider max value and label
    frameSlider.min = 0;
    frameSlider.max = totalFrames;
    frameSlider.step = 1;
    frameSlider.value = 0;
    maxFrameLabel.textContent = totalFrames;
    
    // Format time for initial display
    const initialTime = window.extractedFrames[0].time;
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    };
    currentTimeDisplay.textContent = formatTime(initialTime);
    
    console.log(`Frame slider updated to use ${totalFrames + 1} extracted frames`);
    
    // Remove any existing event listeners
    frameSlider.removeEventListener('input', handleSliderInput);
    
    // Add new event listener for slider change
    frameSlider.addEventListener('input', handleSliderInput);
}

// Display an extracted frame
function displayExtractedFrame(frameIndex) {
    try {
        if (!window.extractedFrames || window.extractedFrames.length === 0) {
            console.error('No extracted frames available');
            alert('No frames have been extracted. Please record or upload a video first.');
            return;
        }
        
        if (frameIndex < 0 || frameIndex >= window.extractedFrames.length) {
            console.error(`Invalid frame index: ${frameIndex}`);
            return;
        }
        
        console.log(`Displaying extracted frame ${frameIndex} (time: ${window.extractedFrames[frameIndex].time.toFixed(2)}s)`);
        
        // Get the frame data
        const frameData = window.extractedFrames[frameIndex];
        
        // Create an image from the data URL
        const img = new Image();
        img.onload = () => {
            // Clear the canvas
            frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
            
            // Set canvas dimensions to match the image or maintain aspect ratio
            const aspectRatio = img.width / img.height;
            frameCanvas.width = 640;  // Set a fixed width
            frameCanvas.height = Math.round(frameCanvas.width / aspectRatio);
            
            // Draw the image to the canvas
            frameCtx.drawImage(img, 0, 0, frameCanvas.width, frameCanvas.height);
            
            console.log(`Frame ${frameIndex} displayed successfully`);
            
            // If we have a detector, try to detect poses on this frame
            if (detector) {
                detectPoseOnImage(img, frameIndex);
            }
        };
        
        img.onerror = (error) => {
            console.error(`Error loading frame ${frameIndex}:`, error);
            alert('Failed to load the selected frame. Please try another frame or re-extract frames.');
        };
        
        // Set the image source to the data URL
        img.src = frameData.dataUrl;
    } catch (error) {
        console.error('Error displaying extracted frame:', error);
        alert('An error occurred while displaying the frame. Please try again.');
    }
}

// Detect pose on an image
async function detectPoseOnImage(imageElement, frameIndex) {
    if (!detector) {
        console.error('Pose detector not initialized');
        return;
    }
    
    try {
        console.log(`Detecting pose on frame ${frameIndex}...`);
        
        // Detect poses on the image
        const poses = await detector.estimatePoses(imageElement, {
            flipHorizontal: false
        });
        
        if (poses.length > 0) {
            console.log(`Detected pose with ${poses[0].keypoints.length} keypoints on frame ${frameIndex}`);
            
            // Draw the pose on the canvas
            drawPose(poses[0], frameCtx);
            
            // Update pose info if in frame mode
            if (currentMode === 'frame') {
            updatePoseInfo(poses[0]);
            }
        } else {
            console.log(`No pose detected on frame ${frameIndex}`);
        }
    } catch (error) {
        console.error(`Error detecting pose on frame ${frameIndex}:`, error);
    }
}

// Show the selected frame
async function showFrame() {
    try {
        console.log('Show Frame button clicked');
        
        // Disable the button while processing
        showFrameBtn.disabled = true;
        showFrameBtn.textContent = 'Processing...';
        
        // Check if we have a recorded video
        if (!recordedVideo || !recordedBlob) {
            throw new Error('No video has been recorded. Please record a video first.');
        }
        
        if (recordedBlob.size === 0) {
            throw new Error('The recorded video is empty. Please try recording again.');
        }
        
        // Check if we have extracted frames
        if (!window.extractedFrames || window.extractedFrames.length === 0) {
            console.log('No extracted frames available, extracting frames now...');
            
            // Make sure the video is properly loaded
            if (recordedVideo.readyState < 2) {
                console.log('Video not fully loaded, resetting video element first...');
                const resetSuccess = await resetVideoElement();
                if (!resetSuccess) {
                    throw new Error('Failed to prepare the video for frame extraction. Please try recording again.');
                }
            }
            
            const success = await extractFramesFromVideo();
            if (!success) {
                throw new Error('Failed to extract frames from the video. Please try recording a longer video or using a different browser.');
            }
        }
        
        // Get the current frame index from the slider
        const frameIndex = parseInt(frameSlider.value);
        console.log(`Show Frame called with frame index: ${frameIndex}`);
        
        // Display the selected frame
        displayExtractedFrame(frameIndex);
    } catch (error) {
        console.error('Error in showFrame function:', error);
        alert(error.message || 'An error occurred while displaying the frame. Please try again.');
    } finally {
        // Re-enable the button
        showFrameBtn.disabled = false;
        showFrameBtn.textContent = 'Show Frame';
    }
}

// Select pose from the current frame
async function selectPose() {
    try {
        console.log('Select Pose button clicked');
        
        // Disable the button while processing
        selectPoseBtn.disabled = true;
        selectPoseBtn.textContent = 'Processing...';
        
        // Check if we have a frame displayed
        if (!window.extractedFrames || window.extractedFrames.length === 0) {
            throw new Error('No frames available. Please show a frame first.');
        }
        
        const frameIndex = parseInt(frameSlider.value);
        if (frameIndex < 0 || frameIndex >= window.extractedFrames.length) {
            throw new Error('Invalid frame selected.');
        }
        
        // Get the frame data
        const frameData = window.extractedFrames[frameIndex];
        
        // Create an image from the frame data
        const img = new Image();
        img.src = frameData.dataUrl;
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        // Detect pose on the frame
        if (!detector) {
            throw new Error('Pose detector not initialized.');
        }
        
        const poses = await detector.estimatePoses(img, {
            flipHorizontal: false
        });
        
        if (poses.length === 0) {
            throw new Error('No pose detected in the current frame.');
        }
        
        // Store the selected pose
        selectedPose = {
            frameIndex: frameIndex,
            time: frameData.time,
            pose: poses[0],
            frameData: frameData
        };
        
        // Switch to selected pose mode
        switchMode('selectedPose');
        
        console.log('Pose selected:', selectedPose);
        
    } catch (error) {
        console.error('Error selecting pose:', error);
        alert(error.message || 'An error occurred while selecting the pose. Please try again.');
        selectPoseBtn.classList.remove('active');
    } finally {
        // Re-enable the button
        selectPoseBtn.disabled = false;
        selectPoseBtn.textContent = 'Select Pose';
    }
}

// Display the selected pose in the selected pose mode
function displaySelectedPose() {
    if (!selectedPose || !selectedPose.frameData) {
        console.error('No pose selected to display');
        return;
    }
    
    try {
        // Create an image from the frame data
        const img = new Image();
        img.onload = () => {
            // Get the container dimensions
            const container = document.querySelector('.selected-frame-display');
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Calculate the scaling factor to fit the image while maintaining aspect ratio
            const scale = Math.min(
                containerWidth / img.width,
                containerHeight / img.height
            );
            
            // Calculate the dimensions that maintain the aspect ratio
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            
            // Set canvas dimensions to the scaled size
            selectedPoseCanvas.width = scaledWidth;
            selectedPoseCanvas.height = scaledHeight;
            
            // Get canvas context
            const ctx = selectedPoseCanvas.getContext('2d');
            
            // Enable image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Clear canvas
            ctx.clearRect(0, 0, scaledWidth, scaledHeight);
            
            // Draw the frame
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
            
            // Scale the pose keypoints
            const scaledPose = {
                ...selectedPose.pose,
                keypoints: selectedPose.pose.keypoints.map(keypoint => ({
                    ...keypoint,
                    x: keypoint.x * scale,
                    y: keypoint.y * scale
                }))
            };
            
            // Draw the pose
            drawPose(scaledPose, ctx);
            
            // Update pose information
            updateSelectedPoseInfo(selectedPose.pose);
        };
        
        img.src = selectedPose.frameData.dataUrl;
    } catch (error) {
        console.error('Error displaying selected pose:', error);
    }
}

// Update the selected pose information display
function updateSelectedPoseInfo(pose) {
    if (!pose || !pose.keypoints) return;
    
    // Define the keypoints we want to display
    const keyPointsToDisplay = [
        'nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee',
        'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    // Clear previous info
    selectedPoseInfo.innerHTML = '';
    
    // Display confidence score
    const scoreElement = document.createElement('div');
    scoreElement.classList.add('keypoint');
    scoreElement.textContent = `Overall confidence: ${(pose.score * 100).toFixed(1)}%`;
    selectedPoseInfo.appendChild(scoreElement);
    
    // Display keypoint positions with confidence > 50% (only for keypoints we're interested in)
    for (const keypoint of pose.keypoints) {
        if (keypoint.score > 0.5 && keyPointsToDisplay.includes(keypoint.name)) {
            const keypointElement = document.createElement('div');
            keypointElement.classList.add('keypoint');
            keypointElement.textContent = `${keypoint.name}: (${Math.round(keypoint.x)}, ${Math.round(keypoint.y)}) - ${(keypoint.score * 100).toFixed(1)}%`;
            selectedPoseInfo.appendChild(keypointElement);
        }
    }
}

// Clear the selected pose
function clearSelectedPose() {
    selectedPose = null;
    switchMode('frame');
}

// Display the reference pose in the comparison mode
function displayReferencePose() {
    if (!selectedPose || !selectedPose.frameData) {
        console.error('No pose selected to display as reference');
        return;
    }
    
    try {
        // Create an image from the frame data
        const img = new Image();
        img.onload = () => {
            // Get the container dimensions
            const container = document.querySelector('.reference-pose .pose-display');
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Calculate the scaling factor to fit the image while maintaining aspect ratio
            const scale = Math.min(
                containerWidth / img.width,
                containerHeight / img.height
            );
            
            // Calculate the dimensions that maintain the aspect ratio
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            
            // Set canvas dimensions to the scaled size
            referencePoseCanvas.width = scaledWidth;
            referencePoseCanvas.height = scaledHeight;
            
            // Get canvas context
            const ctx = referencePoseCanvas.getContext('2d');
            
            // Enable image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Clear canvas
            ctx.clearRect(0, 0, scaledWidth, scaledHeight);
            
            // Draw the frame with reduced opacity to make the pose more visible
            ctx.globalAlpha = 0.7;
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
            ctx.globalAlpha = 1.0;
            
            // Scale the pose keypoints
            const scaledPose = {
                ...selectedPose.pose,
                keypoints: selectedPose.pose.keypoints.map(keypoint => ({
                    ...keypoint,
                    x: keypoint.x * scale,
                    y: keypoint.y * scale
                }))
            };
            
            // Draw the pose in light blue color
            drawPose(scaledPose, ctx, { keypoints: '#87CEFA', skeleton: '#00BFFF' });
        };
        
        img.src = selectedPose.frameData.dataUrl;
    } catch (error) {
        console.error('Error displaying reference pose:', error);
    }
}

// Start the camera for pose comparison
async function startComparisonCamera() {
    try {
        // Stop any existing streams
        if (comparisonVideo.srcObject) {
            stopComparisonCamera();
        }
        
        // Get user media
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        comparisonVideo.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            comparisonVideo.onloadedmetadata = () => {
                resolve();
            };
        });
        
        // Set canvas dimensions
        comparisonCanvas.width = comparisonVideo.videoWidth;
        comparisonCanvas.height = comparisonVideo.videoHeight;
        
        // Start pose detection
        startComparisonPoseDetection();
        
        // Update UI
        startCameraBtn.textContent = 'Restart Camera';
        recordComparisonBtn.disabled = false;
        stopComparisonRecordingBtn.disabled = true;
        downloadComparisonBtn.disabled = true;
        
    } catch (error) {
        console.error('Error starting comparison camera:', error);
        alert('Error starting camera: ' + error.message);
    }
}

// Stop the comparison camera
function stopComparisonCamera() {
    try {
        if (comparisonVideo.srcObject) {
            const tracks = comparisonVideo.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            comparisonVideo.srcObject = null;
        }
        
        // Stop pose detection
        if (comparisonAnimationId) {
            cancelAnimationFrame(comparisonAnimationId);
            comparisonAnimationId = null;
        }
        
        // Stop recording if active
        if (isRecordingComparison) {
            stopComparisonRecording();
        }
        
        // Update UI
        startCameraBtn.textContent = 'Start Camera';
        recordComparisonBtn.disabled = true;
        
    } catch (error) {
        console.error('Error stopping comparison camera:', error);
    }
}

// Start pose detection for comparison
async function startComparisonPoseDetection() {
    if (!detector) {
        await initPoseDetector();
    }
    
    if (!selectedPose || !selectedPose.pose) {
        console.error('No reference pose available for comparison');
        return;
    }
    
    // Function to detect pose and compare
    async function detectAndCompare() {
        if (!comparisonVideo.srcObject || comparisonVideo.paused || comparisonVideo.ended) {
            return;
        }
        
        try {
            // Detect pose
            const poses = await detector.estimatePoses(comparisonVideo, {
                flipHorizontal: false
            });
            
            // Get canvas context
            const ctx = comparisonCanvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, comparisonCanvas.width, comparisonCanvas.height);
            
            if (poses.length > 0) {
                // Compare with reference pose
                const similarity = comparePoses(selectedPose.pose, poses[0]);
                
                // Calculate color based on similarity score - even more lenient thresholds
                let r, g, b;
                const similarityValue = similarity.overall / 100;
                
                if (similarityValue < 0.3) { // Changed from 0.35 to 0.3
                    // Red (0%) to Yellow (30%)
                    r = 255;
                    g = Math.round(255 * (similarityValue * 3.33)); // Adjusted multiplier
                    b = 0;
                } else {
                    // Yellow (30%) to Green (100%)
                    r = Math.round(255 * (1 - (similarityValue - 0.3) * (1/0.7))); // Adjusted calculation
                    g = 255;
                    b = 0;
                }
                
                // Ensure we have some color even for very low similarity
                if (r < 140) r = 140; // Increased from 120 to 140
                if (g < 100) g = 100;   // Increased from 80 to 100
                
                const poseColor = {
                    keypoints: `rgb(${r}, ${g}, ${b})`,
                    skeleton: `rgba(${r}, ${g}, ${b}, 0.7)`
                };
                
                // Draw the detected pose with color based on similarity
                drawPose(poses[0], ctx, poseColor);
                
                // Update comparison display
                updateComparisonDisplay(similarity, poses[0]);
            } else {
                // No pose detected - more encouraging message
                matchScore.textContent = '0%';
                matchDetails.innerHTML = '<div class="match-detail medium">Waiting to detect your pose. Please make sure you are visible in the camera.</div>';
            }
            
            // Continue detection
            comparisonAnimationId = requestAnimationFrame(detectAndCompare);
        } catch (error) {
            console.error('Error in pose comparison:', error);
            // Try to continue despite errors
            comparisonAnimationId = requestAnimationFrame(detectAndCompare);
        }
    }
    
    // Start detection loop
    comparisonAnimationId = requestAnimationFrame(detectAndCompare);
}

// Compare two poses and return similarity score
function comparePoses(referencePose, currentPose) {
    if (!referencePose || !currentPose || !referencePose.keypoints || !currentPose.keypoints) {
        return { overall: 0, keypoints: [] };
    }
    
    // Define important keypoints to compare - removed facial points except nose
    const keyPointsToCompare = [
        'nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee',
        'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    // Get reference keypoints map
    const referenceKeypoints = {};
    referencePose.keypoints.forEach(kp => {
        if (keyPointsToCompare.includes(kp.name)) {
            referenceKeypoints[kp.name] = kp;
        }
    });
    
    // Get current keypoints map
    const currentKeypoints = {};
    currentPose.keypoints.forEach(kp => {
        if (keyPointsToCompare.includes(kp.name)) {
            currentKeypoints[kp.name] = kp;
        }
    });
    
    // Calculate center points for both poses
    let refCenterX = 0, refCenterY = 0, refCount = 0;
    let currCenterX = 0, currCenterY = 0, currCount = 0;
    
    // Calculate reference pose center
    for (const name of keyPointsToCompare) {
        const refKp = referenceKeypoints[name];
        if (refKp && refKp.score > 0.15) { // Further reduced confidence threshold from 0.2 to 0.15
            refCenterX += refKp.x;
            refCenterY += refKp.y;
            refCount++;
        }
    }
    
    // Calculate current pose center
    for (const name of keyPointsToCompare) {
        const currKp = currentKeypoints[name];
        if (currKp && currKp.score > 0.15) { // Further reduced confidence threshold from 0.2 to 0.15
            currCenterX += currKp.x;
            currCenterY += currKp.y;
            currCount++;
        }
    }
    
    // Calculate average centers
    if (refCount > 0) {
        refCenterX /= refCount;
        refCenterY /= refCount;
    }
    
    if (currCount > 0) {
        currCenterX /= currCount;
        currCenterY /= currCount;
    }
    
    // Calculate similarity for each keypoint
    const keypointSimilarities = [];
    let totalSimilarity = 0;
    let validKeypoints = 0;
    
    // Calculate scale factor based on torso size (distance between shoulders and hips)
    let refScale = 1, currScale = 1;
    
    // Try to use shoulder-to-hip distance for scaling
    if (referenceKeypoints['left_shoulder'] && referenceKeypoints['left_hip'] &&
        referenceKeypoints['left_shoulder'].score > 0.15 && referenceKeypoints['left_hip'].score > 0.15) {
        refScale = Math.sqrt(
            Math.pow(referenceKeypoints['left_shoulder'].x - referenceKeypoints['left_hip'].x, 2) +
            Math.pow(referenceKeypoints['left_shoulder'].y - referenceKeypoints['left_hip'].y, 2)
        );
    }
    
    if (currentKeypoints['left_shoulder'] && currentKeypoints['left_hip'] &&
        currentKeypoints['left_shoulder'].score > 0.15 && currentKeypoints['left_hip'].score > 0.15) {
        currScale = Math.sqrt(
            Math.pow(currentKeypoints['left_shoulder'].x - currentKeypoints['left_hip'].x, 2) +
            Math.pow(currentKeypoints['left_shoulder'].y - currentKeypoints['left_hip'].y, 2)
        );
    }
    
    // Prevent division by zero
    refScale = refScale || 1;
    currScale = currScale || 1;
    
    // Calculate the scale ratio to normalize distances
    const scaleRatio = refScale / currScale;
    
    keyPointsToCompare.forEach(name => {
        const refKp = referenceKeypoints[name];
        const currKp = currentKeypoints[name];
        
        if (refKp && currKp && refKp.score > 0.15 && currKp.score > 0.15) { // Further reduced confidence threshold from 0.2 to 0.15
            // Calculate normalized positions (relative to center and scaled)
            const refNormX = (refKp.x - refCenterX) / refScale;
            const refNormY = (refKp.y - refCenterY) / refScale;
            
            const currNormX = (currKp.x - currCenterX) / currScale;
            const currNormY = (currKp.y - currCenterY) / currScale;
            
            // Calculate Euclidean distance between normalized positions
            const distance = Math.sqrt(
                Math.pow(refNormX - currNormX, 2) + 
                Math.pow(refNormY - currNormY, 2)
            );
            
            // Convert distance to similarity (0-100%)
            // Even more lenient conversion: a distance of 2.0 or more is considered poor (was 1.5)
            const rawSimilarity = Math.max(0, 100 - (distance * 25)); // Further reduced multiplier from 35 to 25
            
            // Apply a stronger curve to boost low and medium similarity scores
            // This formula significantly boosts scores in the lower and middle ranges
            const boostedSimilarity = Math.min(100, rawSimilarity + (50 * Math.sin(Math.PI * rawSimilarity / 100)));
            
            keypointSimilarities.push({
                name: name,
                similarity: boostedSimilarity,
                confidence: (refKp.score + currKp.score) / 2
            });
            
            totalSimilarity += boostedSimilarity;
            validKeypoints++;
        }
    });
    
    // Calculate overall similarity
    let overallSimilarity = validKeypoints > 0 ? totalSimilarity / validKeypoints : 0;
    
    // Apply a stronger final boost to the overall similarity
    // This gives a minimum score of 40% (was 30%) even for very different poses
    overallSimilarity = Math.min(100, 40 + (overallSimilarity * 0.6));
    
    return {
        overall: overallSimilarity,
        keypoints: keypointSimilarities
    };
}

// Update the comparison display with similarity results
function updateComparisonDisplay(similarity, currentPose) {
    // Update overall score
    matchScore.textContent = `${Math.round(similarity.overall)}%`;
    
    // Update match color based on score - even more lenient thresholds
    if (similarity.overall >= 50) { // Reduced from 60
        matchScore.style.color = '#27ae60'; // Good match (green)
    } else if (similarity.overall >= 30) { // Reduced from 35
        matchScore.style.color = '#f39c12'; // Medium match (orange)
    } else {
        matchScore.style.color = '#e74c3c'; // Poor match (red)
    }
    
    // Clear previous details
    matchDetails.innerHTML = '';
    
    // Add overall feedback - even more encouraging messages
    let overallFeedback;
    if (similarity.overall >= 50) { // Reduced from 60
        overallFeedback = 'Great job! Your pose matches the reference well!';
    } else if (similarity.overall >= 30) { // Reduced from 35
        overallFeedback = 'Good effort! You\'re getting closer to the reference pose.';
    } else {
        overallFeedback = 'You\'re on the right track! Keep adjusting your pose.';
    }
    
    const overallElement = document.createElement('div');
    overallElement.classList.add('match-detail');
    overallElement.classList.add(similarity.overall >= 50 ? 'good' : similarity.overall >= 30 ? 'medium' : 'poor');
    overallElement.textContent = overallFeedback;
    matchDetails.appendChild(overallElement);
    
    // Add specific feedback for keypoints with low similarity
    // Even more lenient threshold for what's considered a "low similarity" keypoint
    const lowSimilarityKeypoints = similarity.keypoints
        .filter(kp => kp.similarity < 40) // Reduced from 50
        .sort((a, b) => a.similarity - b.similarity)
        .slice(0, 2);
    
    if (lowSimilarityKeypoints.length > 0) {
        // Create a single element for all keypoint feedback
        const keypointFeedback = document.createElement('div');
        keypointFeedback.classList.add('match-detail');
        keypointFeedback.classList.add('medium'); // Changed from 'poor' to 'medium' for less negative feedback
        
        // Format the keypoint names for better readability
        const keypointNames = lowSimilarityKeypoints.map(kp => {
            return kp.name.replace('_', ' ');
        }).join(', ');
        
        keypointFeedback.textContent = `Consider adjusting your ${keypointNames} position`;
        matchDetails.appendChild(keypointFeedback);
    }
}

// Start recording the comparison video
function startComparisonRecording() {
    try {
        if (!comparisonVideo.srcObject) {
            alert('Please start the camera first before recording.');
            return;
        }
        
        console.log('Starting comparison recording...');
        
        // Reset recording variables
        comparisonRecordedChunks = [];
        comparisonRecordedBlob = null;
        
        // Create a composite canvas to capture both video and overlay
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = comparisonCanvas.width;
        compositeCanvas.height = comparisonCanvas.height;
        const compositeCtx = compositeCanvas.getContext('2d');
        
        // Create a reference pose canvas for the recording
        const recordingReferenceCanvas = document.createElement('canvas');
        recordingReferenceCanvas.width = referencePoseCanvas.width;
        recordingReferenceCanvas.height = referencePoseCanvas.height;
        const refCtx = recordingReferenceCanvas.getContext('2d');
        
        // Draw the reference pose in light blue
        refCtx.drawImage(referencePoseCanvas, 0, 0);
        
        // Function to draw both video and overlay to the composite canvas
        const drawComposite = () => {
            if (!isRecordingComparison) return;
            
            // Draw the video frame
            compositeCtx.drawImage(comparisonVideo, 0, 0, compositeCanvas.width, compositeCanvas.height);
            
            // Draw the pose overlay (copy from the comparison canvas)
            compositeCtx.drawImage(comparisonCanvas, 0, 0);
            
            // Draw the reference pose canvas in a corner (scaled down)
            const refWidth = compositeCanvas.width * 0.25;
            const refHeight = (referencePoseCanvas.height / referencePoseCanvas.width) * refWidth;
            compositeCtx.drawImage(recordingReferenceCanvas, 
                compositeCanvas.width - refWidth - 10, 10, 
                refWidth, refHeight);
            
            // Add a label for the reference pose
            compositeCtx.font = '14px Arial';
            compositeCtx.fillStyle = '#87CEFA';
            compositeCtx.fillText('Reference Pose', 
                compositeCanvas.width - refWidth - 10, 
                refHeight + 25);
            
            // Schedule next frame
            if (isRecordingComparison) {
                requestAnimationFrame(drawComposite);
            }
        };
        
        // Start the composite drawing
        drawComposite();
        
        // Get stream from the composite canvas
        const compositeStream = compositeCanvas.captureStream(30); // 30 FPS
        
        // Add audio track if available
        if (comparisonVideo.srcObject && comparisonVideo.srcObject.getAudioTracks().length > 0) {
            const audioTrack = comparisonVideo.srcObject.getAudioTracks()[0];
            compositeStream.addTrack(audioTrack);
        }
        
        // Set up media recorder with appropriate options
        let options;
        
        // Try to find the best supported codec
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2500000 }; // 2.5 Mbps
            console.log('Using VP9 codec');
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2500000 }; // 2.5 Mbps
            console.log('Using VP8 codec');
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            options = { mimeType: 'video/webm', videoBitsPerSecond: 2500000 }; // 2.5 Mbps
            console.log('Using default webm format');
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options = { mimeType: 'video/mp4', videoBitsPerSecond: 2500000 }; // 2.5 Mbps
            console.log('Using MP4 format');
        } else {
            console.log('No specific format supported, using default');
            options = {}; // Let the browser decide
        }
        
        comparisonMediaRecorder = new MediaRecorder(compositeStream, options);
        console.log('MediaRecorder created with options:', options);
        console.log('MediaRecorder mimeType:', comparisonMediaRecorder.mimeType);
        
        // Handle data available event
        comparisonMediaRecorder.ondataavailable = (event) => {
            console.log('Data chunk received, size:', event.data.size);
            if (event.data && event.data.size > 0) {
                comparisonRecordedChunks.push(event.data);
            }
        };
        
        // Handle recording stop event
        comparisonMediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped event fired');
            // Note: The actual blob creation is now handled in stopComparisonRecording
        };
        
        // Start recording with data available every second for better reliability
        comparisonMediaRecorder.start(1000);
        isRecordingComparison = true;
        
        // Update UI
        recordComparisonBtn.disabled = true;
        stopComparisonRecordingBtn.disabled = false;
        downloadComparisonBtn.disabled = true;
        
        console.log('Comparison recording started');
        
    } catch (error) {
        console.error('Error starting comparison recording:', error);
        alert('Error starting recording: ' + error.message);
    }
}

// Stop recording the comparison video
function stopComparisonRecording() {
    try {
        if (!comparisonMediaRecorder || comparisonMediaRecorder.state === 'inactive') {
            console.warn('No active comparison recording to stop');
            return;
        }
        
        console.log('Stopping comparison recording...');
        
        // Make sure we have a handler for the last data chunk
        comparisonMediaRecorder.ondataavailable = (event) => {
            console.log('Final data chunk received, size:', event.data.size);
            if (event.data && event.data.size > 0) {
                comparisonRecordedChunks.push(event.data);
            }
            
            // Create blob from recorded chunks after the last chunk is received
            const mimeType = comparisonMediaRecorder.mimeType || 'video/webm';
            comparisonRecordedBlob = new Blob(comparisonRecordedChunks, { type: mimeType });
            console.log('Comparison recording completed:', comparisonRecordedBlob.size, 'bytes');
            
            // Enable download button
            downloadComparisonBtn.disabled = false;
        };
        
        // Stop the media recorder
        comparisonMediaRecorder.stop();
        isRecordingComparison = false;
        
        // Update UI
        recordComparisonBtn.disabled = false;
        stopComparisonRecordingBtn.disabled = true;
        
        console.log('Comparison recording stop requested');
        
    } catch (error) {
        console.error('Error stopping comparison recording:', error);
        alert('Error stopping recording: ' + error.message);
    }
}

// Download the recorded comparison video
function downloadComparisonVideo() {
    try {
        // Show loading state
        downloadComparisonBtn.textContent = 'Preparing...';
        downloadComparisonBtn.disabled = true;
        
        if (!comparisonRecordedBlob) {
            console.error('No recorded video blob available');
            alert('No recorded video available to download. Please record a video first.');
            // Reset button
            downloadComparisonBtn.textContent = 'Download Video';
            downloadComparisonBtn.disabled = false;
            return;
        }
        
        console.log('Preparing download, blob size:', comparisonRecordedBlob.size, 'bytes');
        
        if (comparisonRecordedBlob.size === 0) {
            console.error('Recorded video blob is empty');
            alert('The recorded video appears to be empty. Please try recording again.');
            // Reset button
            downloadComparisonBtn.textContent = 'Download Video';
            downloadComparisonBtn.disabled = false;
            return;
        }
        
        // Create a filename with date and time
        const now = new Date();
        const filename = 'pose-comparison-' + 
            now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + '-' + 
            String(now.getHours()).padStart(2, '0') + '-' + 
            String(now.getMinutes()).padStart(2, '0') + '-' + 
            String(now.getSeconds()).padStart(2, '0') + 
            '.webm';
        
        // Create download link
        const url = URL.createObjectURL(comparisonRecordedBlob);
        
        // Try the standard download approach first
        try {
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            
            console.log('Download link created:', url);
            console.log('Filename:', filename);
            
            // Add to document, trigger click, and remove
            document.body.appendChild(a);
            a.click();
            
            // Clean up with a longer timeout to ensure the download starts properly
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('Download link cleaned up');
                
                // Reset button
                downloadComparisonBtn.textContent = 'Download Video';
                downloadComparisonBtn.disabled = false;
            }, 3000); // 3 seconds
            
        } catch (innerError) {
            console.error('Standard download failed, trying fallback method:', innerError);
            
            // Fallback method: Open in new tab/window
            const fallbackMessage = 'Direct download failed. A new tab will open with the video.\n\n' +
                'Please right-click on the video and select "Save video as..." to download it.';
            alert(fallbackMessage);
            
            window.open(url, '_blank');
            
            // Reset button
            downloadComparisonBtn.textContent = 'Download Video';
            downloadComparisonBtn.disabled = false;
            
            // We don't revoke the URL in this case as the user needs it to remain valid
            // They will need to manually close the tab when done
        }
        
        console.log('Comparison video download initiated');
        
    } catch (error) {
        console.error('Error downloading comparison video:', error);
        alert('Error downloading video: ' + error.message + '\n\nPlease try again or check the console for more details.');
        
        // Reset button
        downloadComparisonBtn.textContent = 'Download Video';
        downloadComparisonBtn.disabled = false;
    }
}

// ... rest of existing code ... 