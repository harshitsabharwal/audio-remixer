// Grab DOM elements
const authForm = document.getElementById('auth-form');
const usernameContainer = document.getElementById('username-container');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const toggleText = document.getElementById('toggle-text');
const formSubtitle = document.getElementById('form-subtitle');
const errorMessage = document.getElementById('error-message');

// Track if we are on Login or Signup mode
let isLoginMode = true;

// Toggle between Login and Signup modes
toggleModeBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    errorMessage.classList.add('hidden'); // Clear errors on toggle

    if (isLoginMode) {
        usernameContainer.classList.add('hidden');
        usernameInput.removeAttribute('required');
        submitBtn.innerText = 'Login to Workspace';
        formSubtitle.innerText = 'Sign in to your workspace';
        toggleText.innerText = "Don't have an account?";
        toggleModeBtn.innerText = 'Create one';
    } else {
        usernameContainer.classList.remove('hidden');
        usernameContainer.classList.add('flex');
        usernameInput.setAttribute('required', 'true');
        submitBtn.innerText = 'Create Account';
        formSubtitle.innerText = 'Start your audio journey';
        toggleText.innerText = "Already have an account?";
        toggleModeBtn.innerText = 'Sign in';
    }
});

function showError(msg) {
    errorMessage.innerText = msg;
    errorMessage.classList.remove('hidden');
}

// Handle Form Submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.add('hidden');
    
    const email = emailInput.value;
    const password = passwordInput.value;
    const username = usernameInput.value;

    const payload = isLoginMode ? { email, password } : { username, email, password };
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
        // Change button text to show loading
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Authenticating...';
        submitBtn.disabled = true;

        // Make the request to our Node.js Backend
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        // Success! Save the JWT token and user info to LocalStorage
        localStorage.setItem('daw_token', data.token);
        localStorage.setItem('daw_user', JSON.stringify(data.user));

        // Redirect into the main DAW application!
        window.location.href = 'index.html';

    } catch (error) {
        showError(error.message);
        submitBtn.innerText = isLoginMode ? 'Login to Workspace' : 'Create Account';
        submitBtn.disabled = false;
    }
});