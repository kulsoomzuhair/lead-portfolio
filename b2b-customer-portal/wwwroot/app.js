// B2B Customer Portal Frontend Controller
const API_BASE = "http://localhost:5000";

let currentCardCode = "";
let currentPriceListId = 1;
let openInvoiceToPay = null;
let logPollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initial Auth Check
    checkAuth();

    // Login Form Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cardCodeInput = document.getElementById('cardCode').value.trim();
            const passwordInput = document.getElementById('password').value;
            const loginError = document.getElementById('loginError');

            loginError.classList.add('hide');

            try {
                const res = await fetch(`${API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ CardCode: cardCodeInput, Password: passwordInput })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    // Save to localStorage
                    localStorage.setItem('b2b_cardCode', data.cardCode);
                    localStorage.setItem('b2b_cardName', data.cardName);
                    localStorage.setItem('b2b_limit', data.limit);
                    localStorage.setItem('b2b_balance', data.balance);

                    checkAuth();
                } else {
                    loginError.textContent = data.message || "Authentication failed.";
                    loginError.classList.remove('hide');
                }
            } catch (err) {
                loginError.textContent = "Could not connect to Portal Backend server.";
                loginError.classList.remove('hide');
            }
        });
    }

    // Payment Form Submission
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!openInvoiceToPay) return;

            // Show loading on button
            const payBtn = paymentForm.querySelector('button[type="submit"]');
            const originalHtml = payBtn.innerHTML;
            payBtn.disabled = true;
            payBtn.innerHTML = `<i class="bi bi-hourglass-split me-2"></i>Processing Stripe & SAP Sync...`;

            try {
                const res = await fetch(`${API_BASE}/api/invoices/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ InvoiceNum: openInvoiceToPay.invoiceNum })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    closePaymentModal();
                    
                    // Show success modal
                    showSuccessModal("Payment Completed!", `Stripe transaction authorized successfully.`, data.sapDocEntry);
                    
                    // Refresh data
                    await fetchDashboardStats();
                    await fetchInvoices();
                    fetchSyncLogs();
                } else {
                    alert(data.message || "Payment sync to SAP failed.");
                }
            } catch (err) {
                alert("Connection error during payment processing.");
            } finally {
                payBtn.disabled = false;
                payBtn.innerHTML = originalHtml;
            }
        });
    }
});

// Authentication Status Verification
function checkAuth() {
    const cardCode = localStorage.getItem('b2b_cardCode');
    const cardName = localStorage.getItem('b2b_cardName');

    const loginContainer = document.getElementById('loginContainer');
    const portalContainer = document.getElementById('portalContainer');

    if (cardCode && cardName) {
        currentCardCode = cardCode;
        loginContainer.classList.add('hide');
        portalContainer.classList.remove('hide');

        // Update sidebar user details
        document.getElementById('sidebarUserName').textContent = cardName;
        document.getElementById('sidebarUserCode').textContent = cardCode;
        document.getElementById('welcomeUserName').textContent = cardName;

        // Initialize dashboard loading
        switchTab('dashboard');
    } else {
        currentCardCode = "";
        loginContainer.classList.remove('hide');
        portalContainer.classList.add('hide');
        stopLogPolling();
    }
}

// Log Out Handler
function logout() {
    localStorage.clear();
    checkAuth();
}

