const canvas = document.getElementById('fsmCanvas');
const ctx = canvas.getContext('2d');

let states = [];
let transitions = [];
let draggingState = null;
let draggingPoint = null; // For transition control points
let creatingTransition = null; // { from: state, to: mouseX/Y }

// Simulation
let startState = null;
let activeState = null;

// UI State
let isDarkTheme = true;
let lastMouseMoveTime = Date.now();
let handleOpacity = 1;
const HANDLE_FADE_DELAY = 1500; // ms before fade starts
const HANDLE_FADE_SPEED = 0.03; // opacity change per frame
const STATE_RADIUS = 45; // Increased from 30
const SNAP_DIST = 15;

let viewOffset = { x: 0, y: 0 };
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };

function getWorldPos(e) {
    return {
        x: e.clientX - viewOffset.x,
        y: e.clientY - viewOffset.y
    };
}

function drawMultilineText(ctx, text, x, y, fontSize, color, bgColor = null) {
    if (!text) return { width: 0, height: 0 };
    const lines = text.split('\n');
    const lineHeight = fontSize + 4;

    let maxWidth = 0;
    lines.forEach(l => {
        const w = ctx.measureText(l).width;
        if (w > maxWidth) maxWidth = w;
    });

    const totalHeight = lines.length * lineHeight;

    if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x - maxWidth / 2 - 4, y - totalHeight / 2 - 2, maxWidth + 8, totalHeight + 4);
    }

    ctx.fillStyle = color;
    lines.forEach((line, i) => {
        ctx.fillText(line, x, y - totalHeight / 2 + i * lineHeight + fontSize / 2 + 2);
    });

    return { width: maxWidth, height: totalHeight };
}

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
        labelColor: '#e0e0e0', // Matched to text
        handle: '#666',
        tempLine: '#666'
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
        labelColor: '#000000', // Already black
        handle: '#999',
        tempLine: '#999'
    }
};

function getTheme() {
    return isDarkTheme ? THEMES.dark : THEMES.light;
}

let stateIdCounter = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Don't call draw() here to avoid multiple loops
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Classes ---

class State {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.label = `q${id}`;
        this.action = "";
        this.radius = STATE_RADIUS; // Individual radius
        this.isStart = false;
    }

    draw(ctx) {
        const theme = getTheme();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        if (activeState === this) {
            ctx.fillStyle = theme.activeState;
        } else if (this.isStart) {
            ctx.fillStyle = theme.startState;
        } else {
            ctx.fillStyle = theme.stateFill;
        }

        ctx.fill();
        ctx.strokeStyle = theme.stateStroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Start state arrow
        if (this.isStart) {
            ctx.beginPath();
            ctx.moveTo(this.x - this.radius - 20, this.y);
            ctx.lineTo(this.x - this.radius, this.y);
            // Arrowhead
            ctx.lineTo(this.x - this.radius - 5, this.y - 5);
            ctx.moveTo(this.x - this.radius, this.y);
            ctx.lineTo(this.x - this.radius - 5, this.y + 5);
            ctx.strokeStyle = theme.transition;
            ctx.stroke();
        }

        if (selectedObject === this) {
            ctx.save();
            ctx.strokeStyle = theme.selected;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = theme.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Clip text inside the circle to prevent overflow
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 5, 0, Math.PI * 2);
        ctx.clip();

        if (this.action) {
            // Split space for name and action
            ctx.fillStyle = theme.text;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.label, this.x, this.y - 15);

            // Draw divider
            ctx.beginPath();
            ctx.moveTo(this.x - this.radius * 0.6, this.y - 2);
            ctx.lineTo(this.x + this.radius * 0.6, this.y - 2);
            ctx.strokeStyle = theme.stateStroke;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            // Multi-line action
            ctx.font = '12px Arial';
            drawMultilineText(ctx, this.action, this.x, this.y + 18, 12, theme.text);
        } else {
            // Standard centered label
            ctx.fillStyle = theme.text;
            ctx.font = '22px Arial';
            ctx.fillText(this.label, this.x, this.y);
        }
        ctx.restore(); // End clipping
    }

    isHit(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return dx * dx + dy * dy < this.radius * this.radius;
    }
}

