// Authentication Logic
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

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

        // Store token
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));

        // Redirect based on role
        setTimeout(() => {
            if (result.user.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (result.user.role === 'agent') {
                window.location.href = 'agent.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 500);
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
            window.location.href = 'login.html?message=Registration successful! Please login.';
        }, 1000);
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
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
function checkAuth(requiredRole = null) {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

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
