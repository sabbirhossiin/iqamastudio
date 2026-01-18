/**
 * SAUDI IQAMA STUDIO PRO (FINAL GITHUB VERSION)
 * Features: Password Lock, Free Crop, Big Print, Original Filenames
 */

const APP_PASSWORD = "5544332211"; // ACCESS PIN
const DB_NAME = 'IqamaStudioDB_GitHub_V1';
const db = new Dexie(DB_NAME);
// Updated Store: 'name' added for filename retention
db.version(1).stores({ cards: '++id, blob, name, cropData' });

const state = { cards: [], activeIndex: -1, cropper: null };

// UI Elements
const els = {
    // Login
    loginOverlay: document.getElementById('loginOverlay'),
    passwordInput: document.getElementById('passwordInput'),
    btnLogin: document.getElementById('btnLogin'),
    loginError: document.getElementById('loginError'),
    appContent: document.getElementById('appContent'),
    btnLogout: document.getElementById('btnLogout'),

    // App
    fileInput: document.getElementById('fileInput'),
    thumbStrip: document.getElementById('thumbnailStrip'),
    editorImage: document.getElementById('editorImage'),
    cropperWrapper: document.getElementById('cropperWrapper'),
    emptyState: document.getElementById('emptyState'),
    previewCard: document.getElementById('previewCard'),
    zoomRange: document.getElementById('zoomRange'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg'),
    printArea: document.getElementById('printArea'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    imageCounter: document.getElementById('imageCounter'),
    btnRotate: document.getElementById('btnRotate'),
    btnReset: document.getElementById('btnReset'),
    btnPrint: document.getElementById('btnPrint'),
    btnDlZip: document.getElementById('btnDlZip')
};

// --- AUTHENTICATION ---
function checkAuth() {
    const isAuth = localStorage.getItem('isIqamaLoggedIn');
    if (isAuth === 'true') {
        unlockApp();
    }
}

function unlockApp() {
    els.loginOverlay.classList.add('hidden');
    els.appContent.classList.remove('opacity-0');
    initApp();
}

function handleLogin() {
    if (els.passwordInput.value === APP_PASSWORD) {
        localStorage.setItem('isIqamaLoggedIn', 'true');
        unlockApp();
    } else {
        els.loginError.classList.remove('hidden');
        els.passwordInput.value = '';
        els.passwordInput.focus();
    }
}

function handleLogout() {
    localStorage.removeItem('isIqamaLoggedIn');
    location.reload();
}

// --- APP INIT ---
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Auth Events
    els.btnLogin.addEventListener('click', handleLogin);
    els.passwordInput.addEventListener('keypress', e => { if(e.key==='Enter') handleLogin(); });
    els.btnLogout.addEventListener('click', handleLogout);

    setupEventListeners();
});

async function initApp() {
    await loadFromDB();
}

async function loadFromDB() {
    state.cards = await db.cards.toArray();
    renderThumbnails();
    if (state.cards.length > 0) selectCard(state.cards.length - 1);
    updatePaginationUI();
}

async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showToast(`Loading ${files.length} images...`);

    for (const file of files) {
        const blob = await fileToDataURL(file);
        // Save Original Filename
        const fileName = file.name;
        
        const id = await db.cards.add({ blob: blob, name: fileName, cropData: null });
        state.cards.push({ id, blob, name: fileName, cropData: null });
    }
    
    renderThumbnails();
    selectCard(state.cards.length - 1);
    updatePaginationUI();
    showToast("Upload Successful!");
}

function fileToDataURL(file) {
    return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(file); });
}

function renderThumbnails() {
    els.thumbStrip.innerHTML = '';
    state.cards.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = `thumb-item ${index === state.activeIndex ? 'active' : ''}`;
        
        const displayName = card.name.length > 10 ? card.name.substring(0, 8) + '...' : card.name;
        
        div.innerHTML = `
            <img src="${card.blob}" onclick="selectCard(${index})" title="${card.name}">
            <div class="thumb-badge">${index + 1}</div>
            <div class="absolute top-0 left-0 w-full bg-black/50 text-[8px] text-white text-center p-0.5 truncate pointer-events-none">${displayName}</div>
            <div class="thumb-delete" onclick="deleteCard(event, ${index})"><i class="fa-solid fa-xmark"></i></div>
        `;
        els.thumbStrip.appendChild(div);
    });
}

async function deleteCard(e, index) {
    e.stopPropagation();
    if(!confirm("Delete this image?")) return;
    const cardId = state.cards[index].id;
    await db.cards.delete(cardId);
    state.cards.splice(index, 1);
    
    if (state.cards.length === 0) {
        state.activeIndex = -1;
        resetEditor();
    } else if (index === state.activeIndex) {
        const newIndex = index > 0 ? index - 1 : 0;
        selectCard(newIndex);
    } else if (index < state.activeIndex) {
        state.activeIndex--;
        renderThumbnails();
        updatePaginationUI();
    } else {
        renderThumbnails();
    }
    showToast("Deleted");
}

function resetEditor() {
    if (state.cropper) state.cropper.destroy();
    els.emptyState.classList.remove('hidden');
    els.cropperWrapper.classList.add('hidden');
    els.imageCounter.innerText = "0 / 0";
    els.previewCard.innerHTML = `<div class="w-[90%] h-auto border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 p-2"><span class="text-gray-300 text-xs font-bold">PREVIEW</span></div>`;
    renderThumbnails();
}

