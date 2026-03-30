import { db, state, showScreen } from './auth.js';
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { renderLedger } from './ledger.js';
// 앱 시작 시 데이터 구독 및 초기화
window.initAppData = () => {
    if (!state.currentProfile) return;
    const pid = state.currentProfile.id;
    
    // 1. 거래 내역 실시간 감시 (steward_record & analysis 통합 데이터원)
    const txQ = query(
        collection(db, 'transactions'), 
        where('profileId', '==', pid), 
        orderBy('date', 'desc')
    );
    
    onSnapshot(txQ, snap => {
        state.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        refreshAll();
    });

    // 2. 예산 데이터 실시간 감시 (steward_plan)
    const budgetQ = query(collection(db, 'budgets'), where('profileId', '==', pid));
    onSnapshot(budgetQ, snap => {
        state.budgets = {};
        snap.docs.forEach(d => {
            const data = d.data();
            const key = `${data.yearMonth}_${data.category}`;
            state.budgets[key] = { id: d.id, ...data };
        });
        refreshAll();
    });
    
    showScreen('app');
    window.switchTab('ledger');
};

// 모든 UI 요소를 현재 데이터에 맞춰 갱신
function refreshAll() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'ledger';
    
    // 각 모듈별 렌더링 함수 호출
    if (activeTab === 'ledger') renderLedger();
    if (activeTab === 'budget') renderBudget();
    if (activeTab === 'dashboard') renderDashboard();
}

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    
    const targetTab = document.querySelector(`[data-tab="${tab}"]`);
    if (targetTab) targetTab.classList.add('active');
    
    const targetPanel = document.getElementById(`panel-${tab}`);
    if (targetPanel) targetPanel.classList.add('active');
    
    refreshAll();
};

// 📊 --- steward_analysis (대시보드 분석) ---
function renderDashboard() {
    const ym = state.currentMonth;
    const monthTx = state.transactions.filter(t => t.date && t.date.startsWith(ym));
    
    const income  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // 상단 요약 바 업데이트
    const dashInc = document.getElementById('dash-income');
    const dashExp = document.getElementById('dash-expense');
    const dashBal = document.getElementById('dash-balance');

    if (dashInc) dashInc.textContent = window.fmt(income) + '원';
    if (dashExp) dashExp.textContent = window.fmt(expense) + '원';
    if (dashBal) {
        dashBal.textContent = window.fmt(income - expense) + '원';
        dashBal.className = 'dash-amount ' + (income - expense >= 0 ? 'income' : 'expense');
    }

    // 카테고리별 지출 차트 (막대 그래프 형태)
    //renderCategoryChart(monthTx);
}

// 💰 --- steward_plan (예산 계획 관리) ---
function renderBudget() {
    const ym = state.currentMonth;
    const monthTx = state.transactions.filter(t => t.date && t.date.startsWith(ym));
    const container = document.getElementById('budget-list');
    if (!container) return;

    // 카테고리 정의 (기존 CATEGORIES 상수 참조 필요)
    const expenseCategories = ['식비','카페','교통','쇼핑','의료','문화','통신','주거','교육','저축','기타지출'];

    container.innerHTML = expenseCategories.map(cat => {
        const key = `${ym}_${cat}`;
        const budAmt = state.budgets[key]?.amount || 0;
        const spent = monthTx.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0);
        const pct = budAmt > 0 ? Math.min(100, Math.round((spent / budAmt) * 100)) : 0;
        const over = budAmt > 0 && spent > budAmt;

        return `
            <div class="budget-row">
                <div class="budget-row-top">
                    <span class="budget-cat">${cat}</span>
                    <span class="budget-amt-info">${window.fmt(spent)} / ${budAmt > 0 ? window.fmt(budAmt) : '미설정'}</span>
                </div>
                <div class="budget-bar-bg">
                    <div class="budget-bar ${over ? 'over' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

