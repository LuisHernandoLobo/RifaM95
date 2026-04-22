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
let isAdmin = false;
let numbersData = {};
let lastHighlightedBuyer = null;

// --- INICIALIZACIÓN ---
function init() {
    generateGrid();
    loadConfig();
    listenToNumbers();
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
    });
}

function loadConfig() {
    db.collection("config").doc("main").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            adminWhatsApp = data.adminWhatsApp || "";
            adminPaymentInfo = data.paymentInfo || "Consultar con el administrador";
            document.getElementById('admin-config-whatsapp').value = adminWhatsApp;
            document.getElementById('admin-config-payment').value = adminPaymentInfo;
            // Mostrar en el encabezado
            document.getElementById('display-payment-info').innerText = adminPaymentInfo;
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
            Object.keys(numbersData).forEach(numId => {
                const n = numbersData[numId];
                if (n.buyer === buyer && n.phone === phone) {
                    if (!selectedNumbers.includes(numId)) {
                        selectedNumbers.push(numId);
                        updateCellVisual(numId, true);
                    }
                }
            });
        } else { toggleSelection(id); }
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
    document.querySelectorAll('.highlight-group').forEach(el => el.classList.remove('highlight-group'));
    if (lastHighlightedBuyer === buyer + phone) { lastHighlightedBuyer = null; return; }
    Object.keys(numbersData).forEach(id => {
        if (numbersData[id].buyer === buyer && numbersData[id].phone === phone) {
            const cell = document.getElementById(`cell-${id}`);
            if (cell) cell.classList.add('highlight-group');
        }
    });
    lastHighlightedBuyer = buyer + phone;
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
        
        // Mensaje para el ADMINISTRADOR
        const msgAdmin = `Hola, soy ${name}. Aparté los números: ${selectionToProcess.sort().join(', ')}. Total: $${total.toLocaleString()}. Fecha: ${now}`;
        window.open(`https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(msgAdmin)}`, '_blank');

        // Mensaje para el COMPRADOR (Trazabilidad e Instrucciones de pago)
        setTimeout(() => {
            const msgBuyer = `¡Hola ${name}! Has reservado los números: ${selectionToProcess.sort().join(', ')}. Total a pagar: $${total.toLocaleString()}. Por favor realiza tu consignación aquí: ${adminPaymentInfo}. Envía el comprobante por este medio.`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgBuyer)}`, '_blank');
        }, 1500);

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
        } else { updateData.buyer = newName; updateData.phone = newPhone; }
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
    try { await batch.commit(); } catch (e) { alert("Error"); }
};

document.getElementById('btn-admin-wa-single').onclick = () => {
    const phone = document.getElementById('admin-edit-phone').value;
    const name = document.getElementById('admin-edit-name').value;
    if (phone) window.open(`https://wa.me/${phone}?text=Hola ${name}, contacto rifa...`, '_blank');
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
    if (!newWA) return alert("Ingresa un número válido");
    try {
        await db.collection("config").doc("main").set({ adminWhatsApp: newWA, paymentInfo: newPayment }, { merge: true });
        alert("Configuración guardada");
        closeModals();
    } catch (e) { alert("Error al guardar"); }
};

window.closeModals = () => {
    modalUser.style.display = 'none';
    modalAdminLogin.style.display = 'none';
    modalAdminAction.style.display = 'none';
    modalAdminBroadcast.style.display = 'none';
    modalAdminSettings.style.display = 'none';
    modalImageFull.style.display = 'none';
};

init();
