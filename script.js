// DOM Elements
const canvas = document.getElementById('fsmCanvas');
const ctx = canvas.getContext('2d');

const propPanel = document.getElementById('propertiesPanel');
const stateProps = document.getElementById('stateProperties');
const transProps = document.getElementById('transitionProperties');
const noSelectionMsg = document.getElementById('noSelectionMsg');

const stateNameInput = document.getElementById('stateName');
const stateActionInput = document.getElementById('stateAction');
const stateRadiusInput = document.getElementById('stateRadius');
const transEventInput = document.getElementById('transEvent');
const transActionInput = document.getElementById('transAction');

const simPanel = document.getElementById('simPanel');
const varsList = document.getElementById('varsList');
const eventsList = document.getElementById('eventsList');
const startSimBtn = document.getElementById('startSimBtn');
const activeStateDisplay = document.getElementById('activeStateDisplay');

// Global Application State
let states = [];
let transitions = [];
let draggingState = null;
let draggingPoint = null;
let creatingTransition = null;

// Simulation State
let startState = null;
let activeState = null;
let simContext = {};
let isSimulating = false;
let animations = [];

// UI & Interaction State
let isDarkTheme = true;
let lastMouseMoveTime = Date.now();
let handleOpacity = 1;
let viewOffset = { x: 0, y: 0 };
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };
let selectedObject = null;
let stateIdCounter = 0;

// Configuration Constants
const HANDLE_FADE_DELAY = 1500;
const HANDLE_FADE_SPEED = 0.03;
const STATE_RADIUS = 45;
const SNAP_DIST = 15;

// Theme Definitions
const THEMES = {
    dark: {
        bg: '#1e1e1e',
        stateFill: '#1e1e1e',
        stateStroke: '#e0e0e0',
        text: '#e0e0e0',
        transition: '#e0e0e0',
        selected: '#4a90e2',
        activeState: '#4a704a',
        startState: '#2d4d2d',
        labelBg: 'rgba(30, 30, 30, 0.8)',
        labelColor: '#e0e0e0',
        handle: '#666',
        tempLine: '#666',
        syntaxCondition: '#f1c40f',
        syntaxFunction: '#5dade2'
    },
    light: {
        bg: '#ffffff',
        stateFill: '#ffffff',
        stateStroke: '#000000',
        text: '#000000',
        transition: '#000000',
        selected: '#4a90e2',
        activeState: '#eeeeee',
        startState: '#dddddd',
        labelBg: 'rgba(255, 255, 255, 0.9)',
        labelColor: '#000000',
        handle: '#999',
        tempLine: '#999',
        syntaxCondition: '#c05621',
        syntaxFunction: '#2b6cb0'
    }
};

function getTheme() {
    return isDarkTheme ? THEMES.dark : THEMES.light;
}

// --- UI Functions ---
function select(obj) {
    selectedObject = obj;
    updatePropertiesPanel();
}

function updatePropertiesPanel() {
    stateProps.classList.add('hidden');
    transProps.classList.add('hidden');
    noSelectionMsg.classList.add('hidden');
    propPanel.classList.remove('hidden');

    if (!selectedObject) {
        noSelectionMsg.classList.remove('hidden');
    } else if (selectedObject instanceof State) {
        stateProps.classList.remove('hidden');
        stateNameInput.value = selectedObject.label;
        stateActionInput.value = selectedObject.action || "";
        stateRadiusInput.value = selectedObject.radius;

        const displayStyle = selectedObject.isPseudostate ? 'none' : '';
        stateNameInput.previousElementSibling.style.display = displayStyle;
        stateNameInput.style.display = displayStyle;
        stateActionInput.previousElementSibling.style.display = displayStyle;
        stateActionInput.style.display = displayStyle;

    } else if (selectedObject instanceof Transition) {
        transProps.classList.remove('hidden');
        transEventInput.value = selectedObject.label || "";
        transActionInput.value = selectedObject.action || "";

        const labelNode = transEventInput.previousElementSibling;
        if (selectedObject.from.isPseudostate) {
            labelNode.innerText = "Condition(s):";
            transEventInput.placeholder = "e.g. x > 5";
        } else {
            labelNode.innerText = "Event(s):";
            transEventInput.placeholder = "e.g. signal[x>5]";
        }
        labelNode.style.display = '';
        transEventInput.style.display = '';
    }
}

