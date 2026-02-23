// DOM Elements
const form = document.getElementById('inventoryForm');
const priceInput = document.getElementById('price');
const balanceInput = document.getElementById('balance');
const totalInput = document.getElementById('total');
const dateInput = document.getElementById('date');
const nameInput = document.getElementById('name');

// Modal Elements
const newClientModal = document.getElementById('newClientModal');
const newClientNameInput = document.getElementById('newClientName');
const btnSaveClient = document.getElementById('btnSaveClient');
const btnCancelClient = document.getElementById('btnCancelClient');

const reportsSection = document.getElementById('reportsSection');
const dataSection = document.getElementById('dataSection');
const reportChartCanvas = document.getElementById('reportChart');
const reportTitle = document.getElementById('reportTitle');
const reportSummary = document.getElementById('reportSummary');
const dataTableBody = document.querySelector('#dataTable tbody');

let chartInstance = null;

// Set default date to today
dateInput.valueAsDate = new Date();

// --- Event Listeners ---

// Auto-calculate Total
function calculateTotal() {
    const price = parseFloat(priceInput.value) || 0;
    const balance = parseFloat(balanceInput.value) || 0;
    const total = price + balance;
    totalInput.value = total.toFixed(2);
}

priceInput.addEventListener('input', calculateTotal);
balanceInput.addEventListener('input', calculateTotal);

// Detect "Add New Client..." selection
nameInput.addEventListener('input', function () {
    if (this.value === 'Add New Client...') {
        this.value = ''; // Clear the ugly text
        openClientModal();
    }
});

function openClientModal() {
    newClientModal.classList.remove('hidden');
    newClientNameInput.value = '';
    newClientNameInput.focus();
}

function closeClientModal() {
    newClientModal.classList.add('hidden');
}

btnCancelClient.addEventListener('click', closeClientModal);

btnSaveClient.addEventListener('click', function () {
    const name = newClientNameInput.value.trim();
    if (!name) {
        if (typeof showToast === 'function') showToast('Please enter a client name.', 'error');
        else alert('Please enter a name.');
        return;
    }

    updateNameList(name);

    // Set the value in the main form
    nameInput.value = name;

    closeClientModal();
});

// Update Name List Helper
function updateNameList(newName) {
    const dataList = document.getElementById('nameList');
    const options = Array.from(dataList.options).map(opt => opt.value);
    if (newName && !options.includes(newName)) {
        const option = document.createElement('option');
        option.value = newName;
        dataList.appendChild(option);

        // Optionally save names to localStorage to persist across reloads
        saveCustomNames(newName);
    }
}

function saveCustomNames(name) {
    let names = JSON.parse(localStorage.getItem('sk_custom_names') || '[]');
    if (!names.includes(name)) {
        names.push(name);
        localStorage.setItem('sk_custom_names', JSON.stringify(names));
    }
}

function loadCustomNames() {
    let names = JSON.parse(localStorage.getItem('sk_custom_names') || '[]');
    const dataList = document.getElementById('nameList');

    // Clear current dynamic options (keeping default hardcoded provided by HTML logic? No, let's just append)
    // Actually, to keep "Add New Client" at top, we rely on HTML order, but new names go to bottom.

    names.forEach(name => {
        // Avoid duplicates if default ones are in list (though defaults are hardcoded in HTML, so check logic)
        const exists = Array.from(dataList.options).some(opt => opt.value === name);
        if (!exists) {
            const option = document.createElement('option');
            option.value = name;
            dataList.appendChild(option);
        }
    });
}

// Manual Add Name Button Logic - REMOVED
// document.getElementById('btnAddName').addEventListener('click', ...


// Load names on start
loadCustomNames();

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqF5LOXaNCK3Xn4cD0IhzTi84HTBsHxDiZ7GQvDFhPKGZnqQ75suGzr2KkB50TgHoT/exec";

