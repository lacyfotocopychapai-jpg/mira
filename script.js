const statusText = document.getElementById('status');
const historyContainer = document.getElementById('history');
const userInput = document.getElementById('userInput');
const micBtn = document.getElementById('micBtn');
const indicator = document.getElementById('indicator');

// Web Speech API with fallback
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isSpeaking = false;
let synth = window.speechSynthesis;
let miraVoice = null;
let voiceSupported = !!SpeechRecognition;
let textOnlyMode = false;

// Check if running on HTTPS or localhost
const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';

// Load voices as soon as they are available
// Load voices with retry mechanism
function loadVoices() {
    const voices = synth.getVoices();
    if (voices.length > 0) {
        logDebug("Available Voices: " + voices.map(v => v.name).join(", "));

        // Priority 1: Google Bangla
        miraVoice = voices.find(v => v.name.includes('Google Bangla') || v.name === 'Google Bangla');

        // Priority 2: Google with Bangla/Bengali
        if (!miraVoice) {
            miraVoice = voices.find(v => v.name.includes('Google') && (v.name.includes('Bangla') || v.name.includes('Bengali') || v.lang.includes('bn')));
        }

        // Priority 3: Other Female Bengali Voices
        if (!miraVoice) {
            miraVoice = voices.find(v => v.lang.includes('bn') && (
                v.name.includes('Female') ||
                v.name.includes('Sushmita') ||
                v.name.includes('Yasmin')
            ));
        }

        // Priority 4: Any Bengali Voice
        if (!miraVoice) {
            miraVoice = voices.find(v => v.lang.includes('bn'));
        }

        if (miraVoice) {
            logDebug(`✅ Voice set to: ${miraVoice.name}`);
        } else {
            logDebug("⚠️ English fallback or no voice found yet.");
        }
    } else {
        // Retry if voices are not loaded yet
        setTimeout(loadVoices, 100);
    }
}

// Ensure voices are loaded
loadVoices();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}

// Resume Audio Context on interaction (Fix for mobile autoplay)
function resumeAudio() {
    if (synth.speaking) return; // Don't interrupt if already speaking
    synth.resume();
}
document.body.addEventListener('click', resumeAudio);
document.body.addEventListener('touchstart', resumeAudio);

function testAudio() {
    speak("বস, আমি চেক করছি। সব সিস্টেম ঠিক আছে।");
}

function initRecognition() {
    if (!SpeechRecognition) {
        logDebug("Speech Recognition not supported - Using text-only mode");
        textOnlyMode = true;
        showTextOnlyMessage();
        return;
    }

    if (!isSecureContext) {
        logDebug("⚠️ Not HTTPS - Voice may not work. Deploy to Netlify/GitHub Pages!");
        showHTTPSWarning();
    }

    if (recognition) {
        try { recognition.abort(); } catch (e) { }
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'bn-BD';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        logDebug("Mic Listening...");
        updateStatus('MIRA IS LISTENING...', '100%');
        micBtn.classList.add('active');
        indicator.style.background = '#00f2ff';
        startVisualizer();
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
            logDebug(`Heard: "${finalTranscript}"`);
            addMessage(finalTranscript, 'user');
            handleCommand(finalTranscript);
        }
    };

    recognition.onerror = (e) => {
        logDebug(`Mic Error: ${e.error}`);
        // Always restart, even on errors
        setTimeout(() => restartRecognition(), 500);
    };

    recognition.onend = () => {
        logDebug("Recognition Ended - Auto Restarting...");
        micBtn.classList.remove('active');
        // ALWAYS restart - keep listening in background
        setTimeout(() => restartRecognition(), 500);
    };

    try {
        recognition.start();
        logDebug("Recognition started successfully");
    } catch (e) {
        logDebug(`Start error: ${e.message}`);
        setTimeout(() => restartRecognition(), 1000);
    }
}

function restartRecognition() {
    if (!recognition) {
        initRecognition();
        return;
    }

    // Don't restart while speaking
    if (isSpeaking) {
        setTimeout(() => restartRecognition(), 500);
        return;
    }

    try {
        recognition.start();
        logDebug("Recognition restarted");
    } catch (e) {
        logDebug(`Restart failed: ${e.message}`);
        // If already running, that's fine
        if (e.message && e.message.includes('already started')) {
            return;
        }
        // Otherwise try again
        setTimeout(() => restartRecognition(), 1000);
    }
}

function updateStatus(text, width) {
    statusText.innerText = text;
    indicator.style.width = width;
}

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `msg msg-${sender}`;
    div.innerText = text;
    historyContainer.appendChild(div);
    historyContainer.scrollTop = historyContainer.scrollHeight;
}

