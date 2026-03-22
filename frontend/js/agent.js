/* global agentAPI, formatCurrency, formatDate, formatWeight, setupLogout */

/**
 * Agent Dashboard Logic for EcoWallet
 */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await (window.checkAuth ? window.checkAuth('agent') : null);
        if (!user) return;

        if (typeof setupLogout === 'function') {
            setupLogout();
        }

        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = user.name || 'Agent';

        await loadAgentDashboard();
    } catch (error) {
        console.error('Initialization failed:', error);
        window.location.href = '/login.html';
    }
});

// Modal controller (mirrors admin.js)
function createModalController() {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) {
        return {
            alert: ({ message }) => alert(message),
            confirm: async ({ message }) => confirm(message)
        };
    }
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const badgeEl = document.getElementById('modalBadge');
    const amountEl = document.getElementById('modalAmount');
    const primaryBtn = document.getElementById('modalPrimaryBtn');
    const secondaryBtn = document.getElementById('modalSecondaryBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    const hide = () => {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    const alert = ({ title = 'Notice', message = '', tone = 'success', amount = null, primaryText = 'OK' }) => {
        badgeEl.textContent = tone === 'error' ? 'Error' : 'Notice';
        badgeEl.classList.toggle('error', tone === 'error');
        titleEl.textContent = title;
        bodyEl.textContent = message;
        if (amount !== null && !Number.isNaN(Number(amount))) {
            amountEl.textContent = formatCurrency(amount);
            amountEl.style.display = 'inline-block';
        } else {
            amountEl.style.display = 'none';
        }
        secondaryBtn.style.display = 'none';
        primaryBtn.textContent = primaryText;
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        const onPrimary = () => {
            hide();
            primaryBtn.removeEventListener('click', onPrimary);
        };
        primaryBtn.addEventListener('click', onPrimary);
        closeBtn.onclick = hide;
        overlay.onclick = (e) => { if (e.target === overlay) hide(); };
        document.addEventListener('keydown', function escHandler(ev) {
            if (ev.key === 'Escape') { hide(); document.removeEventListener('keydown', escHandler); }
        });
    };

    const confirm = ({ title = 'Confirm', message = '', tone = 'notice', primaryText = 'Yes', cancelText = 'Cancel' }) => {
        return new Promise((resolve) => {
            badgeEl.textContent = 'Confirm';
            badgeEl.classList.toggle('error', tone === 'error');
            titleEl.textContent = title;
            bodyEl.textContent = message;
            amountEl.style.display = 'none';
            primaryBtn.textContent = primaryText;
            secondaryBtn.textContent = cancelText;
            secondaryBtn.style.display = 'inline-flex';
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

            const cleanup = () => {
                primaryBtn.removeEventListener('click', onYes);
                secondaryBtn.removeEventListener('click', onNo);
                closeBtn.removeEventListener('click', onNo);
                overlay.removeEventListener('click', outsideClick);
                document.removeEventListener('keydown', escHandler);
                hide();
            };
            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };
            const outsideClick = (e) => { if (e.target === overlay) onNo(); };
            const escHandler = (ev) => { if (ev.key === 'Escape') onNo(); };
            primaryBtn.addEventListener('click', onYes);
            secondaryBtn.addEventListener('click', onNo);
            closeBtn.addEventListener('click', onNo);
            overlay.addEventListener('click', outsideClick);
            document.addEventListener('keydown', escHandler);
        });
    };

    return { alert, confirm };
}

const modal = createModalController();

async function loadAgentDashboard() {
    try {
        const data = await agentAPI.getAgentStats();
        
        // DEFENSIVE FIX: Ensure properties exist even if data.stats is an empty object
        const stats = data.stats || {};
        const totalCollections = stats.total_collections || 0;
        const totalWeight = stats.total_weight || stats.total_weight_kg || 0;
        const totalCO2 = stats.total_co2 || stats.total_co2_saved || 0;

        // Update UI safely
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
        const data = await agentAPI.getPendingSubmissions();
        if (!data.submissions || data.submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No pending submissions</td></tr>';
            return;
        }

        tbody.innerHTML = data.submissions.map(col => `
            <tr>
                <td>${col.user_name || 'User'}</td>
                <td>${col.user_phone || '—'}</td>
                <td>${col.material_type}</td>
                <td>${formatWeight(col.weight_kg || 0)}</td>
                <td>${col.location || 'N/A'}</td>
                <td>${formatCurrency(col.payout || 0)}</td>
                <td>${formatDate(col.created_at)}</td>
                <td><button class="btn btn-sm" onclick="collectWaste('${col.id}')">Collect</button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load pending submissions:', error);
        tbody.innerHTML = '<tr><td colspan="8">Error loading data</td></tr>';
    }
}

async function loadCollectedHistory() {
    const tbody = document.getElementById('collectedBody');
    if (!tbody) return;

    try {
        const data = await agentAPI.getCollectedSubmissions();
        if (!data.submissions || data.submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No history found</td></tr>';
            return;
        }

        tbody.innerHTML = data.submissions.map(col => `
            <tr>
                <td>${col.user_name || 'User'}</td>
                <td>${col.material_type}</td>
                <td>${formatWeight(col.weight_kg || 0)}</td>
                <td>${formatCurrency(col.payout || 0)}</td>
                <td>${Number(col.co2_saved || 0).toFixed(2)} kg</td>
                <td>${formatDate(col.created_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load history:', error);
        tbody.innerHTML = '<tr><td colspan="6">Error loading history</td></tr>';
    }
}

window.collectWaste = async (id) => {
    const proceed = await modal.confirm({
        title: 'Confirm collection',
        message: 'Mark this submission as collected?',
        primaryText: 'Mark collected'
    });
    if (!proceed) return;
    try {
        await agentAPI.updateCollectionStatus(id, 'collected');
        await loadAgentDashboard();
        modal.alert({ title: 'Updated', message: 'Submission marked as collected.', tone: 'success' });
    } catch (error) {
        modal.alert({ title: 'Error', message: error.message || 'Failed to update', tone: 'error' });
    }
};
