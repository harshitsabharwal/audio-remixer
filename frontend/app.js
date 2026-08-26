// --- AUTHENTICATION CHECK ---
const token = localStorage.getItem('daw_token');
if (!token) {
    window.location.href = 'auth.html';
}

function logout() {
    localStorage.removeItem('daw_token');
    localStorage.removeItem('daw_user');
    window.location.href = 'auth.html';
}


const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const PIXELS_PER_SECOND = 50;
let assets = [];
let blocks = [];
let selectedBlockId = null;

// Undo / Redo History Stack
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 30;

// Transport State
let isPlaying = false;
let startTime = 0;
let pauseTimeOffset = 0;
let animationFrameId;

// Preview Visual Tracking State
let isPreviewPlaying = false;
let previewStartTimeContext = 0;
let previewStartTimelineTime = 0;
let previewDurationLeft = 0;
let currentPreviewSpeed = 1.0;

// Export & Clipboard State
let renderedMixBuffer = null;
let clipboardBlockData = null; 

// DOM Elements
const uploadDropzone = document.getElementById('upload-dropzone'); 
const uploadAssetBtn = document.getElementById('upload-asset');
const assetList = document.getElementById('asset-list');
const tracksContainer = document.getElementById('tracks-container');
const timeDisplay = document.getElementById('time-display');
const globalPlayBtn = document.getElementById('global-play');
const globalStopBtn = document.getElementById('global-stop');

const exportBtn = document.getElementById('export-btn');
const exportStatus = document.getElementById('export-status');
const exportOptions = document.getElementById('export-options');
const dlWavBtn = document.getElementById('dl-wav-btn');
const dlMp3Btn = document.getElementById('dl-mp3-btn');
const cancelExportBtn = document.getElementById('cancel-export-btn');

// Inspector DOM Elements
const contextToolbar = document.getElementById('context-toolbar');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const clipVolumeSlider = document.getElementById('clip-volume');
const volValDisplay = document.getElementById('vol-val');
const clipSpeedSlider = document.getElementById('clip-speed');
const speedValDisplay = document.getElementById('speed-val');
const previewPlayBtn = document.getElementById('preview-play-btn');
const splitSelectedBtn = document.getElementById('split-selected-btn'); 