function speak(text) {
    if (!text) return;

    // If text-only mode, just show message without speaking
    if (textOnlyMode || !synth) {
        addMessage(text, 'mira');
        logDebug(`Text-only: "${text.substring(0, 30)}..."`);
        updateStatus('MIR-A IS READY, BOSS', '0%');
        return;
    }

    // AGGRESSIVE RESET
    isSpeaking = true;
    synth.cancel();
    if (recognition) try { recognition.abort(); } catch (e) { }

    const utterance = new SpeechSynthesisUtterance(text);
    if (!miraVoice) loadVoices(); // Final attempt to load
    if (miraVoice) utterance.voice = miraVoice;

    utterance.lang = 'bn-BD';

    // Optimized for Google Bangla
    if (miraVoice && miraVoice.name.includes('Google')) {
        utterance.rate = 1.0; // Normal speed for Google
        utterance.pitch = 1.1; // Slight pitch increase is enough for Google
    } else {
        utterance.rate = 1.1;
        utterance.pitch = 1.5; // Higher pitch for others
    }

    utterance.onstart = () => {
        logDebug(`Speaking: "${text.substring(0, 15)}..."`);
        updateStatus('MIRA IS SPEAKING...', '100%');
        indicator.style.background = '#7000ff';
    };

    utterance.onend = () => {
        logDebug("Speech Ended");
        isSpeaking = false;
        updateStatus('MIR-A IS READY, BOSS', '0%');
        indicator.style.background = '#00f2ff';
        restartRecognition();
    };

    utterance.onerror = (e) => {
        console.error('Speech Error:', e);
        isSpeaking = false;
        restartRecognition();
    };

    synth.speak(utterance);
    addMessage(text, 'mira');
}

// Auto-start Mira without user interaction
function unlockMira() {
    logDebug("System Initializing...");
    const overlay = document.getElementById('startOverlay');
    if (overlay) overlay.style.display = 'none'; // Hide overlay

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            logDebug(`Notification permission: ${permission}`);
        });
    }

    initRecognition();

    // Auto-speak greeting after a short delay
    setTimeout(() => {
        const greeting = "আসসালামু আলাইকুম বস, আমি মিরা। আমি সবসময় আপনার কথা শুনছি। বলুন আমি কী করতে পারি?";

        // Speak or show message based on mode
        if (textOnlyMode) {
            addMessage(greeting, 'mira');
            logDebug("Text-only mode - greeting shown");
        } else {
            speak(greeting);
        }

        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🤖 Mira AI Active', {
                body: textOnlyMode ? 'টেক্সট মোডে চলছে' : 'আমি সবসময় আপনার কথা শুনছি',
                icon: 'mira.png',
                badge: 'mira.png',
                tag: 'mira-active',
                requireInteraction: false
            });
        }
    }, 1000);
}

// Visualizer (Simple CSS animation trigger)
function startVisualizer() {
    document.getElementById('visualizer').style.animation = 'pulse 0.5s ease-in-out infinite';
    document.getElementById('visualizer').style.opacity = '1';
}
function stopVisualizer() {
    document.getElementById('visualizer').style.animation = 'none';
    document.getElementById('visualizer').style.opacity = '0.5';
}

// Show text-only mode message
function showTextOnlyMessage() {
    updateStatus('TEXT-ONLY MODE', '100%');
    const msg = document.createElement('div');
    msg.style = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 165, 0, 0.95);
        color: #000;
        padding: 15px 25px;
        border-radius: 15px;
        font-weight: bold;
        z-index: 10000;
        text-align: center;
        max-width: 90%;
        box-shadow: 0 4px 20px rgba(255, 165, 0, 0.5);
    `;
    msg.innerHTML = `
        ⚠️ ভয়েস সাপোর্ট নেই<br>
        <small style="font-weight: normal; font-size: 0.85em;">
        টেক্সট দিয়ে কমান্ড দিন অথবা<br>
        <strong>Chrome/Edge</strong> ব্যবহার করুন<br>
        এবং <strong>HTTPS</strong> এ deploy করুন
        </small>
    `;
    document.body.appendChild(msg);

    // Auto-hide after 8 seconds
    setTimeout(() => {
        msg.style.transition = 'opacity 0.5s';
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 500);
    }, 8000);

    // Focus on text input
    userInput.focus();
    userInput.placeholder = "টেক্সট দিয়ে কমান্ড লিখুন (ভয়েস কাজ করছে না)";
}

// Show HTTPS warning
function showHTTPSWarning() {
    const msg = document.createElement('div');
    msg.style = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 0, 0, 0.9);
        color: #fff;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 0.9em;
        z-index: 9999;
        text-align: center;
        max-width: 90%;
        box-shadow: 0 4px 15px rgba(255, 0, 0, 0.4);
    `;
    msg.innerHTML = `
        🔒 HTTP ব্যবহার করছেন!<br>
        <small>Netlify/GitHub Pages এ deploy করুন HTTPS এর জন্য</small>
    `;
    document.body.appendChild(msg);

    setTimeout(() => {
        msg.style.transition = 'opacity 0.5s';
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 500);
    }, 6000);
}

