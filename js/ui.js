// =============================================================
// ui.js — Properties panel, sim UI, and selection helpers
// =============================================================

// DOM references for UI panels
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
    const consolePanel = document.getElementById('consolePanel');

    if (isSimulating) {
        consolePanel.classList.remove('hidden');
    } else {
        consolePanel.classList.add('hidden');
    }

    simPanel.classList.remove('hidden');

    startSimBtn.innerText = isSimulating ? "Reset/Stop Simulation" : "Start Simulation";
    activeStateDisplay.innerText = isSimulating && activeState ? `Active: ${activeState.isPseudostate ? "(Pseudostate)" : activeState.label}` : "Active: (None)";
    activeStateDisplay.classList.toggle('is-simulating', isSimulating);

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
        eventsList.appendChild(btn);
    });
}
