// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAnxwVeTt1XDZ5Ai1peib45x0L9L6gTgWs",
    authDomain: "rifa-interactiva-5ce14.firebaseapp.com",
    projectId: "rifa-interactiva-5ce14",
    storageBucket: "rifa-interactiva-5ce14.firebasestorage.app",
    messagingSenderId: "157143246252",
    appId: "1:157143246252:web:60e7007c48d27cfa250609"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIABLES ---
const grid = document.getElementById('raffle-grid');
const btnReserveTrigger = document.getElementById('btn-reserve-trigger');
const btnAdminBroadcast = document.getElementById('btn-admin-broadcast');
const btnAdminSettings = document.getElementById('btn-admin-settings');
const modalUser = document.getElementById('modal-user');
const modalAdminLogin = document.getElementById('modal-admin-login');
const modalAdminAction = document.getElementById('modal-admin-action');
const modalAdminBroadcast = document.getElementById('modal-admin-broadcast');
const modalAdminSettings = document.getElementById('modal-admin-settings');
const modalImageFull = document.getElementById('modal-image-full');

let selectedNumbers = [];
let adminWhatsApp = "";
let adminPaymentInfo = "";
let adminCashInfo = "";
let isAdmin = false;
let numbersData = {};
let lastHighlightedBuyer = null;
let isInitialLoad = true; // Control para el reporte automático

// --- INICIALIZACIÓN ---
function init() {
    generateGrid();
    loadConfig();
    listenToNumbers();
    setupAutoReport(); // Nueva función de monitoreo
}

function generateGrid() {
    grid.innerHTML = "";
    for (let i = 0; i < 100; i++) {
        const id = i.toString().padStart(2, '0');
        const cell = document.createElement('div');
        cell.id = `cell-${id}`;
        cell.className = 'number-cell free';
        cell.innerHTML = `<span class="cell-number">${id}</span><span class="cell-name" id="name-${id}"></span>`;
        cell.onclick = () => handleCellClick(id);
        grid.appendChild(cell);
    }
}

function listenToNumbers() {
    db.collection("numbers").onSnapshot((snapshot) => {
        snapshot.forEach((doc) => {
            const data = doc.data();
            numbersData[doc.id] = data;
            const cell = document.getElementById(`cell-${doc.id}`);
            const nameSpan = document.getElementById(`name-${doc.id}`);
            if (cell && !selectedNumbers.includes(doc.id)) {
                cell.className = `number-cell ${data.status}`;
                if (nameSpan) nameSpan.innerText = (data.status !== 'free' ? (data.buyer || "") : "");
            }
        });
        updateMiniStats();
    });
}

function loadConfig() {
    db.collection("config").doc("main").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            adminWhatsApp = data.adminWhatsApp || "";
            adminPaymentInfo = data.paymentInfo || "";
            adminCashInfo = data.cashInfo || "";
            
            document.getElementById('admin-config-whatsapp').value = adminWhatsApp;
            document.getElementById('admin-config-payment').value = adminPaymentInfo;
            document.getElementById('admin-config-cash').value = adminCashInfo;
            
            document.getElementById('display-payment-info').innerText = adminPaymentInfo || "PENDIENTE";
            
            const cashContainer = document.getElementById('cash-container');
            const displayCashInfo = document.getElementById('display-cash-info');
            if (adminCashInfo) {
                cashContainer.style.display = 'inline';
                displayCashInfo.innerText = adminCashInfo;
            } else {
                cashContainer.style.display = 'none';
            }
        }
    });
}

function openFullImage() { modalImageFull.style.display = 'flex'; }

