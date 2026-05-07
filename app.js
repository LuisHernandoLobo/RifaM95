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
const btnAdminDraw = document.getElementById('btn-admin-draw');
const modalAdminDraw = document.getElementById('modal-admin-draw');
const modalUser = document.getElementById('modal-user');
const modalAdminLogin = document.getElementById('modal-admin-login');
const modalAdminAction = document.getElementById('modal-admin-action');
const modalAdminBroadcast = document.getElementById('modal-admin-broadcast');
const modalAdminSettings = document.getElementById('modal-admin-settings');
const modalImageFull = document.getElementById('modal-image-full');
const footerActions = document.querySelector('.footer-actions');

let selectedNumbers = [];
let adminWhatsApp = "";
let adminPaymentInfo = "";
let adminCashInfo = "";
let isAdmin = false;
let numbersData = {};
let lastHighlightedBuyer = null;
let isInitialLoad = true; // Control para el reporte automático

// --- LOGS Y BACKUP ---
async function saveLog(action, numbers, details) {
    try {
        await db.collection("logs").add({
            timestamp: new Date(),
            action: action, // 'reserve', 'sold', 'free', 'update', 'restore'
            numbers: numbers,
            buyer: details.buyer || "",
            phone: details.phone || "",
            admin: isAdmin
        });
    } catch (e) { console.error("Error log:", e); }
}