// Handle Form Submission — single source of truth for save logic
form.addEventListener('submit', function (e) {
    e.preventDefault();

    // ── Step 1: Validate required fields ──────────────────────
    if (typeof validateForm === 'function' && !validateForm()) {
        if (typeof showToast === 'function') {
            showToast('Please fill in all required fields.', 'error');
        }
        const firstErr = form.querySelector('.has-error input, .has-error select');
        if (firstErr) firstErr.focus();
        return;
    }

    // ── Step 2: Ensure total is up-to-date before reading ─────
    calculateTotal();

    // ── Step 3: Build entry (with safe numeric fallbacks) ─────
    const entry = {
        id: Date.now(),
        type: 'sale',
        name: document.getElementById('name').value.trim(),
        date: document.getElementById('date').value,
        material: document.getElementById('material').value,
        quantity: parseFloat(document.getElementById('quantity').value) || 0,
        price: parseFloat(document.getElementById('price').value) || 0,
        balance: parseFloat(document.getElementById('balance').value) || 0,
        total: parseFloat(document.getElementById('total').value) || 0
    };

    // ── Step 4: Loading state on Save button ──────────────────
    const saveBtn = document.getElementById('btnSaveEntry');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('btn-loading');
        const btnIcon = saveBtn.querySelector('i');
        if (btnIcon) btnIcon.style.display = 'none';
    }

    // ── Step 5: Persist to Local & Cloud ──────────────────────
    updateNameList(entry.name);
    saveEntry(entry);

    // Send to Google Sheets
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(entry)
    })
        .then(() => {
            // ── Step 6: Success Path ───────────────────
            showToast('Entry saved to Cloud & Local!', 'success');

            // Reset form
            form.reset();
            dateInput.valueAsDate = new Date();
            calculateTotal();
            form.querySelectorAll('.has-error').forEach(g => g.classList.remove('has-error'));

            if (typeof updateStats === 'function') updateStats();
            if (!dataSection.classList.contains('hidden')) renderDataTable();
        })
        .catch(err => {
            console.error('Sheet Sync Error:', err);
            showToast('Saved locally, but Cloud sync failed.', 'info');
        })
        .finally(() => {
            // ── Step 7: Restore button ──────────────────
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('btn-loading');
                const btnIcon = saveBtn.querySelector('i');
                if (btnIcon) btnIcon.style.display = '';
                if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [saveBtn] });
            }
        });
});

// View Buttons
document.getElementById('btnWeeklyReport').addEventListener('click', () => showReport('weekly'));
document.getElementById('btnMonthlyReport').addEventListener('click', () => showReport('monthly'));
document.getElementById('btnViewData').addEventListener('click', showDataView);

// Close Buttons
document.getElementById('closeReport').addEventListener('click', () => {
    reportsSection.classList.add('hidden');
});
document.getElementById('closeData').addEventListener('click', () => {
    dataSection.classList.add('hidden');
});

// --- Reset Entries ---
const resetModal = document.getElementById('resetConfirmModal');

document.getElementById('btnResetEntries').addEventListener('click', () => {
    resetModal.classList.add('active');
});

document.getElementById('btnCancelReset').addEventListener('click', () => {
    resetModal.classList.remove('active');
});

// Close if clicking outside the box
resetModal.addEventListener('click', (e) => {
    if (e.target === resetModal) resetModal.classList.remove('active');
});

document.getElementById('btnConfirmReset').addEventListener('click', () => {
    localStorage.removeItem('sk_accounts_data');
    localStorage.removeItem('sk_custom_names');
    resetModal.classList.remove('active');

    // Clear the table if visible
    dataTableBody.innerHTML = '';
    // Update panel heading if it exists
    const panelTitle = document.getElementById('dataTableTitle');
    if (panelTitle) panelTitle.textContent = 'Recent Entries';
    const badge = document.getElementById('entriesCountBadge');
    if (badge) badge.textContent = '';

    // Hide open sections
    dataSection.classList.add('hidden');
    reportsSection.classList.add('hidden');

    if (typeof showToast === 'function') showToast('All inventory entries have been reset.', 'info');
});

// --- Data Management (LocalStorage) ---

function getEntries() {
    const entries = localStorage.getItem('sk_accounts_data');
    return entries ? JSON.parse(entries) : [];
}

function saveEntry(entry) {
    const entries = getEntries();
    entries.push(entry);
    localStorage.setItem('sk_accounts_data', JSON.stringify(entries));
}

// --- Reporting Logic ---

