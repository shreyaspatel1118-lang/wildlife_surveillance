const API_BASE = window.location.origin;
let detectionCount = 0;
let lastUpdateTime = null;
let autoRefreshInterval = null;
let detectionHistory = [];

function loadDetectionData() {
    const stored = localStorage.getItem('detectionData');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            detectionHistory = data.history || [];
            detectionCount = data.totalCount || 0;
            return true;
        } catch (e) {
            console.error('Error loading detection data:', e);
            return false;
        }
    }
    return false;
}

function saveDetectionData() {
    const data = { history: detectionHistory, totalCount: detectionCount, lastUpdated: new Date().toISOString() };
    localStorage.setItem('detectionData', JSON.stringify(data));
}

function addDetection(detections, timestamp) {
    const newDetection = { timestamp: timestamp, objects: detections, count: detections ? detections.length : 0 };
    detectionHistory.push(newDetection);
    detectionCount = detectionHistory.reduce((sum, d) => sum + d.count, 0);
    saveDetectionData();
}

function clearDetectionHistory() { detectionHistory = []; detectionCount = 0; localStorage.removeItem('detectionData'); updateStatus(); }

function startAutoRefresh() {
    autoRefreshInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/latest-results`);
            if (response.ok) {
                const data = await response.json();
                if (data.timestamp !== lastUpdateTime) {
                    lastUpdateTime = data.timestamp;
                    displayAnnotatedImage("/uploads/latest_annotated.jpg");
                    displayOriginalImage("/uploads/latest.jpg");
                    addDetection(data.detections, data.timestamp);
                    displayDetections(data.detections, data.human_detected);
                    updateStatus();
                    if (data.human_detected) {
                        showAlert(`⚠ Human detected. Wildlife detection skipped | Total: ${detectionCount}`, "error");
                    } else {
                        showAlert(`✓ New detection: ${data.detection_count || 0} object(s) found | Total: ${detectionCount}`, "success");
                    }
                }
            }
        } catch (error) { }
    }, 1000);
}

function stopAutoRefresh() { if (autoRefreshInterval) { clearInterval(autoRefreshInterval); autoRefreshInterval = null; } }

// Upload handling
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const uploadAlert = document.getElementById("uploadAlert");

uploadArea?.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); });
uploadArea?.addEventListener("dragleave", () => { uploadArea.classList.remove("dragover"); });
uploadArea?.addEventListener("drop", (e) => { e.preventDefault(); uploadArea.classList.remove("dragover"); const files = e.dataTransfer.files; if (files.length > 0) handleFile(files[0]); });
fileInput?.addEventListener("change", (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (!file.type.startsWith("image/")) { showAlert("Please select a valid image file", "error"); return; }
    if (file.size > 50 * 1024 * 1024) { showAlert("Image too large. Max 50MB allowed", "error"); return; }
    const reader = new FileReader();
    reader.onload = (e) => { displayOriginalImageData(e.target.result); uploadImage(file); };
    reader.readAsDataURL(file);
}

function displayOriginalImageData(dataUrl) {
    const img = document.getElementById("originalImage");
    if (img) { img.src = dataUrl; img.style.display = "block"; document.getElementById("originalPlaceholder").style.display = "none"; document.getElementById("originalInfo").textContent = new Date().toLocaleString(); }
}

function displayOriginalImage(imagePath) {
    const img = document.getElementById("originalImage"); if (img) { img.src = `${API_BASE}${imagePath}?t=${Date.now()}`; img.style.display = "block"; document.getElementById("originalPlaceholder").style.display = "none"; document.getElementById("originalInfo").textContent = new Date().toLocaleString(); }
}

async function uploadImage(file) {
    try {
        const uploadBtn = document.getElementById("uploadBtn"); uploadBtn.disabled = true; uploadBtn.innerHTML = '<span class="loading"></span> Processing...';
        const arrayBuffer = await file.arrayBuffer();
        const email = localStorage.getItem('notifyEmail') || '';
        const headers = { "Content-Type": "application/octet-stream" };
        if (email) headers['X-Notify-Email'] = email;
        const response = await fetch(`${API_BASE}/upload`, { method: "POST", headers, body: arrayBuffer });
        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        const data = await response.json();
        if (data.status === "success") {
            addDetection(data.detections, data.timestamp || new Date().toISOString());
            if (data.human_detected) {
                showAlert(`⚠ Human detected. Wildlife detection skipped | Total: ${detectionCount}`, "error");
            } else {
                showAlert(`✓ Successfully detected ${data.detection_count} object(s) | Total: ${detectionCount}`, "success");
            }
            displayAnnotatedImage(data.images.annotated);
            displayDetections(data.detections, data.human_detected);
            updateStatus();
        } else { showAlert("Upload successful but inference failed", "error"); }
    } catch (error) { showAlert(`Error: ${error.message}`, "error"); }
    finally { const uploadBtn = document.getElementById("uploadBtn"); if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.innerHTML = "<span>Select Image</span>"; } }
}

function displayAnnotatedImage(imagePath) { const img = document.getElementById("annotatedImage"); if (img) { img.src = `${API_BASE}${imagePath}?t=${Date.now()}`; img.style.display = "block"; document.getElementById("annotatedPlaceholder").style.display = "none"; document.getElementById("classifiedInfo").textContent = new Date().toLocaleString(); } }

function displayDetections(detections, humanDetected = false) {
    const detectionList = document.getElementById("detectionList"); if (!detectionList) return; detectionList.innerHTML = "";
    if (!detections || detections.length === 0) {
        detectionList.innerHTML = '<li class="empty-state"><p>No wildlife detected in this image</p></li>';
        return;
    }
    if (humanDetected) {
        const li = document.createElement("li");
        li.className = "detection-item";
        li.innerHTML = '<span class="detection-class">Human</span><span class="detection-confidence high">Priority Alert</span>';
        detectionList.appendChild(li);
    }
    detections.forEach((detection) => {
        const li = document.createElement("li"); li.className = "detection-item";
        const confidencePercent = (detection.confidence * 100).toFixed(1);
        let confidenceClass = "low";
        if (detection.confidence >= 0.7) confidenceClass = "high"; else if (detection.confidence >= 0.5) confidenceClass = "medium";
        li.innerHTML = `<span class="detection-class">${detection.class_name}</span><span class="detection-confidence ${confidenceClass}">${confidencePercent}%</span>`;
        detectionList.appendChild(li);
    });
}

function updateStatus() { const serverStatus = document.getElementById("serverStatus"); if (serverStatus) { serverStatus.textContent = "●"; serverStatus.style.color = "#10b981"; } const lastDetection = document.getElementById("lastDetection"); if (lastDetection) lastDetection.textContent = new Date().toLocaleTimeString(); const totalDetections = document.getElementById("totalDetections"); if (totalDetections) totalDetections.textContent = detectionCount; const lastUpdate = document.getElementById("lastUpdate"); if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString(); }

function showAlert(message, type) { const alert = document.getElementById("uploadAlert"); if (!alert) return; alert.className = `alert ${type}`; alert.textContent = message; setTimeout(() => { alert.style.display = "none"; }, 5000); }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadDetectionData(); updateStatus(); startAutoRefresh(); window.addEventListener("beforeunload", stopAutoRefresh);
    // Email notify input
    const emailInput = document.getElementById('notifyEmail');
    const saveEmailBtn = document.getElementById('saveEmailBtn');
    if (emailInput) {
        const saved = localStorage.getItem('notifyEmail') || '';
        emailInput.value = saved;
    }
    if (saveEmailBtn) {
        saveEmailBtn.addEventListener('click', () => {
            const val = document.getElementById('notifyEmail').value.trim();
            if (val && !val.includes('@')) { showAlert('Please enter a valid email', 'error'); return; }
            localStorage.setItem('notifyEmail', val);
            showAlert('Notification email saved', 'success');
        });
    }
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key === 'Delete') { if (confirm('Clear all detection history?')) { clearDetectionHistory(); showAlert('Detection history cleared', 'success'); } } });
});
