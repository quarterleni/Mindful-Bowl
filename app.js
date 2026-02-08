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
    sessionHistory: [], // Stores past session analytics
    
    // Sleep mode state
    currentMode: 'meditation', // 'meditation' or 'sleep'
    sleepSounds: {
        selected: [], // Array of {sound: 'rain', volume: 70, icon: '🌧️', name: 'Rain'}
        timer: 60, // minutes, 0 = all night
        smartAlarm: false,
        alarmTime: '07:00'
    },
    sleepSessionActive: false,
    activeSoundPlayers: [] // Audio context players
};

// DOM Elements
const screens = {
    welcome: document.getElementById('welcomeScreen'),
    session: document.getElementById('sessionScreen'),
    completion: document.getElementById('completionScreen'),
    sleepSound: document.getElementById('sleepSoundScreen'),
    sleepSession: document.getElementById('sleepSessionScreen')
};

const buttons = {
    start: document.getElementById('startBtn'),
    exit: document.getElementById('exitBtn'),
    anotherSession: document.getElementById('anotherSessionBtn'),
    done: document.getElementById('doneBtn'),
    settings: document.getElementById('settingsBtn'),
    resetData: document.getElementById('resetDataBtn'),
    // Mode toggle
    meditationMode: document.getElementById('meditationModeBtn'),
    sleepMode: document.getElementById('sleepModeBtn'),
    startSleep: document.getElementById('startSleepBtn'),
    backToWelcome: document.getElementById('backToWelcomeBtn'),
    startSleepSession: document.getElementById('startSleepSessionBtn'),
    stopSleep: document.getElementById('stopSleepBtn'),
    toggleVolumePanel: document.getElementById('toggleVolumePanelBtn')
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

// ========== SLEEP SOUND SYSTEM ==========

// Sound library with metadata
const soundLibrary = {
    rain: { name: 'Rain', icon: '🌧️', free: true },
    ocean: { name: 'Ocean', icon: '🌊', free: true },
    brownnoise: { name: 'Brown Noise', icon: '📊', free: false },
    campfire: { name: 'Campfire', icon: '🔥', free: false },
    stream: { name: 'Stream', icon: '💧', free: false }
};

// Preset configurations
const soundPresets = {
    storm: {
        name: 'Stormy Night',
        sounds: [
            { sound: 'rain', volume: 80 },
            { sound: 'ocean', volume: 40 }
        ]
    },
    beach: {
        name: 'Beach Sunset',
        sounds: [
            { sound: 'ocean', volume: 100 }
        ]
    },
    forest: {
        name: 'Forest Stream',
        sounds: [
            { sound: 'stream', volume: 70 },
            { sound: 'rain', volume: 30 }
        ]
    },
    deep: {
        name: 'Deep Sleep',
        sounds: [
            { sound: 'brownnoise', volume: 60 }
        ]
    }
};

// Generate sleep sounds using Web Audio API
function generateSleepSound(soundType) {
    if (!audioContext) {
        initAudio();
    }
    
    const player = {
        type: soundType,
        gainNode: audioContext.createGain(),
        oscillators: [],
        noiseNode: null,
        isPlaying: false
    };
    
    player.gainNode.connect(masterGain);
    
    switch(soundType) {
        case 'rain':
            player.noiseNode = createFilteredNoise(audioContext, 'pink', 0.3);
            // Add random peaks for rain drops
            player.rainInterval = setInterval(() => {
                if (Math.random() > 0.7) {
                    const peak = audioContext.createOscillator();
                    const peakGain = audioContext.createGain();
                    peak.frequency.value = 2000 + Math.random() * 3000;
                    peak.connect(peakGain);
                    peakGain.connect(player.gainNode);
                    
                    const now = audioContext.currentTime;
                    peakGain.gain.setValueAtTime(0.1, now);
                    peakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    
                    peak.start(now);
                    peak.stop(now + 0.1);
                }
            }, 50);
            break;
            
        case 'ocean':
            // Create wave pattern with low frequency oscillation
            const wave = audioContext.createOscillator();
            const waveGain = audioContext.createGain();
            wave.frequency.value = 0.2; // Very slow wave
            wave.type = 'sine';
            wave.connect(waveGain);
            
            // Brown noise for wave texture
            player.noiseNode = createFilteredNoise(audioContext, 'brown', 0.5);
            
            // Modulate brown noise with wave pattern
            waveGain.gain.value = 0.3;
            waveGain.connect(player.gainNode.gain);
            
            wave.start();
            player.oscillators.push(wave);
            break;
            
        case 'brownnoise':
            player.noiseNode = createFilteredNoise(audioContext, 'brown', 0.4);
            break;
            
        case 'campfire':
            // Base crackling with filtered noise
            player.noiseNode = createFilteredNoise(audioContext, 'pink', 0.2);
            
            // Random crackle pops
            player.crackleInterval = setInterval(() => {
                if (Math.random() > 0.8) {
                    const crackle = audioContext.createOscillator();
                    const crackleGain = audioContext.createGain();
                    crackle.frequency.value = 100 + Math.random() * 500;
                    crackle.type = 'square';
                    crackle.connect(crackleGain);
                    crackleGain.connect(player.gainNode);
                    
                    const now = audioContext.currentTime;
                    crackleGain.gain.setValueAtTime(0.15, now);
                    crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    
                    crackle.start(now);
                    crackle.stop(now + 0.05);
                }
            }, 100);
            break;
            
        case 'stream':
            // Flowing water - pink noise with gentle modulation
            player.noiseNode = createFilteredNoise(audioContext, 'pink', 0.35);
            
            // Gentle flow modulation
            const flow = audioContext.createOscillator();
            const flowGain = audioContext.createGain();
            flow.frequency.value = 0.5;
            flow.type = 'sine';
            flow.connect(flowGain);
            flowGain.gain.value = 0.2;
            flowGain.connect(player.gainNode.gain);
            
            flow.start();
            player.oscillators.push(flow);
            break;
    }
    
    if (player.noiseNode) {
        player.noiseNode.connect(player.gainNode);
    }
    
    return player;
}

// Create filtered noise (white, pink, brown)
function createFilteredNoise(context, type, baseVolume = 0.3) {
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    
    if (type === 'white') {
        // White noise - equal power across frequencies
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * baseVolume;
        }
    } else if (type === 'pink') {
        // Pink noise - more bass
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * baseVolume * 0.11;
            b6 = white * 0.115926;
        }
    } else if (type === 'brown') {
        // Brown noise - even more bass
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5 * baseVolume;
        }
    }
    
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.start();
    
    return noise;
}

