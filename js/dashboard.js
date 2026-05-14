import { state } from './state.js';
import { fmt } from './utils.js';
import { EXPENSE_CATEGORIES } from './constants.js';

const CAT_COLORS = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
    '#22d3ee', '#60a5fa', '#818cf8', '#a78bfa', '#e879f9',
    '#f472b6', '#94a3b8', '#64748b', '#2dd4bf', '#f59e0b', '#9ca3af'
];

function getCatColor(cat) {
    const idx = EXPENSE_CATEGORIES.indexOf(cat);
    return CAT_COLORS[idx >= 0 ? idx : CAT_COLORS.length - 1];
}

let dashMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

function ymToDisplay(ym) {
    const [y, m] = ym.split('-');
    return `${y}년 ${parseInt(m)}월`;
}

function getAvailableDashMonths() {
    if (!state.currentPlanner) return [];
    const pid = state.currentPlanner.id;
    const plannerTx = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && state.currentPlanner.isDefault)
    );
    const monthSet = new Set(plannerTx.map(t => t.date?.slice(0, 7)).filter(Boolean));
    return [...monthSet].sort().reverse();
}

function getPlannerExpenses() {
    if (!state.currentPlanner) return [];
    const pid = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;
    return state.transactions.filter(t =>
        (t.plannerId === pid || (!t.plannerId && isDefault)) && t.type === 'expense'
    );
}

function renderDashMonthNav() {
    const navEl = document.getElementById('dash-month-nav');
    if (!navEl) return;

    const months = getAvailableDashMonths();
    if (months.length === 0) { navEl.innerHTML = ''; return; }

    if (!months.includes(dashMonth)) dashMonth = months[0];

    navEl.innerHTML = `
        <div class="dash-month-bar">
            <span class="dash-month-label">${ymToDisplay(dashMonth)}</span>
        </div>
        <div class="month-chips-row">${months.map(ym => {
            const [y, m] = ym.split('-');
            return `<button class="month-chip${ym === dashMonth ? ' active' : ''}" onclick="setDashMonth('${ym}')">${y.slice(2)}.${m}</button>`;
        }).join('')}</div>`;
}

// ── Monthly donut chart ──

function renderMonthlyDonut() {
    const container = document.getElementById('dash-donut');
    if (!container) return;

    const expenses = getPlannerExpenses().filter(t => t.date?.startsWith(dashMonth));

    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:16px;">이 월의 지출 내역이 없습니다</div>';
        return;
    }

    const catTotals = {};
    expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });

    const total = Object.values(catTotals).reduce((s, v) => s + v, 0);
    const cats = Object.entries(catTotals)
        .map(([cat, amount]) => ({ cat, amount, pct: (amount / total) * 100, color: getCatColor(cat) }))
        .sort((a, b) => b.amount - a.amount);

    const R = 70, CX = 100, CY = 100;
    const circumference = 2 * Math.PI * R;
    let cumOffset = 0;

    const slices = cats.map(c => {
        const dash = (c.amount / total) * circumference;
        const dashOffset = circumference / 4 - cumOffset;
        cumOffset += dash;
        return { ...c, dash, dashOffset };
    });

    const svgSlices = slices.map(s => `
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
            stroke="${s.color}" stroke-width="30"
            stroke-dasharray="${s.dash.toFixed(2)} ${circumference.toFixed(2)}"
            stroke-dashoffset="${s.dashOffset.toFixed(2)}" />`
    ).join('');

    const legendItems = slices.map(s => `
        <div class="donut-legend-item cat-clickable" onclick="showCatTxModal('${s.cat}', '${dashMonth}')">
            <span class="donut-legend-dot" style="background:${s.color}"></span>
            <span class="donut-legend-cat">${s.cat}</span>
            <span class="donut-legend-pct">${s.pct.toFixed(1)}%</span>
            <span class="donut-legend-amt">${fmt(s.amount)}원</span>
        </div>`
    ).join('');

    container.innerHTML = `
        <div class="donut-wrap">
            <div class="donut-svg-wrap">
                <svg viewBox="0 0 200 200" width="160" height="160">
                    ${svgSlices}
                    <text x="100" y="93" text-anchor="middle" class="chart-center-label">지출</text>
                    <text x="100" y="113" text-anchor="middle" class="chart-center-amount">${fmt(total)}</text>
                    <text x="100" y="128" text-anchor="middle" class="chart-center-unit">원</text>
                </svg>
            </div>
            <div class="donut-legend">${legendItems}</div>
        </div>`;
}

