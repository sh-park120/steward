import { state } from './state.js';
import { fmt } from './utils.js';

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
        return;
    }

    const pid       = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;

    // All transactions for this planner
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

    if (!chartContainer) return;

    const expenses = plannerTx.filter(t => t.type === 'expense');
    if (expenses.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state" style="padding: 20px;">이 플래너의 지출 내역이 없습니다.</div>';
        return;
    }

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