// Mode switching
function switchMode(mode) {
    state.currentMode = mode;
    
    // Update UI
    const meditationBtn = document.getElementById('meditationModeBtn');
    const sleepBtn = document.getElementById('sleepModeBtn');
    const meditationContent = document.getElementById('meditationModeContent');
    const sleepContent = document.getElementById('sleepModeContent');
    
    if (mode === 'meditation') {
        meditationBtn.classList.add('active');
        sleepBtn.classList.remove('active');
        meditationContent.classList.add('active');
        sleepContent.classList.remove('active');
    } else {
        meditationBtn.classList.remove('active');
        sleepBtn.classList.add('active');
        meditationContent.classList.remove('active');
        sleepContent.classList.add('active');
    }
}

// Sound selection
function toggleSoundSelection(soundId) {
    const soundInfo = soundLibrary[soundId];
    
    // Check if premium sound and user not premium
    if (!soundInfo.free && !state.isPremium) {
        alert('This is a premium sound. Unlock premium features to access all sounds!');
        return;
    }
    
    // Check if already selected
    const existingIndex = state.sleepSounds.selected.findIndex(s => s.sound === soundId);
    
    if (existingIndex >= 0) {
        // Remove sound
        state.sleepSounds.selected.splice(existingIndex, 1);
    } else {
        // Add sound (max 3)
        if (state.sleepSounds.selected.length >= 3) {
            alert('You can mix up to 3 sounds at once');
            return;
        }
        
        state.sleepSounds.selected.push({
            sound: soundId,
            volume: 70,
            icon: soundInfo.icon,
            name: soundInfo.name
        });
    }
    
    updateSoundSelectionUI();
    updateMixerDisplay();
}

