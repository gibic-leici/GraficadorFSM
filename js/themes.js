// =============================================================
// themes.js — Theme definitions, helpers, and toggle logic
// =============================================================

const getCSSVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

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
