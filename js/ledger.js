import { state } from './state.js';
import { fmt } from './utils.js';

export function renderLedger() {
    const ym         = document.getElementById('ledger-month')?.value || state.currentMonth;
    const filterType = document.getElementById('filter-type')?.value  || 'all';

    let txList = state.transactions.filter(t => t.date && t.date.startsWith(ym));
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
            ledgerBal.textContent  = '+' + fmt(balance);
            ledgerBal.style.color  = '#3b82f6';
        } else if (balance < 0) {
            ledgerBal.textContent  = '-' + fmt(balance);
            ledgerBal.style.color  = '#ef4444';
        } else {
            ledgerBal.textContent  = '0';
            ledgerBal.style.color  = '#ffffff';
        }
    }

    const container = document.getElementById('tx-list');
    if (!container) return;

    if (txList.length === 0) {
        container.innerHTML = '<div class="empty-state">이 달의 기록이 없어요<br><span>+ 버튼으로 추가해보세요</span></div>';
        return;
    }

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

// Exposed for the ledger-month onchange handler in HTML
window.renderLedger = renderLedger;
