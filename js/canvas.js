// =============================================================
// canvas.js — Canvas drawing loop and mouse/keyboard event handlers
// =============================================================

const canvas = document.getElementById('fsmCanvas');
const ctx = canvas.getContext('2d');

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

// --- Mouse & Keyboard Event Listeners ---

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
        let newLabel = prompt(promptMsg, hitTrans.label);
        if (newLabel !== null) {
            if (hitTrans.from.isPseudostate) {
                let trimmed = newLabel.trim();
                if (trimmed && !(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    newLabel = `[${trimmed}]`;
                }
            }
            hitTrans.label = newLabel;
            updatePropertiesPanel();
            refreshSimVariables();
            updateSimUI();
            validatePseudostates();
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
