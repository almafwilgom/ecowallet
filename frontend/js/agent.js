// Agent Dashboard Logic
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const user = checkAuth('agent');
    setupLogout();

    if (user) {
        await loadAgentData();
    }
});

async function loadAgentData() {
    try {
        await loadAgentStats();
        await loadPendingSubmissions();
        await loadCollectedSubmissions();
    } catch (error) {
        console.error('Error loading agent data:', error);
    }
}

async function loadAgentStats() {
    try {
        const data = await agentAPI.getAgentStats();
        const stats = data.stats;

        document.getElementById('totalCollections').textContent = stats.total_collections;
        document.getElementById('totalWeightCollected').textContent = `${stats.total_weight_kg.toFixed(1)} kg`;
        document.getElementById('totalCO2Prevented').textContent = `${stats.total_co2_saved.toFixed(1)} kg`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadPendingSubmissions() {
    try {
        const data = await agentAPI.getPendingSubmissions();
        const tbody = document.getElementById('submissionsBody');
        const noSubmissions = document.getElementById('noSubmissions');

        tbody.innerHTML = '';

        if (data.submissions.length === 0) {
            noSubmissions.style.display = 'block';
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">No pending submissions</td></tr>';
            return;
        }

        noSubmissions.style.display = 'none';

        data.submissions.forEach(submission => {
            tbody.innerHTML += `
                <tr>
                    <td>${submission.user_name}</td>
                    <td>${submission.material_type}</td>
                    <td>${formatWeight(submission.weight_kg)}</td>
                    <td>${submission.location}</td>
                    <td>${formatCurrency(submission.payout)}</td>
                    <td>${formatDate(submission.created_at)}</td>
                    <td>
                        <button class="action-btn" onclick="collectSubmission(${submission.id})">
                            Mark Collected
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading pending submissions:', error);
    }
}

async function loadCollectedSubmissions() {
    try {
        const data = await agentAPI.getCollectedSubmissions();
        const tbody = document.getElementById('collectedBody');

        tbody.innerHTML = '';

        if (data.submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No collected submissions yet</td></tr>';
            return;
        }

        data.submissions.slice(0, 20).forEach(submission => {
            tbody.innerHTML += `
                <tr>
                    <td>${submission.user_name}</td>
                    <td>${submission.material_type}</td>
                    <td>${formatWeight(submission.weight_kg)}</td>
                    <td>${formatCurrency(submission.payout)}</td>
                    <td>${submission.co2_saved.toFixed(2)} kg</td>
                    <td>${formatDate(submission.updated_at)}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading collected submissions:', error);
    }
}

async function collectSubmission(submissionId) {
    try {
        if (!confirm('Mark this submission as collected?')) {
            return;
        }

        await agentAPI.collectSubmission(submissionId);

        // Show success message
        alert('Success: Submission marked as collected.');

        // Reload data
        await loadAgentData();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}
