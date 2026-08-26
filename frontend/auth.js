/**
 * A custom fetch function that automatically retries if the server is asleep.
 * @param {string} url - The API endpoint
 * @param {object} options - Fetch options (method, headers, body)
 * @param {number} maxRetries - How many times to try before giving up
 * @param {number} delay - Milliseconds to wait between tries
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            
            // If the server returns a 500-level error (common during spin-up), throw to trigger a retry
            if (!response.ok && response.status >= 500) {
                throw new Error(`Server still waking up (Status: ${response.status})`);
            }
            
            // If the response is good (200 OK, 400 Bad Request, 401 Unauthorized), return it immediately!
            return response; 
            
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed. Retrying in ${delay / 1000} seconds...`);
            
            // If we've reached the max retries, throw the final error to the UI
            if (i === maxRetries - 1) {
                throw new Error("Server failed to wake up. Please try again later.");
            }
            
            // Wait for 'delay' milliseconds before running the loop again
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

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
        // Change button text and disable to prevent spam clicks
        submitBtn.innerText = 'Waking server...';
        submitBtn.disabled = true;

        // Show our free-tier loading message using your existing error element
        errorMessage.innerText = "⏳ Waking up the server... Since this is a free tier, it might take up to 50 seconds. Hang tight!";
        errorMessage.style.color = "#888"; // Set to a neutral grey so it doesn't look like an error
        errorMessage.classList.remove('hidden');

        // Make the request using our custom retry fetch instead of the standard fetch
        const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }, 5, 6000); // Try 5 times, waiting 6 seconds between tries

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        // Success! Update UI
        errorMessage.innerText = "✅ Success! Redirecting...";
        errorMessage.style.color = "green";

        // Save the JWT token and user info to LocalStorage
        localStorage.setItem('daw_token', data.token);
        localStorage.setItem('daw_user', JSON.stringify(data.user));

        // Redirect into the main DAW application after a brief 1-second pause to let them see success
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);

    } catch (error) {
        // If it actually fails, reset the color back to red and show the error
        errorMessage.style.color = ""; // Removes the inline color so your CSS takes over
        showError(error.message);
        
        // Reset the button
        submitBtn.innerText = isLoginMode ? 'Login to Workspace' : 'Create Account';
        submitBtn.disabled = false;
    }
});