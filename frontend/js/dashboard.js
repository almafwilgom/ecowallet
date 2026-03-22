// User Dashboard Logic
let recyclingChart = null;
let materialChart = null;
let co2Chart = null;

const payoutRates = {
    PET: 450,
    HDPE: 420,
    Aluminum: 1200,
    Paper: 150
};

function estimatePayout(material, weight) {
    const rate = payoutRates[material] || 0;
    return Number(weight || 0) * rate;
}

// Modal helpers
const modalOverlay = document.getElementById('modalOverlay');
const modalTitleEl = document.getElementById('modalTitle');
const modalBodyEl = document.getElementById('modalBody');
const modalBadgeEl = document.getElementById('modalBadge');
const modalAmountEl = document.getElementById('modalAmount');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalActionBtn = document.getElementById('modalActionBtn');

function showModal({ title, body, amount, tone = 'success' }) {
    if (!modalOverlay) return;
    modalTitleEl.textContent = title;
    modalBodyEl.textContent = body;
    modalBadgeEl.textContent = tone === 'error' ? 'Notice' : 'Success';
    modalBadgeEl.classList.toggle('error', tone === 'error');

    if (typeof amount === 'number' && !Number.isNaN(amount)) {
        modalAmountEl.textContent = formatCurrency(amount);
        modalAmountEl.style.display = 'inline-block';
    } else {
        modalAmountEl.style.display = 'none';
    }

    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

[modalCloseBtn, modalActionBtn].forEach(btn => btn && btn.addEventListener('click', hideModal));
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModal();
});

document.addEventListener('DOMContentLoaded', async () => {
    const user = await (window.checkAuth ? window.checkAuth('user') : null);
    if (typeof window.setupLogout === 'function') {
        window.setupLogout();
    }

    if (user) {
        const welcomeName = document.getElementById('welcomeName');
        if (welcomeName && user.name) {
            welcomeName.textContent = user.name;
        }
        await loadDashboardData();
        setupEventListeners();
    }
});