// Update sound card UI
function updateSoundSelectionUI() {
    document.querySelectorAll('.sound-card').forEach(card => {
        const soundId = card.dataset.sound;
        const isSelected = state.sleepSounds.selected.some(s => s.sound === soundId);
        
        if (isSelected) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
        
        // Lock premium sounds if not premium
        const soundInfo = soundLibrary[soundId];
        if (!soundInfo.free && !state.isPremium) {
            card.classList.add('locked');
        } else {
            card.classList.remove('locked');
        }
    });
}

// Update mixer display
function updateMixerDisplay() {
    const container = document.getElementById('selectedSounds');
    
    if (state.sleepSounds.selected.length === 0) {
        container.innerHTML = '<p class="no-sounds-message">Select sounds to mix</p>';
        return;
    }
    
    container.innerHTML = state.sleepSounds.selected.map((sound, index) => `
        <div class="selected-sound-item">
            <div class="sound-item-info">
                <span class="sound-item-icon">${sound.icon}</span>
                <span class="sound-item-name">${sound.name}</span>
            </div>
            <div class="sound-volume-control">
                <input type="range" class="sound-volume-slider" 
                       data-index="${index}" 
                       min="0" max="100" value="${sound.volume}">
                <span class="sound-volume-value">${sound.volume}%</span>
            </div>
            <button class="remove-sound-btn" data-index="${index}">×</button>
        </div>
    `).join('');
    
    // Add event listeners
    container.querySelectorAll('.sound-volume-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const value = parseInt(e.target.value);
            state.sleepSounds.selected[index].volume = value;
            e.target.nextElementSibling.textContent = value + '%';
        });
    });
    
    container.querySelectorAll('.remove-sound-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            const soundId = state.sleepSounds.selected[index].sound;
            state.sleepSounds.selected.splice(index, 1);
            updateSoundSelectionUI();
            updateMixerDisplay();
        });
    });
}

// Apply preset
function applyPreset(presetId) {
    const preset = soundPresets[presetId];
    if (!preset) return;
    
    // Check if user can access all sounds in preset
    const hasAccess = preset.sounds.every(s => {
        const soundInfo = soundLibrary[s.sound];
        return soundInfo.free || state.isPremium;
    });
    
    if (!hasAccess) {
        alert('This preset contains premium sounds. Unlock premium to use it!');
        return;
    }
    
    // Clear current selection and apply preset
    state.sleepSounds.selected = preset.sounds.map(s => ({
        sound: s.sound,
        volume: s.volume,
        icon: soundLibrary[s.sound].icon,
        name: soundLibrary[s.sound].name
    }));
    
    updateSoundSelectionUI();
    updateMixerDisplay();
}

