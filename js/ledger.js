import { state } from './state.js';
import { fmt } from './utils.js';

let ledgerView = 'row';

let currentMonthFilter = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

function todayYM() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymToDisplay(ym) {
    const [y, m] = ym.split('-');
    return `${y}년 ${parseInt(m)}월`;
}

function getAvailableMonths() {
    if (!state.currentPlanner) return [];
    const pid = state.currentPlanner.id;
    const plannerTx = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && state.currentPlanner.isDefault)
    );
    const monthSet = new Set(plannerTx.map(t => t.date?.slice(0, 7)).filter(Boolean));
    return [...monthSet].sort().reverse();
}

function renderMonthNav() {
    const navEl = document.getElementById('month-nav');
    if (!navEl) return;

    const availableMonths = getAvailableMonths();
    const isAll = currentMonthFilter === '';
    const today = todayYM();
    const displayLabel = isAll ? '전체 기간' : ymToDisplay(currentMonthFilter);
    const prevYM = isAll ? today : shiftMonth(currentMonthFilter, -1);
    const nextYM = isAll ? '' : shiftMonth(currentMonthFilter, 1);
    const canNext = !isAll && nextYM <= today;

    const chipsHtml = availableMonths.length > 0
        ? `<div class="month-chips-row">${availableMonths.map(ym => {
            const [y, m] = ym.split('-');
            return `<button class="month-chip${ym === currentMonthFilter ? ' active' : ''}" onclick="setMonthFilter('${ym}')">${y.slice(2)}.${m}</button>`;
          }).join('')}</div>`
        : '';

    navEl.innerHTML = `
        <div class="month-nav-row">
            <button class="month-all-btn${isAll ? ' active' : ''}" onclick="setMonthFilter('')">전체</button>
            <button class="month-arrow" onclick="setMonthFilter('${prevYM}')"${isAll ? ' disabled' : ''}>&#9664;</button>
            <span class="month-nav-label">${displayLabel}</span>
            <button class="month-arrow" onclick="setMonthFilter('${nextYM}')"${!canNext ? ' disabled' : ''}>&#9654;</button>
        </div>
        ${chipsHtml}`;
}


export function renderLedger() {
    renderMonthNav();

    if (!state.currentPlanner) {
        const container = document.getElementById('tx-list');
        if (container) container.innerHTML = '<div class="empty-state">플래너를 선택해주세요</div>';
        return;
    }

    const pid      = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;

    let txList = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && isDefault)
    );

    if (currentMonthFilter) txList = txList.filter(t => t.date && t.date.startsWith(currentMonthFilter));

    const filterType = document.getElementById('filter-type')?.value || 'all';
    if (filterType !== 'all') txList = txList.filter(t => t.type === filterType);

    const income  = txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    const ledgerInc = document.getElementById('ledger-income');
    const ledgerExp = document.getElementById('ledger-expense');
    if (ledgerInc) ledgerInc.textContent = fmt(income);
    if (ledgerExp) ledgerExp.textContent = fmt(expense);

    const ledgerBal = document.getElementById('ledger-balance');
    if (ledgerBal) {
        if (balance > 0) {
            ledgerBal.textContent = '+' + fmt(balance);
            ledgerBal.style.color = '#3b82f6';
        } else if (balance < 0) {
            ledgerBal.textContent = '-' + fmt(Math.abs(balance));
            ledgerBal.style.color = '#ef4444';
        } else {
            ledgerBal.textContent = '0';
            ledgerBal.style.color = '#ffffff';
        }
    }

    const container = document.getElementById('tx-list');
    if (!container) return;

    if (txList.length === 0) {
        container.innerHTML = '<div class="empty-state">이 플래너의 기록이 없어요<br><span>+ 버튼으로 추가해보세요</span></div>';
        return;
    }

    if (ledgerView === 'block') {
        renderBlockView(container, txList);
    } else {
        renderRowView(container, txList);
    }
}

function renderRowView(container, txList) {
    const grouped = {};
    txList.forEach(t => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
    });

    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    container.innerHTML = dates.map(date => {
        const items = grouped[date].map(t => `
            <div class="tx-item">
                <div class="tx-info">
                    <span class="tx-cat">${t.category}</span>
                    <span class="tx-desc-text">${t.description || ''}</span>
                </div>
                <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}원</span>
                <button class="tx-del" onclick="deleteTx('${t.id}')">✕</button>
            </div>`).join('');
        return `<div class="day-group"><div class="day-header">${date}</div>${items}</div>`;
    }).join('');
}

function renderBlockView(container, txList) {
    const catMap = {};
    txList.forEach(t => {
        if (!catMap[t.category]) catMap[t.category] = { total: 0, count: 0, type: t.type };
        catMap[t.category].total += t.amount;
        catMap[t.category].count += 1;
    });

    const cards = Object.entries(catMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cat, info]) => {
            const sign = info.type === 'income' ? '+' : '-';
            const cls  = info.type === 'income' ? 'income' : 'expense';
            return `
            <div class="cat-block">
                <div class="cat-block-name">${cat}</div>
                <div class="cat-block-amount ${cls}">${sign}${fmt(info.total)}원</div>
                <div class="cat-block-count">${info.count}건</div>
            </div>`;
        }).join('');

    container.innerHTML = `<div class="cat-grid">${cards}</div>`;
}

window.renderLedger = renderLedger;
window.setMonthFilter = (ym) => {
    currentMonthFilter = ym;
    renderLedger();
};
