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
    planXTendons: [1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5], // Y-coordinates in meters
    planYTendons: [
        [1.5, 2.0, 6.0, 6.5], // Span 1 relative X
        [1.5, 2.0, 7.0, 7.5, 8.0, 8.5], // Span 2 relative X
        [1.5, 2.0, 6.0, 6.5] // Span 3 relative X
    ],
    planColumns: [], // Array of { id, x, y }

    // Calculated Data Cache
    sampledPoints: [], // List of { xGlobal, xLocal, spanIndex, y, dy, ddy, force, alpha }
    chartData: []
};

// UI Elements
const DOM = {
    numSpans: document.getElementById('num-spans'),
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
    tooltip: document.getElementById('canvas-tooltip'),
    
    // Tab selectors
    tabElevation: document.getElementById('tab-elevation'),
    tabPlan: document.getElementById('tab-plan'),
    visualizerLegend: document.getElementById('visualizer-legend'),
    nodeInputsContainer: document.getElementById('node-inputs-container')
};

// SVG Drag State
let dragNode = null;

// Initialize App
function init() {
    updateInputUnitBounds();
    setupEventListeners();
    resetDesign();
    calculateAndRender();
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
    
    // Update labels in HTML
    document.querySelectorAll('.unit-label-thickness').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-cover').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-anchorset').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
    document.querySelectorAll('.unit-label-y').forEach(el => el.textContent = isCm ? 'cm' : 'mm');
}

// Reset Design to default values based on current geometry
function resetDesign() {
    state.unit = 'cm';
    if (DOM.unitSelect) DOM.unitSelect.value = 'cm';
    updateInputUnitBounds();

    const h = state.slabThickness;

    // Reset control heights based on user specific coordinates
    state.controlPoints.supports[0] = h - 30; // 30 from top (left end support)
    
    for (let i = 1; i <= state.numSpans; i++) {
        // All subsequent supports (interior and right end) are 25 from top
        state.controlPoints.supports[i] = h - 25;
    }
    state.controlPoints.supports = state.controlPoints.supports.slice(0, state.numSpans + 1);

    state.controlPoints.supportsLocked = new Array(state.numSpans + 1).fill(false);
    state.controlPoints.lowPointsLocked = new Array(state.numSpans).fill(false);

    state.controlPoints.lowPoints = [];
    state.controlPoints.lowPoints.push({ xFract: 0.4, y: 25 }); // Span 1: 25 from bottom
    if (state.numSpans >= 2) {
        state.controlPoints.lowPoints.push({ xFract: 0.6, y: 30 }); // Span 2: 30 from bottom
    }
    if (state.numSpans >= 3) {
        state.controlPoints.lowPoints.push({ xFract: 0.5, y: 25 }); // Span 3: 25 from bottom
    }
    
    // Reset 2D Plan Layout State
    state.planXTendons = [1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5];
    state.planYTendons = [
        [1.5, 2.0, 6.0, 6.5],
        [1.5, 2.0, 7.0, 7.5, 8.0, 8.5],
        [1.5, 2.0, 6.0, 6.5]
    ].slice(0, state.numSpans);

    const w = state.slabWidth;
    const Ly = state.spanYLen;
    const yTop = (w - Ly) / 2;
    const yBottom = yTop + Ly;
    
    state.planColumns = [];
    let currentX = 0;
    
    // Support 0 (x=0)
    state.planColumns.push({ id: 'col-0-top', x: 0, y: yTop });
    state.planColumns.push({ id: 'col-0-bottom', x: 0, y: yBottom });
    
    for (let i = 0; i < state.numSpans; i++) {
        currentX += state.spanLengths[i];
        state.planColumns.push({ id: `col-${i+1}-top`, x: currentX, y: yTop });
        state.planColumns.push({ id: `col-${i+1}-bottom`, x: currentX, y: yBottom });
    }
    
    // Sync inputs with state
    syncStateToInputs();
}

