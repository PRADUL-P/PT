/**
 * TendonFlow - PT Slab Tendon Path Designer
 * Core Application Logic, Mathematical Solver, and SVG Visualizer
 */

// Application State
// Application State
const state = {
    // Parameters (User Inputs)
    numSpans: 2,
    unit: 'cm', // 'mm' or 'cm'
    slabThickness: 200,      // mm
    concreteDensity: 24.0,    // kN/m³
    spanLengths: [8.0, 9.0], // meters
    slabWidth: 12.0,          // meters
    spanYLen: 8.0,            // meters
    coverTop: 25,             // mm
    coverBottom: 25,          // mm
    inflectionRatio: 0.10,    // fraction of span (a/L)
    tendonForce: 1400,        // kN (X direction)
    tendonForceY: 1400,       // kN (Y direction)
    jackingEnd: 'left',       // 'left', 'right', 'both'
    frictionMu: 0.15,         // Curvature friction coefficient
    frictionK: 0.002,         // Wobble friction coefficient (rad/m)
    anchorSet: 6,             // mm (wedge slip)
    tendonSpacingX: 1.5,      // meters
    tendonSpacingY: 1.5,      // meters
    verticalExaggeration: 5,  // Scale multiplier for vertical representation
    activeTab: 'elevation',   // 'elevation' or 'plan'
    clipboardTendonSet: null, // copied perpendicular tendon set state
    clipboardControlPoints: null, // copied tendon profile heights state
    minSupportAngle: 2.0,     // degrees
    maxSupportAngle: 6.0,     // degrees
    elevationTendonSets: [],  // Perpendicular tendon sets in Elevation view
    ductDiameter: 25,         // mm

    controlPoints: {
        // Supports heights (at x = 0, L1, L1+L2, L1+L2+L3)
        // Set according to top dimensions: S0 = h-30, S1 = h-25, S2 = h-25
        supports: [170, 175, 175], // mm from bottom
        supportsLocked: [false, false, false],
        
        // Low points for each span: [local_x_fraction, height_mm]
        // Set according to bottom dimensions: Span 1 = 25, Span 2 = 30
        lowPoints: [
            { xFract: 0.4, y: 25 }, // Span 1
            { xFract: 0.6, y: 30 }  // Span 2
        ],
        lowPointsLocked: [false, false]
    },

    // 2D Plan Layout State
    planXTendonsMode: 'spacing', // 'spacing' or 'positions'
    planXTendonsSpacing: 1.5, // spacing in meters
    planXTendons: [1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5], // Y-coordinates in meters
    planYTendons: [
        [1.5, 2.0, 6.0, 6.5], // Span 1 relative X
        [1.5, 2.0, 7.0, 7.5, 8.0, 8.5], // Span 2 relative X
        [1.5, 2.0, 6.0, 6.5] // Span 3 relative X
    ],
    planColumns: [], // Array of { id, x, y }
    numColRows: 3,
    selectedRowIdx: 0,
    controlPointsRows: [],

    // Calculated Data Cache
    sampledPoints: [], // List of { xGlobal, xLocal, spanIndex, y, dy, ddy, force, alpha }
    chartData: []
};

// UI Elements
const DOM = {
    numSpans: document.getElementById('num-spans'),
    numColRowsElev: document.getElementById('num-col-rows-elev'),
    numColRowsPlan: document.getElementById('num-col-rows-plan'),
    unitSelect: document.getElementById('unit-select'),
    slabThickness: document.getElementById('slab-thickness'),
    slabWidth: document.getElementById('slab-width'),
    spanYLen: document.getElementById('span-y-len'),
    concreteDensity: document.getElementById('concrete-density'),
    span1Len: document.getElementById('span-1-len'),
    span2Len: document.getElementById('span-2-len'),
    span3Len: document.getElementById('span-3-len'),
    span1Container: document.getElementById('span-1-container'),
    span2Container: document.getElementById('span-2-container'),
    span3Container: document.getElementById('span-3-container'),
    coverTop: document.getElementById('cover-top'),
    coverBottom: document.getElementById('cover-bottom'),
    inflectionRatio: document.getElementById('inflection-ratio'),
    inflectionRatioVal: document.getElementById('inflection-ratio-val'),
    tendonForce: document.getElementById('tendon-force'),
    tendonForceY: document.getElementById('tendon-force-y'),
    jackingEnd: document.getElementById('jacking-end'),
    frictionMu: document.getElementById('friction-mu'),
    frictionK: document.getElementById('friction-k'),
    anchorSet: document.getElementById('anchor-set'),
    tendonSpacingX: document.getElementById('tendon-spacing-x'),
    tendonSpacingY: document.getElementById('tendon-spacing-y'),
    verticalExaggeration: document.getElementById('vertical-exaggeration'),
    profileSvg: document.getElementById('profile-svg'),
    svgContainer: document.getElementById('svg-container'),
    lossChart: document.getElementById('loss-chart'),
    coordsTable: document.getElementById('coords-table').querySelector('tbody'),
    minForceVal: document.getElementById('min-force-val'),
    maxLossVal: document.getElementById('max-loss-val'),
    checkCover: document.getElementById('check-cover'),
    checkCoverDesc: document.getElementById('check-cover-desc'),
    checkLoadBalancing: document.getElementById('check-load-balancing'),
    balancingMetrics: document.getElementById('balancing-metrics'),
    checkAvgPrestress: document.getElementById('check-avg-prestress'),
    checkPrestressDesc: document.getElementById('check-prestress-desc'),
    btnReset: document.getElementById('btn-reset'),
    btnSaveJson: document.getElementById('btn-save-json'),
    btnLoadJson: document.getElementById('btn-load-json'),
    inputLoadJson: document.getElementById('input-load-json'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnExportSvg: document.getElementById('btn-export-svg'),
    btnExportAutocad: document.getElementById('btn-export-autocad'),
    autocadModal: document.getElementById('autocad-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelExport: document.getElementById('btn-cancel-export'),
    btnConfirmExport: document.getElementById('btn-confirm-export'),
    btnCopyCadCoords: document.getElementById('btn-copy-cad-coords'),
    btnCopyLispData: document.getElementById('btn-copy-lisp-data'),
    lnkDownloadLsp: document.getElementById('lnk-download-lsp'),
    cadCommandHelp: document.getElementById('cad-command-help'),
    tooltip: document.getElementById('canvas-tooltip'),
    
    // Tab selectors
    tabElevation: document.getElementById('tab-elevation'),
    tabPlan: document.getElementById('tab-plan'),
    tabSplit: document.getElementById('tab-split'),
    planSvg: document.getElementById('plan-svg'),
    visualizerLegend: document.getElementById('visualizer-legend'),
    nodeInputsContainer: document.getElementById('node-inputs-container'),
    btnCopyProfile: document.getElementById('btn-copy-profile'),
    btnPasteProfile: document.getElementById('btn-paste-profile'),

    // Perpendicular Tendon Controls
    minSupportAngle: document.getElementById('min-support-angle'),
    maxSupportAngle: document.getElementById('max-support-angle'),
    numTendonSets: document.getElementById('num-tendon-sets'),
    tendonSetsContainer: document.getElementById('tendon-sets-container'),
    checkSupportAngles: document.getElementById('check-support-angles'),
    checkSupportAnglesDesc: document.getElementById('check-support-angles-desc'),
    checkTendonClashes: document.getElementById('check-tendon-clashes'),
    checkTendonClashesDesc: document.getElementById('check-tendon-clashes-desc'),
    ductDiameter: document.getElementById('duct-diameter')
};

// SVG Drag State
let dragNode = null;

// Initialize App
function init() {
    window.state = state;
    updateInputUnitBounds();
    setupEventListeners();
    resetDesign();
    calculateAndRender();
    setupRevitBridge();
}

function setupRevitBridge() {
    // Poll for window.chrome.webview to handle injection race condition in Revit
    const checkInterval = setInterval(() => {
        const isRevit = typeof window.chrome !== 'undefined' && typeof window.chrome.webview !== 'undefined';
        if (isRevit) {
            clearInterval(checkInterval);
            
            window.chrome.webview.addEventListener('message', event => {
                try {
                    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                    
                    if (data.action === 'revit_sync') {
                        const length = data.length;
                        const thickness = data.thickness;
                        
                        // 1. Update Slab Thickness
                        state.slabThickness = Math.round(thickness);
                        if (DOM.slabThickness) DOM.slabThickness.value = state.slabThickness;
                        
                        // 2. Update Span Lengths
                        if (state.numSpans === 1) {
                            state.spanLengths = [length];
                        } else if (state.numSpans === 2) {
                            state.spanLengths = [length * 0.5, length * 0.5];
                        } else if (state.numSpans === 3) {
                            state.spanLengths = [length * 0.33, length * 0.34, length * 0.33];
                        }
                        
                        const inputs = [DOM.span1Len, DOM.span2Len, DOM.span3Len];
                        state.spanLengths.forEach((l, idx) => {
                            if (inputs[idx]) inputs[idx].value = l.toFixed(2);
                        });
                        
                        // 3. Recompute and render
                        syncColumnsFromSpanLengths();
                        updateInputUnitBounds();
                        rebuildColumnLayout();
                        calculateAndRender();
                        
                        // Show a non-blocking toast instead of a blocking alert
                        const toastEl = document.getElementById('revit-sync-toast');
                        if (toastEl) {
                            toastEl.textContent = `Revit sync: ${state.slabThickness}mm slab, ${length.toFixed(2)}m tendon`;
                            toastEl.style.display = 'block';
                            setTimeout(() => { toastEl.style.display = 'none'; }, 4000);
                        }
                    } else if (data.action === 'line_selected') {
                        const length = data.length;
                        if (state.numSpans === 1) {
                            state.spanLengths = [length];
                        } else if (state.numSpans === 2) {
                            state.spanLengths = [length * 0.5, length * 0.5];
                        } else if (state.numSpans === 3) {
                            state.spanLengths = [length * 0.33, length * 0.34, length * 0.33];
                        }
                        
                        const inputs = [DOM.span1Len, DOM.span2Len, DOM.span3Len];
                        state.spanLengths.forEach((l, idx) => {
                            if (inputs[idx]) inputs[idx].value = l.toFixed(2);
                        });
                        
                        syncColumnsFromSpanLengths();
                        rebuildColumnLayout();
                        calculateAndRender();
                        const toastEl2 = document.getElementById('revit-sync-toast');
                        if (toastEl2) {
                            toastEl2.textContent = `Span updated from Revit line (${length.toFixed(2)} m)`;
                            toastEl2.style.display = 'block';
                            setTimeout(() => { toastEl2.style.display = 'none'; }, 4000);
                        }
                    }
                } catch(e) {
                    console.error("Error handling WebView2 message:", e);
                }
            });
        }
    }, 100);
    
    // Stop checking after 5 seconds if not running in Revit
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 5000);
}

// Unit conversion helpers
function toMm(val) {
    return state.unit === 'cm' ? val * 10 : val;
}

function fromMm(val) {
    return state.unit === 'cm' ? val / 10 : val;
}

function getBracketedUnit() {
    return `(${state.unit})`;
}

// Compute dynamic slope angle with horizontal in degrees at support i
function getSupportAngles(i) {
    const angles = { left: null, right: null };
    const ySi = state.controlPoints.supports[i];
    
    // Left side angle (coming from span i - 1)
    if (i > 0) {
        const spanIdx = i - 1;
        const L = state.spanLengths[spanIdx];
        const lp = state.controlPoints.lowPoints[spanIdx];
        const xm = lp.xFract * L;
        const ym = lp.y;
        
        const X2 = L - xm;
        const Y2 = Math.abs(ySi - ym);
        
        const slope = (2 * Y2) / (1000 * X2);
        angles.left = Math.atan(slope) * (180 / Math.PI);
    }
    
    // Right side angle (going to span i)
    if (i < state.numSpans) {
        const spanIdx = i;
        const L = state.spanLengths[spanIdx];
        const lp = state.controlPoints.lowPoints[spanIdx];
        const xm = lp.xFract * L;
        const ym = lp.y;
        
        const X1 = xm;
        const Y1 = Math.abs(ySi - ym);
        
        const slope = (2 * Y1) / (1000 * X1);
        angles.right = Math.atan(slope) * (180 / Math.PI);
    }
    
    return angles;
}

// Format support angles for the sidebar display
function formatSupportAngleText(angles) {
    if (angles.left !== null && angles.right !== null) {
        return `${angles.left.toFixed(1)}° | ${angles.right.toFixed(1)}°`;
    } else if (angles.left !== null) {
        return `${angles.left.toFixed(1)}°`;
    } else if (angles.right !== null) {
        return `${angles.right.toFixed(1)}°`;
    }
    return '';
}

// Format support angles for the SVG visualizer display
function formatSvgSupportAngleText(angles) {
    if (angles.left !== null && angles.right !== null) {
        return `∠${angles.left.toFixed(1)}°|${angles.right.toFixed(1)}°`;
    } else if (angles.left !== null) {
        return `∠${angles.left.toFixed(1)}°`;
    } else if (angles.right !== null) {
        return `∠${angles.right.toFixed(1)}°`;
    }
    return '';
}

// Update DOM input elements min/max/step and labels based on unit
function updateInputUnitBounds() {
    const isCm = state.unit === 'cm';
    
    // Slab Thickness bounds
    DOM.slabThickness.min = isCm ? 10 : 100;
    DOM.slabThickness.max = isCm ? 60 : 600;
    DOM.slabThickness.step = isCm ? 1 : 10;
    
    // Cover Top bounds
    DOM.coverTop.min = isCm ? 1.5 : 15;
    DOM.coverTop.max = isCm ? 10 : 100;
    DOM.coverTop.step = isCm ? 0.5 : 5;
    
    // Cover Bottom bounds
    DOM.coverBottom.min = isCm ? 1.5 : 15;
    DOM.coverBottom.max = isCm ? 10 : 100;
    DOM.coverBottom.step = isCm ? 0.5 : 5;
    
    // Anchor Set bounds
    DOM.anchorSet.min = 0;
    DOM.anchorSet.max = isCm ? 1.5 : 15;
    DOM.anchorSet.step = isCm ? 0.1 : 1;

    // Duct Diameter bounds
    if (DOM.ductDiameter) {
        DOM.ductDiameter.min = isCm ? 1.0 : 10.0;
        DOM.ductDiameter.max = isCm ? 15.0 : 150.0;
        DOM.ductDiameter.step = isCm ? 0.1 : 1.0;
    }
    
    // Update labels in HTML
    document.querySelectorAll('.unit-label-thickness').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-cover').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-anchorset').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-y').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-duct').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
}

// Helper to get row name and default Y coordinate based on rowIdx and numRows
function getRowInfo(rowIdx, numRows, W) {
    if (numRows === 1) {
        return { name: 'C', y: W / 2 };
    } else if (numRows === 2) {
        if (rowIdx === 0) return { name: 'CL', y: W * 0.15 };
        return { name: 'CR', y: W * 0.85 };
    } else if (numRows === 3) {
        if (rowIdx === 0) return { name: 'CL', y: W * 0.15 };
        if (rowIdx === 1) return { name: 'CM', y: W * 0.5 };
        return { name: 'CR', y: W * 0.85 };
    } else { // 4 rows
        if (rowIdx === 0) return { name: 'CL', y: W * 0.1 };
        if (rowIdx === 1) return { name: 'CML', y: W * 0.35 };
        if (rowIdx === 2) return { name: 'CMR', y: W * 0.65 };
        return { name: 'CR', y: W * 0.9 };
    }
}

// Helper to get column prefix based on support index and total number of supports
function getColumnPrefix(suppIdx, numSupports) {
    if (numSupports === 1) {
        return 'C';
    } else if (numSupports === 2) {
        if (suppIdx === 0) return 'CL';
        return 'CR';
    } else if (numSupports === 3) {
        if (suppIdx === 0) return 'CL';
        if (suppIdx === 1) return 'CM';
        return 'CR';
    } else { // 4 or more
        if (suppIdx === 0) return 'CL';
        if (suppIdx === 1) return 'CML';
        if (suppIdx === 2) return 'CMR';
        return 'CR';
    }
}

// Helper to get the X coordinate of a column by support and row indices
function getColumnX(supportIdx, rowIdx) {
    const col = state.planColumns.find(c => c.id === `col-${supportIdx}-row${rowIdx}`);
    return col ? col.x : 0;
}

// Rebuild columns and control point states when row count or spans count changes
function rebuildColumnLayout() {
    const W = state.slabWidth;
    const numRows = state.numColRows;
    const oldColumns = [...state.planColumns];
    state.planColumns = [];
    
    // Save old control points if any
    const oldCpRows = state.controlPointsRows ? [...state.controlPointsRows] : [];
    state.controlPointsRows = [];
    
    const h = state.slabThickness;
    const coverT = state.coverTop;
    const coverB = state.coverBottom;
    
    // Default curve template
    const createDefaultCp = () => {
        const supports = [h - 30];
        for (let i = 1; i <= state.numSpans; i++) {
            supports.push(h - 25);
        }
        const lowPoints = [{ xFract: 0.4, y: 25 }];
        if (state.numSpans >= 2) lowPoints.push({ xFract: 0.6, y: 30 });
        if (state.numSpans >= 3) lowPoints.push({ xFract: 0.5, y: 25 });
        
        return {
            supports: supports,
            supportsLocked: new Array(state.numSpans + 1).fill(false),
            lowPoints: lowPoints,
            lowPointsLocked: new Array(state.numSpans).fill(false)
        };
    };
    
    for (let r = 0; r < numRows; r++) {
        const info = getRowInfo(r, numRows, W);
        
        // Setup control points for "Above Row [r+1]" (section index 2*r)
        const idxAbove = 2 * r;
        if (oldCpRows[idxAbove]) {
            state.controlPointsRows.push(oldCpRows[idxAbove]);
        } else {
            state.controlPointsRows.push(createDefaultCp());
        }
        
        // Setup control points for "Below Row [r+1]" (section index 2*r+1)
        const idxBelow = 2 * r + 1;
        if (oldCpRows[idxBelow]) {
            state.controlPointsRows.push(oldCpRows[idxBelow]);
        } else {
            state.controlPointsRows.push(createDefaultCp());
        }
        
        // Setup columns for this row across all supports
        let currentX = 0;
        for (let i = 0; i <= state.numSpans; i++) {
            const colId = `col-${i}-row${r}`;
            const oldCol = oldColumns.find(c => c.id === colId);
            
            if (oldCol) {
                state.planColumns.push(oldCol);
            } else {
                state.planColumns.push({
                    id: colId,
                    x: currentX,
                    y: info.y,
                    enabled: true,
                    lockX: i === 0, // lock support 0 X by default
                    lockY: false
                });
            }
            if (i < state.numSpans) {
                currentX += state.spanLengths[i] || 8.0;
            }
        }
    }
    
    const maxSections = 2 * numRows;
    if (state.selectedRowIdx === undefined || state.selectedRowIdx >= maxSections) {
        state.selectedRowIdx = 0;
    }
    state.controlPoints = state.controlPointsRows[state.selectedRowIdx];
}

// Compute tendon profile for any specific row
function getTendonProfileForRow(xGlobal, sectionIdx) {
    const colRowIdx = Math.floor(sectionIdx / 2);
    
    const rowSpanLengths = [];
    let cumulativeX = 0;
    for (let i = 1; i <= state.numSpans; i++) {
        const xVal = getColumnX(i, colRowIdx);
        const prevX = getColumnX(i - 1, colRowIdx);
        rowSpanLengths.push(Math.max(3.0, xVal - prevX));
    }
    
    let accumX = 0;
    let spanIndex = -1;
    let localX = 0;
    for (let i = 0; i < state.numSpans; i++) {
        const len = rowSpanLengths[i];
        if (xGlobal >= accumX && xGlobal <= accumX + len + 0.0001) {
            spanIndex = i;
            localX = xGlobal - accumX;
            break;
        }
        accumX += len;
    }
    
    if (spanIndex === -1) {
        spanIndex = state.numSpans - 1;
        localX = rowSpanLengths[spanIndex];
    }
    
    const L = rowSpanLengths[spanIndex];
    const cp = state.controlPointsRows[sectionIdx];
    const yL = cp.supports[spanIndex];
    const yR = cp.supports[spanIndex + 1];
    const lp = cp.lowPoints[spanIndex];
    const xm = lp.xFract * L;
    const ym = lp.y;
    const aRatio = state.inflectionRatio;
    
    let y = 0;
    let dy = 0;
    let ddy = 0;
    
    if (localX <= xm) {
        const X1 = xm;
        const Y1 = yL - ym;
        const b1 = Math.max(0.05, Math.min(0.95, (aRatio * L) / X1));
        const xInf = b1 * X1;
        const a1_low = Y1 / ((1 - b1) * X1 * X1);
        const a1_supp = Y1 / (b1 * X1 * X1);
        
        if (localX >= xInf) {
            const dx = xm - localX;
            y = ym + a1_low * dx * dx;
            dy = -2 * a1_low * dx;
            ddy = 2 * a1_low;
        } else {
            const dx = localX;
            y = yL - a1_supp * dx * dx;
            dy = -2 * a1_supp * dx;
            ddy = -2 * a1_supp;
        }
    } else {
        const X2 = L - xm;
        const Y2 = yR - ym;
        const b2 = Math.max(0.05, Math.min(0.95, (aRatio * L) / X2));
        const xInf = L - b2 * X2;
        const a2_low = Y2 / ((1 - b2) * X2 * X2);
        const a2_supp = Y2 / (b2 * X2 * X2);
        
        if (localX <= xInf) {
            const dx = localX - xm;
            y = ym + a2_low * dx * dx;
            dy = 2 * a2_low * dx;
            ddy = 2 * a2_low;
        } else {
            const dx = L - localX;
            y = yR - a2_supp * dx * dx;
            dy = 2 * a2_supp * dx;
            ddy = -2 * a2_supp;
        }
    }
    
    return {
        y: y,
        dy: dy / 1000,
        ddy: ddy / 1000,
        spanIndex: spanIndex,
        localX: localX
    };
}

// Reset Design to default values based on current geometry
function resetDesign() {
    state.unit = 'cm';
    if (DOM.unitSelect) DOM.unitSelect.value = 'cm';
    updateInputUnitBounds();

    const h = state.slabThickness;

    // Reset 2D Plan Layout State
    state.planXTendons = [1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5];
    state.planYTendons = [
        [1.5, 2.0, 6.0, 6.5],
        [1.5, 2.0, 7.0, 7.5, 8.0, 8.5],
        [1.5, 2.0, 6.0, 6.5]
    ].slice(0, state.numSpans);

    state.numColRows = DOM.numColRowsPlan ? parseInt(DOM.numColRowsPlan.value) : 3;
    state.selectedRowIdx = 0;
    rebuildColumnLayout();

    // Initialize support angle limits and perpendicular tendon sets
    state.minSupportAngle = 2.0;
    state.maxSupportAngle = 6.0;
    state.ductDiameter = 25; // Reset duct diameter to default (25mm)
    
    const defaultHeight = h - state.coverTop - 15; // sit just below top cover limit
    const defaultSpacing = state.tendonSpacingY > 0 ? state.tendonSpacingY : 1.5; // match global Y spacing
    state.elevationTendonSets = [
        { supportIdx: 0, direction: 'right', count: 4, spacing: defaultSpacing, offset: 0.20, height: defaultHeight },
        { supportIdx: 1, direction: 'left', count: 3, spacing: defaultSpacing, offset: 0.20, height: defaultHeight },
        { supportIdx: 1, direction: 'right', count: 4, spacing: defaultSpacing, offset: 0.20, height: defaultHeight },
        { supportIdx: Math.min(2, state.numSpans), direction: 'left', count: 2, spacing: defaultSpacing, offset: 0.20, height: defaultHeight }
    ];
    
    // Sync inputs with state
    syncStateToInputs();
}

// Update column X coordinates to match the state.spanLengths values
function syncColumnsFromSpanLengths() {
    if (!state.planColumns) return;
    for (let r = 0; r < state.numColRows; r++) {
        let currentX = 0;
        for (let i = 0; i <= state.numSpans; i++) {
            const col = state.planColumns.find(c => c.id === `col-${i}-row${r}`);
            if (col) {
                col.x = currentX;
            }
            if (i < state.numSpans) {
                currentX += state.spanLengths[i] || 8.0;
            }
        }
    }
}

// Sync values from UI inputs into State
function syncInputsToState() {
    // Sync Number of Column Rows between 2D Plan Layout and Elevation Heights dropdowns
    if (DOM.numColRowsElev && DOM.numColRowsPlan) {
        if (document.activeElement === DOM.numColRowsPlan) {
            DOM.numColRowsElev.value = DOM.numColRowsPlan.value;
        } else if (document.activeElement === DOM.numColRowsElev) {
            DOM.numColRowsPlan.value = DOM.numColRowsElev.value;
        }
    }

    state.unit = DOM.unitSelect.value;
    state.numSpans = parseInt(DOM.numSpans.value);
    
    // Preserve distance from top for supports when thickness changes
    const oldH = state.slabThickness;
    const newH = toMm(parseFloat(DOM.slabThickness.value));
    const supportDistsFromTop = state.controlPoints.supports.map(y => oldH - y);
    
    state.slabThickness = newH;
    state.slabWidth = parseFloat(DOM.slabWidth.value);
    state.spanYLen = parseFloat(DOM.spanYLen.value);
    state.concreteDensity = parseFloat(DOM.concreteDensity.value);
    
    const s1 = parseFloat(DOM.span1Len.value);
    const s2 = parseFloat(DOM.span2Len.value);
    const s3 = parseFloat(DOM.span3Len.value);
    
    state.spanLengths = [
        isNaN(s1) ? (state.spanLengths[0] || 8.0) : s1,
        isNaN(s2) ? (state.spanLengths[1] || 9.0) : s2,
        isNaN(s3) ? (state.spanLengths[2] || 8.0) : s3
    ].slice(0, state.numSpans);

    syncColumnsFromSpanLengths();

    state.coverTop = toMm(parseFloat(DOM.coverTop.value));
    state.coverBottom = toMm(parseFloat(DOM.coverBottom.value));
    state.inflectionRatio = parseFloat(DOM.inflectionRatio.value);
    DOM.inflectionRatioVal.innerText = state.inflectionRatio.toFixed(2);

    state.tendonForce = parseFloat(DOM.tendonForce.value);
    state.tendonForceY = parseFloat(DOM.tendonForceY.value);
    state.jackingEnd = DOM.jackingEnd.value;
    state.frictionMu = parseFloat(DOM.frictionMu.value);
    state.frictionK = parseFloat(DOM.frictionK.value);
    state.anchorSet = toMm(parseFloat(DOM.anchorSet.value));
    state.tendonSpacingX = parseFloat(DOM.tendonSpacingX.value);
    const prevTendonSpacingY = state.tendonSpacingY;
    state.tendonSpacingY = parseFloat(DOM.tendonSpacingY.value);
    // Sync new Y spacing to all perpendicular tendon sets if value actually changed
    if (!isNaN(state.tendonSpacingY) && state.tendonSpacingY !== prevTendonSpacingY && state.tendonSpacingY > 0) {
        state.elevationTendonSets.forEach(set => {
            set.spacing = state.tendonSpacingY;
        });
    }
    state.verticalExaggeration = parseFloat(DOM.verticalExaggeration.value);

    // Apply preserved support top-distances under new thickness
    state.controlPoints.supports = supportDistsFromTop.map(d => newH - d);

    // Make sure control points array length matches spans count
    while(state.controlPoints.supports.length <= state.numSpans) {
        state.controlPoints.supports.push(state.slabThickness - state.coverTop);
    }
    state.controlPoints.supports = state.controlPoints.supports.slice(0, state.numSpans + 1);

    while(state.controlPoints.supportsLocked.length <= state.numSpans) {
        state.controlPoints.supportsLocked.push(false);
    }
    state.controlPoints.supportsLocked = state.controlPoints.supportsLocked.slice(0, state.numSpans + 1);

    while(state.controlPoints.lowPoints.length < state.numSpans) {
        state.controlPoints.lowPoints.push({ xFract: 0.5, y: state.coverBottom });
    }
    state.controlPoints.lowPoints = state.controlPoints.lowPoints.slice(0, state.numSpans);

    while(state.controlPoints.lowPointsLocked.length < state.numSpans) {
        state.controlPoints.lowPointsLocked.push(false);
    }
    state.controlPoints.lowPointsLocked = state.controlPoints.lowPointsLocked.slice(0, state.numSpans);

    // Validate control points bounds with cover changes
    clampControlPoints();

    // Sync/re-initialize columns if geometry changes
    if (DOM.numColRowsPlan) {
        const val = parseInt(DOM.numColRowsPlan.value);
        if (state.numColRows !== val) {
            state.numColRows = val;
            rebuildColumnLayout();
        }
    }

    const w = state.slabWidth;
    const expectedColCount = (state.numSpans + 1) * state.numColRows;
    if (state.planColumns.length !== expectedColCount) {
        rebuildColumnLayout();
    } else {
        const suffix = `row${Math.floor(state.selectedRowIdx / 2)}`;
        state.planColumns.forEach(col => {
            const suppIdx = parseInt(col.id.split('-')[1]);
            const rowIdx = parseInt(col.id.split('-')[2].replace('row', ''));
            const info = getRowInfo(rowIdx, state.numColRows, w);
            
            // Sync X coordinate for active section row from state.spanLengths
            if (col.id.endsWith(`-${suffix}`)) {
                let currentX = 0;
                for (let j = 0; j < suppIdx; j++) {
                    currentX += state.spanLengths[j];
                }
                col.x = currentX;
            }
            
            // Sync Y coordinate to standard row position if not locked
            if (!col.lockY) {
                col.y = info.y;
            }
            
            if (col.enabled === undefined) col.enabled = true;
            if (col.lockX === undefined) col.lockX = col.id.includes('col-0');
            if (col.lockY === undefined) col.lockY = false;
        });
    }

    while (state.planYTendons.length < state.numSpans) {
        state.planYTendons.push([1.5, 2.0, 6.0, 6.5]);
    }
    state.planYTendons = state.planYTendons.slice(0, state.numSpans);

    if (DOM.minSupportAngle) state.minSupportAngle = parseFloat(DOM.minSupportAngle.value) || 2.0;
    if (DOM.maxSupportAngle) state.maxSupportAngle = parseFloat(DOM.maxSupportAngle.value) || 6.0;

    if (DOM.numTendonSets) {
        const count = Math.max(0, parseInt(DOM.numTendonSets.value) || 0);
        const defaultHeight = state.slabThickness - state.coverTop - 15;
        while (state.elevationTendonSets.length < count) {
            state.elevationTendonSets.push({
                supportIdx: 0,
                direction: 'right',
                count: 4,
                spacing: state.tendonSpacingY > 0 ? state.tendonSpacingY : 1.5,
                offset: 0.20,
                height: defaultHeight
            });
        }
        state.elevationTendonSets = state.elevationTendonSets.slice(0, count);
    }

    if (DOM.ductDiameter) state.ductDiameter = toMm(parseFloat(DOM.ductDiameter.value)) || 25;

    // Clamp perpendicular tendon heights to slab thickness
    if (state.elevationTendonSets) {
        state.elevationTendonSets.forEach(set => {
            set.height = Math.max(0, Math.min(state.slabThickness, set.height));
        });
    }

    // Recalculate plan view X-tendon positions based on mode/width/spacing
    updatePlanXTendons();
}

