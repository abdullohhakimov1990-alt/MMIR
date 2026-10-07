/**
 * MMIR — Metal Markaz Enterprise ERP System Engine
 * Senior Full-Stack Architecture — 2026 Edition
 */

// ==========================================
// 1. STATE & STORAGE MANAGEMENT
// ==========================================

let workers = JSON.parse(localStorage.getItem('mmir_workers')) || [];
let categories = JSON.parse(localStorage.getItem('mmir_categories')) || [];
let warehouse = JSON.parse(localStorage.getItem('mmir_warehouse')) || [];
let rawMaterials = JSON.parse(localStorage.getItem('mmir_raw_materials')) || [];
let productionHistory = JSON.parse(localStorage.getItem('mmir_prod_history')) || [];
let currentUser = JSON.parse(localStorage.getItem('mmir_current_user')) || null;
if (currentUser && !currentUser.username) {
    currentUser.username = currentUser.role === 'admin' ? 'admin' : 'ishchi';
    localStorage.setItem('mmir_current_user', JSON.stringify(currentUser));
}

// Temporary UI State
let activeWorkerId = null;
let activeProductionProductId = null;
let deleteTarget = null;
let currentProductionCatFilter = 'Barchasi';
let currentOmborCatFilter = 'Barchasi';

// Unique ID Generator
function generateUniqueId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// Data Migration: Ensure every item has a unique string ID
function ensureEntityIds() {
    let modified = false;
    
    rawMaterials.forEach((r, idx) => {
        if (!r.id) { r.id = generateUniqueId('raw'); modified = true; }
    });
    warehouse.forEach((w, idx) => {
        if (!w.id) { w.id = generateUniqueId('prod'); modified = true; }
    });
    categories.forEach((c, idx) => {
        if (!c.id) { c.id = generateUniqueId('cat'); modified = true; }
    });
    workers.forEach((wr, idx) => {
        if (!wr.id) { wr.id = generateUniqueId('worker'); modified = true; }
        if (!wr.tasks) wr.tasks = [];
        if (!wr.expenses) wr.expenses = [];
        if (!wr.history) wr.history = [];
        wr.expenses.forEach(e => { if (!e.id) e.id = generateUniqueId('exp'); });
    });
    productionHistory.forEach((p, idx) => {
        if (!p.id) { p.id = generateUniqueId('prod_hist'); modified = true; }
    });

    if (modified) {
        saveData();
    }
}

function saveData() {
    localStorage.setItem('mmir_workers', JSON.stringify(workers));
    localStorage.setItem('mmir_categories', JSON.stringify(categories));
    localStorage.setItem('mmir_warehouse', JSON.stringify(warehouse));
    localStorage.setItem('mmir_raw_materials', JSON.stringify(rawMaterials));
    localStorage.setItem('mmir_prod_history', JSON.stringify(productionHistory));
}

// ==========================================
// 2. UTILITY & FORMATTING HELPERS
// ==========================================

function formatMoney(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('uz-UZ') + " so'm";
}

function showNotification(message, type = 'success') {
    const t = document.getElementById('custom-toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!t) return;

    msgEl.innerText = message;
    t.className = 'custom-toast';

    if (type === 'error') {
        t.classList.add('toast-error');
        if (iconEl) iconEl.className = 'fa-solid fa-circle-xmark fs-5';
    } else if (type === 'warning') {
        t.classList.add('toast-warning');
        if (iconEl) iconEl.className = 'fa-solid fa-triangle-exclamation fs-5';
    } else {
        t.classList.add('toast-success');
        if (iconEl) iconEl.className = 'fa-solid fa-circle-check fs-5';
    }

    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => {
        t.classList.remove('show');
    }, 3200);
}

function getTodayStr() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function getTodayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNowTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function updateClock() {
    const el = document.getElementById('clock-text');
    if (!el) return;
    const now = new Date();
    el.innerText = `${getTodayStr()} ${getNowTimeStr()}:${String(now.getSeconds()).padStart(2, '0')}`;
}
setInterval(updateClock, 1000);

function toggleMobileSidebar() {
    const s = document.getElementById('sidebar');
    if (s) s.classList.toggle('mobile-open');
}

// ==========================================
// 3. AUTHENTICATION & ROLE-BASED ACCESS
// ==========================================

const DEFAULT_AUTH_USERS = [
    { username: 'admin', password: 'admin123', role: 'admin', name: 'Bosh Administrator' },
    { username: 'ishchi', password: '123', role: 'worker', name: 'Ishchi Foydalanuvchi' }
];

function getAuthUsers() {
    const saved = localStorage.getItem('mmir_auth_users');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Error reading mmir_auth_users:", e);
        }
    }
    localStorage.setItem('mmir_auth_users', JSON.stringify(DEFAULT_AUTH_USERS));
    return [...DEFAULT_AUTH_USERS];
}

function saveAuthUsers(users) {
    localStorage.setItem('mmir_auth_users', JSON.stringify(users));
}

