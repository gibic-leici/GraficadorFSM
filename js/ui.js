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
const transConditionInput = document.getElementById('transCondition');
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

        let eventStr = "";
        let condStr = "";

        if (selectedObject.from.isPseudostate) {
            condStr = selectedObject.label || "";
        } else {
            const rawLabel = selectedObject.label || "";
            const bracketIdx = rawLabel.indexOf('[');
            if (bracketIdx !== -1) {
                eventStr = rawLabel.substring(0, bracketIdx).trim();
                condStr = rawLabel.substring(bracketIdx).trim();
            } else {
                eventStr = rawLabel.trim();
            }
        }

        transEventInput.value = eventStr;
        transConditionInput.value = condStr;
        transActionInput.value = selectedObject.action || "";

        const eventLabelNode = transEventInput.previousElementSibling;
        const condLabelNode = transConditionInput.previousElementSibling;

        if (selectedObject.from.isPseudostate) {
            eventLabelNode.classList.add('u-hidden');
            transEventInput.classList.add('u-hidden');

            condLabelNode.classList.remove('u-hidden');
            transConditionInput.classList.remove('u-hidden');
            transConditionInput.placeholder = "e.g. x > 5";
        } else {
            eventLabelNode.classList.remove('u-hidden');
            transEventInput.classList.remove('u-hidden');

            condLabelNode.classList.remove('u-hidden');
            transConditionInput.classList.remove('u-hidden');
            transEventInput.placeholder = "e.g. signal";
            transConditionInput.placeholder = "e.g. [x>5]";
        }
    }
}

function refreshSimVariables() {
    const varRegex = /\b[a-zA-Z_]\w*\b/g;
    const keywords = new Set(['true', 'false', 'null', 'Math', 'and', 'or', 'not']);
    const activeVars = new Set();

    transitions.forEach(t => {
        let condString = "";
        if (t.from.isPseudostate) {
            const raw = t.label.trim();
            condString = (raw.startsWith('[') && raw.endsWith(']'))
                ? raw.substring(1, raw.length - 1)
                : raw;
        } else {
            const match = /\[(.*?)\]/.exec(t.label);
            if (match) condString = match[1];
        }

        if (condString) {
            let m;
            while ((m = varRegex.exec(condString)) !== null) {
                let v = m[0];
                if (!keywords.has(v)) {
                    activeVars.add(v);
                    if (simContext[v] === undefined) simContext[v] = 0;
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
                if (varRegex.test(varName) && !keywords.has(varName)) {
                    activeVars.add(varName);
                    if (simContext[varName] === undefined) simContext[varName] = 0;
                }
            }
        });
    };

    states.forEach(s => scanActions(s.action));
    transitions.forEach(t => scanActions(t.action));

    // Remove ghost variables
    Object.keys(simContext).forEach(key => {
        if (!activeVars.has(key)) {
            delete simContext[key];
        }
    });
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