const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// SVG Icons for the Play/Pause States
const globalPlayIcon = `<svg class="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
const globalPauseIcon = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
const previewPlayIcon = `<svg class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
const previewPauseIcon = `<svg class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

// Visual Playhead Setup
const playhead = document.createElement('div');
playhead.style.position = 'absolute';
playhead.style.top = '0';
playhead.style.bottom = '0';
playhead.style.width = '2px';
playhead.style.backgroundColor = '#ef4444'; 
playhead.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
playhead.style.left = '0px';
playhead.style.zIndex = '50';
playhead.style.pointerEvents = 'none';
tracksContainer.appendChild(playhead);

// --- HISTORY STATE ENGINE ---
function saveStateToHistory() {
    const currentState = blocks.map(b => {
        const el = document.getElementById(b.id);
        const parentTrack = el ? el.closest('.track') : null;
        const trackNodes = Array.from(document.querySelectorAll('.track'));
        return {
            id: b.id,
            asset: b.asset,
            startTime: b.startTime,
            trimStart: b.trimStart,
            trimDuration: b.trimDuration,
            volume: b.volume,
            speed: b.speed,
            trackIndex: parentTrack ? trackNodes.indexOf(parentTrack) : 0
        };
    });

    undoStack.push(currentState);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = []; 
    updateUndoRedoUI();
}

function updateUndoRedoUI() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

async function restoreState(state) {
    stopAnyPreview();
    if (isPlaying) globalPlayBtn.click();

    blocks.forEach(b => {
        if (b.activeSource) b.activeSource.stop();
        if (b.wavesurfer) b.wavesurfer.destroy();
        document.getElementById(b.id)?.remove();
    });
    blocks = [];

    for (const bData of state) {
        while (document.querySelectorAll('.track').length <= bData.trackIndex) {
            const newIndex = document.querySelectorAll('.track').length + 1;
            const newTrack = document.createElement('div');
            newTrack.className = 'h-[104px] min-h-[104px] shrink-0 bg-gray-900/20 border-b border-gray-800 relative track flex items-center hover:bg-gray-800/10 transition-colors';
            newTrack.style.minWidth = '3000px';
            newTrack.innerHTML = `<div class="absolute left-4 top-3 text-[10px] font-mono text-gray-600 font-bold uppercase pointer-events-none tracking-widest z-0">Track ${newIndex}</div>`;
            document.getElementById('tracks-container').appendChild(newTrack);
        }
        const targetTrack = document.querySelectorAll('.track')[bData.trackIndex];

        addAssetToTimeline(bData.asset.id, {
            startTime: bData.startTime,
            trimStart: bData.trimStart,
            trimDuration: bData.trimDuration,
            volume: bData.volume,
            speed: bData.speed,
            trackElement: targetTrack
        }, false); // Pass false to prevent infinite recursive history logging during restore
    }
    updateUndoRedoUI();
}

undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    
    const currentState = blocks.map(b => {
        const el = document.getElementById(b.id);
        const parentTrack = el ? el.closest('.track') : null;
        const trackNodes = Array.from(document.querySelectorAll('.track'));
        return {
            id: b.id, asset: b.asset, startTime: b.startTime, trimStart: b.trimStart,
            trimDuration: b.trimDuration, volume: b.volume, speed: b.speed,
            trackIndex: parentTrack ? trackNodes.indexOf(parentTrack) : 0
        };
    });
    redoStack.push(currentState);

    const previousState = undoStack.pop();
    restoreState(previousState);
});

redoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) return;

    const currentState = blocks.map(b => {
        const el = document.getElementById(b.id);
        const parentTrack = el ? el.closest('.track') : null;
        const trackNodes = Array.from(document.querySelectorAll('.track'));
        return {
            id: b.id, asset: b.asset, startTime: b.startTime, trimStart: b.trimStart,
            trimDuration: b.trimDuration, volume: b.volume, speed: b.speed,
            trackIndex: parentTrack ? trackNodes.indexOf(parentTrack) : 0
        };
    });
    undoStack.push(currentState);

    const nextState = redoStack.pop();
    restoreState(nextState);
});

// --- Drag and Drop Upload Logic ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, () => {
        uploadDropzone.classList.add('border-blue-500', 'bg-gray-800/60');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, () => {
        uploadDropzone.classList.remove('border-blue-500', 'bg-gray-800/60');
    }, false);
});

uploadDropzone.addEventListener('drop', async (e) => {
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('audio/')) return;
    await processAudioUpload(file);
});

uploadAssetBtn.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processAudioUpload(file);
});

async function processAudioUpload(file) {
    try {
        const token = localStorage.getItem('daw_token');
        if (audioContext.state === 'suspended') await audioContext.resume();

        const formData = new FormData();
        formData.append('audio', file);

        const response = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        const permanentUrl = data.url; 
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        assets.push({ 
            id: Date.now(), 
            name: file.name, 
            duration: audioBuffer.duration, 
            buffer: audioBuffer,
            url: permanentUrl 
        });
        
        renderAssetList();
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Failed to upload audio: " + error.message);
    }
}

function renderAssetList() {
    assetList.innerHTML = '';
    assets.forEach(asset => {
        const div = document.createElement('div');
        div.className = 'bg-gray-800/80 border border-gray-700/50 p-3 rounded-xl flex justify-between items-center transition hover:bg-gray-700/80 shadow-sm group';
        div.innerHTML = `
            <div class="flex flex-col truncate pr-3 w-3/4">
                <span class="text-xs font-semibold text-gray-200 truncate" title="${asset.name}">${asset.name}</span>
                <span class="text-[10px] text-gray-400 font-mono mt-0.5">${asset.duration.toFixed(1)}s</span>
            </div>
            <button class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition border border-blue-500/20 group-hover:border-blue-500/50" onclick="addAssetToTimelineWithHistory(${asset.id})" title="Add to Timeline">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>
        `;
        assetList.appendChild(div);
    });
}

function ensureEmptyBottomTrack() {
    const allTracks = document.querySelectorAll('.track');
    const lastTrack = allTracks[allTracks.length - 1];
    
    if (lastTrack && lastTrack.querySelector('.audio-block')) {
        const trackIndex = allTracks.length + 1;
        const newTrack = document.createElement('div');
        newTrack.className = 'h-[104px] min-h-[104px] shrink-0 bg-gray-900/20 border-b border-gray-800 relative track flex items-center hover:bg-gray-800/10 transition-colors';
        newTrack.style.minWidth = '3000px';
        newTrack.innerHTML = `<div class="absolute left-4 top-3 text-[10px] font-mono text-gray-600 font-bold uppercase pointer-events-none tracking-widest z-0">Track ${trackIndex}</div>`;
        tracksContainer.appendChild(newTrack);
    }
}

window.addAssetToTimelineWithHistory = function(assetId, options = {}) {
    saveStateToHistory();
    addAssetToTimeline(assetId, options);
}

// Spawn Block onto Timeline
window.addAssetToTimeline = function(assetId, options = {}) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const blockData = {
        id: 'block-' + Date.now() + Math.random(),
        asset: asset,
        startTime: options.startTime !== undefined ? options.startTime : 0,
        trimStart: options.trimStart !== undefined ? options.trimStart : 0,
        trimDuration: options.trimDuration !== undefined ? options.trimDuration : asset.duration,
        volume: options.volume !== undefined ? options.volume : 1.0,
        speed: options.speed !== undefined ? options.speed : 1.0,
        activeSource: null,
        gainNode: null,
        previewSource: null,
        previewGain: null,
        wavesurfer: null 
    };
    blocks.push(blockData);

    const blockDiv = document.createElement('div');
    blockDiv.id = blockData.id;
    blockDiv.className = 'audio-block border border-blue-400/50 rounded-lg flex justify-center items-center overflow-hidden shadow-lg';
    
    blockDiv.style.left = (blockData.startTime * PIXELS_PER_SECOND) + 'px';
    blockDiv.style.width = ((blockData.trimDuration / blockData.speed) * PIXELS_PER_SECOND) + 'px';
    blockDiv.style.height = '72px';
    
    blockDiv.innerHTML = `
        <div class="trim-handle left"></div>
        <div class="waveform-wrapper absolute top-0 bottom-0 pointer-events-none" style="width: ${((asset.duration / blockData.speed) * PIXELS_PER_SECOND)}px; left: ${-((blockData.trimStart / blockData.speed) * PIXELS_PER_SECOND)}px;">
            <div class="waveform w-full h-full opacity-60"></div>
        </div>
        <span class="truncate pointer-events-none px-4 relative z-20 text-[11px] tracking-wide font-semibold text-white drop-shadow-md">${asset.name}</span>
        <div class="trim-handle right"></div>
    `;

    blockDiv.addEventListener('mousedown', () => {
        document.querySelectorAll('.audio-block').forEach(b => b.classList.remove('selected'));
        blockDiv.classList.add('selected');
        selectedBlockId = blockData.id;
        
        clipVolumeSlider.value = blockData.volume;
        volValDisplay.innerText = blockData.volume.toFixed(1);
        clipSpeedSlider.value = blockData.speed;
        speedValDisplay.innerText = blockData.speed.toFixed(1) + 'x';

        contextToolbar.classList.remove('hidden');
    });

    const allTracks = document.querySelectorAll('.track');
    let targetTrack = options.trackElement || allTracks[0];
    
    if (!options.trackElement) {
        for (let i = 0; i < allTracks.length; i++) {
            if (!allTracks[i].querySelector('.audio-block')) {
                targetTrack = allTracks[i];
                break;
            }
        }
    }
    
    targetTrack.appendChild(blockDiv);

    const waveContainer = blockDiv.querySelector('.waveform');
    blockData.wavesurfer = WaveSurfer.create({
        container: waveContainer,
        url: asset.url,
        waveColor: 'rgba(255, 255, 255, 0.5)',
        progressColor: 'rgba(255, 255, 255, 0.5)',
        cursorWidth: 0,
        interact: false, 
        height: 72
    });

    makeDraggable(blockDiv, blockData);
    makeResizable(blockDiv, blockData, blockDiv.querySelector('.trim-handle.left'), true);
    makeResizable(blockDiv, blockData, blockDiv.querySelector('.trim-handle.right'), false);
    ensureEmptyBottomTrack();
};

function splitSelectedClip() {
    if (!selectedBlockId) return;
    const block = blocks.find(b => b.id === selectedBlockId);
    if (!block) return;

    const blockEndTime = block.startTime + (block.trimDuration / block.speed);
    
    if (pauseTimeOffset > block.startTime && pauseTimeOffset < blockEndTime) {
        saveStateToHistory(); // Record state before splitting

        const splitScreenTime = pauseTimeOffset - block.startTime;
        const splitAudioTime = splitScreenTime * block.speed;

        const oldTrimStart = block.trimStart;
        const oldTrimDuration = block.trimDuration;

        block.trimDuration = splitAudioTime;
        const block1Div = document.getElementById(block.id);
        block1Div.style.width = ((block.trimDuration / block.speed) * PIXELS_PER_SECOND) + 'px';
        
        const parentTrack = block1Div.closest('.track');
        
        addAssetToTimeline(block.asset.id, {
            startTime: pauseTimeOffset,
            trimStart: oldTrimStart + splitAudioTime,
            trimDuration: oldTrimDuration - splitAudioTime,
            volume: block.volume,
            speed: block.speed,
            trackElement: parentTrack
        });
    } else {
        alert("Move the red playhead over the selected clip to split it.");
    }
}

splitSelectedBtn.addEventListener('click', splitSelectedClip);

// Keydown Listeners (Shortcuts, Undo, Redo, Spacebar, Delete)
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const isModifierPressed = e.ctrlKey || e.metaKey;

    // UNDO (Ctrl+Z)
    if (isModifierPressed && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoBtn.click();
    }

    // REDO (Ctrl+Y or Ctrl+Shift+Z)
    if (isModifierPressed && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redoBtn.click();
    }

    // PLAY/PAUSE (Spacebar)
    if (!isModifierPressed && e.code === 'Space') {
        e.preventDefault();
        globalPlayBtn.click();
    }

    // DELETE CLIP (Delete or Backspace)
    if (!isModifierPressed && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedBlockId) deleteSelectedBtn.click();
    }

    // SPLIT (S)
    if (!isModifierPressed && e.key.toLowerCase() === 's') {
        splitSelectedClip();
    }

    // COPY (Ctrl+C)
    if (isModifierPressed && e.key.toLowerCase() === 'c') {
        if (selectedBlockId) {
            const blockToCopy = blocks.find(b => b.id === selectedBlockId);
            if (blockToCopy) {
                clipboardBlockData = {
                    assetId: blockToCopy.asset.id,
                    trimStart: blockToCopy.trimStart,
                    trimDuration: blockToCopy.trimDuration,
                    volume: blockToCopy.volume,
                    speed: blockToCopy.speed
                };
            }
        }
    }

    // CUT (Ctrl+X)
    if (isModifierPressed && e.key.toLowerCase() === 'x') {
        if (selectedBlockId) {
            const blockToCopy = blocks.find(b => b.id === selectedBlockId);
            if (blockToCopy) {
                clipboardBlockData = {
                    assetId: blockToCopy.asset.id,
                    trimStart: blockToCopy.trimStart,
                    trimDuration: blockToCopy.trimDuration,
                    volume: blockToCopy.volume,
                    speed: blockToCopy.speed
                };
                deleteSelectedBtn.click(); 
            }
        }
    }

    // PASTE (Ctrl+V)
    if (isModifierPressed && e.key.toLowerCase() === 'v') {
        if (clipboardBlockData) {
            saveStateToHistory();
            addAssetToTimeline(clipboardBlockData.assetId, {
                startTime: pauseTimeOffset,
                trimStart: clipboardBlockData.trimStart,
                trimDuration: clipboardBlockData.trimDuration,
                volume: clipboardBlockData.volume,
                speed: clipboardBlockData.speed
            });
        }
    }
});

function seekTimeline(clickX) {
    const wasPlaying = isPlaying;
    const wasPreviewPlaying = isPreviewPlaying;
    
    stopAnyPreview();
    if (wasPlaying) globalPlayBtn.click(); 
    
    pauseTimeOffset = clickX / PIXELS_PER_SECOND;
    
    playhead.style.left = (pauseTimeOffset * PIXELS_PER_SECOND) + 'px';
    const mins = Math.floor(pauseTimeOffset / 60).toString().padStart(2, '0');
    const secs = Math.floor(pauseTimeOffset % 60).toString().padStart(2, '0');
    const ms = Math.floor((pauseTimeOffset % 1) * 100).toString().padStart(2, '0');
    timeDisplay.innerText = `${mins}:${secs}.${ms}`;
    
    if (wasPlaying) globalPlayBtn.click();
    if (wasPreviewPlaying && !wasPlaying) previewPlayBtn.click();
}

tracksContainer.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('track') || e.target.id === 'tracks-container') {
        document.querySelectorAll('.audio-block').forEach(b => b.classList.remove('selected'));
        selectedBlockId = null;
        contextToolbar.classList.add('hidden');
        stopAnyPreview();
    }
    if (e.target.classList.contains('trim-handle') || e.button !== 0) return;

    const rect = tracksContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left + tracksContainer.scrollLeft;
    seekTimeline(Math.max(0, clickX));
});

// Inspector Events
clipVolumeSlider.addEventListener('input', (e) => {
    if (!selectedBlockId) return;
    const val = parseFloat(e.target.value);
    volValDisplay.innerText = val.toFixed(1);
    
    const block = blocks.find(b => b.id === selectedBlockId);
    if (block) {
        block.volume = val;
        if (block.gainNode) block.gainNode.gain.value = val;
        if (block.previewGain) block.previewGain.gain.value = val;
    }
});

clipSpeedSlider.addEventListener('input', (e) => {
    if (!selectedBlockId) return;
    const val = parseFloat(e.target.value);
    speedValDisplay.innerText = val.toFixed(1) + 'x';
    
    const block = blocks.find(b => b.id === selectedBlockId);
    if (block) {
        block.speed = val;
        if (block.activeSource) block.activeSource.playbackRate.value = val;
        if (block.previewSource) block.previewSource.playbackRate.value = val;

        const blockDiv = document.getElementById(block.id);
        if (blockDiv) {
            blockDiv.style.width = ((block.trimDuration / block.speed) * PIXELS_PER_SECOND) + 'px';
            const waveWrapper = blockDiv.querySelector('.waveform-wrapper');
            if (waveWrapper) {
                waveWrapper.style.width = ((block.asset.duration / block.speed) * PIXELS_PER_SECOND) + 'px';
                waveWrapper.style.left = -((block.trimStart / block.speed) * PIXELS_PER_SECOND) + 'px';
            }
        }
    }
});

function stopAnyPreview() {
    if (isPreviewPlaying) {
        blocks.forEach(b => {
            if (b.previewSource) {
                b.previewSource.stop();
                b.previewSource = null;
            }
        });
        isPreviewPlaying = false;
        cancelAnimationFrame(animationFrameId);
        previewPlayBtn.innerHTML = previewPlayIcon;
        document.querySelectorAll('.preview-active').forEach(el => el.classList.remove('preview-active'));

        const passedContextTime = audioContext.currentTime - previewStartTimeContext;
        pauseTimeOffset = previewStartTimelineTime + passedContextTime;
    }
}

function previewUpdateVisuals() {
    if (!isPreviewPlaying) return;
    
    const passedContextTime = audioContext.currentTime - previewStartTimeContext;
    const passedAudioTime = passedContextTime * currentPreviewSpeed;
    
    if (passedAudioTime >= previewDurationLeft) {
        isPreviewPlaying = false;
        previewPlayBtn.innerHTML = previewPlayIcon;
        document.querySelectorAll('.preview-active').forEach(el => el.classList.remove('preview-active'));
        pauseTimeOffset = previewStartTimelineTime + (previewDurationLeft / currentPreviewSpeed);
        
        const mins = Math.floor(pauseTimeOffset / 60).toString().padStart(2, '0');
        const secs = Math.floor(pauseTimeOffset % 60).toString().padStart(2, '0');
        const ms = Math.floor((pauseTimeOffset % 1) * 100).toString().padStart(2, '0');
        timeDisplay.innerText = `${mins}:${secs}.${ms}`;
        playhead.style.left = (pauseTimeOffset * PIXELS_PER_SECOND) + 'px';
        return;
    }

    const currentTimelineTime = previewStartTimelineTime + passedContextTime;
    
    const mins = Math.floor(currentTimelineTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(currentTimelineTime % 60).toString().padStart(2, '0');
    const ms = Math.floor((currentTimelineTime % 1) * 100).toString().padStart(2, '0');
    timeDisplay.innerText = `${mins}:${secs}.${ms}`;

    playhead.style.left = (currentTimelineTime * PIXELS_PER_SECOND) + 'px';
    animationFrameId = requestAnimationFrame(previewUpdateVisuals);
}

previewPlayBtn.addEventListener('click', () => {
    if (!selectedBlockId) return;
    const block = blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const blockDiv = document.getElementById(block.id);

    if (isPreviewPlaying) {
        stopAnyPreview();
    } else {
        if (audioContext.state === 'suspended') audioContext.resume();
        stopAnyPreview(); 
        if (isPlaying) globalPlayBtn.click(); 

        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();

        source.buffer = block.asset.buffer;
        source.playbackRate.value = block.speed;
        gainNode.gain.value = block.volume;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        let offsetIntoBlock = 0;
        if (pauseTimeOffset >= block.startTime && pauseTimeOffset < (block.startTime + (block.trimDuration / block.speed))) {
            offsetIntoBlock = (pauseTimeOffset - block.startTime) * block.speed;
        } else {
            pauseTimeOffset = block.startTime;
            offsetIntoBlock = 0;
        }

        const audioOffset = block.trimStart + offsetIntoBlock;
        const durationLeft = block.trimDuration - offsetIntoBlock;

        if (durationLeft <= 0) return;

        source.start(0, audioOffset, durationLeft);
        
        block.previewSource = source;
        block.previewGain = gainNode;

        isPreviewPlaying = true;
        previewStartTimeContext = audioContext.currentTime;
        previewStartTimelineTime = pauseTimeOffset; 
        previewDurationLeft = durationLeft;
        currentPreviewSpeed = block.speed;
        
        previewPlayBtn.innerHTML = previewPauseIcon;
        blockDiv.classList.add('preview-active'); 
        
        cancelAnimationFrame(animationFrameId); 
        previewUpdateVisuals();
    }
});

deleteSelectedBtn.addEventListener('click', () => {
    if (!selectedBlockId) return;
    saveStateToHistory(); // Record state before deleting

    const blockData = blocks.find(b => b.id === selectedBlockId);
    if (blockData) {
        if (blockData.activeSource) blockData.activeSource.stop();
        if (blockData.previewSource) blockData.previewSource.stop();
        if (blockData.wavesurfer) blockData.wavesurfer.destroy();
    }
    
    stopAnyPreview();
    
    blocks = blocks.filter(b => b.id !== selectedBlockId);
    document.getElementById(selectedBlockId).remove();
    contextToolbar.classList.add('hidden');
    selectedBlockId = null;
});

// Drag-and-Drop with History Tracking
function makeDraggable(element, blockData) {
    let isDragging = false, startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('trim-handle')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(element.style.left || 0);
        initialTop = 16; 
        element.style.zIndex = '100';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = Math.max(0, initialLeft + (e.clientX - startX));
        element.style.left = newLeft + 'px';
        element.style.top = (initialTop + (e.clientY - startY)) + 'px';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        element.style.zIndex = '1';

        element.style.display = 'none';
        let elementBelow = document.elementFromPoint(e.clientX, e.clientY);
        element.style.display = 'flex';

        let targetTrack = elementBelow ? elementBelow.closest('.track') : null;
        if (targetTrack) {
            targetTrack.appendChild(element);
        }
        element.style.top = '16px'; 

        const newStartTime = parseInt(element.style.left || 0) / PIXELS_PER_SECOND;
        if (blockData.startTime !== newStartTime) {
            saveStateToHistory(); // Record position change
            blockData.startTime = newStartTime;
        }
        ensureEmptyBottomTrack();
    });
}

// Trimming with History Tracking
function makeResizable(element, blockData, handle, isLeft) {
    let isResizing = false, startX, initialLeft, initialTrimStart, initialTrimDuration;
    const waveWrapper = element.querySelector('.waveform-wrapper');

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        saveStateToHistory(); // Record state right before resize starts
        startX = e.clientX;
        initialLeft = parseInt(element.style.left || 0);
        initialTrimStart = blockData.trimStart;
        initialTrimDuration = blockData.trimDuration;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const deltaX = e.clientX - startX;
        
        const deltaSecOnScreen = deltaX / PIXELS_PER_SECOND;
        const deltaSourceSec = deltaSecOnScreen * blockData.speed;

        if (isLeft) {
            let allowedDeltaSourceSec = Math.max(-initialTrimStart, Math.min(deltaSourceSec, initialTrimDuration - 0.2));
            let allowedDeltaScreenSec = allowedDeltaSourceSec / blockData.speed;

            blockData.trimStart = initialTrimStart + allowedDeltaSourceSec;
            blockData.trimDuration = initialTrimDuration - allowedDeltaSourceSec;
            blockData.startTime = (initialLeft / PIXELS_PER_SECOND) + allowedDeltaScreenSec;

            element.style.left = (blockData.startTime * PIXELS_PER_SECOND) + 'px';
            element.style.width = ((blockData.trimDuration / blockData.speed) * PIXELS_PER_SECOND) + 'px';
            
            waveWrapper.style.left = -((blockData.trimStart / blockData.speed) * PIXELS_PER_SECOND) + 'px';
        } else {
            let maxRightLimit = blockData.asset.duration - initialTrimStart;
            let allowedDeltaSourceSec = Math.max(-initialTrimDuration + 0.2, Math.min(deltaSourceSec, maxRightLimit - initialTrimDuration));
            blockData.trimDuration = initialTrimDuration + allowedDeltaSourceSec;
            
            element.style.width = ((blockData.trimDuration / blockData.speed) * PIXELS_PER_SECOND) + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

// Global Transport Engine
function updateVisuals() {
    if (!isPlaying) return;
    const currentTime = audioContext.currentTime - startTime + pauseTimeOffset;

    const mins = Math.floor(currentTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(currentTime % 60).toString().padStart(2, '0');
    const ms = Math.floor((currentTime % 1) * 100).toString().padStart(2, '0');
    timeDisplay.innerText = `${mins}:${secs}.${ms}`;

    playhead.style.left = (currentTime * PIXELS_PER_SECOND) + 'px';
    animationFrameId = requestAnimationFrame(updateVisuals);
}

globalPlayBtn.addEventListener('click', () => {
    if (isPlaying) {
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
        pauseTimeOffset += (audioContext.currentTime - startTime);

        blocks.forEach(block => {
            if (block.activeSource) {
                block.activeSource.stop();
                block.activeSource = null;
            }
        });
        
        globalPlayBtn.innerHTML = globalPlayIcon;
        
    } else {
        stopAnyPreview(); 
        
        if (audioContext.state === 'suspended') audioContext.resume();
        isPlaying = true;
        startTime = audioContext.currentTime;

        blocks.forEach(block => {
            if (block.previewSource) {
                block.previewSource.stop();
                block.previewSource = null;
            }

            if (block.startTime >= pauseTimeOffset) {
                const source = audioContext.createBufferSource();
                const gainNode = audioContext.createGain();

                source.buffer = block.asset.buffer;
                source.playbackRate.value = block.speed; 
                gainNode.gain.value = block.volume; 

                source.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                block.activeSource = source;
                block.gainNode = gainNode;

                const scheduledTime = startTime + (block.startTime - pauseTimeOffset);
                source.start(scheduledTime, block.trimStart, block.trimDuration);
                
            } else if (pauseTimeOffset > block.startTime && pauseTimeOffset < (block.startTime + (block.trimDuration / block.speed))) {
                const source = audioContext.createBufferSource();
                const gainNode = audioContext.createGain();

                source.buffer = block.asset.buffer;
                source.playbackRate.value = block.speed;
                gainNode.gain.value = block.volume;

                source.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                block.activeSource = source;
                block.gainNode = gainNode;

                const offsetIntoBlock = (pauseTimeOffset - block.startTime) * block.speed;
                const audioOffset = block.trimStart + offsetIntoBlock;
                const durationLeft = block.trimDuration - offsetIntoBlock;
                source.start(startTime, audioOffset, durationLeft);
            }
        });

        globalPlayBtn.innerHTML = globalPauseIcon;
        updateVisuals();
    }
});

globalStopBtn.addEventListener('click', () => {
    stopAnyPreview();
    
    if (isPlaying) {
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
    }
    
    pauseTimeOffset = 0;
    timeDisplay.innerText = "00:00.00";
    playhead.style.left = "0px";

    blocks.forEach(block => {
        if (block.activeSource) {
            block.activeSource.stop();
            block.activeSource = null;
        }
    });
    
    globalPlayBtn.innerHTML = globalPlayIcon;
});

// Export Audio Engine
function audioBufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferData = new ArrayBuffer(length),
        view = new DataView(bufferData),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) { view.setUint16(offset, data, true); offset += 2; }
    function setUint32(data) { view.setUint32(offset, data, true); offset += 4; }

    setUint32(0x46464952);                         
    setUint32(length - 8);                         
    setUint32(0x45564157);                         
    setUint32(0x20746d66);                         
    setUint32(16);                                 
    setUint16(1);                                  
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);  
    setUint16(numOfChan * 2);                      
    setUint16(16);                                 
    setUint32(0x61746164);                         
    setUint32(length - pos - 4);                   

    for(i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
            view.setInt16(offset, sample, true); 
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferData], {type: "audio/wav"});
}

function audioBufferToMp3(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128); 
    const mp3Data = [];

    const left = buffer.getChannelData(0);
    const right = channels > 1 ? buffer.getChannelData(1) : left;

    const sampleBlockSize = 1152;
    const leftInt16 = new Int16Array(left.length);
    const rightInt16 = new Int16Array(right.length);

    for (let i = 0; i < left.length; i++) {
        leftInt16[i] = left[i] < 0 ? left[i] * 32768 : left[i] * 32767;
        rightInt16[i] = right[i] < 0 ? right[i] * 32768 : right[i] * 32767;
    }

    for (let i = 0; i < left.length; i += sampleBlockSize) {
        const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        let mp3buf;
        if (channels === 1) {
            mp3buf = mp3encoder.encodeBuffer(leftChunk);
        } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        }
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
    
    return new Blob(mp3Data, {type: 'audio/mp3'});
}

exportBtn.addEventListener('click', async () => {
    if (blocks.length === 0) {
        alert("Add some audio to the timeline first!");
        return;
    }

    exportStatus.classList.remove('hidden');
    exportStatus.innerText = "Rendering Audio...";
    exportBtn.disabled = true;
    document.getElementById('standard-actions').classList.add('hidden');

    try {
        let maxEndTime = 0;
        blocks.forEach(block => {
            const endTime = block.startTime + (block.trimDuration / block.speed);
            if (endTime > maxEndTime) maxEndTime = endTime;
        });

        const sampleRate = 44100;
        const lengthInSamples = Math.max(1, Math.ceil(maxEndTime * sampleRate));

        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, lengthInSamples, sampleRate);

        blocks.forEach(block => {
            const source = offlineCtx.createBufferSource();
            const gainNode = offlineCtx.createGain();

            source.buffer = block.asset.buffer;
            source.playbackRate.value = block.speed;
            gainNode.gain.value = block.volume;

            source.connect(gainNode);
            gainNode.connect(offlineCtx.destination);

            if (block.trimDuration > 0) {
                source.start(block.startTime, block.trimStart, block.trimDuration);
            }
        });

        renderedMixBuffer = await offlineCtx.startRendering();

        const wavSizeMB = ((renderedMixBuffer.length * 2 * 2 + 44) / (1024 * 1024)).toFixed(2);
        const mp3SizeMB = ((maxEndTime * 128 * 1000 / 8) / (1024 * 1024)).toFixed(2);

        dlWavBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> WAV (${wavSizeMB} MB)`;
        dlMp3Btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> MP3 (~${mp3SizeMB} MB)`;

        exportStatus.innerText = "Choose Format:";
        exportBtn.classList.add('hidden');
        exportOptions.classList.remove('hidden');
        exportOptions.classList.add('flex');
        
    } catch (error) {
        console.error("Export Error:", error);
        alert("An error occurred while exporting. Ensure your audio tracks are valid.");
        resetExportUI();
    }
});

function triggerDownload(blob, extension) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    anchor.href = url;
    anchor.download = `Pro_Mix_${Date.now()}.${extension}`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

function resetExportUI() {
    document.getElementById('standard-actions').classList.remove('hidden');
    exportStatus.classList.add('hidden');
    exportOptions.classList.add('hidden');
    exportOptions.classList.remove('flex');
    exportBtn.classList.remove('hidden');
    exportBtn.disabled = false;
    renderedMixBuffer = null;
}

dlWavBtn.addEventListener('click', () => {
    exportStatus.innerText = "Encoding WAV...";
    setTimeout(() => {
        const wavBlob = audioBufferToWav(renderedMixBuffer);
        triggerDownload(wavBlob, 'wav');
        resetExportUI();
    }, 50); 
});

dlMp3Btn.addEventListener('click', () => {
    exportStatus.innerText = "Encoding MP3...";
    setTimeout(() => {
        const mp3Blob = audioBufferToMp3(renderedMixBuffer);
        triggerDownload(mp3Blob, 'mp3');
        resetExportUI();
    }, 50);
});

cancelExportBtn.addEventListener('click', resetExportUI);

// --- SHORTCUTS MODAL LOGIC ---
const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsModal = document.getElementById('shortcuts-modal');
const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');

shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.remove('hidden'));
closeShortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('hidden'));

// --- MULTI-PROJECT MANAGEMENT ---

let currentProjectId = null; 

const projectsMenuBtn = document.getElementById('projects-menu-btn');
const quickSaveBtn = document.getElementById('quick-save-btn');
const projectModal = document.getElementById('project-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalSaveNewBtn = document.getElementById('modal-savenew-btn');
const projectNameInput = document.getElementById('project-name-input');
const projectListContainer = document.getElementById('project-list-container');

projectsMenuBtn.addEventListener('click', async () => {
    projectModal.classList.remove('hidden');
    projectListContainer.innerHTML = '<p class="text-gray-500 text-sm italic">Loading projects...</p>';
    
    try {
        const token = localStorage.getItem('daw_token');
        const res = await fetch(`${API_URL}/api/projects/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const projects = await res.json();
        
        projectListContainer.innerHTML = '';
        if (projects.length === 0) {
            projectListContainer.innerHTML = '<p class="text-gray-500 text-sm">No saved projects yet.</p>';
            return;
        }

        projects.forEach(proj => {
            const date = new Date(proj.updatedAt).toLocaleDateString();
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-800/40 border border-gray-700/50 p-4 rounded-xl hover:bg-gray-800/80 transition group';
            
            const isActive = currentProjectId === proj._id;
            const titleColor = isActive ? 'text-emerald-400 font-bold' : 'text-gray-200 font-semibold';
            const activeIndicator = isActive ? `<span class="text-[9px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full ml-2">Active</span>` : '';

            div.innerHTML = `
                <div class="flex flex-col">
                    <div class="flex items-center">
                        <span class="text-sm ${titleColor}">${proj.title}</span>
                        ${activeIndicator}
                    </div>
                    <span class="text-xs text-gray-500 mt-1">Last edited: ${date}</span>
                </div>
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="loadProject('${proj._id}')" class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">Open</button>
                    <button onclick="deleteProject('${proj._id}')" class="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">Delete</button>
                </div>
            `;
            projectListContainer.appendChild(div);
        });
    } catch (err) {
        projectListContainer.innerHTML = '<p class="text-rose-400 text-sm">Failed to load projects.</p>';
    }
});