// Clamp control points heights to be within allowable cover envelopes
function clampControlPoints() {
    const h = state.slabThickness;
    const coverT = state.coverTop;
    const coverB = state.coverBottom;

    state.controlPoints.supports = state.controlPoints.supports.map((y, idx) => {
        if (idx === 0 || idx === state.numSpans) {
            // End anchors can span the full cover envelope
            return Math.max(coverB, Math.min(h - coverT, y));
        } else {
            // Interior supports (high points) must stay in the top half
            return Math.max(h / 2, Math.min(h - coverT, y));
        }
    });

    state.controlPoints.lowPoints.forEach(pt => {
        // Low points (between supports) must stay in the bottom half
        pt.y = Math.max(coverB, Math.min(h / 2, pt.y));
        pt.xFract = Math.max(0.2, Math.min(0.8, pt.xFract));
    });
}

// Sync GUI elements values to match internal state variables
function syncStateToInputs() {
    if (DOM.unitSelect && document.activeElement !== DOM.unitSelect) DOM.unitSelect.value = state.unit;
    if (DOM.numSpans && document.activeElement !== DOM.numSpans) DOM.numSpans.value = state.numSpans;
    if (DOM.numColRowsPlan && document.activeElement !== DOM.numColRowsPlan) DOM.numColRowsPlan.value = state.numColRows;
    if (DOM.numColRowsElev && document.activeElement !== DOM.numColRowsElev) DOM.numColRowsElev.value = state.numColRows;
    if (DOM.slabThickness && document.activeElement !== DOM.slabThickness) DOM.slabThickness.value = fromMm(state.slabThickness);
    if (DOM.slabWidth && document.activeElement !== DOM.slabWidth) DOM.slabWidth.value = state.slabWidth;
    if (DOM.spanYLen && document.activeElement !== DOM.spanYLen) DOM.spanYLen.value = state.spanYLen;
    if (DOM.concreteDensity && document.activeElement !== DOM.concreteDensity) DOM.concreteDensity.value = state.concreteDensity;
    
    if (DOM.span1Len && document.activeElement !== DOM.span1Len) DOM.span1Len.value = state.spanLengths[0] || 8.0;
    if (DOM.span2Len && state.spanLengths[1] && document.activeElement !== DOM.span2Len) DOM.span2Len.value = state.spanLengths[1];
    if (DOM.span3Len && state.spanLengths[2] && document.activeElement !== DOM.span3Len) DOM.span3Len.value = state.spanLengths[2];
    
    if (DOM.coverTop && document.activeElement !== DOM.coverTop) DOM.coverTop.value = fromMm(state.coverTop);
    if (DOM.coverBottom && document.activeElement !== DOM.coverBottom) DOM.coverBottom.value = fromMm(state.coverBottom);
    if (DOM.inflectionRatio && document.activeElement !== DOM.inflectionRatio) DOM.inflectionRatio.value = state.inflectionRatio;
    if (DOM.inflectionRatioVal) DOM.inflectionRatioVal.innerText = state.inflectionRatio.toFixed(2);

    if (DOM.tendonForce && document.activeElement !== DOM.tendonForce) DOM.tendonForce.value = state.tendonForce;
    if (DOM.tendonForceY && document.activeElement !== DOM.tendonForceY) DOM.tendonForceY.value = state.tendonForceY;
    if (DOM.jackingEnd && document.activeElement !== DOM.jackingEnd) DOM.jackingEnd.value = state.jackingEnd;
    if (DOM.frictionMu && document.activeElement !== DOM.frictionMu) DOM.frictionMu.value = state.frictionMu;
    if (DOM.frictionK && document.activeElement !== DOM.frictionK) DOM.frictionK.value = state.frictionK;
    if (DOM.anchorSet && document.activeElement !== DOM.anchorSet) DOM.anchorSet.value = fromMm(state.anchorSet);
    if (DOM.tendonSpacingX && document.activeElement !== DOM.tendonSpacingX) DOM.tendonSpacingX.value = state.tendonSpacingX;
    if (DOM.tendonSpacingY && document.activeElement !== DOM.tendonSpacingY) DOM.tendonSpacingY.value = state.tendonSpacingY;
    if (DOM.verticalExaggeration && document.activeElement !== DOM.verticalExaggeration) DOM.verticalExaggeration.value = state.verticalExaggeration;

    if (DOM.minSupportAngle && document.activeElement !== DOM.minSupportAngle) DOM.minSupportAngle.value = state.minSupportAngle;
    if (DOM.maxSupportAngle && document.activeElement !== DOM.maxSupportAngle) DOM.maxSupportAngle.value = state.maxSupportAngle;
    if (DOM.numTendonSets && document.activeElement !== DOM.numTendonSets) DOM.numTendonSets.value = state.elevationTendonSets.length;
    if (DOM.ductDiameter && document.activeElement !== DOM.ductDiameter) {
        DOM.ductDiameter.value = fromMm(state.ductDiameter).toFixed(state.unit === 'cm' ? 1 : 0);
    }

    // Toggle span length containers depending on count
    DOM.span2Container.style.display = state.numSpans >= 2 ? 'block' : 'none';
    DOM.span3Container.style.display = state.numSpans >= 3 ? 'block' : 'none';

    // Update active tab buttons visual state
    if (DOM.tabElevation) DOM.tabElevation.classList.toggle('active', state.activeTab === 'elevation');
    if (DOM.tabPlan) DOM.tabPlan.classList.toggle('active', state.activeTab === 'plan');
    if (DOM.tabSplit) DOM.tabSplit.classList.toggle('active', state.activeTab === 'split');
    
    // Sync class on the container
    if (DOM.svgContainer) {
        DOM.svgContainer.className = 'visualizer-container ' + (
            state.activeTab === 'split' ? 'split-active' :
            state.activeTab === 'plan' ? 'tab-plan' : 'tab-elevation'
        );
    }

    // Toggle sidebar parameter panels based on active tab
    const elevPanel = document.getElementById('section-elevation-heights');
    const perpPanel = document.getElementById('section-perpendicular-tendons');
    const planPanel = document.getElementById('section-plan-layout');
    
    if (state.activeTab === 'plan') {
        if (elevPanel) elevPanel.style.display = 'none';
        if (perpPanel) perpPanel.style.display = 'none';
        if (planPanel) planPanel.style.display = 'block';
        updateSidebarPlanInputs();
    } else if (state.activeTab === 'split') {
        if (elevPanel) elevPanel.style.display = 'block';
        if (perpPanel) perpPanel.style.display = 'block';
        if (planPanel) planPanel.style.display = 'block';
        updateSidebarTendonSets();
        updateSidebarPlanInputs();
    } else {
        if (elevPanel) elevPanel.style.display = 'block';
        if (perpPanel) perpPanel.style.display = 'block';
        if (planPanel) planPanel.style.display = 'none';
        updateSidebarTendonSets();
    }

    // Sync profile paste button state
    if (DOM.btnPasteProfile) {
        if (!state.clipboardControlPoints) {
            DOM.btnPasteProfile.disabled = true;
            DOM.btnPasteProfile.style.opacity = '0.4';
            DOM.btnPasteProfile.style.cursor = 'not-allowed';
        } else {
            DOM.btnPasteProfile.disabled = false;
            DOM.btnPasteProfile.style.opacity = '1';
            DOM.btnPasteProfile.style.cursor = 'pointer';
        }
    }
}

// Math Engine: Evaluates height, slope, and curvature of the tendon path
function getTendonProfile(xGlobal) {
    return getTendonProfileForRow(xGlobal, state.selectedRowIdx);
}

// Calculate the cumulative angular change alpha(x) along the tendon
function calculateCumulativeAlpha(points) {
    let cumulativeAlpha = 0;
    points[0].alpha = 0;
    
    for (let i = 1; i < points.length; i++) {
        // Change in slope between adjacent segments
        const dSlope = points[i].dy - points[i - 1].dy;
        cumulativeAlpha += Math.abs(dSlope);
        points[i].alpha = cumulativeAlpha;
    }
}

// Master Calculations: Friction, Wedge Slip, and Force Envelope
function calculateFrictionAndLosses() {
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const dx = 0.05; // 50mm increment for high-resolution friction solver
    const numPoints = Math.round(totalLength / dx) + 1;
    
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const xGlobal = Math.min(totalLength, i * dx);
        const profile = getTendonProfile(xGlobal);
        points.push({
            xGlobal: xGlobal,
            xLocal: profile.localX,
            spanIndex: profile.spanIndex,
            y: profile.y,
            dy: profile.dy,
            ddy: profile.ddy,
            force: 0,
            alpha: 0
        });
    }
    
    // 1. Calculate cumulative angular changes
    calculateCumulativeAlpha(points);
    const totalAlpha = points[points.length - 1].alpha;
    
    // 2. Solve forward jacking force profile (from Left End)
    const P0 = state.tendonForce;
    const mu = state.frictionMu;
    const k = state.frictionK;
    
    points.forEach(pt => {
        pt.forceLeft = P0 * Math.exp(-(mu * pt.alpha + k * pt.xGlobal));
    });
    
    // 3. Solve backward jacking force profile (from Right End)
    points.forEach(pt => {
        const alphaRight = totalAlpha - pt.alpha;
        const distRight = totalLength - pt.xGlobal;
        pt.forceRight = P0 * Math.exp(-(mu * alphaRight + k * distRight));
    });
    
    // 4. Combine based on jacking configuration
    if (state.jackingEnd === 'left') {
        points.forEach(pt => pt.force = pt.forceLeft);
    } else if (state.jackingEnd === 'right') {
        points.forEach(pt => pt.force = pt.forceRight);
    } else {
        // Jacking from both ends
        points.forEach(pt => pt.force = Math.max(pt.forceLeft, pt.forceRight));
    }
    
    // 5. Calculate Anchor Set (Wedge Slip) Loss if anchorSet > 0
    if (state.anchorSet > 0) {
        // Prestressing steel area & modulus estimates
        // E * Aps ~ 140 * P_jack (standard high-tensile 7-wire strand approximation)
        const EAps = 140 * P0; 
        const slipDistanceM = state.anchorSet / 1000; // mm to meters
        const targetArea = (EAps * slipDistanceM) / 2; // Target area of the loss triangle (kN * m)

        // Apply anchor set at Left end if jacked from Left or Both
        if (state.jackingEnd === 'left' || state.jackingEnd === 'both') {
            applyWedgeSlip(points, targetArea, true);
        }
        
        // Apply anchor set at Right end if jacked from Right or Both
        if (state.jackingEnd === 'right' || state.jackingEnd === 'both') {
            applyWedgeSlip(points, targetArea, false);
        }
    }
    
    state.sampledPoints = points;
}

// Numerical integration of wedge slip area and adjustment of force profile
function applyWedgeSlip(points, targetArea, isLeftAnchor) {
    const N = points.length;
    let cumulativeArea = 0;
    let slipLimitIndex = 0;
    
    // Traverse along the tendon to find where wedge slip loss area balances elastic slip
    if (isLeftAnchor) {
        for (let i = 1; i < N; i++) {
            const dx = points[i].xGlobal - points[i - 1].xGlobal;
            // The height of the difference triangle between jacking force P(x) and reversed force P_rev(x)
            // difference at index j is 2 * (P_slip_limit - P(j))
            const diffPrev = 2 * (points[i - 1].force - points[i - 1].force); // at slip limit, difference is 0
            // Integrate the difference between the envelope and the slipped force line
            // We search for a boundary 'limit' such that the integral of 2 * (P(x) - P(limit)) from 0 to limit equals targetArea
            let areaSum = 0;
            for (let j = 0; j < i; j++) {
                const stepDx = points[j + 1].xGlobal - points[j].xGlobal;
                const forceDiffStart = 2 * (points[j].force - points[i].force);
                const forceDiffEnd = 2 * (points[j + 1].force - points[i].force);
                areaSum += 0.5 * (forceDiffStart + forceDiffEnd) * stepDx;
            }
            
            if (areaSum >= targetArea) {
                slipLimitIndex = i;
                cumulativeArea = areaSum;
                break;
            }
        }
        
        // Reflect the force diagram inside the wedge slip influence zone
        if (slipLimitIndex > 0) {
            const P_limit = points[slipLimitIndex].force;
            for (let i = 0; i <= slipLimitIndex; i++) {
                points[i].force = 2 * P_limit - points[i].force;
            }
        }
    } else {
        // Apply at the right anchor (traverse backward from N-1)
        for (let i = N - 2; i >= 0; i--) {
            let areaSum = 0;
            for (let j = N - 1; j > i; j--) {
                const stepDx = points[j].xGlobal - points[j - 1].xGlobal;
                const forceDiffStart = 2 * (points[j].force - points[i].force);
                const forceDiffEnd = 2 * (points[j - 1].force - points[i].force);
                areaSum += 0.5 * (forceDiffStart + forceDiffEnd) * stepDx;
            }
            
            if (areaSum >= targetArea) {
                slipLimitIndex = i;
                cumulativeArea = areaSum;
                break;
            }
        }
        
        // Reflect force diagram
        if (slipLimitIndex < N - 1) {
            const P_limit = points[slipLimitIndex].force;
            for (let i = N - 1; i >= slipLimitIndex; i--) {
                points[i].force = 2 * P_limit - points[i].force;
            }
        }
    }
}

// Render the Interactive SVG Visualizer
function renderVisualizer() {
    if (DOM.profileSvg) DOM.profileSvg.innerHTML = '';
    if (DOM.planSvg) DOM.planSvg.innerHTML = '';
    
    const svg = DOM.profileSvg;

    // Toggle legend and render based on active view tab
    if (state.activeTab === 'plan') {
        DOM.visualizerLegend.innerHTML = `
            <span class="legend-item"><span class="legend-dot c-slab"></span>Slab Edge</span>
            <span class="legend-item"><span class="legend-dot c-tendon"></span>X Tendons (${state.tendonSpacingX.toFixed(1)}m spacing)</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: #10b981;"></span>Y Tendons (${state.tendonSpacingY.toFixed(1)}m spacing)</span>
            <span class="legend-item"><span class="legend-dot c-handles" style="background-color: #1e293b; border: 1px solid #475569;"></span>Columns</span>
        `;
        renderPlanVisualizer(DOM.planSvg);
        return;
    }

    if (state.activeTab === 'split') {
        DOM.visualizerLegend.innerHTML = `
            <span class="legend-item"><span class="legend-dot c-slab"></span>Slab</span>
            <span class="legend-item"><span class="legend-dot c-tendon"></span>Long. Tendon</span>
            <span class="legend-item"><span class="legend-dot c-limits"></span>Cover Limits</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: #10b981;"></span>Y Tendons</span>
            <span class="legend-item"><span class="legend-dot c-handles"></span>Drag Handles</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: transparent; border: 1px dashed #64748b; border-radius: 0; width: 12px; height: 2px;"></span>Neutral Axis (N.A.)</span>
        `;
        renderPlanVisualizer(DOM.planSvg);
    } else {
        DOM.visualizerLegend.innerHTML = `
            <span class="legend-item"><span class="legend-dot c-slab"></span>Slab</span>
            <span class="legend-item"><span class="legend-dot c-tendon"></span>Tendon</span>
            <span class="legend-item"><span class="legend-dot c-limits"></span>Cover Limits</span>
            <span class="legend-item"><span class="legend-dot c-handles"></span>Drag Handles</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: transparent; border: 1px dashed #64748b; border-radius: 0; width: 12px; height: 2px;"></span>Neutral Axis (N.A.)</span>
        `;
    }
    
    // 1. Dimensions and scaling
    const svgWidth = 1000;
    const svgHeight = 350;
    const margin = { top: 40, right: 40, bottom: 60, left: 50 };
    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;
    
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const hSlab = state.slabThickness;
    const veg = state.verticalExaggeration;
    
    // Scale functions
    const scaleX = (x) => margin.left + (x / totalLength) * chartW;
    // Map mm height to SVG y coordinate (slab top is y=0 in physics, bottom is y=hSlab)
    // Let's place the slab center in the vertical middle of the chart area
    const chartCenterY = margin.top + chartH / 2;
    const scaleY = (yMm) => {
        const dyMm = yMm - hSlab / 2; // relative to mid-depth of slab
        return chartCenterY - (dyMm / 1000) * veg * chartW * (totalLength ? (chartH / (hSlab / 1000 * veg * chartW)) : 1); // scalable Y mapping
    };
    
    // Simpler concrete y scaling:
    // Let the slab fill about 50% of the visualizer height, centered
    const slabHeightPixels = (hSlab / 200) * 80 * (veg / 5); // scaled height
    const slabTopY = chartCenterY - slabHeightPixels / 2;
    const slabBottomY = chartCenterY + slabHeightPixels / 2;
    
    // Map local physics y (0 at bottom of slab, hSlab at top of slab) to SVG Y coordinate
    const mapYToSvg = (yMm) => {
        const fract = yMm / hSlab; // 0 (bottom) to 1 (top)
        return slabBottomY - fract * slabHeightPixels;
    };
    
    // Map SVG Y coordinate back to mm from bottom of slab
    const mapSvgToY = (svgY) => {
        const fract = (slabBottomY - svgY) / slabHeightPixels;
        return fract * hSlab;
    };

    // Store coordinate mappings in state for drag handlers
    state.svgCoords = {
        scaleX, mapYToSvg, mapSvgToY, slabTopY, slabBottomY, slabHeightPixels, chartW, chartH, margin
    };

    // 2. Render Grid / Background lines
    const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridG.setAttribute('class', 'svg-grid');
    
    // Span boundaries and dimensions
    let currentX = 0;
    state.spanLengths.forEach((len, idx) => {
        const x1 = scaleX(currentX);
        const x2 = scaleX(currentX + len);
        
        // Vertical grid boundary
        if (idx > 0) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', margin.top - 10);
            line.setAttribute('x2', x1);
            line.setAttribute('y2', svgHeight - margin.bottom + 10);
            line.setAttribute('stroke', '#1e293b');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', '3,3');
            gridG.appendChild(line);
        }

        // Span dimension text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (x1 + x2) / 2);
        text.setAttribute('y', svgHeight - 15);
        text.setAttribute('class', 'svg-dimension-text');
        text.textContent = `Span ${idx + 1}: ${len.toFixed(1)}m`;
        gridG.appendChild(text);

        // Dimension lines
        const dimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        dimLine.setAttribute('x1', x1 + 5);
        dimLine.setAttribute('y1', svgHeight - 25);
        dimLine.setAttribute('x2', x2 - 5);
        dimLine.setAttribute('y2', svgHeight - 25);
        dimLine.setAttribute('class', 'svg-dimension-line');
        gridG.appendChild(dimLine);
        
        currentX += len;
    });
    
    // Draw horizontal axis labels
    const horizAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    horizAxis.setAttribute('x1', scaleX(0));
    horizAxis.setAttribute('y1', svgHeight - margin.bottom);
    horizAxis.setAttribute('x2', scaleX(totalLength));
    horizAxis.setAttribute('y2', svgHeight - margin.bottom);
    horizAxis.setAttribute('stroke', '#334155');
    horizAxis.setAttribute('stroke-width', '1');
    gridG.appendChild(horizAxis);
    
    // Axis ticks and numbers (0 to TotalLength in meters)
    const step = totalLength > 15 ? 2.0 : 1.0;
    for (let xVal = 0; xVal <= totalLength; xVal += step) {
        const sx = scaleX(xVal);
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', sx);
        tick.setAttribute('y1', svgHeight - margin.bottom);
        tick.setAttribute('x2', sx);
        tick.setAttribute('y2', svgHeight - margin.bottom + 5);
        tick.setAttribute('stroke', '#334155');
        gridG.appendChild(tick);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', sx);
        label.setAttribute('y', svgHeight - margin.bottom + 18);
        label.setAttribute('class', 'svg-axis-label');
        label.setAttribute('text-anchor', 'middle');
        label.textContent = `${xVal.toFixed(0)}m`;
        gridG.appendChild(label);
    }
    
    svg.appendChild(gridG);

    // 3. Render Concrete slab outline
    const slabPath = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    slabPath.setAttribute('x', scaleX(0));
    slabPath.setAttribute('y', slabTopY);
    slabPath.setAttribute('width', scaleX(totalLength) - scaleX(0));
    slabPath.setAttribute('height', slabHeightPixels);
    slabPath.setAttribute('class', 'svg-slab-concrete');
    svg.appendChild(slabPath);
    
    // Render support columns supporting the slab from below (no top columns)
    for (let i = 0; i <= state.numSpans; i++) {
        // Draw columns for all rows
        for (let r = 0; r < state.numColRows; r++) {
            const col = state.planColumns.find(c => c.id === `col-${i}-row${r}`);
            if (!col || !col.enabled) continue;
            
            const sx = scaleX(col.x);
            const isSelectedRow = r === Math.floor(state.selectedRowIdx / 2);
            
            const botCol = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            botCol.setAttribute('x', sx - 12);
            botCol.setAttribute('y', slabBottomY);
            botCol.setAttribute('width', '24');
            botCol.setAttribute('height', '40');
            
            if (isSelectedRow) {
                botCol.setAttribute('class', 'svg-support-column active-section-col');
                botCol.setAttribute('opacity', '1.0');
            } else {
                botCol.setAttribute('class', 'svg-support-column');
                botCol.setAttribute('opacity', '0.2');
            }
            svg.appendChild(botCol);
            
            // Show the column number underneath the active columns
            if (isSelectedRow) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', sx);
                label.setAttribute('y', slabBottomY + 52);
                label.setAttribute('fill', '#38bdf8'); // active section color
                label.setAttribute('font-size', '10px');
                label.setAttribute('font-family', 'Space Grotesk, sans-serif');
                label.setAttribute('font-weight', '600');
                label.setAttribute('text-anchor', 'middle');
                
                const prefix = getColumnPrefix(i, state.numSpans + 1);
                label.textContent = `${prefix}${r + 1}`;
                svg.appendChild(label);
            }
        }
        
        // Draw virtual dashed support line if the column of the active section is disabled
        const activeRowIdx = Math.floor(state.selectedRowIdx / 2);
        const activeCol = state.planColumns.find(c => c.id === `col-${i}-row${activeRowIdx}`);
        if (!activeCol || !activeCol.enabled) {
            const sx = scaleX(activeCol ? activeCol.x : 0);
            const refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            refLine.setAttribute('x1', sx);
            refLine.setAttribute('y1', slabTopY - 20);
            refLine.setAttribute('x2', sx);
            refLine.setAttribute('y2', slabBottomY + 20);
            refLine.setAttribute('stroke', '#475569');
            refLine.setAttribute('stroke-width', '1.5');
            refLine.setAttribute('stroke-dasharray', '2,2');
            svg.appendChild(refLine);
        }
    }

    // 3.5. Render Neutral Axis (N.A. line at mid-depth of slab)
    const naY = mapYToSvg(hSlab / 2);
    const naLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    naLine.setAttribute('x1', scaleX(0));
    naLine.setAttribute('y1', naY);
    naLine.setAttribute('x2', scaleX(totalLength));
    naLine.setAttribute('y2', naY);
    naLine.setAttribute('stroke', '#64748b'); // slate gray
    naLine.setAttribute('stroke-width', '1.2');
    naLine.setAttribute('stroke-dasharray', '5,5');
    naLine.setAttribute('opacity', '0.6');
    svg.appendChild(naLine);

    // 4. Render Cover limits (Dashed warning zones)
    const coverLimitsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const limitTopY = mapYToSvg(hSlab - state.coverTop);
    const limitBottomY = mapYToSvg(state.coverBottom);
    
    const topLimit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    topLimit.setAttribute('x1', scaleX(0));
    topLimit.setAttribute('y1', limitTopY);
    topLimit.setAttribute('x2', scaleX(totalLength));
    topLimit.setAttribute('y2', limitTopY);
    topLimit.setAttribute('class', 'svg-slab-limit-line');
    coverLimitsG.appendChild(topLimit);
    
    const bottomLimit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bottomLimit.setAttribute('x1', scaleX(0));
    bottomLimit.setAttribute('y1', limitBottomY);
    bottomLimit.setAttribute('x2', scaleX(totalLength));
    bottomLimit.setAttribute('y2', limitBottomY);
    bottomLimit.setAttribute('class', 'svg-slab-limit-line');
    coverLimitsG.appendChild(bottomLimit);
    
    svg.appendChild(coverLimitsG);

    // 4.5 Dimension annotations (slab thickness h, coverTop, coverBottom) on right side
    {
        const dimX = scaleX(totalLength) + 8;
        const svgEl = (tag) => document.createElementNS('http://www.w3.org/2000/svg', tag);
        const mkLine = (x1, y1, x2, y2, color) => {
            const l = svgEl('line');
            l.setAttribute('x1', x1); l.setAttribute('y1', y1);
            l.setAttribute('x2', x2); l.setAttribute('y2', y2);
            l.setAttribute('stroke', color || 'rgba(255,255,255,0.22)');
            l.setAttribute('stroke-width', '1');
            return l;
        };
        const mkTxt = (x, y, txt, color) => {
            const t = svgEl('text');
            t.setAttribute('x', x); t.setAttribute('y', y);
            t.setAttribute('fill', color || 'rgba(255,255,255,0.5)');
            t.setAttribute('font-size', '8px');
            t.setAttribute('font-family', 'JetBrains Mono, monospace');
            t.setAttribute('text-anchor', 'start');
            t.textContent = txt;
            return t;
        };
        const dimG = svgEl('g');
        dimG.setAttribute('class', 'svg-dim-annotations');

        // Slab thickness: slabTopY -> slabBottomY
        const hVal = fromMm(hSlab).toFixed(state.unit === 'cm' ? 0 : 0);
        dimG.appendChild(mkLine(dimX, slabTopY, dimX + 20, slabTopY));
        dimG.appendChild(mkLine(dimX, slabBottomY, dimX + 20, slabBottomY));
        dimG.appendChild(mkLine(dimX + 10, slabTopY, dimX + 10, slabBottomY));
        dimG.appendChild(mkTxt(dimX + 13, (slabTopY + slabBottomY) / 2 + 3, `h=${hVal}${state.unit}`, '#94a3b8'));

        // Top cover: slabTopY -> limitTopY
        const ctVal = fromMm(state.coverTop).toFixed(state.unit === 'cm' ? 1 : 0);
        dimG.appendChild(mkLine(dimX + 26, slabTopY, dimX + 46, slabTopY));
        dimG.appendChild(mkLine(dimX + 26, limitTopY, dimX + 46, limitTopY));
        dimG.appendChild(mkLine(dimX + 36, slabTopY, dimX + 36, limitTopY));
        dimG.appendChild(mkTxt(dimX + 39, (slabTopY + limitTopY) / 2 + 3, `c=${ctVal}`, '#f87171'));

        // Bottom cover: limitBottomY -> slabBottomY
        const cbVal = fromMm(state.coverBottom).toFixed(state.unit === 'cm' ? 1 : 0);
        dimG.appendChild(mkLine(dimX + 26, limitBottomY, dimX + 46, limitBottomY));
        dimG.appendChild(mkLine(dimX + 26, slabBottomY, dimX + 46, slabBottomY));
        dimG.appendChild(mkLine(dimX + 36, limitBottomY, dimX + 36, slabBottomY));
        dimG.appendChild(mkTxt(dimX + 39, (limitBottomY + slabBottomY) / 2 + 3, `c=${cbVal}`, '#f87171'));

        svg.appendChild(dimG);
    }


    // Render other sections' tendon profiles in the background as faint dashed lines
    for (let s = 0; s < 2 * state.numColRows; s++) {
        if (s === state.selectedRowIdx) continue;
        
        const r = Math.floor(s / 2);
        // Calculate cumulative length for row r
        let rowLength = 0;
        for (let i = 0; i < state.numSpans; i++) {
            const col = state.planColumns.find(c => c.id === `col-${i+1}-row${r}`);
            const prevCol = state.planColumns.find(c => c.id === `col-${i}-row${r}`);
            rowLength += Math.max(3.0, (col ? col.x : 0) - (prevCol ? prevCol.x : 0));
        }
        
        let otherPathD = '';
        const dx = 0.05;
        const numPoints = Math.round(rowLength / dx) + 1;
        
        for (let i = 0; i < numPoints; i++) {
            const xGlobal = Math.min(rowLength, i * dx);
            const profile = getTendonProfileForRow(xGlobal, s);
            const sx = scaleX(xGlobal);
            const sy = mapYToSvg(profile.y);
            
            if (i === 0) {
                otherPathD += `M ${sx} ${sy}`;
            } else {
                otherPathD += ` L ${sx} ${sy}`;
            }
        }
        
        const otherTendonPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        otherTendonPath.setAttribute('d', otherPathD);
        otherTendonPath.setAttribute('fill', 'none');
        otherTendonPath.setAttribute('stroke', '#64748b'); // slate gray
        otherTendonPath.setAttribute('stroke-width', '1.5');
        otherTendonPath.setAttribute('stroke-dasharray', '3,3');
        otherTendonPath.setAttribute('opacity', '0.35');
        svg.appendChild(otherTendonPath);
    }

    // 5. Render Tendon Path (Polyline/path from sampled points)
    // Check if any point violates concrete cover envelope
    let coverViolation = false;
    let pathD = '';
    let pathDuctTop = '';
    let pathDuctBottom = '';
    
    state.sampledPoints.forEach((pt, idx) => {
        const sx = scaleX(pt.xGlobal);
        const sy = mapYToSvg(pt.y);
        
        // Calculate duct top and bottom coordinates in mm and map to SVG Y
        const syTop = mapYToSvg(pt.y + state.ductDiameter / 2);
        const syBottom = mapYToSvg(pt.y - state.ductDiameter / 2);
        
        // Highlight cover violations
        if (pt.y > hSlab - state.coverTop + 0.1 || pt.y < state.coverBottom - 0.1) {
            coverViolation = true;
        }
        
        if (idx === 0) {
            pathD += `M ${sx} ${sy}`;
            pathDuctTop += `M ${sx} ${syTop}`;
            pathDuctBottom += `M ${sx} ${syBottom}`;
        } else {
            pathD += ` L ${sx} ${sy}`;
            pathDuctTop += ` L ${sx} ${syTop}`;
            pathDuctBottom += ` L ${sx} ${syBottom}`;
        }
    });
    
    // Draw duct outer diameter envelope dashed lines
    const ductTopPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ductTopPath.setAttribute('d', pathDuctTop);
    ductTopPath.setAttribute('fill', 'none');
    ductTopPath.setAttribute('stroke', coverViolation ? '#ef4444' : '#38bdf8');
    ductTopPath.setAttribute('stroke-width', '1');
    ductTopPath.setAttribute('stroke-dasharray', '2,2');
    ductTopPath.setAttribute('opacity', '0.45');
    svg.appendChild(ductTopPath);

    const ductBottomPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ductBottomPath.setAttribute('d', pathDuctBottom);
    ductBottomPath.setAttribute('fill', 'none');
    ductBottomPath.setAttribute('stroke', coverViolation ? '#ef4444' : '#38bdf8');
    ductBottomPath.setAttribute('stroke-width', '1');
    ductBottomPath.setAttribute('stroke-dasharray', '2,2');
    ductBottomPath.setAttribute('opacity', '0.45');
    svg.appendChild(ductBottomPath);
    
    const tendonPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tendonPath.setAttribute('d', pathD);
    tendonPath.setAttribute('class', coverViolation ? 'svg-tendon-line-warning' : 'svg-tendon-line');
    tendonPath.addEventListener('mousemove', (e) => showTendonTooltip(e));
    tendonPath.addEventListener('mouseout', hideTooltip);
    svg.appendChild(tendonPath);

    // 5.5. Render Perpendicular Tendons (circles representing cross sections)
    const perpG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const activePerpTendons = getActivePerpendicularTendons();
    activePerpTendons.forEach(pt => {
        const cx = scaleX(pt.x);
        const cy = mapYToSvg(pt.y);
        
        // Draw warning ring for clashing tendons
        if (pt.isClash) {
            const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ring.setAttribute('cx', cx);
            ring.setAttribute('cy', cy);
            ring.setAttribute('r', '8');
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', '#ef4444');
            ring.setAttribute('stroke-width', '1');
            ring.setAttribute('stroke-dasharray', '2,2');
            ring.setAttribute('opacity', '0.6');
            perpG.appendChild(ring);
        }
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', pt.isClash ? '#ef4444' : getSetColor(pt.setIdx));
        circle.setAttribute('stroke-width', '2');
        
        // Add a tooltip helper
        circle.addEventListener('mousemove', (e) => {
            const tooltip = DOM.tooltip;
            if (tooltip) {
                tooltip.classList.remove('hidden');
                const svgRect = DOM.profileSvg.getBoundingClientRect();
                tooltip.style.left = `${e.clientX - svgRect.left + 15}px`;
                tooltip.style.top = `${e.clientY - svgRect.top - 15}px`;
                const yVal = fromMm(pt.y);
                const yLongVal = fromMm(pt.yLongitudinal);
                tooltip.innerHTML = `
                    <strong>Perp Tendon (Set ${pt.setIdx + 1}, #${pt.tendonIdx + 1})</strong><br>
                    x: ${pt.x.toFixed(2)}m<br>
                    y (perp): ${state.unit === 'cm' ? yVal.toFixed(1) : Math.round(yVal)} ${getBracketedUnit()}<br>
                    y (long): ${state.unit === 'cm' ? yLongVal.toFixed(1) : Math.round(yLongVal)} ${getBracketedUnit()}<br>
                    Dist: ${pt.yDiff.toFixed(1)}mm ${pt.isClash ? '<span style="color:#ef4444;font-weight:bold;">(CLASH)</span>' : ''}
                `;
            }
        });
        circle.addEventListener('mouseout', hideTooltip);
        
        perpG.appendChild(circle);
    });
    svg.appendChild(perpG);

    // Update cover check visual state
    updateCoverCheckUI(coverViolation);

    // 6. Render Drag Handles (Control points)
    const handlesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Support handles
    let currentSupportX = 0;
    for (let i = 0; i <= state.numSpans; i++) {
        const sx = scaleX(currentSupportX);
        const yMm = state.controlPoints.supports[i];
        const sy = mapYToSvg(yMm);
        
        // Draw vertical dimension line from top of slab to support handle
        const supportDimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        supportDimLine.setAttribute('x1', sx);
        supportDimLine.setAttribute('y1', slabTopY);
        supportDimLine.setAttribute('x2', sx);
        supportDimLine.setAttribute('y2', sy);
        supportDimLine.setAttribute('stroke', '#a7f3d0'); // soft green/mint
        supportDimLine.setAttribute('stroke-width', '1');
        supportDimLine.setAttribute('stroke-dasharray', '2,2');
        handlesG.appendChild(supportDimLine);

        const supportDimText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        supportDimText.setAttribute('x', sx + 8);
        supportDimText.setAttribute('y', (slabTopY + sy) / 2 + 3);
        supportDimText.setAttribute('fill', '#a7f3d0');
        supportDimText.setAttribute('font-size', '9px');
        supportDimText.setAttribute('font-family', 'JetBrains Mono, monospace');
        const suppVal = fromMm(hSlab - yMm);
        supportDimText.textContent = `T:${state.unit === 'cm' ? suppVal.toFixed(1) : Math.round(suppVal)} ${getBracketedUnit()}`;
        handlesG.appendChild(supportDimText);
        
        const supportAngleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        supportAngleText.setAttribute('x', sx - 8);
        supportAngleText.setAttribute('y', sy + 3);
        supportAngleText.setAttribute('fill', '#10b981');
        supportAngleText.setAttribute('font-size', '9px');
        supportAngleText.setAttribute('font-family', 'JetBrains Mono, monospace');
        supportAngleText.setAttribute('text-anchor', 'end');
        supportAngleText.textContent = formatSvgSupportAngleText(getSupportAngles(i));
        handlesG.appendChild(supportAngleText);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', sx);
        circle.setAttribute('cy', sy);
        circle.setAttribute('r', '6');
        
        const isLocked = state.controlPoints.supportsLocked[i];
        const isViolating = yMm > hSlab - state.coverTop + 0.1 || yMm < state.coverBottom - 0.1;
        circle.setAttribute('class', `svg-drag-node ${isViolating ? 'svg-drag-node-warning' : ''} ${isLocked ? 'svg-drag-node-locked' : ''}`);
        
        circle.dataset.type = 'support';
        circle.dataset.index = i;
        
        circle.addEventListener('mousedown', (e) => startDrag(e, circle));
        circle.addEventListener('dblclick', () => resetNode(circle));
        handlesG.appendChild(circle);
        
        if (i < state.numSpans) currentSupportX += state.spanLengths[i];
    }
    
    // Low point handles
    let cumulativeSpanX = 0;
    for (let i = 0; i < state.numSpans; i++) {
        const L = state.spanLengths[i];
        const lp = state.controlPoints.lowPoints[i];
        const sx = scaleX(cumulativeSpanX + lp.xFract * L);
        const yMm = lp.y;
        const sy = mapYToSvg(yMm);
        
        // Draw vertical dimension line from bottom of slab to low point handle
        const lowDimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lowDimLine.setAttribute('x1', sx);
        lowDimLine.setAttribute('y1', slabBottomY);
        lowDimLine.setAttribute('x2', sx);
        lowDimLine.setAttribute('y2', sy);
        lowDimLine.setAttribute('stroke', '#60a5fa'); // light blue
        lowDimLine.setAttribute('stroke-width', '1');
        lowDimLine.setAttribute('stroke-dasharray', '2,2');
        handlesG.appendChild(lowDimLine);

        const lowDimText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lowDimText.setAttribute('x', sx + 8);
        lowDimText.setAttribute('y', (slabBottomY + sy) / 2 + 3);
        lowDimText.setAttribute('fill', '#60a5fa');
        lowDimText.setAttribute('font-size', '9px');
        lowDimText.setAttribute('font-family', 'JetBrains Mono, monospace');
        const lowVal = fromMm(yMm);
        lowDimText.textContent = `B:${state.unit === 'cm' ? lowVal.toFixed(1) : Math.round(lowVal)} ${getBracketedUnit()}`;
        handlesG.appendChild(lowDimText);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', sx);
        circle.setAttribute('cy', sy);
        circle.setAttribute('r', '6');
        
        const isLocked = state.controlPoints.lowPointsLocked[i];
        const isViolating = yMm > hSlab - state.coverTop + 0.1 || yMm < state.coverBottom - 0.1;
        circle.setAttribute('class', `svg-drag-node ${isViolating ? 'svg-drag-node-warning' : ''} ${isLocked ? 'svg-drag-node-locked' : ''}`);
        
        circle.dataset.type = 'lowpoint';
        circle.dataset.index = i;
        
        circle.addEventListener('mousedown', (e) => startDrag(e, circle));
        circle.addEventListener('dblclick', () => resetNode(circle));
        handlesG.appendChild(circle);
        
        cumulativeSpanX += L;
    }
    
    svg.appendChild(handlesG);
}