function showReport(type) {
    reportsSection.classList.remove('hidden');
    dataSection.classList.add('hidden'); // Hide other section

    // Get Data
    const entries = getEntries();
    const today = new Date();

    let labels = [];
    let purchaseData = [];
    let salesData = [];
    let title = "";

    if (type === 'weekly') {
        title = "Weekly Report (Last 7 Days)";
        // Generate last 7 days labels
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            labels.push(d.toISOString().split('T')[0]);
        }
    } else {
        title = "Monthly Report (Last 4 Weeks)";
        // Generate last 4 weeks labels (simplified as 4 buckets or last 30 days)
        // Let's do last 30 days for smoother graph? Or stick to weeks?
        // User asked for "Previous weeks", allow day-by-day for monthly might be crowded, but accurate.
        // Let's do last 30 days.
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            labels.push(d.toISOString().split('T')[0]);
        }
    }

    reportTitle.textContent = title;

    // Aggregate Data
    labels.forEach(dateStr => {
        // Filter entries for this date
        const dayEntries = entries.filter(e => e.date === dateStr);

        // Sum Purchase Amounts (Total field or Price field? User said "purchases and sales data". Usually that's the Amount)
        // Let's use the 'Price' (Current Amount) for the graph volume. Total includes previous balance which might skew daily volume.
        // Filter sales only (though all should be sales now)
        const daySales = dayEntries
            .filter(e => e.type === 'sale')
            .reduce((sum, e) => sum + e.price, 0);

        salesData.push(daySales);
    });

    renderChart(labels, salesData);

    // Summary
    const totalSales = salesData.reduce((a, b) => a + b, 0);
    reportSummary.style.display = 'block';
    reportSummary.innerHTML = `
        <strong>Total Sales:</strong> ₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
    `;
}

function renderChart(labels, salesData) {
    if (chartInstance) chartInstance.destroy();

    const ctx = reportChartCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 230);
    grad.addColorStop(0, 'rgba(37, 99, 235, 0.8)');
    grad.addColorStop(1, 'rgba(37, 99, 235, 0.07)');

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales (₹)',
                data: salesData,
                backgroundColor: grad,
                borderColor: 'rgba(37, 99, 235, 0)',
                borderWidth: 0,
                borderRadius: 5,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#fff',
                    titleColor: '#0f172a',
                    bodyColor: '#64748b',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: c => ' ₹' + c.parsed.y.toLocaleString('en-IN')
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { size: 10, family: 'Inter, sans-serif' }, maxRotation: 40 },
                    grid: { display: false },
                    border: { color: '#e2e8f0' }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10, family: 'Inter, sans-serif' },
                        callback: v => v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K' : '₹' + v
                    },
                    grid: { color: '#f1f5f9' },
                    border: { color: 'transparent', dash: [3, 3] }
                }
            }
        }
    });
}

// --- Data Table View ---

function showDataView() {
    dataSection.classList.remove('hidden');
    reportsSection.classList.add('hidden');
    renderDataTable();
}

function renderDataTable() {
    const allEntries = getEntries().sort((a, b) => new Date(b.date) - new Date(a.date));
    const entries = allEntries.slice(0, 100);
    dataTableBody.innerHTML = '';

    // Update panel title + badge
    const panelTitle = document.getElementById('dataTableTitle');
    const badge = document.getElementById('entriesCountBadge');
    if (panelTitle) panelTitle.textContent = 'Recent Entries';
    if (badge) badge.textContent = allEntries.length > 100
        ? `Showing 100 of ${allEntries.length}`
        : `${allEntries.length} record${allEntries.length !== 1 ? 's' : ''}`;

    if (allEntries.length === 0) {
        dataTableBody.innerHTML = `<tr class="tbody-empty"><td colspan="6">No entries yet.</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="td-muted">${entry.date}</td>
            <td class="td-name">${entry.name}</td>
            <td>${entry.material}</td>
            <td>${entry.quantity}</td>
            <td class="td-amount">${entry.price.toFixed(2)}</td>
            <td class="td-amount">${entry.total.toFixed(2)}</td>
        `;
        dataTableBody.appendChild(row);
    });
}

// Initialize with some dummy data if empty (For demo purposes)
if (getEntries().length === 0) {
    const today = new Date();
    const yester = new Date(); yester.setDate(today.getDate() - 1);

    const dummy = [
        { id: 1, type: 'sale', name: 'Default Client 1', date: yester.toISOString().split('T')[0], material: 'Cement', quantity: 100, price: 50000, balance: 0, total: 50000 },
        { id: 2, type: 'sale', name: 'Default Client 2', date: today.toISOString().split('T')[0], material: 'Cement', quantity: 10, price: 6000, balance: 500, total: 6500 }
    ];
    localStorage.setItem('sk_accounts_data', JSON.stringify(dummy));
}
