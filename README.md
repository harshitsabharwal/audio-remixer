# 🎛️ Pro DAW Audio Remixer Studio

A powerful, browser-based Digital Audio Workstation (DAW) running locally on your server. This application leverages the native Web Audio API to deliver a seamless, multi-track audio mixing and editing experience directly in your browser—no external hosting or backend processing required.

---

## ✨ Key Features

### 🎚️ Core Mixing & Arrangement
* **Infinite Timeline Workspace:** Auto-expanding multi-track grid with horizontal and vertical scrolling. 1 Grid Unit = 1 Second of audio.
* **Drag-and-Drop Library:** Easily upload WAV, MP3, or OGG files via the file browser or by dragging them directly into the Asset Pool.
* **Non-Destructive Trimming:** Drag the left and right handles of any audio block to crop sections without permanently deleting the underlying audio data.
* **Visual Waveforms:** Dynamic, real-time waveform rendering powered by WaveSurfer.js. Waveforms automatically adjust when a clip is trimmed or its speed is altered.

### 🛠️ Advanced Editing Tools (The Inspector)
Clicking on any clip reveals the floating glassmorphism Inspector Panel:
* **Per-Clip Volume & Speed Control:** Independently adjust the gain (0.0x - 2.0x) and playback rate (0.5x - 2.0x) of individual blocks. Visual block widths recalculate dynamically based on speed.
* **Isolated Previewing:** Play, pause, and seek within an individual clip using the Inspector's local transport controls without starting the global mix.
* **Razor Tool (Split):** Slice an audio clip into two independent blocks exactly at the playhead's current position (`S` key).

### 🎹 Global Transport & Navigation
* **Lookahead Playback Engine:** A highly accurate global scheduling engine that precisely calculates when clips should start, stop, or resume based on their timeline offsets.
* **Click-to-Seek:** Click anywhere on the arrangement grid to instantly snap the global playhead to that exact millisecond.
* **Master Digital Clock:** Millisecond-accurate timestamp display.

### 💾 High-Performance Export
* **Offline Rendering Engine:** Renders your final mixdown instantly in the background using `OfflineAudioContext`, regardless of how many tracks or overlapping clips you have.
* **Multi-Format Mixdown:** Export your finished arrangement locally as a lossless `.WAV` file or a compressed `.MP3` file (128kbps via LameJS). Includes real-time file size estimation before downloading.

---

## ⌨️ Keyboard Shortcuts & Controls

| Action | Shortcut / Control | Description |
| :--- | :--- | :--- |
| **Split Clip** | `S` | Slices the currently selected clip exactly at the red playhead line. |
| **Copy Clip** | `Ctrl + C` / `Cmd + C` | Copies the selected clip (including its volume, speed, and trim data). |
| **Cut Clip** | `Ctrl + X` / `Cmd + X` | Copies the selected clip to the clipboard and removes it from the timeline. |
| **Paste Clip** | `Ctrl + V` / `Cmd + V` | Pastes the copied clip exactly at the red playhead's current position. |
| **Seek Timeline**| `Left Click` (Grid) | Jumps the playhead to the clicked position. |
| **Trim Clip** | `Click & Drag` (Edges) | Click the glowing edges of an audio block to crop it. |
| **Move Clip** | `Click & Drag` (Center) | Move a clip left/right in time, or up/down between tracks. |

---

## 🚀 Running Locally

Because this application runs entirely client-side via your local development server, setup takes seconds:

### Prerequisites
* A modern web browser (Google Chrome, Microsoft Edge, Firefox, or Safari).
* A local server extension (such as **Live Server** in VS Code). *Note: Web Audio APIs and local file fetching require the app to be served via an `http://` local server rather than direct `file://` access.*

### Quick Start
1. Ensure both your `index.html` and `app.js` files are saved in the same local directory folder.
2. Open the folder in your code editor.
3. Launch `index.html` using your local development server (e.g., click **"Go Live"** if using VS Code Live Server).
4. Access the app via your local browser port (typically `http://localhost:5500`) and start remixing!

---

## 🏗️ Architecture & Tech Stack

* **Frontend UI:** HTML5 and Tailwind CSS via CDN, styled with custom scrollbars, range inputs, and a dark-mode glassmorphism aesthetic.
* **Audio Engine:** `window.AudioContext` for real-time local server playback and `window.OfflineAudioContext` for mixdown rendering.
* **Visualizer:** [WaveSurfer.js (v7)](https://wavesurfer-js.org/) for generating audio waveforms.
* **MP3 Encoding:** [LameJS](https://github.com/zhuker/lamejs) for packaging raw Float32 audio buffers into downloadable MP3 files directly within the local environment.

---

## 📜 License

This project is open-source and free to use for personal local audio projects.