// Update the Cover Check badge UI
function updateCoverCheckUI(violates) {
    const checkEl = DOM.checkCover;
    const descEl = DOM.checkCoverDesc;
    const topC = fromMm(state.coverTop);
    const botC = fromMm(state.coverBottom);
    const u = getBracketedUnit();
    
    if (violates) {
        checkEl.className = 'check-item danger';
        descEl.innerHTML = `<span style="color: #ef4444; font-weight:600;">Cover Violation!</span> Tendon is too close to concrete face (Cover Limit: Top ${topC.toFixed(state.unit === 'cm' ? 1 : 0)} ${u}, Bottom ${botC.toFixed(state.unit === 'cm' ? 1 : 0)} ${u}).`;
        checkEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    } else {
        checkEl.className = 'check-item success';
        descEl.textContent = `All tendon points satisfy top (${topC.toFixed(state.unit === 'cm' ? 1 : 0)} ${u}) and bottom (${botC.toFixed(state.unit === 'cm' ? 1 : 0)} ${u}) concrete cover constraints.`;
        checkEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
}

// Reset node to default cover limits on double click
function resetNode(node) {
    const type = node.dataset.type;
    const idx = parseInt(node.dataset.index);
    const h = state.slabThickness;
    const coverT = state.coverTop;
    const coverB = state.coverBottom;
    
    if (type === 'support') {
        if (idx === 0 || idx === state.numSpans) {
            state.controlPoints.supports[idx] = h / 2; // Mid depth
        } else {
            state.controlPoints.supports[idx] = h - coverT; // Max height
        }
    } else {
        state.controlPoints.lowPoints[idx].y = coverB; // Max drape (bottom)
        state.controlPoints.lowPoints[idx].xFract = 0.5; // Center
    }
    
    calculateAndRender();
}

// Drag Handlers
function startDrag(e, element) {
    e.preventDefault();
    dragNode = {
        element: element,
        type: element.dataset.type,
        index: parseInt(element.dataset.index),
        startX: e.clientX,
        startY: e.clientY
    };
    element.classList.add('dragging');
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
}

function drag(e) {
    if (!dragNode) return;
    
    const svgElement = dragNode.element ? (dragNode.element.ownerSVGElement || DOM.profileSvg) : DOM.profileSvg;
    const svgRect = svgElement.getBoundingClientRect();

    if (dragNode.type === 'section-cut') {
        const pc = state.planCoords;
        if (pc) {
            const relativeY = ((e.clientY - svgRect.top) / svgRect.height) * 350;
            const mouseY = (relativeY - pc.offsetY) / pc.scale;
            
            let bestIdx = state.selectedRowIdx;
            let minDiff = Infinity;
            
            for (let s = 0; s < 2 * state.numColRows; s++) {
                const r = Math.floor(s / 2);
                const isB = (s % 2) === 1;
                const cols = state.planColumns.filter(c => c.id.endsWith(`-row${r}`));
                const rAvgY = cols.length > 0 ? cols.reduce((sum, c) => sum + c.y, 0) / cols.length : 0;
                const targetY = rAvgY + (isB ? 0.6 : -0.6);
                
                const diff = Math.abs(mouseY - targetY);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestIdx = s;
                }
            }
            
            if (bestIdx !== state.selectedRowIdx) {
                state.selectedRowIdx = bestIdx;
                calculateAndRender();
            }
        }
        return;
    }

    if (dragNode.type === 'plan-column') {
        const id = dragNode.element.dataset.id;
        const totalWidth = state.slabWidth;
        const pc = state.planCoords;
        if (pc) {
            const relativeX = ((e.clientX - svgRect.left) / svgRect.width) * 1000;
            const relativeY = ((e.clientY - svgRect.top) / svgRect.height) * 350;
            
            const x = (relativeX - pc.offsetX) / pc.scale;
            const y = (relativeY - pc.offsetY) / pc.scale;
            
            const col = state.planColumns.find(c => c.id === id);
            if (col) {
                const isSupport0 = id.includes('col-0');
                const suppIdx = parseInt(id.replace('col-', ''));
                
                let minX = 0;
                let maxX = state.spanLengths.reduce((a, b) => a + b, 0);
                
                const activeRowIdx = Math.floor(state.selectedRowIdx / 2);
                if (suppIdx > 0) {
                    const prevCol = state.planColumns.find(c => c.id === `col-${suppIdx-1}-row${activeRowIdx}`);
                    if (prevCol) minX = prevCol.x + 3.0; // min 3.0m span
                }
                if (suppIdx < state.numSpans) {
                    const nextCol = state.planColumns.find(c => c.id === `col-${suppIdx+1}-row${activeRowIdx}`);
                    if (nextCol) maxX = nextCol.x - 3.0; // min 3.0m span
                }
                
                if (isSupport0) {
                    col.x = 0;
                } else {
                    col.x = Math.max(minX, Math.min(maxX, x));
                }
                col.y = Math.max(0, Math.min(totalWidth, y));
                
                // Sync all columns in this set (same support index) to match this support line X
                state.planColumns.forEach(c => {
                    if (c.id.startsWith(`col-${suppIdx}-`)) {
                        c.x = col.x;
                    }
                });
                
                syncSpanLengthsFromColumns();
            }
            
            calculateFrictionAndLosses();
            renderVisualizer();
            updateChecksAndOutputs();
            updateSidebarPlanInputs();
        }
        return;
    }
    
    const sc = state.svgCoords;
    
    // Convert client screen mouse coordinates to SVG internal coordinate space
    const relativeX = ((e.clientX - svgRect.left) / svgRect.width) * 1000;
    const relativeY = ((e.clientY - svgRect.top) / svgRect.height) * 350;
    
    const idx = dragNode.index;
    const h = state.slabThickness;
    
    // Handle vertical translation
    let newYMm = sc.mapSvgToY(relativeY);
    const coverT = state.coverTop;
    const coverB = state.coverBottom;
    
    if (dragNode.type === 'support') {
        if (!state.controlPoints.supportsLocked[idx]) {
            // Vertical dragging only for supports
            let clampedY = newYMm;
            if (idx === 0 || idx === state.numSpans) {
                clampedY = Math.max(coverB, Math.min(h - coverT, newYMm));
            } else {
                clampedY = Math.max(h / 2, Math.min(h - coverT, newYMm));
            }
            state.controlPoints.supports[idx] = Math.round(clampedY);
        }
    } else {
        // Dragging low points: both Vertical and Horizontal
        if (!state.controlPoints.lowPointsLocked[idx]) {
            const clampedY = Math.max(coverB, Math.min(h / 2, newYMm));
            state.controlPoints.lowPoints[idx].y = Math.round(clampedY);
        }
        
        // Horizontal translation
        // Convert SVG X coordinate back to global meters
        const relativeXGlobal = ((relativeX - sc.margin.left) / sc.chartW) * state.spanLengths.reduce((a, b) => a + b, 0);
        
        // Find span start position
        let spanStartX = 0;
        for (let i = 0; i < idx; i++) {
            spanStartX += state.spanLengths[i];
        }
        
        const localX = relativeXGlobal - spanStartX;
        const L = state.spanLengths[idx];
        
        // Constrain low point horizontally between 20% and 80% of span length
        const xFract = localX / L;
        state.controlPoints.lowPoints[idx].xFract = Math.max(0.2, Math.min(0.8, xFract));
    }
    
    // Interactive recalculation
    calculateFrictionAndLosses();
    renderVisualizer();
    updateChecksAndOutputs();
}

function endDrag() {
    if (dragNode) {
        dragNode.element.classList.remove('dragging');
        dragNode = null;
    }
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);
    
    // Update chart and outputs with final high-fidelity calculation
    calculateAndRender();
}

// Show coordinate tooltip on canvas hover
function showTendonTooltip(e) {
    const sc = state.svgCoords;
    if (!sc) return;
    
    const svgRect = DOM.profileSvg.getBoundingClientRect();
    const relativeX = ((e.clientX - svgRect.left) / svgRect.width) * 1000;
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const xGlobal = ((relativeX - sc.margin.left) / sc.chartW) * totalLength;
    
    if (xGlobal < 0 || xGlobal > totalLength) {
        hideTooltip();
        return;
    }
    
    // Find closest sampled point
    let closestPt = state.sampledPoints[0];
    let minDist = Math.abs(state.sampledPoints[0].xGlobal - xGlobal);
    
    state.sampledPoints.forEach(pt => {
        const dist = Math.abs(pt.xGlobal - xGlobal);
        if (dist < minDist) {
            minDist = dist;
            closestPt = pt;
        }
    });
    
    const tooltip = DOM.tooltip;
    tooltip.classList.remove('hidden');
    tooltip.style.left = `${e.clientX - svgRect.left + 15}px`;
    tooltip.style.top = `${e.clientY - svgRect.top - 15}px`;
    const yVal = fromMm(closestPt.y);
    tooltip.innerHTML = `
        <strong>Span ${closestPt.spanIndex + 1}</strong><br>
        x: ${closestPt.xGlobal.toFixed(2)}m<br>
        y: ${state.unit === 'cm' ? yVal.toFixed(1) : Math.round(yVal)} ${getBracketedUnit()}<br>
        Force: ${closestPt.force.toFixed(0)}kN
    `;
}

function hideTooltip() {
    DOM.tooltip.classList.add('hidden');
}

// Render the Friction Loss Chart (using HTML5 Canvas)
function renderLossChart() {
    const canvas = DOM.lossChart;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get actual layout bounds
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 200 * window.devicePixelRatio;
    
    const w = canvas.width;
    const h = canvas.height;
    const pTop = 20 * window.devicePixelRatio;
    const pRight = 20 * window.devicePixelRatio;
    const pBottom = 35 * window.devicePixelRatio;
    const pLeft = 55 * window.devicePixelRatio;
    const chartW = w - pLeft - pRight;
    const chartH = h - pTop - pBottom;
    
    ctx.scale(1, 1);
    
    const P0 = state.tendonForce;
    const points = state.sampledPoints;
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    
    if (!points || points.length === 0) return;
    
    // Force limits
    const maxP = P0;
    const minP = Math.min(...points.map(pt => pt.force));
    const forceRange = maxP - minP;
    const minScaleP = Math.max(0, minP - forceRange * 0.2); // Give some bottom spacing
    const yGridMax = maxP;
    
    // Scale functions
    const scaleX = (x) => pLeft + (x / totalLength) * chartW;
    const scaleY = (p) => pTop + chartH - ((p - minScaleP) / (maxP - minScaleP)) * chartH;
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1 * window.devicePixelRatio;
    ctx.fillStyle = '#6b7280';
    ctx.font = `${9 * window.devicePixelRatio}px 'JetBrains Mono'`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    // Horizontal force lines
    const numYGrid = 4;
    for (let i = 0; i <= numYGrid; i++) {
        const pVal = minScaleP + (maxP - minScaleP) * (i / numYGrid);
        const sy = scaleY(pVal);
        
        ctx.beginPath();
        ctx.moveTo(pLeft, sy);
        ctx.lineTo(w - pRight, sy);
        ctx.stroke();
        
        ctx.fillText(`${pVal.toFixed(0)} kN`, pLeft - 10 * window.devicePixelRatio, sy);
    }
    
    // Vertical length lines
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let currentX = 0;
    state.spanLengths.forEach((len, idx) => {
        const sx = scaleX(currentX);
        ctx.beginPath();
        ctx.moveTo(sx, pTop);
        ctx.lineTo(sx, pTop + chartH);
        ctx.stroke();
        
        ctx.fillText(`${currentX.toFixed(0)}m`, sx, pTop + chartH + 10 * window.devicePixelRatio);
        currentX += len;
    });
    // Far right line
    const sxEnd = scaleX(totalLength);
    ctx.beginPath();
    ctx.moveTo(sxEnd, pTop);
    ctx.lineTo(sxEnd, pTop + chartH);
    ctx.stroke();
    ctx.fillText(`${totalLength.toFixed(1)}m`, sxEnd, pTop + chartH + 10 * window.devicePixelRatio);

    // Draw the force profile line
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5 * window.devicePixelRatio;
    
    points.forEach((pt, idx) => {
        const sx = scaleX(pt.xGlobal);
        const sy = scaleY(pt.force);
        if (idx === 0) {
            ctx.moveTo(sx, sy);
        } else {
            ctx.lineTo(sx, sy);
        }
    });
    ctx.stroke();
    
    // Draw anchor set drop visually as a shaded zone if applicable
    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.beginPath();
    points.forEach((pt, idx) => {
        const sx = scaleX(pt.xGlobal);
        const sy = scaleY(pt.force);
        if (idx === 0) {
            ctx.moveTo(sx, pTop + chartH);
            ctx.lineTo(sx, sy);
        } else {
            ctx.lineTo(sx, sy);
        }
    });
    ctx.lineTo(scaleX(totalLength), pTop + chartH);
    ctx.closePath();
    ctx.fill();

    // Update Stat bubbles in HTML card header
    if (DOM.minForceVal) DOM.minForceVal.textContent = `${minP.toFixed(0)} kN`;
    const maxLossPercent = ((P0 - minP) / P0) * 100;
    if (DOM.maxLossVal) DOM.maxLossVal.textContent = `${maxLossPercent.toFixed(1)}%`;
}

