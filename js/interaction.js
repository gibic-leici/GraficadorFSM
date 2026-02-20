// Event Listeners for Canvas
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

    // 1. Check hit on Transition Handles
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

    // 2. Check hit on States
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
            const multiplier = draggingPoint.t.from === draggingPoint.t.to ? 1.5 : 2.0;
            draggingPoint.t.controlOffset.x = draggingPoint.initialControl.x + dx * multiplier;
            draggingPoint.t.controlOffset.y = draggingPoint.initialControl.y + dy * multiplier;
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
    if (isPanning) {
        isPanning = false;
        return;
    }
    if (creatingTransition) {
        const mx = e.clientX - viewOffset.x;
        const my = e.clientY - viewOffset.y;
        const hitState = states.slice().reverse().find(s => s.isHit(mx, my));
        if (hitState) {
            const newTrans = new Transition(creatingTransition.from, hitState);
            transitions.push(newTrans);
            select(newTrans);
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
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject && !(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            if (selectedObject instanceof State) {
                states = states.filter(s => s !== selectedObject);
                transitions = transitions.filter(t => t.from !== selectedObject && t.to !== selectedObject);
                if (startState === selectedObject) startState = null;
                if (activeState === selectedObject) resetSimulation();
            } else {
                transitions = transitions.filter(t => t !== selectedObject);
            }
            select(null);
        }
    }
});

// Live editing
stateNameInput.addEventListener('input', () => {
    if (selectedObject instanceof State) selectedObject.label = stateNameInput.value;
});
stateActionInput.addEventListener('input', () => {
    if (selectedObject instanceof State) selectedObject.action = stateActionInput.value;
});
stateRadiusInput.addEventListener('input', () => {
    if (selectedObject instanceof State) {
        const val = parseInt(stateRadiusInput.value);
        if (!isNaN(val)) selectedObject.radius = Math.max(30, Math.min(150, val));
    }
});
transEventInput.addEventListener('input', () => {
    if (selectedObject instanceof Transition) selectedObject.label = transEventInput.value;
});
transActionInput.addEventListener('input', () => {
    if (selectedObject instanceof Transition) selectedObject.action = transActionInput.value;
});

// Toolbar Buttons
document.getElementById('addStateBtn').onclick = () => {
    const s = new State(canvas.width / 2 - viewOffset.x, canvas.height / 2 - viewOffset.y, stateIdCounter++);
    states.push(s);
    select(s);
};

document.getElementById('addPseudoStateBtn').onclick = () => {
    const s = new State(canvas.width / 2 - viewOffset.x, canvas.height / 2 - viewOffset.y, stateIdCounter++, true);
    states.push(s);
    select(s);
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
    }
};

document.getElementById('clearBtn').onclick = () => {
    if (confirm("Clear all states and transitions?")) {
        states = [];
        transitions = [];
        startState = null;
        activeState = null;
        isSimulating = false;
        stateIdCounter = 0;
        select(null);
        updateSimUI();
    }
};

document.getElementById('themeToggleBtn').onclick = toggleTheme;
document.getElementById('exportBtn').onclick = exportJSON;
document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = importJSON;
document.getElementById('exportPngBtn').onclick = exportPNG;
startSimBtn.onclick = () => {
    if (isSimulating) resetSimulation();
    else startSimulation();
};
