// =============================================================
// simulation.js — FSM simulation engine
// =============================================================

function startSimulation() {
    if (!startState) {
        alert("Please set a Start State first (Alt + Click on a state)");
        return;
    }
    isSimulating = true;

    const consoleLog = document.getElementById('consoleLog');
    if (consoleLog) consoleLog.innerHTML = "";

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

    activeState = null;
    performTransition(virtualStartTrans);

    refreshSimVariables();
    updateSimUI();
    validatePseudostates();
}

function resetSimulation() {
    isSimulating = false;
    activeState = null;
    updateSimUI();
    states.forEach(s => s.simWarning = null);
}

function fireEvent(eventName) {
    if (!isSimulating || !activeState) return;
    if (animations.some(a => !a.complete)) return;

    logToConsole(`Event: ${eventName}`, "event");

    const candidates = transitions.filter(t => {
        if (t.from !== activeState) return false;
        const tEvent = t.label.split('[')[0].trim();
        return eventName === tEvent;
    });

    const validTransitions = candidates.filter(t => {
        const parts = t.label.split('[');
        if (parts.length < 2) return true;
        const tCond = parts[1].split(']')[0].trim();
        return evaluateCondition(tCond);
    });

    if (validTransitions.length > 0) {
        performTransition(validTransitions[0]);
    } else {
        candidates.forEach(t => {
            t.failHighlightUntil = Date.now() + 400;
        });
    }
}

function performTransition(t) {
    if (!isSimulating) return;

    if (t.action) executeAction(t.action);

    const anim = new TransitionAnimation(t);
    animations.push(anim);

    updateSimUI();

    setTimeout(() => {
        if (!isSimulating) return;
        activeState = t.to;
        if (activeState.action) executeAction(activeState.action);
        updateSimUI();

        if (activeState.isPseudostate) {
            executeSimulationStep();
        }
    }, anim.duration);
}

function executeSimulationStep() {
    if (!isSimulating || !activeState) return;

    if (activeState.isPseudostate) {
        const outgoing = transitions.filter(nt => nt.from === activeState);

        const condTransitions = outgoing.filter(t => t.label.trim() !== "" && t.label.trim() !== "[]");
        const metConds = condTransitions.filter(t => {
            const parts = t.label.split('[');
            const cond = parts.length >= 2 ? parts[1].split(']')[0].trim() : "";
            return evaluateCondition(cond);
        });

        if (metConds.length > 0) {
            performTransition(metConds[0]);
        } else {
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
            s.simWarning = null;
            return;
        }

        const condTransitions = outgoing.filter(t => t.label.trim() !== "" && t.label.trim() !== "[]");
        const elseTrans = outgoing.find(t => t.label.trim() === "" || t.label.trim() === "[]");

        if (!elseTrans) {
            baseAlerts.push({ id: s.id, type: "Warning", css: "warning", msg: "Potential Deadlock: No default ('else') path found." });
        }

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
                logToConsole(trimmed);
            }
        } catch (e) {
            console.error("Action exec error:", e);
            logToConsole(`Error: ${e.message}`, "error");
        }
    });
    validatePseudostates();
}
