import { state } from './state.js';
import { fmt } from './utils.js';
import { EXPENSE_CATEGORIES } from './constants.js';

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

function renderDashMonthNav() {
    const navEl = document.getElementById('dash-month-nav');
    if (!navEl) return;

    const months = getAvailableDashMonths();
    if (months.length === 0) {
        navEl.innerHTML = '';
        return;
    }

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

function renderComparison() {
    const container = document.getElementById('dash-compare');
    if (!container) return;

    if (!state.currentPlanner) {
        container.innerHTML = '<div class="empty-state" style="padding:16px;">플래너를 선택해주세요</div>';
        return;
    }

    const pid = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;

    const monthTx = state.transactions.filter(t =>
        (t.plannerId === pid || (!t.plannerId && isDefault)) &&
        t.type === 'expense' &&
        t.date?.startsWith(dashMonth)
    );

    const rows = EXPENSE_CATEGORIES.map(cat => {
        const budgetData = state.budgets[`${pid}_${cat}`] || {};
        const planned = budgetData.amount || 0;
        const actual = monthTx
            .filter(t => t.category === cat)
            .reduce((s, t) => s + t.amount, 0);
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
        if (planned === 0) {
            diffHtml = `<span class="compare-diff-none">예산 미설정</span>`;
        } else if (over) {
            diffHtml = `<span class="compare-diff-over">▲ ${fmt(Math.abs(diff))}원 초과</span>`;
        } else {
            diffHtml = `<span class="compare-diff-under">▼ ${fmt(diff)}원 남음</span>`;
        }

        return `
        <div class="compare-row">
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
            chartContainer.innerHTML = '<div class="empty-state" style="padding: 20px;">이 플래너의 지출 내역이 없습니다.</div>';
        } else {
            const catTotals = {};
            expenses.forEach(t => {
                catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
            });
            const sortedCats = Object.keys(catTotals)
                .map(cat => ({ category: cat, amount: catTotals[cat] }))
                .sort((a, b) => b.amount - a.amount);

            chartContainer.innerHTML = sortedCats.map(item => {
                const pct = Math.round((item.amount / expense) * 100);
                return `
                <div class="cat-bar-row">
                    <div class="cat-bar-label">${item.category}</div>
                    <div class="cat-bar-track">
                        <div class="cat-bar-fill" style="width: ${pct}%"></div>
                    </div>
                    <div class="cat-bar-amount">${fmt(item.amount)}원</div>
                </div>`;
            }).join('');
        }
    }

    renderDashMonthNav();
    renderComparison();
}

window.setDashMonth = (ym) => {
    dashMonth = ym;
    renderDashMonthNav();
    renderComparison();
};