function refreshSimVariables() {
    const varRegex = /\b[a-zA-Z_]\w*\b/g;
    const keywords = new Set(['true', 'false', 'null', 'Math', 'and', 'or', 'not']);

    // Scan all transition labels for [variables]
    transitions.forEach(t => {
        const match = /\[(.*?)\]/.exec(t.label);
        if (match) {
            let m;
            while ((m = varRegex.exec(match[1])) !== null) {
                let v = m[0];
                if (!keywords.has(v) && simContext[v] === undefined) {
                    simContext[v] = 0;
                }
            }
        }
    });

    // Also scan actions for assignments (e.g. x = y)
    const scanActions = (actionText) => {
        if (!actionText) return;
        const lines = actionText.split('\n');
        lines.forEach(line => {
            const parts = line.split('=');
            if (parts.length === 2) {
                const varName = parts[0].trim();
                if (varRegex.test(varName) && !keywords.has(varName) && simContext[varName] === undefined) {
                    simContext[varName] = 0;
                }
            }
        });
    };

    states.forEach(s => scanActions(s.action));
    transitions.forEach(t => scanActions(t.action));
}

function updateSimUI() {
    simPanel.classList.remove('hidden');

    startSimBtn.innerText = isSimulating ? "Reset/Stop Simulation" : "Start Simulation";
    activeStateDisplay.innerText = isSimulating && activeState ? `Active: ${activeState.isPseudostate ? "(Pseudostate)" : activeState.label}` : "Active: (None)";
    activeStateDisplay.style.color = isSimulating ? '' : 'gray';

    // Update variables
    varsList.innerHTML = "";
    Object.keys(simContext).sort().forEach(key => {
        const row = document.createElement('div');
        row.className = 'var-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        row.style.marginBottom = '5px';

        row.innerHTML = `<label style="min-width: 60px;">${key}:</label>`;
        const input = document.createElement('input');
        input.type = 'number';
        input.style.width = '60px';
        input.style.padding = '2px 5px';
        input.value = simContext[key];
        input.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0;
            simContext[key] = val;
            input.value = val;
            validatePseudostates();
        });

        row.appendChild(input);
        varsList.appendChild(row);
    });

    // Update events
    eventsList.innerHTML = "";
    const relevantEvents = new Set();
    transitions.forEach(t => {
        if (t.from.isPseudostate) return;
        const evt = t.label.split('[')[0].trim();
        if (evt) relevantEvents.add(evt);
    });

    relevantEvents.forEach(evt => {
        const btn = document.createElement('button');
        btn.innerText = evt;
        btn.onclick = () => fireEvent(evt);
        // Only enable if simulating? No, user said "anyone and it will have effect or not"
        // But clicking an event button outside simulation might be confusing if it does nothing.
        // Let's allow it but check simulation state in fireEvent.
        eventsList.appendChild(btn);
    });
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    const themeBtn = document.getElementById('themeToggleBtn');
    if (isDarkTheme) {
        document.body.classList.add('dark-theme');
        themeBtn.innerText = "Switch to Light Theme";
    } else {
        document.body.classList.remove('dark-theme');
        themeBtn.innerText = "Switch to Dark Theme";
    }
}