// ── Recent 5-month stacked bar chart ──

function renderBar5() {
    const container = document.getElementById('dash-bar5');
    if (!container) return;

    const allExpenses = getPlannerExpenses();

    const monthSet = new Set(allExpenses.map(t => t.date?.slice(0, 7)).filter(Boolean));
    const months = [...monthSet].sort().slice(-5);

    if (months.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:16px;">데이터가 없습니다</div>';
        return;
    }

    // Per-month category totals
    const data = {};
    months.forEach(m => { data[m] = {}; });
    allExpenses.forEach(t => {
        const m = t.date?.slice(0, 7);
        if (data[m]) data[m][t.category] = (data[m][t.category] || 0) + t.amount;
    });

    const totals = months.map(m => Object.values(data[m]).reduce((s, v) => s + v, 0));
    const maxTotal = Math.max(...totals, 1);

    // Active categories in canonical order
    const catSet = new Set();
    months.forEach(m => Object.keys(data[m]).forEach(c => catSet.add(c)));
    const activeCats = EXPENSE_CATEGORIES.filter(c => catSet.has(c));

    const BAR_MAX_H = 130;

    const barsHtml = months.map((m, i) => {
        const total = totals[i];
        const barH  = Math.round((total / maxTotal) * BAR_MAX_H);
        const [y, mo] = m.split('-');
        const isActive = m === dashMonth;

        // Sort segments largest → bottom (column-reverse renders first child at bottom)
        const segsHtml = activeCats
            .filter(c => (data[m][c] || 0) > 0)
            .sort((a, b) => (data[m][b] || 0) - (data[m][a] || 0))
            .map(c => {
                const amt = data[m][c];
                const h   = Math.round((amt / maxTotal) * BAR_MAX_H);
                const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
                return `<div class="bar5-seg" style="height:${h}px;background:${getCatColor(c)}" title="${c} ${fmt(amt)}원 (${pct}%)"></div>`;
            }).join('');

        return `
        <div class="bar5-col${isActive ? ' active' : ''}" onclick="setDashMonth('${m}')">
            <div class="bar5-amount">${total > 0 ? fmt(total) : '-'}</div>
            <div class="bar5-spacer"></div>
            <div class="bar5-stack" style="height:${barH}px">${segsHtml}</div>
            <div class="bar5-month-lbl">${y.slice(2)}.${parseInt(mo)}월</div>
        </div>`;
    }).join('');

    const legendHtml = activeCats.map(c => `
        <div class="bar5-legend-item">
            <span class="bar5-legend-dot" style="background:${getCatColor(c)}"></span>
            <span>${c}</span>
        </div>`
    ).join('');

    container.innerHTML = `
        <div class="bar5-chart-wrap">
            <div class="bar5-chart">${barsHtml}</div>
        </div>
        <div class="bar5-legend">${legendHtml}</div>`;
}

// ── Budget vs actual comparison ──

