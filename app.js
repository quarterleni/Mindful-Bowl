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
    hapticEnabled: true,
    tapOnExhale: true, // true = exhale (default), false = inhale
    isPremium: false, // Premium features unlocked
    
    // Breath tracking for current session
    breathTimestamps: [],
    sessionStartTime: null,
    
    // Historical data for analytics
    sessionHistory: [] // Stores past session analytics
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
    
    // Record breath timestamp for analysis
    state.breathTimestamps.push(now);
    
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

// ========== BREATH ANALYSIS FUNCTIONS ==========

// Calculate breaths per minute (FREE feature)
function calculateBPM(timestamps, sessionDuration) {
    if (timestamps.length < 2) return 0;
    const totalBreaths = timestamps.length;
    const durationMinutes = sessionDuration / 60;
    return Math.round((totalBreaths / durationMinutes) * 10) / 10; // Round to 1 decimal
}

// Calculate gaps between breaths in seconds
function calculateBreathGaps(timestamps) {
    const gaps = [];
    for (let i = 1; i < timestamps.length; i++) {
        const gap = (timestamps[i] - timestamps[i - 1]) / 1000; // Convert to seconds
        gaps.push(gap);
    }
    return gaps;
}

// Calculate average breath gap
function calculateAverageGap(gaps) {
    if (gaps.length === 0) return 0;
    const sum = gaps.reduce((a, b) => a + b, 0);
    return Math.round((sum / gaps.length) * 10) / 10;
}

// Calculate consistency score (PREMIUM)
function calculateConsistency(gaps) {
    if (gaps.length < 2) return 0;
    
    // Calculate mean
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    
    // Calculate standard deviation
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to 0-100 score (lower stdDev = higher consistency)
    // A stdDev of 0 = 100%, stdDev of 5+ = 0%
    const consistencyScore = Math.max(0, Math.min(100, 100 - (stdDev * 20)));
    return Math.round(consistencyScore);
}

// Calculate relaxation score (PREMIUM)
function calculateRelaxationScore(bpm, consistency, avgGap) {
    // Ideal ranges based on meditation research
    const idealBPM = 6;      // 6 breaths per minute = highly relaxed
    const idealGap = 10;     // 10 seconds per breath cycle
    
    // BPM score (0-100) - closer to 6 is better
    const bpmDiff = Math.abs(bpm - idealBPM);
    const bpmScore = Math.max(0, 100 - (bpmDiff * 10));
    
    // Gap score (0-100) - closer to 10 seconds is better
    const gapDiff = Math.abs(avgGap - idealGap);
    const gapScore = Math.max(0, 100 - (gapDiff * 5));
    
    // Weighted average: consistency matters most
    const relaxationScore = (bpmScore * 0.3) + (consistency * 0.4) + (gapScore * 0.3);
    return Math.round(relaxationScore);
}

// Generate personalized insight based on metrics (PREMIUM)
function generateInsight(bpm, consistency, relaxationScore) {
    let insight = "";
    
    // BPM-based insight
    if (bpm < 6) {
        insight = "Exceptional! You're in a deeply meditative state. 🌙";
    } else if (bpm < 10) {
        insight = "Well done! You've achieved a very relaxed state. 😌";
    } else if (bpm < 15) {
        insight = "Good session! Your breathing is calm and steady. ✨";
    } else {
        insight = "Keep practicing! Try to slow down your breath a bit. 💪";
    }
    
    // Add consistency feedback
    if (consistency > 85) {
        insight += " Your rhythm is excellent and very consistent.";
    } else if (consistency > 70) {
        insight += " Your rhythm is good with room to improve.";
    } else if (consistency < 60) {
        insight += " Try to find a steady, rhythmic pattern.";
    }
    
    // Overall encouragement
    if (relaxationScore > 80) {
        insight += " This is exactly what meditation should feel like! 🧘‍♂️";
    }
    
    return insight;
}