// --- LOGICA SELECCIÓN ---
function handleCellClick(id) {
    const data = numbersData[id] || { status: 'free' };
    
    if (isAdmin) {
        if (selectedNumbers.includes(id)) {
            toggleSelection(id);
        } else if (data.buyer && data.phone) {
            const buyer = data.buyer;
            const phone = data.phone;
            const isAlreadySelected = selectedNumbers.includes(id);
            
            Object.keys(numbersData).forEach(numId => {
                const n = numbersData[numId];
                if (n.buyer === buyer && n.phone === phone) {
                    if (isAlreadySelected) {
                        selectedNumbers = selectedNumbers.filter(x => x !== numId);
                        updateCellVisual(numId, false);
                    } else {
                        if (!selectedNumbers.includes(numId)) {
                            selectedNumbers.push(numId);
                            updateCellVisual(numId, true);
                        }
                    }
                }
            });
        } else {
            toggleSelection(id);
        }
    } else {
        if (data.status !== 'free' && !selectedNumbers.includes(id)) {
            highlightBuyerGroup(data.buyer, data.phone);
            return;
        }
        toggleSelection(id);
    }
    updateUI();
}

function highlightBuyerGroup(buyer, phone) {
    if (!buyer || !phone) return;

    const reservedNums = [];
    const soldNums = [];

    // Clasificar números del cliente
    Object.keys(numbersData).forEach(id => {
        const data = numbersData[id];
        if (data.buyer === buyer && data.phone === phone) {
            if (data.status === 'reserved') reservedNums.push(id);
            if (data.status === 'sold') soldNums.push(id);
        }
    });

    // Llenar datos en el modal
    document.getElementById('status-buyer-name').innerText = buyer.toUpperCase();
    document.getElementById('status-buyer-count').innerText = `${reservedNums.length + soldNums.length} números registrados`;

    // Procesar Reservados
    const containerRes = document.getElementById('container-status-reserved');
    const gridRes = document.getElementById('grid-reserved');
    if (reservedNums.length > 0) {
        containerRes.style.display = 'block';
        gridRes.innerHTML = reservedNums.map(num => `
            <div class="number-cell reserved" style="aspect-ratio: 1/1;">
                <span class="cell-number" style="font-size: 1.5rem;">${num}</span>
            </div>
        `).join('');
        const deuda = reservedNums.length * 20000;
        document.getElementById('msg-reserved').innerText = `Por favor enviar el soporte de pago por $${deuda.toLocaleString()}`;
    } else {
        containerRes.style.display = 'none';
    }

    // Procesar Vendidos (Pagos)
    const containerSold = document.getElementById('container-status-sold');
    const gridSold = document.getElementById('grid-sold');
    if (soldNums.length > 0) {
        containerSold.style.display = 'block';
        gridSold.innerHTML = soldNums.map(num => `
            <div class="number-cell sold" style="aspect-ratio: 1/1;">
                <span class="cell-number" style="font-size: 1.5rem; color: #020617;">${num}</span>
            </div>
        `).join('');
    } else {
        containerSold.style.display = 'none';
    }

    // Mostrar el modal
    document.getElementById('modal-buyer-status').style.display = 'flex';
}

function toggleSelection(id) {
    document.querySelectorAll('.highlight-group').forEach(el => el.classList.remove('highlight-group'));
    lastHighlightedBuyer = null;
    if (selectedNumbers.includes(id)) {
        selectedNumbers = selectedNumbers.filter(n => n !== id);
        updateCellVisual(id, false);
    } else {
        selectedNumbers.push(id);
        updateCellVisual(id, true);
    }
}

function updateCellVisual(id, isSelected) {
    const cell = document.getElementById(`cell-${id}`);
    const nameSpan = document.getElementById(`name-${id}`);
    const status = numbersData[id] ? numbersData[id].status : 'free';
    
    if (isSelected) {
        cell.className = 'number-cell selected';
        if (nameSpan) nameSpan.innerText = isAdmin ? "SEL" : "TUYO";
    } else {
        cell.className = `number-cell ${status}`;
        if (nameSpan) nameSpan.innerText = (status !== 'free' ? (numbersData[id].buyer || "") : "");
    }
}