function renderComparison() {
    const container = document.getElementById('dash-compare');
    if (!container) return;

    if (!state.currentPlanner) {
        container.innerHTML = '<div class="empty-state" style="padding:16px;">플래너를 선택해주세요</div>';
        return;
    }

    const pid    = state.currentPlanner.id;
    const monthTx = getPlannerExpenses().filter(t => t.date?.startsWith(dashMonth));

    const rows = EXPENSE_CATEGORIES.map(cat => {
        const planned = (state.budgets[`${pid}_${cat}`] || {}).amount || 0;
        const actual  = monthTx.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
        return { cat, planned, actual, diff: planned - actual };
    }).filter(r => r.planned > 0 || r.actual > 0);

    if (rows.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:16px;">이 월의 데이터가 없습니다</div>';
        return;
    }

    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalActual  = rows.reduce((s, r) => s + r.actual, 0);
    const totalDiff    = totalPlanned - totalActual;

    const totalDiffHtml = totalPlanned > 0
        ? totalDiff >= 0
            ? `<span class="compare-diff-under">▼ ${fmt(totalDiff)}원 남음</span>`
            : `<span class="compare-diff-over">▲ ${fmt(Math.abs(totalDiff))}원 초과</span>`
        : '<span class="compare-diff-none">-</span>';

    const rowsHtml = rows.map(({ cat, planned, actual, diff }) => {
        const pct  = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
        const over = planned > 0 && actual > planned;
        let diffHtml;
        if (planned === 0)  diffHtml = `<span class="compare-diff-none">예산 미설정</span>`;
        else if (over)      diffHtml = `<span class="compare-diff-over">▲ ${fmt(Math.abs(diff))}원 초과</span>`;
        else                diffHtml = `<span class="compare-diff-under">▼ ${fmt(diff)}원 남음</span>`;

        return `
        <div class="compare-row cat-clickable" onclick="showCatTxModal('${cat}', '${dashMonth}')">
            <div class="compare-row-top">
                <span class="compare-cat">${cat}</span>
                <span class="compare-diff">${diffHtml}</span>
            </div>
            <div class="compare-amounts">
                <span class="compare-planned">${planned > 0 ? fmt(planned) + '원' : '미설정'}</span>
                <span class="compare-arrow">→</span>
                <span class="compare-actual${over ? ' over' : ''}">${fmt(actual)}원</span>
            </div>
            ${planned > 0 ? `<div class="compare-bar-bg"><div class="compare-bar${over ? ' over' : pct > 80 ? ' warn' : ''}" style="width:${pct}%"></div></div>` : ''}
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="compare-summary">
            <div class="compare-summary-item">
                <span class="compare-summary-label">예산 합계</span>
                <span class="compare-summary-val">${fmt(totalPlanned)}원</span>
            </div>
            <div class="compare-summary-item">
                <span class="compare-summary-label">실지출 합계</span>
                <span class="compare-summary-val" style="color:var(--expense)">${fmt(totalActual)}원</span>
            </div>
            <div class="compare-summary-item">
                <span class="compare-summary-label">차액</span>
                <span class="compare-summary-val">${totalDiffHtml}</span>
            </div>
        </div>
        <div class="compare-list">${rowsHtml}</div>`;
}

// ── Main render ──

export function renderDashboard() {
    const dashInc = document.getElementById('dash-income');
    const dashExp = document.getElementById('dash-expense');
    const dashBal = document.getElementById('dash-balance');
    const chartContainer = document.getElementById('cat-chart');

    if (!state.currentPlanner) {
        if (dashInc) dashInc.textContent = '0원';
        if (dashExp) dashExp.textContent = '0원';
        if (dashBal) dashBal.textContent = '0원';
        if (chartContainer) chartContainer.innerHTML = '<div class="empty-state" style="padding:20px;">플래너를 선택해주세요</div>';
        renderDashMonthNav();
        renderMonthlyDonut();
        renderBar5();
        renderComparison();
        return;
    }

    const pid       = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;

    const plannerTx = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && isDefault)
    );

    const income  = plannerTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = plannerTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    if (dashInc) dashInc.textContent = fmt(income) + '원';
    if (dashExp) dashExp.textContent = fmt(expense) + '원';

    if (dashBal) {
        if (balance > 0) {
            dashBal.textContent = '+' + fmt(balance) + '원';
            dashBal.style.color = '#3b82f6';
        } else if (balance < 0) {
            dashBal.textContent = '-' + fmt(Math.abs(balance)) + '원';
            dashBal.style.color = '#ef4444';
        } else {
            dashBal.textContent = '0원';
            dashBal.style.color = '#ffffff';
        }
    }

    if (chartContainer) {
        const expenses = plannerTx.filter(t => t.type === 'expense');
        if (expenses.length === 0) {
            chartContainer.innerHTML = '<div class="empty-state" style="padding:20px;">이 플래너의 지출 내역이 없습니다.</div>';
        } else {
            const catTotals = {};
            expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
            const total = expense;
            const cats = Object.entries(catTotals)
                .map(([cat, amount]) => ({ cat, amount, pct: (amount / total) * 100, color: getCatColor(cat) }))
                .sort((a, b) => b.amount - a.amount);

            const R = 70, CX = 100, CY = 100;
            const circumference = 2 * Math.PI * R;
            let cumOffset = 0;
            const slices = cats.map(c => {
                const dash = (c.amount / total) * circumference;
                const dashOffset = circumference / 4 - cumOffset;
                cumOffset += dash;
                return { ...c, dash, dashOffset };
            });

            const svgSlices = slices.map(s => `
                <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
                    stroke="${s.color}" stroke-width="30"
                    stroke-dasharray="${s.dash.toFixed(2)} ${circumference.toFixed(2)}"
                    stroke-dashoffset="${s.dashOffset.toFixed(2)}" />`
            ).join('');

            const legendItems = slices.map(s => `
                <div class="donut-legend-item cat-clickable" onclick="showCatTxModal('${s.cat}', '')">
                    <span class="donut-legend-dot" style="background:${s.color}"></span>
                    <span class="donut-legend-cat">${s.cat}</span>
                    <span class="donut-legend-pct">${s.pct.toFixed(1)}%</span>
                    <span class="donut-legend-amt">${fmt(s.amount)}원</span>
                </div>`
            ).join('');

            chartContainer.innerHTML = `
                <div class="donut-wrap">
                    <div class="donut-svg-wrap">
                        <svg viewBox="0 0 200 200" width="160" height="160">
                            ${svgSlices}
                            <text x="100" y="93" text-anchor="middle" class="chart-center-label">지출</text>
                            <text x="100" y="113" text-anchor="middle" class="chart-center-amount">${fmt(total)}</text>
                            <text x="100" y="128" text-anchor="middle" class="chart-center-unit">원</text>
                        </svg>
                    </div>
                    <div class="donut-legend">${legendItems}</div>
                </div>`;
        }
    }

    renderDashMonthNav();
    renderMonthlyDonut();
    renderBar5();
    renderComparison();
}