async function loadDashboardData() {
    try {
        await loadWalletBalance();
        await loadUserStats();
        await loadLeaderboard();
        await loadActivity();
        await loadCharts();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadWalletBalance() {
    try {
        const data = await walletAPI.getBalance();
        const balanceEl = document.getElementById('walletBalance');
        if (balanceEl) {
            balanceEl.textContent = formatCurrency(data.wallet.balance);
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

async function loadUserStats() {
    try {
        const data = await wasteAPI.getUserStats();
        const totalWasteEl = document.getElementById('totalWaste');
        const totalCo2El = document.getElementById('totalCO2');
        if (totalWasteEl) {
            totalWasteEl.textContent = `${Number(data.stats.total_weight_kg || 0).toFixed(1)} kg`;
        }
        if (totalCo2El) {
            totalCo2El.textContent = `${Number(data.stats.total_co2_saved || 0).toFixed(1)} kg`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadLeaderboard() {
    try {
        const data = await wasteAPI.getLeaderboard(10);
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data.leaderboard || data.leaderboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No data yet</td></tr>';
            return;
        }

        data.leaderboard.forEach((item, index) => {
            const totalWaste = Number(item.total_waste_kg || 0);
            const totalCo2 = Number(item.total_co2_saved || 0);
            tbody.innerHTML += `
                <tr>
                    <td><span class="rank-pill">${index + 1}</span></td>
                    <td>${item.name}</td>
                    <td>${totalWaste.toFixed(3)} kg</td>
                    <td>${totalCo2.toFixed(2)} kg</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

async function loadActivity() {
    try {
        const data = await wasteAPI.getUserSubmissions();
        const tbody = document.getElementById('activityBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data.submissions || data.submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No submissions yet</td></tr>';
            return;
        }

        data.submissions.slice(0, 10).forEach(submission => {
            const statusBadge = `<span class="status-badge status-${submission.status}">${submission.status}</span>`;
            tbody.innerHTML += `
                <tr>
                    <td>${formatDate(submission.created_at)}</td>
                    <td>${submission.material_type}</td>
                    <td>${formatWeight(submission.weight_kg)}</td>
                    <td>${formatCurrency(submission.payout)}</td>
                    <td>${Number(submission.co2_saved || 0).toFixed(2)} kg</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
    } catch (error) {
        const tbody = document.getElementById('activityBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #B71C1C;">Unable to load activity</td></tr>';
        }
        console.error('Error loading activity:', error);
    }
}

async function loadCharts() {
    try {
        const data = await wasteAPI.getUserSubmissions('collected');
        const submissions = data.submissions || [];

        const activityCanvas = document.getElementById('recyclingChart');
        const materialCanvas = document.getElementById('materialChart');
        const co2Canvas = document.getElementById('co2Chart');
        if (!activityCanvas || !materialCanvas) return;

        if (!submissions.length) {
            if (recyclingChart) { recyclingChart.destroy(); recyclingChart = null; }
            if (materialChart) { materialChart.destroy(); materialChart = null; }
            if (co2Chart) { co2Chart.destroy(); co2Chart = null; }
            const emptyMsg = 'No collected submissions yet';
            activityCanvas.parentElement.innerHTML = `<div class="chart-empty">${emptyMsg}</div>`;
            materialCanvas.parentElement.innerHTML = `<div class="chart-empty">${emptyMsg}</div>`;
            if (co2Canvas) co2Canvas.parentElement.innerHTML = `<div class="chart-empty">${emptyMsg}</div>`;
            return;
        }

        const materialData = {};
        submissions.forEach(s => {
            if (!materialData[s.material_type]) {
                materialData[s.material_type] = 0;
            }
            materialData[s.material_type] += parseFloat(s.weight_kg);
        });

        if (recyclingChart) {
            recyclingChart.destroy();
        }
        recyclingChart = new Chart(activityCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: submissions.slice(-10).map(s => formatDate(s.created_at).split(' ')[0]),
                datasets: [{
                    label: 'Weight Submitted (kg)',
                    data: submissions.slice(-10).map(s => parseFloat(s.weight_kg)),
                    backgroundColor: '#6CB458',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        if (materialChart) {
            materialChart.destroy();
        }
        materialChart = new Chart(materialCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(materialData),
                datasets: [{
                    data: Object.values(materialData),
                    backgroundColor: [
                        '#2E7D32',
                        '#6CB458',
                        '#A9D6F5',
                        '#F7C948'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            }
        });

        if (co2Canvas) {
            if (co2Chart) {
                co2Chart.destroy();
            }
            co2Chart = new Chart(co2Canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: submissions.slice(-10).map(s => formatDate(s.created_at).split(' ')[0]),
                    datasets: [{
                        label: 'CO2 Saved (kg)',
                        data: submissions.slice(-10).map(s => parseFloat(s.co2_saved || 0)),
                        borderColor: '#5DAE6B',
                        backgroundColor: 'rgba(93, 174, 107, 0.2)',
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

function setupEventListeners() {
    const wasteForm = document.getElementById('wasteForm');
    if (wasteForm) {
        wasteForm.addEventListener('submit', handleWasteSubmission);
    }

    const withdrawMethod = document.getElementById('withdrawMethod');
    if (withdrawMethod) {
        withdrawMethod.addEventListener('change', (e) => {
            const phoneGroup = document.getElementById('phoneGroup');
            const bankGroup = document.getElementById('bankGroup');
            const networkGroup = document.getElementById('networkGroup');
            const phoneInput = document.getElementById('phoneNumber');
            const bankInput = document.getElementById('bankAccount');
            const bankNameInput = document.getElementById('bankName');
            const accountNameInput = document.getElementById('accountName');
            const networkSelect = document.getElementById('networkType');

            phoneGroup.style.display = 'none';
            bankGroup.style.display = 'none';
            if (networkGroup) networkGroup.style.display = 'none';
            if (phoneInput) {
                phoneInput.required = false;
                phoneInput.value = '';
            }
            if (bankInput) {
                bankInput.required = false;
                bankInput.value = '';
            }
            if (bankNameInput) {
                bankNameInput.required = false;
                bankNameInput.value = '';
            }
            if (accountNameInput) {
                accountNameInput.required = false;
                accountNameInput.value = '';
            }
            if (networkSelect) {
                networkSelect.required = false;
                networkSelect.value = '';
            }

            if (e.target.value === 'airtime' || e.target.value === 'mobile_data') {
                phoneGroup.style.display = 'block';
                if (phoneInput) phoneInput.required = true;
                if (networkGroup) networkGroup.style.display = 'block';
                if (networkSelect) networkSelect.required = true;
            } else if (e.target.value === 'bank_transfer') {
                bankGroup.style.display = 'block';
                if (bankInput) bankInput.required = true;
                if (bankNameInput) bankNameInput.required = true;
                if (accountNameInput) accountNameInput.required = true;
            }
        });
    }

    const withdrawalForm = document.getElementById('withdrawalForm');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', handleWithdrawal);
    }
}

async function handleWasteSubmission(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('formMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        msgDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const material_type = document.getElementById('material').value;
        const weight_kg = parseFloat(document.getElementById('weight').value);
        const location = document.getElementById('location').value.trim();

        if (!material_type || !weight_kg || !location) {
            throw new Error('All fields are required');
        }

        const result = await wasteAPI.submitWaste({
            material_type,
            weight_kg,
            location
        });

        const rewardMessage = result.reward?.message || result.message || 'Waste submitted';
        const rewardAmount = result.reward?.amount ?? result.submission?.payout ?? estimatePayout(material_type, weight_kg);

        msgDiv.className = 'form-message success';
        msgDiv.innerHTML = `Success: ${rewardMessage}. Funds post after an agent marks it collected.<br>Est. Payout: ${formatCurrency(rewardAmount)}`;
        msgDiv.style.display = 'block';

        showModal({
            title: 'Submission Received',
            body: 'Congratulations! Your submission is logged. Your payout will be added once an agent confirms collection.',
            amount: rewardAmount,
            tone: 'success'
        });

        e.target.reset();
        setTimeout(() => {
            loadDashboardData();
        }, 1000);
    } catch (error) {
        msgDiv.className = 'form-message error';
        msgDiv.textContent = 'Error: ' + error.message;
        msgDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

async function handleWithdrawal(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('withdrawMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        msgDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const method = document.getElementById('withdrawMethod').value;
        const phone_number = document.getElementById('phoneNumber')?.value.trim() || null;
        const bankAccount = document.getElementById('bankAccount')?.value.trim() || null;
        const bankName = document.getElementById('bankName')?.value.trim() || null;
        const accountName = document.getElementById('accountName')?.value.trim() || null;
        const networkType = document.getElementById('networkType')?.value.trim() || null;

        if (!amount || !method) {
            throw new Error('Amount and method are required');
        }
        if ((method === 'airtime' || method === 'mobile_data') && !phone_number) {
            throw new Error('Phone number is required for this method');
        }
        if ((method === 'airtime' || method === 'mobile_data') && !networkType) {
            throw new Error('Network type is required for this method');
        }
        if (method === 'bank_transfer' && !bankAccount) {
            throw new Error('Bank account number is required');
        }
        if (method === 'bank_transfer' && !bankName) {
            throw new Error('Bank name is required');
        }
        if (method === 'bank_transfer' && !accountName) {
            throw new Error('Account name is required');
        }

        // Verify available balance before submitting
        const { wallet } = await walletAPI.getBalance();
        const availableBalance = Number(wallet?.balance || 0);
        if (amount > availableBalance) {
            showModal({
                title: 'Insufficient Balance',
                body: `You have ${formatCurrency(availableBalance)} available. Enter a lower amount or wait for more collections to be confirmed.`,
                amount: availableBalance,
                tone: 'error'
            });
            msgDiv.className = 'form-message error';
            msgDiv.textContent = 'Insufficient balance for this withdrawal.';
            msgDiv.style.display = 'block';
            return;
        }

        const result = await walletAPI.requestWithdrawal({
            amount,
            method,
            phone_number,
            bank_account: method === 'bank_transfer' ? bankAccount : null,
            bank_name: method === 'bank_transfer' ? bankName : null,
            account_name: method === 'bank_transfer' ? accountName : null,
            network_type: (method === 'airtime' || method === 'mobile_data') ? networkType : null
        });

        msgDiv.className = 'form-message success';
        msgDiv.innerHTML = `Success: Withdrawal request submitted.<br>Amount: ${formatCurrency(result.withdrawal.amount)}<br>Status: ${result.withdrawal.status}`;
        msgDiv.style.display = 'block';

        const methodLabel = method === 'bank_transfer' ? 'bank transfer' : (method === 'airtime' ? 'airtime' : 'mobile data');
        showModal({
            title: 'Withdrawal Submitted',
            body: `We received your ${methodLabel} request. We will process it shortly.`,
            amount: result.withdrawal.amount,
            tone: 'success'
        });

        e.target.reset();
        setTimeout(() => {
            loadDashboardData();
        }, 2000);
    } catch (error) {
        msgDiv.className = 'form-message error';
        msgDiv.textContent = 'Error: ' + error.message;
        msgDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request Withdrawal';
    }
}