class Transition {
    constructor(from, to) {
        this.from = from;
        this.to = to;
        this.label = "";

        // Control point offset for curvature default
        this.controlOffset = { x: 0, y: 0 };

        // Anchor points (angles on the state circle)
        // null means "automatic" (center-to-center vector)
        this.startAnchorAngle = null;
        this.endAnchorAngle = null;

        // Label offset relative to curve midpoint
        this.labelOffset = { x: 0, y: 0 };
    }

    draw(ctx) {
        const theme = getTheme();
        // Highlight if selected
        if (selectedObject === this) {
            ctx.strokeStyle = theme.selected;
            ctx.lineWidth = 4;
        } else {
            ctx.strokeStyle = theme.transition;
            ctx.lineWidth = 2;
        }
        ctx.beginPath();

        let startX, startY, endX, endY, cpX, cpY, cp2X, cp2Y;
        let isLoop = (this.from === this.to);

        // Calculate start/end points on circle
        const angleFrom = this.startAnchorAngle !== null
            ? this.startAnchorAngle
            : Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x);

        const angleTo = this.endAnchorAngle !== null
            ? this.endAnchorAngle
            : Math.atan2(this.from.y - this.to.y, this.from.x - this.to.x);

        if (isLoop) {
            // Self loop - use CUBIC Bezier for better "bulbous" shape
            const r = this.from.radius;
            const startA = this.startAnchorAngle !== null ? this.startAnchorAngle : -Math.PI / 2 - 0.4;
            const endA = this.endAnchorAngle !== null ? this.endAnchorAngle : -Math.PI / 2 + 0.4;

            startX = this.from.x + Math.cos(startA) * r;
            startY = this.from.y + Math.sin(startA) * r;
            endX = this.from.x + Math.cos(endA) * r;
            endY = this.from.y + Math.sin(endA) * r;

            // Default push magnitude
            let pushMag = r * 1.8;
            if (this.controlOffset.x !== 0 || this.controlOffset.y !== 0) {
                // Approximate push magnitude from drag offset
                pushMag = Math.sqrt(this.controlOffset.x ** 2 + this.controlOffset.y ** 2) + r + 15;
            }

            // Control points extend radially from the circle for perpendicularity
            cpX = startX + Math.cos(startA) * pushMag;
            cpY = startY + Math.sin(startA) * pushMag;
            cp2X = endX + Math.cos(endA) * pushMag;
            cp2Y = endY + Math.sin(endA) * pushMag;

            // Manual user offset applied to the whole loop position
            cpX += this.controlOffset.x;
            cpY += this.controlOffset.y;
            cp2X += this.controlOffset.x;
            cp2Y += this.controlOffset.y;

        } else {
            // Normal transition - keep QUADRATIC
            startX = this.from.x + Math.cos(angleFrom) * this.from.radius;
            startY = this.from.y + Math.sin(angleFrom) * this.from.radius;
            endX = this.to.x + Math.cos(angleTo) * this.to.radius;
            endY = this.to.y + Math.sin(angleTo) * this.to.radius;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            cpX = midX + this.controlOffset.x;
            cpY = midY + this.controlOffset.y;
        }

