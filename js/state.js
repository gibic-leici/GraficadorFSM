// =============================================================
// state.js — Global application state and constants
// =============================================================

// Configuration Constants
const HANDLE_FADE_DELAY = 1500;
const HANDLE_FADE_SPEED = 0.03;
const STATE_RADIUS = 45;
const SNAP_DIST = 15;

// Graph Data
let states = [];
let transitions = [];

// Canvas Interaction State
let draggingState = null;
let draggingPoint = null;
let creatingTransition = null;
let selectedObject = null;
let stateIdCounter = 0;

// View State
let viewOffset = { x: 0, y: 0 };
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };
let lastMouseMoveTime = Date.now();
let handleOpacity = 1;

// Simulation State
let startState = null;
let activeState = null;
let simContext = {};
let isSimulating = false;
let animations = [];

// Theme State
let isDarkTheme = true;