// --- Storage Functions ---
function exportJSON() {
    const data = {
        states: states.map(s => ({
            id: s.id, x: s.x, y: s.y, label: s.label,
            action: s.action, radius: s.radius, isStart: s.isStart,
            isPseudostate: !!s.isPseudostate
        })),
        transitions: transitions.map(t => ({
            from: t.from.id, to: t.to.id, label: t.label, action: t.action,
            controlOffset: t.controlOffset,
            startAnchorAngle: t.startAnchorAngle,
            endAnchorAngle: t.endAnchorAngle,
            labelOffset: t.labelOffset
        })),
        stateIdCounter,
        isDarkTheme
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fsm_graph.json';
    a.click();
}

function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            states = [];
            transitions = [];
            startState = null;
            activeState = null;
            isSimulating = false;

            data.states.forEach(sData => {
                const s = new State(sData.x, sData.y, sData.id, sData.isPseudostate);
                s.label = sData.label;
                s.action = sData.action;
                s.radius = sData.radius || (sData.isPseudostate ? 18 : STATE_RADIUS);
                s.isStart = sData.isStart;
                if (s.isStart) startState = s;
                states.push(s);
            });

            data.transitions.forEach(tData => {
                const from = states.find(s => s.id === tData.from);
                const to = states.find(s => s.id === tData.to);
                if (from && to) {
                    const t = new Transition(from, to);
                    t.label = tData.label;
                    t.action = tData.action;
                    t.controlOffset = tData.controlOffset || { x: 0, y: 0 };
                    t.startAnchorAngle = tData.startAnchorAngle;
                    t.endAnchorAngle = tData.endAnchorAngle;
                    t.labelOffset = tData.labelOffset || { x: 0, y: 0 };
                    transitions.push(t);
                }
            });

            stateIdCounter = data.stateIdCounter || states.length;
            if (data.isDarkTheme !== undefined) {
                isDarkTheme = !data.isDarkTheme; // toggleTheme will flip it back
                toggleTheme();
            }
            refreshSimVariables();
            select(null);
            updateSimUI();
        } catch (err) {
            alert("Error parsing JSON");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function exportPNG() {
    if (states.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    states.forEach(s => {
        minX = Math.min(minX, s.x - s.radius - 20);
        minY = Math.min(minY, s.y - s.radius - 20);
        maxX = Math.max(maxX, s.x + s.radius + 20);
        maxY = Math.max(maxY, s.y + s.radius + 20);
    });
    transitions.forEach(t => {
        if (t.computed) {
            const lx = t.computed.labelX;
            const ly = t.computed.labelY;
            const tw = t.computed.textWidth / 2 + 10;
            const th = t.computed.textHeight / 2 + 10;
            minX = Math.min(minX, lx - tw, t.computed.cpX - 10);
            minY = Math.min(minY, ly - th, t.computed.cpY - 10);
            maxX = Math.max(maxX, lx + tw, t.computed.cpX + 10);
            maxY = Math.max(maxY, ly + th, t.computed.cpY + 10);
        }
    });

    const padding = 40;
    const width = (maxX - minX) + padding * 2;
    const height = (maxY - minY) + padding * 2;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    const theme = getTheme();
    tempCtx.fillStyle = theme.bg;
    tempCtx.fillRect(0, 0, width, height);

    tempCtx.save();
    tempCtx.translate(-minX + padding, -minY + padding);

    const oldOpacity = handleOpacity;
    const oldSelection = selectedObject;
    handleOpacity = 0;
    selectedObject = null;

    states.forEach(s => s.draw(tempCtx));
    transitions.forEach(t => t.draw(tempCtx));

    handleOpacity = oldOpacity;
    selectedObject = oldSelection;
    tempCtx.restore();

    const link = document.createElement('a');
    link.download = 'fsm_graph.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

// --- Simulation Functions ---
function startSimulation() {
    if (!startState) {
        alert("Please set a Start State first (Alt + Click on a state)");
        return;
    }
    isSimulating = true;

    // Initial animation from start dot to start state
    const startDotX = startState.x - startState.radius - 35;
    const startDotY = startState.y;

    const virtualStartTrans = {
        isStartAnimation: true,
        fromX: startDotX,
        fromY: startDotY,
        toX: startState.x - startState.radius,
        toY: startState.y,
        to: startState,
        action: null
    };

    activeState = null; // Start state only becomes active after animation
    performTransition(virtualStartTrans);

    refreshSimVariables();
    updateSimUI();
    validatePseudostates();
}

function resetSimulation() {
    isSimulating = false;
    activeState = null;
    // Don't clear simContext anymore so variables stay visible
    updateSimUI();
    states.forEach(s => s.simWarning = null);
}

function fireEvent(eventName) {
    if (!isSimulating || !activeState) return;

    // Check if we are currently animating to prevent overlapping events
    if (animations.some(a => !a.complete)) return;

    const validTransitions = transitions.filter(t => {
        if (t.from !== activeState) return false;
        const parts = t.label.split('[');
        const tEvent = parts[0].trim();
        const tCond = parts[1] ? parts[1].replace(']', '').trim() : "";
        if (eventName !== tEvent) return false;
        if (tCond) return evaluateCondition(tCond);
        return true;
    });

    if (validTransitions.length > 0) {
        performTransition(validTransitions[0]);
    }
}

function performTransition(t) {
    if (!isSimulating) return;

    // Execute transition action immediately
    if (t.action) executeAction(t.action);

    // Create and queue animation
    const anim = new TransitionAnimation(t);
    animations.push(anim);

    // Update UI (but activeState is still 't.from')
    updateSimUI();

    // Wait for animation to finish
    setTimeout(() => {
        if (!isSimulating) return;

        // Arrival!
        activeState = t.to;
        if (activeState.action) executeAction(activeState.action);
        updateSimUI();

        // If it's a pseudostate, trigger next step automatically
        if (activeState.isPseudostate) {
            executeSimulationStep();
        }
    }, anim.duration);
}

function executeSimulationStep() {
    if (!isSimulating || !activeState) return;

    if (activeState.isPseudostate) {
        if (activeState.simWarning) {
            console.warn(`Pseudostate warning: ${activeState.simWarning.toUpperCase()}`);
        }
        const nextTrans = transitions.find(nt => {
            if (nt.from !== activeState) return false;
            let cond = nt.label.trim();
            if (cond.startsWith('[')) cond = cond.substring(1, cond.length - 1);
            return evaluateCondition(cond);
        });

        if (nextTrans) {
            performTransition(nextTrans);
        }
    }
}

function validatePseudostates() {
    if (!isSimulating) return;
    states.forEach(s => {
        if (!s.isPseudostate) return;
        const outgoing = transitions.filter(t => t.from === s);
        let validCount = 0;
        outgoing.forEach(t => {
            let cond = t.label.trim();
            if (cond.startsWith('[')) cond = cond.substring(1, cond.length - 1);
            if (evaluateCondition(cond)) validCount++;
        });
        if (validCount === 0) s.simWarning = "deadlock";
        else if (validCount > 1) s.simWarning = "conflict";
        else s.simWarning = null;
    });
}

function evaluateCondition(cond) {
    if (!cond || cond.trim() === "") return true;
    try {
        const keys = Object.keys(simContext);
        const vals = Object.values(simContext);
        const func = new Function(...keys, `return ${cond};`);
        return !!func(...vals);
    } catch (e) {
        console.error("Condition eval error:", e);
        return false;
    }
}

function executeAction(action) {
    if (!action) return;
    const lines = action.split('\n');
    lines.forEach(line => {
        try {
            const parts = line.split('=');
            if (parts.length === 2) {
                const varName = parts[0].trim();
                const expression = parts[1].trim();
                const keys = Object.keys(simContext);
                const vals = Object.values(simContext);
                const func = new Function(...keys, `return ${expression};`);
                simContext[varName] = func(...vals);
            } else {
                const keys = Object.keys(simContext);
                const vals = Object.values(simContext);
                const func = new Function(...keys, line);
                func(...vals);
            }
        } catch (e) {
            console.error("Action exec error:", e);
        }
    });
    validatePseudostates();
}

// --- Draw Loop ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function draw() {
    const theme = getTheme();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(viewOffset.x, viewOffset.y);

    const timeSinceMove = Date.now() - lastMouseMoveTime;
    if (draggingPoint || creatingTransition || isPanning || timeSinceMove < HANDLE_FADE_DELAY) {
        handleOpacity = Math.min(1, handleOpacity + HANDLE_FADE_SPEED * 2);
    } else {
        handleOpacity = Math.max(0, handleOpacity - HANDLE_FADE_SPEED);
    }

    states.forEach(s => s.draw(ctx));
    transitions.forEach(t => t.draw(ctx));

    if (creatingTransition) {
        ctx.beginPath();
        ctx.moveTo(creatingTransition.from.x, creatingTransition.from.y);
        ctx.lineTo(creatingTransition.to.x, creatingTransition.to.y);
        ctx.strokeStyle = theme.tempLine;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    animations = animations.filter(a => !a.complete);
    animations.forEach(a => {
        a.update();
        a.draw(ctx);
    });

    requestAnimationFrame(draw);
}

// --- Event Listeners ---
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
    const worldPos = getWorldPos(e);
    const mx = worldPos.x;
    const my = worldPos.y;

    if (e.button === 2) {
        isPanning = true;
        lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
    }

    let hitTrans = null;
    let hitPart = null;
    for (let i = transitions.length - 1; i >= 0; i--) {
        const part = transitions[i].getHitPart(mx, my);
        if (part) {
            hitTrans = transitions[i];
            hitPart = part;
            break;
        }
    }

    if (hitTrans) {
        if (hitPart !== 'label') {
            draggingPoint = {
                t: hitTrans,
                type: hitPart,
                startX: mx,
                startY: my,
                initialControl: { ...hitTrans.controlOffset },
                initialLabel: { ...hitTrans.labelOffset },
            };
        } else {
            draggingPoint = {
                t: hitTrans,
                type: hitPart,
                startX: mx,
                startY: my,
                initialLabel: { ...hitTrans.labelOffset },
            };
        }
        select(hitTrans);
        return;
    }

    const hitState = states.slice().reverse().find(s => s.isHit(mx, my));
    if (e.shiftKey && hitState) {
        creatingTransition = { from: hitState, to: { x: mx, y: my } };
        return;
    }
    if (e.altKey && hitState) {
        states.forEach(s => s.isStart = false);
        hitState.isStart = true;
        startState = hitState;
        return;
    }
    if (hitState) {
        draggingState = hitState;
        select(hitState);
        return;
    }
    select(null);
});

canvas.addEventListener('mousemove', e => {
    lastMouseMoveTime = Date.now();
    const worldPos = getWorldPos(e);
    const mx = worldPos.x;
    const my = worldPos.y;

    if (isPanning) {
        viewOffset.x += e.clientX - lastPanPoint.x;
        viewOffset.y += e.clientY - lastPanPoint.y;
        lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
    }

    if (draggingState) {
        draggingState.x = mx;
        draggingState.y = my;
    } else if (creatingTransition) {
        creatingTransition.to = { x: mx, y: my };
    } else if (draggingPoint) {
        const dx = mx - draggingPoint.startX;
        const dy = my - draggingPoint.startY;
        if (draggingPoint.type === 'control') {
            const mult = draggingPoint.t.from === draggingPoint.t.to ? 1.5 : 2.0;
            draggingPoint.t.controlOffset.x = draggingPoint.initialControl.x + dx * mult;
            draggingPoint.t.controlOffset.y = draggingPoint.initialControl.y + dy * mult;
        } else if (draggingPoint.type === 'label') {
            draggingPoint.t.labelOffset.x = draggingPoint.initialLabel.x + dx;
            draggingPoint.t.labelOffset.y = draggingPoint.initialLabel.y + dy;
        } else if (draggingPoint.type === 'start') {
            draggingPoint.t.startAnchorAngle = Math.atan2(my - draggingPoint.t.from.y, mx - draggingPoint.t.from.x);
        } else if (draggingPoint.type === 'end') {
            draggingPoint.t.endAnchorAngle = Math.atan2(my - draggingPoint.t.to.y, mx - draggingPoint.t.to.x);
        }
    }
});

canvas.addEventListener('mouseup', e => {
    if (isPanning) isPanning = false;
    if (creatingTransition) {
        const mx = e.clientX - viewOffset.x;
        const my = e.clientY - viewOffset.y;
        const hitState = states.slice().reverse().find(s => s.isHit(mx, my));
        if (hitState) {
            const newTrans = new Transition(creatingTransition.from, hitState);
            transitions.push(newTrans);
            select(newTrans);
            refreshSimVariables();
            updateSimUI();
        }
        creatingTransition = null;
    }
    draggingState = null;
    draggingPoint = null;
});

canvas.addEventListener('dblclick', e => {
    const worldPos = getWorldPos(e);
    const mx = worldPos.x;
    const my = worldPos.y;

    const hitState = states.slice().reverse().find(s => s.isHit(mx, my));
    if (hitState && !hitState.isPseudostate) {
        const newLabel = prompt("Enter state name:", hitState.label);
        if (newLabel !== null) {
            hitState.label = newLabel;
            updatePropertiesPanel();
        }
        return;
    }

    const hitTrans = transitions.slice().reverse().find(t => t.isHit(mx, my));
    if (hitTrans) {
        const promptMsg = hitTrans.from.isPseudostate ? "Enter condition:" : "Enter event name:";
        const newLabel = prompt(promptMsg, hitTrans.label);
        if (newLabel !== null) {
            hitTrans.label = newLabel;
            updatePropertiesPanel();
        }
    }
});

window.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) {
        if (!(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            if (selectedObject instanceof State) {
                states = states.filter(s => s !== selectedObject);
                transitions = transitions.filter(t => t.from !== selectedObject && t.to !== selectedObject);
                if (startState === selectedObject) startState = null;
                if (activeState === selectedObject) resetSimulation();
                refreshSimVariables();
                updateSimUI();
                select(null);
            } else if (selectedObject instanceof Transition) {
                transitions = transitions.filter(t => t !== selectedObject);
                refreshSimVariables();
                updateSimUI();
                select(null);
            }
        }
    }
});