        // Draw Curve
        ctx.moveTo(startX, startY);
        if (isLoop) {
            ctx.bezierCurveTo(cpX, cpY, cp2X, cp2Y, endX, endY);
        } else {
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        ctx.stroke();

        // Draw Arrowhead
        // For Cubic, tangent at t=1 is (end - CP2). For Quad, it's (end - CP1).
        const tipCPX = isLoop ? cp2X : cpX;
        const tipCPY = isLoop ? cp2Y : cpY;
        const angleToEnd = Math.atan2(endY - tipCPY, endX - tipCPX);
        this.drawArrow(ctx, endX, endY, angleToEnd);

        // Calculate Label Position (at t=0.5)
        let curveMidX, curveMidY;
        if (isLoop) {
            // Cubic: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
            curveMidX = 0.125 * startX + 0.375 * cpX + 0.375 * cp2X + 0.125 * endX;
            curveMidY = 0.125 * startY + 0.375 * cpY + 0.375 * cp2Y + 0.125 * endY;
        } else {
            // Quad: B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
            curveMidX = 0.25 * startX + 0.5 * cpX + 0.25 * endX;
            curveMidY = 0.25 * startY + 0.5 * cpY + 0.25 * endY;
        }

        const labelX = curveMidX + this.labelOffset.x;
        const labelY = curveMidY + this.labelOffset.y;
        let textWidth = 0;
        let textHeight = 0;

        // Draw Label (Multi-line)
        if (this.label) {
            ctx.font = '14px Arial';
            const dims = drawMultilineText(ctx, this.label, labelX, labelY, 14, theme.labelColor, theme.labelBg);
            textWidth = dims.width;
            textHeight = dims.height;
        }

        // Draw Handles
        const handleColor = theme.handle;
        if (isLoop) {
            // Draw a single handle for loop control at the "top" of the loop
            this.drawHandle(ctx, (cpX + cp2X) / 2, (cpY + cp2Y) / 2, handleColor);
        } else {
            this.drawHandle(ctx, cpX, cpY, handleColor);
        }
        this.drawHandle(ctx, startX, startY, handleColor);
        this.drawHandle(ctx, endX, endY, handleColor);

        // Save computed coordinates for hit testing
        // For loops, we use the average CP for the hit test handle
        this.computed = {
            startX, startY, endX, endY,
            cpX: isLoop ? (cpX + cp2X) / 2 : cpX,
            cpY: isLoop ? (cpY + cp2Y) / 2 : cpY,
            labelX, labelY, textWidth, textHeight
        };
    }

    drawArrow(ctx, x, y, angle) {
        const size = 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size / 2);
        ctx.lineTo(-size, size / 2);
        ctx.closePath();
        const theme = getTheme();
        ctx.fillStyle = theme.transition;
        if (selectedObject === this) ctx.fillStyle = theme.selected;
        ctx.fill();
        ctx.restore();
    }

    drawHandle(ctx, x, y, color) {
        if (handleOpacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = handleOpacity;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2); // Increased to 6px
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    // Hit test returns string 'control', 'start', 'end', 'label' or null
    getHitPart(x, y) {
        if (!this.computed) return null;

        const dist = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;
        const R2 = 100; // Increased hit area (10px radius) for larger handles

        if (dist(x, y, this.computed.cpX, this.computed.cpY) < R2) return 'control';
        if (dist(x, y, this.computed.startX, this.computed.startY) < R2) return 'start';
        if (dist(x, y, this.computed.endX, this.computed.endY) < R2) return 'end';

        // Label hit - box-based for whole area dragging
        if (this.label) {
            const lx = this.computed.labelX;
            const ly = this.computed.labelY;
            const tw = this.computed.textWidth / 2 + 5;
            const th = this.computed.textHeight / 2 + 5;
            if (x > lx - tw && x < lx + tw && y > ly - th && y < ly + th) {
                return 'label';
            }
        }

        return null;
    }

    isHit(x, y) {
        return this.getHitPart(x, y) !== null;
    }
}

// --- Interaction ---

let selectedObject = null;

const propPanel = document.getElementById('propertiesPanel');
const stateProps = document.getElementById('stateProperties');
const transProps = document.getElementById('transitionProperties');
const noSelectionMsg = document.getElementById('noSelectionMsg');

const stateNameInput = document.getElementById('stateName');
const stateActionInput = document.getElementById('stateAction');
const stateRadiusInput = document.getElementById('stateRadius');
const transLabelInput = document.getElementById('transLabel');

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
    } else if (selectedObject instanceof Transition) {
        transProps.classList.remove('hidden');
        transLabelInput.value = selectedObject.label;
    }
}

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
transLabelInput.addEventListener('input', () => {
    if (selectedObject instanceof Transition) selectedObject.label = transLabelInput.value;
});

