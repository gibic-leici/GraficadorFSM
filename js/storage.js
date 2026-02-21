// =============================================================
// storage.js — Save/load FSM (JSON) and export PNG
// =============================================================

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
