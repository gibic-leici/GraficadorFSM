class TransitionAnimation {
    constructor(transition) {
        this.transition = transition;
        this.startTime = Date.now();
        this.complete = false;
        this.path = { ...transition.computed };
        this.isLoop = (transition.from === transition.to);

        const dist = (x1, y1, x2, y2) => Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
        let pathLength = 0;

        if (this.isLoop) {
            const r = transition.from.radius;
            const startA = transition.startAnchorAngle !== null ? transition.startAnchorAngle : -Math.PI / 2 - 0.4;
            const endA = transition.endAnchorAngle !== null ? transition.endAnchorAngle : -Math.PI / 2 + 0.4;
            let pushMag = r * 1.8;
            if (transition.controlOffset.x !== 0 || transition.controlOffset.y !== 0) {
                pushMag = Math.sqrt(transition.controlOffset.x ** 2 + transition.controlOffset.y ** 2) + r + 15;
            }
            this.cp1X = this.path.startX + Math.cos(startA) * pushMag + transition.controlOffset.x;
            this.cp1Y = this.path.startY + Math.sin(startA) * pushMag + transition.controlOffset.y;
            this.cp2X = this.path.endX + Math.cos(endA) * pushMag + transition.controlOffset.x;
            this.cp2Y = this.path.endY + Math.sin(endA) * pushMag + transition.controlOffset.y;

            pathLength = dist(this.path.startX, this.path.startY, this.cp1X, this.cp1Y) +
                dist(this.cp1X, this.cp1Y, this.cp2X, this.cp2Y) +
                dist(this.cp2X, this.cp2Y, this.path.endX, this.path.endY);
        } else {
            pathLength = dist(this.path.startX, this.path.startY, this.path.cpX, this.path.cpY) +
                dist(this.path.cpX, this.path.cpY, this.path.endX, this.path.endY);
        }

        const SPEED = 2.5;
        this.duration = Math.max(100, pathLength / SPEED);
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        this.t = Math.min(1, elapsed / this.duration);
        if (this.t >= 1) this.complete = true;
    }

    getPos(t) {
        let x, y;
        const invT = (1 - t);
        if (this.isLoop) {
            x = invT ** 3 * this.path.startX + 3 * invT ** 2 * t * this.cp1X + 3 * invT * t ** 2 * this.cp2X + t ** 3 * this.path.endX;
            y = invT ** 3 * this.path.startY + 3 * invT ** 2 * t * this.cp1Y + 3 * invT * t ** 2 * this.cp2Y + t ** 3 * this.path.endY;
        } else {
            x = invT ** 2 * this.path.startX + 2 * invT * t * this.path.rawCpX + t ** 2 * this.path.endX;
            y = invT ** 2 * this.path.startY + 2 * invT * t * this.path.rawCpY + t ** 2 * this.path.endY;
        }
        return { x, y };
    }

    draw(ctx) {
        const theme = getTheme();
        for (let i = 4; i >= 0; i--) {
            const trailT = this.t - (i * 0.04);
            if (trailT < 0 || trailT > 1) continue;
            const pos = this.getPos(trailT);
            const size = (i === 0) ? 12 : 10 - i * 1.5;
            const alpha = 1 - (i * 0.2);
            ctx.save();
            ctx.globalAlpha = alpha;
            if (i === 0) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = theme.transition;
            }
            const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.4, theme.transition);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

function startSimulation() {
    if (!startState) {
        alert("Please set a Start State first (Alt + Click on a state)");
        return;
    }
    isSimulating = true;
    activeState = startState;
    simContext = {};
    updateSimUI();
    validatePseudostates();
}

function resetSimulation() {
    isSimulating = false;
    activeState = null;
    simContext = {};
    updateSimUI();
    // Clear warnings when stopping simulation (optional, but keeps canvas clean)
    states.forEach(s => s.simWarning = null);
}

function fireEvent(eventName) {
    if (!isSimulating || !activeState) return;
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
        const t = validTransitions[0];
        if (t.action) executeAction(t.action);
        animations.push(new TransitionAnimation(t));
        activeState = t.to;
        if (activeState.action) executeAction(activeState.action);
        updateSimUI();
        executeSimulationStep();
    }
}

function executeSimulationStep() {
    if (!isSimulating || !activeState) return;
    updateSimUI();
    if (activeState.isPseudostate) {
        if (activeState.simWarning) {
            console.warn(`Pseudostate warning during traversal: ${activeState.simWarning.toUpperCase()}`);
        }
        const nextTrans = transitions.find(nt => {
            if (nt.from !== activeState) return false;
            let cond = nt.label.trim();
            if (cond.startsWith('[')) cond = cond.substring(1, cond.length - 1);
            return evaluateCondition(cond);
        });
        if (nextTrans) {
            if (nextTrans.action) executeAction(nextTrans.action);
            animations.push(new TransitionAnimation(nextTrans));
            activeState = nextTrans.to;
            if (activeState.action) executeAction(activeState.action);
            setTimeout(() => executeSimulationStep(), 400);
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