function draw() {
    const theme = getTheme();
    // Clear the whole screen first (untranslated)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply view offset
    ctx.translate(viewOffset.x, viewOffset.y);

    // Update handles opacity
    const timeSinceMove = Date.now() - lastMouseMoveTime;
    if (draggingPoint || creatingTransition || isPanning || timeSinceMove < HANDLE_FADE_DELAY) {
        handleOpacity = Math.min(1, handleOpacity + HANDLE_FADE_SPEED * 2);
    } else {
        handleOpacity = Math.max(0, handleOpacity - HANDLE_FADE_SPEED);
    }

    // Draw States FIRST (so transitions are on top)
    states.forEach(s => s.draw(ctx));

    // Draw Transitions ON TOP
    transitions.forEach(t => t.draw(ctx));

    // Draw temporary transition creation line
    if (creatingTransition) {
        const theme = getTheme();
        ctx.beginPath();
        ctx.moveTo(creatingTransition.from.x, creatingTransition.from.y);
        ctx.lineTo(creatingTransition.to.x, creatingTransition.to.y);
        ctx.strokeStyle = theme.tempLine;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Highlight is handled inside object draw methods now

    requestAnimationFrame(draw);
}

// Mouse Handlers
canvas.addEventListener('contextmenu', e => e.preventDefault()); // Prevent right-click menu

canvas.addEventListener('mousedown', e => {
    const worldPos = getWorldPos(e);
    const mx = worldPos.x;
    const my = worldPos.y;

    // Right-click to Pan
    if (e.button === 2) {
        isPanning = true;
        lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
    }

    // Check hit on States (topmost first usually, but checks array order)
    const hitState = states.slice().reverse().find(s => s.isHit(mx, my));

    if (e.shiftKey && hitState) {
        // Start creating transition
        creatingTransition = { from: hitState, to: { x: mx, y: my } };
        return;
    }

    if (e.altKey && hitState) {
        // Set Start State
        states.forEach(s => s.isStart = false);
        hitState.isStart = true;
        startState = hitState;
        return;
    }

    // NEW Selection Logic: Check Handles FIRST (they are "on top")
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
        // We hit a handle or label of a transition
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
        return; // Prioritize handle over state
    }

    // If no handle hit, check for state drag
    if (hitState) {
        draggingState = hitState;
        select(hitState);
    } else {
        // Clicked empty space
        select(null);
    }
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
            draggingPoint.t.controlOffset.x = draggingPoint.initialControl.x + dx;
            draggingPoint.t.controlOffset.y = draggingPoint.initialControl.y + dy;
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
    if (e.button === 2) {
        isPanning = false;
        return;
    }

    const worldPos = getWorldPos(e);
    const mx = worldPos.x;
    const my = worldPos.y;

    if (creatingTransition) {
        const hitState = states.find(s => s.isHit(mx, my));
        if (hitState) {
            // Create transition
            transitions.push(new Transition(creatingTransition.from, hitState));
        }
        creatingTransition = null;
    } else if (draggingState) {
        draggingState = null;
    } else if (draggingPoint) {
        draggingPoint = null;
    }
});

canvas.addEventListener('dblclick', e => {
    // prompts removed in favor of properties panel
});

// UI Actions

document.getElementById('addStateBtn').addEventListener('click', () => {
    const id = stateIdCounter++;
    // Place in the visible center of the screen
    const x = (canvas.width / 2 - viewOffset.x) + (Math.random() - 0.5) * 100;
    const y = (canvas.height / 2 - viewOffset.y) + (Math.random() - 0.5) * 100;

    const newState = new State(x, y, id);
    states.push(newState);
    select(newState);
});

document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!selectedObject) return;

    if (selectedObject instanceof State) {
        // Remove state
        states = states.filter(s => s !== selectedObject);
        // Remove associated transitions
        transitions = transitions.filter(t => t.from !== selectedObject && t.to !== selectedObject);
        select(null);
    } else if (selectedObject instanceof Transition) {
        transitions = transitions.filter(t => t !== selectedObject);
        select(null);
    }
});

document.getElementById('themeToggleBtn').addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('light-theme', !isDarkTheme);
    document.getElementById('themeToggleBtn').innerText = isDarkTheme ? "Switch to Light Theme" : "Switch to Dark Theme";
});

