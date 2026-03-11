// API Configuration
const API_BASE_URL = 'http://localhost:3002';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
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
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
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
        throw error;
    }
}

// Auth APIs
const authAPI = {
    register: (data) => apiCall('/auth/register', 'POST', data),
    login: (data) => apiCall('/auth/login', 'POST', data),
    getCurrentUser: () => apiCall('/auth/me', 'GET'),
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