closeModalBtn.addEventListener('click', () => {
    projectModal.classList.add('hidden');
});

function gatherProjectData() {
    return blocks.map(b => {
        const blockElement = document.getElementById(b.id);
        const parentTrack = blockElement.closest('.track');
        const trackNodes = Array.from(document.querySelectorAll('.track'));
        return {
            id: b.id,
            assetName: b.asset.name,
            audioUrl: b.asset.url, 
            startTime: b.startTime,
            trimStart: b.trimStart,
            trimDuration: b.trimDuration,
            volume: b.volume,
            speed: b.speed,
            trackIndex: trackNodes.indexOf(parentTrack)
        };
    });
}

quickSaveBtn.addEventListener('click', async () => {
    if (!currentProjectId) {
        projectsMenuBtn.click(); 
        return;
    }
    
    quickSaveBtn.innerText = "Saving...";
    try {
        const token = localStorage.getItem('daw_token');
        await fetch(`${API_URL}/api/projects/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ blocks: gatherProjectData() })
        });
        
        quickSaveBtn.innerHTML = `Saved!`;
        setTimeout(() => quickSaveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg> Save`, 1500);
    } catch (err) {
        alert("Update failed!");
        quickSaveBtn.innerText = "Save Failed";
    }
});

modalSaveNewBtn.addEventListener('click', async () => {
    const title = projectNameInput.value.trim() || 'Untitled Mix';
    modalSaveNewBtn.innerText = "Saving...";
    
    try {
        const token = localStorage.getItem('daw_token');
        const response = await fetch(`${API_URL}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: title, blocks: gatherProjectData() })
        });
        
        const data = await response.json();
        currentProjectId = data.project._id; 
        
        projectNameInput.value = '';
        modalSaveNewBtn.innerText = "Save New";
        projectsMenuBtn.click(); 
        
    } catch (err) {
        alert("Failed to save new project.");
        modalSaveNewBtn.innerText = "Save New";
    }
});

window.loadProject = async function(projectId) {
    try {
        const token = localStorage.getItem('daw_token');
        const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const project = await res.json();

        stopAnyPreview();
        if (isPlaying) globalPlayBtn.click();
        
        blocks.forEach(b => {
            if (b.activeSource) b.activeSource.stop();
            if (b.wavesurfer) b.wavesurfer.destroy();
            document.getElementById(b.id)?.remove();
        });
        blocks = []; assets = []; assetList.innerHTML = '';
        undoStack = []; redoStack = [];
        updateUndoRedoUI();
        
        for (const bData of project.blocks) {
            let asset = assets.find(a => a.url === bData.audioUrl);
            if (!asset) {
                const audioRes = await fetch(bData.audioUrl);
                const arrayBuffer = await audioRes.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                asset = {
                    id: Date.now() + Math.random(),
                    name: bData.assetName,
                    duration: audioBuffer.duration,
                    buffer: audioBuffer,
                    url: bData.audioUrl
                };
                assets.push(asset);
            }

            while (document.querySelectorAll('.track').length <= bData.trackIndex) {
                const newIndex = document.querySelectorAll('.track').length + 1;
                const newTrack = document.createElement('div');
                newTrack.className = 'h-[104px] min-h-[104px] shrink-0 bg-gray-900/20 border-b border-gray-800 relative track flex items-center hover:bg-gray-800/10 transition-colors';
                newTrack.style.minWidth = '3000px';
                newTrack.innerHTML = `<div class="absolute left-4 top-3 text-[10px] font-mono text-gray-600 font-bold uppercase pointer-events-none tracking-widest z-0">Track ${newIndex}</div>`;
                document.getElementById('tracks-container').appendChild(newTrack);
            }
            const targetTrack = document.querySelectorAll('.track')[bData.trackIndex];

            addAssetToTimeline(asset.id, {
                startTime: bData.startTime,
                trimStart: bData.trimStart,
                trimDuration: bData.trimDuration,
                volume: bData.volume,
                speed: bData.speed,
                trackElement: targetTrack
            });
        }
        
        renderAssetList();
        currentProjectId = project._id; 
        projectModal.classList.add('hidden'); 
        
    } catch (err) {
        alert("Error loading project.");
    }
};

window.deleteProject = async function(projectId) {
    if (!confirm("Are you sure you want to delete this project?")) return;
    
    try {
        const token = localStorage.getItem('daw_token');
        await fetch(`${API_URL}/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (currentProjectId === projectId) currentProjectId = null;
        projectsMenuBtn.click(); 
    } catch (err) {
        alert("Failed to delete project.");
    }
};