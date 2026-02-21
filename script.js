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

// Theme Helper
const getCSSVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

// Theme Definitions
const THEMES = {
    get dark() {
        return {
            bg: getCSSVar('--bg-color'),
            stateFill: getCSSVar('--canvas-state-fill'),
            stateStroke: getCSSVar('--canvas-state-stroke'),
            text: getCSSVar('--text-color'),
            transition: getCSSVar('--canvas-state-stroke'),
            selected: getCSSVar('--canvas-selected'),
            activeState: getCSSVar('--canvas-active'),
            startState: getCSSVar('--canvas-start'),
            labelBg: 'rgba(30, 30, 30, 0.8)',
            labelColor: getCSSVar('--text-color'),
            handle: getCSSVar('--canvas-handle'),
            tempLine: getCSSVar('--canvas-handle'),
            syntaxCondition: getCSSVar('--syntax-cond'),
            syntaxFunction: getCSSVar('--syntax-func')
        };
    },
    get light() {
        return {
            bg: getCSSVar('--bg-color'),
            stateFill: getCSSVar('--canvas-state-fill'),
            stateStroke: getCSSVar('--canvas-state-stroke'),
            text: getCSSVar('--text-color'),
            transition: getCSSVar('--canvas-state-stroke'),
            selected: getCSSVar('--canvas-selected'),
            activeState: getCSSVar('--canvas-active'),
            startState: getCSSVar('--canvas-start'),
            labelBg: 'rgba(255, 255, 255, 0.9)',
            labelColor: getCSSVar('--text-color'),
            handle: getCSSVar('--canvas-handle'),
            tempLine: getCSSVar('--canvas-handle'),
            syntaxCondition: getCSSVar('--syntax-cond'),
            syntaxFunction: getCSSVar('--syntax-func')
        };
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

        const isPseudo = selectedObject.isPseudostate;
        stateNameInput.previousElementSibling.classList.toggle('u-hidden', isPseudo);
        stateNameInput.classList.toggle('u-hidden', isPseudo);
        stateActionInput.previousElementSibling.classList.toggle('u-hidden', isPseudo);
        stateActionInput.classList.toggle('u-hidden', isPseudo);

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
        labelNode.classList.remove('u-hidden');
        transEventInput.classList.remove('u-hidden');
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
    const simPanel = document.getElementById('simPanel');
    const consolePanel = document.getElementById('consolePanel');

    if (isSimulating) {
        consolePanel.classList.remove('hidden');
    } else {
        consolePanel.classList.add('hidden');
    }

    // Always show simPanel so Start button is accessible
    simPanel.classList.remove('hidden');

    startSimBtn.innerText = isSimulating ? "Reset/Stop Simulation" : "Start Simulation";
    activeStateDisplay.innerText = isSimulating && activeState ? `Active: ${activeState.isPseudostate ? "(Pseudostate)" : activeState.label}` : "Active: (None)";
    activeStateDisplay.classList.toggle('is-simulating', isSimulating);

    // Update variables
    varsList.innerHTML = "";
    Object.keys(simContext).sort().forEach(key => {
        const row = document.createElement('div');
        row.className = 'var-row';

        const label = document.createElement('label');
        label.className = 'var-label';
        label.innerText = `${key}:`;
        row.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'var-input';
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
        btn.className = 'sim-event-btn';
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
        document.body.classList.remove('light-theme');
        themeBtn.innerText = "☀ Theme";
    } else {
        document.body.classList.add('light-theme');
        themeBtn.innerText = "🌙 Theme";
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
        isDarkTheme,
        simContext
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
            if (data.simContext) {
                simContext = data.simContext;
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

    // Clear console log
    const consoleLog = document.getElementById('consoleLog');
    if (consoleLog) consoleLog.innerHTML = "";

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

    logToConsole(`Event: ${eventName}`, "event");

    const candidates = transitions.filter(t => {
        if (t.from !== activeState) return false;
        const tEvent = t.label.split('[')[0].trim();
        return eventName === tEvent;
    });

    const validTransitions = candidates.filter(t => {
        const parts = t.label.split('[');
        if (parts.length < 2) return true; // No condition
        const tCond = parts[1].split(']')[0].trim();
        return evaluateCondition(tCond);
    });

    if (validTransitions.length > 0) {
        performTransition(validTransitions[0]);
    } else {
        // Highlight candidates that failed to advance
        candidates.forEach(t => {
            t.failHighlightUntil = Date.now() + 400;
        });
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
        const outgoing = transitions.filter(nt => nt.from === activeState);

        // Priority 1: Conditional transitions that are met
        const condTransitions = outgoing.filter(t => t.label.trim() !== "" && t.label.trim() !== "[]");
        const metConds = condTransitions.filter(t => {
            const parts = t.label.split('[');
            const cond = parts.length >= 2 ? parts[1].split(']')[0].trim() : "";
            return evaluateCondition(cond);
        });

        if (metConds.length > 0) {
            // If multiple met, just pick first (validation should have warned)
            performTransition(metConds[0]);
        } else {
            // Priority 2: Unconditional 'else' path
            const elseTrans = outgoing.find(t => t.label.trim() === "" || t.label.trim() === "[]");
            if (elseTrans) {
                performTransition(elseTrans);
            }
        }
    }
}

function validatePseudostates() {
    const alertPanel = document.getElementById('alertPanel');
    const alertsList = document.getElementById('alertsList');
    alertsList.innerHTML = "";
    let baseAlerts = [];

    states.forEach(s => {
        if (!s.isPseudostate) return;
        const outgoing = transitions.filter(t => t.from === s);
        if (outgoing.length === 0) {
            s.simWarning = null; // Clear warning if no outgoing transitions
            return;
        }

        const condTransitions = outgoing.filter(t => t.label.trim() !== "" && t.label.trim() !== "[]");
        const elseTrans = outgoing.find(t => t.label.trim() === "" || t.label.trim() === "[]");

        // 1. Structural Check
        if (!elseTrans) {
            baseAlerts.push({ id: s.id, type: "Warning", css: "warning", msg: "Potential Deadlock: No default ('else') path found." });
        }

        // 2. Active Check (Current Values)
        let validCondCount = 0;
        condTransitions.forEach(t => {
            const parts = t.label.split('[');
            const cond = parts.length >= 2 ? parts[1].split(']')[0].trim() : "";
            if (evaluateCondition(cond)) validCondCount++;
        });

        if (validCondCount > 1) {
            s.simWarning = "conflict";
            baseAlerts.push({ id: s.id, type: "Error", css: "error", msg: "Conflict: Multiple conditions met simultaneously." });
        } else if (validCondCount === 0 && !elseTrans) {
            s.simWarning = "deadlock";
            baseAlerts.push({ id: s.id, type: "Error", css: "error", msg: "Deadlock: No condition met and no 'else' path." });
        } else {
            // OK or just structural warning
            s.simWarning = elseTrans ? null : "warning";
        }
    });

    if (baseAlerts.length > 0) {
        alertPanel.classList.remove('hidden');
        baseAlerts.forEach(alert => {
            const row = document.createElement('div');
            const icon = alert.type === "Error" ? "❌" : "⚠️";
            row.className = `alert-item ${alert.css}`;
            row.innerHTML = `
                <span class="alert-icon">${icon}</span>
                <div class="alert-text">
                    <strong>P${alert.id}: ${alert.type}</strong><br>
                    ${alert.msg}
                </div>
            `;
            alertsList.appendChild(row);
        });
    } else {
        alertPanel.classList.add('hidden');
    }
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

function logToConsole(msg, type = "info") {
    const consoleLog = document.getElementById('consoleLog');
    if (!consoleLog) return;
    const row = document.createElement('div');
    if (type === "event") row.className = "console-line-event";
    if (type === "error") row.className = "console-line-error";
    row.textContent = msg;
    consoleLog.appendChild(row);
    // Limit log size to 50 entries
    if (consoleLog.children.length > 50) consoleLog.removeChild(consoleLog.firstChild);
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

function executeAction(action) {
    if (!action) return;
    const lines = action.split('\n');
    lines.forEach(line => {
        try {
            const trimmed = line.trim();
            if (!trimmed) return;
            const parts = trimmed.split('=');
            if (parts.length === 2) {
                const varName = parts[0].trim();
                const expression = parts[1].trim();
                const keys = Object.keys(simContext);
                const vals = Object.values(simContext);
                const func = new Function(...keys, `return ${expression};`);
                simContext[varName] = func(...vals);
                logToConsole(`${varName} = ${simContext[varName]}`);
            } else {
                // Just log the message/function call as text
                logToConsole(trimmed);
            }
        } catch (e) {
            console.error("Action exec error:", e);
            logToConsole(`Error: ${e.message}`, "error");
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
            validatePseudostates();
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
                validatePseudostates();
                select(null);
            } else if (selectedObject instanceof Transition) {
                transitions = transitions.filter(t => t !== selectedObject);
                refreshSimVariables();
                updateSimUI();
                validatePseudostates();
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
        states = []; transitions = []; startState = null; activeState = null; isSimulating = false; stateIdCounter = 0; select(null); updateSimUI();
        validatePseudostates();
    }
};
document.getElementById('themeToggleBtn').onclick = toggleTheme;
document.getElementById('exportBtn').onclick = exportJSON;
document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = importJSON;
document.getElementById('exportPngBtn').onclick = exportPNG;
startSimBtn.onclick = () => { if (isSimulating) resetSimulation(); else startSimulation(); };

// --- C Code Generation ---
function toEnumName(label) {
    return label
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^(\d)/, '_$1')
        .toUpperCase();
}

function parseEventName(transitionLabel) {
    return transitionLabel.split('[')[0].trim();
}

function resolvePseudoChain(pseudo) {
    const outgoing = transitions.filter(t => t.from === pseudo);
    const branches = [];
    outgoing.forEach(t => {
        const condRaw = t.label.trim();
        const cond = condRaw && !condRaw.startsWith('[') ? `[${condRaw}]` : condRaw;
        if (t.to.isPseudostate) {
            const sub = resolvePseudoChain(t.to);
            sub.forEach(b => branches.push({
                cond: cond ? `${cond} && ${b.cond}` : b.cond,
                target: b.target, action: t.action || b.action
            }));
        } else {
            branches.push({ cond, target: t.to, action: t.action });
        }
    });
    return branches;
}

function generateCCode() {
    const codePanel = document.getElementById('codePanel');
    const codeOutput = document.getElementById('codeOutput');
    const toolbar = document.getElementById('toolbar');

    if (!codePanel.classList.contains('hidden')) {
        codePanel.classList.add('hidden');
        return;
    }

    const tbRect = toolbar.getBoundingClientRect();
    codePanel.style.top = (tbRect.bottom + 10) + 'px';

    const realStates = states.filter(s => !s.isPseudostate);

    if (realStates.length === 0) {
        codeOutput.textContent = '/* No states defined yet. */';
        codePanel.classList.remove('hidden');
        return;
    }

    // Collect unique events
    const eventSet = new Set();
    transitions.forEach(t => {
        if (!t.from.isPseudostate) {
            t.label.split('\n').forEach(lbl => {
                const evtName = parseEventName(lbl.trim());
                if (evtName) eventSet.add(evtName);
            });
        }
    });
    const events = [...eventSet];

    const lines = [];
    lines.push('/* Auto-generated by FSM Grapher */');
    lines.push('#include <stdint.h>');
    lines.push('');

    // State enum
    lines.push('/* States */');
    lines.push('typedef enum {');
    realStates.forEach((s, i) => {
        lines.push(`    STATE_${toEnumName(s.label)}${i < realStates.length - 1 ? ',' : ''}`);
    });
    lines.push('} FSMState;');
    lines.push('');

    // Event enum
    if (events.length > 0) {
        lines.push('/* Events */');
        lines.push('typedef enum {');
        events.forEach((e, i) => {
            lines.push(`    EVENT_${toEnumName(e)}${i < events.length - 1 ? ',' : ''}`);
        });
        lines.push('} FSMEvent;');
        lines.push('');
    }

    // fsm_next_state
    lines.push('/* Transition table */');
    lines.push('FSMState fsm_next_state(FSMState current, FSMEvent event) {');
    lines.push('    switch (current) {');
    realStates.forEach(s => {
        const outgoing = transitions.filter(t => t.from === s);
        if (!outgoing.length) return;
        lines.push(`        case STATE_${toEnumName(s.label)}:`);
        outgoing.forEach(t => {
            const lblLines = t.label.split('\n').map(l => l.trim()).filter(Boolean);
            if (t.to.isPseudostate) {
                const branches = resolvePseudoChain(t.to);
                lblLines.forEach(lbl => {
                    const evtName = parseEventName(lbl);
                    if (!evtName) return;
                    const condPart = lbl.includes('[') ? lbl.substring(lbl.indexOf('[')) : '';
                    lines.push(`            if (event == EVENT_${toEnumName(evtName)}) {`);
                    branches.forEach(b => {
                        const fullCond = [condPart, b.cond].filter(Boolean).join(' && ')
                            .replace(/\[/g, '(').replace(/\]/g, ')');
                        if (fullCond) {
                            lines.push(`                if (${fullCond}) return STATE_${toEnumName(b.target.label)};`);
                        } else {
                            lines.push(`                return STATE_${toEnumName(b.target.label)};`);
                        }
                    });
                    lines.push(`            }`);
                });
            } else {
                lblLines.forEach(lbl => {
                    const evtName = parseEventName(lbl);
                    if (!evtName) return;
                    const condPart = lbl.includes('[') ? lbl.substring(lbl.indexOf('[')).replace(/\[/g, '(').replace(/\]/g, ')') : '';
                    if (condPart) {
                        lines.push(`            if (event == EVENT_${toEnumName(evtName)} && ${condPart}) return STATE_${toEnumName(t.to.label)};`);
                    } else {
                        lines.push(`            if (event == EVENT_${toEnumName(evtName)}) return STATE_${toEnumName(t.to.label)};`);
                    }
                });
            }
        });
        lines.push(`            break;`);
    });
    lines.push('        default: break;');
    lines.push('    }');
    lines.push('    return current; /* No matching transition */');
    lines.push('}');
    lines.push('');

    // fsm_entry_action
    const statesWithActions = realStates.filter(s => s.action && s.action.trim());
    lines.push('/* Entry actions */');
    lines.push('void fsm_entry_action(FSMState state) {');
    if (statesWithActions.length > 0) {
        lines.push('    switch (state) {');
        statesWithActions.forEach(s => {
            lines.push(`        case STATE_${toEnumName(s.label)}:`);
            s.action.split('\n').forEach(a => { if (a.trim()) lines.push(`            ${a.trim()};`); });
            lines.push(`            break;`);
        });
        lines.push('        default: break;');
        lines.push('    }');
    }
    lines.push('}');
    lines.push('');

    // fsm_run_action
    const transWithActions = transitions.filter(t => !t.from.isPseudostate && t.action && t.action.trim());
    lines.push('/* Transition actions */');
    lines.push('void fsm_run_action(FSMState from, FSMEvent event, FSMState to) {');
    if (transWithActions.length > 0) {
        lines.push('    (void)event;');
        transWithActions.forEach(t => {
            lines.push(`    if (from == STATE_${toEnumName(t.from.label)} && to == STATE_${toEnumName(t.to.label)}) {`);
            t.action.split('\n').forEach(a => { if (a.trim()) lines.push(`        ${a.trim()};`); });
            lines.push(`    }`);
        });
    } else {
        lines.push('    (void)from; (void)event; (void)to;');
    }
    lines.push('}');

    codeOutput.textContent = lines.join('\n');
    codePanel.classList.remove('hidden');
}

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

// --- Init ---
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(draw);
updatePropertiesPanel();
updateSimUI();
if (!isDarkTheme) document.body.classList.add('light-theme');

