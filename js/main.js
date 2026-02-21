// =============================================================
// main.js — Button wiring and app initialization
// =============================================================

// --- Properties Panel Input Listeners ---

stateNameInput.addEventListener('input', () => {
    if (selectedObject instanceof State) selectedObject.label = stateNameInput.value;
});

stateActionInput.addEventListener('input', () => {
    if (selectedObject instanceof State) {
        selectedObject.action = stateActionInput.value;
        refreshSimVariables();
        updateSimUI();
        validatePseudostates();
    }
});

stateRadiusInput.addEventListener('input', () => {
    if (selectedObject instanceof State) {
        const val = parseInt(stateRadiusInput.value);
        if (!isNaN(val)) selectedObject.radius = Math.max(30, Math.min(150, val));
    }
});

transEventInput.addEventListener('input', () => {
    if (selectedObject instanceof Transition) {
        selectedObject.label = transEventInput.value;
        refreshSimVariables();
        updateSimUI();
        validatePseudostates();
    }
});

transActionInput.addEventListener('input', () => {
    if (selectedObject instanceof Transition) {
        selectedObject.action = transActionInput.value;
        refreshSimVariables();
        updateSimUI();
        validatePseudostates();
    }
});

// --- Toolbar Button Handlers ---

document.getElementById('addStateBtn').onclick = () => {
    const s = new State(canvas.width / 2 - viewOffset.x, canvas.height / 2 - viewOffset.y, stateIdCounter++);
    states.push(s);
    select(s);
    refreshSimVariables();
    updateSimUI();
    validatePseudostates();
};

document.getElementById('addPseudoStateBtn').onclick = () => {
    const s = new State(canvas.width / 2 - viewOffset.x, canvas.height / 2 - viewOffset.y, stateIdCounter++, true);
    states.push(s);
    select(s);
    refreshSimVariables();
    updateSimUI();
    validatePseudostates();
};

document.getElementById('deleteBtn').onclick = () => {
    if (selectedObject) {
        if (selectedObject instanceof State) {
            states = states.filter(s => s !== selectedObject);
            transitions = transitions.filter(t => t.from !== selectedObject && t.to !== selectedObject);
            if (startState === selectedObject) startState = null;
            if (activeState === selectedObject) resetSimulation();
        } else {
            transitions = transitions.filter(t => t !== selectedObject);
        }
        select(null);
        refreshSimVariables();
        updateSimUI();
        validatePseudostates();
    }
};

document.getElementById('clearBtn').onclick = () => {
    if (confirm("Clear all?")) {
        states = []; transitions = []; startState = null; activeState = null;
        isSimulating = false; stateIdCounter = 0;
        select(null);
        updateSimUI();
        validatePseudostates();
    }
};

document.getElementById('themeToggleBtn').onclick = toggleTheme;
document.getElementById('exportBtn').onclick = exportJSON;
document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = importJSON;
document.getElementById('exportPngBtn').onclick = exportPNG;
startSimBtn.onclick = () => { if (isSimulating) resetSimulation(); else startSimulation(); };

document.getElementById('genCCodeBtn').onclick = generateCCode;
document.getElementById('copyCodeBtn').onclick = () => {
    const text = document.getElementById('codeOutput').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copyCodeBtn');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = orig, 1500);
    });
};

// --- App Init ---
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(draw);
updatePropertiesPanel();
updateSimUI();
if (!isDarkTheme) document.body.classList.add('light-theme');