// Persistence: Export
document.getElementById('exportBtn').addEventListener('click', () => {
    const data = {
        states: states.map(s => ({
            id: s.id, x: s.x, y: s.y, label: s.label, action: s.action, radius: s.radius, isStart: s.isStart
        })),
        transitions: transitions.map(t => ({
            fromId: t.from.id,
            toId: t.to.id,
            label: t.label,
            controlOffset: t.controlOffset,
            startAnchorAngle: t.startAnchorAngle,
            endAnchorAngle: t.endAnchorAngle,
            labelOffset: t.labelOffset
        })),
        isDarkTheme: isDarkTheme,
        stateIdCounter: stateIdCounter
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fsm_graph_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// Persistence: Import
document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const data = JSON.parse(event.target.result);

            // Clear current
            states = [];
            transitions = [];

            // Re-create states
            data.states.forEach(sData => {
                const s = new State(sData.x, sData.y, sData.id);
                s.label = sData.label;
                s.action = sData.action;
                s.radius = sData.radius || STATE_RADIUS;
                s.isStart = sData.isStart;
                if (s.isStart) startState = s;
                states.push(s);
            });

            // Re-create transitions
            data.transitions.forEach(tData => {
                const from = states.find(s => s.id === tData.fromId);
                const to = states.find(s => s.id === tData.toId);
                if (from && to) {
                    const t = new Transition(from, to);
                    t.label = tData.label;
                    t.controlOffset = tData.controlOffset;
                    t.startAnchorAngle = tData.startAnchorAngle;
                    t.endAnchorAngle = tData.endAnchorAngle;
                    t.labelOffset = tData.labelOffset;
                    transitions.push(t);
                }
            });

            stateIdCounter = data.stateIdCounter || states.length;
            isDarkTheme = data.isDarkTheme !== undefined ? data.isDarkTheme : true;
            document.body.classList.toggle('light-theme', !isDarkTheme);
            document.getElementById('themeToggleBtn').innerText = isDarkTheme ? "Switch to Light Theme" : "Switch to Dark Theme";

            select(null);
            activeState = null;

        } catch (err) {
            alert("Error parsing JSON file.");
            console.error(err);
        }
        e.target.value = ''; // Reset input
    };
    reader.readAsText(file);
});

// Image Export (PNG)
document.getElementById('exportPngBtn').addEventListener('click', () => {
    if (states.length === 0) {
        alert("Board is empty.");
        return;
    }

    // 1. Calculate Bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    states.forEach(s => {
        minX = Math.min(minX, s.x - s.radius);
        maxX = Math.max(maxX, s.x + s.radius);
        minY = Math.min(minY, s.y - s.radius);
        maxY = Math.max(maxY, s.y + s.radius);
    });

    transitions.forEach(t => {
        if (t.computed) {
            // Use the control points and endpoints for bounding box
            const { startX, startY, endX, endY, cpX, cpY, labelX, labelY } = t.computed;
            // For labels, we add a bit of buffer
            minX = Math.min(minX, startX, endX, cpX, labelX - 20);
            maxX = Math.max(maxX, startX, endX, cpX, labelX + 20);
            minY = Math.min(minY, startY, endY, cpY, labelY - 20);
            maxY = Math.max(maxY, startY, endY, cpY, labelY + 20);
        }
    });

    const margin = 50;
    minX -= margin; minY -= margin; maxX += margin; maxY += margin;

    const width = maxX - minX;
    const height = maxY - minY;

    // 2. Create Off-screen canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tCtx = tempCanvas.getContext('2d');

    // 3. Prepare "Clean" Render
    const oldOpacity = handleOpacity;
    const oldSelected = selectedObject;
    handleOpacity = 0;
    selectedObject = null;

    // 4. Draw onto off-screen canvas
    tCtx.save();
    tCtx.translate(-minX, -minY);

    const theme = getTheme();
    tCtx.fillStyle = theme.bg;
    tCtx.fillRect(minX, minY, width, height);

    states.forEach(s => s.draw(tCtx));
    transitions.forEach(t => t.draw(tCtx));

    tCtx.restore();

    // 5. Trigger download
    const link = document.createElement('a');
    link.download = `fsm_graph_${Date.now()}.png`;
    link.href = tempCanvas.toDataURL("image/png");
    link.click();

    // 6. Restore UI state
    handleOpacity = oldOpacity;
    select(oldSelected);
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm("Clear all states and transitions?")) {
        states = [];
        transitions = [];
        startState = null;
        activeState = null;
        viewOffset = { x: 0, y: 0 };
        select(null);
    }
});

// Keyboard Delete
window.addEventListener('keydown', e => {
    // Only delete if the user is NOT typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Delete') {
        document.getElementById('deleteBtn').click();
    }
});


// Intentionally disabling simulation listeners for now or keeping them but UI is hidden
// --- Simulator --- (Hidden)

/*
const simulateBtn = document.getElementById('simulateBtn');
// ... other sim code ...
*/

// Initial draw start
draw();
