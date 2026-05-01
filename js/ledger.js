import { state } from './state.js';
import { fmt } from './utils.js';

let ledgerView = 'row'; // 'row' | 'block'

export function setLedgerView(view) {
    ledgerView = view;
    document.getElementById('btn-row-view')?.classList.toggle('active', view === 'row');
    document.getElementById('btn-block-view')?.classList.toggle('active', view === 'block');
    renderLedger();
}

export function renderLedger() {
    if (!state.currentPlanner) {
        const container = document.getElementById('tx-list');
        if (container) container.innerHTML = '<div class="empty-state">플래너를 선택해주세요</div>';
        return;
    }

    const pid      = state.currentPlanner.id;
    const isDefault = state.currentPlanner.isDefault;

    // Primary filter: planner (old transactions without plannerId fall under default)
    let txList = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && isDefault)
    );

    // Secondary filter: optional month (empty input = show all dates)
    const ym = document.getElementById('ledger-month')?.value || '';
    if (ym) txList = txList.filter(t => t.date && t.date.startsWith(ym));

    // Type filter
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
            ledgerBal.textContent = '-' + fmt(balance);
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

// Exposed for the ledger-month onchange handler in HTML
window.renderLedger = renderLedger;
window.setLedgerView = setLedgerView;