// --- INICIALIZACIÓN ---
function init() {
    generateGrid();
    loadConfig();
    listenToNumbers();

    // Lógica mejorada de Splash Screen
    const splash = document.getElementById('splash-screen');
    const splashImg = splash ? splash.querySelector('img') : null;

    const hideSplash = () => {
        setTimeout(() => {
            if (splash) splash.classList.add('hidden');
        }, 2000); // 2 segundos para permitir la lectura
    };

    if (splashImg) {
        if (splashImg.complete) {
            hideSplash();
        } else {
            splashImg.onload = hideSplash;
            // Backup por si la imagen falla o demora demasiado
            setTimeout(hideSplash, 2000);
        }
    }

    // Vincular botones de sorteo
    btnAdminDraw.onclick = () => { modalAdminDraw.style.display = 'flex'; };
    document.getElementById('btn-celebrate-winner').onclick = async () => {
        const winInput = document.getElementById('draw-winner-num');
        let winNum = winInput.value;
        if (winNum === "") {
            // Si el input está vacío, podemos limpiar el ganador en la DB
            if (confirm("¿Deseas limpiar el número ganador de la base de datos?")) {
                await db.collection("config").doc("main").update({ winner: firebase.firestore.FieldValue.delete() });
                closeModals();
            }
            return;
        }
        winNum = winNum.toString().padStart(2, '0');
        
        try {
            await db.collection("config").doc("main").set({ winner: winNum }, { merge: true });
            saveLog('draw_winner', [winNum], { buyer: 'ADMIN_DRAW' });
            closeModals();
        } catch (e) { alert("Error al guardar ganador"); }
    };

    function celebrate(num) {
        // Sonido
        const sound = document.getElementById('win-sound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log("Audio block:", e));
        }

        // Confeti
        const duration = 15 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } });
        }, 250);
    }

    document.getElementById('btn-export-backup').onclick = () => {
        const fullBackup = {};
        for (let i = 0; i < 100; i++) {
            const id = i.toString().padStart(2, '0');
            // Si el número existe en numbersData lo usamos, si no, creamos un objeto 'free'
            fullBackup[id] = numbersData[id] || { status: 'free' };
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `rifa_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    document.getElementById('btn-import-backup-trigger').onclick = () => {
        document.getElementById('import-backup-file').click();
    };

    document.getElementById('import-backup-file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (confirm("¿ESTÁS SEGURO? Esto sobrescribirá los 100 números con los datos del archivo.")) {
                    const batch = db.batch();
                    for(let i=0; i<100; i++) {
                        const id = i.toString().padStart(2, '0');
                        const ref = db.collection("numbers").doc(id);
                        if (data[id]) {
                            batch.set(ref, data[id]);
                        } else {
                            batch.set(ref, { status: 'free' });
                        }
                    }
                    await batch.commit();
                    alert("Base de datos restaurada correctamente");
                    saveLog('restore', Object.keys(data), { buyer: 'ADMIN_BACKUP' });
                }
            } catch (err) { alert("Error al procesar el archivo JSON"); }
        };
        reader.readAsText(file);
    };
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
            const isSelected = selectedNumbers.includes(doc.id);
            updateCellVisual(doc.id, isSelected);
        });
        updateMiniStats();
    });
}

let currentWinner = null;

function loadConfig() {
    db.collection("config").doc("main").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            // Sanitizar el número de WhatsApp: solo números
            adminWhatsApp = (data.adminWhatsApp || "").replace(/\D/g, "");
            adminPaymentInfo = data.paymentInfo || "";
            adminCashInfo = data.cashInfo || "";
            
            document.getElementById('admin-config-whatsapp').value = adminWhatsApp;
            document.getElementById('admin-config-payment').value = adminPaymentInfo;
            document.getElementById('admin-config-cash').value = adminCashInfo;
            
            // Mostrar medio de pago completo (ej: "Nequi 3001234567")
            // Tomamos la primera línea o el primer medio detectado
            const firstLine = adminPaymentInfo.split('\n')[0] || "Consultar medios";
            document.getElementById('header-nequi-val').innerText = firstLine.trim();
            
            // Manejo del Ganador
            const newWinner = data.winner || null;
            console.log("Ganador detectado en DB:", newWinner);
            
            // Quitar resaltado previo
            if (currentWinner && currentWinner !== newWinner) {
                const oldCell = document.getElementById(`cell-${currentWinner}`);
                if (oldCell) oldCell.classList.remove('winner-highlight');
            }

            currentWinner = newWinner;

            if (currentWinner) {
                const winCell = document.getElementById(`cell-${currentWinner}`);
                if (winCell) {
                    console.log("Aplicando resaltado a celda:", currentWinner);
                    winCell.classList.add('winner-highlight');
                    if (newWinner !== currentWinner) {
                        celebrate(currentWinner);
                        winCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
            
            // Forzar actualización visual de todas las celdas para asegurar que el ganador se vea
            Object.keys(numbersData).forEach(id => updateCellVisual(id, selectedNumbers.includes(id)));
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
            <div class="number-cell reserved">
                <span class="cell-number">${num}</span>
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
            <div class="number-cell sold">
                <span class="cell-number">${num}</span>
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

    // Aplicar resaltado de ganador siempre
    if (currentWinner && id === currentWinner) {
        cell.classList.add('winner-highlight');
    } else {
        cell.classList.remove('winner-highlight');
    }
}

function updateUI() {
    const values = Object.values(numbersData);
    const soldCount = values.filter(n => n.status === 'sold').length;
    const reservedCount = values.filter(n => n.status === 'reserved').length;
    const totalOccupancy = soldCount + reservedCount;
    
    // Ocultar footer si está lleno y no es admin
    if (!isAdmin && totalOccupancy >= 100) {
        footerActions.style.display = 'none';
    } else {
        footerActions.style.display = 'flex';
    }

    const count = selectedNumbers.length;
    const total = count * 20000;
    
    // Nueva barra de selección inferior
    const selectionBar = document.getElementById('selection-bar');
    if (count > 0) {
        selectionBar.style.display = 'flex';
        document.getElementById('sel-list-display').innerText = selectedNumbers.sort().join(', ');
        document.getElementById('total-display-footer').innerText = `$${total.toLocaleString()}`;
    } else {
        selectionBar.style.display = 'none';
    }

    btnReserveTrigger.disabled = (count === 0 && !isAdmin);
    
    let baseText = "";
    const contrastTextColor = "var(--bg-primary)"; 
    
    if (isAdmin) {
        baseText = count > 0 ? `GESTIONAR ELEGIDOS` : "SELECCIONA NÚMEROS";
    } else {
        baseText = count > 0 ? `RESERVAR AHORA` : "ELIGE TUS NÚMEROS";
    }

    const separator = window.innerWidth < 600 ? '<br>' : '   —   ';
    const percentColor = "rgba(2, 6, 23, 0.7)"; 
    
    btnReserveTrigger.innerHTML = `<span>${baseText}</span>${separator}<span style="font-size: 0.85em; color: ${percentColor}; font-weight: 900;">OCUPADO EL ${totalOccupancy}%</span>`;
    
    const colorSold = "var(--accent-green)";
    const colorReserved = "var(--accent-yellow)";
    const colorFree = "var(--accent-blue)";

    const pSold = soldCount;
    const pReserved = soldCount + reservedCount;

    btnReserveTrigger.style.background = `linear-gradient(to right, 
        ${colorSold} 0%, ${colorSold} ${pSold}%, 
        ${colorReserved} ${pSold}%, ${colorReserved} ${pReserved}%, 
        ${colorFree} ${pReserved}%, ${colorFree} 100%)`;
    btnReserveTrigger.style.color = contrastTextColor;
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

    if (!adminWhatsApp) {
        alert("El administrador aún no ha configurado su WhatsApp. Por favor, intenta más tarde o contacta por otro medio.");
        return;
    }

    const btn = document.getElementById('btn-confirm-reserve');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";
    
    const selectionToProcess = [...selectedNumbers];
    const total = selectionToProcess.length * 20000;
    const now = new Date().toLocaleString();

    const batch = db.batch();
    selectionToProcess.forEach(num => {
        batch.set(db.collection("numbers").doc(num), { status: 'reserved', buyer: name, phone: phone, timestamp: new Date() }, { merge: true });
    });

    try {
        await batch.commit();
        saveLog('reserve', selectionToProcess, { buyer: name, phone: phone });
        
        const sortedNums = selectionToProcess.sort().join(', ');
        const isPlural = selectionToProcess.length > 1;
        const textNum = isPlural ? 'los números' : 'el número';
        const totalFmt = total.toLocaleString();

        // MENSAJE UNIFICADO (Se envía al Administrador, pero sirve de recordatorio al Cliente)
        let payMsg = `💰 *Puedes realizar tu pago aquí:* \n${adminPaymentInfo}`;
        if (adminCashInfo) payMsg += `\n\n💵 *O en efectivo con:* \n${adminCashInfo}`;

        const msgFull = `✅ *NUEVA RESERVA DE RIFA*\n\nHola, soy *${name}*.\nHe apartado ${textNum}: *${sortedNums}*.\n\n💵 *Total a pagar:* *$${totalFmt}*\n\n${payMsg}\n\n🙏 *Adjunto el comprobante de pago para confirmar mis números.*\n\n🚀 Consulta la tabla actualizada aquí:\nhttps://luishernandolobo.github.io/RifaM95/`;
        
        // Abrir WhatsApp dirigido al Administrador
        window.open(`https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(msgFull)}`, '_blank');
        
        closeModals();
        selectedNumbers = [];
        updateUI();

    } catch (e) { 
        alert("Error al guardar reserva: " + e.message); 
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// --- ACCIONES ADMIN ---
window.setNumberStatus = async (newStatus) => {
    const newName = document.getElementById('admin-edit-name').value;
    const newPhone = document.getElementById('admin-edit-phone').value;
    const selectionToProcess = [...selectedNumbers];
    const batch = db.batch();
    const phonesToNotify = new Map();

    if (newPhone) {
        phonesToNotify.set(newPhone, { 
            buyer: newName, 
            nums: selectionToProcess.sort().join(', '),
            isPlural: selectionToProcess.length > 1
        });
    }

    closeModals();
    selectedNumbers = [];
    updateUI();

    selectionToProcess.forEach(id => {
        const updateData = { status: newStatus };
        if (newStatus === 'free') {
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
        saveLog(newStatus, selectionToProcess, { buyer: newName, phone: newPhone });
        
        if (newStatus !== 'reserved') {
            phonesToNotify.forEach((info, phone) => {
                const textNum = info.isPlural ? 'Tus números' : 'Tu número';
                const estadoTxt = newStatus === 'sold' ? '✅ *PAGADO (Ya estás jugando)*' : '❌ *LIBERADO (Disponible nuevamente)*';
                
                const msg = `Hola *${info.buyer}*,\n\n${textNum} *${info.nums}* han cambiado de estado a:\n${estadoTxt}\n\n🚀 Puedes ver el estado de la rifa aquí:\nhttps://luishernandolobo.github.io/RifaM95/`;
                
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            });
        }
    } catch (e) { alert("Error al actualizar"); }
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
        saveLog('update_info', selectionToProcess, { buyer: newName, phone: newPhone });
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
        btnAdminDraw.style.display = 'none';
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
        btnAdminDraw.style.display = 'block';
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

// --- REPORTE AUTOMÁTICO DESACTIVADO ---
function setupAutoReport() { }

window.closeModals = () => {
    modalUser.style.display = 'none';
    modalAdminLogin.style.display = 'none';
    modalAdminAction.style.display = 'none';
    modalAdminBroadcast.style.display = 'none';
    modalAdminSettings.style.display = 'none';
    modalAdminDraw.style.display = 'none';
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
    
    updateUI(); // Sincronizar porcentaje
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

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: var(--text-secondary); padding: 20px; font-size: 0.85rem;">No hay números en este estado.</p>`;
        return;
    }

    // Agrupar por comprador
    const groups = {};
    filtered.forEach(n => {
        const buyerName = n.buyer || (n.status === 'free' ? 'LIBRES' : 'Sin nombre');
        const buyerPhone = n.phone || '';
        const key = buyerName + (buyerPhone ? `_${buyerPhone}` : '');
        
        if (!groups[key]) {
            groups[key] = {
                buyer: buyerName,
                phone: buyerPhone,
                numbers: [],
                mainStatus: n.status
            };
        }
        groups[key].numbers.push(n);
    });

    const sortedGroups = Object.values(groups).sort((a, b) => {
        const order = { sold: 0, reserved: 1, free: 2 };
        const statusDiff = (order[a.mainStatus] ?? 2) - (order[b.mainStatus] ?? 2);
        if (statusDiff !== 0) return statusDiff;
        return a.buyer.localeCompare(b.buyer);
    });

    const statusLabel = { sold: 'VENDIDO', reserved: 'APARTADO', free: 'LIBRE' };
    
    container.innerHTML = sortedGroups.map(g => `
        <div class="report-row" style="flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                <div class="report-buyer">
                    <div class="report-buyer-name" style="font-size: 0.95rem;">${g.buyer}</div>
                    ${g.phone ? `<div class="report-buyer-phone">${g.phone.length > 5 ? g.phone.slice(0, 3) + '****' + g.phone.slice(-3) : '****'}</div>` : ''}
                </div>
                <span class="report-status-pill ${g.mainStatus}" style="font-size: 0.6rem;">
                    ${g.numbers.length} ${g.numbers.length > 1 ? 'NÚMEROS' : 'NÚMERO'}
                </span>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${g.numbers.map(n => `
                    <div class="report-num-badge ${n.status}" style="width: 32px; height: 32px; font-size: 0.85rem; border-radius: 8px;">
                        ${n.id}
                    </div>
                `).join('')}
            </div>
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

window.exportReportText = () => {
    let content = "REPORTE DE VENTAS - RIFA LHLJ\n";
    content += "==========================================\n";
    content += `Fecha: ${new Date().toLocaleString()}\n`;
    content += "==========================================\n\n";

    const all = [];
    for (let i = 0; i < 100; i++) {
        const id = i.toString().padStart(2, '0');
        const data = numbersData[id] || { status: 'free' };
        all.push({ id, ...data });
    }

    const sold = all.filter(n => n.status === 'sold');
    const reserved = all.filter(n => n.status === 'reserved');

    content += "--- VENDIDOS ---\n";
    sold.forEach(n => {
        content += `${n.id} | ${n.buyer || 'Sin nombre'} | ${n.phone || '---'}\n`;
    });

    content += "\n--- APARTADOS ---\n";
    reserved.forEach(n => {
        content += `${n.id} | ${n.buyer || 'Sin nombre'} | ${n.phone || '---'}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_rifa_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

document.getElementById('btn-list-report').onclick = openListReport;

function copyToClipboard(element) {
    const text = document.getElementById('header-nequi-val').innerText;
    if (text === "Consultar" || text === "Cargando...") return;
    
    // Extraer solo los números para el portapapeles
    const onlyNumbers = text.replace(/\D/g, "");
    
    navigator.clipboard.writeText(onlyNumbers).then(() => {
        const originalHtml = element.innerHTML;
        element.style.background = "var(--accent-green)";
        element.style.color = "#020617";
        element.innerHTML = "<strong>¡COPIADO!</strong>";
        
        setTimeout(() => {
            element.style.background = "";
            element.style.color = "";
            element.innerHTML = originalHtml;
            // Necesitamos re-actualizar el número si cambió mientras estaba el mensaje de copiado
            const currentNequi = document.getElementById('header-nequi-val').innerText;
            if (currentNequi === "¡COPIADO!") {
                 loadConfig(); // Forzar recarga o simplemente esperar al siguiente snapshot
            }
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
}

init();