// Auto-start on page load
window.addEventListener('load', () => {
    setTimeout(() => {
        unlockMira();
    }, 500);
});

// Keep running in background
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        logDebug("Tab hidden - keeping recognition active");
    } else {
        logDebug("Tab visible - ensuring recognition is active");
        if (recognition && !isSpeaking) {
            restartRecognition();
        }
    }
});

// Prevent screen sleep (Wake Lock API)
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            logDebug("Wake Lock activated - screen won't sleep");

            wakeLock.addEventListener('release', () => {
                logDebug("Wake Lock released");
            });
        }
    } catch (err) {
        logDebug(`Wake Lock error: ${err.message}`);
    }
}

// Re-acquire wake lock when page becomes visible
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// Request wake lock on start
requestWakeLock();

// Backup: Also start on any user interaction
document.body.addEventListener('click', unlockMira, { once: true });
document.body.addEventListener('touchstart', unlockMira, { once: true });

// Manual Emergency Controls (Adding UI via JS)
const controls = document.createElement('div');
controls.style = "display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:20px;";
controls.innerHTML = `
    <button onclick="unlockMira()" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid #fff; padding:10px; border-radius:10px;">Sync Audio</button>
    <button onclick="initRecognition()" style="background:rgba(255,165,0,0.2); color:#FFA500; border:1px solid #FFA500; padding:10px; border-radius:10px;">Force Mic</button>
    <button onclick="handleCommand('youtube')" style="background:rgba(255,0,0,0.2); color:#FF0000; border:1px solid #FF0000; padding:10px; border-radius:10px;">YouTube</button>
    <button onclick="handleCommand('wifi on')" style="background:rgba(0,242,255,0.2); color:#00f2ff; border:1px solid #00f2ff; padding:10px; border-radius:10px;">WiFi On</button>
`;
document.getElementById('app').appendChild(controls);

const debugBox = document.createElement('div');
debugBox.style = "font-family:monospace; font-size:10px; color:#555; margin-top:10px; max-height:50px; overflow:auto;";
document.getElementById('app').appendChild(debugBox);

function logDebug(msg) {
    debugBox.innerHTML = `> ${msg}<br>${debugBox.innerHTML}`;
}

