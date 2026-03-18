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

        await loadAgentData();
        setupAgentEventListeners();
    } catch (error) {
        console.error('Initialization failed:', error);
        window.location.href = '/login.html';
    }
});

async function loadAgentData() {
    try {
        const data = await agentAPI.getAgentStats();
        const stats = data.stats || { total_collections: 0, total_weight: 0 };

        if (document.getElementById('totalCollections')) {
            document.getElementById('totalCollections').textContent = stats.total_collections;
        }
        if (document.getElementById('totalWeightProcessed')) {
            document.getElementById('totalWeightProcessed').textContent = `${stats.total_weight.toFixed(1)} kg`;
        }
        await loadRecentSubmissions();
    } catch (error) {
        console.error('Error loading agent data:', error);
    }
}

async function loadRecentSubmissions() {
    const tbody = document.getElementById('recentSubmissionsBody');
    if (!tbody) return;

    try {
        const data = await agentAPI.getRecentCollections();
        tbody.innerHTML = data.collections.map((col) => `
            <tr>
                <td>${formatDate(col.created_at)}</td>
                <td>${col.user_name || 'Anonymous'}</td>
                <td>${col.material_type}</td>
                <td>${formatWeight(col.weight_kg)}</td>
                <td>${formatCurrency(col.payout)}</td>
            </tr>`).join('');
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

function setupAgentEventListeners() {
    document.getElementById('recordSubmissionForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submissionData = {
            user_email: document.getElementById('userEmail').value,
            material_type: document.getElementById('materialType').value,
            weight_kg: parseFloat(document.getElementById('weightInput').value)
        };
        await agentAPI.submitRecyclingRecord(submissionData);
        e.target.reset();
        loadAgentData();
    });
}