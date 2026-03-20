/**
 * EcoWallet Authentication Logic
 * Status: Fixed Syntax Errors | No Linting Issues
 */

const FALLBACK_SUPABASE_URL = window.ECOWALLET_SUPABASE_URL || 'https://eigitkparyebddjtoocd.supabase.co';
const FALLBACK_SUPABASE_KEY = window.ECOWALLET_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZ2l0a3BhcnllYmRkanRvb2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTUzNDksImV4cCI6MjA4OTE5MTM0OX0.4eMrrwb7qoxJBg0JCKIJgPv7tQWKUKGVC0IWsWYyDQk';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetConfirmForm = document.getElementById('resetConfirmForm');

    // Ensure the API layer is available even if api.js failed to load earlier.
    // This gives us a second chance to lazy-load the client before any form submission.
    ensureAuthClientReady().catch(() => {});

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

// --- HELPERS ---
async function ensureAuthClientReady() {
    if (window.authAPI) return;

    if (!ensureAuthClientReady._loading) {
        ensureAuthClientReady._loading = (async () => {
            try {
                // Attempt to load the shared API bundle first (preferred path)
                await import('./api.js');
            } catch (err) {
                console.warn('api.js did not load via script tag; attempting inline fallback.', err);
            }

            // Fallback: build a minimal authAPI in-place using Supabase ESM
            if (!window.authAPI) {
                try {
                    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
                    const client = createClient(FALLBACK_SUPABASE_URL, FALLBACK_SUPABASE_KEY);

                    window.authAPI = {
                        async login(email, password) {
                            const { data, error } = await client.auth.signInWithPassword({ email, password });
                            if (error) throw error;

                            const user = {
                                id: data.user.id,
                                email: data.user.email,
                                name: data.user.user_metadata?.name || data.user.email.split('@')[0],
                                role: data.user.user_metadata?.role || 'user',
                                state: data.user.user_metadata?.state
                            };

                            localStorage.setItem('user', JSON.stringify(user));
                            return { user, session: data.session };
                        },
                        async register(userData) {
                            const { data, error } = await client.auth.signUp({
                                email: userData.email,
                                password: userData.password,
                                options: {
                                    data: {
                                        name: userData.name,
                                        state: userData.state,
                                        phone: userData.phone,
                                        address: userData.address,
                                        role: 'user'
                                    }
                                }
                            });
                            if (error) throw error;
                            return data;
                        },
                        async logout() {
                            await client.auth.signOut();
                            localStorage.removeItem('user');
                            window.location.href = '/login.html';
                        }
                    };
                } catch (fallbackErr) {
                    console.error('Fallback Supabase client failed to initialize.', fallbackErr);
                }
            }
        })();
    }

    await ensureAuthClientReady._loading;

    if (!window.authAPI) {
        throw new Error('API client not ready. Please refresh the page.');
    }
}

// --- AUTHENTICATION FUNCTIONS ---

async function handleLogin(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('errorMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';

        await ensureAuthClientReady();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

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

        await ensureAuthClientReady();

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

// Shared logout wiring for any page containing #logoutBtn
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            if (window.authAPI?.logout) {
                await window.authAPI.logout();
                return;
            }
        } catch (err) {
            console.error('Logout failed', err);
        }
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

async function handlePasswordResetRequest() { 
    console.log("Reset requested.");
}

async function handlePasswordResetConfirm() { 
    console.log("Reset confirmed.");
}