// Command Logic
async function handleCommand(cmd) {
    const command = cmd.toLowerCase().trim();
    if (!command) return;

    updateStatus('THINKING...', '50%');
    logDebug(`Handling command: "${command}"`);

    try {
        // 1. WhatsApp / Messaging (Improved)
        if (command.includes('মেসেজ') || command.includes('হোয়াটসঅ্যাপ') || command.includes('whatsapp')) {
            speak("হোয়াটসঅ্যাপ খুলছি বস।");
            const waUrl = command.includes('পাঠাও') ? `https://wa.me/?text=${encodeURIComponent(command.replace(/মেসেজ|হোয়াটসঅ্যাপ|whatsapp|পাঠাও/gi, ''))}` : `whatsapp://send`;
            setTimeout(() => {
                window.location.href = waUrl;
            }, 1000);
            return;
        }

        // 2. Imaging / Creativity
        else if (command.includes('ছবি তৈরি') || command.includes('image') || command.includes('ছবির')) {
            speak("ঠিক আছে বস, আমি আপনার জন্য একটি ছবি তৈরি করার লিংকে নিয়ে যাচ্ছি।");
            window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(command)}`, '_blank');
        }

        // 3. Notes / Reminders
        else if (command.includes('নোট') || command.includes('লেখো') || command.includes('save note')) {
            const note = cmd.replace(/নোট|লেখো|save note|লিস্ট/gi, "").trim();
            if (note) {
                saveNote(note);
                speak(`বস, আমি নোটটি লিখে রেখেছি।`);
            } else {
                speak("বস, আমি কী নোট লিখব তা ঠিক বুঝতে পারিনি।");
            }
        }

        // 5. System Controls (Fast Response)
        if (command.includes('ভলিউম') || command.includes('volume')) {
            const vol = command.match(/\d+/) ? command.match(/\d+/)[0] : 70;
            document.getElementById('volumeBar').style.width = vol + '%';
            speak(`ভলিউম ${vol}।`);
            return;
        }
        if (command.includes('ব্রাইটনেস') || command.includes('brightness')) {
            const bright = command.match(/\d+/) ? command.match(/\d+/)[0] : 50;
            document.getElementById('brightnessBar').style.width = bright + '%';
            speak(`ব্রাইটনেস ${bright}।`);
            return;
        }

        // 6. WiFi / Bluetooth (Instant Actions)
        if (command.includes('ওয়াইফাই') || command.includes('wifi')) {
            const state = (command.includes('চালু') || command.includes('on')) ? "অন" : "অফ";
            speak(`ওয়াইফাই ${state} করছি।`);
            return;
        }
        if (command.includes('ব্লুটুথ') || command.includes('bluetooth')) {
            const state = (command.includes('চালু') || command.includes('on')) ? "অন" : "অফ";
            speak(`ব্লুটুথ ${state} করছি।`);
            return;
        }

        // 7. App Control
        if (command.includes('খোল') || command.includes('open')) {
            const app = command.replace(/খোল|open|অ্যাপ|app/gi, "").trim();
            speak(`${app} খুলছি।`);
            window.open(`https://www.google.com/search?q=open+${encodeURIComponent(app)}+app&btnI=1`, '_blank');
            return;
        }

        // 8. Search (Instant)
        if (command.includes('সার্চ') || command.includes('search') || command.includes('খুঁজো') || command.includes('গুগল') || command.includes('ইউটিউব')) {
            const query = command.replace(/সার্চ|search|খুঁজো|গুগলে|ইউটিউবে|গুগল|ইউটিউব/gi, "").trim();
            if (command.includes('ইউটিউব') || command.includes('youtube')) {
                speak(`ইউটিউবে ${query}।`);
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
            } else {
                speak(`গুগলে ${query}।`);
                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
            }
            return;
        }

        // 8. Basic Inquiry
        else if (command.includes('সময়') || command.includes('time')) {
            const now = new Date().toLocaleTimeString('bn-BD');
            speak(`এখন সময় হলো ${now}।`);
        }
        else if (command.includes('কেমন আছো') || command.includes('how are you')) {
            speak("আমি চমৎকার আছি বস! আপনার কী সেবা করতে পারি?");
        }
        else {
            speak("দুঃখিত বস, আমি এই কাজটি এখনো রপ্ত করতে পারিনি।");
        }
    } catch (e) {
        console.error(e);
        speak("বস, কাজটিতে কিছু সমস্যা হয়েছে।");
    } finally {
        setTimeout(() => updateStatus('MIR-A IS READY, BOSS', '0%'), 2000);
    }
}

function saveNote(text) {
    let notes = JSON.parse(localStorage.getItem('mira_notes') || '[]');
    notes.push({ text, date: new Date().toLocaleString() });
    localStorage.setItem('mira_notes', JSON.stringify(notes));
}

function simulateAction(action) {
    console.log(`Action Performed: ${action}`);
    // In a real mobile app (Cordova/Termux), here we would call Native functions
}

// Event Listeners
micBtn.addEventListener('click', () => {
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            logDebug(`Mic start error: ${e.message}`);
        }
    } else {
        // Show helpful message instead of simple alert
        const helpMsg = document.createElement('div');
        helpMsg.style = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            color: #00f2ff;
            padding: 30px;
            border-radius: 20px;
            border: 2px solid #00f2ff;
            z-index: 10001;
            text-align: center;
            max-width: 90%;
            box-shadow: 0 0 30px rgba(0, 242, 255, 0.5);
        `;
        helpMsg.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #00f2ff;">🎤 ভয়েস সাপোর্ট নেই</h3>
            <p style="margin: 10px 0; font-size: 0.95em;">
                আপনার ব্রাউজারে Web Speech API নেই।<br>
                <strong>টেক্সট দিয়ে কমান্ড দিন</strong> নিচের বক্সে।
            </p>
            <hr style="border: 1px solid rgba(0, 242, 255, 0.3); margin: 15px 0;">
            <p style="margin: 10px 0; font-size: 0.85em; color: #aaa;">
                ভয়েস চালু করতে:<br>
                ✅ <strong>Chrome/Edge</strong> ব্যবহার করুন<br>
                ✅ <strong>HTTPS</strong> এ deploy করুন<br>
                (Netlify/GitHub Pages)
            </p>
            <button onclick="this.parentElement.remove()" style="
                background: #00f2ff;
                color: #000;
                border: none;
                padding: 10px 30px;
                border-radius: 25px;
                font-weight: bold;
                cursor: pointer;
                margin-top: 15px;
            ">বুঝেছি</button>
        `;
        document.body.appendChild(helpMsg);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (helpMsg.parentElement) {
                helpMsg.style.transition = 'opacity 0.5s';
                helpMsg.style.opacity = '0';
                setTimeout(() => helpMsg.remove(), 500);
            }
        }, 10000);
    }
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && userInput.value.trim() !== "") {
        const text = userInput.value;
        addMessage(text, 'user');
        handleCommand(text);
        userInput.value = "";
    }
});
