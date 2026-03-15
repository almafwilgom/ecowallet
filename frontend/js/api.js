// API Configuration
function normalizeBaseUrl(value) {
    if (!value) return '';
    return String(value).replace(/\/+$/, '');
}

const API_BASE_URL_CANDIDATES = [
    window.ECOWALLET_API_BASE_URL,
    localStorage.getItem('ecowalletApiBaseUrl'),
    'http://localhost:3002',
    'http://localhost:3000',
    'http://localhost:3001'
].map(normalizeBaseUrl).filter(Boolean);

const API_BASE_URLS = Array.from(new Set(API_BASE_URL_CANDIDATES));
const DEFAULT_API_BASE_URL = API_BASE_URLS[0] || 'http://localhost:3000';
let resolvedApiBaseUrl = null;

async function probeApiBaseUrl(baseUrl) {
    const healthUrl = `${baseUrl}/health`;
    const hasAbortController = typeof AbortController !== 'undefined';
    const controller = hasAbortController ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), 1200)
        : null;

    try {
        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: controller ? controller.signal : undefined
        });
        return response.ok;
    } catch (error) {
        return false;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function resolveApiBaseUrl() {
    if (resolvedApiBaseUrl) return resolvedApiBaseUrl;

    for (const baseUrl of API_BASE_URLS) {
        if (!baseUrl) continue;
        const ok = await probeApiBaseUrl(baseUrl);
        if (ok) {
            resolvedApiBaseUrl = baseUrl;
            localStorage.setItem('ecowalletApiBaseUrl', baseUrl);
            return resolvedApiBaseUrl;
        }
    }

    resolvedApiBaseUrl = DEFAULT_API_BASE_URL;
    return resolvedApiBaseUrl;
}

function isNetworkError(error) {
    if (!error) return false;
    const message = String(error.message || '');
    return (
        error.name === 'TypeError' ||
        message.includes('Failed to fetch') ||
        message.includes('NetworkError')
    );
}

function buildNetworkErrorMessage(baseUrl) {
    const hints = [];

    if (window.location.protocol === 'file:') {
        hints.push('Open the frontend via http://localhost:5500 or http://localhost:8080 (not file://).');
    }

    hints.push(`Ensure the backend is running and reachable at ${baseUrl}.`);
    hints.push('If you changed the backend port, update the API base URL.');

    return `Unable to reach the EcoWallet API. ${hints.join(' ')}`;
}

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const baseUrl = await resolveApiBaseUrl();
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    const token = localStorage.getItem('token');
    if (token) {
        options.headers.Authorization = `Bearer ${token}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, options);
        
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = {};
            }

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return null;
            }

            throw new Error(errorData.error || 'API Error');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        if (isNetworkError(error)) {
            const friendlyMessage = buildNetworkErrorMessage(baseUrl);
            const networkError = new Error(friendlyMessage);
            networkError.cause = error;
            throw networkError;
        }
        throw error;
    }
}

// Auth APIs
const authAPI = {
    register: (data) => apiCall('/auth/register', 'POST', data),
    login: (data) => apiCall('/auth/login', 'POST', data),
    loginWithGoogle: (data) => apiCall('/auth/google', 'POST', data),
    getCurrentUser: () => apiCall('/auth/me', 'GET'),
    requestPasswordReset: (data) => apiCall('/auth/password-reset/request', 'POST', data),
    confirmPasswordReset: (data) => apiCall('/auth/password-reset/confirm', 'POST', data),
};

// Waste APIs
const wasteAPI = {
    submitWaste: (data) => apiCall('/waste/submit', 'POST', data),
    getUserSubmissions: (status = null) => {
        let endpoint = '/waste/submissions';
        if (status) endpoint += `?status=${status}`;
        return apiCall(endpoint, 'GET');
    },
    getLeaderboard: (limit = 10) => apiCall(`/waste/leaderboard?limit=${limit}`, 'GET'),
    getUserStats: () => apiCall('/waste/user-stats', 'GET'),
};

// Wallet APIs
const walletAPI = {
    getBalance: () => apiCall('/wallet/balance', 'GET'),
    requestWithdrawal: (data) => apiCall('/wallet/withdraw', 'POST', data),
    getWithdrawals: (status = null) => {
        let endpoint = '/wallet/withdrawals';
        if (status) endpoint += `?status=${status}`;
        return apiCall(endpoint, 'GET');
    },
};

// Agent APIs
const agentAPI = {
    getPendingSubmissions: () => apiCall('/agent/submissions/pending', 'GET'),
    collectSubmission: (submissionId) => apiCall('/agent/collect', 'POST', { submission_id: submissionId }),
    getCollectedSubmissions: () => apiCall('/agent/submissions/collected', 'GET'),
    getAgentStats: () => apiCall('/agent/stats', 'GET'),
};

// Admin APIs
const adminAPI = {
    getPlatformStats: () => apiCall('/admin/stats', 'GET'),
    getAllUsers: (role = null, limit = 50) => {
        let endpoint = `/admin/users?limit=${limit}`;
        if (role) endpoint += `&role=${role}`;
        return apiCall(endpoint, 'GET');
    },
    getAllSubmissions: (status = null, limit = 100) => {
        let endpoint = `/admin/submissions?limit=${limit}`;
        if (status) endpoint += `&status=${status}`;
        return apiCall(endpoint, 'GET');
    },
    getPendingWithdrawals: () => apiCall('/admin/withdrawals/pending', 'GET'),
    approveWithdrawal: (withdrawalId, status) => 
        apiCall('/admin/approve-withdrawal', 'POST', { withdrawal_id: withdrawalId, status }),
    createAdmin: (data) => apiCall('/admin/create-admin', 'POST', data),
    createAgent: (data) => apiCall('/admin/create-agent', 'POST', data),
    deleteUser: (userId) => apiCall(`/admin/users/${userId}`, 'DELETE'),
    softDeleteUser: (userId) => apiCall(`/admin/users/${userId}/soft-delete`, 'PATCH'),
    restoreUser: (userId) => apiCall(`/admin/users/${userId}/restore`, 'PATCH'),
};

// Utility function to format currency
function formatCurrency(amount) {
    return `₦${parseFloat(amount).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility function to format weight
function formatWeight(weight) {
    return `${parseFloat(weight).toFixed(3)} kg`;
}