// Sync values from UI inputs into State
function syncInputsToState() {
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
    
    state.spanLengths = [
        parseFloat(DOM.span1Len.value),
        parseFloat(DOM.span2Len.value),
        parseFloat(DOM.span3Len.value)
    ].slice(0, state.numSpans);

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
    state.tendonSpacingY = parseFloat(DOM.tendonSpacingY.value);
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
    const w = state.slabWidth;
    const Ly = state.spanYLen;
    const yTop = (w - Ly) / 2;
    const yBottom = yTop + Ly;

    const expectedColCount = (state.numSpans + 1) * 2;
    if (state.planColumns.length !== expectedColCount) {
        state.planColumns = [];
        let currentX = 0;
        state.planColumns.push({ id: 'col-0-top', x: 0, y: yTop });
        state.planColumns.push({ id: 'col-0-bottom', x: 0, y: yBottom });
        for (let i = 0; i < state.numSpans; i++) {
            currentX += state.spanLengths[i];
            state.planColumns.push({ id: `col-${i+1}-top`, x: currentX, y: yTop });
            state.planColumns.push({ id: `col-${i+1}-bottom`, x: currentX, y: yBottom });
        }
    } else {
        const totalL = state.spanLengths.reduce((a, b) => a + b, 0);
        state.planColumns.forEach(col => {
            col.x = Math.min(totalL, col.x);
            col.y = Math.min(w, col.y);
        });
    }

    while (state.planYTendons.length < state.numSpans) {
        state.planYTendons.push([1.5, 2.0, 6.0, 6.5]);
    }
    state.planYTendons = state.planYTendons.slice(0, state.numSpans);
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
    DOM.unitSelect.value = state.unit;
    DOM.numSpans.value = state.numSpans;
    DOM.slabThickness.value = fromMm(state.slabThickness);
    DOM.slabWidth.value = state.slabWidth;
    DOM.spanYLen.value = state.spanYLen;
    DOM.concreteDensity.value = state.concreteDensity;
    
    DOM.span1Len.value = state.spanLengths[0] || 8.0;
    if (state.spanLengths[1]) DOM.span2Len.value = state.spanLengths[1];
    if (state.spanLengths[2]) DOM.span3Len.value = state.spanLengths[2];
    
    DOM.coverTop.value = fromMm(state.coverTop);
    DOM.coverBottom.value = fromMm(state.coverBottom);
    DOM.inflectionRatio.value = state.inflectionRatio;
    DOM.inflectionRatioVal.innerText = state.inflectionRatio.toFixed(2);

    DOM.tendonForce.value = state.tendonForce;
    DOM.tendonForceY.value = state.tendonForceY;
    DOM.jackingEnd.value = state.jackingEnd;
    DOM.frictionMu.value = state.frictionMu;
    DOM.frictionK.value = state.frictionK;
    DOM.anchorSet.value = fromMm(state.anchorSet);
    DOM.tendonSpacingX.value = state.tendonSpacingX;
    DOM.tendonSpacingY.value = state.tendonSpacingY;
    DOM.verticalExaggeration.value = state.verticalExaggeration;

    // Toggle span length containers depending on count
    DOM.span2Container.style.display = state.numSpans >= 2 ? 'block' : 'none';
    DOM.span3Container.style.display = state.numSpans >= 3 ? 'block' : 'none';

    // Toggle sidebar parameter panels based on active tab
    const elevPanel = document.getElementById('section-elevation-heights');
    const planPanel = document.getElementById('section-plan-layout');
    
    if (state.activeTab === 'plan') {
        if (elevPanel) elevPanel.style.display = 'none';
        if (planPanel) planPanel.style.display = 'block';
        updateSidebarPlanInputs();
    } else {
        if (elevPanel) elevPanel.style.display = 'block';
        if (planPanel) planPanel.style.display = 'none';
    }
}

