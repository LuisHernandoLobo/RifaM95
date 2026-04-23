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

let selectedNumbers = [];
let adminWhatsApp = "";
let numbersData = {};
let isAdmin = false;
let isInitialLoad = true;

function init() {
    generateGrid();
    loadConfig();
    listenToNumbers();
    setupAutoReport();
}

function generateGrid() {
    const grid = document.getElementById('raffle-grid');
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

function handleCellClick(id) {
    const data = numbersData[id] || { status: 'free' };
    if (data.status !== 'free' && !isAdmin) {
        highlightBuyerGroup(data.buyer, data.phone);
        return;
    }
    // Lógica normal de selección
    if (selectedNumbers.includes(id)) {
        selectedNumbers = selectedNumbers.filter(n => n !== id);
        updateCellVisual(id, false);
    } else {
        selectedNumbers.push(id);
        updateCellVisual(id, true);
    }
    updateUI();
}

// NUEVA VENTANA DE ESTADO DETALLADA
function highlightBuyerGroup(buyer, phone) {
    if (!buyer || !phone) return;
    const reservedNums = [];
    const soldNums = [];

    Object.keys(numbersData).forEach(id => {
        const data = numbersData[id];
        if (data.buyer === buyer && data.phone === phone) {
            if (data.status === 'reserved') reservedNums.push(id);
            if (data.status === 'sold') soldNums.push(id);
        }
    });

    document.getElementById('status-buyer-name').innerText = buyer.toUpperCase();
    document.getElementById('status-buyer-count').innerText = `${reservedNums.length + soldNums.length} números en total`;

    const containerRes = document.getElementById('container-status-reserved');
    const gridRes = document.getElementById('grid-reserved');
    if (reservedNums.length > 0) {
        containerRes.style.display = 'block';
        gridRes.innerHTML = reservedNums.sort().map(num => `<div class="number-cell reserved"><span class="cell-number">${num}</span></div>`).join('');
        document.getElementById('msg-reserved').innerText = `Por favor enviar el soporte de pago por $${(reservedNums.length * 20000).toLocaleString()}`;
    } else { containerRes.style.display = 'none'; }

    const containerSold = document.getElementById('container-status-sold');
    const gridSold = document.getElementById('grid-sold');
    if (soldNums.length > 0) {
        containerSold.style.display = 'block';
        gridSold.innerHTML = soldNums.sort().map(num => `<div class="number-cell sold"><span class="cell-number" style="color:#000">${num}</span></div>`).join('');
    } else { containerSold.style.display = 'none'; }

    document.getElementById('modal-buyer-status').style.display = 'flex';
}

// ENVÍO DE WHATSAPP MEJORADO
document.getElementById('btn-confirm-reserve').onclick = async () => {
    const name = document.getElementById('user-name').value;
    const phone = document.getElementById('user-whatsapp').value;
    if (!name || !phone) return alert("Datos incompletos");

    const selection = [...selectedNumbers];
    const total = selection.length * 20000;
    
    // Guardar en Firebase...
    const batch = db.batch();
    selection.forEach(num => batch.set(db.collection("numbers").doc(num), { status: 'reserved', buyer: name, phone: phone }, { merge: true }));
    await batch.commit();

    // Mensajes
    window.open(`https://wa.me/${adminWhatsApp}?text=${encodeURIComponent("Hola Luis, aparté los números: " + selection.join(', '))}`, '_blank');
    
    setTimeout(() => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent("¡Hola " + name + "! Reservaste: " + selection.join(', ') + ". Total: $" + total.toLocaleString() + ". Por favor envía el soporte.")}`, '_blank');
    }, 2000);

    closeModals();
    selectedNumbers = [];
    updateUI();
};

// REPORTE AL 3186171011
function setupAutoReport() {
    db.collection("numbers").onSnapshot((snapshot) => {
        if (isInitialLoad) { isInitialLoad = false; return; }
        let cambios = "";
        snapshot.docChanges().forEach(change => {
            if (change.type === "modified") {
                const d = change.doc.data();
                cambios += `Num: ${change.doc.id} -> ${d.status} (${d.buyer})\n`;
            }
        });
        if (cambios) window.open(`https://wa.me/573186171011?text=${encodeURIComponent("*ACTUALIZACIÓN RIFA*\n" + cambios)}`, '_blank');
    });
}

window.closeModals = () => {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
};

init();