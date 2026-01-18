/**
 * SAUDI IQAMA STUDIO PRO - FINAL 
 * Features: Free Crop, Delete Option, Pagination, Big Print
 */

const DB_NAME = 'IqamaStudioDB_Final_V3';
const db = new Dexie(DB_NAME);
db.version(1).stores({ cards: '++id, blob, cropData' });

const state = { cards: [], activeIndex: -1, cropper: null };

const els = {
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
    btnDlZip: document.getElementById('btnDlZip'),
    btnDlJpg: document.getElementById('btnDlJpg')
};

window.addEventListener('DOMContentLoaded', async () => {
    await loadFromDB();
    setupEventListeners();
});

async function loadFromDB() {
    state.cards = await db.cards.toArray();
    renderThumbnails();
    if (state.cards.length > 0) selectCard(state.cards.length - 1);
    else resetEditor();
    updatePaginationUI();
}

async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showToast(`Loading ${files.length} images...`);

    for (const file of files) {
        const blob = await fileToDataURL(file);
        const id = await db.cards.add({ blob: blob, cropData: null });
        state.cards.push({ id, blob, cropData: null });
    }
    
    renderThumbnails();
    selectCard(state.cards.length - 1);
    updatePaginationUI();
    showToast("Upload Successful!");
}

function fileToDataURL(file) {
    return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(file); });
}

// --- THUMBNAILS WITH DELETE BUTTON ---
function renderThumbnails() {
    els.thumbStrip.innerHTML = '';
    state.cards.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = `thumb-item ${index === state.activeIndex ? 'active' : ''}`;
        
        // Image & Badge
        let html = `<img src="${card.blob}" onclick="selectCard(${index})">
                    <div class="thumb-badge">${index + 1}</div>`;
        
        // Delete Button (X)
        html += `<div class="thumb-delete" onclick="deleteCard(event, ${index})">
                    <i class="fa-solid fa-xmark"></i>
                 </div>`;
                 
        div.innerHTML = html;
        els.thumbStrip.appendChild(div);
    });
}

// --- DELETE LOGIC ---
async function deleteCard(e, index) {
    e.stopPropagation(); // Stop clicking the card itself
    
    if(!confirm("Delete this image?")) return;

    const cardId = state.cards[index].id;
    
    // 1. Remove from DB
    await db.cards.delete(cardId);
    
    // 2. Remove from State
    state.cards.splice(index, 1);
    
    // 3. Handle Active Index Shift
    if (state.cards.length === 0) {
        state.activeIndex = -1;
        resetEditor();
    } else if (index === state.activeIndex) {
        // If deleted current, go to previous or 0
        const newIndex = index > 0 ? index - 1 : 0;
        selectCard(newIndex);
    } else if (index < state.activeIndex) {
        // If deleted one before current, shift index down
        state.activeIndex--;
        renderThumbnails(); // Just re-render thumbs, keep current editor
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

    state.cropper = new Cropper(els.editorImage, {
        viewMode: 1, 
        dragMode: 'crop', 
        aspectRatio: NaN, 
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

async function handleDownloadZip() {
    if (state.cards.length === 0) return;
    showToast("Zipping...");
    const zip = new JSZip();
    const folder = zip.folder("Scans");
    for (let i = 0; i < state.cards.length; i++) {
        const imgUrl = await getHighResCrop(state.cards[i]);
        folder.file(`Scan_${i+1}.jpg`, imgUrl.split(',')[1], {base64: true});
    }
    zip.generateAsync({type:"blob"}).then(c => { saveAs(c, "Batch_Scans.zip"); showToast("Done!"); });
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
    els.btnDlJpg.onclick = async () => { if(state.activeIndex > -1) { const url = await getHighResCrop(state.cards[state.activeIndex]); const a = document.createElement('a'); a.href = url; a.download = 'Scan.jpg'; a.click(); }};
    document.addEventListener('keydown', (e) => {
        if(e.key === 'ArrowLeft') handlePrev();
        if(e.key === 'ArrowRight') handleNext();
    });
}

function showToast(msg) {
    els.toastMsg.innerText = msg; els.toast.classList.remove('translate-x-[150%]');
    setTimeout(() => els.toast.classList.add('translate-x-[150%]'), 3000);
}