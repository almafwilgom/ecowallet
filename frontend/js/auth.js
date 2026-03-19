/**
 * EcoWallet Authentication Logic
 * Status: Fixed Syntax Errors | No Linting Issues
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetConfirmForm = document.getElementById('resetConfirmForm');

    // 1. SESSION SYNC
    if (window.syncSupabaseSession) {
        window.syncSupabaseSession().then(() => {
            const storedUser = localStorage.getItem('user');
            if ((loginForm || registerForm) && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    const destination = parsedUser?.role === 'admin' ? 'admin.html' : 
                                      parsedUser?.role === 'agent' ? 'agent.html' : 'dashboard.html';
                    showSessionMessage(parsedUser, destination, loginForm || registerForm);
                } catch {
                    // Optional catch binding (no 'err' needed)
                }
            }
        }).catch(() => {});
    }

    // 2. EVENT LISTENERS
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (resetRequestForm) resetRequestForm.addEventListener('submit', handlePasswordResetRequest);
    if (resetConfirmForm) resetConfirmForm.addEventListener('submit', handlePasswordResetConfirm);

    initGithubLogin();
});

// --- AUTHENTICATION FUNCTIONS ---

async function handleLogin(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('errorMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!window.authAPI) {
            throw new Error('API client not ready. Please refresh the page.');
        }

        const result = await window.authAPI.login(email, password);
        
        const user = result.user || result;
        const role = user.user_metadata?.role || user.role || 'user';
        window.location.href = role === 'admin' ? 'admin.html' : role === 'agent' ? 'agent.html' : 'dashboard.html';
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('errorMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';

        if (!window.authAPI) {
            throw new Error('API client not ready. Please refresh the page.');
        }

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        // Capture optional fields if they exist in the DOM
        const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
        const address = document.getElementById('address') ? document.getElementById('address').value.trim() : '';
        const state = document.getElementById('state') ? document.getElementById('state').value.trim() : '';

        if (!email || !password) throw new Error('Email and password required');

        await window.authAPI.register({ name, email, password, phone, address, state });
        window.location.href = 'login.html?success=true';
    } catch (error) {
        console.error(error);
        errorDiv.textContent = error.message || 'Registration failed';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
    }
}

// --- UI UTILITIES ---

function showSessionMessage(user, destination, form) {
    const sessionDiv = document.getElementById('sessionMessage');
    if (!sessionDiv) return;
    
    sessionDiv.innerHTML = `<span>Signed in as ${user.email}</span> 
                            <a href="${destination}" class="btn btn-sm">Dashboard</a>`;
    sessionDiv.style.display = 'flex';
    
    if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
    }
}

function initGithubLogin() {
    const githubBtn = document.getElementById('googleLoginButton');
    if (githubBtn) {
        githubBtn.innerHTML = '<button type="button" class="btn btn-ghost btn-block">Continue with GitHub</button>';
    }
}

async function handlePasswordResetRequest() { 
    console.log("Reset requested.");
}

async function handlePasswordResetConfirm() { 
    console.log("Reset confirmed.");
}