function updateUI() {
    const count = selectedNumbers.length;
    const total = count * 20000;
    document.getElementById('count-display').innerText = count;
    document.getElementById('total-display').innerText = total.toLocaleString();
    btnReserveTrigger.disabled = count === 0;
    
    if (isAdmin) {
        btnReserveTrigger.innerText = count > 0 ? `GESTIONAR ${count} ELEGIDOS` : "SELECCIONA NÚMEROS";
        btnReserveTrigger.style.background = "var(--accent-yellow)";
        btnReserveTrigger.style.color = "black";
    } else {
        btnReserveTrigger.innerText = count > 0 ? `RESERVAR ${count} NÚMEROS` : "RESERVAR AHORA";
        btnReserveTrigger.style.background = "var(--accent-blue)";
        btnReserveTrigger.style.color = "white";
    }
}

// --- MODALES ---
btnReserveTrigger.onclick = () => {
    if (isAdmin) {
        const firstNum = selectedNumbers[0];
        const data = numbersData[firstNum] || {};
        document.getElementById('admin-edit-name').value = data.buyer || "";
        document.getElementById('admin-edit-phone').value = data.phone || "";
        modalAdminAction.style.display = 'flex';
    } else {
        document.getElementById('selected-summary').innerText = `Números: ${selectedNumbers.sort().join(', ')}`;
        modalUser.style.display = 'flex';
    }
};