window.setDashMonth = (ym) => {
    dashMonth = ym;
    renderDashMonthNav();
    renderMonthlyDonut();
    renderBar5();
    renderComparison();
};

// ── Category transaction modal ──

window.showCatTxModal = (cat, month) => {
    if (!state.currentPlanner) return;
    const pid = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;

    let txList = state.transactions.filter(t =>
        (t.plannerId === pid || (!t.plannerId && isDefault)) &&
        t.type === 'expense' &&
        t.category === cat
    );
    if (month) txList = txList.filter(t => t.date?.startsWith(month));
    txList = txList.sort((a, b) => b.date?.localeCompare(a.date));

    const total = txList.reduce((s, t) => s + t.amount, 0);

    const titleEl = document.getElementById('cat-tx-modal-title');
    const summaryEl = document.getElementById('cat-tx-summary');
    const listEl = document.getElementById('cat-tx-list');

    if (titleEl) {
        titleEl.textContent = month
            ? `${cat} · ${month.slice(0, 4)}년 ${parseInt(month.slice(5))}월`
            : `${cat} · 전체`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = `<span class="cat-tx-total-label">합계</span><span class="cat-tx-total-val">${fmt(total)}원</span>`;
    }

    if (listEl) {
        if (txList.length === 0) {
            listEl.innerHTML = '<div class="empty-state" style="padding:20px;">내역이 없습니다</div>';
        } else {
            const grouped = {};
            txList.forEach(t => {
                if (!grouped[t.date]) grouped[t.date] = [];
                grouped[t.date].push(t);
            });
            listEl.innerHTML = Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => {
                const items = grouped[date].map(t => `
                    <div class="tx-item">
                        <div class="tx-info">
                            <span class="tx-cat">${t.category}</span>
                            <span class="tx-desc-text">${t.description || ''}</span>
                        </div>
                        <span class="tx-amount expense">-${fmt(t.amount)}원</span>
                    </div>`).join('');
                return `<div class="day-group"><div class="day-header">${date}</div>${items}</div>`;
            }).join('');
        }
    }

    document.getElementById('cat-tx-modal')?.classList.add('open');
};

window.closeCatTxModal = () => {
    document.getElementById('cat-tx-modal')?.classList.remove('open');
};