// Compute Design checks & details table
function updateChecksAndOutputs() {
    const h = state.slabThickness;
    const points = state.sampledPoints;
    
    // 1. Calculate Average Precompression P/A in both directions
    const avgForceX = points.reduce((acc, pt) => acc + pt.force, 0) / points.length;
    const slabAreaSqMmX = h * 1000 * state.tendonSpacingX;
    const avgStressMPaX = (avgForceX * 1000) / slabAreaSqMmX;
    
    // Y Direction Precompression stress
    const Ly = state.spanYLen;
    const drapeY = (h - state.coverTop - state.coverBottom) / 1000; // meters
    const alphaY = (8 * drapeY) / Ly; // total angular change
    const P0_Y = state.tendonForceY;
    const mu = state.frictionMu;
    const k = state.frictionK;
    const avgForceY = P0_Y * Math.exp(-(mu * alphaY + k * Ly / 2)); // average force estimate
    const slabAreaSqMmY = h * 1000 * state.tendonSpacingY;
    const avgStressMPaY = (avgForceY * 1000) / slabAreaSqMmY;

    const precompEl = DOM.checkAvgPrestress;
    const precompDesc = DOM.checkPrestressDesc;
    
    const minStress = Math.min(avgStressMPaX, avgStressMPaY);
    const maxStress = Math.max(avgStressMPaX, avgStressMPaY);
    
    if (minStress < 0.7) {
        precompEl.className = 'check-item warning';
        precompDesc.innerHTML = `<span style="color: #f59e0b; font-weight:600;">Suboptimal Compression</span>. X: ${avgStressMPaX.toFixed(2)} MPa | Y: ${avgStressMPaY.toFixed(2)} MPa (Target: 0.7 - 3.5 MPa)`;
        precompEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else if (maxStress > 3.5) {
        precompEl.className = 'check-item danger';
        precompDesc.innerHTML = `<span style="color: #ef4444; font-weight:600;">Excessive Compression</span>. X: ${avgStressMPaX.toFixed(2)} MPa | Y: ${avgStressMPaY.toFixed(2)} MPa (Target: 0.7 - 3.5 MPa)`;
        precompEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    } else {
        precompEl.className = 'check-item success';
        precompDesc.innerHTML = `Compression stress: X: <strong>${avgStressMPaX.toFixed(2)} MPa</strong> | Y: <strong>${avgStressMPaY.toFixed(2)} MPa</strong> (Optimal limit: 0.7 - 3.5 MPa).`;
        precompEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    }

    // 2. Load Balancing analysis
    const wSlab = state.concreteDensity * (h / 1000); // self-weight load (kN/m per meter width)
    const wSlabPerTendonX = wSlab * state.tendonSpacingX; // Self-weight strip for X (kN/m)
    const wSlabPerTendonY = wSlab * state.tendonSpacingY; // Self-weight strip for Y (kN/m)
    
    // Clear balancing list
    DOM.balancingMetrics.innerHTML = '';
    
    let allBalancingOptimal = true;
    let anyBalancingDanger = false;
    
    // X Direction balancing per span
    let spanStartX = 0;
    for (let i = 0; i < state.numSpans; i++) {
        const L = state.spanLengths[i];
        
        const spanPoints = points.filter(pt => pt.xGlobal >= spanStartX && pt.xGlobal <= spanStartX + L + 0.0001);
        const spanAvgForce = spanPoints.reduce((acc, pt) => acc + pt.force, 0) / spanPoints.length;
        
        const yL = state.controlPoints.supports[i];
        const yR = state.controlPoints.supports[i+1];
        const yM = state.controlPoints.lowPoints[i].y;
        const drapeM = ((yL + yR) / 2 - yM) / 1000; // meters
        
        const wEqX = (8 * spanAvgForce * drapeM) / (L * L); // kN/m per tendon
        const ratioX = (wEqX / wSlabPerTendonX) * 100;
        
        let labelClass = 'optimal';
        if (ratioX < 50 || ratioX > 90) {
            labelClass = 'bad';
            anyBalancingDanger = true;
            allBalancingOptimal = false;
        } else if (ratioX < 60 || ratioX > 80) {
            labelClass = 'suboptimal';
            allBalancingOptimal = false;
        }
        
        const metricRow = document.createElement('div');
        metricRow.className = 'balancing-metrics';
        metricRow.innerHTML = `
            <div class="balancing-metric-row">
                <span>X Span ${i+1}: Upward Force ${wEqX.toFixed(2)} kN/m</span>
                <span class="${labelClass}">${ratioX.toFixed(0)}% of SW</span>
            </div>
            <div class="metric-bar-outer">
                <div class="metric-bar-inner ${labelClass}" style="width: ${Math.min(100, ratioX)}%"></div>
            </div>
        `;
        DOM.balancingMetrics.appendChild(metricRow);
        
        spanStartX += L;
    }
    
    // Y Direction balancing
    const wEqY = (8 * avgForceY * drapeY) / (Ly * Ly);
    const ratioY = (wEqY / wSlabPerTendonY) * 100;
    
    let labelClassY = 'optimal';
    if (ratioY < 50 || ratioY > 90) {
        labelClassY = 'bad';
        anyBalancingDanger = true;
        allBalancingOptimal = false;
    } else if (ratioY < 60 || ratioY > 80) {
        labelClassY = 'suboptimal';
        allBalancingOptimal = false;
    }
    
    const metricRowY = document.createElement('div');
    metricRowY.className = 'balancing-metrics';
    metricRowY.innerHTML = `
        <div class="balancing-metric-row">
            <span>Y Direction Span: Upward Force ${wEqY.toFixed(2)} kN/m</span>
            <span class="${labelClassY}">${ratioY.toFixed(0)}% of SW</span>
        </div>
        <div class="metric-bar-outer">
            <div class="metric-bar-inner ${labelClassY}" style="width: ${Math.min(100, ratioY)}%"></div>
        </div>
    `;
    DOM.balancingMetrics.appendChild(metricRowY);
    
    // Update balancing check card header state
    const lbCheckEl = DOM.checkLoadBalancing;
    if (anyBalancingDanger) {
        lbCheckEl.className = 'check-item danger';
        lbCheckEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    } else if (!allBalancingOptimal) {
        lbCheckEl.className = 'check-item warning';
        lbCheckEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
        lbCheckEl.className = 'check-item success';
        lbCheckEl.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    }

    // 3. Update Coordinates Table
    DOM.coordsTable.innerHTML = '';
    const tblIncrementEl = document.getElementById('table-increment');
    const tblIncrement = tblIncrementEl ? parseFloat(tblIncrementEl.value) || 0.5 : 0.5; // meters
    let tblX = 0;
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    
    while(tblX <= totalLength + 0.0001) {
        const xVal = Math.min(totalLength, tblX);
        const profile = getTendonProfile(xVal);
        
        // Find closest force value from sampled points
        let closestPt = points[0];
        let minDist = Math.abs(points[0].xGlobal - xVal);
        points.forEach(pt => {
            const dist = Math.abs(pt.xGlobal - xVal);
            if (dist < minDist) {
                minDist = dist;
                closestPt = pt;
            }
        });
        
        // Find equivalent load at this point weq = P * ddy
        // y''(x) is in rad/m. force in kN. weq in kN/m.
        const ddy = profile.ddy;
        const weq = closestPt.force * ddy;
        
        const isCoverViolated = profile.y > h - state.coverTop || profile.y < state.coverBottom;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Span ${profile.spanIndex + 1}</td>
            <td>${xVal.toFixed(2)}</td>
            <td>${profile.localX.toFixed(2)}</td>
            <td class="${isCoverViolated ? 'danger-coord' : 'highlight-coord'}">${fromMm(profile.y).toFixed(state.unit === 'cm' ? 1 : 0)}</td>
            <td>${closestPt.force.toFixed(0)}</td>
            <td>${profile.dy.toFixed(4)}</td>
            <td>${weq.toFixed(2)}</td>
        `;
        DOM.coordsTable.appendChild(row);
        
        tblX += tblIncrement;
    }

    // 4. Support Tangent Angle Limits Verification
    const supportViolations = [];
    for (let i = 0; i <= state.numSpans; i++) {
        const angles = getSupportAngles(i);
        if (angles.left !== null) {
            if (angles.left < state.minSupportAngle - 0.001 || angles.left > state.maxSupportAngle + 0.001) {
                supportViolations.push(`S${i} Left (${angles.left.toFixed(1)}°)`);
            }
        }
        if (angles.right !== null) {
            if (angles.right < state.minSupportAngle - 0.001 || angles.right > state.maxSupportAngle + 0.001) {
                supportViolations.push(`S${i} Right (${angles.right.toFixed(1)}°)`);
            }
        }
    }

    const saCheck = DOM.checkSupportAngles;
    const saDesc = DOM.checkSupportAnglesDesc;
    if (saCheck && saDesc) {
        if (supportViolations.length > 0) {
            saCheck.className = 'check-item danger';
            saCheck.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            saDesc.innerHTML = `<span style="color: #ef4444; font-weight:600;">Slope Violation!</span> Out of bounds at: ${supportViolations.join(', ')} (Limits: ${state.minSupportAngle.toFixed(1)}° - ${state.maxSupportAngle.toFixed(1)}°).`;
        } else {
            saCheck.className = 'check-item success';
            saCheck.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
            saDesc.textContent = `All support slope angles are within specified limits (${state.minSupportAngle.toFixed(1)}° - ${state.maxSupportAngle.toFixed(1)}°).`;
        }
    }

    // 5. Perpendicular Tendon Clash Detection
    const activePerpTendons = getActivePerpendicularTendons();
    const clashes = activePerpTendons.filter(t => t.isClash);
    
    const clashCheck = DOM.checkTendonClashes;
    const clashDesc = DOM.checkTendonClashesDesc;
    if (clashCheck && clashDesc) {
        if (clashes.length > 0) {
            clashCheck.className = 'check-item danger';
            clashCheck.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            
            const locations = clashes.map(c => `x = ${c.x.toFixed(2)}m`);
            const uniqueLocations = Array.from(new Set(locations));
            const displayLocs = uniqueLocations.slice(0, 3).join(', ') + (uniqueLocations.length > 3 ? ` (+${uniqueLocations.length - 3} more)` : '');
            
            clashDesc.innerHTML = `<span style="color: #ef4444; font-weight:600;">Clash Detected!</span> Overlaps found at: ${displayLocs}.`;
        } else {
            clashCheck.className = 'check-item success';
            clashCheck.querySelector('.check-status-icon').innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
            clashDesc.textContent = `No clashes detected between longitudinal and perpendicular tendons.`;
        }
    }
}

// Dynamic section selector tabs rendering (Above/Below each row set)
function renderSectionSelectTabs() {
    const container = document.getElementById('section-select-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (state.activeTab !== 'elevation' && state.activeTab !== 'split') {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    
    const numRows = state.numColRows;
    for (let r = 0; r < numRows; r++) {
        const rowNum = r + 1;
        
        // Above Tab
        const idxAbove = 2 * r;
        const btnAbove = document.createElement('button');
        btnAbove.className = `tab-btn ${idxAbove === state.selectedRowIdx ? 'active' : ''}`;
        btnAbove.textContent = `Above Row ${rowNum}`;
        btnAbove.addEventListener('click', () => {
            state.selectedRowIdx = idxAbove;
            calculateAndRender();
        });
        container.appendChild(btnAbove);
        
        // Below Tab
        const idxBelow = 2 * r + 1;
        const btnBelow = document.createElement('button');
        btnBelow.className = `tab-btn ${idxBelow === state.selectedRowIdx ? 'active' : ''}`;
        btnBelow.textContent = `Below Row ${rowNum}`;
        btnBelow.addEventListener('click', () => {
            state.selectedRowIdx = idxBelow;
            calculateAndRender();
        });
        container.appendChild(btnBelow);
    }
}

// Master execution block
// Master execution block
function calculateAndRender() {
    if (state.controlPointsRows && state.controlPointsRows[state.selectedRowIdx]) {
        state.controlPoints = state.controlPointsRows[state.selectedRowIdx];
    }
    syncSpanLengthsFromColumns();
    calculateFrictionAndLosses();
    renderVisualizer();
    renderLossChart();
    updateSidebarNodeInputs();
    updateActiveColumnsData();
    updateChecksAndOutputs();
    syncStateToInputs(); // Ensure sidebar inputs are synced with interactive changes
    renderSectionSelectTabs();
}

// Render numeric input fields for supports and low points dynamically
function renderNodeInputs() {
    const container = DOM.nodeInputsContainer;
    if (!container) return;
    container.innerHTML = '';
    
    const h = state.slabThickness;
    const coverT = state.coverTop;
    const coverB = state.coverBottom;
    
    // 1. Support Heights
    const supportTitle = document.createElement('h3');
    supportTitle.style.fontSize = '0.75rem';
    supportTitle.style.color = '#a7f3d0';
    supportTitle.style.marginTop = '0.5rem';
    supportTitle.style.marginBottom = '0.25rem';
    supportTitle.textContent = `Support heights ${getBracketedUnit()} from top`;
    container.appendChild(supportTitle);
    
    for (let i = 0; i <= state.numSpans; i++) {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 2fr auto';
        row.style.gap = '0.4rem';
        row.style.alignItems = 'end';
        row.style.marginBottom = '0.4rem';
        
        const label = document.createElement('div');
        label.style.display = 'flex';
        label.style.flexDirection = 'column';
        
        const nameSpan = document.createElement('span');
        nameSpan.style.fontSize = '0.7rem';
        nameSpan.style.fontWeight = '600';
        nameSpan.style.color = 'var(--text-secondary)';
        nameSpan.textContent = `Support S${i}`;
        label.appendChild(nameSpan);
        
        const angleSpan = document.createElement('span');
        angleSpan.id = `support-angle-text-${i}`;
        angleSpan.style.fontSize = '0.6rem';
        angleSpan.style.color = '#10b981';
        angleSpan.style.marginTop = '2px';
        const angles = getSupportAngles(i);
        angleSpan.textContent = formatSupportAngleText(angles);
        label.appendChild(angleSpan);
        
        const hGroup = document.createElement('div');
        hGroup.className = 'form-group';
        const hLabel = document.createElement('label');
        hLabel.style.fontSize = '0.6rem';
        hLabel.textContent = 'Clearance';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control form-control-sm';
        input.id = `input-supp-y-${i}`;
        const val = fromMm(h - state.controlPoints.supports[i]);
        input.value = state.unit === 'cm' ? val.toFixed(1) : Math.round(val);
        input.min = fromMm(coverT);
        input.max = i === 0 || i === state.numSpans ? fromMm(h - coverB) : fromMm(h / 2);
        input.step = state.unit === 'cm' ? 0.5 : 5;
        
        input.addEventListener('change', () => {
            const currentH = state.slabThickness;
            const currentCoverT = state.coverTop;
            const currentCoverB = state.coverBottom;
            
            let val = parseFloat(input.value) || fromMm(currentCoverT);
            const maxD = i === 0 || i === state.numSpans ? currentH - currentCoverB : currentH / 2;
            const maxVal = fromMm(maxD);
            const minVal = fromMm(currentCoverT);
            val = Math.max(minVal, Math.min(maxVal, val));
            state.controlPoints.supports[i] = currentH - toMm(val);
            input.value = state.unit === 'cm' ? val.toFixed(1) : Math.round(val);
            calculateAndRender();
        });
        
        hGroup.appendChild(hLabel);
        hGroup.appendChild(input);
        
        const lockBtn = document.createElement('button');
        lockBtn.className = `btn-lock ${state.controlPoints.supportsLocked[i] ? 'locked' : ''}`;
        lockBtn.id = `btn-supp-lock-${i}`;
        lockBtn.title = state.controlPoints.supportsLocked[i] ? 'Unlock height' : 'Lock height';
        lockBtn.innerHTML = state.controlPoints.supportsLocked[i]
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
            
        lockBtn.addEventListener('click', () => {
            state.controlPoints.supportsLocked[i] = !state.controlPoints.supportsLocked[i];
            calculateAndRender();
        });
        
        row.appendChild(label);
        row.appendChild(hGroup);
        row.appendChild(lockBtn);
        container.appendChild(row);
    }
    
    // 2. Low Point Inputs
    const lpTitle = document.createElement('h3');
    lpTitle.style.fontSize = '0.75rem';
    lpTitle.style.color = '#60a5fa';
    lpTitle.style.marginTop = '0.5rem';
    lpTitle.style.marginBottom = '0.25rem';
    lpTitle.textContent = 'Mid-Span Low Points';
    container.appendChild(lpTitle);
    
    for (let i = 0; i < state.numSpans; i++) {
        const lp = state.controlPoints.lowPoints[i];
        const spanL = state.spanLengths[i];
        
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1.2fr 1.2fr auto';
        row.style.gap = '0.4rem';
        row.style.alignItems = 'end';
        
        const spanLabel = document.createElement('div');
        spanLabel.style.fontSize = '0.7rem';
        spanLabel.style.fontWeight = '600';
        spanLabel.style.color = 'var(--text-secondary)';
        spanLabel.style.paddingBottom = '0.25rem';
        spanLabel.textContent = `Span ${i + 1}`;
        
        // Height input
        const hGroup = document.createElement('div');
        hGroup.className = 'form-group';
        const hLabel = document.createElement('label');
        hLabel.style.fontSize = '0.6rem';
        hLabel.textContent = `Ht ${getBracketedUnit()}`;
        const hInput = document.createElement('input');
        hInput.type = 'number';
        hInput.className = 'form-control form-control-sm';
        hInput.id = `input-lp-y-${i}`;
        const val = fromMm(lp.y);
        hInput.value = state.unit === 'cm' ? val.toFixed(1) : Math.round(val);
        hInput.min = fromMm(coverB);
        hInput.max = fromMm(h/2);
        hInput.step = state.unit === 'cm' ? 0.5 : 5;
        hInput.addEventListener('change', () => {
            const currentH = state.slabThickness;
            const currentCoverB = state.coverBottom;
            
            let val = parseFloat(hInput.value) || fromMm(currentCoverB);
            const minVal = fromMm(currentCoverB);
            const maxVal = fromMm(currentH / 2);
            val = Math.max(minVal, Math.min(maxVal, val));
            state.controlPoints.lowPoints[i].y = toMm(val);
            hInput.value = state.unit === 'cm' ? val.toFixed(1) : Math.round(val);
            calculateAndRender();
        });
        hGroup.appendChild(hLabel);
        hGroup.appendChild(hInput);
        
        // Local x position (m)
        const xGroup = document.createElement('div');
        xGroup.className = 'form-group';
        const xLabel = document.createElement('label');
        xLabel.style.fontSize = '0.6rem';
        xLabel.textContent = 'Pos x (m)';
        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.className = 'form-control form-control-sm';
        xInput.id = `input-lp-x-${i}`;
        xInput.value = (lp.xFract * spanL).toFixed(2);
        xInput.min = (0.2 * spanL).toFixed(1);
        xInput.max = (0.8 * spanL).toFixed(1);
        xInput.step = 0.1;
        xInput.addEventListener('change', () => {
            const spanL = state.spanLengths[i];
            let val = parseFloat(xInput.value) || spanL / 2;
            val = Math.max(0.2 * spanL, Math.min(0.8 * spanL, val));
            state.controlPoints.lowPoints[i].xFract = val / spanL;
            xInput.value = val.toFixed(2);
            calculateAndRender();
        });
        xGroup.appendChild(xLabel);
        xGroup.appendChild(xInput);
        
        const lockBtn = document.createElement('button');
        lockBtn.className = `btn-lock ${state.controlPoints.lowPointsLocked[i] ? 'locked' : ''}`;
        lockBtn.id = `btn-lp-lock-${i}`;
        lockBtn.title = state.controlPoints.lowPointsLocked[i] ? 'Unlock height' : 'Lock height';
        lockBtn.innerHTML = state.controlPoints.lowPointsLocked[i]
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
            
        lockBtn.addEventListener('click', () => {
            state.controlPoints.lowPointsLocked[i] = !state.controlPoints.lowPointsLocked[i];
            calculateAndRender();
        });
        
        row.appendChild(spanLabel);
        row.appendChild(hGroup);
        row.appendChild(xGroup);
        row.appendChild(lockBtn);
        container.appendChild(row);
    }
    renderActiveColumnsData();
}

// Render or update the sidebar numeric inputs based on current span configuration
function updateSidebarNodeInputs() {
    const container = DOM.nodeInputsContainer;
    if (!container) return;
    
    const expectedInputCount = (state.numSpans + 1) + (state.numSpans * 2);
    const currentInputCount = container.querySelectorAll('input').length;
    
    if (expectedInputCount !== currentInputCount) {
        renderNodeInputs();
    } else {
        // Sync values without rebuilding (prevents losing focus)
        for (let i = 0; i <= state.numSpans; i++) {
            const input = document.getElementById(`input-supp-y-${i}`);
            if (input && document.activeElement !== input) {
                const val = fromMm(state.slabThickness - state.controlPoints.supports[i]);
                input.value = state.unit === 'cm' ? val.toFixed(1) : Math.round(val);
            }
            const lockBtn = document.getElementById(`btn-supp-lock-${i}`);
            if (lockBtn) {
                const isLocked = state.controlPoints.supportsLocked[i];
                lockBtn.className = `btn-lock ${isLocked ? 'locked' : ''}`;
                lockBtn.title = isLocked ? 'Unlock height' : 'Lock height';
                lockBtn.innerHTML = isLocked
                    ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
                    : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
            }
            const angleSpan = document.getElementById(`support-angle-text-${i}`);
            if (angleSpan) {
                const angles = getSupportAngles(i);
                angleSpan.textContent = formatSupportAngleText(angles);
            }
        }
        for (let i = 0; i < state.numSpans; i++) {
            const hInput = document.getElementById(`input-lp-y-${i}`);
            if (hInput && document.activeElement !== hInput) {
                const val = fromMm(state.controlPoints.lowPoints[i].y);
                hInput.value = state.unit === 'cm' ? val.toFixed(1) : Math.round(val);
            }
            const xInput = document.getElementById(`input-lp-x-${i}`);
            if (xInput && document.activeElement !== xInput) {
                const spanL = state.spanLengths[i];
                xInput.value = (state.controlPoints.lowPoints[i].xFract * spanL).toFixed(2);
            }
            const lockBtn = document.getElementById(`btn-lp-lock-${i}`);
            if (lockBtn) {
                const isLocked = state.controlPoints.lowPointsLocked[i];
                lockBtn.className = `btn-lock ${isLocked ? 'locked' : ''}`;
                lockBtn.title = isLocked ? 'Unlock height' : 'Lock height';
                lockBtn.innerHTML = isLocked
                    ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
                    : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
            }
        }
    }
}

// Render columns coordinate data inside the active section heights panel
function renderActiveColumnsData() {
    const container = document.getElementById('active-columns-data-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const activeRowIdx = Math.floor(state.selectedRowIdx / 2);
    
    const title = document.createElement('h3');
    title.style.fontSize = '0.75rem';
    title.style.color = '#a7f3d0';
    title.style.marginTop = '0.5rem';
    title.style.marginBottom = '0.25rem';
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.alignItems = 'center';
    title.innerHTML = `<span>Section Column Coordinates (m)</span> <span style="font-size:0.65rem; color:var(--color-primary-light); font-weight:600;">(Grid Line ${activeRowIdx + 1})</span>`;
    container.appendChild(title);
    
    // Add Header Row
    const headerRow = document.createElement('div');
    headerRow.style.display = 'grid';
    headerRow.style.gridTemplateColumns = '50px 1fr 1fr';
    headerRow.style.gap = '0.4rem';
    headerRow.style.fontSize = '0.7rem';
    headerRow.style.fontWeight = '700';
    headerRow.style.color = 'var(--text-secondary)';
    headerRow.style.textTransform = 'uppercase';
    headerRow.style.marginBottom = '0.25rem';
    headerRow.style.borderBottom = '1px solid var(--border-color)';
    headerRow.style.paddingBottom = '0.2rem';
    
    const labelHeader = document.createElement('div');
    labelHeader.textContent = 'Col';
    const xHeader = document.createElement('div');
    xHeader.textContent = 'X (m)';
    const yHeader = document.createElement('div');
    yHeader.textContent = 'Y (m)';
    
    headerRow.appendChild(labelHeader);
    headerRow.appendChild(xHeader);
    headerRow.appendChild(yHeader);
    container.appendChild(headerRow);
    
    const rowCols = state.planColumns.filter(c => c.id.endsWith(`-row${activeRowIdx}`));
    
    rowCols.forEach((col) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '50px 1fr 1fr';
        row.style.gap = '0.4rem';
        row.style.alignItems = 'center';
        row.style.marginBottom = '0.2rem';
        
        const label = document.createElement('div');
        label.style.fontSize = '0.7rem';
        label.style.fontWeight = '600';
        label.style.color = 'var(--text-primary)';
        
        const suppIdx = parseInt(col.id.split('-')[1]);
        const prefix = getColumnPrefix(suppIdx, state.numSpans + 1);
        label.textContent = `${prefix}${activeRowIdx + 1}`;
        
        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.className = 'form-control form-control-sm';
        xInput.id = `input-elev-col-x-${col.id}`;
        xInput.value = col.x.toFixed(2);
        xInput.step = '0.1';
        xInput.placeholder = 'X';
        if (suppIdx === 0) xInput.disabled = true;
        
        xInput.addEventListener('change', () => {
            const totalL = state.spanLengths.reduce((a, b) => a + b, 0);
            let val = parseFloat(xInput.value) || 0;
            
            let minX = 0;
            let maxX = totalL;
            if (suppIdx > 0) {
                const prevCol = state.planColumns.find(c => c.id === `col-${suppIdx-1}-row${activeRowIdx}`);
                if (prevCol) minX = prevCol.x + 3.0;
            }
            if (suppIdx < state.numSpans) {
                const nextCol = state.planColumns.find(c => c.id === `col-${suppIdx+1}-row${activeRowIdx}`);
                if (nextCol) maxX = nextCol.x - 3.0;
            }
            
            val = Math.max(minX, Math.min(maxX, val));
            col.x = val;
            xInput.value = val.toFixed(2);
            
            state.planColumns.forEach(c => {
                if (c.id.startsWith(`col-${suppIdx}-`)) {
                    c.x = val;
                }
            });
            
            syncSpanLengthsFromColumns();
            calculateAndRender();
        });
        
        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.className = 'form-control form-control-sm';
        yInput.id = `input-elev-col-y-${col.id}`;
        yInput.value = col.y.toFixed(2);
        yInput.step = '0.1';
        yInput.placeholder = 'Y';
        yInput.addEventListener('change', () => {
            const totalW = state.slabWidth;
            let val = parseFloat(yInput.value) || 0;
            val = Math.max(0, Math.min(totalW, val));
            col.y = val;
            yInput.value = val.toFixed(2);
            calculateAndRender();
        });
        
        row.appendChild(label);
        row.appendChild(xInput);
        row.appendChild(yInput);
        container.appendChild(row);
    });
}

function updateActiveColumnsData() {
    const container = document.getElementById('active-columns-data-container');
    if (!container) return;
    
    const activeRowIdx = Math.floor(state.selectedRowIdx / 2);
    const rowCols = state.planColumns.filter(c => c.id.endsWith(`-row${activeRowIdx}`));
    
    const expectedColCount = rowCols.length;
    const currentColCount = container.querySelectorAll('input').length / 2;
    
    const firstCol = rowCols[0];
    const matchesRow = firstCol ? !!document.getElementById(`input-elev-col-x-${firstCol.id}`) : true;
    
    if (expectedColCount !== currentColCount || !matchesRow) {
        renderActiveColumnsData();
    } else {
        // Update section title grid label
        const titleSpan = container.querySelector('h3 span:last-child');
        if (titleSpan) {
            titleSpan.textContent = `(Grid Line ${activeRowIdx + 1})`;
        }
        
        rowCols.forEach((col) => {
            const suppIdx = parseInt(col.id.split('-')[1]);
            const labelDiv = container.querySelector(`input[id="input-elev-col-x-${col.id}"]`)?.parentElement?.firstElementChild;
            if (labelDiv) {
                const prefix = getColumnPrefix(suppIdx, state.numSpans + 1);
                labelDiv.textContent = `${prefix}${activeRowIdx + 1}`;
            }
            
            const xIn = document.getElementById(`input-elev-col-x-${col.id}`);
            if (xIn && document.activeElement !== xIn) {
                xIn.value = col.x.toFixed(2);
            }
            const yIn = document.getElementById(`input-elev-col-y-${col.id}`);
            if (yIn && document.activeElement !== yIn) {
                yIn.value = col.y.toFixed(2);
            }
        });
    }
}

// Color palette for perpendicular tendon sets
function getSetColor(setIdx) {
    const colors = [
        '#a3e635', // Set 1: Lime/Yellow-Green
        '#a855f7', // Set 2: Purple
        '#22c55e', // Set 3: Green
        '#06b6d4', // Set 4: Cyan
        '#ec4899', // Set 5: Pink
        '#f97316', // Set 6: Orange
        '#6366f1', // Set 7: Indigo
        '#0d9488', // Set 8: Teal
        '#fbbf24', // Set 9: Amber
        '#d946ef'  // Set 10: Fuchsia
    ];
    return colors[setIdx % colors.length];
}

// Get global X coordinate of support i
function getSupportX(i) {
    let x = 0;
    const clampedI = Math.min(i, state.numSpans);
    for (let s = 0; s < clampedI; s++) {
        x += state.spanLengths[s];
    }
    return x;
}

// Get the coordinates and clash status of all active perpendicular tendons
function getActivePerpendicularTendons() {
    const list = [];
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    
    state.elevationTendonSets.forEach((set, setIdx) => {
        const sIdx = Math.min(set.supportIdx, state.numSpans);
        
        // Find all enabled columns for this support index to calculate global offset position
        const enabledCols = state.planColumns.filter(c => c.id.startsWith(`col-${sIdx}-`) && c.enabled);
        
        let supX;
        if (enabledCols.length > 0) {
            if (set.direction === 'right') {
                // For right side, offset is measured from the column furthest to the right (maximum X)
                supX = Math.max(...enabledCols.map(c => c.x));
            } else {
                // For left side, offset is measured from the column furthest to the left (minimum X)
                supX = Math.min(...enabledCols.map(c => c.x));
            }
        } else {
            // Fallback to active section column X
            const colRowIdx = Math.floor(state.selectedRowIdx / 2);
            supX = getColumnX(sIdx, colRowIdx);
        }
        
        for (let j = 0; j < set.count; j++) {
            let x = 0;
            if (set.direction === 'right') {
                x = supX + set.offset + j * set.spacing;
            } else {
                x = supX - set.offset - j * set.spacing;
            }
            
            // Only keep if within slab bounds
            if (x >= 0 && x <= totalLength + 0.0001) {
                // Calculate y coordinate of the longitudinal tendon at this x coordinate
                const profile = getTendonProfile(x);
                const yLongitudinal = profile.y; // mm from bottom
                const yTransverse = set.height;   // mm from bottom
                const yDiff = Math.abs(yTransverse - yLongitudinal);
                const isClash = yDiff < state.ductDiameter; // clash envelope based on custom duct diameter
                
                list.push({
                    x: x,
                    y: yTransverse,
                    yLongitudinal: yLongitudinal,
                    yDiff: yDiff,
                    isClash: isClash,
                    setIdx: setIdx,
                    tendonIdx: j
                });
            }
        }
    });
    return list;
}

// Render dynamic input fields for perpendicular tendon sets in the sidebar
function renderSidebarTendonSets() {
    const container = DOM.tendonSetsContainer;
    if (!container) return;
    container.innerHTML = '';

    state.elevationTendonSets.forEach((set, idx) => {
        const setDiv = document.createElement('div');
        setDiv.className = 'tendon-set-card';
        setDiv.style.border = '1px solid #334155';
        setDiv.style.borderRadius = '6px';
        setDiv.style.padding = '0.6rem';
        setDiv.style.backgroundColor = '#0b1329';
        setDiv.style.display = 'flex';
        setDiv.style.flexDirection = 'column';
        setDiv.style.gap = '0.5rem';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const title = document.createElement('h3');
        title.style.fontSize = '0.75rem';
        title.style.margin = '0';
        title.style.color = '#38bdf8';
        title.textContent = `Set ${idx + 1}`;
        header.appendChild(title);

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '0.3rem';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-secondary';
        copyBtn.style.padding = '2px 6px';
        copyBtn.style.fontSize = '0.65rem';
        copyBtn.style.lineHeight = '1';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            state.clipboardTendonSet = { ...set };
            renderSidebarTendonSets();
        });
        btnGroup.appendChild(copyBtn);

        const pasteBtn = document.createElement('button');
        pasteBtn.className = 'btn btn-secondary';
        pasteBtn.style.padding = '2px 6px';
        pasteBtn.style.fontSize = '0.65rem';
        pasteBtn.style.lineHeight = '1';
        pasteBtn.textContent = 'Paste';
        if (!state.clipboardTendonSet) {
            pasteBtn.disabled = true;
            pasteBtn.style.opacity = '0.4';
            pasteBtn.style.cursor = 'not-allowed';
        }
        pasteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.clipboardTendonSet) {
                set.supportIdx = state.clipboardTendonSet.supportIdx;
                set.direction = state.clipboardTendonSet.direction;
                set.count = state.clipboardTendonSet.count;
                set.spacing = state.clipboardTendonSet.spacing;
                set.offset = state.clipboardTendonSet.offset;
                set.height = Math.max(0, Math.min(state.slabThickness, state.clipboardTendonSet.height));
                calculateAndRender();
            }
        });
        btnGroup.appendChild(pasteBtn);

        header.appendChild(btnGroup);
        
        setDiv.appendChild(header);

        // Row 1: Support & Direction
        const row1 = document.createElement('div');
        row1.style.display = 'grid';
        row1.style.gridTemplateColumns = '1fr 1fr';
        row1.style.gap = '0.4rem';

        const supGroup = document.createElement('div');
        supGroup.className = 'form-group';
        supGroup.style.margin = '0';
        const supLabel = document.createElement('label');
        supLabel.style.fontSize = '0.6rem';
        supLabel.textContent = 'Support';
        const supSelect = document.createElement('select');
        supSelect.className = 'form-control form-control-sm';
        supSelect.id = `input-set-support-${idx}`;
        for (let s = 0; s <= state.numSpans; s++) {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = `S${s}`;
            if (set.supportIdx === s) opt.selected = true;
            supSelect.appendChild(opt);
        }
        supSelect.addEventListener('change', () => {
            set.supportIdx = parseInt(supSelect.value);
            calculateAndRender();
        });
        supGroup.appendChild(supLabel);
        supGroup.appendChild(supSelect);
        row1.appendChild(supGroup);

        const dirGroup = document.createElement('div');
        dirGroup.className = 'form-group';
        dirGroup.style.margin = '0';
        const dirLabel = document.createElement('label');
        dirLabel.style.fontSize = '0.6rem';
        dirLabel.textContent = 'Direction';
        const dirSelect = document.createElement('select');
        dirSelect.className = 'form-control form-control-sm';
        dirSelect.id = `input-set-dir-${idx}`;
        const optLeft = document.createElement('option');
        optLeft.value = 'left';
        optLeft.textContent = 'Left';
        if (set.direction === 'left') optLeft.selected = true;
        const optRight = document.createElement('option');
        optRight.value = 'right';
        optRight.textContent = 'Right';
        if (set.direction === 'right') optRight.selected = true;
        dirSelect.appendChild(optLeft);
        dirSelect.appendChild(optRight);
        dirSelect.addEventListener('change', () => {
            set.direction = dirSelect.value;
            calculateAndRender();
        });
        dirGroup.appendChild(dirLabel);
        dirGroup.appendChild(dirSelect);
        row1.appendChild(dirGroup);

        setDiv.appendChild(row1);

        // Row 2: Count & Spacing
        const row2 = document.createElement('div');
        row2.style.display = 'grid';
        row2.style.gridTemplateColumns = '1fr 1fr';
        row2.style.gap = '0.4rem';

        const cntGroup = document.createElement('div');
        cntGroup.className = 'form-group';
        cntGroup.style.margin = '0';
        const cntLabel = document.createElement('label');
        cntLabel.style.fontSize = '0.6rem';
        cntLabel.textContent = 'Count';
        const cntInput = document.createElement('input');
        cntInput.type = 'number';
        cntInput.className = 'form-control form-control-sm';
        cntInput.id = `input-set-count-${idx}`;
        cntInput.value = set.count;
        cntInput.min = 0;
        cntInput.max = 50;
        cntInput.addEventListener('input', () => {
            set.count = Math.max(0, parseInt(cntInput.value) || 0);
            calculateAndRender();
        });
        cntInput.addEventListener('change', () => {
            set.count = Math.max(0, parseInt(cntInput.value) || 0);
            cntInput.value = set.count;
            calculateAndRender();
        });
        cntGroup.appendChild(cntLabel);
        cntGroup.appendChild(cntInput);
        row2.appendChild(cntGroup);

        const spGroup = document.createElement('div');
        spGroup.className = 'form-group';
        spGroup.style.margin = '0';
        const spLabel = document.createElement('label');
        spLabel.style.fontSize = '0.6rem';
        spLabel.textContent = `Spacing (${state.unit})`;
        const spInput = document.createElement('input');
        spInput.type = 'number';
        spInput.className = 'form-control form-control-sm';
        spInput.id = `input-set-spacing-${idx}`;
        const spacingVal = state.unit === 'cm' ? set.spacing * 100 : set.spacing * 1000;
        spInput.value = spacingVal.toFixed(state.unit === 'cm' ? 1 : 0);
        spInput.min = 5;
        spInput.step = state.unit === 'cm' ? 1 : 10;
        spInput.addEventListener('input', () => {
            let val = parseFloat(spInput.value);
            if (!isNaN(val)) {
                set.spacing = state.unit === 'cm' ? val / 100 : val / 1000;
                calculateAndRender();
            }
        });
        spInput.addEventListener('change', () => {
            let val = parseFloat(spInput.value);
            if (isNaN(val) || val <= 0) val = 20;
            set.spacing = state.unit === 'cm' ? val / 100 : val / 1000;
            spInput.value = val.toFixed(state.unit === 'cm' ? 1 : 0);
            calculateAndRender();
        });
        spGroup.appendChild(spLabel);
        spGroup.appendChild(spInput);
        row2.appendChild(spGroup);

        setDiv.appendChild(row2);

        // Row 3: Offset & Height
        const row3 = document.createElement('div');
        row3.style.display = 'grid';
        row3.style.gridTemplateColumns = '1fr 1fr';
        row3.style.gap = '0.4rem';

        const offGroup = document.createElement('div');
        offGroup.className = 'form-group';
        offGroup.style.margin = '0';
        const offLabel = document.createElement('label');
        offLabel.style.fontSize = '0.6rem';
        offLabel.textContent = `Offset (${state.unit})`;
        const offInput = document.createElement('input');
        offInput.type = 'number';
        offInput.className = 'form-control form-control-sm';
        offInput.id = `input-set-offset-${idx}`;
        const offsetVal = state.unit === 'cm' ? set.offset * 100 : set.offset * 1000;
        offInput.value = offsetVal.toFixed(state.unit === 'cm' ? 1 : 0);
        offInput.min = 0;
        offInput.step = state.unit === 'cm' ? 1 : 10;
        offInput.addEventListener('input', () => {
            let val = parseFloat(offInput.value);
            if (!isNaN(val)) {
                set.offset = state.unit === 'cm' ? val / 100 : val / 1000;
                calculateAndRender();
            }
        });
        offInput.addEventListener('change', () => {
            let val = parseFloat(offInput.value);
            if (isNaN(val) || val < 0) val = 0;
            set.offset = state.unit === 'cm' ? val / 100 : val / 1000;
            offInput.value = val.toFixed(state.unit === 'cm' ? 1 : 0);
            calculateAndRender();
        });
        offGroup.appendChild(offLabel);
        offGroup.appendChild(offInput);
        row3.appendChild(offGroup);

        const hgGroup = document.createElement('div');
        hgGroup.className = 'form-group';
        hgGroup.style.margin = '0';
        const hgLabel = document.createElement('label');
        hgLabel.style.fontSize = '0.6rem';
        hgLabel.textContent = `Height (${state.unit})`;
        const hgInput = document.createElement('input');
        hgInput.type = 'number';
        hgInput.className = 'form-control form-control-sm';
        hgInput.id = `input-set-height-${idx}`;
        const hgVal = fromMm(set.height);
        hgInput.value = hgVal.toFixed(state.unit === 'cm' ? 1 : 0);
        hgInput.min = 0;
        hgInput.max = fromMm(state.slabThickness);
        hgInput.step = state.unit === 'cm' ? 0.5 : 5;
        hgInput.addEventListener('input', () => {
            let val = parseFloat(hgInput.value);
            if (!isNaN(val)) {
                // Do not clamp while typing to prevent divergence between UI and state
                set.height = toMm(val);
                calculateAndRender();
            }
        });
        hgInput.addEventListener('change', () => {
            let val = parseFloat(hgInput.value);
            if (isNaN(val)) val = fromMm(state.slabThickness - state.coverTop - 15);
            const minH = 0;
            const maxH = fromMm(state.slabThickness);
            val = Math.max(minH, Math.min(maxH, val));
            set.height = toMm(val);
            hgInput.value = val.toFixed(state.unit === 'cm' ? 1 : 0);
            calculateAndRender();
        });
        hgGroup.appendChild(hgLabel);
        hgGroup.appendChild(hgInput);
        row3.appendChild(hgGroup);

        setDiv.appendChild(row3);

        container.appendChild(setDiv);
    });
}

// Sync values of perpendicular tendon sets UI inputs with current state variables
function updateSidebarTendonSets() {
    const container = DOM.tendonSetsContainer;
    if (!container) return;

    const numSets = state.elevationTendonSets.length;
    const cards = container.querySelectorAll('.tendon-set-card');
    
    if (cards.length !== numSets) {
        renderSidebarTendonSets();
        return;
    }

    state.elevationTendonSets.forEach((set, idx) => {
        // Sync support dropdown option list if span count changed
        const supSelect = document.getElementById(`input-set-support-${idx}`);
        if (supSelect && document.activeElement !== supSelect) {
            supSelect.innerHTML = '';
            for (let s = 0; s <= state.numSpans; s++) {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = `S${s}`;
                if (set.supportIdx === s) opt.selected = true;
                supSelect.appendChild(opt);
            }
            if (set.supportIdx > state.numSpans) {
                set.supportIdx = state.numSpans;
            }
            supSelect.value = set.supportIdx;
        }

        // Sync direction
        const dirSelect = document.getElementById(`input-set-dir-${idx}`);
        if (dirSelect && document.activeElement !== dirSelect) {
            dirSelect.value = set.direction;
        }

        // Sync count
        const cntInput = document.getElementById(`input-set-count-${idx}`);
        if (cntInput && document.activeElement !== cntInput) {
            cntInput.value = set.count;
        }

        // Sync spacing
        const spInput = document.getElementById(`input-set-spacing-${idx}`);
        if (spInput && document.activeElement !== spInput) {
            const spacingVal = state.unit === 'cm' ? set.spacing * 100 : set.spacing * 1000;
            spInput.value = spacingVal.toFixed(state.unit === 'cm' ? 1 : 0);
            const label = spInput.previousElementSibling;
            if (label) label.textContent = `Spacing (${state.unit})`;
        }

        // Sync offset
        const offInput = document.getElementById(`input-set-offset-${idx}`);
        if (offInput && document.activeElement !== offInput) {
            const offsetVal = state.unit === 'cm' ? set.offset * 100 : set.offset * 1000;
            offInput.value = offsetVal.toFixed(state.unit === 'cm' ? 1 : 0);
            const label = offInput.previousElementSibling;
            if (label) label.textContent = `Offset (${state.unit})`;
        }

        // Sync height
        const hgInput = document.getElementById(`input-set-height-${idx}`);
        if (hgInput && document.activeElement !== hgInput) {
            const hgVal = fromMm(set.height);
            hgInput.value = hgVal.toFixed(state.unit === 'cm' ? 1 : 0);
            hgInput.min = 0;
            hgInput.max = fromMm(state.slabThickness);
            const label = hgInput.previousElementSibling;
            if (label) label.textContent = `Height (${state.unit})`;
        }
    });
}

// Render Plan-view parameter inputs dynamically in the sidebar
function renderSidebarPlanInputs() {
    const yTendonsContainer = document.getElementById('plan-y-tendons-container');
    const columnsContainer = document.getElementById('plan-columns-container');
    if (yTendonsContainer) {
        yTendonsContainer.style.display = 'none';
        yTendonsContainer.innerHTML = '';
    }
    if (!columnsContainer) return;

    // 2. Render Column Inputs
    columnsContainer.innerHTML = '';
    
    // Add Header Row
    const headerRow = document.createElement('div');
    headerRow.style.display = 'grid';
    headerRow.style.gridTemplateColumns = '50px 1fr 1fr';
    headerRow.style.gap = '0.4rem';
    headerRow.style.fontSize = '0.7rem';
    headerRow.style.fontWeight = '700';
    headerRow.style.color = 'var(--text-secondary)';
    headerRow.style.textTransform = 'uppercase';
    headerRow.style.letterSpacing = '0.05em';
    headerRow.style.marginBottom = '0.4rem';
    headerRow.style.borderBottom = '1px solid var(--border-color)';
    headerRow.style.paddingBottom = '0.25rem';
    
    const labelHeader = document.createElement('div');
    labelHeader.textContent = 'Col';
    
    const xHeader = document.createElement('div');
    xHeader.textContent = 'X (m)';
    
    const yHeader = document.createElement('div');
    yHeader.textContent = 'Y (m)';
    
    headerRow.appendChild(labelHeader);
    headerRow.appendChild(xHeader);
    headerRow.appendChild(yHeader);
    columnsContainer.appendChild(headerRow);

    // Group columns by row index
    const columnsByRow = {};
    state.planColumns.forEach((col) => {
        const rowIdx = parseInt(col.id.split('-')[2].replace('row', ''));
        if (!columnsByRow[rowIdx]) {
            columnsByRow[rowIdx] = [];
        }
        columnsByRow[rowIdx].push(col);
    });

    // Render grouped columns
    Object.keys(columnsByRow).sort((a, b) => a - b).forEach((rowKey) => {
        const rowIdx = parseInt(rowKey);
        
        // Add a row separator/label
        const groupHeader = document.createElement('div');
        groupHeader.style.fontSize = '0.75rem';
        groupHeader.style.fontWeight = '700';
        groupHeader.style.color = 'var(--color-primary-light)';
        groupHeader.style.marginTop = '0.8rem';
        groupHeader.style.marginBottom = '0.4rem';
        groupHeader.style.display = 'flex';
        groupHeader.style.alignItems = 'center';
        groupHeader.style.gap = '0.5rem';
        
        const groupTitle = document.createElement('span');
        groupTitle.textContent = `Grid Line ${rowIdx + 1}`;
        
        const groupLine = document.createElement('span');
        groupLine.style.flex = '1';
        groupLine.style.borderBottom = '1px dashed var(--border-color)';
        groupLine.style.opacity = '0.4';
        
        groupHeader.appendChild(groupTitle);
        groupHeader.appendChild(groupLine);
        columnsContainer.appendChild(groupHeader);
        
        columnsByRow[rowKey].forEach((col) => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '50px 1fr 1fr';
            row.style.gap = '0.4rem';
            row.style.alignItems = 'center';
            row.style.marginBottom = '0.25rem';
            
            const label = document.createElement('div');
            label.style.fontSize = '0.7rem';
            label.style.fontWeight = '600';
            label.style.color = 'var(--text-primary)';
            
            const suppIdx = parseInt(col.id.split('-')[1]);
            const prefix = getColumnPrefix(suppIdx, state.numSpans + 1);
            label.textContent = `${prefix}${rowIdx + 1}`;
            
            const xInput = document.createElement('input');
            xInput.type = 'number';
            xInput.className = 'form-control form-control-sm';
            xInput.id = `input-col-x-${col.id}`;
            xInput.value = col.x.toFixed(2);
            xInput.step = '0.1';
            xInput.placeholder = 'X';
            xInput.addEventListener('change', () => {
                const totalL = state.spanLengths.reduce((a, b) => a + b, 0);
                let val = parseFloat(xInput.value) || 0;
                val = Math.max(0, Math.min(totalL, val));
                col.x = val;
                xInput.value = val.toFixed(2);
                calculateAndRender();
            });
            
            const yInput = document.createElement('input');
            yInput.type = 'number';
            yInput.className = 'form-control form-control-sm';
            yInput.id = `input-col-y-${col.id}`;
            yInput.value = col.y.toFixed(2);
            yInput.step = '0.1';
            yInput.placeholder = 'Y';
            yInput.addEventListener('change', () => {
                const totalW = state.slabWidth;
                let val = parseFloat(yInput.value) || 0;
                val = Math.max(0, Math.min(totalW, val));
                col.y = val;
                yInput.value = val.toFixed(2);
                calculateAndRender();
            });
            
            row.appendChild(label);
            row.appendChild(xInput);
            row.appendChild(yInput);
            columnsContainer.appendChild(row);
        });
    });
}

// Calculate plan layout X-tendon positions based on spacing or custom input
function updatePlanXTendons() {
    const modeSelect = document.getElementById('plan-x-tendons-mode');
    const spacingInput = document.getElementById('input-plan-x-spacing');
    const xInput = document.getElementById('input-plan-x-tendons');
    
    if (modeSelect) {
        state.planXTendonsMode = modeSelect.value;
    }
    
    if (state.planXTendonsMode === 'spacing') {
        if (spacingInput) {
            state.planXTendonsSpacing = parseFloat(spacingInput.value) || 1.5;
        }
        const spacing = state.planXTendonsSpacing;
        const totalW = state.slabWidth;
        const list = [];
        for (let y = spacing; y < totalW - 0.0001; y += spacing) {
            list.push(parseFloat(y.toFixed(2)));
        }
        state.planXTendons = list;
    } else {
        if (xInput) {
            const vals = xInput.value.split(',')
                .map(v => parseFloat(v.trim()))
                .filter(v => !isNaN(v) && v >= 0 && v <= state.slabWidth);
            state.planXTendons = vals.sort((a, b) => a - b);
        }
    }
}

// Sync values of Plan Layout UI inputs with current state variables
function updateSidebarPlanInputs() {
    const modeSelect = document.getElementById('plan-x-tendons-mode');
    const spacingInput = document.getElementById('input-plan-x-spacing');
    const xInput = document.getElementById('input-plan-x-tendons');
    const spacingGroup = document.getElementById('group-plan-x-spacing');
    const positionsGroup = document.getElementById('group-plan-x-positions');

    if (modeSelect) modeSelect.value = state.planXTendonsMode;
    if (spacingInput && document.activeElement !== spacingInput) {
        spacingInput.value = state.planXTendonsSpacing;
    }
    
    if (state.planXTendonsMode === 'spacing') {
        if (spacingGroup) spacingGroup.style.display = 'block';
        if (positionsGroup) positionsGroup.style.display = 'none';
    } else {
        if (spacingGroup) spacingGroup.style.display = 'none';
        if (positionsGroup) positionsGroup.style.display = 'block';
    }

    if (xInput && document.activeElement !== xInput) {
        xInput.value = state.planXTendons.join(', ');
    }

    const yTendonsContainer = document.getElementById('plan-y-tendons-container');
    if (yTendonsContainer) {
        yTendonsContainer.style.display = 'none';
    }
    
    const columnsContainer = document.getElementById('plan-columns-container');
    const expectedColInputCount = state.planColumns.length;
    const currentColInputCount = columnsContainer ? columnsContainer.querySelectorAll('input').length / 2 : 0;

    if (expectedColInputCount !== currentColInputCount) {
        renderSidebarPlanInputs();
    } else {
        state.planColumns.forEach(col => {
            const xIn = document.getElementById(`input-col-x-${col.id}`);
            if (xIn && document.activeElement !== xIn) {
                xIn.value = col.x.toFixed(2);
            }
            const yIn = document.getElementById(`input-col-y-${col.id}`);
            if (yIn && document.activeElement !== yIn) {
                yIn.value = col.y.toFixed(2);
            }
        });
    }
}

// GUI Event Listeners Setup
function setupEventListeners() {
    // Measurement Unit Selection
    DOM.unitSelect.addEventListener('change', () => {
        state.unit = DOM.unitSelect.value;
        updateInputUnitBounds();
        syncStateToInputs();
        calculateAndRender();
    });

    // Parameter Inputs
    const inputs = [
        DOM.numSpans, DOM.numColRowsPlan, DOM.numColRowsElev, DOM.slabThickness, DOM.slabWidth, DOM.spanYLen, DOM.concreteDensity,
        DOM.span1Len, DOM.span2Len, DOM.span3Len,
        DOM.coverTop, DOM.coverBottom, DOM.inflectionRatio,
        DOM.tendonForce, DOM.tendonForceY, DOM.jackingEnd, DOM.frictionMu, DOM.frictionK,
        DOM.anchorSet, DOM.tendonSpacingX, DOM.tendonSpacingY, DOM.verticalExaggeration,
        DOM.minSupportAngle, DOM.maxSupportAngle, DOM.numTendonSets, DOM.ductDiameter
    ].filter(Boolean);
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            syncInputsToState();
            calculateAndRender();
        });
        input.addEventListener('change', () => {
            syncInputsToState();
            calculateAndRender();
        });
        input.addEventListener('blur', () => {
            syncStateToInputs();
        });
    });

    // Reset button
    DOM.btnReset.addEventListener('click', () => {
        resetDesign();
        calculateAndRender();
    });

    // Export CSV (header toolbar + in-card table button)
    DOM.btnExportCsv.addEventListener('click', exportCSV);
    const btnExportCsvTable = document.getElementById('btn-export-csv-table');
    if (btnExportCsvTable) btnExportCsvTable.addEventListener('click', exportCSV);

    // In-card AutoCAD export button (opens modal)
    const btnExportAutocadTable = document.getElementById('btn-export-autocad-table');
    if (btnExportAutocadTable) {
        btnExportAutocadTable.addEventListener('click', () => {
            if (DOM.autocadModal) DOM.autocadModal.classList.remove('hidden');
        });
    }

    // Table Increment Selector
    const tableIncrementEl = document.getElementById('table-increment');
    if (tableIncrementEl) {
        tableIncrementEl.addEventListener('change', () => {
            calculateAndRender();
        });
    }

    // Custom Plan View Tendons configuration
    const planXTendonsInput = document.getElementById('input-plan-x-tendons');
    if (planXTendonsInput) {
        planXTendonsInput.addEventListener('change', () => {
            updatePlanXTendons();
            updateSidebarPlanInputs();
            calculateAndRender();
        });
    }

    const planXTendonsMode = document.getElementById('plan-x-tendons-mode');
    if (planXTendonsMode) {
        planXTendonsMode.addEventListener('change', () => {
            updatePlanXTendons();
            updateSidebarPlanInputs();
            calculateAndRender();
        });
    }

    const planXSpacingInput = document.getElementById('input-plan-x-spacing');
    if (planXSpacingInput) {
        planXSpacingInput.addEventListener('input', () => {
            updatePlanXTendons();
            updateSidebarPlanInputs();
            calculateAndRender();
        });
        planXSpacingInput.addEventListener('change', () => {
            updatePlanXTendons();
            updateSidebarPlanInputs();
            calculateAndRender();
        });
    }

    // Sidebar Toggle & Collapse
    function toggleSidebar() {
        const container = document.querySelector('.app-container');
        if (container) {
            container.classList.toggle('sidebar-collapsed');
            
            // Dispatch resize event to force canvas/SVG recalculation in the newly scaled space
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 310);
        }
    }

    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }

    const maximizeViewBtn = document.getElementById('btn-maximize-view');
    if (maximizeViewBtn) {
        maximizeViewBtn.addEventListener('click', toggleSidebar);
    }

    // Sidebar Resize Dragger
    const resizeHandle = document.getElementById('sidebar-resize-handle');
    const parametersPanel = document.querySelector('.parameters-panel');
    const appContainer = document.querySelector('.app-container');

    if (resizeHandle && parametersPanel && appContainer) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', (e) => {
            if (appContainer.classList.contains('sidebar-collapsed')) return;

            isResizing = true;
            startX = e.clientX;
            startWidth = parametersPanel.offsetWidth;

            resizeHandle.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const dx = e.clientX - startX;
            let newWidth = startWidth + dx;

            // Clamp between 240px and 600px
            newWidth = Math.max(240, Math.min(600, newWidth));

            // Update parameters-panel width and CSS custom property
            parametersPanel.style.width = `${newWidth}px`;
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);

            // Instantly trigger resize event to re-draw canvas/charts
            window.dispatchEvent(new Event('resize'));
        });

        window.addEventListener('mouseup', () => {
            if (!isResizing) return;
            isResizing = false;
            resizeHandle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });

        // Double-click to reset sidebar width to default 320px
        resizeHandle.addEventListener('dblclick', () => {
            if (appContainer.classList.contains('sidebar-collapsed')) return;
            parametersPanel.style.width = '320px';
            document.documentElement.style.setProperty('--sidebar-width', '320px');
            window.dispatchEvent(new Event('resize'));
        });
    }

    // Collapsible Dashboard Cards
    document.querySelectorAll('.btn-card-collapse').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const card = btn.closest('.display-card');
            if (card) {
                card.classList.toggle('card-collapsed');
                
                // If it's the chart card or visualizer card, trigger resize to re-scale drawing areas
                if (card.classList.contains('chart-card') || card.classList.contains('visualizer-card')) {
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 100);
                }
            }
        });
    });

    // --- Req 4: Friction Loss Chart - Collapse by default, auto-expand on param change ---
    const frictionChartCard = document.querySelector('.chart-card');
    if (frictionChartCard) {
        // Start collapsed
        frictionChartCard.classList.add('card-collapsed');

        // Auto-expand when friction/force parameters change
        const frictionTriggerIds = [
            'friction-mu', 'friction-k', 'anchor-set', 'jacking-end',
            'tendon-force', 'tendon-force-y', 'num-spans',
            'span-1-len', 'span-2-len', 'span-3-len'
        ];
        frictionTriggerIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (frictionChartCard.classList.contains('card-collapsed')) {
                        frictionChartCard.classList.remove('card-collapsed');
                        frictionChartCard.classList.add('friction-auto-expanded');
                        setTimeout(() => frictionChartCard.classList.remove('friction-auto-expanded'), 3500);
                    }
                });
            }
        });
    }

    // --- Req 1: Parameter Help Modal ---
    const paramHelpModal = document.getElementById('param-help-modal');
    const btnCloseParamHelp = document.getElementById('btn-close-param-help');
    if (btnCloseParamHelp && paramHelpModal) {
        btnCloseParamHelp.addEventListener('click', () => paramHelpModal.classList.add('hidden'));
        paramHelpModal.addEventListener('click', (e) => {
            if (e.target === paramHelpModal) paramHelpModal.classList.add('hidden');
        });
    }

    // Wire up all (?) help buttons
    document.querySelectorAll('.btn-param-help').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.helpKey;
            showParamHelp(key);
        });
    });

    // Export SVG
    DOM.btnExportSvg.addEventListener('click', exportSVG);

    // AutoCAD Export Modal triggers
    if (DOM.btnExportAutocad && DOM.autocadModal) {
        const formatSelect = document.getElementById('cad-file-format');
        const viewSelect = document.getElementById('cad-export-type');

        const updateCopyButtonVisibility = () => {
            if (!formatSelect) return;
            const format = formatSelect.value;
            const viewType = viewSelect ? viewSelect.value : 'elevation';

            if (format === 'tfd' || format === 'lsp') {
                if (DOM.btnCopyCadCoords) DOM.btnCopyCadCoords.classList.add('hidden');
                if (DOM.btnCopyLispData) DOM.btnCopyLispData.classList.remove('hidden');
            } else {
                if (DOM.btnCopyCadCoords) DOM.btnCopyCadCoords.classList.remove('hidden');
                if (DOM.btnCopyLispData) DOM.btnCopyLispData.classList.add('hidden');
            }

            if (DOM.cadCommandHelp) {
                let helpText = '';
                if (format === 'dxf') {
                    helpText = `<strong>Native DXF format</strong>: Open the downloaded <code>.dxf</code> file directly in AutoCAD using the <strong><code>OPEN</code></strong> command. Drawing elements, layers, and scaling are configured automatically.`;
                } else if (format === 'scr') {
                    helpText = `<strong>AutoCAD Script</strong>: Run the downloaded <code>.scr</code> file in AutoCAD by typing <strong><code>SCRIPT</code></strong> in the command line and selecting the file. Ensure you are in a clean drawing and dynamic input is turned off.`;
                } else if (format === 'lsp') {
                    helpText = `<strong>LISP Loader Script</strong>: Load the downloaded loader file in AutoCAD once (using <strong><code>APPLOAD</code></strong> or drag-and-drop). This defines the commands:
                    <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.75rem; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1);">
                      <thead>
                        <tr style="background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">
                          <th style="padding: 6px; font-weight: 600;">Command</th>
                          <th style="padding: 6px; font-weight: 600;">Drawing View</th>
                          <th style="padding: 6px; font-weight: 600;">Input Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                          <td style="padding: 6px; font-family: monospace; color: #60a5fa; font-weight: 600;">DRAWELEVC</td>
                          <td style="padding: 6px;">Elevation Profile</td>
                          <td style="padding: 6px;">Clipboard data</td>
                        </tr>
                        <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                          <td style="padding: 6px; font-family: monospace; color: #60a5fa; font-weight: 600;">DRAWELEVF</td>
                          <td style="padding: 6px;">Elevation Profile</td>
                          <td style="padding: 6px;">Data File (.tfd)</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                          <td style="padding: 6px; font-family: monospace; color: #60a5fa; font-weight: 600;">DRAWPLANC</td>
                          <td style="padding: 6px;">2D Plan Layout</td>
                          <td style="padding: 6px;">Clipboard data</td>
                        </tr>
                        <tr style="background: rgba(255,255,255,0.02);">
                          <td style="padding: 6px; font-family: monospace; color: #60a5fa; font-weight: 600;">DRAWPLANF</td>
                          <td style="padding: 6px;">2D Plan Layout</td>
                          <td style="padding: 6px;">Data File (.tfd)</td>
                        </tr>
                      </tbody>
                    </table>`;
                } else if (format === 'tfd') {
                    const activeCmd = viewType === 'elevation' ? 'DRAWELEVF' : 'DRAWPLANF';
                    const activeClipCmd = viewType === 'elevation' ? 'DRAWELEVC' : 'DRAWPLANC';
                    helpText = `<strong>TFD Data File (${viewType === 'elevation' ? 'Elevation' : 'Plan'} View)</strong>:<br>
                    1. <strong>Clipboard Workflow</strong>: Click <strong>Copy LISP Data</strong>, paste (<code>Ctrl+V</code>) in the AutoCAD command prompt, then run <strong><code>${activeClipCmd}</code></strong>.<br>
                    2. <strong>File Workflow</strong>: Click <strong>Download File</strong>, run <strong><code>${activeCmd}</code></strong> in AutoCAD, and select the downloaded file.<br>
                    <span style="font-size: 0.75rem; color: #94a3b8; display: block; margin-top: 6px;">Note: Make sure the LISP Loader (<code>TendonFlowDraw.lsp</code>) is loaded in AutoCAD first using the <code>APPLOAD</code> command.</span>`;
                }
                DOM.cadCommandHelp.innerHTML = helpText;
            }
        };

        DOM.btnExportAutocad.addEventListener('click', () => {
            DOM.autocadModal.classList.remove('hidden');
            updateCopyButtonVisibility();
        });

        DOM.btnCloseModal.addEventListener('click', () => {
            DOM.autocadModal.classList.add('hidden');
        });

        DOM.btnCancelExport.addEventListener('click', () => {
            DOM.autocadModal.classList.add('hidden');
        });

        DOM.autocadModal.addEventListener('click', (e) => {
            if (e.target === DOM.autocadModal) {
                DOM.autocadModal.classList.add('hidden');
            }
        });

        DOM.btnConfirmExport.addEventListener('click', () => {
            const format = formatSelect ? formatSelect.value : 'dxf';
            if (format === 'dxf') {
                exportDXF();
            } else if (format === 'lsp') {
                exportLISP();
            } else if (format === 'tfd') {
                exportTFD();
            } else {
                exportAutoCADScript();
            }
            DOM.autocadModal.classList.add('hidden');
        });

        if (DOM.btnCopyCadCoords) {
            DOM.btnCopyCadCoords.addEventListener('click', () => {
                copyCADCoordinatesToClipboard();
            });
        }

        if (DOM.btnCopyLispData) {
            DOM.btnCopyLispData.addEventListener('click', () => {
                copyLispDataToClipboard();
            });
        }

        if (DOM.lnkDownloadLsp) {
            DOM.lnkDownloadLsp.addEventListener('click', (e) => {
                e.preventDefault();
                exportLISP();
            });
        }

        if (formatSelect) {
            formatSelect.addEventListener('change', updateCopyButtonVisibility);
        }
        if (viewSelect) {
            viewSelect.addEventListener('change', updateCopyButtonVisibility);
        }
        updateCopyButtonVisibility();
    }

    // Save/Load JSON configurations
    DOM.btnSaveJson.addEventListener('click', exportJSON);
    DOM.btnLoadJson.addEventListener('click', () => DOM.inputLoadJson.click());
    DOM.inputLoadJson.addEventListener('change', importJSON);

    // Redraw chart when window resizes (keeps canvas scale sharp)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            renderLossChart();
        }, 100);
    });

    // Tab switching event listeners
    if (DOM.tabElevation) {
        DOM.tabElevation.addEventListener('click', () => {
            state.activeTab = 'elevation';
            calculateAndRender();
        });
    }
    if (DOM.tabPlan) {
        DOM.tabPlan.addEventListener('click', () => {
            state.activeTab = 'plan';
            calculateAndRender();
        });
    }
    if (DOM.tabSplit) {
        DOM.tabSplit.addEventListener('click', () => {
            state.activeTab = 'split';
            calculateAndRender();
        });
    }

    // Tendon Profile Copy/Paste Listeners
    if (DOM.btnCopyProfile) {
        DOM.btnCopyProfile.addEventListener('click', (e) => {
            e.preventDefault();
            state.clipboardControlPoints = JSON.parse(JSON.stringify(state.controlPoints));
            syncStateToInputs();
        });
    }

    if (DOM.btnPasteProfile) {
        DOM.btnPasteProfile.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.clipboardControlPoints) {
                const src = state.clipboardControlPoints;
                const dest = state.controlPoints;
                
                // Copy supports
                const minSupports = Math.min(src.supports.length, dest.supports.length);
                for (let i = 0; i < minSupports; i++) {
                    dest.supports[i] = src.supports[i];
                    if (src.supportsLocked && src.supportsLocked[i] !== undefined) {
                        dest.supportsLocked[i] = src.supportsLocked[i];
                    }
                }
                
                // Copy low points
                const minLowPoints = Math.min(src.lowPoints.length, dest.lowPoints.length);
                for (let i = 0; i < minLowPoints; i++) {
                    dest.lowPoints[i].y = src.lowPoints[i].y;
                    dest.lowPoints[i].xFract = src.lowPoints[i].xFract;
                    if (src.lowPointsLocked && src.lowPointsLocked[i] !== undefined) {
                        dest.lowPointsLocked[i] = src.lowPointsLocked[i];
                    }
                }
                
                calculateAndRender();
            }
        });
    }
}

// Export Coordinates Table as CSV
function exportCSV() {
    const header = ['Span', 'x from Left (m)', 'x Local (m)', `y Coordinate ${getBracketedUnit()}`, 'Tendon Force (kN)', 'Slope (rad)', 'Equivalent Load (kN/m)'];
    let csvContent = header.join(',') + '\n';
    
    const rows = DOM.coordsTable.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
        csvContent += cells.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'pt_tendon_profile.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export SVG Layout Diagram
function exportSVG() {
    // Clone profile SVG
    const svgClone = DOM.profileSvg.cloneNode(true);
    
    // Add inline styling from styles.css since exported SVGs don't load external sheets
    // This embeds styling details so the CAD/diagram looks perfect when opened standalone
    const styles = `
        svg { background-color: #080c14; font-family: 'Plus Jakarta Sans', sans-serif; }
        .svg-slab-concrete { fill: #111827; stroke: #374151; stroke-width: 1.5px; }
        .svg-slab-limit-line { stroke: #ef4444; stroke-width: 1px; stroke-dasharray: 4,4; opacity: 0.35; }
        .svg-support-column { fill: #1e293b; stroke: #475569; stroke-width: 1.5px; }
        .svg-tendon-line { stroke: #38bdf8; stroke-width: 3px; fill: none; }
        .svg-tendon-line-warning { stroke: #ef4444; stroke-width: 3px; fill: none; }
        .svg-drag-node { fill: #1a2333; stroke: #38bdf8; stroke-width: 2.5px; }
        .svg-drag-node-warning { stroke: #ef4444; }
        .svg-dimension-line { stroke: #6b7280; stroke-width: 1px; stroke-dasharray: 2,2; }
        .svg-dimension-text { fill: #9ca3af; font-size: 10px; font-family: monospace; text-anchor: middle; }
        .svg-axis-label { fill: #6b7280; font-size: 9px; font-family: monospace; text-anchor: middle; }
    `;
    
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = styles;
    svgClone.insertBefore(styleEl, svgClone.firstChild);
    
    // Serialize
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgClone);
    
    // Add namespaces if missing
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'pt_tendon_profile.svg');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// AutoCAD Script (.SCR) Export
function exportAutoCADScript() {
    const viewType = document.getElementById('cad-export-type').value;
    const cadUnit = document.getElementById('cad-unit').value;
    const vExag = parseFloat(document.getElementById('cad-exag').value);
    const drawMethod = document.getElementById('cad-draw-method').value;
    const includeText = document.getElementById('cad-include-text').checked;

    let scale = 1000; // millimeters
    if (cadUnit === 'cm') scale = 100;
    if (cadUnit === 'm') scale = 1;

    let scrContent = '';

    // Standard variable configuration using SETVAR
    scrContent += `SETVAR CMDECHO 0\n`;
    scrContent += `SETVAR OSMODE 0\n`;

    // Unified Layer Creation Command
    let layersCmd = "_-LAYER\n";
    layersCmd += "M\nTF_Slab\nC\n8\nTF_Slab\n";
    layersCmd += "M\nTF_Tendon\nC\n4\nTF_Tendon\n";
    if (viewType === 'elevation') {
        layersCmd += "M\nTF_Duct\nC\n141\nTF_Duct\n";
        layersCmd += "M\nTF_Limits\nC\n1\nTF_Limits\n";
        layersCmd += "M\nTF_Tendon_Perp\nC\n3\nTF_Tendon_Perp\n"; // 3 = Green for perpendicular tendons
    }
    layersCmd += "M\nTF_Columns\nC\n9\nTF_Columns\n";
    layersCmd += "M\nTF_Text\nC\n2\nTF_Text\n\n"; // Exit layer command
    scrContent += layersCmd;

    if (viewType === 'elevation') {
        scrContent += generateElevationScript(scale, vExag, drawMethod, includeText);
    } else {
        scrContent += generatePlanScript(scale, includeText);
    }

    // Restore environment
    scrContent += `SETVAR CMDECHO 1\n`;
    scrContent += `SETVAR OSMODE 16383\n`;
    scrContent += `_ZOOM\n_E\n`;

    const blob = new Blob([scrContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tendonflow_pt_${viewType}_${cadUnit}.scr`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateElevationScript(scale, vExag, drawMethod, includeText) {
    let scr = '';
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const hSlab = state.slabThickness; 
    
    const L_cad = totalLength * scale;
    const h_cad = (hSlab / 1000) * scale * vExag;

    // Slab outline
    scr += `CLAYER\nTF_Slab\n`;
    scr += `_LINE\n0,0\n${L_cad},0\n\n`;
    scr += `_LINE\n0,${h_cad}\n${L_cad},${h_cad}\n\n`;
    scr += `_LINE\n0,0\n0,${h_cad}\n\n`;
    scr += `_LINE\n${L_cad},0\n${L_cad},${h_cad}\n\n`;
    
    // Neutral axis
    const na_y_cad = (hSlab / 2 / 1000) * scale * vExag;
    scr += `_LINE\n0,${na_y_cad}\n${L_cad},${na_y_cad}\n\n`;

    // Columns
    scr += `CLAYER\nTF_Columns\n`;
    let currentX = 0;
    const colWidth = 0.4 * scale;
    const colHeight = 1.5 * scale;

    for (let i = 0; i <= state.numSpans; i++) {
        if (i > 0) currentX += state.spanLengths[i - 1];
        const x_cad = currentX * scale;
        scr += `_LINE\n${x_cad - colWidth/2},${-colHeight}\n${x_cad - colWidth/2},0\n\n`;
        scr += `_LINE\n${x_cad + colWidth/2},${-colHeight}\n${x_cad + colWidth/2},0\n\n`;
        scr += `_LINE\n${x_cad - colWidth/2},${-colHeight}\n${x_cad + colWidth/2},${-colHeight}\n\n`;
    }

    // Cover Limits
    scr += `CLAYER\nTF_Limits\n`;
    const coverTop_cad = (state.coverTop / 1000) * scale * vExag;
    const coverBottom_cad = (state.coverBottom / 1000) * scale * vExag;
    scr += `_LINE\n0,${h_cad - coverTop_cad}\n${L_cad},${h_cad - coverTop_cad}\n\n`;
    scr += `_LINE\n0,${coverBottom_cad}\n${L_cad},${coverBottom_cad}\n\n`;

    // Tendon curve
    scr += `CLAYER\nTF_Tendon\n`;
    const points = state.sampledPoints;
    if (points && points.length > 0) {
        if (drawMethod === 'spline') {
            scr += `_SPLINE\n`;
            points.forEach(pt => {
                const x_cad = pt.xGlobal * scale;
                const y_cad = (pt.y / 1000) * scale * vExag;
                scr += `${x_cad.toFixed(4)},${y_cad.toFixed(4)}\n`;
            });
            scr += `\n\n\n`; // End spline
        } else {
            scr += `_PLINE\n`;
            points.forEach(pt => {
                const x_cad = pt.xGlobal * scale;
                const y_cad = (pt.y / 1000) * scale * vExag;
                scr += `${x_cad.toFixed(4)},${y_cad.toFixed(4)}\n`;
            });
            scr += `\n`; // End pline
        }
        
        // Duct Envelope (Matches drawMethod: spline vs pline)
        scr += `CLAYER\nTF_Duct\n`;
        if (drawMethod === 'spline') {
            scr += `_SPLINE\n`;
            points.forEach(pt => {
                const x_cad = pt.xGlobal * scale;
                const y_top_cad = ((pt.y + state.ductDiameter / 2) / 1000) * scale * vExag;
                scr += `${x_cad.toFixed(4)},${y_top_cad.toFixed(4)}\n`;
            });
            scr += `\n\n\n`;

            scr += `_SPLINE\n`;
            points.forEach(pt => {
                const x_cad = pt.xGlobal * scale;
                const y_bot_cad = ((pt.y - state.ductDiameter / 2) / 1000) * scale * vExag;
                scr += `${x_cad.toFixed(4)},${y_bot_cad.toFixed(4)}\n`;
            });
            scr += `\n\n\n`;
        } else {
            scr += `_PLINE\n`;
            points.forEach(pt => {
                const x_cad = pt.xGlobal * scale;
                const y_top_cad = ((pt.y + state.ductDiameter / 2) / 1000) * scale * vExag;
                scr += `${x_cad.toFixed(4)},${y_top_cad.toFixed(4)}\n`;
            });
            scr += `\n`;

            scr += `_PLINE\n`;
            points.forEach(pt => {
                const x_cad = pt.xGlobal * scale;
                const y_bot_cad = ((pt.y - state.ductDiameter / 2) / 1000) * scale * vExag;
                scr += `${x_cad.toFixed(4)},${y_bot_cad.toFixed(4)}\n`;
            });
            scr += `\n`;
        }
    }

    // Perpendicular Tendon Cross-Sections (Circles/Ellipses)
    const activePerpTendons = getActivePerpendicularTendons();
    if (activePerpTendons && activePerpTendons.length > 0) {
        scr += `CLAYER\nTF_Tendon_Perp\n`;
        activePerpTendons.forEach(pt => {
            const cx = pt.x * scale;
            const cy = (pt.y / 1000) * scale * vExag;
            const rx = (state.ductDiameter / 2) / 1000 * scale;
            const ry = rx * vExag;

            if (vExag === 1) {
                // Circular cross section at true scale
                scr += `_CIRCLE\n${cx.toFixed(4)},${cy.toFixed(4)}\n${rx.toFixed(4)}\n`;
            } else {
                // Elliptical cross section to account for vertical exaggeration stretch
                scr += `_ELLIPSE\n_C\n${cx.toFixed(4)},${cy.toFixed(4)}\n${(cx + rx).toFixed(4)},${cy.toFixed(4)}\n${ry.toFixed(4)}\n`;
            }
        });
    }

    // Annotations (underscores/no spaces to prevent command interrupts)
    if (includeText) {
        scr += `CLAYER\nTF_Text\n`;
        const textHeight = (hSlab / 1000) * scale * 0.15;

        let runX = 0;
        for (let i = 0; i <= state.numSpans; i++) {
            if (i > 0) runX += state.spanLengths[i - 1];
            const x_cad = runX * scale;
            const y_val_mm = state.controlPoints.supports[i];
            const y_cad = (y_val_mm / 1000) * scale * vExag;
            
            const valStr = state.unit === 'cm' ? (y_val_mm / 10).toFixed(1) : y_val_mm.toFixed(0);

            scr += `_TEXT\n`;
            scr += `J\nC\n`;
            scr += `${x_cad.toFixed(2)},${(y_cad + textHeight * 1.5).toFixed(2)}\n`;
            scr += `${textHeight.toFixed(2)}\n`;
            scr += `0\n`;
            scr += `Peak:${valStr}${state.unit}\n`;
        }

        let spanStartX = 0;
        for (let i = 0; i < state.numSpans; i++) {
            const spanLen = state.spanLengths[i];
            const lp = state.controlPoints.lowPoints[i];
            const x_cad = (spanStartX + lp.xFract * spanLen) * scale;
            const y_val_mm = lp.y;
            const y_cad = (y_val_mm / 1000) * scale * vExag;

            const valStr = state.unit === 'cm' ? (y_val_mm / 10).toFixed(1) : y_val_mm.toFixed(0);

            scr += `_TEXT\n`;
            scr += `J\nC\n`;
            scr += `${x_cad.toFixed(2)},${(y_cad - textHeight * 2.2).toFixed(2)}\n`;
            scr += `${textHeight.toFixed(2)}\n`;
            scr += `0\n`;
            scr += `Low:${valStr}${state.unit}\n`;

            spanStartX += spanLen;
        }

        const infoX = 0;
        const infoY = h_cad + textHeight * 4.0;
        
        scr += `_TEXT\n${infoX},${infoY}\n${textHeight * 1.3}\n0\nPOST-TENSIONED_TENDON_PROFILE\n`;
        scr += `_TEXT\n${infoX},${infoY - textHeight * 1.8}\n${textHeight}\n0\nSlab_Thickness:${fromMm(state.slabThickness).toFixed(1)}${state.unit}_Spans:${state.numSpans}\n`;
    }

    return scr;
}

function generatePlanScript(scale, includeText) {
    let scr = '';
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const totalWidth = state.slabWidth;

    const L_cad = totalLength * scale;
    const W_cad = totalWidth * scale;

    scr += `CLAYER\nTF_Slab\n`;
    scr += `_RECTANG\n0,0\n${L_cad},${W_cad}\n`;

    scr += `CLAYER\nTF_Columns\n`;
    const colSize = 0.4 * scale;

    if (state.planColumns) {
        state.planColumns.forEach(c => {
            if (c.enabled) {
                const cx = c.x * scale;
                const cy = c.y * scale;
                scr += `_RECTANG\n${cx - colSize/2},${cy - colSize/2}\n${cx + colSize/2},${cy + colSize/2}\n`;
            }
        });
    }

    scr += `CLAYER\nTF_Tendon\n`;
    if (state.planXTendons) {
        state.planXTendons.forEach(y => {
            if (y >= 0 && y <= totalWidth) {
                const y_cad = y * scale;
                scr += `_LINE\n0,${y_cad}\n${L_cad},${y_cad}\n\n`;
            }
        });
    }

    const activePerpTendons = getActivePerpendicularTendons();
    if (activePerpTendons) {
        activePerpTendons.forEach(pt => {
            const x_cad = pt.x * scale;
            scr += `_LINE\n${x_cad},0\n${x_cad},${W_cad}\n\n`;
        });
    }

    if (includeText) {
        scr += `CLAYER\nTF_Text\n`;
        const textHeight = 0.2 * scale; 

        scr += `_TEXT\n0,${W_cad + textHeight * 2}\n${textHeight * 1.5}\n0\nPOST-TENSIONED_SLAB_2D_PLAN_LAYOUT\n`;
        scr += `_TEXT\nJ\nC\n${L_cad / 2},${-textHeight * 2}\n${textHeight}\n0\nSLAB_LENGTH:${totalLength.toFixed(1)}m\n`;
        scr += `_TEXT\nJ\nC\n${-textHeight * 2},${W_cad / 2}\n${textHeight}\n90\nSLAB_WIDTH:${totalWidth.toFixed(1)}m\n`;
    }

    return scr;
}

// Copy coordinates list to clipboard for PLINE/SPLINE pasting
function copyCADCoordinatesToClipboard() {
    const cadUnit = document.getElementById('cad-unit').value;
    const vExag = parseFloat(document.getElementById('cad-exag').value);
    
    let scale = 1000;
    if (cadUnit === 'cm') scale = 100;
    if (cadUnit === 'm') scale = 1;

    const points = state.sampledPoints;
    if (!points || points.length === 0) return;

    let coordsStr = '';
    points.forEach((pt, idx) => {
        const x_cad = pt.xGlobal * scale;
        const y_cad = (pt.y / 1000) * scale * vExag;
        
        // Use # prefix for absolute coordinates (crucial when Dynamic Input F12 is ON in AutoCAD)
        if (idx === 0) {
            // First point doesn't strictly need it, but we put it anyway
            coordsStr += `#${x_cad.toFixed(3)},${y_cad.toFixed(3)}\n`;
        } else {
            coordsStr += `#${x_cad.toFixed(3)},${y_cad.toFixed(3)}\n`;
        }
    });

    navigator.clipboard.writeText(coordsStr).then(() => {
        const btn = document.getElementById('btn-copy-cad-coords');
        if (btn) {
            const origHTML = btn.innerHTML;
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
            setTimeout(() => {
                btn.innerHTML = origHTML;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy coordinates: ', err);
        alert('Failed to copy coordinates automatically. Please inspect developer console.');
    });
}

function copyLispDataToClipboard() {
    const viewType = document.getElementById('cad-export-type').value;
    const cadUnit = document.getElementById('cad-unit').value;
    const vExag = parseFloat(document.getElementById('cad-exag').value);
    const includeText = document.getElementById('cad-include-text').checked;

    let scale = 1000;
    if (cadUnit === 'cm') scale = 100;
    if (cadUnit === 'm') scale = 1;

    let content = '';
    if (viewType === 'elevation') {
        content = generateElevationTFD(scale, vExag, includeText);
    } else {
        content = generatePlanTFD(scale, includeText);
    }

    const varName = viewType === 'elevation' ? '*tfd-elev-data*' : '*tfd-plan-data*';
    const lispExpression = `(setq ${varName} '${content})`;

    navigator.clipboard.writeText(lispExpression).then(() => {
        const btn = DOM.btnCopyLispData;
        if (btn) {
            const origHTML = btn.innerHTML;
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
            setTimeout(() => {
                btn.innerHTML = origHTML;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy LISP data: ', err);
        alert('Failed to copy LISP data automatically. Please inspect developer console.');
    });
}

// AutoCAD DXF File Export
function exportDXF() {
    const viewType = document.getElementById('cad-export-type').value;
    const cadUnit = document.getElementById('cad-unit').value;
    const vExag = parseFloat(document.getElementById('cad-exag').value);
    const includeText = document.getElementById('cad-include-text').checked;

    let scale = 1000; // millimeters
    if (cadUnit === 'cm') scale = 100;
    if (cadUnit === 'm') scale = 1;

    const f = (code, val) => `${code}\n${val}\n`;

    let dxf = '';

    // HEADER SECTION specifying DXF R12 (AC1009) and drawing units
    const insUnits = cadUnit === 'mm' ? 4 : cadUnit === 'cm' ? 5 : 6; // 4=mm, 5=cm, 6=m
    dxf += f(0, 'SECTION') + f(2, 'HEADER') + f(9, '$ACADVER') + f(1, 'AC1009') +
           f(9, '$INSUNITS') + f(70, insUnits) + f(0, 'ENDSEC');

    // Define layers
    const layers = [
        { name: '0', color: 7 },
        { name: 'TF_Slab', color: 8 },
        { name: 'TF_Tendon', color: 4 },
        { name: 'TF_Columns', color: 9 },
        { name: 'TF_Text', color: 2 }
    ];
    if (viewType === 'elevation') {
        layers.push({ name: 'TF_Duct', color: 141 });
        layers.push({ name: 'TF_Limits', color: 1 });
        layers.push({ name: 'TF_Tendon_Perp', color: 3 });
    }

    // TABLES SECTION
    dxf += f(0, 'SECTION') + f(2, 'TABLES');
    
    // LTYPE TABLE (Required to map CONTINUOUS linetype in standard R12)
    dxf += f(0, 'TABLE') + f(2, 'LTYPE') + f(70, 1);
    dxf += f(0, 'LTYPE') + f(2, 'CONTINUOUS') + f(70, 0) + f(3, 'Solid line') + f(72, 65) + f(73, 0) + f(40, 0.0);
    dxf += f(0, 'ENDTAB');

    // LAYER TABLE
    dxf += f(0, 'TABLE') + f(2, 'LAYER') + f(70, layers.length);
    layers.forEach(layer => {
        dxf += f(0, 'LAYER') + f(2, layer.name) + f(70, 0) + f(62, layer.color) + f(6, 'CONTINUOUS');
    });
    dxf += f(0, 'ENDTAB');
    
    dxf += f(0, 'ENDSEC');

    // ENTITIES SECTION
    dxf += f(0, 'SECTION') + f(2, 'ENTITIES');

    if (viewType === 'elevation') {
        dxf += generateElevationDXF(scale, vExag, includeText);
    } else {
        dxf += generatePlanDXF(scale, includeText);
    }

    dxf += f(0, 'ENDSEC') + f(0, 'EOF');

    // Force CRLF line endings for strict AutoCAD parser compatibility on Windows
    dxf = dxf.replace(/\r?\n/g, '\r\n');

    // Trigger download
    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tendonflow_pt_${viewType}_${cadUnit}.dxf`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateElevationDXF(scale, vExag, includeText) {
    let str = '';
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const hSlab = state.slabThickness; 
    
    const L_cad = totalLength * scale;
    const h_cad = (hSlab / 1000) * scale * vExag;

    // Spacing-free DXF format helpers
    const f = (code, val) => `${code}\n${val}\n`;
    
    const dxfLine = (x1, y1, x2, y2, layer) => {
        return f(0, 'LINE') + f(8, layer) +
               f(10, x1.toFixed(3)) + f(20, y1.toFixed(3)) + f(30, '0.0') +
               f(11, x2.toFixed(3)) + f(21, y2.toFixed(3)) + f(31, '0.0');
    };
    
    // Standard POLYLINE-VERTEX-SEQEND for DXF R12 compatibility (no LWPOLYLINE support)
    const dxfPolyline = (points, layer, closed = false) => {
        let s = f(0, 'POLYLINE') + f(8, layer) + f(66, 1) + f(70, closed ? 1 : 0);
        points.forEach(pt => {
            s += f(0, 'VERTEX') + f(8, layer) + f(10, pt.x.toFixed(3)) + f(20, pt.y.toFixed(3)) + f(30, '0.0');
        });
        s += f(0, 'SEQEND') + f(8, layer);
        return s;
    };
    
    const dxfCircle = (cx, cy, r, layer) => {
        return f(0, 'CIRCLE') + f(8, layer) +
               f(10, cx.toFixed(3)) + f(20, cy.toFixed(3)) + f(30, '0.0') +
               f(40, r.toFixed(3));
    };
    
    // Segmented polyline ellipse for DXF R12 compatibility (no native ELLIPSE entity in R12)
    const dxfEllipse = (cx, cy, rx, ry, layer) => {
        const points = [];
        const segments = 32;
        for (let i = 0; i < segments; i++) {
            const theta = (i / segments) * 2 * Math.PI;
            points.push({
                x: cx + rx * Math.cos(theta),
                y: cy + ry * Math.sin(theta)
            });
        }
        return dxfPolyline(points, layer, true);
    };
    
    const dxfText = (x, y, height, textVal, layer, angle = 0, justifyCenter = false) => {
        let s = f(0, 'TEXT') + f(8, layer) +
                f(10, x.toFixed(3)) + f(20, y.toFixed(3)) + f(30, '0.0') +
                f(40, height.toFixed(3)) + f(1, textVal) + f(50, angle.toFixed(1));
        if (justifyCenter) {
            s += f(72, 1) + f(11, x.toFixed(3)) + f(21, y.toFixed(3)) + f(31, '0.0');
        }
        return s;
    };

    // Slab outline
    str += dxfLine(0, 0, L_cad, 0, 'TF_Slab');
    str += dxfLine(0, h_cad, L_cad, h_cad, 'TF_Slab');
    str += dxfLine(0, 0, 0, h_cad, 'TF_Slab');
    str += dxfLine(L_cad, 0, L_cad, h_cad, 'TF_Slab');
    
    // Neutral axis
    const na_y_cad = (hSlab / 2 / 1000) * scale * vExag;
    str += dxfLine(0, na_y_cad, L_cad, na_y_cad, 'TF_Slab');

    // Columns
    let currentX = 0;
    const colWidth = 0.4 * scale;
    const colHeight = 1.5 * scale;
    for (let i = 0; i <= state.numSpans; i++) {
        if (i > 0) currentX += state.spanLengths[i - 1];
        const x_cad = currentX * scale;
        str += dxfLine(x_cad - colWidth/2, -colHeight, x_cad - colWidth/2, 0, 'TF_Columns');
        str += dxfLine(x_cad + colWidth/2, -colHeight, x_cad + colWidth/2, 0, 'TF_Columns');
        str += dxfLine(x_cad - colWidth/2, -colHeight, x_cad + colWidth/2, -colHeight, 'TF_Columns');
    }

    // Cover Limits
    const coverTop_cad = (state.coverTop / 1000) * scale * vExag;
    const coverBottom_cad = (state.coverBottom / 1000) * scale * vExag;
    str += dxfLine(0, h_cad - coverTop_cad, L_cad, h_cad - coverTop_cad, 'TF_Limits');
    str += dxfLine(0, coverBottom_cad, L_cad, coverBottom_cad, 'TF_Limits');

    // Tendon curve
    const points = state.sampledPoints;
    if (points && points.length > 0) {
        const tendonPts = points.map(pt => ({
            x: pt.xGlobal * scale,
            y: (pt.y / 1000) * scale * vExag
        }));
        str += dxfPolyline(tendonPts, 'TF_Tendon');
        
        // Duct envelopes
        const ductTopPts = points.map(pt => ({
            x: pt.xGlobal * scale,
            y: ((pt.y + state.ductDiameter / 2) / 1000) * scale * vExag
        }));
        str += dxfPolyline(ductTopPts, 'TF_Duct');

        const ductBotPts = points.map(pt => ({
            x: pt.xGlobal * scale,
            y: ((pt.y - state.ductDiameter / 2) / 1000) * scale * vExag
        }));
        str += dxfPolyline(ductBotPts, 'TF_Duct');
    }

    // Perpendicular tendons
    const activePerpTendons = getActivePerpendicularTendons();
    if (activePerpTendons && activePerpTendons.length > 0) {
        activePerpTendons.forEach(pt => {
            const cx = pt.x * scale;
            const cy = (pt.y / 1000) * scale * vExag;
            const rx = (state.ductDiameter / 2) / 1000 * scale;
            const ry = rx * vExag;

            if (vExag === 1) {
                str += dxfCircle(cx, cy, rx, 'TF_Tendon_Perp');
            } else {
                str += dxfEllipse(cx, cy, rx, ry, 'TF_Tendon_Perp');
            }
        });
    }

    // Annotations
    if (includeText) {
        const textHeight = (hSlab / 1000) * scale * 0.15;

        // Support peaks
        let runX = 0;
        for (let i = 0; i <= state.numSpans; i++) {
            if (i > 0) runX += state.spanLengths[i - 1];
            const x_cad = runX * scale;
            const y_val_mm = state.controlPoints.supports[i];
            const y_cad = (y_val_mm / 1000) * scale * vExag;
            const valStr = state.unit === 'cm' ? (y_val_mm / 10).toFixed(1) : y_val_mm.toFixed(0);
            
            str += dxfText(x_cad, y_cad + textHeight * 1.5, textHeight, `Peak: ${valStr} ${state.unit}`, 'TF_Text', 0, true);
        }

        // Low points
        let spanStartX = 0;
        for (let i = 0; i < state.numSpans; i++) {
            const spanLen = state.spanLengths[i];
            const lp = state.controlPoints.lowPoints[i];
            const x_cad = (spanStartX + lp.xFract * spanLen) * scale;
            const y_val_mm = lp.y;
            const y_cad = (y_val_mm / 1000) * scale * vExag;
            const valStr = state.unit === 'cm' ? (y_val_mm / 10).toFixed(1) : y_val_mm.toFixed(0);

            str += dxfText(x_cad, y_cad - textHeight * 2.2, textHeight, `Low: ${valStr} ${state.unit}`, 'TF_Text', 0, true);
            spanStartX += spanLen;
        }

        // Title box
        const infoX = 0;
        const infoY = h_cad + textHeight * 4.0;
        str += dxfText(infoX, infoY, textHeight * 1.5, "POST-TENSIONED TENDON ELEVATION PROFILE", 'TF_Text');
        str += dxfText(infoX, infoY - textHeight * 2, textHeight, `Slab Thickness: ${fromMm(state.slabThickness).toFixed(1)} ${state.unit} | Spans: ${state.numSpans} | Exaggeration: ${vExag}x`, 'TF_Text');
        str += dxfText(infoX, infoY - textHeight * 3.5, textHeight, `Force X: ${state.tendonForce} kN | Spacing X: ${state.tendonSpacingX} m | Duct OD: ${fromMm(state.ductDiameter).toFixed(1)} ${state.unit}`, 'TF_Text');
    }

    return str;
}

function generatePlanDXF(scale, includeText) {
    let str = '';
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const totalWidth = state.slabWidth;

    const L_cad = totalLength * scale;
    const W_cad = totalWidth * scale;

    // Spacing-free DXF format helpers
    const f = (code, val) => `${code}\n${val}\n`;
    
    const dxfLine = (x1, y1, x2, y2, layer) => {
        return f(0, 'LINE') + f(8, layer) +
               f(10, x1.toFixed(3)) + f(20, y1.toFixed(3)) + f(30, '0.0') +
               f(11, x2.toFixed(3)) + f(21, y2.toFixed(3)) + f(31, '0.0');
    };
    
    // Standard POLYLINE-VERTEX-SEQEND for DXF R12 compatibility (no LWPOLYLINE support)
    const dxfPolyline = (points, layer, closed = false) => {
        let s = f(0, 'POLYLINE') + f(8, layer) + f(66, 1) + f(70, closed ? 1 : 0);
        points.forEach(pt => {
            s += f(0, 'VERTEX') + f(8, layer) + f(10, pt.x.toFixed(3)) + f(20, pt.y.toFixed(3)) + f(30, '0.0');
        });
        s += f(0, 'SEQEND') + f(8, layer);
        return s;
    };
    
    const dxfText = (x, y, height, textVal, layer, angle = 0, justifyCenter = false) => {
        let s = f(0, 'TEXT') + f(8, layer) +
                f(10, x.toFixed(3)) + f(20, y.toFixed(3)) + f(30, '0.0') +
                f(40, height.toFixed(3)) + f(1, textVal) + f(50, angle.toFixed(1));
        if (justifyCenter) {
            s += f(72, 1) + f(11, x.toFixed(3)) + f(21, y.toFixed(3)) + f(31, '0.0');
        }
        return s;
    };

    // Slab outline
    const slabOutline = [
        { x: 0, y: 0 },
        { x: L_cad, y: 0 },
        { x: L_cad, y: W_cad },
        { x: 0, y: W_cad }
    ];
    str += dxfPolyline(slabOutline, 'TF_Slab', true);

    // Columns
    const colSize = 0.4 * scale;
    if (state.planColumns) {
        state.planColumns.forEach(c => {
            if (c.enabled) {
                const cx = c.x * scale;
                const cy = c.y * scale;
                const colOutline = [
                    { x: cx - colSize/2, y: cy - colSize/2 },
                    { x: cx + colSize/2, y: cy - colSize/2 },
                    { x: cx + colSize/2, y: cy + colSize/2 },
                    { x: cx - colSize/2, y: cy + colSize/2 }
                ];
                str += dxfPolyline(colOutline, 'TF_Columns', true);
            }
        });
    }

    // X Tendons
    if (state.planXTendons) {
        state.planXTendons.forEach(y => {
            if (y >= 0 && y <= totalWidth) {
                const y_cad = y * scale;
                str += dxfLine(0, y_cad, L_cad, y_cad, 'TF_Tendon');
            }
        });
    }

    // Y Tendons
    const activePerpTendons = getActivePerpendicularTendons();
    if (activePerpTendons) {
        activePerpTendons.forEach(pt => {
            const x_cad = pt.x * scale;
            str += dxfLine(x_cad, 0, x_cad, W_cad, 'TF_Tendon');
        });
    }

    // Annotations
    if (includeText) {
        const textHeight = 0.2 * scale;
        
        str += dxfText(0, W_cad + textHeight * 2, textHeight * 1.5, "POST-TENSIONED SLAB 2D PLAN LAYOUT", 'TF_Text');
        str += dxfText(L_cad / 2, -textHeight * 2, textHeight, `SLAB LENGTH = ${totalLength.toFixed(1)} m`, 'TF_Text', 0, true);
        str += dxfText(-textHeight * 2, W_cad / 2, textHeight, `SLAB WIDTH = ${totalWidth.toFixed(1)} m`, 'TF_Text', 90, true);
    }

    return str;
}

// AutoCAD AutoLISP (.LSP) Export
function exportLISP() {
    let lsp = '';
    lsp += `;; ==========================================================\n`;
    lsp += `;; TendonFlow AutoLISP Drawing Loader\n`;
    lsp += `;; Instructions: Load this file in AutoCAD once (using APPLOAD\n`;
    lsp += `;; or dragging and dropping the file onto AutoCAD canvas).\n`;
    lsp += `;; \n`;
    lsp += `;; Available Commands:\n`;
    lsp += `;;   DRAWELEVC  - Draw Elevation Profile from Clipboard data\n`;
    lsp += `;;   DRAWELEVF  - Draw Elevation Profile from downloaded .tfd file\n`;
    lsp += `;;   DRAWPLANC  - Draw 2D Plan Layout from Clipboard data\n`;
    lsp += `;;   DRAWPLANF  - Draw 2D Plan Layout from downloaded .tfd file\n`;
    lsp += `;; ==========================================================\n\n`;

    // Core renderer function
    lsp += `(defun draw-tfd-list (data / item type pts closed cmd pt justify)\n`;
    lsp += `  (command "_-layer" \n`;
    lsp += `           "m" "TF_Slab" "c" "8" "TF_Slab" \n`;
    lsp += `           "m" "TF_Tendon" "c" "4" "TF_Tendon" \n`;
    lsp += `           "m" "TF_Duct" "c" "141" "TF_Duct" \n`;
    lsp += `           "m" "TF_Limits" "c" "1" "TF_Limits" \n`;
    lsp += `           "m" "TF_Tendon_Perp" "c" "3" "TF_Tendon_Perp" \n`;
    lsp += `           "m" "TF_Columns" "c" "9" "TF_Columns" \n`;
    lsp += `           "m" "TF_Text" "c" "2" "TF_Text" \n`;
    lsp += `           "")\n\n`;
    lsp += `  (foreach item data\n`;
    lsp += `    (setq type (car item))\n`;
    lsp += `    (cond\n`;
    lsp += `      ((eq type 'LINE)\n`;
    lsp += `       (setvar "clayer" (cadr item))\n`;
    lsp += `       (command "_line" (nth 2 item) (nth 3 item) "")\n`;
    lsp += `      )\n`;
    lsp += `      ((eq type 'POLYLINE)\n`;
    lsp += `       (setvar "clayer" (cadr item))\n`;
    lsp += `       (setq pts (nth 2 item))\n`;
    lsp += `       (setq closed (nth 3 item))\n`;
    lsp += `       (setq cmd (list "_pline"))\n`;
    lsp += `       (foreach pt pts\n`;
    lsp += `         (setq cmd (append cmd (list pt)))\n`;
    lsp += `       )\n`;
    lsp += `       (if (= closed 1)\n`;
    lsp += `         (setq cmd (append cmd (list "_c")))\n`;
    lsp += `         (setq cmd (append cmd (list "")))\n`;
    lsp += `       )\n`;
    lsp += `       (apply 'command cmd)\n`;
    lsp += `      )\n`;
    lsp += `      ((eq type 'CIRCLE)\n`;
    lsp += `       (setvar "clayer" (cadr item))\n`;
    lsp += `       (command "_circle" (nth 2 item) (nth 3 item))\n`;
    lsp += `      )\n`;
    lsp += `      ((eq type 'TEXT)\n`;
    lsp += `       (setvar "clayer" (cadr item))\n`;
    lsp += `       (setq justify (nth 6 item))\n`;
    lsp += `       (if (= justify 1)\n`;
    lsp += `         (command "_text" "j" "c" (nth 2 item) (nth 3 item) (nth 4 item) (nth 5 item))\n`;
    lsp += `         (command "_text" (nth 2 item) (nth 3 item) (nth 4 item) (nth 5 item))\n`;
    lsp += `       )\n`;
    lsp += `      )\n`;
    lsp += `    )\n`;
    lsp += `  )\n`;
    lsp += `)\n\n`;

    // DRAWELEVC command
    lsp += `(defun c:drawelevc ( / oldecho oldsnap data)\n`;
    lsp += `  (setq oldecho (getvar "cmdecho"))\n`;
    lsp += `  (setq oldsnap (getvar "osmode"))\n`;
    lsp += `  (setvar "cmdecho" 0)\n`;
    lsp += `  (setvar "osmode" 0)\n\n`;
    lsp += `  (if (and (boundp '*tfd-elev-data*) *tfd-elev-data*)\n`;
    lsp += `    (progn\n`;
    lsp += `      (setq data *tfd-elev-data*)\n`;
    lsp += `      (setq *tfd-elev-data* nil)\n`;
    lsp += `      (draw-tfd-list data)\n`;
    lsp += `      (command "_zoom" "_e")\n`;
    lsp += `      (princ "\\nElevation profile drawn successfully from clipboard data!")\n`;
    lsp += `    )\n`;
    lsp += `    (princ "\\nError: No copied elevation data found in clipboard. Please click 'Copy LISP Data' in TendonFlow first.")\n`;
    lsp += `  )\n`;
    lsp += `  (setvar "cmdecho" oldecho)\n`;
    lsp += `  (setvar "osmode" oldsnap)\n`;
    lsp += `  (princ)\n`;
    lsp += `)\n\n`;

    // DRAWELEVF command
    lsp += `(defun c:drawelevf ( / oldecho oldsnap filepath file line data)\n`;
    lsp += `  (setq oldecho (getvar "cmdecho"))\n`;
    lsp += `  (setq oldsnap (getvar "osmode"))\n`;
    lsp += `  (setvar "cmdecho" 0)\n`;
    lsp += `  (setvar "osmode" 0)\n\n`;
    lsp += `  (setq filepath (getfiled "Select TendonFlow Elevation Data File" "" "tfd;txt" 0))\n`;
    lsp += `  (if filepath\n`;
    lsp += `    (progn\n`;
    lsp += `      (setq file (open filepath "r"))\n`;
    lsp += `      (setq line (read-line file))\n`;
    lsp += `      (close file)\n`;
    lsp += `      (if line\n`;
    lsp += `        (progn\n`;
    lsp += `          (setq data (read line))\n`;
    lsp += `          (draw-tfd-list data)\n`;
    lsp += `          (command "_zoom" "_e")\n`;
    lsp += `          (princ "\\nElevation profile drawn successfully from file!")\n`;
    lsp += `        )\n`;
    lsp += `        (princ "\\nError: Selected file is empty.")\n`;
    lsp += `      )\n`;
    lsp += `    )\n`;
    lsp += `    (princ "\\nNo file selected.")\n`;
    lsp += `  )\n`;
    lsp += `  (setvar "cmdecho" oldecho)\n`;
    lsp += `  (setvar "osmode" oldsnap)\n`;
    lsp += `  (princ)\n`;
    lsp += `)\n\n`;

    // DRAWPLANC command
    lsp += `(defun c:drawplanc ( / oldecho oldsnap data)\n`;
    lsp += `  (setq oldecho (getvar "cmdecho"))\n`;
    lsp += `  (setq oldsnap (getvar "osmode"))\n`;
    lsp += `  (setvar "cmdecho" 0)\n`;
    lsp += `  (setvar "osmode" 0)\n\n`;
    lsp += `  (if (and (boundp '*tfd-plan-data*) *tfd-plan-data*)\n`;
    lsp += `    (progn\n`;
    lsp += `      (setq data *tfd-plan-data*)\n`;
    lsp += `      (setq *tfd-plan-data* nil)\n`;
    lsp += `      (draw-tfd-list data)\n`;
    lsp += `      (command "_zoom" "_e")\n`;
    lsp += `      (princ "\\n2D Plan Layout drawn successfully from clipboard data!")\n`;
    lsp += `    )\n`;
    lsp += `    (princ "\\nError: No copied plan data found in clipboard. Please click 'Copy LISP Data' in TendonFlow first.")\n`;
    lsp += `  )\n`;
    lsp += `  (setvar "cmdecho" oldecho)\n`;
    lsp += `  (setvar "osmode" oldsnap)\n`;
    lsp += `  (princ)\n`;
    lsp += `)\n\n`;

    // DRAWPLANF command
    lsp += `(defun c:drawplanf ( / oldecho oldsnap filepath file line data)\n`;
    lsp += `  (setq oldecho (getvar "cmdecho"))\n`;
    lsp += `  (setq oldsnap (getvar "osmode"))\n`;
    lsp += `  (setvar "cmdecho" 0)\n`;
    lsp += `  (setvar "osmode" 0)\n\n`;
    lsp += `  (setq filepath (getfiled "Select TendonFlow Plan Data File" "" "tfd;txt" 0))\n`;
    lsp += `  (if filepath\n`;
    lsp += `    (progn\n`;
    lsp += `      (setq file (open filepath "r"))\n`;
    lsp += `      (setq line (read-line file))\n`;
    lsp += `      (close file)\n`;
    lsp += `      (if line\n`;
    lsp += `        (progn\n`;
    lsp += `          (setq data (read line))\n`;
    lsp += `          (draw-tfd-list data)\n`;
    lsp += `          (command "_zoom" "_e")\n`;
    lsp += `          (princ "\\nPlan layout drawn successfully from file!")\n`;
    lsp += `        )\n`;
    lsp += `        (princ "\\nError: Selected file is empty.")\n`;
    lsp += `      )\n`;
    lsp += `    )\n`;
    lsp += `    (princ "\\nNo file selected.")\n`;
    lsp += `  )\n`;
    lsp += `  (setvar "cmdecho" oldecho)\n`;
    lsp += `  (setvar "osmode" oldsnap)\n`;
    lsp += `  (princ)\n`;
    lsp += `)\n`;

    // Trigger download
    const blob = new Blob([lsp], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'TendonFlowDraw.lsp');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// AutoCAD TendonFlow Data File (.TFD) Export
function exportTFD() {
    const viewType = document.getElementById('cad-export-type').value;
    const cadUnit = document.getElementById('cad-unit').value;
    const vExag = parseFloat(document.getElementById('cad-exag').value);
    const includeText = document.getElementById('cad-include-text').checked;

    let scale = 1000; // millimeters
    if (cadUnit === 'cm') scale = 100;
    if (cadUnit === 'm') scale = 1;

    let content = '';
    if (viewType === 'elevation') {
        content = generateElevationTFD(scale, vExag, includeText);
    } else {
        content = generatePlanTFD(scale, includeText);
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tendonflow_pt_${viewType}_${cadUnit}.tfd`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateElevationTFD(scale, vExag, includeText) {
    const list = [];
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const hSlab = state.slabThickness; 
    
    const L_cad = totalLength * scale;
    const h_cad = (hSlab / 1000) * scale * vExag;

    const addLine = (x1, y1, x2, y2, layer) => {
        list.push(`(LINE "${layer}" (${x1.toFixed(3)} ${y1.toFixed(3)}) (${x2.toFixed(3)} ${y2.toFixed(3)}))`);
    };

    const addPolyline = (points, layer, closed = false) => {
        const ptsStr = points.map(pt => `(${pt.x.toFixed(3)} ${pt.y.toFixed(3)})`).join(' ');
        list.push(`(POLYLINE "${layer}" (${ptsStr}) ${closed ? 1 : 0})`);
    };

    const addCircle = (cx, cy, r, layer) => {
        list.push(`(CIRCLE "${layer}" (${cx.toFixed(3)} ${cy.toFixed(3)}) ${r.toFixed(3)})`);
    };

    const addEllipse = (cx, cy, rx, ry, layer) => {
        const points = [];
        const segments = 32;
        for (let i = 0; i < segments; i++) {
            const theta = (i / segments) * 2 * Math.PI;
            points.push({
                x: cx + rx * Math.cos(theta),
                y: cy + ry * Math.sin(theta)
            });
        }
        addPolyline(points, layer, true);
    };

    const addText = (x, y, height, textVal, layer, angle = 0, justifyCenter = false) => {
        const safeText = textVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        list.push(`(TEXT "${layer}" (${x.toFixed(3)} ${y.toFixed(3)}) ${height.toFixed(3)} ${angle.toFixed(1)} "${safeText}" ${justifyCenter ? 1 : 0})`);
    };

    // Slab outline
    addLine(0, 0, L_cad, 0, 'TF_Slab');
    addLine(0, h_cad, L_cad, h_cad, 'TF_Slab');
    addLine(0, 0, 0, h_cad, 'TF_Slab');
    addLine(L_cad, 0, L_cad, h_cad, 'TF_Slab');
    
    // Neutral axis
    const na_y_cad = (hSlab / 2 / 1000) * scale * vExag;
    addLine(0, na_y_cad, L_cad, na_y_cad, 'TF_Slab');

    // Columns
    let currentX = 0;
    const colWidth = 0.4 * scale;
    const colHeight = 1.5 * scale;
    for (let i = 0; i <= state.numSpans; i++) {
        if (i > 0) currentX += state.spanLengths[i - 1];
        const x_cad = currentX * scale;
        addLine(x_cad - colWidth/2, -colHeight, x_cad - colWidth/2, 0, 'TF_Columns');
        addLine(x_cad + colWidth/2, -colHeight, x_cad + colWidth/2, 0, 'TF_Columns');
        addLine(x_cad - colWidth/2, -colHeight, x_cad + colWidth/2, -colHeight, 'TF_Columns');
    }

    // Cover Limits
    const coverTop_cad = (state.coverTop / 1000) * scale * vExag;
    const coverBottom_cad = (state.coverBottom / 1000) * scale * vExag;
    addLine(0, h_cad - coverTop_cad, L_cad, h_cad - coverTop_cad, 'TF_Limits');
    addLine(0, coverBottom_cad, L_cad, coverBottom_cad, 'TF_Limits');

    // Tendon curve
    const points = state.sampledPoints;
    if (points && points.length > 0) {
        const tendonPts = points.map(pt => ({
            x: pt.xGlobal * scale,
            y: (pt.y / 1000) * scale * vExag
        }));
        addPolyline(tendonPts, 'TF_Tendon');
        
        // Duct envelopes
        const ductTopPts = points.map(pt => ({
            x: pt.xGlobal * scale,
            y: ((pt.y + state.ductDiameter / 2) / 1000) * scale * vExag
        }));
        addPolyline(ductTopPts, 'TF_Duct');

        const ductBotPts = points.map(pt => ({
            x: pt.xGlobal * scale,
            y: ((pt.y - state.ductDiameter / 2) / 1000) * scale * vExag
        }));
        addPolyline(ductBotPts, 'TF_Duct');
    }

    // Perpendicular tendons
    const activePerpTendons = getActivePerpendicularTendons();
    if (activePerpTendons && activePerpTendons.length > 0) {
        activePerpTendons.forEach(pt => {
            const cx = pt.x * scale;
            const cy = (pt.y / 1000) * scale * vExag;
            const rx = (state.ductDiameter / 2) / 1000 * scale;
            const ry = rx * vExag;

            if (vExag === 1) {
                addCircle(cx, cy, rx, 'TF_Tendon_Perp');
            } else {
                addEllipse(cx, cy, rx, ry, 'TF_Tendon_Perp');
            }
        });
    }

    // Annotations
    if (includeText) {
        const textHeight = (hSlab / 1000) * scale * 0.15;

        // Support peaks
        let runX = 0;
        for (let i = 0; i <= state.numSpans; i++) {
            if (i > 0) runX += state.spanLengths[i - 1];
            const x_cad = runX * scale;
            const y_val_mm = state.controlPoints.supports[i];
            const y_cad = (y_val_mm / 1000) * scale * vExag;
            const valStr = state.unit === 'cm' ? (y_val_mm / 10).toFixed(1) : y_val_mm.toFixed(0);
            
            addText(x_cad, y_cad + textHeight * 1.5, textHeight, `Peak: ${valStr} ${state.unit}`, 'TF_Text', 0, true);
        }

        // Low points
        let spanStartX = 0;
        for (let i = 0; i < state.numSpans; i++) {
            const spanLen = state.spanLengths[i];
            const lp = state.controlPoints.lowPoints[i];
            const x_cad = (spanStartX + lp.xFract * spanLen) * scale;
            const y_val_mm = lp.y;
            const y_cad = (y_val_mm / 1000) * scale * vExag;
            const valStr = state.unit === 'cm' ? (y_val_mm / 10).toFixed(1) : y_val_mm.toFixed(0);

            addText(x_cad, y_cad - textHeight * 2.2, textHeight, `Low: ${valStr} ${state.unit}`, 'TF_Text', 0, true);
            spanStartX += spanLen;
        }

        // Title box
        const infoX = 0;
        const infoY = h_cad + textHeight * 4.0;
        addText(infoX, infoY, textHeight * 1.5, "POST-TENSIONED TENDON ELEVATION PROFILE", 'TF_Text');
        addText(infoX, infoY - textHeight * 2, textHeight, `Slab Thickness: ${fromMm(state.slabThickness).toFixed(1)} ${state.unit} | Spans: ${state.numSpans} | Exaggeration: ${vExag}x`, 'TF_Text');
        addText(infoX, infoY - textHeight * 3.5, textHeight, `Force X: ${state.tendonForce} kN | Spacing X: ${state.tendonSpacingX} m | Duct OD: ${fromMm(state.ductDiameter).toFixed(1)} ${state.unit}`, 'TF_Text');
    }

    return `(${list.join(' ')})`;
}

function generatePlanTFD(scale, includeText) {
    const list = [];
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const totalWidth = state.slabWidth;

    const L_cad = totalLength * scale;
    const W_cad = totalWidth * scale;

    const addLine = (x1, y1, x2, y2, layer) => {
        list.push(`(LINE "${layer}" (${x1.toFixed(3)} ${y1.toFixed(3)}) (${x2.toFixed(3)} ${y2.toFixed(3)}))`);
    };

    const addPolyline = (points, layer, closed = false) => {
        const ptsStr = points.map(pt => `(${pt.x.toFixed(3)} ${pt.y.toFixed(3)})`).join(' ');
        list.push(`(POLYLINE "${layer}" (${ptsStr}) ${closed ? 1 : 0})`);
    };

    const addText = (x, y, height, textVal, layer, angle = 0, justifyCenter = false) => {
        const safeText = textVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        list.push(`(TEXT "${layer}" (${x.toFixed(3)} ${y.toFixed(3)}) ${height.toFixed(3)} ${angle.toFixed(1)} "${safeText}" ${justifyCenter ? 1 : 0})`);
    };

    // Slab outline
    const slabOutline = [
        { x: 0, y: 0 },
        { x: L_cad, y: 0 },
        { x: L_cad, y: W_cad },
        { x: 0, y: W_cad }
    ];
    addPolyline(slabOutline, 'TF_Slab', true);

    // Columns
    const colSize = 0.4 * scale;
    if (state.planColumns) {
        state.planColumns.forEach(c => {
            if (c.enabled) {
                const cx = c.x * scale;
                const cy = c.y * scale;
                const colOutline = [
                    { x: cx - colSize/2, y: cy - colSize/2 },
                    { x: cx + colSize/2, y: cy - colSize/2 },
                    { x: cx + colSize/2, y: cy + colSize/2 },
                    { x: cx - colSize/2, y: cy + colSize/2 }
                ];
                addPolyline(colOutline, 'TF_Columns', true);
            }
        });
    }

    // X Tendons
    if (state.planXTendons) {
        state.planXTendons.forEach(y => {
            if (y >= 0 && y <= totalWidth) {
                const y_cad = y * scale;
                addLine(0, y_cad, L_cad, y_cad, 'TF_Tendon');
            }
        });
    }

    // Y Tendons
    const activePerpTendons = getActivePerpendicularTendons();
    if (activePerpTendons) {
        activePerpTendons.forEach(pt => {
            const x_cad = pt.x * scale;
            addLine(x_cad, 0, x_cad, W_cad, 'TF_Tendon');
        });
    }

    // Annotations
    if (includeText) {
        const textHeight = 0.2 * scale;
        
        addText(0, W_cad + textHeight * 2, textHeight * 1.5, "POST-TENSIONED SLAB 2D PLAN LAYOUT", 'TF_Text');
        addText(L_cad / 2, -textHeight * 2, textHeight, `SLAB LENGTH = ${totalLength.toFixed(1)} m`, 'TF_Text', 0, true);
        addText(-textHeight * 2, W_cad / 2, textHeight, `SLAB WIDTH = ${totalWidth.toFixed(1)} m`, 'TF_Text', 90, true);
    }

    return `(${list.join(' ')})`;
}

// Export current state as a JSON file (with naming)
function exportJSON() {
    const defaultName = 'pt_slab_design';
    const enteredName = prompt('Enter a name for this design set:', defaultName);
    if (enteredName === null) {
        return; // User cancelled
    }
    const name = enteredName.trim() || defaultName;

    const dataToSave = {
        name: name,
        timestamp: new Date().toISOString(),
        version: '1.0',
        state: {
            numSpans: state.numSpans,
            unit: state.unit,
            slabThickness: state.slabThickness,
            concreteDensity: state.concreteDensity,
            spanLengths: state.spanLengths,
            slabWidth: state.slabWidth,
            spanYLen: state.spanYLen,
            coverTop: state.coverTop,
            coverBottom: state.coverBottom,
            inflectionRatio: state.inflectionRatio,
            tendonForce: state.tendonForce,
            tendonForceY: state.tendonForceY,
            jackingEnd: state.jackingEnd,
            frictionMu: state.frictionMu,
            frictionK: state.frictionK,
            anchorSet: state.anchorSet,
            tendonSpacingX: state.tendonSpacingX,
            tendonSpacingY: state.tendonSpacingY,
            verticalExaggeration: state.verticalExaggeration,
            numColRows: state.numColRows,
            selectedRowIdx: state.selectedRowIdx,
            controlPointsRows: state.controlPointsRows.map(cp => ({
                supports: cp.supports,
                supportsLocked: cp.supportsLocked,
                lowPoints: cp.lowPoints.map(lp => ({ xFract: lp.xFract, y: lp.y })),
                lowPointsLocked: cp.lowPointsLocked
            })),
            planXTendons: state.planXTendons,
            planYTendons: state.planYTendons,
            planColumns: state.planColumns,
            minSupportAngle: state.minSupportAngle,
            maxSupportAngle: state.maxSupportAngle,
            elevationTendonSets: state.elevationTendonSets,
            ductDiameter: state.ductDiameter
        }
    };

    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${name}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Import state from a JSON file
function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            if (!data || !data.state) {
                throw new Error('Invalid file format. Missing state object.');
            }

            const s = data.state;
            
            // Restore parameters to state
            if (s.numSpans !== undefined) state.numSpans = s.numSpans;
            if (s.unit !== undefined) state.unit = s.unit;
            if (s.slabThickness !== undefined) state.slabThickness = s.slabThickness;
            if (s.concreteDensity !== undefined) state.concreteDensity = s.concreteDensity;
            if (Array.isArray(s.spanLengths)) state.spanLengths = [...s.spanLengths];
            if (s.slabWidth !== undefined) state.slabWidth = s.slabWidth;
            if (s.spanYLen !== undefined) state.spanYLen = s.spanYLen;
            if (s.coverTop !== undefined) state.coverTop = s.coverTop;
            if (s.coverBottom !== undefined) state.coverBottom = s.coverBottom;
            if (s.inflectionRatio !== undefined) state.inflectionRatio = s.inflectionRatio;
            if (s.tendonForce !== undefined) state.tendonForce = s.tendonForce;
            if (s.tendonForceY !== undefined) state.tendonForceY = s.tendonForceY;
            if (s.jackingEnd !== undefined) state.jackingEnd = s.jackingEnd;
            if (s.frictionMu !== undefined) state.frictionMu = s.frictionMu;
            if (s.frictionK !== undefined) state.frictionK = s.frictionK;
            if (s.anchorSet !== undefined) state.anchorSet = s.anchorSet;
            if (s.tendonSpacingX !== undefined) state.tendonSpacingX = s.tendonSpacingX;
            if (s.tendonSpacingY !== undefined) state.tendonSpacingY = s.tendonSpacingY;
            if (s.verticalExaggeration !== undefined) state.verticalExaggeration = s.verticalExaggeration;
            if (s.minSupportAngle !== undefined) state.minSupportAngle = s.minSupportAngle;
            if (s.maxSupportAngle !== undefined) state.maxSupportAngle = s.maxSupportAngle;
            if (s.ductDiameter !== undefined) state.ductDiameter = s.ductDiameter;

            // Restore control points
            if (s.numColRows !== undefined) state.numColRows = s.numColRows;
            if (s.selectedRowIdx !== undefined) state.selectedRowIdx = s.selectedRowIdx;
            if (Array.isArray(s.controlPointsRows)) {
                state.controlPointsRows = s.controlPointsRows.map(cp => ({
                    supports: [...cp.supports],
                    supportsLocked: [...cp.supportsLocked],
                    lowPoints: cp.lowPoints.map(lp => ({ xFract: lp.xFract, y: lp.y })),
                    lowPointsLocked: [...cp.lowPointsLocked]
                }));
            }
            
            // Fallback for older JSON versions
            if (!s.controlPointsRows && s.controlPoints) {
                const legacyCp = {
                    supports: [...s.controlPoints.supports],
                    supportsLocked: [...s.controlPoints.supportsLocked],
                    lowPoints: s.controlPoints.lowPoints.map(lp => ({ xFract: lp.xFract, y: lp.y })),
                    lowPointsLocked: [...s.controlPoints.lowPointsLocked]
                };
                state.controlPointsRows = [];
                const numSections = 2 * (s.numColRows || 3);
                for (let sIdx = 0; sIdx < numSections; sIdx++) {
                    state.controlPointsRows.push(JSON.parse(JSON.stringify(legacyCp)));
                }
            }

            // Restore 2D Plan Layout properties
            if (Array.isArray(s.planXTendons)) {
                state.planXTendons = [...s.planXTendons];
            }
            if (Array.isArray(s.planYTendons)) {
                state.planYTendons = s.planYTendons.map(arr => Array.isArray(arr) ? [...arr] : []);
            }
            if (Array.isArray(s.planColumns)) {
                state.planColumns = s.planColumns.map(col => ({
                    id: col.id,
                    x: col.x,
                    y: col.y,
                    enabled: col.enabled !== undefined ? col.enabled : true,
                    lockX: col.lockX !== undefined ? col.lockX : col.id.includes('col-0'),
                    lockY: col.lockY !== undefined ? col.lockY : false
                }));
            }
            
            // Restore perpendicular tendon sets
            if (Array.isArray(s.elevationTendonSets)) {
                state.elevationTendonSets = s.elevationTendonSets.map(set => ({
                    supportIdx: set.supportIdx,
                    direction: set.direction,
                    count: set.count,
                    spacing: set.spacing,
                    offset: set.offset,
                    height: set.height
                }));
            }

            // Sync layout, input bounds, values, and recalculate
            updateInputUnitBounds();
            syncStateToInputs();
            calculateAndRender();

            // Clear the file input value so the same file can be loaded again if needed
            if (DOM.inputLoadJson) {
                DOM.inputLoadJson.value = '';
            }

            // Show confirmation alert with the design set name
            alert(`Successfully loaded design set: ${data.name || 'unnamed'}`);

        } catch (err) {
            alert(`Error parsing JSON: ${err.message}`);
        }
    };
    reader.readAsText(file);
}

// Render 2D Plan Visualizer Grid Layout
function renderPlanVisualizer(svg) {
    const svgWidth = 1000;
    const svgHeight = 350;
    const margin = { top: 35, right: 40, bottom: 40, left: 60 };
    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;
    
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const totalWidth = state.slabWidth;
    
    // Scale factor to maintain aspect ratio
    const scale = Math.min(chartW / totalLength, chartH / totalWidth);
    const offsetX = margin.left + (chartW - totalLength * scale) / 2;
    const offsetY = margin.top + (chartH - totalWidth * scale) / 2;
    
    const mapX = (x) => offsetX + x * scale;
    const mapY = (y) => offsetY + y * scale;

    // Cache coordinate parameters for dragging
    state.planCoords = { scale, offsetX, offsetY };
    
    // 1. Slab Boundary
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', mapX(0));
    rect.setAttribute('y', mapY(0));
    rect.setAttribute('width', totalLength * scale);
    rect.setAttribute('height', totalWidth * scale);
    rect.setAttribute('fill', '#090d16');
    rect.setAttribute('stroke', '#334155');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('class', 'svg-slab-edge');
    svg.appendChild(rect);
    
    // 2. Render X Tendons (Horizontal Lines - Red)
    const xTendonsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    state.planXTendons.forEach(y => {
        if (y >= 0 && y <= totalWidth) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', mapX(0));
            line.setAttribute('y1', mapY(y));
            line.setAttribute('x2', mapX(totalLength));
            line.setAttribute('y2', mapY(y));
            line.setAttribute('stroke', '#ef4444');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('opacity', '0.85');
            xTendonsG.appendChild(line);
        }
    });
    svg.appendChild(xTendonsG);
    
    // 3. Render Y Tendons (Vertical Lines - Colored by Perpendicular Set)
    const yTendonsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const activePerpTendons = getActivePerpendicularTendons();
    activePerpTendons.forEach(pt => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', mapX(pt.x));
        line.setAttribute('y1', mapY(0));
        line.setAttribute('x2', mapX(pt.x));
        line.setAttribute('y2', mapY(totalWidth));
        
        line.setAttribute('stroke', getSetColor(pt.setIdx));
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('opacity', '0.8');
        yTendonsG.appendChild(line);
    });
    svg.appendChild(yTendonsG);
    
    // 3.5. Render Clash Warning Circles at X/Y Intersections
    const clashesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    activePerpTendons.forEach(pt => {
        if (pt.isClash) {
            state.planXTendons.forEach(yTendon => {
                if (yTendon >= 0 && yTendon <= totalWidth) {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', mapX(pt.x));
                    circle.setAttribute('cy', mapY(yTendon));
                    circle.setAttribute('r', '5');
                    circle.setAttribute('fill', '#ef4444');
                    circle.setAttribute('stroke', '#ffffff');
                    circle.setAttribute('stroke-width', '1');
                    
                    circle.addEventListener('mousemove', (e) => {
                        const tooltip = DOM.tooltip;
                        if (tooltip) {
                            tooltip.classList.remove('hidden');
                            const svgRect = svg.getBoundingClientRect();
                            tooltip.style.left = `${e.clientX - svgRect.left + 15}px`;
                            tooltip.style.top = `${e.clientY - svgRect.top - 15}px`;
                            tooltip.innerHTML = `
                                <strong>Clash Intersection</strong><br>
                                x: ${pt.x.toFixed(2)}m<br>
                                y: ${yTendon.toFixed(2)}m<br>
                                <span style="color:#ef4444;font-weight:bold;">CLASH DETECTED</span>
                            `;
                        }
                    });
                    circle.addEventListener('mouseout', hideTooltip);
                    clashesG.appendChild(circle);
                }
            });
        }
    });
    svg.appendChild(clashesG);
    
    // 4. Render Columns (Draggable)
    const columnsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    state.planColumns.forEach(col => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', mapX(col.x));
        circle.setAttribute('cy', mapY(col.y));
        circle.setAttribute('r', '7');
        
        let className = 'svg-column-plan svg-drag-node';
        if (!col.enabled) {
            className = 'svg-column-plan-disabled svg-drag-node';
        }
        if (col.lockX || col.lockY) {
            className += ' svg-drag-node-locked';
        }
        circle.setAttribute('class', className);
        circle.setAttribute('opacity', col.enabled ? '1.0' : '0.35');
        
        circle.dataset.type = 'plan-column';
        circle.dataset.id = col.id;
        
        circle.addEventListener('mousedown', (e) => startDrag(e, circle));
        circle.addEventListener('click', (e) => {
            if (dragNode) return;
            showColumnEditor(e, col);
        });
        
        columnsG.appendChild(circle);

        const suppIdx = parseInt(col.id.split('-')[1]);
        const rowIdx = parseInt(col.id.split('-')[2].replace('row', ''));
        const prefix = getColumnPrefix(suppIdx, state.numSpans + 1);
        const colLabel = `${prefix}${rowIdx + 1}`;

        // Padlock icon for locked column nodes in Plan Layout
        if (col.lockX || col.lockY) {
            const lockIcon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            lockIcon.setAttribute('d', 'M -2 0 L 2 0 L 2 -3 C 2 -4 1 -5 0 -5 C -1 -5 -2 -4 -2 -3 Z M -3 0 L 3 0 L 3 4 L -3 4 Z');
            lockIcon.setAttribute('fill', '#f59e0b');
            lockIcon.setAttribute('transform', `translate(${mapX(col.x)}, ${mapY(col.y) - 11}) scale(0.9)`);
            columnsG.appendChild(lockIcon);
        }

        // Column name label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', mapX(col.x) + 11);
        text.setAttribute('y', mapY(col.y) + 3);
        text.setAttribute('fill', col.enabled ? '#94a3b8' : '#4b5563');
        text.setAttribute('font-size', '8px');
        text.setAttribute('font-family', 'JetBrains Mono, monospace');
        text.textContent = colLabel;
        columnsG.appendChild(text);
    });
    svg.appendChild(columnsG);
    
    // 5. Draw dimensions on plan view
    const dimsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Overall Length Dimension (bottom side)
    const lenDim = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lenDim.setAttribute('x1', mapX(0));
    lenDim.setAttribute('y1', mapY(totalWidth) + 15);
    lenDim.setAttribute('x2', mapX(totalLength));
    lenDim.setAttribute('y2', mapY(totalWidth) + 15);
    lenDim.setAttribute('class', 'svg-dimension-line');
    dimsG.appendChild(lenDim);
    
    const lenText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lenText.setAttribute('x', mapX(totalLength / 2));
    lenText.setAttribute('y', mapY(totalWidth) + 28);
    lenText.setAttribute('class', 'svg-dimension-text');
    lenText.textContent = `Length: ${totalLength.toFixed(1)}m (${state.numSpans} spans)`;
    dimsG.appendChild(lenText);
    
    // Overall Width Dimension (left side)
    const widthDim = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    widthDim.setAttribute('x1', mapX(0) - 15);
    widthDim.setAttribute('y1', mapY(0));
    widthDim.setAttribute('x2', mapX(0) - 15);
    widthDim.setAttribute('y2', mapY(totalWidth));
    widthDim.setAttribute('class', 'svg-dimension-line');
    dimsG.appendChild(widthDim);
    
    const widthText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    widthText.setAttribute('x', mapX(0) - 25);
    widthText.setAttribute('y', mapY(totalWidth / 2));
    widthText.setAttribute('class', 'svg-dimension-text');
    widthText.setAttribute('transform', `rotate(-90, ${mapX(0) - 25}, ${mapY(totalWidth / 2)})`);
    widthText.textContent = `Width: ${totalWidth.toFixed(1)}m`;
    dimsG.appendChild(widthText);
    
    // Grid Summary Text
    const summaryText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    summaryText.setAttribute('x', mapX(totalLength / 2));
    summaryText.setAttribute('y', mapY(0) - 10);
    summaryText.setAttribute('fill', '#94a3b8');
    summaryText.setAttribute('font-size', '11px');
    summaryText.setAttribute('font-family', 'Space Grotesk, sans-serif');
    summaryText.setAttribute('font-weight', '500');
    summaryText.setAttribute('text-anchor', 'middle');
    summaryText.textContent = `Grid Layout: ${state.planXTendons.length} Horizontal (Red) | ${activePerpTendons.length} Vertical (Colored by Set)`;
    dimsG.appendChild(summaryText);
    svg.appendChild(dimsG);
    
    // Render Active Section Cut Line (Show Section Taken)
    const sectionLineG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sectionLineG.setAttribute('class', 'svg-section-cut-overlay');
    
    const activeRowIdx = Math.floor(state.selectedRowIdx / 2);
    const isBelow = (state.selectedRowIdx % 2) === 1;
    const rowCols = state.planColumns.filter(c => c.id.endsWith(`-row${activeRowIdx}`));
    const avgY = rowCols.length > 0 ? rowCols.reduce((sum, c) => sum + c.y, 0) / rowCols.length : 0;
    
    const sectionY = Math.max(0.1, Math.min(totalWidth - 0.1, avgY + (isBelow ? 0.6 : -0.6)));
    
    // Transparent clickable overlay first (wider hit target)
    const cutLineOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cutLineOverlay.setAttribute('x1', mapX(0) - 25);
    cutLineOverlay.setAttribute('y1', mapY(sectionY));
    cutLineOverlay.setAttribute('x2', mapX(totalLength) + 25);
    cutLineOverlay.setAttribute('y2', mapY(sectionY));
    cutLineOverlay.setAttribute('stroke', 'transparent');
    cutLineOverlay.setAttribute('stroke-width', '15');
    cutLineOverlay.setAttribute('style', 'cursor: ns-resize;');
    sectionLineG.appendChild(cutLineOverlay);
    
    // Visible dashed line
    const cutLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cutLine.setAttribute('x1', mapX(0) - 25);
    cutLine.setAttribute('y1', mapY(sectionY));
    cutLine.setAttribute('x2', mapX(totalLength) + 25);
    cutLine.setAttribute('y2', mapY(sectionY));
    cutLine.setAttribute('stroke', '#38bdf8');
    cutLine.setAttribute('stroke-width', '1.5');
    cutLine.setAttribute('stroke-dasharray', '5,4');
    cutLine.setAttribute('opacity', '0.9');
    cutLine.setAttribute('class', 'svg-section-cut-line');
    sectionLineG.appendChild(cutLine);
    
    const labelText = isBelow ? `Below Row ${activeRowIdx + 1}` : `Above Row ${activeRowIdx + 1}`;
    
    const leftText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    leftText.setAttribute('x', mapX(0) - 30);
    leftText.setAttribute('y', mapY(sectionY) + 3);
    leftText.setAttribute('fill', '#38bdf8');
    leftText.setAttribute('font-size', '8px');
    leftText.setAttribute('font-family', 'JetBrains Mono, monospace');
    leftText.setAttribute('text-anchor', 'end');
    leftText.setAttribute('style', 'user-select: none; pointer-events: none;');
    leftText.textContent = `▶ ${labelText}`;
    sectionLineG.appendChild(leftText);
    
    const rightText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    rightText.setAttribute('x', mapX(totalLength) + 30);
    rightText.setAttribute('y', mapY(sectionY) + 3);
    rightText.setAttribute('fill', '#38bdf8');
    rightText.setAttribute('font-size', '8px');
    rightText.setAttribute('font-family', 'JetBrains Mono, monospace');
    rightText.setAttribute('text-anchor', 'start');
    rightText.setAttribute('style', 'user-select: none; pointer-events: none;');
    rightText.textContent = `${labelText} ◀`;
    sectionLineG.appendChild(rightText);
    
    // Add drag event listener directly to the section group
    sectionLineG.addEventListener('mousedown', (e) => {
        // Only initiate if left click
        if (e.button !== 0) return;
        e.preventDefault();
        dragNode = {
            element: sectionLineG,
            type: 'section-cut',
            startY: e.clientY
        };
        sectionLineG.classList.add('dragging');
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
    });
    
    svg.appendChild(sectionLineG);
}

function syncSpanLengthsFromColumns() {
    const getSupportXCoord = (idx) => {
        const activeRowIdx = Math.floor(state.selectedRowIdx / 2);
        const col = state.planColumns.find(c => c.id === `col-${idx}-row${activeRowIdx}`);
        return col && col.enabled ? col.x : 0;
    };
    
    for (let i = 1; i <= state.numSpans; i++) {
        const xVal = getSupportXCoord(i);
        const prevX = getSupportXCoord(i - 1);
        state.spanLengths[i-1] = Math.max(3.0, xVal - prevX);
    }
}

function showColumnEditor(e, col) {
    e.stopPropagation();
    
    const existing = document.getElementById('column-editor-overlay');
    if (existing) existing.remove();
    
    const container = document.getElementById('svg-container');
    if (!container) return;
    
    const card = document.createElement('div');
    card.id = 'column-editor-overlay';
    card.className = 'column-editor-card';
    
    const containerRect = container.getBoundingClientRect();
    let leftPos = e.clientX - containerRect.left + 15;
    let topPos = e.clientY - containerRect.top - 15;
    
    if (leftPos + 260 > containerRect.width) {
        leftPos = e.clientX - containerRect.left - 275;
    }
    if (topPos + 180 > containerRect.height) {
        topPos = containerRect.height - 190;
    }
    card.style.left = `${Math.max(10, leftPos)}px`;
    card.style.top = `${Math.max(10, topPos)}px`;
    
    const suppIdx = parseInt(col.id.split('-')[1]);
    const rowIdx = parseInt(col.id.split('-')[2].replace('row', ''));
    
    // Automatically set the active row selection to match this column!
    state.selectedRowIdx = 2 * rowIdx;
    
    const prefix = getColumnPrefix(suppIdx, state.numSpans + 1);
    const colName = `${prefix}${rowIdx + 1}`;
    
    const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
    const totalWidth = state.slabWidth;
    
    const isSupport0 = col.id.includes('col-0');
    const disabledAttr = isSupport0 ? 'disabled' : '';
    
    card.innerHTML = `
        <div class="column-editor-header">
            <span class="column-editor-title">${colName} Settings</span>
            <button class="column-editor-close" id="btn-col-editor-close">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="column-editor-body">
            <div class="column-editor-checkbox-row">
                <input type="checkbox" id="chk-col-enabled" class="column-editor-checkbox" ${col.enabled ? 'checked' : ''}>
                <label for="chk-col-enabled" style="cursor: pointer; color: var(--text-primary);">Enable Column</label>
            </div>
            
            <div class="column-editor-row">
                <span class="column-editor-label">Dist from Left (x):</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" id="input-col-dist-left" class="column-editor-input" value="${col.x.toFixed(2)}" step="0.05" min="0" max="${totalLength.toFixed(2)}" ${disabledAttr}>
                    <span style="font-size: 0.65rem; color: var(--text-muted); margin-right: 4px;">m</span>
                    <button class="btn-lock-inline ${col.lockX ? 'locked' : ''}" id="btn-col-lock-x" title="${col.lockX ? 'Unlock X' : 'Lock X'}" ${disabledAttr}>
                        ${col.lockX 
                            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
                            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`
                        }
                    </button>
                </div>
            </div>
            
            <div class="column-editor-row">
                <span class="column-editor-label">Dist from Right:</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" id="input-col-dist-right" class="column-editor-input" value="${(totalLength - col.x).toFixed(2)}" step="0.05" min="0" max="${totalLength.toFixed(2)}" ${disabledAttr}>
                    <span style="font-size: 0.65rem; color: var(--text-muted); margin-right: 4px;">m</span>
                </div>
            </div>
            
            <div class="column-editor-row">
                <span class="column-editor-label">Dist from Top (y):</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" id="input-col-dist-edge" class="column-editor-input" value="${col.y.toFixed(2)}" step="0.05" min="0" max="${totalWidth.toFixed(2)}">
                    <span style="font-size: 0.65rem; color: var(--text-muted); margin-right: 4px;">m</span>
                    <button class="btn-lock-inline ${col.lockY ? 'locked' : ''}" id="btn-col-lock-y" title="${col.lockY ? 'Unlock Y' : 'Lock Y'}">
                        ${col.lockY 
                            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
                            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`
                        }
                    </button>
                </div>
            </div>
            
            <div class="column-editor-row">
                <span class="column-editor-label">Dist from Bottom:</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" id="input-col-dist-other-edge" class="column-editor-input" value="${(totalWidth - col.y).toFixed(2)}" step="0.05" min="0" max="${totalWidth.toFixed(2)}">
                    <span style="font-size: 0.65rem; color: var(--text-muted); margin-right: 4px;">m</span>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(card);
    
    const chkEnabled = card.querySelector('#chk-col-enabled');
    const inputLeft = card.querySelector('#input-col-dist-left');
    const inputRight = card.querySelector('#input-col-dist-right');
    const inputEdge = card.querySelector('#input-col-dist-edge');
    const inputOtherEdge = card.querySelector('#input-col-dist-other-edge');
    const btnClose = card.querySelector('#btn-col-editor-close');
    const btnLockX = card.querySelector('#btn-col-lock-x');
    const btnLockY = card.querySelector('#btn-col-lock-y');
    
    btnClose.addEventListener('click', () => card.remove());
    
    chkEnabled.addEventListener('change', () => {
        col.enabled = chkEnabled.checked;
        calculateAndRender();
        showColumnEditor(e, col);
    });
    
    if (btnLockX) {
        btnLockX.addEventListener('click', () => {
            col.lockX = !col.lockX;
            calculateAndRender();
            showColumnEditor(e, col);
        });
    }
    
    if (btnLockY) {
        btnLockY.addEventListener('click', () => {
            col.lockY = !col.lockY;
            calculateAndRender();
            showColumnEditor(e, col);
        });
    }
    
    if (!isSupport0) {
        const updateXCoordinate = (newX) => {
            let minX = 0;
            let maxX = totalLength;
            if (suppIdx > 0) {
                const prevCol = state.planColumns.find(c => c.id === `col-${suppIdx-1}-row${rowIdx}`);
                if (prevCol) minX = prevCol.x + 3.0;
            }
            if (suppIdx < state.numSpans) {
                const nextCol = state.planColumns.find(c => c.id === `col-${suppIdx+1}-row${rowIdx}`);
                if (nextCol) maxX = nextCol.x - 3.0;
            }
            
            const clampedX = Math.max(minX, Math.min(maxX, newX));
            col.x = clampedX;
            
            syncSpanLengthsFromColumns();
            calculateAndRender();
            
            inputLeft.value = clampedX.toFixed(2);
            inputRight.value = (totalLength - clampedX).toFixed(2);
        };
        
        inputLeft.addEventListener('change', () => {
            const val = parseFloat(inputLeft.value) || col.x;
            updateXCoordinate(val);
        });
        
        inputRight.addEventListener('change', () => {
            const val = parseFloat(inputRight.value) || (totalLength - col.x);
            updateXCoordinate(totalLength - val);
        });
    }
    
    const updateYCoordinate = (newY) => {
        const clampedY = Math.max(0, Math.min(totalWidth, newY));
        col.y = clampedY;
        calculateAndRender();
        
        inputEdge.value = clampedY.toFixed(2);
        inputOtherEdge.value = (totalWidth - clampedY).toFixed(2);
    };
    
    inputEdge.addEventListener('change', () => {
        const val = parseFloat(inputEdge.value) || 0;
        updateYCoordinate(val);
    });
    
    inputOtherEdge.addEventListener('change', () => {
        const val = parseFloat(inputOtherEdge.value) || 0;
        updateYCoordinate(totalWidth - val);
    });
    
    const clickOutsideHandler = (event) => {
        if (!card.contains(event.target) && event.target !== e.target) {
            card.remove();
            document.removeEventListener('click', clickOutsideHandler);
        }
    };
    document.addEventListener('click', clickOutsideHandler);
}

// Parameter Help System
const PARAM_HELP = {
    'slab-geometry': {
        title: 'Slab Geometry Parameters',
        diagram: `<svg viewBox="0 0 560 220" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="rgba(148,163,184,0.8)"/></marker></defs>
  <!-- Slab -->
  <rect x="40" y="60" width="480" height="80" rx="4" fill="rgba(17,24,39,0.9)" stroke="rgba(55,65,81,0.9)" stroke-width="1.5"/>
  <!-- Width arrow -->
  <line x1="40" y1="155" x2="520" y2="155" stroke="rgba(148,163,184,0.7)" stroke-width="1" marker-end="url(#arr)" marker-start="url(#arr)"/>
  <text x="280" y="170" fill="#94a3b8" font-size="10" font-family="JetBrains Mono,monospace" text-anchor="middle">Slab Width (W)</text>
  <!-- Height arrow -->
  <line x1="25" y1="60" x2="25" y2="140" stroke="rgba(148,163,184,0.7)" stroke-width="1" marker-end="url(#arr)" marker-start="url(#arr)"/>
  <text x="18" y="103" fill="#94a3b8" font-size="9" font-family="JetBrains Mono,monospace" text-anchor="middle" transform="rotate(-90,18,103)">h (thickness)</text>
  <!-- Spans -->
  <line x1="40" y1="55" x2="230" y2="55" stroke="#38bdf8" stroke-width="1" marker-end="url(#arr)" marker-start="url(#arr)"/>
  <text x="135" y="48" fill="#38bdf8" font-size="9" font-family="JetBrains Mono,monospace" text-anchor="middle">Span 1 (L1)</text>
  <line x1="231" y1="55" x2="520" y2="55" stroke="#10b981" stroke-width="1" marker-end="url(#arr)" marker-start="url(#arr)"/>
  <text x="376" y="48" fill="#10b981" font-size="9" font-family="JetBrains Mono,monospace" text-anchor="middle">Span 2 (L2)</text>
  <!-- Support columns -->
  <rect x="215" y="140" width="20" height="30" fill="rgba(30,41,59,0.8)" stroke="#475569" stroke-width="1"/>
  <rect x="36" y="140" width="20" height="30" fill="rgba(30,41,59,0.8)" stroke="#475569" stroke-width="1"/>
  <rect x="502" y="140" width="20" height="30" fill="rgba(30,41,59,0.8)" stroke="#475569" stroke-width="1"/>
  <!-- Label -->
  <text x="280" y="210" fill="#94a3b8" font-size="9" font-family="Space Grotesk,sans-serif" text-anchor="middle">Y-Span (transverse direction, perpendicular tendons)</text>
</svg>`,
        params: [
            { name: 'Number of Spans', range: '1–3', desc: 'How many continuous bays the slab has in the X direction. Controls span length inputs.' },
            { name: 'Slab Thickness (h)', range: '10–60 cm', desc: 'Total depth of the concrete slab. Greater depth allows more tendon drape and self-weight.' },
            { name: 'Slab Width (W)', range: '2–100 m', desc: 'Transverse dimension (Y-direction) for load balancing and plan layout.' },
            { name: 'Span Length (L)', range: '3–25 m', desc: 'Individual span length in X-direction. Can be different per span.' },
            { name: 'Y-Span Length', range: '3–25 m', desc: 'Span length used for perpendicular (Y-direction) tendons.' },
            { name: 'Concrete Density', range: '20–26 kN/m³', desc: 'Used to compute self-weight load for balancing: w = density × h × width.' },
        ]
    },
    'concrete-cover': {
        title: 'Concrete Cover & Clearances',
        diagram: `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Slab -->
  <rect x="40" y="40" width="480" height="110" rx="4" fill="rgba(17,24,39,0.9)" stroke="rgba(55,65,81,0.9)" stroke-width="1.5"/>
  <!-- Top cover -->
  <line x1="40" y1="60" x2="520" y2="60" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="4,4"/>
  <text x="530" y="64" fill="#ef4444" font-size="9" font-family="JetBrains Mono,monospace">c_top</text>
  <!-- Bottom cover -->
  <line x1="40" y1="130" x2="520" y2="130" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="4,4"/>
  <text x="530" y="134" fill="#ef4444" font-size="9" font-family="JetBrains Mono,monospace">c_bot</text>
  <!-- Tendon path -->
  <path d="M 80 130 Q 180 130 230 70 T 300 55 T 370 70 Q 420 130 480 130" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
  <!-- Cover dim arrows -->
  <line x1="22" y1="40" x2="22" y2="60" stroke="rgba(239,68,68,0.7)" stroke-width="1" marker-end="url(#arr2)" marker-start="url(#arr2)"/>
  <text x="14" y="53" fill="#ef4444" font-size="8" text-anchor="middle" font-family="JetBrains Mono,monospace" transform="rotate(-90,14,53)">c_top</text>
  <line x1="22" y1="130" x2="22" y2="150" stroke="rgba(239,68,68,0.7)" stroke-width="1" marker-end="url(#arr2)" marker-start="url(#arr2)"/>
  <text x="14" y="143" fill="#ef4444" font-size="8" text-anchor="middle" font-family="JetBrains Mono,monospace" transform="rotate(-90,14,143)">c_bot</text>
  <!-- Inflection point -->
  <circle cx="300" cy="55" r="5" fill="#38bdf8" stroke="#1e293b" stroke-width="2"/>
  <text x="310" y="50" fill="#38bdf8" font-size="9" font-family="Space Grotesk,sans-serif">Support Peak</text>
  <text x="90" y="145" fill="#38bdf8" font-size="9" font-family="Space Grotesk,sans-serif">Span Low Pt</text>
  <defs><marker id="arr2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="rgba(239,68,68,0.8)"/></marker></defs>
</svg>`,
        params: [
            { name: 'Top Cover (c_top)', range: '1.5–10 cm', desc: 'Minimum concrete from slab top face to tendon. Tendon cannot rise above (h - c_top).' },
            { name: 'Bottom Cover (c_bot)', range: '1.5–10 cm', desc: 'Minimum concrete from slab bottom face to tendon. Tendon cannot dip below c_bot.' },
            { name: 'Inflection Ratio (a/L)', range: '0.05–0.25', desc: 'Sets where the parabola inflects from the support high-point. Controls the curvature zone at supports.' },
            { name: 'Min Support Angle (°)', range: '0–45°', desc: 'Minimum allowable tendon slope angle at the support. Too flat means poor friction.' },
            { name: 'Max Support Angle (°)', range: '0–45°', desc: 'Maximum allowable tendon slope at the support. Too steep causes excessive bearing stress.' },
        ]
    },
    'tendon-prestressing': {
        title: 'Tendon & Prestressing Parameters',
        diagram: `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Slab -->
  <rect x="40" y="50" width="480" height="90" rx="4" fill="rgba(17,24,39,0.9)" stroke="rgba(55,65,81,0.9)" stroke-width="1.5"/>
  <!-- Tendon -->
  <path d="M 50 130 Q 150 130 220 85 T 300 60 T 380 85 Q 440 130 520 130" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
  <!-- Duct envelope -->
  <path d="M 50 127 Q 150 127 220 82 T 300 57 T 380 82 Q 440 127 520 127" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2,2" opacity="0.45"/>
  <path d="M 50 133 Q 150 133 220 88 T 300 63 T 380 88 Q 440 133 520 133" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2,2" opacity="0.45"/>
  <!-- Jacking arrow -->
  <text x="50" y="45" fill="#38bdf8" font-size="9" font-family="Space Grotesk,sans-serif">P₀ (Jacking Force)</text>
  <line x1="52" y1="130" x2="80" y2="130" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrBlue)"/>
  <!-- Spacing -->
  <line x1="200" y1="165" x2="260" y2="165" stroke="#10b981" stroke-width="1" marker-end="url(#arrGrn)" marker-start="url(#arrGrn)"/>
  <text x="230" y="178" fill="#10b981" font-size="9" text-anchor="middle" font-family="JetBrains Mono,monospace">spacing</text>
  <!-- Duct OD label -->
  <circle cx="220" cy="85" r="7" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <text x="235" y="80" fill="#94a3b8" font-size="8" font-family="JetBrains Mono,monospace">Duct OD</text>
  <defs>
    <marker id="arrBlue" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="#38bdf8"/></marker>
    <marker id="arrGrn" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="#10b981"/></marker>
  </defs>
</svg>`,
        params: [
            { name: 'X Jacking Force (P₀)', range: '100–5000 kN', desc: 'Total prestress applied at the jacking end in the X (longitudinal) direction.' },
            { name: 'Y Jacking Force', range: '100–5000 kN', desc: 'Total prestress applied to perpendicular (Y-direction) tendons.' },
            { name: 'Jacking End', range: 'Left/Right/Both', desc: 'Which end the jack is applied from. "Both" applies full force from both ends (reduces friction losses).' },
            { name: 'Anchor Set (Δ)', range: '0–1.5 cm', desc: 'Wedge slip at anchor on release. Creates a reverse loss zone near the jacking end.' },
            { name: 'Curvature Coeff (μ)', range: '0.05–0.30', desc: 'Friction loss factor per radian of curvature. Higher μ = more loss along curves.' },
            { name: 'Wobble Coeff (k)', range: '0.0005–0.005 rad/m', desc: 'Unintended angular deviation per metre. Represents imperfect duct alignment.' },
            { name: 'X Spacing', range: '0.5–5 m', desc: 'Centre-to-centre distance between longitudinal tendons in the X direction.' },
            { name: 'Y Spacing', range: '0.5–5 m', desc: 'Centre-to-centre distance between perpendicular tendons in the Y direction.' },
            { name: 'Duct Outer Diameter', range: '1.0–15 cm', desc: 'External diameter of the tendon duct. Used for clash detection and cover check.' },
        ]
    }
};

function showParamHelp(key) {
    const data = PARAM_HELP[key];
    if (!data) return;

    const modal = document.getElementById('param-help-modal');
    const title = document.getElementById('param-help-title');
    const body = document.getElementById('param-help-body');
    if (!modal || !title || !body) return;

    title.textContent = data.title;

    let html = `<div class="param-help-diagram">${data.diagram}</div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
      <thead>
        <tr style="background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
          <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-family:'Space Grotesk',sans-serif;">Parameter</th>
          <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-family:'Space Grotesk',sans-serif;width:100px;">Range</th>
          <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-family:'Space Grotesk',sans-serif;">Description</th>
        </tr>
      </thead>
      <tbody>`;

    data.params.forEach((p, i) => {
        const bg = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
        html += `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,0.04);">
          <td style="padding:7px 10px;color:#38bdf8;font-family:'JetBrains Mono',monospace;font-size:0.75rem;white-space:nowrap;">${p.name}</td>
          <td style="padding:7px 10px;color:#f59e0b;font-family:'JetBrains Mono',monospace;font-size:0.7rem;">${p.range}</td>
          <td style="padding:7px 10px;color:#cbd5e1;font-size:0.78rem;line-height:1.45;">${p.desc}</td>
        </tr>`;
    });
    html += `</tbody></table>`;

    body.innerHTML = html;
    modal.classList.remove('hidden');
}

// Start the Application
window.addEventListener('DOMContentLoaded', init);