document.getElementById('btn-confirm-reserve').onclick = async () => {
    const name = document.getElementById('user-name').value;
    const phone = document.getElementById('user-whatsapp').value;
    if (!name || !phone) return alert("Completa los datos");
    
    const selectionToProcess = [...selectedNumbers];
    const total = selectionToProcess.length * 20000;
    const now = new Date().toLocaleString();

    closeModals();
    selectedNumbers = [];
    updateUI();

    const batch = db.batch();
    selectionToProcess.forEach(num => {
        batch.set(db.collection("numbers").doc(num), { status: 'reserved', buyer: name, phone: phone, timestamp: new Date() }, { merge: true });
    });

    try {
        await batch.commit();
        
        // 1. Mensaje para el ADMINISTRADOR
        const msgAdmin = `Hola, soy ${name}. Aparté los números: ${selectionToProcess.sort().join(', ')}. Total: $${total.toLocaleString()}. Fecha: ${now}`;
        window.open(`https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(msgAdmin)}`, '_blank');

        // 2. Mensaje para el COMPRADOR (Con delay de 2 seg para evitar bloqueos de navegador)
        setTimeout(() => {
            let payMsg = `Por favor realiza tu consignación aquí: ${adminPaymentInfo}.`;
            if (adminCashInfo) payMsg += ` O paga en efectivo a: ${adminCashInfo}.`;
            const msgBuyer = `¡Hola ${name}! Has reservado los números: ${selectionToProcess.sort().join(', ')}. Total a pagar: $${total.toLocaleString()}. ${payMsg} Envía el comprobante por este medio.`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgBuyer)}`, '_blank');
        }, 2000);

    } catch (e) { alert("Error al guardar reserva"); }
};

// --- ACCIONES ADMIN ---
window.setNumberStatus = async (newStatus) => {
    const newName = document.getElementById('admin-edit-name').value;
    const newPhone = document.getElementById('admin-edit-phone').value;
    const selectionToProcess = [...selectedNumbers];
    const batch = db.batch();
    const phonesToNotify = new Map();

    closeModals();
    selectedNumbers = [];
    updateUI();

    selectionToProcess.forEach(id => {
        const updateData = { status: newStatus };
        if (newStatus === 'free') {
            const data = numbersData[id] || {};
            if (data.phone) {
                const existing = phonesToNotify.get(data.phone) || { buyer: data.buyer, nums: [] };
                existing.nums.push(id);
                phonesToNotify.set(data.phone, existing);
            }
            updateData.buyer = firebase.firestore.FieldValue.delete();
            updateData.phone = firebase.firestore.FieldValue.delete();
            updateData.timestamp = firebase.firestore.FieldValue.delete();
        } else {
            updateData.buyer = newName;
            updateData.phone = newPhone;
        }
        batch.set(db.collection("numbers").doc(id), updateData, { merge: true });
    });

    try {
        await batch.commit();
        if (newStatus === 'free') {
            phonesToNotify.forEach((info, phone) => {
                const msg = `Hola ${info.buyer}, los números ${info.nums.join(', ')} han sido LIBERADOS.`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            });
        }
    } catch (e) { alert("Error"); }
};

document.getElementById('btn-admin-save-data').onclick = async () => {
    const newName = document.getElementById('admin-edit-name').value;
    const newPhone = document.getElementById('admin-edit-phone').value;
    const selectionToProcess = [...selectedNumbers];
    const batch = db.batch();

    closeModals();
    selectedNumbers = [];
    updateUI();

    selectionToProcess.forEach(id => {
        batch.update(db.collection("numbers").doc(id), { buyer: newName, phone: newPhone });
    });

    try {
        await batch.commit();
    } catch (e) { alert("Error"); }
};

document.getElementById('btn-admin-wa-single').onclick = () => {
    const phone = document.getElementById('admin-edit-phone').value;
    const name = document.getElementById('admin-edit-name').value;
    if (phone) window.open(`https://wa.me/${phone}?text=Hola ${name}, contacto por la rifa...`, '_blank');
};

document.getElementById('btn-admin-login').onclick = () => {
    if (isAdmin) {
        isAdmin = false;
        btnAdminBroadcast.style.display = 'none';
        btnAdminSettings.style.display = 'none';
        document.body.classList.remove('admin-mode-active');
        selectedNumbers = [];
        updateUI();
    } else { modalAdminLogin.style.display = 'flex'; }
};

document.getElementById('btn-login-auth').onclick = async () => {
    const pass = document.getElementById('admin-pass-input').value;
    const doc = await db.collection("config").doc("main").get();
    if (pass === doc.data().adminPass) {
        isAdmin = true;
        btnAdminBroadcast.style.display = 'block';
        btnAdminSettings.style.display = 'block';
        document.body.classList.add('admin-mode-active');
        selectedNumbers = [];
        updateUI();
        closeModals();
    } else { alert("Error"); }
};

btnAdminBroadcast.onclick = () => { modalAdminBroadcast.style.display = 'flex'; };
document.getElementById('btn-send-broadcast').onclick = () => {
    const msg = document.getElementById('broadcast-msg').value;
    if (!msg) return;
    const phones = new Set();
    Object.values(numbersData).forEach(n => { if (n.phone) phones.add(n.phone); });
    phones.forEach(p => window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank'));
    closeModals();
};

btnAdminSettings.onclick = () => { modalAdminSettings.style.display = 'flex'; };
document.getElementById('btn-save-admin-config').onclick = async () => {
    const newWA = document.getElementById('admin-config-whatsapp').value;
    const newPayment = document.getElementById('admin-config-payment').value;
    const newCash = document.getElementById('admin-config-cash').value;
    if (!newWA) return alert("Ingresa un número válido");
    try {
        await db.collection("config").doc("main").set({ 
            adminWhatsApp: newWA, 
            paymentInfo: newPayment,
            cashInfo: newCash
        }, { merge: true });
        alert("Configuración guardada");
        closeModals();
    } catch (e) { alert("Error al guardar"); }
};

// --- REPORTE AUTOMÁTICO ---
function setupAutoReport() {
    db.collection("numbers").onSnapshot((snapshot) => {
        if (isInitialLoad) {
            isInitialLoad = false;
            return;
        }

        let reporte = "*REPORTE DE CAMBIO EN BASE DE DATOS*\n\n";
        let hayDatos = false;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
                const d = change.doc.data();
                const id = change.doc.id;
                reporte += `📌 *Número:* ${id}\n   - Estado: ${d.status}\n   - Comprador: ${d.buyer || 'Sin nombre'}\n\n`;
                hayDatos = true;
            }
        });

        if (hayDatos) {
            // El mensaje se envía a tu número personal Luis
            const urlReporte = `https://wa.me/573186171011?text=${encodeURIComponent(reporte)}`;
            window.open(urlReporte, '_blank');
        }
    });
}

