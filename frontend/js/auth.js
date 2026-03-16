// Authentication Logic
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetConfirmForm = document.getElementById('resetConfirmForm');

    if (window.syncSupabaseSession) {
        window.syncSupabaseSession().then(() => {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            if ((loginForm || registerForm) && storedToken && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser?.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else if (parsedUser?.role === 'agent') {
                        window.location.href = 'agent.html';
                    } else if (parsedUser?.role) {
                        window.location.href = 'dashboard.html';
                    }
                } catch (error) {
                    // ignore
                }
            }
        }).catch(() => {
            // Ignore session sync errors on public pages
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    if (resetRequestForm) {
        resetRequestForm.addEventListener('submit', handlePasswordResetRequest);
    }

    if (resetConfirmForm) {
        resetConfirmForm.addEventListener('submit', handlePasswordResetConfirm);
    }

    initGithubLogin();
    preloadResetToken();
});

function handleAuthSuccess(result) {
    if (!result || !result.token || !result.user) {
        throw new Error('Invalid login response');
    }

    if (result.user.deleted_at) {
        throw new Error('Account is disabled. Contact admin.');
    }

    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));

    setTimeout(() => {
        if (result.user.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (result.user.role === 'agent') {
            window.location.href = 'agent.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }, 300);
}

async function handleLogin(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('errorMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            throw new Error('All fields are required');
        }

        const result = await authAPI.login({ email, password });
        handleAuthSuccess(result);
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

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const state = document.getElementById('state').value.trim();

        if (!name || !email || !password || !state) {
            throw new Error('All fields are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        await authAPI.register({ name, email, password, state });

        // Success - redirect to login
        setTimeout(() => {
            window.location.href = 'login.html?message=Registration successful! Check your email if confirmation is required.';
        }, 1000);
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
    }
}

async function handlePasswordResetRequest(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending Link...';

        const email = document.getElementById('email').value.trim();

        if (!email) {
            throw new Error('Email is required');
        }

        await authAPI.requestPasswordReset({ email });

        if (successDiv) {
            successDiv.textContent = 'If the account exists, a reset link has been sent.';
            successDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Link';
    }
}

async function handlePasswordResetConfirm(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Resetting...';

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!password || !confirmPassword) {
            throw new Error('All fields are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        await authAPI.confirmPasswordReset({ password });

        if (successDiv) {
            successDiv.textContent = 'Password reset successful. Redirecting to login...';
            successDiv.style.display = 'block';
        }

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1200);
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
    }
}

function initGithubLogin() {
    const googleButton = document.getElementById('googleLoginButton');

    if (!googleButton) return;

    if (!window.isSupabaseConfigured || !window.isSupabaseConfigured()) {
        googleButton.innerHTML = '<span>GitHub login is not configured.</span>';
        googleButton.classList.add('google-disabled');
        return;
    }

    googleButton.innerHTML = '<button type="button" class="btn btn-ghost btn-pill btn-block">Continue with GitHub</button>';
    const buttonEl = googleButton.querySelector('button');
    if (buttonEl) {
        buttonEl.addEventListener('click', async () => {
            try {
                await authAPI.loginWithGithub();
            } catch (error) {
                const errorDiv = document.getElementById('errorMessage');
                if (errorDiv) {
                    errorDiv.textContent = 'Error: ' + error.message;
                    errorDiv.style.display = 'block';
                }
            }
        });
    }
}

function preloadResetToken() {
    const tokenInput = document.getElementById('resetToken');
    if (!tokenInput) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
        tokenInput.value = token;
    }
}

function getRoleFromToken(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const data = JSON.parse(decoded);
        return data.role || null;
    } catch (error) {
        return null;
    }
}

// Check authentication
async function checkAuth(requiredRole = null) {
    let token = localStorage.getItem('token');
    let user = localStorage.getItem('user');

    if ((!token || !user) && window.syncSupabaseSession) {
        try {
            await window.syncSupabaseSession();
        } catch (error) {
            // ignore
        }
        token = localStorage.getItem('token');
        user = localStorage.getItem('user');
    }

    if (!token || !user) {
        window.location.href = 'login.html';
        return null;
    }

    let userData;
    try {
        userData = JSON.parse(user);
    } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
    }

    if (!userData.role) {
        const roleFromToken = getRoleFromToken(token);
        if (roleFromToken) {
            userData.role = roleFromToken;
            localStorage.setItem('user', JSON.stringify(userData));
        }
    }

    if (userData.deleted_at) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
    }

    if (requiredRole) {
        const required = requiredRole.toLowerCase();
        const role = (userData.role || '').toLowerCase();

        if (required === 'admin') {
            if (role !== 'admin') {
                window.location.href = 'admin-login.html';
                return null;
            }
        } else if (role !== required && role !== 'admin') {
            window.location.href = 'login.html';
            return null;
        }
    }

    return userData;
}

// Setup logout
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.authAPI && window.authAPI.logout) {
                window.authAPI.logout().catch(() => {});
            }
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }

    // Display user name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userNameEl = document.getElementById('userName');
    if (userNameEl && user.name) {
        userNameEl.textContent = user.name;
    }
}
