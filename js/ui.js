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

function updateSimUI() {
    simPanel.classList.remove('hidden');

    if (!isSimulating) {
        startSimBtn.innerText = "Start Simulation";
        activeStateDisplay.innerText = "Active: (None)";
        varsList.innerHTML = "";
        eventsList.innerHTML = "";
        return;
    }

    simPanel.classList.remove('hidden');
    startSimBtn.innerText = "Reset/Stop Simulation";
    activeStateDisplay.innerText = activeState ? `Active: ${activeState.isPseudostate ? "(Pseudostate)" : activeState.label}` : "Active: (None)";

    // Update variables
    varsList.innerHTML = "";
    Object.keys(simContext).forEach(key => {
        const row = document.createElement('div');
        row.className = 'var-row';
        row.innerHTML = `<label>${key}:</label>`;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = -20;
        input.max = 100;
        input.value = simContext[key];
        input.addEventListener('input', (e) => {
            simContext[key] = parseFloat(e.target.value);
            valDisplay.innerText = simContext[key];
            validatePseudostates();
        });
        const valDisplay = document.createElement('span');
        valDisplay.innerText = simContext[key];
        row.appendChild(input);
        row.appendChild(valDisplay);
        varsList.appendChild(row);
    });

    // Update events
    eventsList.innerHTML = "";
    const relevantEvents = new Set();
    transitions.filter(t => t.from === activeState && !activeState.isPseudostate).forEach(t => {
        const evt = t.label.split('[')[0].trim();
        if (evt) relevantEvents.add(evt);
    });

    relevantEvents.forEach(evt => {
        const btn = document.createElement('button');
        btn.innerText = evt;
        btn.onclick = () => fireEvent(evt);
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