stateNameInput.addEventListener('input', () => { if (selectedObject instanceof State) selectedObject.label = stateNameInput.value; });
stateActionInput.addEventListener('input', () => {
    if (selectedObject instanceof State) {
        selectedObject.action = stateActionInput.value;
        refreshSimVariables();
        updateSimUI();
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
    }
});
transActionInput.addEventListener('input', () => {
    if (selectedObject instanceof Transition) {
        selectedObject.action = transActionInput.value;
        refreshSimVariables();
        updateSimUI();
    }
});

document.getElementById('addStateBtn').onclick = () => {
    const s = new State(canvas.width / 2 - viewOffset.x, canvas.height / 2 - viewOffset.y, stateIdCounter++);
    states.push(s);
    select(s);
    refreshSimVariables();
    updateSimUI();
};
document.getElementById('addPseudoStateBtn').onclick = () => {
    const s = new State(canvas.width / 2 - viewOffset.x, canvas.height / 2 - viewOffset.y, stateIdCounter++, true);
    states.push(s);
    select(s);
    refreshSimVariables();
    updateSimUI();
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
    }
};
document.getElementById('clearBtn').onclick = () => {
    if (confirm("Clear all?")) {
        states = []; transitions = []; startState = null; activeState = null; isSimulating = false; stateIdCounter = 0; select(null); updateSimUI();
    }
};
document.getElementById('themeToggleBtn').onclick = toggleTheme;
document.getElementById('exportBtn').onclick = exportJSON;
document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = importJSON;
document.getElementById('exportPngBtn').onclick = exportPNG;
startSimBtn.onclick = () => { if (isSimulating) resetSimulation(); else startSimulation(); };

// --- Init ---
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(draw);
updatePropertiesPanel();
updateSimUI();
if (isDarkTheme) document.body.classList.add('dark-theme');
