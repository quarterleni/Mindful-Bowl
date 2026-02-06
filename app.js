// App State
const state = {
    totalSessions: 0,
    currentStreak: 0,
    lastSessionDate: null,
    breathCount: 0,
    sessionActive: false,
    timerInterval: null,
    timeRemaining: 180, // 3 minutes in seconds
    sessionsToday: 0,
    todayDate: null,
    volume: 0.7,
    hapticEnabled: true
};

// DOM Elements
const screens = {
    welcome: document.getElementById('welcomeScreen'),
    session: document.getElementById('sessionScreen'),
    completion: document.getElementById('completionScreen')
};

const buttons = {
    start: document.getElementById('startBtn'),
    exit: document.getElementById('exitBtn'),
    anotherSession: document.getElementById('anotherSessionBtn'),
    done: document.getElementById('doneBtn'),
    settings: document.getElementById('settingsBtn'),
    resetData: document.getElementById('resetDataBtn')
};

const bowl = document.getElementById('singingBowl');
const bowlGlow = document.getElementById('bowlGlow');
const ripples = [
    document.getElementById('ripple1'),
    document.getElementById('ripple2'),
    document.getElementById('ripple3')
];

// Audio Context for singing bowl sound
let audioContext;
let masterGain;

// Initialize audio on first user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        masterGain.gain.value = state.volume;
    }
}

// Create singing bowl sound using Web Audio API
function playSingingBowl() {
    initAudio();
    
    const now = audioContext.currentTime;
    
    // Create oscillators for complex harmonic sound
    const fundamentalFreq = 220; // A3
    
    // Fundamental tone
    const fundamental = audioContext.createOscillator();
    const fundamentalGain = audioContext.createGain();
    fundamental.frequency.value = fundamentalFreq;
    fundamental.type = 'sine';
    
    // Harmonics
    const harmonic1 = audioContext.createOscillator();
    const harmonic1Gain = audioContext.createGain();
    harmonic1.frequency.value = fundamentalFreq * 2.4;
    harmonic1.type = 'sine';
    
    const harmonic2 = audioContext.createOscillator();
    const harmonic2Gain = audioContext.createGain();
    harmonic2.frequency.value = fundamentalFreq * 3.8;
    harmonic2.type = 'sine';
    
    // Connect nodes
    fundamental.connect(fundamentalGain);
    harmonic1.connect(harmonic1Gain);
    harmonic2.connect(harmonic2Gain);
    
    fundamentalGain.connect(masterGain);
    harmonic1Gain.connect(masterGain);
    harmonic2Gain.connect(masterGain);
    
    // Envelope
    fundamentalGain.gain.setValueAtTime(0, now);
    fundamentalGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    fundamentalGain.gain.exponentialRampToValueAtTime(0.01, now + 3);
    
    harmonic1Gain.gain.setValueAtTime(0, now);
    harmonic1Gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    harmonic1Gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
    
    harmonic2Gain.gain.setValueAtTime(0, now);
    harmonic2Gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    harmonic2Gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
    
    // Start and stop
    fundamental.start(now);
    harmonic1.start(now);
    harmonic2.start(now);
    
    fundamental.stop(now + 3);
    harmonic1.stop(now + 2.5);
    harmonic2.stop(now + 2);
}

// Haptic feedback
function vibrate() {
    if (state.hapticEnabled && navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// Bowl tap interaction with debouncing to prevent double-taps
let lastTapTime = 0;
const TAP_DELAY = 300; // Minimum milliseconds between taps

function onBowlTap() {
    if (!state.sessionActive) return;
    
    // Debounce: prevent rapid double-taps
    const now = Date.now();
    if (now - lastTapTime < TAP_DELAY) {
        return; // Ignore this tap, too soon
    }
    lastTapTime = now;
    
    // Play sound
    playSingingBowl();
    
    // Haptic feedback
    vibrate();
    
    // Visual feedback
    bowlGlow.classList.add('active');
    setTimeout(() => bowlGlow.classList.remove('active'), 1000);
    
    // Ripple effect
    const availableRipple = ripples.find(r => !r.classList.contains('animate'));
    if (availableRipple) {
        availableRipple.classList.add('animate');
        setTimeout(() => availableRipple.classList.remove('animate'), 1500);
    }
    
    // Increment breath count
    state.breathCount++;
    updateBreathDisplay();
}

// Update breath counter
function updateBreathDisplay() {
    document.getElementById('breathCount').textContent = state.breathCount;
}

// Timer functions
function startTimer() {
    state.timeRemaining = 180; // 3 minutes
    updateTimerDisplay();
    
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        
        if (state.timeRemaining <= 0) {
            endSession();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    document.getElementById('timerMinutes').textContent = minutes;
    document.getElementById('timerSeconds').textContent = seconds.toString().padStart(2, '0');
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// Screen transitions
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Start session
function startSession() {
    state.sessionActive = true;
    state.breathCount = 0;
    updateBreathDisplay();
    showScreen('session');
    startTimer();
    initAudio(); // Ensure audio is initialized
}

// End session
function endSession() {
    state.sessionActive = false;
    stopTimer();
    
    // Update stats
    state.totalSessions++;
    updateTodaySessions();
    updateStreak();
    saveData();
    
    // Show completion screen
    document.getElementById('completionBreaths').textContent = state.breathCount;
    document.getElementById('sessionsToday').textContent = state.sessionsToday;
    
    showScreen('completion');
    
    // Play completion sound
    playCompletionSound();
}

function playCompletionSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.3);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.5);
}

// Update sessions today
function updateTodaySessions() {
    const today = new Date().toDateString();
    
    if (state.todayDate !== today) {
        state.todayDate = today;
        state.sessionsToday = 1;
    } else {
        state.sessionsToday++;
    }
}

// Update streak
function updateStreak() {
    const today = new Date();
    const todayString = today.toDateString();
    
    if (!state.lastSessionDate) {
        state.currentStreak = 1;
    } else {
        const lastDate = new Date(state.lastSessionDate);
        const diffTime = today - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Same day, keep streak
        } else if (diffDays === 1) {
            // Consecutive day
            state.currentStreak++;
        } else {
            // Streak broken
            state.currentStreak = 1;
        }
    }
    
    state.lastSessionDate = todayString;
    updateStatsDisplay();
}

