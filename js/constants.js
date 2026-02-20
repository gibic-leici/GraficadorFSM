// DOM Elements
const canvas = document.getElementById('fsmCanvas');
const ctx = canvas.getContext('2d');

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

// Global Application State
let states = [];
let transitions = [];
let draggingState = null;
let draggingPoint = null;
let creatingTransition = null;

// Simulation State
let startState = null;
let activeState = null;
let simContext = {};
let isSimulating = false;
let animations = [];

// UI & Interaction State
let isDarkTheme = true;
let lastMouseMoveTime = Date.now();
let handleOpacity = 1;
let viewOffset = { x: 0, y: 0 };
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };
let selectedObject = null;
let stateIdCounter = 0;

// Configuration Constants
const HANDLE_FADE_DELAY = 1500;
const HANDLE_FADE_SPEED = 0.03;
const STATE_RADIUS = 45;
const SNAP_DIST = 15;

// Theme Definitions
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
        labelColor: '#e0e0e0',
        handle: '#666',
        tempLine: '#666',
        syntaxCondition: '#f1c40f',
        syntaxFunction: '#5dade2'
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
        labelColor: '#000000',
        handle: '#999',
        tempLine: '#999',
        syntaxCondition: '#c05621',
        syntaxFunction: '#2b6cb0'
    }
};

function getTheme() {
    return isDarkTheme ? THEMES.dark : THEMES.light;
}
