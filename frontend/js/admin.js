// Admin Dashboard Logic
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const user = await checkAuth('admin');
    setupLogout();

    if (user) {
        await loadAdminData();
        setupTabs();
        setupEventListeners();
    }
});

async function loadAdminData() {
    try {
        await loadPlatformStats();
        await loadPendingWithdrawals();
        await loadAllSubmissions();
        await loadAllUsers();
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

async function loadPlatformStats() {
    try {
        const data = await adminAPI.getPlatformStats();
        const stats = data.stats;

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
        const noWithdrawals = document.getElementById('noWithdrawals');

        tbody.innerHTML = '';

        if (data.withdrawals.length === 0) {
            noWithdrawals.style.display = 'block';
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No pending withdrawals</td></tr>';
            return;
        }

        noWithdrawals.style.display = 'none';

        data.withdrawals.forEach(withdrawal => {
            let details = withdrawal.phone_number || '';
            if (withdrawal.bank_details) {
                try {
                    const bankDetails = typeof withdrawal.bank_details === 'string'
                        ? JSON.parse(withdrawal.bank_details)
                        : withdrawal.bank_details;
                    if (withdrawal.method === 'bank_transfer') {
                        const parts = [
                            bankDetails.account_name,
                            bankDetails.bank_name,
                            bankDetails.account_number || bankDetails.account
                        ].filter(Boolean);
                        details = parts.join(' - ') || details;
                    } else {
                        const network = bankDetails.network ? ` - ${bankDetails.network}` : '';
                        details = `${withdrawal.phone_number || ''}${network}` || details;
                    }
                } catch (error) {
                    details = withdrawal.phone_number || details;
                }
            }
            const displayName = withdrawal.user_name || withdrawal.name || withdrawal.email || 'Unknown';

            tbody.innerHTML += `
                <tr>
                    <td>${displayName}</td>
                    <td>${formatCurrency(withdrawal.amount)}</td>
                    <td>${withdrawal.method}</td>
                    <td>${details}</td>
                    <td>${formatDate(withdrawal.created_at)}</td>
                    <td>
                        <button class="action-btn" onclick="approveWithdrawal(${withdrawal.id}, 'approved')">
                            Approve
                        </button>
                        <button class="action-btn danger" onclick="approveWithdrawal(${withdrawal.id}, 'rejected')">
                            Reject
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading withdrawals:', error);
    }
}

async function loadAllSubmissions(status = null) {
    try {
        const data = await adminAPI.getAllSubmissions(status);
        const tbody = document.getElementById('submissionsTableBody');

        tbody.innerHTML = '';

        if (data.submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">No submissions found</td></tr>';
            return;
        }

        data.submissions.slice(0, 50).forEach(submission => {
            const statusBadge = `<span class="status-badge status-${submission.status}">${submission.status}</span>`;
            const userName = submission.user_name || submission.user_id || 'Unknown';
            const agentName = submission.agent_name || submission.agent_id || '-';
            tbody.innerHTML += `
                <tr>
                    <td>${userName}</td>
                    <td>${submission.material_type}</td>
                    <td>${formatWeight(submission.weight_kg)}</td>
                    <td>${formatCurrency(submission.payout)}</td>
                    <td>${submission.co2_saved.toFixed(2)} kg</td>
                    <td>${statusBadge}</td>
                    <td>${agentName}</td>
                    <td>${formatDate(submission.created_at)}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

async function loadAllUsers(role = null) {
    try {
        const data = await adminAPI.getAllUsers(role);
        const tbody = document.getElementById('usersBody');
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

        tbody.innerHTML = '';

        if (data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #999;">No users found</td></tr>';
            return;
        }

        data.users.forEach(user => {
            const isSelf = currentUser?.id === user.id;
            const isDeleted = Boolean(user.deleted_at);
            const statusLabel = isDeleted ? 'Disabled' : 'Active';
            const statusClass = isDeleted ? 'status-disabled' : 'status-active';
            const softLabel = isDeleted ? 'Restore' : 'Disable';
            const softDisabled = isSelf;
            const hardDisabled = isSelf;
            const safeName = user.name.replace(/'/g, "\\'");
            const displayPhone = user.phone || '-';
            const displayAddress = user.address || '-';

            tbody.innerHTML += `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${displayPhone}</td>
                    <td>${displayAddress}</td>
                    <td>${user.state}</td>
                    <td>
                        <span class="status-badge status-${user.role}">
                            ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>
                        <button class="action-btn secondary" ${softDisabled ? 'disabled' : ''} onclick="toggleUserStatus(${user.id}, '${safeName}', ${isDeleted})">
                            ${softLabel}
                        </button>
                        <button class="action-btn danger" ${hardDisabled ? 'disabled' : ''} onclick="hardDeleteUserAccount(${user.id}, '${safeName}', '${user.role}')">
                            Revoke Access
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

function setupEventListeners() {
    // Submission status filter
    const statusFilter = document.getElementById('submissionStatus');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            loadAllSubmissions(e.target.value || null);
        });
    }

    // User role filter
    const roleFilter = document.getElementById('userRole');
    if (roleFilter) {
        roleFilter.addEventListener('change', (e) => {
            loadAllUsers(e.target.value || null);
        });
    }

    // Create agent form
    const createAgentForm = document.getElementById('createAgentForm');
    if (createAgentForm) {
        createAgentForm.addEventListener('submit', handleCreateAgent);
    }

    // Create admin form
    const createAdminForm = document.getElementById('createAdminForm');
    if (createAdminForm) {
        createAdminForm.addEventListener('submit', handleCreateAdmin);
    }
}

async function approveWithdrawal(withdrawalId, status) {
    try {
        if (!confirm(`Are you sure you want to ${status} this withdrawal?`)) {
            return;
        }

        await adminAPI.approveWithdrawal(withdrawalId, status);

        // Show success message
        alert(`Withdrawal ${status} successfully.`);

        // Reload data
        await loadAdminData();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function toggleUserStatus(userId, userName, isDeleted) {
    try {
        const actionLabel = isDeleted ? 'restore' : 'disable';
        if (!confirm(`Are you sure you want to ${actionLabel} ${userName}?`)) {
            return;
        }

        if (isDeleted) {
            await adminAPI.restoreUser(userId);
        } else {
            await adminAPI.softDeleteUser(userId);
        }

        alert(`User ${isDeleted ? 'restored' : 'disabled'} successfully.`);
        await loadAdminData();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function hardDeleteUserAccount(userId, userName, role) {
    try {
        const roleNote = role === 'admin' ? ' This is an admin account.' : '';
        if (!confirm(`Disable ${userName}? They will be unable to log in.${roleNote}`)) {
            return;
        }

        await adminAPI.deleteUser(userId);

        alert('User disabled successfully.');
        await loadAdminData();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function handleCreateAgent(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('agentMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        msgDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        const email = document.getElementById('agentEmail').value.trim();
        const state = document.getElementById('agentState').value.trim();

        if (!email) {
            throw new Error('Email is required');
        }

        await adminAPI.createAgent({ email, state });

        // Show success message
        msgDiv.className = 'form-message success';
        msgDiv.textContent = 'Success: User role updated to agent.';
        msgDiv.style.display = 'block';

        // Reset form
        e.target.reset();

        // Reload users list
        setTimeout(() => {
            loadAllUsers();
        }, 1000);
    } catch (error) {
        msgDiv.className = 'form-message error';
        msgDiv.textContent = 'Error: ' + error.message;
        msgDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Agent Role';
    }
}

async function handleCreateAdmin(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('adminMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        msgDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        const email = document.getElementById('adminEmail').value.trim();
        const state = document.getElementById('adminState').value.trim();

        if (!email) {
            throw new Error('Email is required');
        }

        await adminAPI.createAdmin({ email, state });

        // Show success message
        msgDiv.className = 'form-message success';
        msgDiv.textContent = 'Success: User role updated to admin.';
        msgDiv.style.display = 'block';

        // Reset form
        e.target.reset();

        // Reload users list
        setTimeout(() => {
            loadAllUsers();
        }, 1000);
    } catch (error) {
        msgDiv.className = 'form-message error';
        msgDiv.textContent = 'Error: ' + error.message;
        msgDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Admin Role';
    }
}
