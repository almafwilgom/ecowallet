/* global agentAPI, formatCurrency, formatDate, formatWeight, setupLogout */

/**
 * Agent Dashboard Logic for EcoWallet
 */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const profile = await window.syncSupabaseSession();
        
        if (!profile || profile.role !== 'agent') {
            window.location.href = '/login.html';
            return;
        }

        // Fix: Use setupLogout from global
        if (typeof setupLogout === 'function') {
            setupLogout();
        }

        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = profile.name || 'Agent';

        await loadAgentDashboard();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
});

async function loadAgentDashboard() {
    try {
        // Fix: Use agentAPI from global
        const data = await agentAPI.getAgentStats();
        const stats = data.stats || { total_collections: 0, total_weight: 0, total_co2: 0 };

        document.getElementById('totalCollections').textContent = stats.total_collections;
        document.getElementById('totalWeightCollected').textContent = `${stats.total_weight.toFixed(1)} kg`;
        document.getElementById('totalCO2Prevented').textContent = `${(stats.total_co2 || 0).toFixed(1)} kg`;

        await Promise.all([
            loadPendingSubmissions(),
            loadCollectedHistory()
        ]);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadPendingSubmissions() {
    const tbody = document.getElementById('submissionsBody');
    if (!tbody) return;

    try {
        const data = await agentAPI.getPendingCollections();
        if (!data.collections || data.collections.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No pending submissions</td></tr>';
            return;
        }

        tbody.innerHTML = data.collections.map(col => `
            <tr>
                <td>${col.user_name || 'User'}</td>
                <td>${col.material_type}</td>
                <td>${formatWeight(col.weight_kg)}</td>
                <td>${col.location || 'N/A'}</td>
                <td>${formatCurrency(col.payout)}</td>
                <td>${formatDate(col.created_at)}</td>
                <td><button class="btn btn-sm" onclick="collectWaste('${col.id}')">Collect</button></td>
            </tr>
        `).join('');
    } catch (error) {
        // Fix: Log the error so it is "used"
        console.error('Failed to load pending submissions:', error);
        tbody.innerHTML = '<tr><td colspan="7">Error loading data</td></tr>';
    }
}

async function loadCollectedHistory() {
    const tbody = document.getElementById('collectedBody');
    if (!tbody) return;

    try {
        const data = await agentAPI.getRecentCollections();
        if (!data.collections || data.collections.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No history found</td></tr>';
            return;
        }

        tbody.innerHTML = data.collections.map(col => `
            <tr>
                <td>${col.user_name || 'User'}</td>
                <td>${col.material_type}</td>
                <td>${formatWeight(col.weight_kg)}</td>
                <td>${formatCurrency(col.payout)}</td>
                <td>${(col.co2_saved || 0).toFixed(2)} kg</td>
                <td>${formatDate(col.created_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        // Fix: Log the error so it is "used"
        console.error('Failed to load history:', error);
        tbody.innerHTML = '<tr><td colspan="6">Error loading history</td></tr>';
    }
}

window.collectWaste = async (id) => {
    if (confirm('Confirm collection of this waste?')) {
        try {
            await agentAPI.updateCollectionStatus(id, 'collected');
            await loadAgentDashboard();
        } catch (error) {
            alert('Failed to update: ' + error.message);
        }
    }
};