# Audio Remixer Studio

Audio Remixer is a browser-based Digital Audio Workstation (DAW) for creating multi-track mixes locally in the browser. Upload audio, arrange clips on an auto-expanding timeline, edit clips non-destructively, save projects, and export a finished mix as WAV or MP3.

The frontend uses the native Web Audio API for real-time playback and offline rendering. The Node.js backend provides authentication, project persistence, and audio-file storage.

## Features

### Mixing and arrangement

- Auto-expanding multi-track timeline with horizontal and vertical scrolling
- One grid unit represents one second of audio
- Drag-and-drop or file-picker uploads for WAV, MP3, and OGG audio
- Visual waveforms rendered with WaveSurfer.js
- Non-destructive trimming using the left and right edges of a clip
- Drag clips horizontally to change their time offset and vertically to move them between tracks

### Clip editing

- Per-clip volume control from 0.0x to 2.0x
- Per-clip playback speed control from 0.5x to 2.0x
- Clip width recalculates as playback speed changes
- Isolated clip preview with local play, pause, and seek controls
- Razor split at the current playhead position using the `S` key
- Delete, copy, cut, paste, undo, and redo

### Transport and export

- Lookahead playback scheduling for accurate clip start, stop, and resume behavior
- Click-to-seek anywhere on the arrangement grid
- Millisecond-accurate master clock
- Offline mix rendering with `OfflineAudioContext`
- Local WAV or compressed MP3 export
- MP3 encoding at 128 kbps with LameJS
- Real-time export file-size estimation

### Accounts and projects

- User registration and login with JWT authentication
- Create, load, update, and delete saved projects
- Audio uploads stored by the backend and associated with the current user

## Requirements

- Node.js 18 or newer
- MongoDB database, local or hosted
- A modern browser with Web Audio API support (Chrome, Edge, Firefox, or Safari)
- A static-file server for the frontend, such as the VS Code Live Server extension

The frontend must be served over `http://` rather than opened directly with `file://`. Browser audio APIs and local file fetching require a server origin.

## Setup

1. Install backend dependencies:

	```powershell
	cd backend
	npm install
	```

2. Create `backend/.env` with the following values:

	```env
	MONGODB_URI=mongodb://127.0.0.1:27017/audio-remixer
	JWT_SECRET=replace-with-a-long-random-secret
	PORT=5000
	```

3. Start the backend:

	```powershell
	npm start
	```

	For automatic restarts during development:

	```powershell
	npm run dev
	```

4. Serve the `frontend` directory with a static server and open `auth.html`. With VS Code Live Server, right-click `frontend/auth.html` and choose **Open with Live Server**. The frontend typically runs at `http://localhost:5500`.

	On localhost, the frontend connects to `http://localhost:5000`. For non-localhost deployments, edit `frontend/config.js` to point to the deployed API.

## Usage

1. Register an account or log in.
2. Upload audio into the Asset Pool.
3. Add assets to the timeline and arrange them across tracks.
4. Select a clip to open the floating Inspector, where you can trim it, change its volume or speed, preview it, or split it at the playhead.
5. Save the arrangement from **Save** or **My Projects**.
6. Choose **Export Mix**, then download the rendered WAV or MP3 file.

### Keyboard shortcuts and controls

| Action | Shortcut or control | Description |
| --- | --- | --- |
| Split selected clip | `S` | Slice the selected clip at the red playhead line. |
| Copy selected clip | `Ctrl/Cmd + C` | Copy the clip, including volume, speed, and trim data. |
| Cut selected clip | `Ctrl/Cmd + X` | Copy the clip and remove it from the timeline. |
| Paste clip at playhead | `Ctrl/Cmd + V` | Paste the copied clip at the current playhead position. |
| Seek timeline | Left-click grid | Jump the playhead to the clicked position. |
| Trim clip | Drag an edge | Crop a clip without deleting its source audio. |
| Move clip | Drag the center | Move a clip in time or between tracks. |
| Undo | `Ctrl/Cmd + Z` | Reverse the most recent timeline edit. |
| Redo | `Ctrl/Cmd + Y` | Reapply the most recently undone edit. |

Click the timeline grid to seek. Drag a clip by its center to move it, or drag either edge to trim it.

## API Overview

All project and upload endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Log in and receive a JWT |
| `POST` | `/api/upload` | Upload one audio file, up to 50 MB |
| `GET` | `/api/projects/list` | List the current user's projects |
| `GET` | `/api/projects/:id` | Load a project |
| `POST` | `/api/projects` | Create a project |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |

Uploaded files are served from `/uploads/<filename>` by the backend and stored in `backend/uploads`.

## Project Structure

```text
backend/
  server.js             Express server and MongoDB connection
  middleware/           JWT authentication middleware
  models/               Mongoose user and project models
  routes/               Auth, project, and upload endpoints
  uploads/              Uploaded audio files
frontend/
  auth.html             Login and registration page
  auth.js               Authentication client logic
  index.html             Audio workstation UI
  app.js                Timeline and audio engine
  config.js             Backend API URL selection
```

## Architecture and technology

- Frontend UI: HTML5 and Tailwind CSS via CDN, with custom scrollbars, range inputs, and a dark glass-style workstation aesthetic
- Audio engine: `window.AudioContext` for real-time playback and `window.OfflineAudioContext` for mixdown rendering
- Backend: Node.js and Express for authentication, project persistence, and uploads
- Database: MongoDB through Mongoose
- Authentication: JWT and bcryptjs
- File handling: Multer
- Visualizer: [WaveSurfer.js](https://wavesurfer-js.org/) for waveform rendering
- MP3 encoding: [LameJS](https://github.com/zhuker/lamejs) for local 128 kbps MP3 generation
- Styling and UI assets: Tailwind CSS and LameJS loaded from CDNs

## License

This project is open source and free to use for personal local audio projects.