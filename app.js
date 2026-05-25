// Import Firebase SDKs dynamically as ES modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Configuration Form Toggle State
const configToggleBtn = document.getElementById('config-toggle-btn');
const configFormBody = document.getElementById('config-form-body');

configToggleBtn.addEventListener('click', () => {
    configToggleBtn.classList.toggle('collapsed');
    configFormBody.classList.toggle('hidden');
});

// Load config parameters asynchronously
let firebaseURL = "";
let firebaseAPIKey = "";

let app, db;
let currentPumpState = false;

// Fetch config from text files
async function loadConfigAndConnect() {
    try {
        const [urlRes, keyRes] = await Promise.all([
            fetch('firebase_url.txt').then(r => r.ok ? r.text() : ""),
            fetch('firebase_apikey.txt').then(r => r.ok ? r.text() : "")
        ]);
        
        firebaseURL = urlRes.trim();
        firebaseAPIKey = keyRes.trim();
        
        if (firebaseURL) {
            document.getElementById('firebase-url-input').value = firebaseURL;
            document.getElementById('firebase-key-input').value = firebaseAPIKey;
            connectFirebase(firebaseURL, firebaseAPIKey);
        } else {
            document.getElementById('conn-status-dot').className = 'status-dot';
            document.getElementById('conn-status-text').textContent = 'Unconfigured';
            updateTableDBStatus('Disconnected', false);
        }
    } catch (e) {
        console.error("Failed to load initial configuration:", e);
    }
}

// Setup Toast Notification
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Format URL safely
function getFirebaseConfig(url, key) {
    // Extract projectId from Database URL e.g. https://<projectId>.firebaseio.com or https://<projectId>-default-rtdb.<region>.firebasedatabase.app
    let projectId = "hydroponics-dashboard";
    try {
        const matches = url.match(/https:\/\/([^.]+)/);
        if (matches && matches[1]) {
            projectId = matches[1];
        }
    } catch(e) {}

    return {
        apiKey: key,
        databaseURL: url,
        projectId: projectId
    };
}

// Connect to Database
function updateTableDBStatus(statusText, isOnline) {
    const tableDb = document.getElementById('table-status-db');
    if (!tableDb) return;
    tableDb.textContent = statusText;
    if (isOnline) {
        tableDb.className = 'status-badge-inline masuk';
    } else {
        tableDb.className = 'status-badge-inline keluar';
    }
}

function connectFirebase(url, key) {
    if (!url) {
        document.getElementById('conn-status-dot').className = 'status-dot';
        document.getElementById('conn-status-text').textContent = 'Unconfigured';
        updateTableDBStatus('Disconnected', false);
        return;
    }

    try {
        const firebaseConfig = getFirebaseConfig(url, key);
        app = initializeApp(firebaseConfig);
        db = getDatabase(app);

        // Update indicators
        document.getElementById('conn-status-dot').className = 'status-dot online';
        document.getElementById('conn-status-text').textContent = 'Connected';
        updateTableDBStatus('Connected', true);

        showToast("Connected to Firebase Realtime Database!");

        // Bind DB Listeners
        bindListeners();
    } catch(error) {
        console.error(error);
        document.getElementById('conn-status-dot').className = 'status-dot';
        document.getElementById('conn-status-text').textContent = 'Connection Error';
        updateTableDBStatus('Error', false);
        showToast("Firebase initialization error: " + error.message, true);
    }
}

// Attach Live DB listeners
function bindListeners() {
    if (!db) return;

    // 1. Water Level
    const waterLevelRef = ref(db, 'iot/water_level');
    onValue(waterLevelRef, (snapshot) => {
        const val = snapshot.val() !== null ? snapshot.val() : 0;
        document.getElementById('val-water-level').textContent = val;
        
        const tableWater = document.getElementById('table-status-water');
        if (tableWater) {
            tableWater.textContent = `${val}cm`;
        }
        
        // Dynamically adjust wave height (max height cap of 150px)
        const waveHeight = Math.min(Math.max(val * 4, 30), 160);
        document.getElementById('water-wave').style.height = `${waveHeight}px`;
        updateSyncTime();
    });

    // 2. Pump Status
    const pumpRef = ref(db, 'iot/pump');
    onValue(pumpRef, (snapshot) => {
        const val = snapshot.val();
        currentPumpState = (val === 1 || val === "1" || val === true || String(val).toLowerCase() === "on");
        
        const pumpToggle = document.getElementById('pump-toggle');
        const pumpText = document.getElementById('pump-state-text');
        
        if (currentPumpState) {
            pumpToggle.classList.add('on');
            pumpText.textContent = "ON";
        } else {
            pumpToggle.classList.remove('on');
            pumpText.textContent = "OFF";
        }
        
        const tablePump = document.getElementById('table-status-pump');
        if (tablePump) {
            tablePump.textContent = currentPumpState ? "ON" : "OFF";
            tablePump.className = currentPumpState ? 'status-badge-inline masuk' : 'status-badge-inline keluar';
        }
        
        updateSyncTime();
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateSyncTime() {
    const time = new Date().toLocaleTimeString();
    document.getElementById('val-sync').textContent = time;
}

// Bidirectional Pump Action Handler
document.getElementById('pump-toggle').addEventListener('click', () => {
    if (!db) {
        showToast("Error: Database is disconnected.", true);
        return;
    }
    const targetState = !currentPumpState;
    // Write value in expected standard data scheme (1 for ON, 0 for OFF)
    set(ref(db, 'iot/pump'), targetState ? 1 : 0)
        .then(() => {
            showToast(`Pump commanded ${targetState ? 'ON' : 'OFF'}`);
        })
        .catch(err => {
            showToast("Failed to toggle pump: " + err.message, true);
        });
});

// Configuration Form Saver Action (Uses AJAX POST request to save_config.php)
document.getElementById('config-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const inputUrl = document.getElementById('firebase-url-input').value.trim();
    const inputKey = document.getElementById('firebase-key-input').value.trim();

    fetch('save_config.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            firebase_url: inputUrl,
            firebase_apikey: inputKey
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            firebaseURL = inputUrl;
            firebaseAPIKey = inputKey;
            // Re-initialize firebase app instance with new configuration params
            connectFirebase(firebaseURL, firebaseAPIKey);
        } else {
            showToast("Configuration save error: " + data.message, true);
        }
    })
    .catch(err => {
        showToast("Request failed: " + err.message, true);
    });
});

// Trigger initial connection on document load
loadConfigAndConnect();