// Sidebar Tab Switcher
async function switchTab(tabId) {
    // Toggle active classes on sidebar items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const itemText = item.textContent.trim().toLowerCase();
        if (itemText.includes(tabId)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Toggle active tab sections
    const tabViews = document.querySelectorAll('.tab-view');
    tabViews.forEach(view => {
        if (view.id === `tab-${tabId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    // Stop log polling by default
    stopLogPolling();

    // Load data based on chosen tab
    if (tabId === 'dashboard') {
        await fetchDashboardStats();
    } else if (tabId === 'catalog') {
        await fetchCatalog();
    } else if (tabId === 'invoices') {
        await fetchInvoices();
    } else if (tabId === 'monitor') {
        await fetchSyncLogs();
        startLogPolling(); // Start polling logs on monitor tab
    }
}

// Fetch Customer Account Balance & Credit Limit Details
async function fetchDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CardCode: currentCardCode, Password: currentCardCode === "C20000" ? "fatima123" : "kf123" }) // Silently refresh stats
        });
        const data = await res.json();
        if (res.ok && data.success) {
            localStorage.setItem('b2b_balance', data.balance);
            localStorage.setItem('b2b_limit', data.limit);
        }
    } catch {}

    const balance = parseFloat(localStorage.getItem('b2b_balance') || 0);
    const limit = parseFloat(localStorage.getItem('b2b_limit') || 0);
    const available = limit - balance;
    const utilizationPercent = Math.min((balance / limit) * 100, 100);

    document.getElementById('statCreditLimit').textContent = `$${limit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('statBalance').textContent = `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('statAvailable').textContent = `$${available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const bar = document.getElementById('creditProgressBar');
    bar.style.width = `${utilizationPercent}%`;
    document.getElementById('creditProgressLabel').textContent = `${utilizationPercent.toFixed(1)}% credit limit utilized`;

    // Apply color logic based on utilization
    if (utilizationPercent > 90) {
        bar.style.background = "var(--accent-danger)";
    } else if (utilizationPercent > 70) {
        bar.style.background = "#f59e0b"; // Warning Orange
    } else {
        bar.style.background = "linear-gradient(90deg, var(--accent-blue), var(--accent-primary))";
    }
}

// Fetch Wholesale Catalog Items
async function fetchCatalog() {
    const list = document.getElementById('catalogList');
    list.innerHTML = `<div class="stat-card" style="grid-column: 1/-1; justify-content: center;"><i class="bi bi-hourglass-split me-2"></i>Loading Catalog...</div>`;

    try {
        const res = await fetch(`${API_BASE}/api/catalog/${currentCardCode}`);
        const data = await res.json();

        if (res.ok) {
            list.innerHTML = "";
            data.forEach(item => {
                const inStock = item.stockLevel > 0;
                const lowStock = item.stockLevel > 0 && item.stockLevel <= 15;

                const cardHtml = `
                    <div class="product-card">
                        <span class="prod-badge">${item.itemCode}</span>
                        <h4>${item.itemName}</h4>
                        <div class="price-strip">
                            <span class="base-price">Retail: $${item.basePrice.toFixed(2)}</span>
                            <span class="contract-price">$${item.contractPrice.toFixed(2)} <span>/ wholesale</span></span>
                        </div>
                        <div class="stock-status ${inStock ? (lowStock ? 'low-stock' : 'in-stock') : 'low-stock'}">
                            <i class="bi ${inStock ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                            ${inStock ? (lowStock ? `Low Stock (${item.stockLevel} units left)` : 'Available in Inventory') : 'Out of Stock'}
                        </div>
                        <div class="cart-controls">
                            <input type="number" class="qty-input" value="1" min="1" id="qty-${item.itemCode}">
                            <button class="btn btn-primary btn-sm w-100" onclick="buyItem('${item.itemCode}', ${item.contractPrice})" ${!inStock ? 'disabled' : ''}>
                                <i class="bi bi-cart-plus-fill"></i> Order Item
                            </button>
                        </div>
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', cardHtml);
            });
        } else {
            list.innerHTML = `<div class="error-msg">${data.message || 'Error loading products.'}</div>`;
        }
    } catch {
        list.innerHTML = `<div class="error-msg">Connection error. Check backend server.</div>`;
    }
}

// Fetch Account Invoices
async function fetchInvoices() {
    const tbody = document.getElementById('invoiceList');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;"><i class="bi bi-hourglass-split me-2"></i>Loading Open Invoices...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/api/invoices/${currentCardCode}`);
        const data = await res.json();

        if (res.ok) {
            tbody.innerHTML = "";
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No invoices found on account.</td></tr>`;
                return;
            }

            data.forEach(inv => {
                const unpaid = inv.status.toLowerCase() === 'unpaid';
                const formattedTotal = inv.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                const rowHtml = `
                    <tr>
                        <td><strong>${inv.invoiceNum}</strong></td>
                        <td>${new Date(inv.docDate).toLocaleDateString()}</td>
                        <td>${new Date(inv.docDueDate).toLocaleDateString()}</td>
                        <td><strong style="color: var(--text-primary); font-family: monospace;">$${formattedTotal}</strong></td>
                        <td>
                            <span class="badge-status ${unpaid ? 'unpaid' : 'paid'}">
                                ${unpaid ? 'Unpaid' : 'Paid'}
                            </span>
                        </td>
                        <td>
                            <button class="btn-table-action" onclick="openPaymentModal('${inv.invoiceNum}', ${inv.docTotal})" ${!unpaid ? 'disabled' : ''}>
                                ${unpaid ? '<i class="bi bi-credit-card"></i> Pay Invoice' : 'Settled'}
                            </button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }
    } catch {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-danger)">Connection error.</td></tr>`;
    }
}

// Purchase Item Event Handler
async function buyItem(itemCode, price) {
    const qty = parseInt(document.getElementById(`qty-${itemCode}`).value);
    if (isNaN(qty) || qty <= 0) return alert("Please specify a valid quantity.");

    const total = qty * price;
    
    // Simulate placing a direct order request
    const confirmBuy = confirm(`Confirm placing order for SKU ${itemCode} x${qty}. Total Amount: $${total.toFixed(2)}?`);
    if (!confirmBuy) return;

    try {
        const res = await fetch(`${API_BASE}/api/orders/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                CardCode: currentCardCode,
                TotalAmount: total,
                Items: [{ ItemCode: itemCode, Quantity: qty, UnitPrice: price }]
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showSuccessModal("Order Sync Completed!", `Sales Order created dynamically in local queue.`, data.sapDocEntry);
            
            // Reload views
            await fetchDashboardStats();
            await fetchCatalog();
            fetchSyncLogs();
        } else {
            alert(data.message || "Order rejected by Service Layer check.");
        }
    } catch {
        alert("Connection failed during checkout.");
    }
}

// Fetch System Sync Logs
async function fetchSyncLogs() {
    const tbody = document.getElementById('logList');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/api/sync-logs`);
        const data = await res.json();

        if (res.ok) {
            tbody.innerHTML = "";
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No sync logs recorded yet.</td></tr>`;
                return;
            }

            data.forEach(log => {
                const rowHtml = `
                    <tr>
                        <td><strong><i class="bi bi-gear-wide-connected text-primary me-2"></i>${log.agentName}</strong></td>
                        <td>
                            <span class="badge-status ${log.status.toLowerCase()}">
                                ${log.status}
                            </span>
                        </td>
                        <td>${log.message}</td>
                        <td style="font-family: monospace; font-size: 0.85rem;">${new Date(log.timestamp).toISOString()}</td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }
    } catch {}
}

// Stripe Modal Controls
function openPaymentModal(invoiceNum, docTotal) {
    openInvoiceToPay = { invoiceNum, docTotal };
    
    document.getElementById('payInvoiceNum').textContent = invoiceNum;
    document.getElementById('payInvoiceTotal').textContent = `$${docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('paymentModal').classList.remove('hide');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hide');
    openInvoiceToPay = null;
}

// Success Modal Controls
function showSuccessModal(title, msg, sapDocEntry) {
    document.getElementById('successModalTitle').textContent = title;
    document.getElementById('successModalMsg').textContent = msg;
    document.getElementById('successSapDoc').textContent = sapDocEntry || "N/A";
    document.getElementById('successModal').classList.remove('hide');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hide');
}

// Logs polling mechanisms
function startLogPolling() {
    stopLogPolling();
    logPollInterval = setInterval(fetchSyncLogs, 3000);
}

function stopLogPolling() {
    if (logPollInterval) {
        clearInterval(logPollInterval);
        logPollInterval = null;
    }
}