// Detect breathing pattern (PREMIUM)
function detectBreathingPattern(avgGap) {
    if (avgGap >= 4.5 && avgGap <= 5.5) {
        return {
            name: "Coherent Breathing",
            description: "You're naturally breathing in a 5-5 pattern. This is scientifically proven to balance your nervous system. 🧬"
        };
    } else if (avgGap >= 6 && avgGap <= 8) {
        return {
            name: "Deep Relaxation Breathing",
            description: "Your breath pattern indicates deep relaxation and parasympathetic activation. 🌊"
        };
    } else if (avgGap >= 3 && avgGap <= 4) {
        return {
            name: "Box Breathing",
            description: "Similar to Navy SEAL box breathing - great for stress management. 📦"
        };
    } else if (avgGap < 3) {
        return {
            name: "Rapid Breathing",
            description: "Your breathing is quite fast. Try to slow down for deeper relaxation. ⚡"
        };
    } else {
        return {
            name: "Custom Breathing Pattern",
            description: "You have a unique breathing rhythm. Keep exploring what feels right. ✨"
        };
    }
}

// Analyze session and create report
function analyzeSession() {
    const sessionDuration = 180; // 3 minutes
    const timestamps = state.breathTimestamps;
    
    if (timestamps.length < 2) {
        return {
            breathCount: state.breathCount,
            bpm: 0,
            message: "Not enough data for analysis. Try tapping more during your session."
        };
    }
    
    // Calculate all metrics
    const bpm = calculateBPM(timestamps, sessionDuration);
    const gaps = calculateBreathGaps(timestamps);
    const avgGap = calculateAverageGap(gaps);
    const consistency = calculateConsistency(gaps);
    const relaxationScore = calculateRelaxationScore(bpm, consistency, avgGap);
    const insight = generateInsight(bpm, consistency, relaxationScore);
    const pattern = detectBreathingPattern(avgGap);
    
    // Create analysis object
    const analysis = {
        // Free data
        breathCount: state.breathCount,
        bpm: bpm,
        sessionDate: new Date().toISOString(),
        
        // Premium data
        premium: {
            avgGap: avgGap,
            consistency: consistency,
            relaxationScore: relaxationScore,
            insight: insight,
            pattern: pattern,
            breathGaps: gaps,
            longestGap: Math.max(...gaps),
            shortestGap: Math.min(...gaps)
        }
    };
    
    return analysis;
}

// Save session to history (for trends)
function saveSessionAnalysis(analysis) {
    // Add to history
    state.sessionHistory.push(analysis);
    
    // Keep only last 30 sessions
    if (state.sessionHistory.length > 30) {
        state.sessionHistory = state.sessionHistory.slice(-30);
    }
    
    saveData();
}

// Update breath counter
function updateBreathDisplay() {
    document.getElementById('breathCount').textContent = state.breathCount;
}

// Update breath instruction based on tap setting
function updateBreathInstruction() {
    const instruction = document.getElementById('breathInstruction');
    if (instruction) {
        if (state.tapOnExhale) {
            instruction.textContent = "Breathe in deeply, breathe out, tap the bowl";
        } else {
            instruction.textContent = "Breathe in deeply, tap the bowl";
        }
    }
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
    state.breathTimestamps = []; // Reset breath tracking
    state.sessionStartTime = Date.now(); // Record start time
    updateBreathDisplay();
    showScreen('session');
    startTimer();
    initAudio(); // Ensure audio is initialized
    updateBreathInstruction(); // Update instruction based on exhale/inhale setting
}

// End session
function endSession() {
    state.sessionActive = false;
    stopTimer();
    
    // Analyze the session
    const analysis = analyzeSession();
    saveSessionAnalysis(analysis);
    
    // Update stats
    state.totalSessions++;
    updateTodaySessions();
    updateStreak();
    saveData();
    
    // Display results on completion screen
    displaySessionResults(analysis);
    
    showScreen('completion');
    
    // Play completion sound
    playCompletionSound();
}