// Start sleep session
function startSleepSession() {
    if (state.sleepSounds.selected.length === 0) {
        alert('Please select at least one sound');
        return;
    }
    
    state.sleepSessionActive = true;
    showScreen('sleepSession');
    
    // Display playing sounds
    const playingContainer = document.getElementById('playingSoundsDisplay');
    playingContainer.innerHTML = state.sleepSounds.selected.map(s => 
        `<div class="playing-sound-badge">${s.icon} ${s.name}</div>`
    ).join('');
    
    // Create volume controls
    const volumeContainer = document.getElementById('sleepVolumeControls');
    volumeContainer.innerHTML = state.sleepSounds.selected.map((sound, index) => `
        <div class="volume-control-item">
            <div class="volume-control-label">
                <span class="sound-icon">${sound.icon}</span>
                <span>${sound.name}</span>
            </div>
            <input type="range" class="sound-volume-slider" 
                   data-sound-index="${index}"
                   min="0" max="100" value="${sound.volume}">
        </div>
    `).join('');
    
    // Start playing sounds
    state.sleepSounds.selected.forEach((sound, index) => {
        const player = generateSleepSound(sound.sound);
        player.gainNode.gain.value = sound.volume / 100;
        player.isPlaying = true;
        state.activeSoundPlayers.push(player);
    });
    
    // Setup live volume controls
    volumeContainer.querySelectorAll('.sound-volume-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.soundIndex);
            const volume = parseInt(e.target.value) / 100;
            if (state.activeSoundPlayers[index]) {
                state.activeSoundPlayers[index].gainNode.gain.value = volume;
            }
        });
    });
    
    // Start timer if not "all night"
    if (state.sleepSounds.timer > 0) {
        startSleepTimer();
    } else {
        document.getElementById('sleepTimerDisplay').textContent = '∞';
    }
    
    // Setup smart alarm if enabled
    if (state.sleepSounds.smartAlarm) {
        setupSmartAlarm();
    }
}

// Sleep timer
function startSleepTimer() {
    state.timeRemaining = state.sleepSounds.timer * 60; // Convert to seconds
    updateSleepTimerDisplay();
    
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateSleepTimerDisplay();
        
        // Fade out in last 30 seconds
        if (state.timeRemaining <= 30 && state.timeRemaining > 0) {
            const fadeLevel = state.timeRemaining / 30;
            state.activeSoundPlayers.forEach(player => {
                const currentVolume = player.gainNode.gain.value;
                player.gainNode.gain.value = currentVolume * fadeLevel;
            });
        }
        
        if (state.timeRemaining <= 0) {
            stopSleepSession();
        }
    }, 1000);
}

function updateSleepTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    document.getElementById('sleepTimerDisplay').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Stop sleep session
function stopSleepSession() {
    state.sleepSessionActive = false;
    
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    
    // Stop all sound players
    state.activeSoundPlayers.forEach(player => {
        if (player.noiseNode) {
            player.noiseNode.stop();
        }
        player.oscillators.forEach(osc => osc.stop());
        if (player.rainInterval) clearInterval(player.rainInterval);
        if (player.crackleInterval) clearInterval(player.crackleInterval);
        player.gainNode.disconnect();
    });
    
    state.activeSoundPlayers = [];
    
    showScreen('welcome');
}