// Math Engine: Evaluates height, slope, and curvature of the tendon path
function getTendonProfile(xGlobal) {
    // 1. Locate which span this x lies in
    let cumulativeX = 0;
    let spanIndex = -1;
    let localX = 0;
    
    for (let i = 0; i < state.numSpans; i++) {
        const len = state.spanLengths[i];
        if (xGlobal >= cumulativeX && xGlobal <= cumulativeX + len + 0.0001) {
            spanIndex = i;
            localX = xGlobal - cumulativeX;
            break;
        }
        cumulativeX += len;
    }
    
    // Fallback if boundary check overflows slightly
    if (spanIndex === -1) {
        spanIndex = state.numSpans - 1;
        localX = state.spanLengths[spanIndex];
    }
    
    const L = state.spanLengths[spanIndex];
    const yL = state.controlPoints.supports[spanIndex];
    const yR = state.controlPoints.supports[spanIndex + 1];
    
    const lp = state.controlPoints.lowPoints[spanIndex];
    const xm = lp.xFract * L;
    const ym = lp.y;
    const aRatio = state.inflectionRatio;
    
    let y = 0;
    let dy = 0; // slope (dy/dx)
    let ddy = 0; // second derivative (d2y/dx2)
    
    // Formulate reversed parabolas in two halves
    if (localX <= xm) {
        // Left half-span: transition from yL at localX=0 to ym at localX=xm
        // Let X1 = xm, Y1 = yL - ym. Inflection point at b1 * X1 from left support (localX = b1 * X1)
        const X1 = xm;
        const Y1 = yL - ym;
        const b1 = Math.max(0.05, Math.min(0.95, (aRatio * L) / X1));
        const xInf = b1 * X1; // Inflection point location from support
        
        // Curve parameters
        const a1_low = Y1 / ((1 - b1) * X1 * X1);
        const a1_supp = Y1 / (b1 * X1 * X1);
        
        if (localX >= xInf) {
            // Near low point (parabola open upwards)
            const dx = xm - localX;
            y = ym + a1_low * dx * dx;
            dy = -2 * a1_low * dx;
            ddy = 2 * a1_low;
        } else {
            // Near support (parabola open downwards)
            const dx = localX;
            y = yL - a1_supp * dx * dx;
            dy = -2 * a1_supp * dx;
            ddy = -2 * a1_supp;
        }
    } else {
        // Right half-span: transition from ym at localX=xm to yR at localX=L
        // Let X2 = L - xm, Y2 = yR - ym. Inflection point at b2 * X2 from right support (localX = L - b2 * X2)
        const X2 = L - xm;
        const Y2 = yR - ym;
        const b2 = Math.max(0.05, Math.min(0.95, (aRatio * L) / X2));
        const xInf = L - b2 * X2; // Inflection point location from support
        
        // Curve parameters
        const a2_low = Y2 / ((1 - b2) * X2 * X2);
        const a2_supp = Y2 / (b2 * X2 * X2);
        
        if (localX <= xInf) {
            // Near low point (parabola open upwards)
            const dx = localX - xm;
            y = ym + a2_low * dx * dx;
            dy = 2 * a2_low * dx;
            ddy = 2 * a2_low;
        } else {
            // Near support (parabola open downwards)
            const dx = L - localX;
            y = yR - a2_supp * dx * dx;
            dy = 2 * a2_supp * dx; // Slope decreases to 0 at support
            ddy = -2 * a2_supp;
        }
    }
    
    // Note: heights are in mm, slopes are in mm/m = rad * 1000.
    // Convert y back to mm, but convert dy (mm/m) to actual dimensionless slope (rad)
    // localX is in meters, y is in mm. So dy/dx has units of mm/m.
    // Convert dy to rad by dividing by 1000. ddy is in mm/m² -> rad/m (divide by 1000).
    return {
        y: y, // mm
        dy: dy / 1000, // rad
        ddy: ddy / 1000, // rad/m
        spanIndex: spanIndex,
        localX: localX
    };
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
    const svg = DOM.profileSvg;
    svg.innerHTML = ''; // Clear previous SVG tags

    // Toggle legend and render based on active view tab
    if (state.activeTab === 'plan') {
        DOM.visualizerLegend.innerHTML = `
            <span class="legend-item"><span class="legend-dot c-slab"></span>Slab Edge</span>
            <span class="legend-item"><span class="legend-dot c-tendon"></span>X Tendons (${state.tendonSpacingX.toFixed(1)}m spacing)</span>
            <span class="legend-item"><span class="legend-dot" style="background-color: #10b981;"></span>Y Tendons (${state.tendonSpacingY.toFixed(1)}m spacing)</span>
            <span class="legend-item"><span class="legend-dot c-handles" style="background-color: #1e293b; border: 1px solid #475569;"></span>Columns</span>
        `;
        renderPlanVisualizer(svg);
        return;
    }

    DOM.visualizerLegend.innerHTML = `
        <span class="legend-item"><span class="legend-dot c-slab"></span>Slab</span>
        <span class="legend-item"><span class="legend-dot c-tendon"></span>Tendon</span>
        <span class="legend-item"><span class="legend-dot c-limits"></span>Cover Limits</span>
        <span class="legend-item"><span class="legend-dot c-handles"></span>Drag Handles</span>
    `;
    
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
    
    // Render support columns
    let colX = 0;
    for (let i = 0; i <= state.numSpans; i++) {
        const sx = scaleX(colX);
        const col = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        col.setAttribute('x', sx - 12);
        col.setAttribute('y', slabBottomY);
        col.setAttribute('width', '24');
        col.setAttribute('height', '40');
        col.setAttribute('class', 'svg-support-column');
        svg.appendChild(col);
        
        if (i < state.numSpans) colX += state.spanLengths[i];
    }

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

    // 5. Render Tendon Path (Polyline/path from sampled points)
    // Check if any point violates concrete cover envelope
    let coverViolation = false;
    let pathD = '';
    
    state.sampledPoints.forEach((pt, idx) => {
        const sx = scaleX(pt.xGlobal);
        const sy = mapYToSvg(pt.y);
        
        // Highlight cover violations
        if (pt.y > hSlab - state.coverTop + 0.1 || pt.y < state.coverBottom - 0.1) {
            coverViolation = true;
        }
        
        if (idx === 0) {
            pathD += `M ${sx} ${sy}`;
        } else {
            pathD += ` L ${sx} ${sy}`;
        }
    });
    
    const tendonPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tendonPath.setAttribute('d', pathD);
    tendonPath.setAttribute('class', coverViolation ? 'svg-tendon-line-warning' : 'svg-tendon-line');
    tendonPath.addEventListener('mousemove', (e) => showTendonTooltip(e));
    tendonPath.addEventListener('mouseout', hideTooltip);
    svg.appendChild(tendonPath);

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
    
    const svgRect = DOM.profileSvg.getBoundingClientRect();

    if (dragNode.type === 'plan-column') {
        const id = dragNode.element.dataset.id;
        const totalLength = state.spanLengths.reduce((a, b) => a + b, 0);
        const totalWidth = state.slabWidth;
        const pc = state.planCoords;
        if (pc) {
            const relativeX = ((e.clientX - svgRect.left) / svgRect.width) * 1000;
            const relativeY = ((e.clientY - svgRect.top) / svgRect.height) * 350;
            
            const x = (relativeX - pc.offsetX) / pc.scale;
            const y = (relativeY - pc.offsetY) / pc.scale;
            
            const col = state.planColumns.find(c => c.id === id);
            if (col) {
                col.x = Math.max(0, Math.min(totalLength, x));
                col.y = Math.max(0, Math.min(totalWidth, y));
            }
            
            renderVisualizer();
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
    ctx.textAlign = 'middle';
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
    DOM.minForceVal.textContent = `${minP.toFixed(0)} kN`;
    const maxLossPercent = ((P0 - minP) / P0) * 100;
    DOM.maxLossVal.textContent = `${maxLossPercent.toFixed(1)}%`;
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
    const tblIncrement = 0.50; // meters
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
}

// Master execution block
// Master execution block
function calculateAndRender() {
    calculateFrictionAndLosses();
    renderVisualizer();
    renderLossChart();
    updateSidebarNodeInputs();
    updateChecksAndOutputs();
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

// Render Plan-view parameter inputs dynamically in the sidebar
function renderSidebarPlanInputs() {
    const yTendonsContainer = document.getElementById('plan-y-tendons-container');
    const columnsContainer = document.getElementById('plan-columns-container');
    if (!yTendonsContainer || !columnsContainer) return;

    // 1. Render Y Tendons Spans X inputs
    yTendonsContainer.innerHTML = '';
    for (let i = 0; i < state.numSpans; i++) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.style.marginBottom = '0.5rem';
        
        const label = document.createElement('label');
        label.style.fontSize = '0.7rem';
        label.textContent = `Span ${i + 1} Y-Tendons X (m, relative)`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.id = `input-plan-y-tendons-${i}`;
        if (!state.planYTendons[i]) {
            state.planYTendons[i] = [1.5, 2.0, 6.0, 6.5];
        }
        input.value = state.planYTendons[i].join(', ');
        
        input.addEventListener('change', () => {
            const vals = input.value.split(',')
                .map(v => parseFloat(v.trim()))
                .filter(v => !isNaN(v) && v >= 0 && v <= state.spanLengths[i]);
            state.planYTendons[i] = vals.sort((a, b) => a - b);
            input.value = state.planYTendons[i].join(', ');
            calculateAndRender();
        });
        
        div.appendChild(label);
        div.appendChild(input);
        yTendonsContainer.appendChild(div);
    }

    // 2. Render Column Inputs
    columnsContainer.innerHTML = '';
    state.planColumns.forEach((col) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1.2fr 1fr 1fr';
        row.style.gap = '0.4rem';
        row.style.alignItems = 'center';
        row.style.marginBottom = '0.2rem';
        
        const label = document.createElement('div');
        label.style.fontSize = '0.65rem';
        label.style.fontWeight = '600';
        label.style.color = 'var(--text-secondary)';
        label.textContent = col.id.replace('col-', 'Col ').replace('-top', ' T').replace('-bottom', ' B');
        
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
}

// Sync values of Plan Layout UI inputs with current state variables
function updateSidebarPlanInputs() {
    const xInput = document.getElementById('input-plan-x-tendons');
    if (xInput && document.activeElement !== xInput) {
        xInput.value = state.planXTendons.join(', ');
    }

    const yTendonsContainer = document.getElementById('plan-y-tendons-container');
    const expectedYTendonInputCount = state.numSpans;
    const currentYTendonInputCount = yTendonsContainer ? yTendonsContainer.querySelectorAll('input').length : 0;
    
    const columnsContainer = document.getElementById('plan-columns-container');
    const expectedColInputCount = (state.numSpans + 1) * 2;
    const currentColInputCount = columnsContainer ? columnsContainer.querySelectorAll('input').length / 2 : 0;

    if (expectedYTendonInputCount !== currentYTendonInputCount || expectedColInputCount !== currentColInputCount) {
        renderSidebarPlanInputs();
    } else {
        for (let i = 0; i < state.numSpans; i++) {
            const yInput = document.getElementById(`input-plan-y-tendons-${i}`);
            if (yInput && document.activeElement !== yInput) {
                yInput.value = state.planYTendons[i].join(', ');
            }
        }

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
        DOM.numSpans, DOM.slabThickness, DOM.slabWidth, DOM.spanYLen, DOM.concreteDensity,
        DOM.span1Len, DOM.span2Len, DOM.span3Len,
        DOM.coverTop, DOM.coverBottom, DOM.inflectionRatio,
        DOM.tendonForce, DOM.tendonForceY, DOM.jackingEnd, DOM.frictionMu, DOM.frictionK,
        DOM.anchorSet, DOM.tendonSpacingX, DOM.tendonSpacingY, DOM.verticalExaggeration
    ];
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            syncInputsToState();
            calculateAndRender();
        });
        input.addEventListener('change', () => {
            syncInputsToState();
            calculateAndRender();
        });
    });

    // Reset button
    DOM.btnReset.addEventListener('click', () => {
        resetDesign();
        calculateAndRender();
    });

    // Export CSV
    DOM.btnExportCsv.addEventListener('click', exportCSV);

    // Custom Plan View Tendons configuration
    const planXTendonsInput = document.getElementById('input-plan-x-tendons');
    if (planXTendonsInput) {
        planXTendonsInput.addEventListener('change', () => {
            const vals = planXTendonsInput.value.split(',')
                .map(v => parseFloat(v.trim()))
                .filter(v => !isNaN(v) && v >= 0 && v <= state.slabWidth);
            state.planXTendons = vals.sort((a, b) => a - b);
            planXTendonsInput.value = state.planXTendons.join(', ');
            calculateAndRender();
        });
    }

    // Export SVG
    DOM.btnExportSvg.addEventListener('click', exportSVG);

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
    DOM.tabElevation.addEventListener('click', () => {
        state.activeTab = 'elevation';
        DOM.tabElevation.classList.add('active');
        DOM.tabPlan.classList.remove('active');
        calculateAndRender();
    });
    DOM.tabPlan.addEventListener('click', () => {
        state.activeTab = 'plan';
        DOM.tabPlan.classList.add('active');
        DOM.tabElevation.classList.remove('active');
        calculateAndRender();
    });
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
            controlPoints: {
                supports: state.controlPoints.supports,
                supportsLocked: state.controlPoints.supportsLocked,
                lowPoints: state.controlPoints.lowPoints.map(lp => ({
                    xFract: lp.xFract,
                    y: lp.y
                })),
                lowPointsLocked: state.controlPoints.lowPointsLocked
            },
            planXTendons: state.planXTendons,
            planYTendons: state.planYTendons,
            planColumns: state.planColumns
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

            // Restore control points
            if (s.controlPoints) {
                if (Array.isArray(s.controlPoints.supports)) {
                    state.controlPoints.supports = [...s.controlPoints.supports];
                }
                if (Array.isArray(s.controlPoints.supportsLocked)) {
                    state.controlPoints.supportsLocked = [...s.controlPoints.supportsLocked];
                }
                if (Array.isArray(s.controlPoints.lowPoints)) {
                    state.controlPoints.lowPoints = s.controlPoints.lowPoints.map(lp => ({
                        xFract: lp.xFract,
                        y: lp.y
                    }));
                }
                if (Array.isArray(s.controlPoints.lowPointsLocked)) {
                    state.controlPoints.lowPointsLocked = [...s.controlPoints.lowPointsLocked];
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
                    y: col.y
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
    
    // 3. Render Y Tendons (Vertical Lines - Colored by Span)
    const yTendonsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    let yTendonCount = 0;
    let cumulativeX = 0;
    state.planYTendons.forEach((spanYTendons, spanIdx) => {
        const L = state.spanLengths[spanIdx];
        spanYTendons.forEach(relX => {
            const globalX = cumulativeX + relX;
            if (globalX >= cumulativeX && globalX <= cumulativeX + L) {
                yTendonCount++;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', mapX(globalX));
                line.setAttribute('y1', mapY(0));
                line.setAttribute('x2', mapX(globalX));
                line.setAttribute('y2', mapY(totalWidth));
                
                // Color mapping: Span 1: Yellow/Purple, Span 2: Green/Blue, Span 3: Pink/Orange
                let strokeColor = '#38bdf8';
                if (spanIdx === 0) {
                    strokeColor = relX < L / 2 ? '#a3e635' : '#a855f7';
                } else if (spanIdx === 1) {
                    strokeColor = relX < L / 2 ? '#22c55e' : '#06b6d4';
                } else if (spanIdx === 2) {
                    strokeColor = relX < L / 2 ? '#ec4899' : '#f97316';
                }
                
                line.setAttribute('stroke', strokeColor);
                line.setAttribute('stroke-width', '2.5');
                line.setAttribute('opacity', '0.8');
                yTendonsG.appendChild(line);
            }
        });
        cumulativeX += L;
    });
    svg.appendChild(yTendonsG);
    
    // 4. Render Columns (Draggable)
    const columnsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    state.planColumns.forEach(col => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', mapX(col.x));
        circle.setAttribute('cy', mapY(col.y));
        circle.setAttribute('r', '7');
        circle.setAttribute('class', 'svg-column-plan svg-drag-node');
        circle.dataset.type = 'plan-column';
        circle.dataset.id = col.id;
        
        circle.addEventListener('mousedown', (e) => startDrag(e, circle));
        columnsG.appendChild(circle);

        // Column name label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', mapX(col.x) + 11);
        text.setAttribute('y', mapY(col.y) + 3);
        text.setAttribute('fill', '#94a3b8');
        text.setAttribute('font-size', '8px');
        text.setAttribute('font-family', 'JetBrains Mono, monospace');
        text.textContent = col.id.replace('col-', 'C').replace('-top', 'T').replace('-bottom', 'B');
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
    summaryText.textContent = `Grid Layout: ${state.planXTendons.length} Horizontal (Red) | ${yTendonCount} Vertical (Colored by Span)`;
    dimsG.appendChild(summaryText);
    
    svg.appendChild(dimsG);
}

// Start the Application
window.addEventListener('DOMContentLoaded', init);