window.closeModals = () => {
    modalUser.style.display = 'none';
    modalAdminLogin.style.display = 'none';
    modalAdminAction.style.display = 'none';
    modalAdminBroadcast.style.display = 'none';
    modalAdminSettings.style.display = 'none';
    modalImageFull.style.display = 'none';
    document.getElementById('modal-buyer-status').style.display = 'none';
    document.getElementById('modal-list-report').style.display = 'none';
};

function updateMiniStats() {
    const values = Object.values(numbersData);
    const total = 100;
    const sold = values.filter(n => n.status === 'sold').length;
    const reserved = values.filter(n => n.status === 'reserved').length;
    const free = total - sold - reserved;
    document.getElementById('sold-display').innerText = sold;
    document.getElementById('reserved-display').innerText = reserved;
    document.getElementById('free-display').innerText = free;
}

let currentReportFilter = 'all';

window.filterReport = (filter) => {
    currentReportFilter = filter;
    document.querySelectorAll('.list-filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`filter-${filter}`).classList.add('active');
    renderReportList();
};

function renderReportList() {
    const container = document.getElementById('report-list');
    const allNums = [];

    for (let i = 0; i < 100; i++) {
        const id = i.toString().padStart(2, '0');
        const data = numbersData[id] || { status: 'free' };
        allNums.push({ id, ...data });
    }

    const filtered = currentReportFilter === 'all'
        ? allNums.filter(n => n.status !== 'free')
        : allNums.filter(n => n.status === currentReportFilter);

    const sorted = filtered.sort((a, b) => {
        const order = { sold: 0, reserved: 1, free: 2 };
        return (order[a.status] ?? 2) - (order[b.status] ?? 2) || a.id.localeCompare(b.id);
    });

    if (sorted.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: var(--text-secondary); padding: 20px; font-size: 0.85rem;">No hay números en este estado.</p>`;
        return;
    }

    const statusLabel = { sold: 'VENDIDO', reserved: 'APARTADO', free: 'LIBRE' };
    container.innerHTML = sorted.map(n => `
        <div class="report-row">
            <div class="report-num-badge ${n.status}">${n.id}</div>
            <div class="report-buyer">
                <div class="report-buyer-name">${n.buyer || (n.status === 'free' ? '—' : 'Sin nombre')}</div>
                <div class="report-buyer-phone">${n.phone || (n.status === 'free' ? 'Disponible' : 'Sin teléfono')}</div>
            </div>
            <span class="report-status-pill ${n.status}">${statusLabel[n.status] || n.status}</span>
        </div>
    `).join('');
}

function openListReport() {
    const values = Object.values(numbersData);
    const sold = values.filter(n => n.status === 'sold').length;
    const reserved = values.filter(n => n.status === 'reserved').length;
    const total = sold + reserved;
    const free = 100 - total;

    document.getElementById('report-sold').innerText = sold;
    document.getElementById('report-sold-money').innerText = `$${(sold * 20000).toLocaleString()}`;
    document.getElementById('report-reserved').innerText = reserved;
    document.getElementById('report-reserved-money').innerText = `$${(reserved * 20000).toLocaleString()}`;
    document.getElementById('report-total').innerText = total;
    document.getElementById('report-total-money').innerText = `$${(total * 20000).toLocaleString()}`;
    document.getElementById('report-free').innerText = free;

    currentReportFilter = 'all';
    document.querySelectorAll('.list-filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('filter-all').classList.add('active');
    renderReportList();

    document.getElementById('modal-list-report').style.display = 'flex';
}

document.getElementById('btn-list-report').onclick = openListReport;

init();