// Display session results with free and premium data
function displaySessionResults(analysis) {
    // Always show: breath count
    document.getElementById('completionBreaths').textContent = analysis.breathCount;
    document.getElementById('sessionsToday').textContent = state.sessionsToday;
    
    // Always show: BPM (FREE feature)
    const bpmDisplay = document.getElementById('bpmDisplay');
    if (bpmDisplay) {
        bpmDisplay.textContent = analysis.bpm;
    }
    
    // Show BPM interpretation (FREE)
    const bpmInterpretation = document.getElementById('bpmInterpretation');
    if (bpmInterpretation) {
        let interpretation = "";
        if (analysis.bpm < 6) {
            interpretation = "Deeply relaxed";
        } else if (analysis.bpm < 10) {
            interpretation = "Very relaxed";
        } else if (analysis.bpm < 15) {
            interpretation = "Calm";
        } else {
            interpretation = "Active";
        }
        bpmInterpretation.textContent = interpretation;
    }
    
    // Premium features
    if (state.isPremium && analysis.premium) {
        // Show premium data
        const consistencyDisplay = document.getElementById('consistencyDisplay');
        const relaxationDisplay = document.getElementById('relaxationDisplay');
        const insightDisplay = document.getElementById('insightDisplay');
        const patternDisplay = document.getElementById('patternDisplay');
        
        if (consistencyDisplay) {
            consistencyDisplay.textContent = analysis.premium.consistency + '%';
        }
        if (relaxationDisplay) {
            relaxationDisplay.textContent = analysis.premium.relaxationScore;
        }
        if (insightDisplay) {
            insightDisplay.textContent = analysis.premium.insight;
        }
        if (patternDisplay) {
            patternDisplay.innerHTML = `
                <strong>${analysis.premium.pattern.name}</strong><br>
                <small>${analysis.premium.pattern.description}</small>
            `;
        }
        
        // Show premium sections
        document.querySelectorAll('.premium-feature').forEach(el => {
            el.classList.remove('locked');
        });
    } else {
        // Show locked premium sections
        document.querySelectorAll('.premium-feature').forEach(el => {
            el.classList.add('locked');
        });
    }
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
        hapticEnabled: state.hapticEnabled,
        tapOnExhale: state.tapOnExhale,
        isPremium: state.isPremium,
        sessionHistory: state.sessionHistory
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
        state.tapOnExhale = data.tapOnExhale !== undefined ? data.tapOnExhale : true;
        state.isPremium = data.isPremium || false;
        state.sessionHistory = data.sessionHistory || [];
        
        // Check if it's a new day
        const today = new Date().toDateString();
        if (state.todayDate !== today) {
            state.sessionsToday = 0;
            state.todayDate = today;
        }
        
        updateStatsDisplay();
        updateVolumeControl();
        updateHapticControl();
        updateTapOnExhaleControl();
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

function updateTapOnExhaleControl() {
    const tapOnExhaleToggle = document.getElementById('tapOnExhaleToggle');
    if (tapOnExhaleToggle) {
        tapOnExhaleToggle.checked = state.tapOnExhale;
    }
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

// Tap on exhale/inhale toggle
const tapOnExhaleToggle = document.getElementById('tapOnExhaleToggle');
if (tapOnExhaleToggle) {
    tapOnExhaleToggle.addEventListener('change', (e) => {
        state.tapOnExhale = e.target.checked;
        saveData();
        updateBreathInstruction();
    });
}

// Premium unlock button (temporary - for testing before payment integration)
const unlockPremiumBtn = document.getElementById('unlockPremiumBtn');
if (unlockPremiumBtn) {
    unlockPremiumBtn.addEventListener('click', () => {
        // For now, just unlock it (later this will trigger payment)
        state.isPremium = true;
        saveData();
        alert('Premium features unlocked! 🎉\n\nYou now have access to:\n- Breath rhythm consistency\n- Relaxation score\n- Personalized insights\n- Breathing pattern detection\n- Session history & trends');
        closeSettings();
    });
}

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