// Update stats display
function updateStatsDisplay() {
    document.getElementById('totalSessions').textContent = state.totalSessions;
    document.getElementById('currentStreak').textContent = state.currentStreak;
}

// Local Storage
function saveData() {
    const data = {
        totalSessions: state.totalSessions,
        currentStreak: state.currentStreak,
        lastSessionDate: state.lastSessionDate,
        sessionsToday: state.sessionsToday,
        todayDate: state.todayDate,
        volume: state.volume,
        hapticEnabled: state.hapticEnabled
    };
    localStorage.setItem('mindfulBowlData', JSON.stringify(data));
}

function loadData() {
    const saved = localStorage.getItem('mindfulBowlData');
    if (saved) {
        const data = JSON.parse(saved);
        state.totalSessions = data.totalSessions || 0;
        state.currentStreak = data.currentStreak || 0;
        state.lastSessionDate = data.lastSessionDate || null;
        state.sessionsToday = data.sessionsToday || 0;
        state.todayDate = data.todayDate || null;
        state.volume = data.volume || 0.7;
        state.hapticEnabled = data.hapticEnabled !== undefined ? data.hapticEnabled : true;
        
        // Check if it's a new day
        const today = new Date().toDateString();
        if (state.todayDate !== today) {
            state.sessionsToday = 0;
            state.todayDate = today;
        }
        
        updateStatsDisplay();
        updateVolumeControl();
        updateHapticControl();
    }
}

function resetAllData() {
    if (confirm('Are you sure you want to reset all your meditation data? This cannot be undone.')) {
        localStorage.removeItem('mindfulBowlData');
        state.totalSessions = 0;
        state.currentStreak = 0;
        state.lastSessionDate = null;
        state.sessionsToday = 0;
        state.todayDate = null;
        updateStatsDisplay();
        closeSettings();
    }
}

// Settings
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

function updateVolumeControl() {
    const volumeControl = document.getElementById('volumeControl');
    volumeControl.value = state.volume * 100;
}

function updateHapticControl() {
    document.getElementById('hapticToggle').checked = state.hapticEnabled;
}

// Event Listeners
buttons.start.addEventListener('click', startSession);

buttons.exit.addEventListener('click', () => {
    if (confirm('Are you sure you want to exit? Your progress won\'t be saved.')) {
        state.sessionActive = false;
        stopTimer();
        showScreen('welcome');
    }
});

buttons.anotherSession.addEventListener('click', startSession);
buttons.done.addEventListener('click', () => showScreen('welcome'));

// Bowl interaction - handle both touch and mouse
// Use passive: false to allow preventDefault
let touchUsed = false;

bowl.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent mouse events from firing
    touchUsed = true;
    onBowlTap();
}, { passive: false });

bowl.addEventListener('click', (e) => {
    // Only trigger if touch wasn't used (for desktop)
    if (!touchUsed) {
        onBowlTap();
    }
    // Reset after a short delay
    setTimeout(() => {
        touchUsed = false;
    }, 100);
});

// Settings
buttons.settings.addEventListener('click', openSettings);
document.querySelector('.close-modal').addEventListener('click', closeSettings);

// Click outside modal to close
document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        closeSettings();
    }
});

// Volume control
document.getElementById('volumeControl').addEventListener('input', (e) => {
    state.volume = e.target.value / 100;
    if (masterGain) {
        masterGain.gain.value = state.volume;
    }
    saveData();
});

// Haptic toggle
document.getElementById('hapticToggle').addEventListener('change', (e) => {
    state.hapticEnabled = e.target.checked;
    saveData();
});

// Reset data
buttons.resetData.addEventListener('click', resetAllData);

// Initialize app
function init() {
    loadData();
    showScreen('welcome');
    
    // Register service worker for PWA (if available)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
            // Service worker registration failed, but app still works
        });
    }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Prevent accidental page reload during session
window.addEventListener('beforeunload', (e) => {
    if (state.sessionActive) {
        e.preventDefault();
        e.returnValue = '';
    }
});
