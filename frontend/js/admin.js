/* global adminAPI, formatCurrency, formatDate, formatWeight, checkAuth, setupLogout */

/**
 * Admin Dashboard Logic for EcoWallet
 */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await checkAuth('admin'); 
        if (!user) return;

        if (typeof setupLogout === 'function') {
            setupLogout();
        }

        await loadAdminData();
        setupTabs();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization failed:', error);
        window.location.href = '/login.html';
    }
});

async function loadAdminData() {
    try {
        await Promise.all([
            loadPlatformStats(),
            loadPendingWithdrawals(),
            loadAllSubmissions(),
            loadAllUsers()
        ]);
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

async function loadPlatformStats() {
    try {
        const data = await adminAPI.getPlatformStats();
        const stats = data.stats || { 
            total_users: 0, 
            total_agents: 0, 
            total_waste_recycled_kg: 0, 
            total_co2_saved_kg: 0, 
            total_payouts: 0, 
            pending_withdrawals: 0 
        };

        document.getElementById('totalUsers').textContent = stats.total_users;
        document.getElementById('totalAgents').textContent = stats.total_agents;
        document.getElementById('totalWaste').textContent = `${stats.total_waste_recycled_kg.toFixed(0)} kg`;
        document.getElementById('totalCO2').textContent = `${stats.total_co2_saved_kg.toFixed(0)} kg`;
        document.getElementById('totalPayouts').textContent = formatCurrency(stats.total_payouts);
        document.getElementById('pendingWithdrawals').textContent = stats.pending_withdrawals;
    } catch (error) {
        console.error('Error loading platform stats:', error);
    }
}

async function loadPendingWithdrawals() {
    try {
        const data = await adminAPI.getPendingWithdrawals();
        const tbody = document.getElementById('withdrawalsBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data.withdrawals || data.withdrawals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No pending withdrawals</td></tr>';
            return;
        }

        tbody.innerHTML = data.withdrawals.map((withdrawal) => {
            const displayName = withdrawal.user_name || withdrawal.name || withdrawal.email || 'Unknown';
            return `
                <tr>
                    <td>${displayName}</td>
                    <td>${formatCurrency(withdrawal.amount)}</td>
                    <td>${withdrawal.method}</td>
                    <td>${withdrawal.phone_number || 'N/A'}</td>
                    <td>${formatDate(withdrawal.created_at)}</td>
                    <td>
                        <button class="action-btn" onclick="approveWithdrawal(${withdrawal.id}, 'approved')">Approve</button>
                        <button class="action-btn danger" onclick="approveWithdrawal(${withdrawal.id}, 'rejected')">Reject</button>
                    </td>
                </tr>`;
        }).join('');
    } catch (error) {
        renderTableError(document.getElementById('withdrawalsBody'), 6, error);
    }
}

async function loadAllSubmissions(status = null) {
    try {
        const data = await adminAPI.getAllSubmissions(status);
        const tbody = document.getElementById('submissionsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data.submissions || data.submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">No submissions found</td></tr>';
            return;
        }

        tbody.innerHTML = data.submissions.slice(0, 50).map((submission) => `
            <tr>
                <td>${submission.user_name || 'Unknown'}</td>
                <td>${submission.material_type}</td>
                <td>${formatWeight(submission.weight_kg)}</td>
                <td>${formatCurrency(submission.payout)}</td>
                <td>${submission.co2_saved.toFixed(2)} kg</td>
                <td><span class="status-badge status-${submission.status}">${submission.status}</span></td>
                <td>${submission.agent_name || '-'}</td>
                <td>${formatDate(submission.created_at)}</td>
            </tr>`).join('');
    } catch (error) {
        renderTableError(document.getElementById('submissionsTableBody'), 8, error);
    }
}

async function loadAllUsers(role = null) {
    try {
        const data = await adminAPI.getAllUsers(role);
        const tbody = document.getElementById('usersBody');
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (!tbody) return;
        tbody.innerHTML = '';

        tbody.innerHTML = data.users.map((user) => {
            const isSelf = currentUser?.id === user.id;
            const isDeleted = Boolean(user.deleted_at);
            const safeName = (user.name || 'Unknown').replace(/'/g, "\\'");

            return `
                <tr>
                    <td>${user.name || 'Unknown'}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || '-'}</td>
                    <td>${user.address || '-'}</td>
                    <td>${user.state || '-'}</td>
                    <td><span class="status-badge status-${user.role}">${user.role}</span></td>
                    <td><span class="status-badge ${isDeleted ? 'status-disabled' : 'status-active'}">${isDeleted ? 'Disabled' : 'Active'}</span></td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>
                        <button class="action-btn secondary" ${isSelf ? 'disabled' : ''} onclick="toggleUserStatus(${user.id}, '${safeName}', ${isDeleted})">
                            ${isDeleted ? 'Restore' : 'Disable'}
                        </button>
                        <button class="action-btn danger" ${isSelf ? 'disabled' : ''} onclick="hardDeleteUserAccount(${user.id}, '${safeName}')">
                            Revoke
                        </button>
                    </td>
                </tr>`;
        }).join('');
    } catch (error) {
        renderTableError(document.getElementById('usersBody'), 9, error);
    }
}

function renderTableError(tbody, colSpan, error) {
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; color: #B71C1C;">Error: ${error.message}</td></tr>`;
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            const targetContent = document.getElementById(`${tabName}-tab`);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

function setupEventListeners() {
    document.getElementById('submissionStatus')?.addEventListener('change', (event) => loadAllSubmissions(event.target.value || null));
    document.getElementById('userRole')?.addEventListener('change', (event) => loadAllUsers(event.target.value || null));
    document.getElementById('createAgentForm')?.addEventListener('submit', handleCreateAgent);
    document.getElementById('createAdminForm')?.addEventListener('submit', handleCreateAdmin);
}

// Global scope attachments for HTML onclicks
window.approveWithdrawal = async (id, status) => {
    try {
        if (confirm(`Confirm ${status}?`)) {
            await adminAPI.approveWithdrawal(id, status);
            await loadAdminData();
        }
    } catch (error) {
        alert(error.message);
    }
};

window.toggleUserStatus = async (id, name, isDeleted) => {
    try {
        if (confirm(`Confirm change for ${name}?`)) {
            if (isDeleted) {
                await adminAPI.restoreUser(id);
            } else {
                await adminAPI.softDeleteUser(id);
            }
            await loadAdminData();
        }
    } catch (error) {
        alert(error.message);
    }
};

window.hardDeleteUserAccount = async (id, name) => {
    try {
        if (confirm(`Revoke access for ${name}?`)) {
            await adminAPI.deleteUser(id);
            await loadAdminData();
        }
    } catch (error) {
        alert(error.message);
    }
};

async function handleCreateAgent(e) {
    e.preventDefault();
    try {
        const email = document.getElementById('agentEmail').value;
        const state = document.getElementById('agentState').value;
        await adminAPI.createAgent({ email, state });
        e.target.reset();
        await loadAllUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function handleCreateAdmin(e) {
    e.preventDefault();
    try {
        const email = document.getElementById('adminEmail').value;
        const state = document.getElementById('adminState').value;
        await adminAPI.createAdmin({ email, state });
        e.target.reset();
        await loadAllUsers();
    } catch (error) {
        alert(error.message);
    }
}