// Smart alarm (gradual wake-up)
function setupSmartAlarm() {
    const alarmTime = state.sleepSounds.alarmTime;
    const [hours, minutes] = alarmTime.split(':').map(Number);
    
    const now = new Date();
    const alarm = new Date();
    alarm.setHours(hours, minutes, 0, 0);
    
    // If alarm time has passed today, set for tomorrow
    if (alarm <= now) {
        alarm.setDate(alarm.getDate() + 1);
    }
    
    const timeUntilAlarm = alarm - now;
    
    // 15 minutes before alarm, start gradual volume increase
    const gradualWakeTime = timeUntilAlarm - (15 * 60 * 1000);
    
    if (gradualWakeTime > 0) {
        setTimeout(() => {
            // Gradually increase volume over 15 minutes
            const increaseInterval = setInterval(() => {
                state.activeSoundPlayers.forEach(player => {
                    const currentVol = player.gainNode.gain.value;
                    player.gainNode.gain.value = Math.min(1, currentVol * 1.01);
                });
            }, 1000);
            
            // Stop increasing at alarm time
            setTimeout(() => {
                clearInterval(increaseInterval);
            }, 15 * 60 * 1000);
        }, gradualWakeTime);
    }
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

// Update premium section based on status
function updatePremiumSection() {
    const premiumSection = document.getElementById('premiumSection');
    if (!premiumSection) return;
    
    if (state.isPremium) {
        // Show premium active status
        premiumSection.innerHTML = `
            <div class="premium-status-active">
                <div class="premium-status-icon">💎</div>
                <h4 class="premium-status-title">Premium Active</h4>
                <p class="premium-status-message">You have access to all premium features!</p>
            </div>
        `;
    } else {
        // Show unlock option
        premiumSection.innerHTML = `
            <h4 class="premium-heading">Premium Features 💎</h4>
            <ul class="premium-features-list">
                <li>✓ Breath rhythm consistency analysis</li>
                <li>✓ Personalized relaxation score</li>
                <li>✓ AI-powered breathing insights</li>
                <li>✓ Breathing pattern detection</li>
                <li>✓ All sleep sounds & mixing</li>
                <li>✓ Smart alarm & presets</li>
            </ul>
            <button id="unlockPremiumBtn" class="primary-btn">
                Unlock Premium (Coming Soon)
            </button>
            <p class="premium-note">Temporary: Click to unlock for testing</p>
        `;
        
        // Re-attach event listener
        const unlockBtn = document.getElementById('unlockPremiumBtn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                state.isPremium = true;
                saveData();
                updatePremiumSection();
                updateSoundSelectionUI(); // Update sleep sounds availability
                alert('Premium features unlocked! 🎉\n\nYou now have access to:\n- Advanced breath analysis\n- All sleep sounds\n- Sound mixing\n- Smart alarm\n- Presets');
                closeSettings();
            });
        }
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

// Reset data
buttons.resetData.addEventListener('click', resetAllData);

// ========== SLEEP MODE EVENT LISTENERS ==========

// Mode toggle
buttons.meditationMode.addEventListener('click', () => switchMode('meditation'));
buttons.sleepMode.addEventListener('click', () => switchMode('sleep'));

// Navigate to sleep sound selection
buttons.startSleep.addEventListener('click', () => {
    showScreen('sleepSound');
    updateSoundSelectionUI();
    updateMixerDisplay();
});

// Back to welcome from sleep sound screen
buttons.backToWelcome.addEventListener('click', () => showScreen('welcome'));

// Sound card selection
document.querySelectorAll('.sound-card').forEach(card => {
    card.addEventListener('click', () => {
        const soundId = card.dataset.sound;
        if (!card.classList.contains('locked')) {
            toggleSoundSelection(soundId);
        }
    });
});

// Preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const presetId = btn.dataset.preset;
        applyPreset(presetId);
    });
});

// Timer selection
document.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active from all
        document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
        // Add active to clicked
        btn.classList.add('active');
        // Update state
        state.sleepSounds.timer = parseInt(btn.dataset.time);
    });
});

// Smart alarm toggle
const smartAlarmToggle = document.getElementById('smartAlarmToggle');
if (smartAlarmToggle) {
    smartAlarmToggle.addEventListener('change', (e) => {
        state.sleepSounds.smartAlarm = e.target.checked;
        const alarmTimeSelector = document.getElementById('alarmTimeSelector');
        if (alarmTimeSelector) {
            alarmTimeSelector.style.display = e.target.checked ? 'block' : 'none';
        }
    });
}

// Alarm time input
const alarmTimeInput = document.getElementById('alarmTime');
if (alarmTimeInput) {
    alarmTimeInput.addEventListener('change', (e) => {
        state.sleepSounds.alarmTime = e.target.value;
    });
}

// Start sleep session
buttons.startSleepSession.addEventListener('click', startSleepSession);

// Stop sleep session
buttons.stopSleep.addEventListener('click', () => {
    if (confirm('Stop sleep session?')) {
        stopSleepSession();
    }
});

// Toggle volume panel
buttons.toggleVolumePanel.addEventListener('click', () => {
    const volumeControls = document.getElementById('sleepVolumeControls');
    volumeControls.classList.toggle('expanded');
    buttons.toggleVolumePanel.textContent = 
        volumeControls.classList.contains('expanded') ? 'Hide Volumes' : 'Adjust Volumes';
});

// Initialize app
function init() {
    loadData();
    showScreen('welcome');
    updatePremiumSection(); // Initialize premium display
    
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