function selectCard(index) {
    if (index < 0 || index >= state.cards.length) return;

    if (state.cropper) state.cropper.destroy();
    state.activeIndex = index;
    renderThumbnails();
    updatePaginationUI();

    const card = state.cards[index];
    els.emptyState.classList.add('hidden');
    els.cropperWrapper.classList.remove('hidden');
    els.editorImage.src = card.blob;

    // --- FREE CROP (CAMSCANNER STYLE) ---
    state.cropper = new Cropper(els.editorImage, {
        viewMode: 1, 
        dragMode: 'crop', 
        aspectRatio: NaN, // Free Crop
        autoCropArea: 0.9, 
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready() {
            if (card.cropData) this.cropper.setData(card.cropData);
            updatePreview();
        },
        cropend() { saveCropData(); updatePreview(); },
        zoom() { els.zoomRange.value = state.cropper.getImageData().ratio; saveCropData(); }
    });
    els.zoomRange.value = 1;
}

function updatePaginationUI() {
    const total = state.cards.length;
    const current = state.activeIndex + 1;
    els.imageCounter.innerText = total === 0 ? "0 / 0" : `${current} / ${total}`;
    els.btnPrev.disabled = state.activeIndex <= 0;
    els.btnNext.disabled = state.activeIndex >= total - 1;
}

function handleNext() { if (state.activeIndex < state.cards.length - 1) selectCard(state.activeIndex + 1); }
function handlePrev() { if (state.activeIndex > 0) selectCard(state.activeIndex - 1); }

async function saveCropData() {
    if (!state.cropper) return;
    const data = state.cropper.getData();
    state.cards[state.activeIndex].cropData = data;
    await db.cards.update(state.cards[state.activeIndex].id, { cropData: data });
}

function updatePreview() {
    if (!state.cropper) return;
    const canvas = state.cropper.getCroppedCanvas({ width: 1000, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
    if (canvas) {
        els.previewCard.innerHTML = '';
        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'contain';
        els.previewCard.appendChild(img);
    }
}

// --- PRINT LOGIC (BIG A4) ---
async function handlePrint() {
    if (state.cards.length === 0) return showToast("No images!");
    showToast("Generating Pages...");
    els.printArea.innerHTML = '';

    for (const card of state.cards) {
        const imgUrl = await getHighResCrop(card);
        const page = document.createElement('div');
        page.className = 'print-page';
        page.innerHTML = `<img src="${imgUrl}" class="print-image-large">`;
        els.printArea.appendChild(page);
    }
    setTimeout(() => window.print(), 800);
}

// --- ZIP DOWNLOAD (ORIGINAL NAMES) ---
async function handleDownloadZip() {
    if (state.cards.length === 0) return;
    showToast("Zipping...");
    const zip = new JSZip();
    const folder = zip.folder("Iqama_Scans");
    
    for (let i = 0; i < state.cards.length; i++) {
        const card = state.cards[i];
        const imgUrl = await getHighResCrop(card);
        
        // Preserve Filename
        let finalName = card.name;
        // Ensure .jpg extension since we export as JPEG
        if (!finalName.includes('.')) {
            finalName += '.jpg';
        } else {
            finalName = finalName.substring(0, finalName.lastIndexOf('.')) + '.jpg';
        }
        
        folder.file(finalName, imgUrl.split(',')[1], {base64: true});
    }
    
    zip.generateAsync({type:"blob"}).then(c => { saveAs(c, "Iqama_Batch_Scans.zip"); showToast("Done!"); });
}

async function getHighResCrop(card) {
    return new Promise(resolve => {
        if (state.activeIndex > -1 && card.id === state.cards[state.activeIndex].id && state.cropper) {
            resolve(state.cropper.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }).toDataURL('image/jpeg', 1.0));
            return;
        }
        const img = new Image(); img.src = card.blob;
        img.onload = () => {
            const div = document.createElement('div'); div.appendChild(img); document.body.appendChild(div);
            const c = new Cropper(img, {
                viewMode: 1, checkCrossOrigin: false,
                ready() {
                    if (card.cropData) c.setData(card.cropData); else c.setCropBoxData({ width: img.width, height: img.height });
                    resolve(c.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }).toDataURL('image/jpeg', 1.0));
                    c.destroy(); div.remove();
                }
            });
        };
    });
}

function setupEventListeners() {
    els.fileInput.addEventListener('change', handleUpload);
    els.btnPrev.onclick = handlePrev;
    els.btnNext.onclick = handleNext;
    els.btnRotate.onclick = () => state.cropper?.rotate(90);
    els.btnReset.onclick = () => state.cropper?.reset();
    els.zoomRange.oninput = (e) => state.cropper?.zoomTo(e.target.value);
    els.btnPrint.onclick = handlePrint;
    els.btnDlZip.onclick = handleDownloadZip;
    
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('loginOverlay').classList.contains('hidden')) {
            if(e.key === 'ArrowLeft') handlePrev();
            if(e.key === 'ArrowRight') handleNext();
        }
    });
}

function showToast(msg) {
    els.toastMsg.innerText = msg; els.toast.classList.remove('translate-x-[150%]');
    setTimeout(() => els.toast.classList.add('translate-x-[150%]'), 3000);
}
