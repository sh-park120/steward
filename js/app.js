import { db, state, showScreen } from './auth.js';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

    // 카테고리 정의
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
                    <div class="budget-input-wrap">
                        <input type="text" class="budget-input" id="budget-input-${cat}" 
                               value="${budAmt > 0 ? window.fmt(budAmt) : ''}" 
                               placeholder="예산 입력"
                               oninput="this.value=window.fmtInput(this.value)">
                        <span class="budget-unit">원</span>
                        <button onclick="saveBudget('${cat}')" style="background:var(--accent); color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; margin-left:4px;">저장</button>
                    </div>
                </div>
                <div class="budget-bar-bg">
                    <div class="budget-bar ${over ? 'over' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></div>
                </div>
                <div class="budget-stat">
                    <span>${window.fmt(spent)}원 지출</span>
                    <span>${budAmt > 0 ? (over ? `<span class="over-text">${window.fmt(spent - budAmt)}원 초과</span>` : `<span class="remain-text">${window.fmt(budAmt - spent)}원 남음</span>`) : '예산을 설정해주세요'}</span>
                </div>
            </div>`;
    }).join('');
}

window.saveBudget = async (cat) => {
    // 1. 입력된 금액 가져오기
    const inputEl = document.getElementById(`budget-input-${cat}`);
    if (!inputEl) return;
    
    // 콤마 제거하고 숫자로 변환 (빈 칸이면 0)
    const amount = parseInt(inputEl.value.replace(/,/g, '')) || 0;
    const ym = state.currentMonth;
    const pid = state.currentProfile.id;
    
    // 2. 파이어베이스에 저장할 고유 문서 ID 생성 (예: 프로필ID_2026-03_식비)
    const budgetId = `${pid}_${ym}_${cat}`;
    
    try {
        // 3. setDoc으로 저장 (merge: true를 쓰면 기존 데이터가 있을 땐 덮어쓰고, 없으면 새로 만듭니다)
        await setDoc(doc(db, 'budgets', budgetId), {
            profileId: pid,
            yearMonth: ym,
            category: cat,
            amount: amount,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        if (window.showToast) window.showToast(`${cat} 예산이 저장되었습니다!`);
    } catch (error) {
        console.error("예산 저장 실패:", error);
        alert("예산 저장에 권한 문제가 있거나 실패했습니다.");
    }
};