const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR-RENDER-BACKEND-URL.onrender.com'; // Replace this later with your actual Render URL