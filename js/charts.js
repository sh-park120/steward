const DONUT_R  = 70;
const DONUT_CX = 100;
const DONUT_CY = 100;

export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_R;

// items: array of { amount, color, ...rest }
// Returns same items augmented with { dash, dashOffset }
export function buildDonutSlices(items) {
    const total = items.reduce((s, c) => s + c.amount, 0);
    if (total === 0) return [];
    let cumOffset = 0;
    return items.map(c => {
        const dash       = (c.amount / total) * DONUT_CIRCUMFERENCE;
        const dashOffset = DONUT_CIRCUMFERENCE / 4 - cumOffset;
        cumOffset       += dash;
        return { ...c, dash, dashOffset };
    });
}

export function buildDonutSVGCircles(slices) {
    const C = DONUT_CIRCUMFERENCE;
    return slices.map(s => `
        <circle cx="${DONUT_CX}" cy="${DONUT_CY}" r="${DONUT_R}" fill="none"
            stroke="${s.color}" stroke-width="30"
            stroke-dasharray="${s.dash.toFixed(2)} ${C.toFixed(2)}"
            stroke-dashoffset="${s.dashOffset.toFixed(2)}" />`
    ).join('');
}
