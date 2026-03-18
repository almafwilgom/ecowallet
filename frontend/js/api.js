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
        const data = await agentAPI.getAgentStats();
        
        // Defensive checks for the stats object
        const stats = data.stats || {};
        const totalCollections = stats.total_collections || 0;
        const totalWeight = stats.total_weight || 0;
        const totalCO2 = stats.total_co2 || 0;

        const collectionsEl = document.getElementById('totalCollections');
        const weightEl = document.getElementById('totalWeightCollected');
        const co2El = document.getElementById('totalCO2Prevented');

        if (collectionsEl) collectionsEl.textContent = totalCollections;
        if (weightEl) weightEl.textContent = `${Number(totalWeight).toFixed(1)} kg`;
        if (co2El) co2El.textContent = `${Number(totalCO2).toFixed(1)} kg`;

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
        // MATCHED: This now matches agentAPI.getPendingSubmissions in api.js
        const data = await agentAPI.getPendingSubmissions();
        const collections = data.submissions || [];

        if (collections.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No pending submissions</td></tr>';
            return;
        }

        tbody.innerHTML = collections.map(col => `
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
        console.error('Failed to load pending submissions:', error);
        tbody.innerHTML = '<tr><td colspan="7">Error loading data</td></tr>';
    }
}

async function loadCollectedHistory() {
    const tbody = document.getElementById('collectedBody');
    if (!tbody) return;

    try {
        // MATCHED: Changed from getRecentCollections to getCollectedSubmissions to match api.js
        const data = await agentAPI.getCollectedSubmissions();
        const collections = data.submissions || [];

        if (collections.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No history found</td></tr>';
            return;
        }

        tbody.innerHTML = collections.map(col => `
            <tr>
                <td>${col.user_name || 'User'}</td>
                <td>${col.material_type}</td>
                <td>${formatWeight(col.weight_kg)}</td>
                <td>${formatCurrency(col.payout)}</td>
                <td>${(col.co2_saved || 0).toFixed(2)} kg</td>
                <td>${formatDate(col.updated_at || col.created_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load history:', error);
        tbody.innerHTML = '<tr><td colspan="6">Error loading history</td></tr>';
    }
}

window.collectWaste = async (id) => {
    if (confirm('Confirm collection of this waste?')) {
        try {
            // MATCHED: Changed from updateCollectionStatus to collectSubmission to match api.js
            await agentAPI.collectSubmission(id);
            await loadAgentDashboard();
        } catch (error) {
            alert('Failed to update: ' + error.message);
        }
    }
};