function togglePasswordVisibility() {
    const pInput = document.getElementById('auth-password');
    const eyeIcon = document.getElementById('password-eye-icon');
    if (!pInput) return;
    if (pInput.type === 'password') {
        pInput.type = 'text';
        eyeIcon.className = 'fa-solid fa-eye-slash';
    } else {
        pInput.type = 'password';
        eyeIcon.className = 'fa-solid fa-eye';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const u = (document.getElementById('auth-username')?.value || '').trim().toLowerCase();
    const p = (document.getElementById('auth-password')?.value || '').trim();

    const users = getAuthUsers();
    const matched = users.find(user => user.username.toLowerCase() === u && user.password === p);

    if (matched) {
        currentUser = { username: matched.username, role: matched.role, name: matched.name };
        completeLogin();
    } else {
        showNotification("Login yoki parol noto'g'ri! Iltimos, qayta tekshiring.", 'error');
    }
}

function completeLogin() {
    localStorage.setItem('mmir_current_user', JSON.stringify(currentUser));
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';
    
    applyRolePermissions();
    navigate('dashboard');
    showNotification(`Xush kelibsiz, ${currentUser.name}!`, 'success');
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('mmir_current_user');
    document.getElementById('app-layout').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    const uInput = document.getElementById('auth-username');
    const pInput = document.getElementById('auth-password');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    showNotification("Tizimdan muvaffaqiyatli chiqildi!", 'warning');
}

function applyRolePermissions() {
    if (!currentUser) return;
    
    const isAdmin = currentUser.role === 'admin';
    document.body.classList.toggle('role-admin', isAdmin);
    document.body.classList.toggle('role-worker', !isAdmin);

    const badge = document.getElementById('current-user-badge');
    if (badge) {
        badge.innerHTML = isAdmin 
            ? '<i class="fa-solid fa-shield-halved me-1"></i> Administrator' 
            : '<i class="fa-solid fa-user me-1"></i> Ishchi';
        badge.style.backgroundColor = isAdmin ? 'var(--primary)' : 'var(--accent)';
    }

    const nameDisplay = document.getElementById('topbar-user-name');
    const roleDisplay = document.getElementById('topbar-user-role');
    if (nameDisplay) nameDisplay.innerText = currentUser.name;
    if (roleDisplay) roleDisplay.innerText = isAdmin ? 'Administrator' : 'Ishchi';

    // Refresh active section data
    renderDashboard();
    updateRawUI();
    updateProductionUI();
    updateProductsUI();
    updateWorkersUI();
    updateOmborUI();
    updateProfileUI();
}

// ==========================================
// 4. NAVIGATION ENGINE
// ==========================================

const PAGE_TITLES = {
    'dashboard': 'Boshqaruv Paneli & Tahlillar',
    'raw': 'Xomashyo Ombori & Kirim',
    'production': 'Ishlab Chiqarish & Bosqichlar',
    'products': 'Mahsulotlar',
    'home': 'Ishchilar',
    'ombor': 'Ombordagi Barcha Tovarlar Hisoboti',
    'profile': 'Profil',
    'worker-detail': 'Ishchi Shaxsiy Hisob Varaqasi'
};

function navigate(targetId) {
    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.className = 'nav-btn');

    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.classList.add('active');

    const navBtn = document.getElementById('btn-' + targetId);
    if (navBtn) navBtn.classList.add('active-' + targetId);

    const pageTitleEl = document.getElementById('page-title-display');
    if (pageTitleEl) pageTitleEl.innerText = PAGE_TITLES[targetId] || 'MMIR Tizimi';

    if (targetId === 'dashboard') renderDashboard();
    if (targetId === 'raw') updateRawUI();
    if (targetId === 'production') updateProductionUI();
    if (targetId === 'products') updateProductsUI();
    if (targetId === 'home') updateWorkersUI();
    if (targetId === 'ombor') updateOmborUI();
    if (targetId === 'profile') updateProfileUI();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 5. DASHBOARD MODULE
// ==========================================

function renderDashboard() {
    // 1. Warehouse Total Valuation
    let totalWarehouseVal = 0;
    let warehouseCount = 0;
    warehouse.forEach(w => {
        totalWarehouseVal += (Number(w.qty) || 0) * (Number(w.costPrice) || 0);
        warehouseCount += (Number(w.qty) || 0);
    });
    const whValEl = document.getElementById('kpi-warehouse-val');
    const whCountEl = document.getElementById('kpi-warehouse-count');
    if (whValEl) whValEl.innerText = formatMoney(totalWarehouseVal);
    if (whCountEl) whCountEl.innerText = `${warehouse.length} xil (${warehouseCount.toLocaleString()} dona tayyor tovar)`;

    // 2. Raw Materials Total Valuation
    let totalRawVal = 0;
    rawMaterials.forEach(r => {
        totalRawVal += (Number(r.qty) || 0) * (Number(r.unitPrice) || 0);
    });
    const rawValEl = document.getElementById('kpi-raw-val');
    const rawCountEl = document.getElementById('kpi-raw-count');
    if (rawValEl) rawValEl.innerText = formatMoney(totalRawVal);
    if (rawCountEl) rawCountEl.innerText = `${rawMaterials.length} turdagi xomashyo zaxirasi`;

    // 3. Worker Total Liability / Debt
    let totalWorkerPayable = 0;
    workers.forEach(w => {
        let earned = 0;
        (w.tasks || []).forEach(t => earned += (Number(t.total) || 0));
        let exp = 0;
        (w.expenses || []).forEach(e => exp += (Number(e.amount) || 0));
        const net = earned - exp;
        if (net > 0) totalWorkerPayable += net;
    });
    const workerDebtEl = document.getElementById('kpi-workers-debt');
    const workerCountEl = document.getElementById('kpi-workers-count');
    if (workerDebtEl) workerDebtEl.innerText = formatMoney(totalWorkerPayable);
    if (workerCountEl) workerCountEl.innerText = `${workers.length} nafar ishchi oldidagi faol qarz`;

    // 4. Low Stock Count & List
    const lowStockItems = [];
    rawMaterials.forEach(r => {
        if (r.limit && Number(r.qty) <= Number(r.limit)) {
            lowStockItems.push({ type: 'Xomashyo', name: r.name, qty: r.qty, unit: r.unit, limit: r.limit });
        }
    });
    warehouse.forEach(w => {
        if (w.limit && Number(w.qty) <= Number(w.limit)) {
            lowStockItems.push({ type: 'Tayyor Mahsulot', name: w.name, qty: w.qty, unit: w.unit, limit: w.limit });
        }
    });

    const lowStockCountEl = document.getElementById('kpi-low-stock-count');
    const lowStockBadgeEl = document.getElementById('badge-low-stock-summary');
    if (lowStockCountEl) lowStockCountEl.innerText = `${lowStockItems.length} ta`;
    if (lowStockBadgeEl) lowStockBadgeEl.innerText = `${lowStockItems.length} ta kritik tovar`;

    const lowStockListEl = document.getElementById('dashboard-low-stock-list');
    if (lowStockListEl) {
        if (lowStockItems.length === 0) {
            lowStockListEl.innerHTML = `
                <div class="p-4 text-center text-success">
                    <i class="fa-solid fa-circle-check fs-2 mb-2"></i>
                    <p class="m-0 fw-bold">Barcha zaxiralar me'yorida, kam qolgan tovarlar yo'q!</p>
                </div>
            `;
        } else {
            let table = `<table class="table table-hover align-middle mb-0">
                <thead><tr><th>Tur</th><th>Nomi</th><th>Qoldiq</th><th>Chegara</th><th>Holat</th></tr></thead>
                <tbody>`;
            lowStockItems.forEach(item => {
                table += `<tr class="row-low-stock">
                    <td><span class="badge ${item.type === 'Xomashyo' ? 'bg-primary' : 'bg-success'}">${item.type}</span></td>
                    <td class="fw-bold">${item.name}</td>
                    <td class="fw-bold fs-6">${item.qty} ${item.unit}</td>
                    <td>${item.limit} ${item.unit}</td>
                    <td><span class="pulse-badge"><span class="pulse-dot"></span> Kritik kam</span></td>
                </tr>`;
            });
            table += `</tbody></table>`;
            lowStockListEl.innerHTML = table;
        }
    }
}

// ==========================================
// 6. RAW MATERIALS MODULE
// ==========================================

function syncRawUnitLabel() {
    const unit = document.getElementById('raw-unit')?.value || 'metr';
    const label = document.getElementById('raw-unit-price-label');
    if (label) label.innerText = `1 ${unit} narxi:`;
}

function calculateRawTotalCost() {
    const qty = parseFloat(document.getElementById('raw-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('raw-unit-price')?.value) || 0;
    const total = Math.round(qty * price);
    
    const costDisplay = document.getElementById('raw-cost-display');
    const costHidden = document.getElementById('raw-cost');
    if (costDisplay) costDisplay.value = formatMoney(total);
    if (costHidden) costHidden.value = total;
}

function saveRawMaterial(e) {
    e.preventDefault();
    if (currentUser && currentUser.role === 'worker') {
        showNotification("Sizda xomashyo kiritish huquqi yo'q!", 'error');
        return;
    }

    const editId = document.getElementById('editing-raw-id')?.value || '';
    const name = (document.getElementById('raw-name')?.value || '').trim();
    const qty = parseFloat(document.getElementById('raw-qty')?.value) || 0;
    const unit = document.getElementById('raw-unit')?.value || 'metr';
    const unitPrice = parseFloat(document.getElementById('raw-unit-price')?.value) || 0;
    const limit = parseFloat(document.getElementById('raw-limit')?.value) || 0;
    const totalCost = Math.round(qty * unitPrice);

    if (!name) {
        showNotification("Xomashyo nomini kiriting!", 'error');
        return;
    }

    if (editId) {
        const idx = rawMaterials.findIndex(r => r.id === editId);
        if (idx >= 0) {
            rawMaterials[idx].name = name;
            rawMaterials[idx].qty = qty;
            rawMaterials[idx].unit = unit;
            rawMaterials[idx].unitPrice = unitPrice;
            rawMaterials[idx].limit = limit;
            rawMaterials[idx].costPrice = totalCost;
            showNotification(`"${name}" xomashyosi muvaffaqiyatli yangilandi!`, 'success');
        }
    } else {
        const newRaw = {
            id: generateUniqueId('raw'),
            name: name,
            qty: qty,
            unit: unit,
            unitPrice: unitPrice,
            limit: limit,
            costPrice: totalCost
        };
        rawMaterials.unshift(newRaw);
        showNotification(`Yangi xomashyo "${name}" omborga kiritildi!`, 'success');
    }

    saveData();
    cancelRawEdit();
    updateRawUI();
    renderDashboard();
}

function editRawItem(id) {
    if (currentUser && currentUser.role === 'worker') return;
    const item = rawMaterials.find(r => r.id === id);
    if (!item) return;

    document.getElementById('editing-raw-id').value = item.id;
    document.getElementById('raw-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-warning me-2"></i> Xomashyoni Tahrirlash: "${item.name}"`;
    document.getElementById('btn-save-raw').innerHTML = '<i class="fa-solid fa-check me-1"></i> O\'zgarishni saqlash';
    document.getElementById('btn-cancel-raw-edit').style.display = 'inline-flex';

    document.getElementById('raw-name').value = item.name;
    document.getElementById('raw-qty').value = item.qty;
    document.getElementById('raw-unit').value = item.unit || 'metr';
    document.getElementById('raw-unit-price').value = item.unitPrice || 0;
    document.getElementById('raw-limit').value = item.limit || '';

    syncRawUnitLabel();
    calculateRawTotalCost();
    window.scrollTo({ top: 120, behavior: 'smooth' });
}

function cancelRawEdit() {
    document.getElementById('editing-raw-id').value = '';
    document.getElementById('raw-form-title').innerHTML = '<i class="fa-solid fa-layer-group text-primary me-2"></i> Xomashyo Kirim Qilish';
    document.getElementById('btn-save-raw').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Xomashyoni Saqlash';
    document.getElementById('btn-cancel-raw-edit').style.display = 'none';

    document.getElementById('raw-name').value = '';
    document.getElementById('raw-qty').value = '';
    document.getElementById('raw-unit').value = 'metr';
    document.getElementById('raw-unit-price').value = '';
    document.getElementById('raw-limit').value = '';
    document.getElementById('raw-cost').value = '0';
    document.getElementById('raw-cost-display').value = '0 so\'m';

    syncRawUnitLabel();
}

function filterRawTable() {
    const q = (document.getElementById('search-raw-table')?.value || '').toLowerCase().trim();
    const lowOnly = document.getElementById('filter-raw-low-only')?.checked || false;
    const rList = document.getElementById('raw-warehouse-list');
    const badge = document.getElementById('raw-total-count-badge');
    if (!rList) return;

    if (badge) badge.innerText = `${rawMaterials.length} xil`;

    if (rawMaterials.length === 0) {
        rList.innerHTML = '<p class="text-secondary text-center py-4 fst-italic">Hozircha xomashyo kiritilmagan.</p>';
        return;
    }

    let filtered = rawMaterials.filter(item => {
        const matchesQuery = item.name.toLowerCase().includes(q);
        const isLow = item.limit && (Number(item.qty) <= Number(item.limit));
        return matchesQuery && (!lowOnly || isLow);
    });

    if (filtered.length === 0) {
        rList.innerHTML = '<p class="text-secondary text-center py-4">Qidiruv bo\'yicha xomashyo topilmadi.</p>';
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';

    let table = `<table class="table table-bordered table-hover align-middle text-center bg-white">
        <thead><tr>
            <th>Xomashyo Nomi</th><th>Mavjud Miqdor</th><th>Birlik</th>
            <th>1 Birlik Narxi</th><th>Jami Tannarx</th><th>Ogohlantirish</th>
            ${isAdmin ? '<th>Amallar</th>' : ''}
        </tr></thead><tbody>`;

    filtered.forEach(item => {
        const isLow = item.limit && (Number(item.qty) <= Number(item.limit));
        const rowClass = isLow ? 'row-low-stock clickable-row' : 'clickable-row';

        table += `<tr class="${rowClass}">
            <td class="fw-bold text-start ps-3" onclick="openRawDetailsModal('${item.id}')">${item.name}</td>
            <td onclick="openRawDetailsModal('${item.id}')" class="fw-bold fs-6">${Number(item.qty).toLocaleString()}</td>
            <td onclick="openRawDetailsModal('${item.id}')">${item.unit}</td>
            <td onclick="openRawDetailsModal('${item.id}')">${formatMoney(item.unitPrice || 0)}</td>
            <td onclick="openRawDetailsModal('${item.id}')" class="fw-bold text-success">${formatMoney(item.costPrice || 0)}</td>
            <td onclick="openRawDetailsModal('${item.id}')">
                ${isLow 
                    ? `<span class="pulse-badge"><span class="pulse-dot"></span> Kam qoldi (≤${item.limit})</span>` 
                    : (item.limit ? `<span class="badge bg-light text-dark border">≥ ${item.limit} ${item.unit}</span>` : '<span class="text-muted">-</span>')
                }
            </td>
            ${isAdmin ? `
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editRawItem('${item.id}')" title="Tahrirlash">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="requestDeleteRaw('${item.id}')" title="O'chirish">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>` : ''}
        </tr>`;
    });
    table += '</tbody></table>';
    rList.innerHTML = table;
}

function openRawDetailsModal(id) {
    const item = rawMaterials.find(r => r.id === id);
    if (!item) return;

    document.getElementById('modal-details-title').innerHTML = `
        <i class="fa-solid fa-layer-group text-primary me-2"></i> "${item.name}" xomashyosi
    `;
    document.getElementById('modal-details-body').innerHTML = `
        <div class="p-3 bg-light rounded border mb-3">
            <div class="row g-3">
                <div class="col-6">
                    <span class="text-muted small d-block">Xomashyo nomi:</span>
                    <strong class="fs-5 text-dark">${item.name}</strong>
                </div>
                <div class="col-6 text-end">
                    <span class="text-muted small d-block">Ombordagi qoldiq:</span>
                    <strong class="fs-5 text-primary">${item.qty} ${item.unit}</strong>
                </div>
                <div class="col-6">
                    <span class="text-muted small d-block">1 ${item.unit} narxi:</span>
                    <strong class="text-dark">${formatMoney(item.unitPrice || 0)}</strong>
                </div>
                <div class="col-6 text-end">
                    <span class="text-muted small d-block">Jami qiymati:</span>
                    <strong class="fs-5 text-success">${formatMoney(item.costPrice || 0)}</strong>
                </div>
                <div class="col-12 border-top pt-2">
                    <span class="text-muted small d-block">Ogohlantirish chegarasi:</span>
                    <span>${item.limit ? `${item.limit} ${item.unit} dan kam qolganda ogohlantirish beriladi` : 'Chegara belgilanmagan'}</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('details-modal').classList.add('active');
}

function requestDeleteRaw(id) {
    deleteTarget = { type: 'raw', id: id };
    const item = rawMaterials.find(r => r.id === id);
    document.getElementById('confirm-message').innerText = `Haqiqatan ham "${item?.name || 'ushbu'}" xomashyosini ombordan o'chirmoqchimisiz?`;
    document.getElementById('confirm-modal').classList.add('active');
}

function updateRawDatalist() {
    const datalist = document.getElementById('raw-materials-datalist');
    if (!datalist) return;
    datalist.innerHTML = '';
    const uniqueNames = new Set();
    rawMaterials.forEach(r => {
        if (r.name && r.name.trim()) uniqueNames.add(r.name.trim());
    });
    uniqueNames.forEach(name => {
        datalist.innerHTML += `<option value="${name}">`;
    });
}

function updateRawUI() {
    filterRawTable();
    updateRawDatalist();
}

// ==========================================
// 7. PRODUCTION & WORKBENCH ENGINE (WITH BOM INTEGRITY)
// ==========================================

function updateProductionCategoriesDropdown() {
    const sel = document.getElementById('production-cat-select');
    if (!sel) return;
    sel.innerHTML = '<option value="Barchasi">Barcha bo\'limlar</option>';
    categories.forEach(c => {
        sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    sel.value = currentProductionCatFilter;
}

function filterProductionByCat(val) {
    currentProductionCatFilter = val;
    filterProductionTable();
}

function filterProductionTable() {
    const q = (document.getElementById('search-production-table')?.value || '').toLowerCase().trim();
    const pList = document.getElementById('production-list');
    if (!pList) return;

    if (warehouse.length === 0) {
        pList.innerHTML = '<p class="text-secondary text-center py-4 fst-italic">Hozircha mahsulotlar kiritilmagan. Avval "Mahsulotlar" bo\'limidan yangi mahsulot qo\'shing.</p>';
        return;
    }

    let filtered = warehouse.filter(item => {
        const matchesCat = (currentProductionCatFilter === 'Barchasi') || (item.cat === currentProductionCatFilter);
        const matchesQuery = item.name.toLowerCase().includes(q) || (item.cat && item.cat.toLowerCase().includes(q));
        return matchesCat && matchesQuery;
    });

    if (filtered.length === 0) {
        pList.innerHTML = '<p class="text-secondary text-center py-4">Qidiruv bo\'yicha mahsulot topilmadi.</p>';
        return;
    }

    let table = `<table class="table table-bordered table-hover align-middle text-center bg-white">
        <thead><tr>
            <th>Mahsulot Nomi</th><th>Bo'lim</th><th>Ombordagi Qoldiq</th>
            <th>Xomashyo Sarflari (BOM)</th><th>Ish Bosqichlari</th><th>Harakat</th>
        </tr></thead><tbody>`;

    filtered.forEach(item => {
        table += `<tr class="clickable-row" onclick="openProductionWorkbench('${item.id}')">
            <td class="fw-bold text-start ps-3 fs-6">${item.name}</td>
            <td><span class="badge bg-secondary">${item.cat}</span></td>
            <td class="fw-bold text-primary">${item.qty} ${item.unit}</td>
            <td>${(item.consumptions || []).length} ta xomashyo sarfi</td>
            <td>${(item.jobs || []).length} ta amal</td>
            <td>
                <button class="btn btn-sm btn-green px-3" onclick="event.stopPropagation(); openProductionWorkbench('${item.id}')">
                    <i class="fa-solid fa-play me-1"></i> Ishlab chiqarish
                </button>
            </td>
        </tr>`;
    });
    table += '</tbody></table>';
    pList.innerHTML = table;
}

function openProductionWorkbench(productId) {
    activeProductionProductId = productId;
    const item = warehouse.find(w => w.id === productId);
    if (!item) return;

    document.getElementById('workbench-product-name').innerText = item.name;
    document.getElementById('workbench-product-cat').innerText = `Bo'lim: ${item.cat}`;
    document.getElementById('workbench-qty-input').value = 1;

    hideWorkbenchError();
    onWorkbenchTargetQtyChange();

    // Table Header for operations
    const head = document.getElementById('workbench-table-head');
    let headHtml = `<tr><th style="min-width: 190px; text-align: left;">Ishchi ismi</th>`;
    (item.jobs || []).forEach(j => {
        headHtml += `<th>${j.action || 'Amal'}<br><small class="text-muted fw-normal">(${formatMoney(j.price)})</small></th>`;
    });
    headHtml += `<th style="width: 50px;">✕</th></tr>`;
    head.innerHTML = headHtml;

    document.getElementById('workbench-table-body').innerHTML = '';
    addWorkbenchAssignmentRow();

    const bench = document.getElementById('production-workbench');
    bench.style.display = 'block';
    bench.scrollIntoView({ behavior: 'smooth' });
}

function closeProductionWorkbench() {
    document.getElementById('production-workbench').style.display = 'none';
    activeProductionProductId = null;
}

/**
 * Validates whether all BOM raw materials are in stock for target quantity and calculates remaining stock.
 */
function onWorkbenchTargetQtyChange() {
    if (!activeProductionProductId) return;
    const item = warehouse.find(w => w.id === activeProductionProductId);
    if (!item) return;

    const targetQty = parseFloat(document.getElementById('workbench-qty-input')?.value) || 0;
    const container = document.getElementById('workbench-materials-checklist');
    const badge = document.getElementById('workbench-materials-status-badge');
    if (!container) return;

    if (!item.consumptions || item.consumptions.length === 0) {
        container.innerHTML = '<span class="text-muted small fst-italic">Ushbu mahsulot uchun xomashyo sarflari belgilanmagan.</span>';
        if (badge) badge.innerHTML = '<span class="material-status-tag status-ok">Sarflar yo\'q</span>';
        updateWorkbenchTotals();
        return;
    }

    let allAvailable = true;
    let listHtml = '';

    item.consumptions.forEach(c => {
        const singleQty = parseFloat(c.qty) || 0;
        const totalNeeded = singleQty * targetQty;
        const matchedRaw = rawMaterials.find(r => (r.name || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase());
        const availableStock = matchedRaw ? Number(matchedRaw.qty) : 0;
        const remainingStock = availableStock - totalNeeded;
        const isSufficient = remainingStock >= 0;

        if (!isSufficient) allAvailable = false;

        listHtml += `
            <div class="d-flex justify-content-between align-items-center p-2 rounded ${isSufficient ? 'bg-white' : 'bg-danger-subtle'} border flex-wrap gap-2 shadow-xs">
                <div>
                    <strong class="text-dark">${c.name}</strong> 
                    <small class="text-muted">(1 dona uchun: ${singleQty} ${c.unit || ''})</small>
                </div>
                <div class="d-flex align-items-center gap-3 flex-wrap">
                    <span>Talab: <b class="text-dark">${totalNeeded} ${c.unit || ''}</b></span>
                    <span>Omborda bor: <b class="${availableStock > 0 ? 'text-dark' : 'text-danger'}">${availableStock} ${c.unit || ''}</b></span>
                    <span>Qoladi: <b class="${isSufficient ? 'text-success' : 'text-danger'}">${remainingStock >= 0 ? remainingStock : 0} ${c.unit || ''}</b></span>
                    <span class="material-status-tag ${isSufficient ? 'status-ok' : 'status-missing'}">
                        ${isSufficient ? '✓ Yetarli' : `✗ Yetishmaydi (${Math.abs(remainingStock).toFixed(1)} ${c.unit || ''})`}
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = listHtml;
    if (badge) {
        badge.innerHTML = allAvailable 
            ? '<span class="material-status-tag status-ok"><i class="fa-solid fa-check me-1"></i> Barcha xomashyo omborda mavjud</span>'
            : '<span class="material-status-tag status-missing"><i class="fa-solid fa-triangle-exclamation me-1"></i> Yetarli xomashyo yo\'q!</span>';
    }

    updateWorkbenchTotals();
}

function addWorkbenchAssignmentRow() {
    if (!activeProductionProductId) return;
    const item = warehouse.find(w => w.id === activeProductionProductId);
    if (!item) return;
    const tbody = document.getElementById('workbench-table-body');
    if (!tbody) return;

    let tr = document.createElement('tr');
    let options = '<option value="" disabled selected>Ishchini tanlang</option>';
    workers.forEach(w => {
        options += `<option value="${w.name}">${w.name} (${w.type || 'Oddiy'})</option>`;
    });

    let rowHtml = `<td style="text-align: left;"><select class="form-select form-select-sm wb-worker-select">${options}</select></td>`;
    (item.jobs || []).forEach(() => {
        rowHtml += `<td><input type="number" class="form-control form-control-sm text-center wb-job-qty-input" min="0" value="" placeholder="" onfocus="if(this.value==='0') this.value=''" oninput="updateWorkbenchTotals()"></td>`;
    });
    rowHtml += `<td><button class="btn btn-sm btn-outline-danger" onclick="removeWorkbenchRow(this)">✕</button></td>`;
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);

    updateWorkbenchTotals();
}

function removeWorkbenchRow(btn) {
    btn.closest('tr')?.remove();
    updateWorkbenchTotals();
}

/**
 * Calculates and updates operation total counts in the footer of workbench table:
 * If sum < targetQty: Red with (kam)
 * If sum === targetQty: Green without parentheses
 * If sum > targetQty: Blue with (ko'p)
 */
function updateWorkbenchTotals() {
    if (!activeProductionProductId) return;
    const item = warehouse.find(w => w.id === activeProductionProductId);
    if (!item) return;

    const targetQty = parseFloat(document.getElementById('workbench-qty-input')?.value) || 0;
    const jobsCount = (item.jobs || []).length;
    const rows = document.querySelectorAll('#workbench-table-body tr');

    let totalsPerJob = new Array(jobsCount).fill(0);
    rows.forEach(r => {
        const qtyInputs = r.querySelectorAll('.wb-job-qty-input');
        qtyInputs.forEach((input, jIdx) => {
            const count = parseFloat(input.value) || 0;
            totalsPerJob[jIdx] += count;
        });
    });

    const tfoot = document.getElementById('workbench-table-foot');
    if (!tfoot) return;

    let footHtml = `<tr class="table-light fw-bold" style="border-top: 2px solid #cbd5e1;">`;
    footHtml += `<td class="text-start ps-3 fw-bold text-dark">Jami:</td>`;

    for (let j = 0; j < jobsCount; j++) {
        const sum = totalsPerJob[j];
        let colorClass = '';
        let labelText = '';

        if (sum < targetQty) {
            colorClass = 'text-danger fw-bold';
            labelText = `${sum}/${targetQty} ta (kam)`;
        } else if (sum === targetQty) {
            colorClass = 'text-success fw-bold';
            labelText = `${sum}/${targetQty} ta`;
        } else {
            colorClass = 'text-primary fw-bold';
            labelText = `${sum}/${targetQty} ta (ko'p)`;
        }

        footHtml += `<td><span class="${colorClass} fs-6">${labelText}</span></td>`;
    }

    footHtml += `<td></td></tr>`;
    tfoot.innerHTML = footHtml;
}

function showWorkbenchError(text) {
    const box = document.getElementById('workbench-error-box');
    const txt = document.getElementById('workbench-error-text');
    if (!box || !txt) return;
    txt.innerText = text;
    box.style.display = 'flex';
}

function hideWorkbenchError() {
    const box = document.getElementById('workbench-error-box');
    if (box) box.style.display = 'none';
}

/**
 * Confirms production:
 * 1. Checks and DEDUCTS raw materials from stock.
 * 2. INCREASES warehouse product quantity.
 * 3. CREDITS worker earnings for operations completed.
 * 4. LOGS detailed batch history.
 */
function saveWorkbenchProgress() {
    if (!activeProductionProductId) return;
    const item = warehouse.find(w => w.id === activeProductionProductId);
    if (!item) return;

    const targetQty = parseFloat(document.getElementById('workbench-qty-input')?.value) || 0;
    const jobsCount = (item.jobs || []).length;

    if (targetQty <= 0) {
        showWorkbenchError("Iltimos, ishlab chiqariladigan miqdorni 0 dan katta kiriting!");
        return;
    }

    // Material availability check
    let missingMaterials = [];
    (item.consumptions || []).forEach(c => {
        const totalNeeded = (parseFloat(c.qty) || 0) * targetQty;
        const matchedRaw = rawMaterials.find(r => (r.name || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase());
        const available = matchedRaw ? Number(matchedRaw.qty) : 0;
        if (available < totalNeeded) {
            missingMaterials.push(`${c.name} (kerak: ${totalNeeded}, omborda: ${available})`);
        }
    });

    if (missingMaterials.length > 0) {
        showWorkbenchError(`Ishlab chiqarish uchun xomashyo yetarli emas:\n${missingMaterials.join('; ')}`);
        return;
    }

    const rows = document.querySelectorAll('#workbench-table-body tr');
    if (rows.length === 0) {
        showWorkbenchError("Iltimos, kamida bitta ishchi biriktiring!");
        return;
    }

    let totalsPerJob = new Array(jobsCount).fill(0);
    let workerAssignments = [];

    for (let r of rows) {
        const workerSelect = r.querySelector('.wb-worker-select');
        const workerName = workerSelect?.value;
        if (!workerName) {
            showWorkbenchError("Barcha qatorlarda ishchi tanlangan bo'lishi shart!");
            return;
        }

        const qtyInputs = r.querySelectorAll('.wb-job-qty-input');
        qtyInputs.forEach((input, jIdx) => {
            const count = parseFloat(input.value) || 0;
            totalsPerJob[jIdx] += count;
            if (count > 0) {
                const jobDef = item.jobs[jIdx];
                workerAssignments.push({
                    workerName: workerName,
                    action: jobDef.action,
                    price: jobDef.price,
                    qty: count,
                    total: count * jobDef.price
                });
            }
        });
    }

    // Validate operation allocation sums
    for (let j = 0; j < jobsCount; j++) {
        const jobName = item.jobs[j].action || `Amal ${j+1}`;
        const sum = totalsPerJob[j];
        if (sum > targetQty) {
            showWorkbenchError(`Xatolik: "${jobName}" amalida ishchilar bajargan jami miqdor (${sum}) rejadagi miqdordan (${targetQty}) oshib ketdi!`);
            return;
        }
        if (sum < targetQty) {
            showWorkbenchError(`Diqqat: "${jobName}" amalida ish to'liq taqsimlanmadi (${sum}/${targetQty})!`);
            return;
        }
    }

    // --- 1. DEDUCT RAW MATERIALS FROM INVENTORY ---
    const consumedMaterialsLog = [];
    (item.consumptions || []).forEach(c => {
        const totalNeeded = (parseFloat(c.qty) || 0) * targetQty;
        const matchedRaw = rawMaterials.find(r => (r.name || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase());
        if (matchedRaw) {
            matchedRaw.qty = Math.max(0, Number(matchedRaw.qty) - totalNeeded);
            matchedRaw.costPrice = Math.round(Number(matchedRaw.qty) * Number(matchedRaw.unitPrice || 0));
            consumedMaterialsLog.push({
                rawId: matchedRaw.id,
                name: matchedRaw.name,
                qty: totalNeeded,
                unit: matchedRaw.unit
            });
        }
    });

    // --- 2. CREDIT WORKERS WITH TASKS ---
    workerAssignments.forEach(asgn => {
        const w = workers.find(wr => wr.name === asgn.workerName);
        if (w) {
            if (!w.tasks) w.tasks = [];
            w.tasks.push({
                id: generateUniqueId('task'),
                date: getTodayStr(),
                productName: item.name,
                action: asgn.action,
                qty: asgn.qty,
                price: asgn.price,
                total: asgn.total
            });
        }
    });

    // --- 3. INCREASE WAREHOUSE FINISHED GOODS ---
    item.qty = (Number(item.qty) || 0) + targetQty;

    // --- 4. LOG PRODUCTION HISTORY BATCH ---
    const batchId = generateUniqueId('batch');
    productionHistory.unshift({
        id: batchId,
        isoDate: getTodayIso(),
        dateStr: getTodayStr(),
        timeStr: getNowTimeStr(),
        productId: item.id,
        productName: item.name,
        category: item.cat,
        totalQty: targetQty,
        consumedMaterials: consumedMaterialsLog,
        assignments: workerAssignments
    });

    saveData();
    hideWorkbenchError();
    closeProductionWorkbench();
    
    // Refresh all affected views
    renderProductionHistoryList();
    filterWarehouseTable();
    updateRawUI();
    updateOmborUI();
    renderDashboard();

    showNotification(`Muvaffaqiyatli: ${targetQty} dona "${item.name}" ishlab chiqarildi, xomashyo ombordan yechildi va ishchilar hisobiga yozildi!`, 'success');
}

function renderProductionHistoryList() {
    const container = document.getElementById('production-history-list');
    if (!container) return;
    container.innerHTML = '';

    if (productionHistory.length === 0) {
        container.innerHTML = '<p class="text-secondary fst-italic text-center py-4">Bajarilgan ishlab chiqarishlar tarixi bo\'sh.</p>';
        return;
    }

    const fromDate = document.getElementById('filter-prod-date-from')?.value;
    const toDate = document.getElementById('filter-prod-date-to')?.value;

    let filtered = productionHistory.filter(h => {
        if (!h.isoDate) return true;
        if (fromDate && h.isoDate < fromDate) return false;
        if (toDate && h.isoDate > toDate) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-secondary fst-italic text-center py-4">Tanlangan sanalarda ishlab chiqarish topilmadi.</p>';
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';

    filtered.forEach(batch => {
        // Group assignments by worker to present a clean, professional table
        const workerMap = {};
        (batch.assignments || []).forEach(a => {
            if (!workerMap[a.workerName]) {
                workerMap[a.workerName] = {
                    name: a.workerName,
                    tasks: [],
                    totalQty: 0,
                    totalPay: 0
                };
            }
            workerMap[a.workerName].tasks.push(`${a.action} (${a.qty} ta)`);
            workerMap[a.workerName].totalQty += (Number(a.qty) || 0);
            workerMap[a.workerName].totalPay += (Number(a.total) || 0);
        });
        const groupedWorkers = Object.values(workerMap);

        let consumedHtml = '';
        if (batch.consumedMaterials && batch.consumedMaterials.length > 0) {
            consumedHtml = `
                <div class="small text-muted bg-light p-2 rounded border mt-2 d-flex align-items-center flex-wrap gap-2">
                    <span class="fw-bold text-dark me-1"><i class="fa-solid fa-boxes-stacked text-primary me-1"></i> Sarflangan xomashyo:</span>
                    ${batch.consumedMaterials.map(cm => `<span class="badge bg-white text-dark border shadow-xs">${cm.name}: <b>${cm.qty} ${cm.unit}</b></span>`).join('')}
                </div>
            `;
        }

        container.innerHTML += `
            <div class="custom-card p-3 mb-3 border shadow-sm">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 border-bottom pb-2 mb-2">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <span class="badge bg-dark px-2 py-1"><i class="fa-regular fa-clock me-1"></i> ${batch.dateStr} ${batch.timeStr || ''}</span>
                        <strong class="fs-5 text-dark">${batch.productName}</strong>
                        <span class="badge bg-secondary">${batch.category}</span>
                        <span class="badge bg-success fs-6 px-3 py-1">+${batch.totalQty} dona tayyorlandi</span>
                    </div>
                    ${isAdmin ? `
                    <button class="btn btn-sm btn-outline-danger fw-bold" onclick="requestDeleteProductionBatch('${batch.id}')" title="Ushbu yozuvni bekor qilish">
                        <i class="fa-solid fa-trash me-1"></i> Bekor qilish
                    </button>` : ''}
                </div>

                <!-- Ishchilar va bajarilgan ishlar jadvali -->
                <div class="table-responsive my-2">
                    <table class="table table-sm table-bordered align-middle text-center bg-white mb-0" style="font-size: 0.92rem;">
                        <thead class="table-light">
                            <tr>
                                <th style="width: 30%; text-align: left;" class="ps-3">Ishchi ismi</th>
                                <th style="text-align: left;" class="ps-3">Qilgan ishlari (Bosqich va miqdori)</th>
                                <th style="width: 15%;">Jami dona</th>
                                <th style="width: 20%;">Hisoblangan haq</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groupedWorkers.map(gw => `
                                <tr>
                                    <td class="text-start ps-3 fw-bold text-dark">
                                        <i class="fa-solid fa-user me-1 text-secondary"></i> ${gw.name}
                                    </td>
                                    <td class="text-start ps-3">
                                        ${gw.tasks.map(t => `<span class="badge bg-light text-dark border me-1 my-1">${t}</span>`).join('')}
                                    </td>
                                    <td class="fw-bold text-primary">${gw.totalQty} ta</td>
                                    <td class="fw-bold text-success">${formatMoney(gw.totalPay)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                ${consumedHtml}
            </div>
        `;
    });
}

function resetProdDateFilter() {
    const dFrom = document.getElementById('filter-prod-date-from');
    const dTo = document.getElementById('filter-prod-date-to');
    if (dFrom) dFrom.value = '';
    if (dTo) dTo.value = '';
    renderProductionHistoryList();
}

function requestDeleteProductionBatch(batchId) {
    deleteTarget = { type: 'production_batch', id: batchId };
    document.getElementById('confirm-message').innerText = "Bu ishlab chiqarish yozuvini bekor qilmoqchimisiz? (Sarflangan xomashyo omborga qaytariladi va tayyor mahsulot ayiriladi)";
    document.getElementById('confirm-modal').classList.add('active');
}

function revertProductionBatch(batchId) {
    const idx = productionHistory.findIndex(h => h.id === batchId);
    if (idx < 0) return;
    const batch = productionHistory[idx];

    // 1. Re-add consumed raw materials back to inventory
    if (batch.consumedMaterials) {
        batch.consumedMaterials.forEach(cm => {
            const raw = rawMaterials.find(r => r.id === cm.rawId || (r.name || '').toLowerCase() === cm.name.toLowerCase());
            if (raw) {
                raw.qty = Number(raw.qty) + Number(cm.qty);
                raw.costPrice = Math.round(Number(raw.qty) * Number(raw.unitPrice || 0));
            }
        });
    }

    // 2. Deduct finished goods from warehouse
    const prod = warehouse.find(w => w.id === batch.productId || w.name === batch.productName);
    if (prod) {
        prod.qty = Math.max(0, Number(prod.qty) - Number(batch.totalQty));
    }

    // 3. Remove batch from history
    productionHistory.splice(idx, 1);
    saveData();

    renderProductionHistoryList();
    filterWarehouseTable();
    updateRawUI();
    updateOmborUI();
    renderDashboard();
    showNotification("Ishlab chiqarish yozuvi bekor qilindi va xomashyo omborga qaytarildi!", 'warning');
}

function updateProductionUI() {
    updateProductionCategoriesDropdown();
    filterProductionTable();
    renderProductionHistoryList();
}

// ==========================================
// 8. PRODUCTS & DYNAMIC BOM (BILL OF MATERIALS)
// ==========================================

function switchOmborTab(tabId, btn) {
    document.querySelectorAll('.ombor-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ombor-content').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const target = document.getElementById('tab-' + tabId);
    if (target) target.classList.add('active');
}

/**
 * Adds a new dynamic BOM material consumption row
 */
function addDynamicConsumptionRow(initialData = null) {
    const container = document.getElementById('consumption-rows-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'bom-row';

    const nameVal = initialData?.name || '';
    const qtyVal = initialData?.qty || '';
    const unitVal = initialData?.unit || 'metr';
    const priceVal = initialData?.price || 0;
    const totalRowVal = initialData?.totalRow || 0;

    row.innerHTML = `
        <span class="text-muted fw-bold row-index-label" style="width: 24px;">•</span>
        <input type="text" list="raw-materials-datalist" class="form-control form-control-sm consumption-name-input flex-grow-1" placeholder="Xomashyo nomi" value="${nameVal}" oninput="autoMatchDynamicRaw(this)">
        <input type="number" class="form-control form-control-sm consumption-qty-input" placeholder="Miqdori" min="0" step="any" style="max-width: 110px;" value="${qtyVal}" oninput="autoMatchDynamicRaw(this)">
        <select class="form-select form-select-sm consumption-unit-select" style="max-width: 100px;">
            <option value="metr" ${unitVal === 'metr' ? 'selected' : ''}>Metr</option>
            <option value="dona" ${unitVal === 'dona' ? 'selected' : ''}>Dona</option>
            <option value="kg" ${unitVal === 'kg' ? 'selected' : ''}>Kg</option>
            <option value="kv" ${unitVal === 'kv' ? 'selected' : ''}>Kv.m</option>
            <option value="tonna" ${unitVal === 'tonna' ? 'selected' : ''}>Tonna</option>
        </select>
        <input type="hidden" class="consumption-unit-price" value="${priceVal}">
        <input type="text" class="form-control form-control-sm consumption-price-input" placeholder="Narxi" readonly style="max-width: 160px; font-weight: bold; color: var(--accent);" value="${totalRowVal ? formatMoney(totalRowVal) : '0 so\'m'}">
        <button type="button" class="btn-remove-row" onclick="removeDynamicRow(this)" title="O'chirish">✕</button>
    `;
    container.appendChild(row);
    renumberRows();
}

/**
 * Adds a new dynamic operation/job row
 */
function addDynamicJobRow(initialData = null) {
    const container = document.getElementById('job-rows-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'job-row';

    const actionVal = initialData?.action || '';
    const priceVal = initialData?.price || '';

    row.innerHTML = `
        <span class="text-muted fw-bold row-index-label" style="width: 24px;">•</span>
        <input type="text" class="form-control form-control-sm job-action-input flex-grow-1" placeholder="Ish turi" value="${actionVal}">
        <input type="number" class="form-control form-control-sm job-labor-input" placeholder="Ish haqqi (so'mda)" min="0" style="max-width: 180px;" value="${priceVal}" oninput="calculateTotalCost()">
        <button type="button" class="btn-remove-row" onclick="removeDynamicRow(this)" title="O'chirish">✕</button>
    `;
    container.appendChild(row);
    renumberRows();
}

function removeDynamicRow(btn) {
    btn.closest('.bom-row, .job-row')?.remove();
    renumberRows();
    calculateTotalCost();
}

function renumberRows() {
    document.querySelectorAll('#consumption-rows-container .bom-row').forEach((r, idx) => {
        const lbl = r.querySelector('.row-index-label');
        if (lbl) lbl.innerText = `${idx + 1}.`;
    });
    document.querySelectorAll('#job-rows-container .job-row').forEach((r, idx) => {
        const lbl = r.querySelector('.row-index-label');
        if (lbl) lbl.innerText = `${idx + 1}.`;
    });
}

function autoMatchDynamicRaw(inputEl) {
    const row = inputEl.closest('.bom-row');
    if (!row) return;

    const nameInput = row.querySelector('.consumption-name-input');
    const qtyInput = row.querySelector('.consumption-qty-input');
    const unitSelect = row.querySelector('.consumption-unit-select');
    const unitPriceHidden = row.querySelector('.consumption-unit-price');
    const displayInput = row.querySelector('.consumption-price-input');

    const enteredName = (nameInput?.value || '').trim().toLowerCase();
    const qty = parseFloat(qtyInput?.value) || 0;

    const matchedRaw = rawMaterials.find(r => (r.name || '').trim().toLowerCase() === enteredName);

    if (matchedRaw) {
        const singlePrice = Number(matchedRaw.unitPrice) || 0;
        if (unitPriceHidden) unitPriceHidden.value = singlePrice;
        if (unitSelect && matchedRaw.unit) unitSelect.value = matchedRaw.unit;

        const totalRow = Math.round(qty * singlePrice);
        if (displayInput) displayInput.value = formatMoney(totalRow);
        row._totalRawCost = totalRow;
    } else {
        if (unitPriceHidden) unitPriceHidden.value = 0;
        if (displayInput) displayInput.value = '0 so\'m';
        row._totalRawCost = 0;
    }
    calculateTotalCost();
}

function calculateTotalCost() {
    let total = 0;

    // Sum BOM consumptions
    document.querySelectorAll('#consumption-rows-container .bom-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.consumption-qty-input')?.value) || 0;
        const price = parseFloat(row.querySelector('.consumption-unit-price')?.value) || 0;
        total += Math.round(qty * price);
    });

    // Sum Job Labor
    document.querySelectorAll('#job-rows-container .job-row').forEach(row => {
        const labor = parseFloat(row.querySelector('.job-labor-input')?.value) || 0;
        total += labor;
    });

    const costDisplay = document.getElementById('w-cost-display');
    const costHidden = document.getElementById('w-cost');
    if (costDisplay) costDisplay.value = formatMoney(total);
    if (costHidden) costHidden.value = total;
}

function saveProductItem(e) {
    e.preventDefault();
    if (currentUser && currentUser.role === 'worker') return;

    const editId = document.getElementById('editing-product-id')?.value || '';
    const cat = document.getElementById('w-cat')?.value || '';
    const name = (document.getElementById('w-name')?.value || '').trim();
    const qty = parseFloat(document.getElementById('w-qty')?.value) || 0;
    const unit = document.getElementById('w-unit')?.value || 'dona';
    const limit = parseFloat(document.getElementById('w-limit')?.value) || 0;

    if (!cat || !name) {
        showNotification("Iltimos, bo'lim va mahsulot nomini to'liq kiriting!", 'error');
        return;
    }

    // Collect Dynamic Consumptions
    const consumptions = [];
    document.querySelectorAll('#consumption-rows-container .bom-row').forEach(row => {
        const cName = (row.querySelector('.consumption-name-input')?.value || '').trim();
        const cQty = parseFloat(row.querySelector('.consumption-qty-input')?.value) || 0;
        const cUnit = row.querySelector('.consumption-unit-select')?.value || 'metr';
        const cPrice = parseFloat(row.querySelector('.consumption-unit-price')?.value) || 0;
        const cTotal = Math.round(cQty * cPrice);

        if (cName) {
            consumptions.push({ name: cName, qty: cQty, unit: cUnit, price: cPrice, totalRow: cTotal });
        }
    });

    // Collect Dynamic Jobs
    const jobs = [];
    document.querySelectorAll('#job-rows-container .job-row').forEach(row => {
        const jAction = (row.querySelector('.job-action-input')?.value || '').trim();
        const jPrice = parseFloat(row.querySelector('.job-labor-input')?.value) || 0;
        if (jAction || jPrice > 0) {
            jobs.push({ action: jAction, price: jPrice });
        }
    });

    const costTotal = parseFloat(document.getElementById('w-cost')?.value) || 0;

    if (editId) {
        const idx = warehouse.findIndex(w => w.id === editId);
        if (idx >= 0) {
            warehouse[idx].cat = cat;
            warehouse[idx].name = name;
            warehouse[idx].qty = qty;
            warehouse[idx].unit = unit;
            warehouse[idx].limit = limit;
            warehouse[idx].consumptions = consumptions;
            warehouse[idx].jobs = jobs;
            warehouse[idx].costPrice = costTotal;
            showNotification(`"${name}" mahsuloti me'yorlari yangilandi!`, 'success');
        }
    } else {
        const newProd = {
            id: generateUniqueId('prod'),
            cat: cat,
            name: name,
            qty: qty,
            unit: unit,
            limit: limit,
            consumptions: consumptions,
            jobs: jobs,
            costPrice: costTotal
        };
        warehouse.unshift(newProd);
        showNotification(`Yangi mahsulot "${name}" ombor me'yorlariga qo'shildi!`, 'success');
    }

    saveData();
    cancelProductEdit();
    updateProductsUI();
    updateProductionUI();
    updateOmborUI();
    renderDashboard();
}

function editWarehouseItem(id) {
    if (currentUser && currentUser.role === 'worker') return;
    const item = warehouse.find(w => w.id === id);
    if (!item) return;

    document.getElementById('editing-product-id').value = item.id;
    document.getElementById('product-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-warning me-2"></i> Mahsulotni Tahrirlash: "${item.name}"`;
    document.getElementById('btn-save-product').innerHTML = '<i class="fa-solid fa-check me-1"></i> O\'zgarishni saqlash';
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';

    document.getElementById('w-cat').value = item.cat || '';
    document.getElementById('w-name').value = item.name || '';
    document.getElementById('w-qty').value = item.qty || 0;
    document.getElementById('w-unit').value = item.unit || 'dona';
    document.getElementById('w-limit').value = item.limit || '';

    // Render Consumptions
    const consContainer = document.getElementById('consumption-rows-container');
    if (consContainer) consContainer.innerHTML = '';
    if (item.consumptions && item.consumptions.length > 0) {
        item.consumptions.forEach(c => addDynamicConsumptionRow(c));
    } else {
        addDynamicConsumptionRow();
    }

    // Render Jobs
    const jobContainer = document.getElementById('job-rows-container');
    if (jobContainer) jobContainer.innerHTML = '';
    if (item.jobs && item.jobs.length > 0) {
        item.jobs.forEach(j => addDynamicJobRow(j));
    } else {
        addDynamicJobRow();
    }

    calculateTotalCost();
    window.scrollTo({ top: 100, behavior: 'smooth' });
}

function cancelProductEdit() {
    document.getElementById('editing-product-id').value = '';
    document.getElementById('product-form-title').innerHTML = '<i class="fa-solid fa-circle-plus text-primary me-1"></i> Mahsulot Me\'yorlarini Kiritish (Kalkulyatsiya)';
    document.getElementById('btn-save-product').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Mahsulotni Saqlash';
    document.getElementById('btn-cancel-edit').style.display = 'none';

    document.getElementById('w-cat').value = '';
    document.getElementById('w-name').value = '';
    document.getElementById('w-qty').value = '0';
    document.getElementById('w-unit').value = 'dona';
    document.getElementById('w-limit').value = '';
    document.getElementById('w-cost').value = '0';
    document.getElementById('w-cost-display').value = '0 so\'m';

    const consContainer = document.getElementById('consumption-rows-container');
    const jobContainer = document.getElementById('job-rows-container');
    if (consContainer) consContainer.innerHTML = '';
    if (jobContainer) jobContainer.innerHTML = '';

    addDynamicConsumptionRow();
    addDynamicJobRow();
}

function filterWarehouseTable() {
    const q = (document.getElementById('search-warehouse-table')?.value || '').toLowerCase().trim();
    const wList = document.getElementById('warehouse-list');
    if (!wList) return;

    if (warehouse.length === 0) {
        const isAdmin = currentUser && currentUser.role === 'admin';
        wList.innerHTML = `<p class="text-secondary text-center py-4 fst-italic">Ombor bo'sh.${isAdmin ? " Yuqoridagi formadan mahsulot kirim qiling." : " Mahsulotlar mavjud emas."}</p>`;
        return;
    }

    let filtered = warehouse.filter(item => item.name.toLowerCase().includes(q) || (item.cat && item.cat.toLowerCase().includes(q)));

    if (filtered.length === 0) {
        wList.innerHTML = '<p class="text-secondary text-center py-4">Qidiruv bo\'yicha mahsulot topilmadi.</p>';
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';

    let table = `<table class="table table-bordered table-hover align-middle text-center bg-white">
        <thead><tr>
            <th>Bo'lim</th><th>Mahsulot Nomi</th><th>Mavjud Qoldiq</th><th>O'lchov</th>
            <th>Xomashyo Sarflari</th><th>Ish Turlari</th><th>Tan Narxi</th>
            ${isAdmin ? '<th>Amallar</th>' : ''}
        </tr></thead><tbody>`;

    filtered.forEach(item => {
        const isLow = item.limit && (Number(item.qty) <= Number(item.limit));
        const rowClass = isLow ? 'row-low-stock clickable-row' : 'clickable-row';

        table += `<tr class="${rowClass}">
            <td onclick="openProductDetailsModalById('${item.id}')"><span class="badge bg-secondary">${item.cat}</span></td>
            <td onclick="openProductDetailsModalById('${item.id}')" class="fw-bold text-start ps-3 fs-6">${item.name}</td>
            <td onclick="openProductDetailsModalById('${item.id}')" class="fw-bold text-primary">${item.qty}</td>
            <td onclick="openProductDetailsModalById('${item.id}')">${item.unit}</td>
            <td onclick="openProductDetailsModalById('${item.id}')">${(item.consumptions || []).length} ta sarf</td>
            <td onclick="openProductDetailsModalById('${item.id}')">${(item.jobs || []).length} ta amal</td>
            <td onclick="openProductDetailsModalById('${item.id}')" class="fw-bold text-danger">${formatMoney(item.costPrice || 0)}</td>
            ${isAdmin ? `
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editWarehouseItem('${item.id}')" title="Tahrirlash">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="requestDeleteWarehouseItem('${item.id}')" title="O'chirish">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>` : ''}
        </tr>`;
    });
    table += '</tbody></table>';
    wList.innerHTML = table;
}

function openProductDetailsModalById(id) {
    const item = warehouse.find(w => w.id === id);
    if (!item) return;

    document.getElementById('modal-details-title').innerHTML = `
        <i class="fa-solid fa-dolly text-primary me-2"></i> "${item.name}" — Me'yorlar va Kalkulyatsiya
    `;

    let html = `
        <div class="d-flex justify-content-between align-items-center mb-4 p-3 bg-light rounded border flex-wrap gap-2">
            <div>
                <span class="badge bg-secondary fs-6 mb-1">${item.cat}</span>
                <h4 class="fw-bold text-dark m-0">${item.name}</h4>
            </div>
            <div class="text-end">
                <span class="text-primary fw-bold fs-5 d-block">Qoldiq: ${item.qty} ${item.unit}</span>
                <span class="text-danger fw-bold fs-4">Tan narx: ${formatMoney(item.costPrice || 0)}</span>
            </div>
        </div>

        <h6 class="fw-bold text-primary mb-2"><i class="fa-solid fa-boxes-packing me-1"></i> Mahsulot sarflari (1 dona uchun):</h6>
    `;

    if (!item.consumptions || item.consumptions.length === 0) {
        html += `<p class="text-secondary fst-italic mb-3">Xomashyo sarflari belgilanmagan.</p>`;
    } else {
        html += `<table class="table table-bordered text-center align-middle mb-4 bg-white">
            <thead><tr><th>№</th><th class="text-start">Sarf nomi</th><th>Miqdori va Birligi</th><th>1 birlik narxi</th><th>Jami narxi</th></tr></thead>
            <tbody>`;
        item.consumptions.forEach((c, idx) => {
            const rowTotal = c.totalRow !== undefined ? c.totalRow : Math.round((Number(c.qty) || 0) * (Number(c.price) || 0));
            html += `<tr>
                <td>${idx + 1}</td>
                <td class="text-start fw-bold">${c.name}</td>
                <td class="fw-bold text-primary">${c.qty} ${c.unit}</td>
                <td>${formatMoney(c.price || 0)}</td>
                <td class="fw-bold text-danger">${formatMoney(rowTotal)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    }

    html += `<h6 class="fw-bold text-success mb-2"><i class="fa-solid fa-screwdriver-wrench me-1"></i> Ish turlari va Narxlar:</h6>`;

    if (!item.jobs || item.jobs.length === 0) {
        html += `<p class="text-secondary fst-italic mb-3">Ish turlari belgilanmagan.</p>`;
    } else {
        html += `<table class="table table-bordered text-center align-middle mb-3 bg-white">
            <thead><tr><th>№</th><th class="text-start">Amal (Ish turi)</th><th>Belgilangan Ish haqqi</th></tr></thead>
            <tbody>`;
        item.jobs.forEach((j, idx) => {
            html += `<tr>
                <td>${idx + 1}</td>
                <td class="text-start fw-bold">${j.action}</td>
                <td class="fw-bold text-success">${formatMoney(j.price || 0)}</td>
            </tr>`;
        });
        html += `<tr class="table-warning fw-bold">
            <td colspan="2" class="text-end">Jami mahsulot tan narxi:</td>
            <td class="text-danger fs-5">${formatMoney(item.costPrice || 0)}</td>
        </tr></tbody></table>`;
    }

    document.getElementById('modal-details-body').innerHTML = html;
    document.getElementById('details-modal').classList.add('active');
}

function requestDeleteWarehouseItem(id) {
    deleteTarget = { type: 'warehouse', id: id };
    const item = warehouse.find(w => w.id === id);
    document.getElementById('confirm-message').innerText = `Haqiqatan ham "${item?.name || 'ushbu'}" mahsulotini ombordan o'chirmoqchimisiz?`;
    document.getElementById('confirm-modal').classList.add('active');
}

// Categories Management
function addCategory(e) {
    e.preventDefault();
    if (currentUser && currentUser.role === 'worker') return;
    const catInput = document.getElementById('cat-name');
    const val = (catInput?.value || '').trim();
    if (!val) return;

    categories.push({ id: generateUniqueId('cat'), name: val });
    saveData();
    updateProductsUI();
    updateProductionUI();
    updateOmborUI();
    if (catInput) catInput.value = '';
    showNotification(`"${val}" bo'limi yaratildi!`, 'success');
}

function filterCategoriesList() {
    const q = (document.getElementById('search-category-input')?.value || '').toLowerCase().trim();
    const cList = document.getElementById('categories-list');
    if (!cList) return;
    cList.innerHTML = '';
    const filtered = categories.filter(c => c.name.toLowerCase().includes(q));

    filtered.forEach(c => {
        cList.innerHTML += `
            <div class="p-3 bg-light border mb-2 rounded d-flex justify-content-between align-items-center">
                <span class="fw-bold fs-6 text-dark"><i class="fa-solid fa-folder me-2 text-warning"></i> ${c.name}</span>
                <button class="btn btn-sm btn-outline-danger fw-bold admin-only" onclick="requestDeleteCategory('${c.id}')">
                    <i class="fa-solid fa-trash me-1"></i> O'chirish
                </button>
            </div>
        `;
    });
}

function requestDeleteCategory(id) {
    deleteTarget = { type: 'category', id: id };
    const cat = categories.find(c => c.id === id);
    document.getElementById('confirm-message').innerText = `"${cat?.name || 'Ushbu'}" bo'limini o'chirasizmi?`;
    document.getElementById('confirm-modal').classList.add('active');
}

function updateProductsUI() {
    if (currentUser && currentUser.role === 'worker') {
        const xomashyoTab = document.getElementById('tab-xomashyo');
        const bolimlarTab = document.getElementById('tab-bolimlar');
        if (xomashyoTab) xomashyoTab.classList.add('active');
        if (bolimlarTab) bolimlarTab.classList.remove('active');
    }
    const wSelect = document.getElementById('w-cat');
    if (wSelect) {
        wSelect.innerHTML = '<option value="" disabled selected>Bo\'limni tanlang</option>';
        categories.forEach(c => {
            wSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }
    filterCategoriesList();
    filterWarehouseTable();
    updateRawDatalist();
}

// ==========================================
// 9. WORKERS & PAYROLL MODULE
// ==========================================

function filterWorkersList() {
    const q = (document.getElementById('search-workers-input')?.value || '').toLowerCase().trim();
    const wList = document.getElementById('workers-list');
    const badge = document.getElementById('workers-total-count-badge');
    if (!wList) return;

    if (badge) badge.innerText = `${workers.length} nafar`;

    if (workers.length === 0) {
        wList.innerHTML = '<p class="text-secondary fst-italic text-center py-4">Hozircha ishchilar kiritilmagan. "+ Yangi ishchi qo\'shish" tugmasini bosing.</p>';
        return;
    }

    const filtered = workers.filter(w => {
        return w.name.toLowerCase().includes(q) || (w.phone1 && w.phone1.includes(q));
    });

    if (filtered.length === 0) {
        wList.innerHTML = '<p class="text-secondary fst-italic text-center py-4">Qidiruv bo\'yicha ishchi topilmadi.</p>';
        return;
    }

    wList.innerHTML = '';
    const isAdmin = currentUser && currentUser.role === 'admin';

    filtered.forEach(w => {
        let earned = 0;
        (w.tasks || []).forEach(t => earned += (Number(t.total) || 0));
        let exp = 0;
        (w.expenses || []).forEach(e => exp += (Number(e.amount) || 0));
        const balance = earned - exp;

        wList.innerHTML += `
            <div class="worker-row shadow-sm">
                <div class="d-flex align-items-center gap-3 flex-grow-1" onclick="openWorkerDetails('${w.id}')" style="cursor: pointer;">
                    <div class="worker-avatar-chip">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="fw-bold fs-5 text-dark">${w.name}</span>
                            <span class="badge ${w.type === 'Asosiy ishchi' ? 'bg-primary' : 'bg-secondary'}">${w.type || 'Oddiy ishchi'}</span>
                        </div>
                        <small class="text-muted"><i class="fa-solid fa-phone me-1"></i> ${w.phone1 || '-'} ${w.phone2 ? ' | ' + w.phone2 : ''}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-4">
                    <div class="text-end admin-only">
                        <small class="text-muted d-block" style="font-size: 0.75rem;">Joriy hisob:</small>
                        <strong class="${balance < 0 ? 'text-danger' : 'text-success'} fs-6">${formatMoney(balance)}</strong>
                    </div>
                    ${isAdmin ? `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openEditWorkerModal('${w.id}')" title="Tahrirlash">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="requestDeleteWorker('${w.id}')" title="O'chirish">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>` : ''}
                </div>
            </div>
        `;
    });
}

function openAddWorkerModal() {
    document.getElementById('worker-modal-title').innerText = "Yangi ishchi qo'shish";
    document.getElementById('btn-save-worker').innerHTML = '<i class="fa-solid fa-plus me-1"></i> Qo\'shish';
    document.getElementById('editing-worker-id').value = '';
    document.getElementById('worker-name').value = '';
    document.getElementById('worker-phone-1').value = '';
    document.getElementById('worker-phone-2').value = '';
    document.getElementById('worker-phone-3').value = '';
    document.getElementById('role-oddiy').checked = true;
    document.getElementById('add-worker-modal').classList.add('active');
}

function openEditWorkerModal(id) {
    const w = workers.find(wr => wr.id === id);
    if (!w) return;

    document.getElementById('worker-modal-title').innerText = `Ishchini Tahrirlash: ${w.name}`;
    document.getElementById('btn-save-worker').innerHTML = '<i class="fa-solid fa-check me-1"></i> O\'zgarishni saqlash';
    document.getElementById('editing-worker-id').value = w.id;

    document.getElementById('worker-name').value = w.name || '';
    document.getElementById('worker-phone-1').value = w.phone1 || '';
    document.getElementById('worker-phone-2').value = w.phone2 || '';
    document.getElementById('worker-phone-3').value = w.phone3 || '';

    if (w.type === 'Asosiy ishchi') {
        document.getElementById('role-asosiy').checked = true;
    } else {
        document.getElementById('role-oddiy').checked = true;
    }

    document.getElementById('add-worker-modal').classList.add('active');
}

function saveWorkerForm(e) {
    e.preventDefault();
    const editId = document.getElementById('editing-worker-id')?.value || '';
    const name = (document.getElementById('worker-name')?.value || '').trim();
    const phone1 = (document.getElementById('worker-phone-1')?.value || '').trim();
    const phone2 = (document.getElementById('worker-phone-2')?.value || '').trim();
    const phone3 = (document.getElementById('worker-phone-3')?.value || '').trim();
    const selectedRadio = document.querySelector('input[name="worker-type-choice"]:checked');

    if (!name || !phone1) {
        showNotification("Ism va asosiy telefon raqami kiritilishi shart!", 'error');
        return;
    }

    const type = selectedRadio ? selectedRadio.value : 'Oddiy ishchi';

    if (editId) {
        const idx = workers.findIndex(w => w.id === editId);
        if (idx >= 0) {
            workers[idx].name = name;
            workers[idx].phone1 = phone1;
            workers[idx].phone2 = phone2;
            workers[idx].phone3 = phone3;
            workers[idx].type = type;
            showNotification(`Ishchi "${name}" ma'lumotlari yangilandi!`, 'success');
        }
    } else {
        const newWorker = {
            id: generateUniqueId('worker'),
            name: name,
            phone1: phone1,
            phone2: phone2,
            phone3: phone3,
            type: type,
            tasks: [],
            expenses: [],
            history: [],
            totalPaid: 0
        };
        workers.push(newWorker);
        showNotification(`Yangi ishchi "${name}" ro'yxatga qo'shildi!`, 'success');
    }

    saveData();
    closeModal('add-worker-modal');
    updateWorkersUI();
    updateProfileUI();
    renderDashboard();
}

function requestDeleteWorker(id) {
    deleteTarget = { type: 'worker', id: id };
    const w = workers.find(wr => wr.id === id);
    document.getElementById('confirm-message').innerText = `Haqiqatan ham "${w?.name || 'ushbu'}" ishchini ro'yxatdan o'chirmoqchimisiz?`;
    document.getElementById('confirm-modal').classList.add('active');
}

function openWorkerDetails(id) {
    activeWorkerId = id;
    const worker = workers.find(w => w.id === id);
    if (!worker) return;

    document.getElementById('detail-name').innerText = worker.name;
    document.getElementById('detail-worker-type').innerText = worker.type || 'Oddiy ishchi';
    document.getElementById('detail-phone-1').innerText = `Asosiy: ${worker.phone1 || '-'}`;

    let extraPhones = [];
    if (worker.phone2) extraPhones.push(`2-raqam: ${worker.phone2}`);
    if (worker.phone3) extraPhones.push(`3-raqam: ${worker.phone3}`);
    document.getElementById('detail-phone-extra').innerText = extraPhones.join(' | ');

    const pendingBtn = document.getElementById('tab-btn-pending');
    if (pendingBtn) switchWorkerTab('pending', pendingBtn);

    renderWorkerTasksAndStats();
    navigate('worker-detail');
}

function switchWorkerTab(tabType, btn) {
    document.querySelectorAll('.worker-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.worker-tab-content').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const target = document.getElementById('worker-tab-' + tabType);
    if (target) target.classList.add('active');
}

function renderWorkerTasksAndStats() {
    if (!activeWorkerId) return;
    const worker = workers.find(w => w.id === activeWorkerId);
    if (!worker) return;

    const tList = document.getElementById('detail-tasks-list');
    const eList = document.getElementById('detail-expenses-list');
    const hList = document.getElementById('detail-history-list');
    if (tList) tList.innerHTML = '';
    if (eList) eList.innerHTML = '';
    if (hList) hList.innerHTML = '';

    let earnedTotal = 0;
    let expenseTotal = 0;
    const isAdmin = currentUser && currentUser.role === 'admin';

    // 1. ACTIVE TASKS
    if (!worker.tasks || worker.tasks.length === 0) {
        if (tList) tList.innerHTML = '<p class="text-secondary fst-italic py-4 text-center">Hozircha bajarilayotgan faol ishlar yo\'q.</p>';
    } else {
        const grouped = {};
        worker.tasks.forEach(task => {
            earnedTotal += (Number(task.total) || 0);
            const key = `${task.productName}_${task.date}`;
            if (!grouped[key]) {
                grouped[key] = { productName: task.productName, date: task.date, totalBatch: 0, subTasks: [] };
            }
            grouped[key].totalBatch += (Number(task.total) || 0);
            grouped[key].subTasks.push(task);
        });

        Object.values(grouped).reverse().forEach(group => {
            let subItemsHtml = '';
            group.subTasks.forEach(st => {
                subItemsHtml += `
                    <div class="d-flex justify-content-between align-items-center small py-1 border-bottom border-light">
                        <span>• <b>${st.action}</b>: ${st.qty} dona × ${formatMoney(st.price)}</span>
                        <strong class="text-dark">${formatMoney(st.total)}</strong>
                    </div>
                `;
            });

            if (tList) {
                tList.innerHTML += `
                    <div class="custom-card mb-3 p-3 bg-white">
                        <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                            <div>
                                <strong class="fs-5 text-dark">${group.productName}</strong>
                                <span class="badge bg-secondary ms-2">${group.date}</span>
                            </div>
                            <strong class="text-success fs-5">${formatMoney(group.totalBatch)}</strong>
                        </div>
                        <div class="d-flex flex-column">${subItemsHtml}</div>
                    </div>
                `;
            }
        });
    }

    // 2. EXPENSES / ADVANCES
    if (!worker.expenses || worker.expenses.length === 0) {
        if (eList) eList.innerHTML = '<p class="text-secondary fst-italic py-4 text-center">Hozircha berilgan avanslar yo\'q.</p>';
    } else {
        worker.expenses.slice().reverse().forEach(exp => {
            expenseTotal += (Number(exp.amount) || 0);
            if (eList) {
                eList.innerHTML += `
                    <div class="p-3 bg-white rounded border mb-2 d-flex justify-content-between align-items-center shadow-sm">
                        <div>
                            <span class="badge bg-danger me-2">${exp.date}</span>
                            <strong class="text-dark">${exp.reason}</strong>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <strong class="text-danger fs-5">-${formatMoney(exp.amount)}</strong>
                            ${isAdmin ? `
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" onclick="openEditExpenseModal('${exp.id}')" title="Tahrirlash">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="requestDeleteExpense('${exp.id}')" title="O'chirish">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>` : ''}
                        </div>
                    </div>
                `;
            }
        });
    }

    // 3. SETTLEMENT HISTORY
    if (!worker.history || worker.history.length === 0) {
        if (hList) hList.innerHTML = '<p class="text-secondary fst-italic py-4 text-center">Oldingi hisob-kitoblar tarixi mavjud emas.</p>';
    } else {
        worker.history.slice().reverse().forEach(hist => {
            let taskLines = (hist.tasks || []).map(t => `<div>• ${t.productName} (${t.action}): ${t.qty} dona × ${formatMoney(t.price)} = <b>${formatMoney(t.total)}</b></div>`).join('');
            if (hList) {
                hList.innerHTML += `
                    <div class="custom-card mb-3 p-3 bg-white">
                        <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                            <span class="badge bg-success fs-6"><i class="fa-solid fa-circle-check me-1"></i> To'langan sana: ${hist.paidDate}</span>
                            <strong class="text-success fs-5">${formatMoney(hist.paidAmount)}</strong>
                        </div>
                        <div class="small text-secondary ps-2">${taskLines || 'Bajarilgan ishlar to\'lovi'}</div>
                    </div>
                `;
            }
        });
    }

    // Update Financial Stats
    const remainingBalance = earnedTotal - expenseTotal;
    const statTodayEl = document.getElementById('stat-today');
    if (statTodayEl) {
        statTodayEl.innerText = formatMoney(remainingBalance);
        statTodayEl.className = remainingBalance < 0 ? 'fw-bold m-0 text-danger' : 'fw-bold m-0 text-success';
    }

    const statExpEl = document.getElementById('stat-expense');
    if (statExpEl) statExpEl.innerText = formatMoney(expenseTotal);

    const statTotalEl = document.getElementById('stat-total');
    if (statTotalEl) statTotalEl.innerText = formatMoney(worker.totalPaid || 0);
}

function openExpenseModal() {
    document.getElementById('expense-date').value = getTodayIso();
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-reason').value = '';
    document.getElementById('expense-modal').classList.add('active');
}

function saveWorkerExpense(e) {
    e.preventDefault();
    if (!activeWorkerId) return;
    const worker = workers.find(w => w.id === activeWorkerId);
    if (!worker) return;

    const amount = parseFloat(document.getElementById('expense-amount')?.value) || 0;
    const reason = (document.getElementById('expense-reason')?.value || '').trim();
    const date = document.getElementById('expense-date')?.value || getTodayIso();

    if (amount <= 0 || !reason) {
        showNotification("Avans summasi va sababini kiriting!", 'error');
        return;
    }

    if (!worker.expenses) worker.expenses = [];
    worker.expenses.push({ id: generateUniqueId('exp'), date, amount, reason });

    saveData();
    closeModal('expense-modal');
    renderWorkerTasksAndStats();
    renderDashboard();
    showNotification(`Ishchiga ${formatMoney(amount)} avans berildi!`, 'success');
}

function openEditExpenseModal(expId) {
    if (!activeWorkerId) return;
    const worker = workers.find(w => w.id === activeWorkerId);
    if (!worker) return;
    const exp = (worker.expenses || []).find(e => e.id === expId);
    if (!exp) return;

    document.getElementById('editing-expense-id').value = exp.id;
    document.getElementById('edit-expense-date').value = exp.date;
    document.getElementById('edit-expense-amount').value = exp.amount;
    document.getElementById('edit-expense-reason').value = exp.reason;
    document.getElementById('expense-edit-modal').classList.add('active');
}

function updateWorkerExpense(e) {
    e.preventDefault();
    if (!activeWorkerId) return;
    const worker = workers.find(w => w.id === activeWorkerId);
    if (!worker) return;

    const expId = document.getElementById('editing-expense-id')?.value;
    const exp = (worker.expenses || []).find(e => e.id === expId);
    if (!exp) return;

    exp.date = document.getElementById('edit-expense-date')?.value;
    exp.amount = parseFloat(document.getElementById('edit-expense-amount')?.value) || 0;
    exp.reason = (document.getElementById('edit-expense-reason')?.value || '').trim();

    saveData();
    closeModal('expense-edit-modal');
    renderWorkerTasksAndStats();
    renderDashboard();
    showNotification("Avans yozuvi tahrirlandi!", 'success');
}

function requestDeleteExpense(expId) {
    deleteTarget = { type: 'expense', id: expId };
    document.getElementById('confirm-message').innerText = "Ushbu avans yozuvini o'chirmoqchimisiz?";
    document.getElementById('confirm-modal').classList.add('active');
}

/**
 * Settles worker balance:
 * - If balance > 0: moves tasks & expenses to history, adds to totalPaid.
 * - If balance < 0 (worker is indebted): prevents accidental debt wipe.
 */
function settleWorkerPayment() {
    if (!activeWorkerId) return;
    const worker = workers.find(w => w.id === activeWorkerId);
    if (!worker) return;

    let earnedTotal = 0;
    (worker.tasks || []).forEach(t => earnedTotal += (Number(t.total) || 0));
    let expenseTotal = 0;
    (worker.expenses || []).forEach(e => expenseTotal += (Number(e.amount) || 0));

    const netPayment = earnedTotal - expenseTotal;

    if (earnedTotal === 0 && expenseTotal === 0) {
        showNotification("To'lov qilish uchun faol ishlar yoki avanslar mavjud emas!", 'warning');
        return;
    }

    if (netPayment < 0) {
        showNotification(`Diqqat! Ishchining avansi ishlaganidan ko'p (qarz: ${formatMoney(Math.abs(netPayment))}). Hisobni yopish mumkin emas!`, 'error');
        return;
    }

    if (!worker.history) worker.history = [];
    worker.history.push({
        id: generateUniqueId('hist'),
        paidDate: getTodayStr(),
        paidAmount: netPayment,
        tasks: [...(worker.tasks || [])],
        expenses: [...(worker.expenses || [])]
    });

    worker.totalPaid = (worker.totalPaid || 0) + netPayment;
    worker.tasks = [];
    worker.expenses = [];

    saveData();
    renderWorkerTasksAndStats();
    renderDashboard();
    showNotification(`Hisob-kitob muvaffaqiyatli yakunlandi: Ishchiga ${formatMoney(netPayment)} to'landi!`, 'success');
}

function printWorkerPayslip() {
    window.print();
}

function updateWorkersUI() {
    filterWorkersList();
}

// ==========================================
// 10. OMBOR REPORT MODULE
// ==========================================

function updateOmborCategoriesDropdown() {
    const sel = document.getElementById('ombor-cat-select');
    if (!sel) return;
    sel.innerHTML = '<option value="Barchasi">Barcha bo\'limlar</option>';
    categories.forEach(c => {
        sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    sel.value = currentOmborCatFilter;
}

function filterOmborByCat(val) {
    currentOmborCatFilter = val;
    filterOmborList();
}

function filterOmborList() {
    const q = (document.getElementById('search-ombor-input')?.value || '').toLowerCase().trim();
    const container = document.getElementById('ombor-items-container');
    if (!container) return;

    if (warehouse.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center py-4 fst-italic">Omborda tovarlar mavjud emas.</p>';
        return;
    }

    let filtered = warehouse.filter(item => {
        const matchesCat = (currentOmborCatFilter === 'Barchasi') || (item.cat === currentOmborCatFilter);
        const matchesQuery = item.name.toLowerCase().includes(q) || (item.cat && item.cat.toLowerCase().includes(q));
        return matchesCat && matchesQuery;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center py-4">Qidiruv bo\'yicha tovar topilmadi.</p>';
        return;
    }

    let totalSum = 0;
    let table = `<table class="table table-bordered table-hover align-middle text-center bg-white">
        <thead><tr>
            <th>№</th><th>Nomi</th><th>Bo'lim</th><th>Qoldiq</th><th>Tan narxi</th><th>Jami summasi</th>
        </tr></thead><tbody>`;

    filtered.forEach((item, idx) => {
        const isLow = item.limit && (Number(item.qty) <= Number(item.limit));
        const itemTotal = (Number(item.qty) || 0) * (Number(item.costPrice) || 0);
        totalSum += itemTotal;

        table += `<tr class="clickable-row ${isLow ? 'row-low-stock' : ''}" onclick="openProductDetailsModalById('${item.id}')">
            <td>${idx + 1}</td>
            <td class="fw-bold text-start ps-3 fs-6">${item.name}</td>
            <td><span class="badge bg-secondary">${item.cat}</span></td>
            <td class="fw-bold fs-6 text-primary">${item.qty} ${item.unit}</td>
            <td>${formatMoney(item.costPrice || 0)}</td>
            <td class="fw-bold fs-6 text-success">${formatMoney(itemTotal)}</td>
        </tr>`;
    });

    table += `
        <tr class="table-light fw-bold fs-5">
            <td colspan="5" class="text-end text-dark">Ombordagi barcha tovarlarning jami qiymati:</td>
            <td class="text-success">${formatMoney(totalSum)}</td>
        </tr>
    </tbody></table>`;

    container.innerHTML = table;
}

function updateOmborUI() {
    updateOmborCategoriesDropdown();
    filterOmborList();
}

// ==========================================
// 11. PROFILE & USERS MODULE
// ==========================================

let isOldCredsVerified = false;

function toggleInputPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'fa-solid fa-eye-slash';
    } else {
        input.type = 'password';
        if (icon) icon.className = 'fa-solid fa-eye';
    }
}

function verifyOldCredentials() {
    if (!currentUser) return;
    const oldLoginInput = document.getElementById('old-login-input');
    const oldPassInput = document.getElementById('old-password-input');
    const u = (oldLoginInput?.value || '').trim().toLowerCase();
    const p = (oldPassInput?.value || '').trim();

    if (!u || !p) {
        showNotification("Eski login va parolni to'liq kiriting!", 'warning');
        return;
    }

    const users = getAuthUsers();
    const currentUsername = (currentUser.username || (currentUser.role === 'admin' ? 'admin' : 'ishchi')).toLowerCase();

    // Match entered login and password with current user
    const matched = users.find(user => 
        (user.username.toLowerCase() === currentUsername || user.role === currentUser.role) &&
        user.username.toLowerCase() === u && 
        user.password === p
    );

    if (!matched) {
        const step1Badge = document.getElementById('step1-status-badge');
        if (step1Badge) {
            step1Badge.className = 'badge bg-danger';
            step1Badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Xato kiritildi';
        }
        showNotification("Eski login yoki parol noto'g'ri! Iltimos, qayta tekshiring.", 'error');
        oldPassInput?.focus();
        return;
    }

    // Success: Lock Step 1 and Unlock Step 2
    isOldCredsVerified = true;

    const step1Badge = document.getElementById('step1-status-badge');
    if (step1Badge) {
        step1Badge.className = 'badge bg-success';
        step1Badge.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> Tasdiqlandi';
    }

    if (oldLoginInput) oldLoginInput.readOnly = true;
    if (oldPassInput) oldPassInput.readOnly = true;
    const verifyBtn = document.querySelector('#step1-actions button');
    if (verifyBtn) verifyBtn.disabled = true;

    // Activate Step 2
    const step2Box = document.getElementById('step2-new-creds-box');
    const step2Badge = document.getElementById('step2-status-badge');
    const step2NumberBadge = document.getElementById('step2-number-badge');
    const newLoginInput = document.getElementById('new-login-input');
    const newPassInput = document.getElementById('new-password-input');
    const newPassConfirmInput = document.getElementById('new-password-confirm-input');
    const saveBtn = document.getElementById('btn-save-new-creds');

    if (step2Box) {
        step2Box.style.opacity = '1';
        step2Box.style.pointerEvents = 'auto';
        step2Box.style.backgroundColor = '#ffffff';
        step2Box.style.borderStyle = 'solid';
        step2Box.style.borderColor = 'var(--primary)';
    }
    if (step2Badge) {
        step2Badge.className = 'badge bg-success';
        step2Badge.innerHTML = '<i class="fa-solid fa-unlock me-1"></i> Ruxsat berildi';
    }
    if (step2NumberBadge) {
        step2NumberBadge.className = 'badge bg-primary me-2';
    }
    if (newLoginInput) {
        newLoginInput.disabled = false;
        newLoginInput.value = currentUser.username || (currentUser.role === 'admin' ? 'admin' : 'ishchi');
        newLoginInput.focus();
    }
    if (newPassInput) newPassInput.disabled = false;
    if (newPassConfirmInput) newPassConfirmInput.disabled = false;
    if (saveBtn) saveBtn.disabled = false;

    showNotification("Eski login va parol tasdiqlandi! Endi yangi login va parolni kiriting.", 'success');
}

function saveNewCredentials() {
    if (!isOldCredsVerified) {
        showNotification("Avval eski login va parolni tasdiqlang!", 'warning');
        return;
    }

    const newLoginInput = document.getElementById('new-login-input');
    const newPassInput = document.getElementById('new-password-input');
    const newPassConfirmInput = document.getElementById('new-password-confirm-input');

    const newUsername = (newLoginInput?.value || '').trim();
    const newPassword = (newPassInput?.value || '').trim();
    const confirmPassword = (newPassConfirmInput?.value || '').trim();

    if (!newUsername || newUsername.length < 3) {
        showNotification("Yangi login kamida 3 ta belgidan iborat bo'lishi kerak!", 'warning');
        newLoginInput?.focus();
        return;
    }

    if (!newPassword || newPassword.length < 3) {
        showNotification("Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!", 'warning');
        newPassInput?.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification("Yangi parollar bir-biriga mos kelmadi! Qayta tekshiring.", 'error');
        newPassConfirmInput?.focus();
        return;
    }

    const currentUsername = (currentUser.username || (currentUser.role === 'admin' ? 'admin' : 'ishchi')).toLowerCase();
    const users = getAuthUsers();

    // Check if newUsername is already taken by another user
    const isTaken = users.some(u => 
        u.username.toLowerCase() === newUsername.toLowerCase() && 
        u.username.toLowerCase() !== currentUsername
    );

    if (isTaken) {
        showNotification(`"${newUsername}" nomli login boshqa foydalanuvchi tomonidan band qilingan!`, 'error');
        newLoginInput?.focus();
        return;
    }

    // Update the matched user
    let userFound = false;
    users.forEach(u => {
        if (u.username.toLowerCase() === currentUsername || (u.role === currentUser.role && !userFound)) {
            u.username = newUsername;
            u.password = newPassword;
            userFound = true;
        }
    });

    if (!userFound) {
        users.push({
            username: newUsername,
            password: newPassword,
            role: currentUser.role,
            name: currentUser.name
        });
    }

    saveAuthUsers(users);

    // Update currentUser in state and localStorage
    currentUser.username = newUsername;
    localStorage.setItem('mmir_current_user', JSON.stringify(currentUser));

    showNotification("Login va parol muvaffaqiyatli yangilandi! Keyingi safar yangi login va parol bilan kiring.", 'success');

    closeModal('change-password-modal');
    resetCredsChangeForm(false);
    updateProfileUI();
}

function openChangePasswordModal() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification("Parol o'zgartirish faqat administrator uchun ruxsat etilgan!", 'error');
        return;
    }
    resetCredsChangeForm(false);
    openModal('change-password-modal');
}

function resetCredsChangeForm(notify = true) {
    isOldCredsVerified = false;

    const oldLoginInput = document.getElementById('old-login-input');
    const oldPassInput = document.getElementById('old-password-input');
    const step1Badge = document.getElementById('step1-status-badge');
    const verifyBtn = document.querySelector('#step1-actions button');

    if (oldLoginInput) {
        oldLoginInput.readOnly = false;
        oldLoginInput.value = '';
    }
    if (oldPassInput) {
        oldPassInput.readOnly = false;
        oldPassInput.value = '';
    }
    if (step1Badge) {
        step1Badge.className = 'badge bg-warning text-dark';
        step1Badge.innerHTML = '<i class="fa-solid fa-lock me-1"></i> Tasdiqlanishi kutilmoqda';
    }
    if (verifyBtn) verifyBtn.disabled = false;

    // Reset and lock Step 2
    const step2Box = document.getElementById('step2-new-creds-box');
    const step2Badge = document.getElementById('step2-status-badge');
    const step2NumberBadge = document.getElementById('step2-number-badge');
    const newLoginInput = document.getElementById('new-login-input');
    const newPassInput = document.getElementById('new-password-input');
    const newPassConfirmInput = document.getElementById('new-password-confirm-input');
    const saveBtn = document.getElementById('btn-save-new-creds');

    if (step2Box) {
        step2Box.style.opacity = '0.5';
        step2Box.style.pointerEvents = 'none';
        step2Box.style.backgroundColor = '#f8fafc';
        step2Box.style.borderStyle = 'dashed';
        step2Box.style.borderColor = '#cbd5e1';
    }
    if (step2Badge) {
        step2Badge.className = 'badge bg-secondary';
        step2Badge.innerHTML = '<i class="fa-solid fa-lock me-1"></i> Ruxsat berilmagan';
    }
    if (step2NumberBadge) {
        step2NumberBadge.className = 'badge bg-secondary me-2';
    }
    if (newLoginInput) {
        newLoginInput.disabled = true;
        newLoginInput.value = '';
    }
    if (newPassInput) {
        newPassInput.disabled = true;
        newPassInput.value = '';
    }
    if (newPassConfirmInput) {
        newPassConfirmInput.disabled = true;
        newPassConfirmInput.value = '';
    }
    if (saveBtn) saveBtn.disabled = true;

    if (notify) {
        showNotification("Login va parolni o'zgartirish bekor qilindi.", 'info');
    }
}

function updateProfileUI() {
    const pList = document.getElementById('profile-users-list');
    const pTitle = document.getElementById('profile-section-title');
    const pDesc = document.getElementById('profile-section-desc');
    const uBadge = document.getElementById('profile-current-username-badge');

    if (uBadge && currentUser) {
        const uname = currentUser.username || (currentUser.role === 'admin' ? 'admin' : 'ishchi');
        uBadge.innerHTML = `<i class="fa-solid fa-user-check me-1"></i> Joriy login: <strong>${uname}</strong>`;
    }

    if (!pList) return;
    pList.innerHTML = '';

    const isAdmin = currentUser && currentUser.role === 'admin';
    if (isAdmin) {
        if (pTitle) pTitle.innerText = "Administratorlar va Asosiy Ustalar";
        if (pDesc) pDesc.innerText = "Boshqaruv huquqiga ega asosiy ishchilar ro'yxati";

        const mainWorkers = workers.filter(w => w.type === 'Asosiy ishchi');
        if (mainWorkers.length === 0) {
            pList.innerHTML = '<p class="text-secondary fst-italic text-center py-4">Hozircha asosiy ustalar belgilanmagan.</p>';
        } else {
            mainWorkers.forEach((w, i) => {
                pList.innerHTML += `
                    <div class="p-3 bg-white rounded border d-flex justify-content-between align-items-center shadow-sm mb-2">
                        <div class="d-flex align-items-center gap-3">
                            <div class="worker-avatar-chip" style="width: 40px; height: 40px;">
                                <i class="fa-solid fa-user-shield"></i>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark m-0">${w.name}</h6>
                                <span class="badge bg-primary">Asosiy usta</span>
                            </div>
                        </div>
                        <span class="text-secondary fw-bold">📞 ${w.phone1 || '-'}</span>
                    </div>
                `;
            });
        }
    } else {
        if (pTitle) pTitle.innerText = "Oddiy Xodimlar";
        if (pDesc) pDesc.innerText = "Ishchi jamoa ro'yxati";

        workers.forEach((w, i) => {
            pList.innerHTML += `
                <div class="p-3 bg-white rounded border d-flex justify-content-between align-items-center shadow-sm mb-2">
                    <div class="d-flex align-items-center gap-3">
                        <div class="worker-avatar-chip" style="width: 40px; height: 40px;">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold text-dark m-0">${w.name}</h6>
                            <span class="badge bg-secondary">${w.type || 'Oddiy ishchi'}</span>
                        </div>
                    </div>
                    <span class="text-secondary fw-bold">📞 ${w.phone1 || '-'}</span>
                </div>
            `;
        });
    }
}

// ==========================================
// 12. BACKUP, EXPORT & RESTORE ENGINE
// ==========================================

function openBackupModal() {
    document.getElementById('backup-modal')?.classList.add('active');
}

function exportDataToJson() {
    const backupData = {
        app: 'MMIR_ERP',
        version: '2026.1',
        exportedAt: new Date().toISOString(),
        rawMaterials: rawMaterials,
        warehouse: warehouse,
        categories: categories,
        workers: workers,
        productionHistory: productionHistory
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `MMIR_Zaxira_${getTodayIso()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();

    showNotification("Zaxira nusxasi muvaffaqiyatli yuklab olindi!", 'success');
}

function importDataFromJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.rawMaterials && data.warehouse && data.workers) {
                rawMaterials = data.rawMaterials || [];
                warehouse = data.warehouse || [];
                categories = data.categories || [];
                workers = data.workers || [];
                productionHistory = data.productionHistory || [];

                ensureEntityIds();
                saveData();
                closeModal('backup-modal');
                applyRolePermissions();
                showNotification("Tizim zaxiradan to'liq va muvaffaqiyatli tiklandi!", 'success');
            } else {
                showNotification("Fayl formati noto'g'ri! MMIR zaxira faylini tanlang.", 'error');
            }
        } catch (err) {
            showNotification("Faylni o'qishda xatolik yuz berdi: " + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function exportWarehouseToCsv() {
    if (warehouse.length === 0) {
        showNotification("Eksport qilish uchun omborda tovarlar mavjud emas!", 'warning');
        return;
    }

    let csv = "\uFEFF"; // UTF-8 BOM so Excel opens Uzbek characters cleanly
    csv += "№;Bo'lim;Mahsulot Nomi;Qoldiq;Birlik;Tan Narx (so'm);Jami Qiymat (so'm)\r\n";

    warehouse.forEach((item, idx) => {
        const itemTotal = (Number(item.qty) || 0) * (Number(item.costPrice) || 0);
        csv += `${idx + 1};"${item.cat}";"${item.name}";${item.qty};"${item.unit}";${item.costPrice};${itemTotal}\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `MMIR_Ombor_${getTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    showNotification("Ombor jadvali Excel (CSV) formatida yuklandi!", 'success');
}

function loadDemoData() {
    if (!confirm("Barcha mavjud ma'lumotlar ustiga haqiqiy namuna zavod ma'lumotlari yuklanadi. Rozimisiz?")) return;

    categories = [
        { id: 'cat_1', name: "Darvozalar" },
        { id: 'cat_2', name: "Panjaralar (Reshyotka)" },
        { id: 'cat_3', name: "Metall Konstruksiyalar" },
        { id: 'cat_4', name: "Temir Eshiklar" }
    ];

    rawMaterials = [
        { id: 'raw_1', name: "Truba 40x20x1.5mm", qty: 240, unit: "metr", unitPrice: 16000, limit: 50, costPrice: 3840000 },
        { id: 'raw_2', name: "Kvadrat truba 60x60x2mm", qty: 120, unit: "metr", unitPrice: 34000, limit: 30, costPrice: 4080000 },
        { id: 'raw_3', name: "List metall 2mm", qty: 15, unit: "kv", unitPrice: 110000, limit: 5, costPrice: 1650000 },
        { id: 'raw_4', name: "Kovka bezak elementlari", qty: 85, unit: "dona", unitPrice: 22000, limit: 20, costPrice: 1870000 },
        { id: 'raw_5', name: "Grunt va kraska qora", qty: 8, unit: "kg", unitPrice: 45000, limit: 10, costPrice: 360000 }
    ];

    warehouse = [
        {
            id: 'prod_1',
            cat: "Darvozalar",
            name: "Klassik 3x2.5m Darvoza",
            qty: 3,
            unit: "dona",
            limit: 2,
            costPrice: 1850000,
            consumptions: [
                { name: "Kvadrat truba 60x60x2mm", qty: 12, unit: "metr", price: 34000, totalRow: 408000 },
                { name: "Truba 40x20x1.5mm", qty: 28, unit: "metr", price: 16000, totalRow: 448000 },
                { name: "List metall 2mm", qty: 4, unit: "kv", price: 110000, totalRow: 440000 },
                { name: "Kovka bezak elementlari", qty: 6, unit: "dona", price: 22000, totalRow: 132000 }
            ],
            jobs: [
                { action: "Karkas yig'ish va kesish", price: 200000 },
                { action: "Payvandlash (Svarka)", price: 150000 },
                { action: "Gruntlash va Bo'yash", price: 72000 }
            ]
        },
        {
            id: 'prod_2',
            cat: "Panjaralar (Reshyotka)",
            name: "Deraza Panjarasi 1.4x1.2m",
            qty: 12,
            unit: "dona",
            limit: 5,
            costPrice: 320000,
            consumptions: [
                { name: "Truba 40x20x1.5mm", qty: 8, unit: "metr", price: 16000, totalRow: 128000 },
                { name: "Kovka bezak elementlari", qty: 4, unit: "dona", price: 22000, totalRow: 88000 }
            ],
            jobs: [
                { action: "Kesish va terish", price: 40000 },
                { action: "Payvandlash", price: 40000 },
                { action: "Bo'yash", price: 24000 }
            ]
        }
    ];

    workers = [
        {
            id: 'worker_1',
            name: "Sardor Karimov",
            phone1: "+998 90 123 45 67",
            phone2: "+998 93 987 65 43",
            type: "Asosiy ishchi",
            tasks: [
                { id: 't_1', date: getTodayStr(), productName: "Klassik 3x2.5m Darvoza", action: "Payvandlash (Svarka)", qty: 2, price: 150000, total: 300000 }
            ],
            expenses: [
                { id: 'exp_1', date: getTodayIso(), amount: 100000, reason: "Yo'lkira uchun avans" }
            ],
            history: [],
            totalPaid: 1500000
        },
        {
            id: 'worker_2',
            name: "Jasur Rahimov",
            phone1: "+998 97 765 43 21",
            type: "Oddiy ishchi",
            tasks: [
                { id: 't_2', date: getTodayStr(), productName: "Deraza Panjarasi 1.4x1.2m", action: "Kesish va terish", qty: 5, price: 40000, total: 200000 }
            ],
            expenses: [],
            history: [],
            totalPaid: 800000
        }
    ];

    productionHistory = [
        {
            id: 'hist_1',
            isoDate: getTodayIso(),
            dateStr: getTodayStr(),
            timeStr: getNowTimeStr(),
            productId: 'prod_1',
            productName: "Klassik 3x2.5m Darvoza",
            category: "Darvozalar",
            totalQty: 2,
            consumedMaterials: [
                { rawId: 'raw_2', name: "Kvadrat truba 60x60x2mm", qty: 24, unit: "metr" },
                { rawId: 'raw_1', name: "Truba 40x20x1.5mm", qty: 56, unit: "metr" }
            ],
            assignments: [
                { workerName: "Sardor Karimov", action: "Payvandlash (Svarka)", qty: 2, price: 150000, total: 300000 }
            ]
        }
    ];

    saveData();
    closeModal('backup-modal');
    applyRolePermissions();
    showNotification("Namuna zavod ma'lumotlari muvaffaqiyatli o'rnatildi!", 'success');
}

// ==========================================
// 13. MODAL CONTROLS & CONFIRMATION
// ==========================================

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
    deleteTarget = null;
}

// Unified Delete Handler
document.getElementById('btn-confirm-delete')?.addEventListener('click', () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'raw') {
        const idx = rawMaterials.findIndex(r => r.id === deleteTarget.id);
        if (idx >= 0) {
            const name = rawMaterials[idx].name;
            rawMaterials.splice(idx, 1);
            saveData();
            updateRawUI();
            renderDashboard();
            showNotification(`"${name}" xomashyosi o'chirildi!`, 'warning');
        }
    } else if (deleteTarget.type === 'warehouse') {
        const idx = warehouse.findIndex(w => w.id === deleteTarget.id);
        if (idx >= 0) {
            const name = warehouse[idx].name;
            warehouse.splice(idx, 1);
            saveData();
            updateProductsUI();
            updateProductionUI();
            updateOmborUI();
            renderDashboard();
            showNotification(`"${name}" tovari ombordan o'chirildi!`, 'warning');
        }
    } else if (deleteTarget.type === 'category') {
        const idx = categories.findIndex(c => c.id === deleteTarget.id);
        if (idx >= 0) {
            categories.splice(idx, 1);
            saveData();
            updateProductsUI();
            updateProductionUI();
            updateOmborUI();
            showNotification("Bo'lim o'chirildi!", 'warning');
        }
    } else if (deleteTarget.type === 'worker') {
        const idx = workers.findIndex(w => w.id === deleteTarget.id);
        if (idx >= 0) {
            const name = workers[idx].name;
            workers.splice(idx, 1);
            saveData();
            updateWorkersUI();
            updateProfileUI();
            renderDashboard();
            showNotification(`Ishchi "${name}" o'chirildi!`, 'warning');
        }
    } else if (deleteTarget.type === 'expense') {
        if (activeWorkerId) {
            const worker = workers.find(w => w.id === activeWorkerId);
            if (worker && worker.expenses) {
                const eIdx = worker.expenses.findIndex(e => e.id === deleteTarget.id);
                if (eIdx >= 0) {
                    worker.expenses.splice(eIdx, 1);
                    saveData();
                    renderWorkerTasksAndStats();
                    renderDashboard();
                    showNotification("Avans yozuvi o'chirildi!", 'warning');
                }
            }
        }
    } else if (deleteTarget.type === 'production_batch') {
        revertProductionBatch(deleteTarget.id);
    }

    closeModal('confirm-modal');
});

// ==========================================
// 14. INITIALIZATION ON WINDOW LOAD
// ==========================================

window.onload = () => {
    ensureEntityIds();
    syncRawUnitLabel();

    // Initialize one dynamic row each in product creation form
    addDynamicConsumptionRow();
    addDynamicJobRow();

    if (currentUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-layout').style.display = 'flex';
        applyRolePermissions();
        navigate('dashboard');
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-layout').style.display = 'none';
    }
};