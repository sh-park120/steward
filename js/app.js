import { db, state, showScreen } from './auth.js';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
}

// 1. 토글 상태 관리를 위한 전역 변수 추가
window.expandedCats = window.expandedCats || {};

// 카테고리 열기/닫기 토글 함수
window.toggleCat = (cat) => {
    window.expandedCats[cat] = !window.expandedCats[cat];
    refreshAll(); // 상태 변경 후 UI 다시 그리기
};

// 💰 --- steward_plan (예산 계획 관리) 수정 ---
function renderBudget() {
    const ym = state.currentMonth;
    const monthTx = state.transactions.filter(t => t.date && t.date.startsWith(ym));
    const container = document.getElementById('budget-list');
    if (!container) return;

    const expenseCategories = ['식비','카페','교통','쇼핑','의료','문화','통신','주거','교육','저축','기타지출'];

    container.innerHTML = expenseCategories.map(cat => {
        const key = `${ym}_${cat}`;
        const budgetData = state.budgets[key] || {};
        const budAmt = budgetData.amount || 0;
        const subCategories = budgetData.subCategories || {}; 
        const subCatKeys = Object.keys(subCategories);
        
        // ✨ [추가됨] 세부 항목 존재 여부 확인
        const hasSubCats = subCatKeys.length > 0;
        
        const spent = monthTx.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0);
        const pct = budAmt > 0 ? Math.min(100, Math.round((spent / budAmt) * 100)) : 0;
        const over = budAmt > 0 && spent > budAmt;

        const isExpanded = window.expandedCats[cat];

        // --- 세부 항목 UI 렌더링 ---
        let subCatHtml = '';
        if (isExpanded) {
            const subListHtml = subCatKeys.map(subName => {
                const subAmt = subCategories[subName];
                const subSpent = monthTx.filter(t => t.type === 'expense' && t.category === cat && t.subCategory === subName).reduce((s, t) => s + t.amount, 0);
                const safeSubName = subName.replace(/\s+/g, '');

                return `
                    <div class="sub-budget-row" style="display:flex; justify-content:space-between; align-items:center; margin: 6px 0 6px 12px; padding: 6px; border-left: 2px solid var(--accent); background: #fdfdfd;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span class="sub-cat-name" style="font-size: 13px; color: #555; font-weight: bold;">- ${subName}</span>
                            <span class="sub-spent-info" style="font-size: 11px; color: #888;">지출: ${window.fmt(subSpent)}원</span>
                        </div>
                        <div class="budget-input-wrap">
                            <input type="text" class="budget-input" id="sub-input-${cat}-${safeSubName}" 
                                   value="${subAmt > 0 ? window.fmt(subAmt) : ''}" 
                                   placeholder="세부 예산" style="width: 70px; font-size: 12px;"
                                   oninput="this.value=window.fmtInput(this.value)">
                            <span class="budget-unit" style="font-size: 12px;">원</span>
                            <button onclick="saveSubBudget('${cat}', '${subName}', '${safeSubName}')" style="background:#ddd; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:4px;">저장</button>
                            <button onclick="deleteSubBudget('${cat}', '${subName}')" style="background:#ffdddd; color: #cc0000; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:2px;">삭제</button>
                        </div>
                    </div>`;
            }).join('');

            subCatHtml = `
                <div class="sub-budget-container" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px; font-weight: bold;">👇 세부 예산 설정</div>
                    ${subListHtml}
                    <div class="sub-budget-add" style="display:flex; gap: 6px; margin-top: 10px; margin-left: 12px;">
                        <input type="text" id="new-sub-name-${cat}" placeholder="새 항목 (예: 회식)" style="padding: 4px; font-size: 12px; flex: 1; border: 1px solid #ddd; border-radius: 4px;">
                        <button onclick="addSubCategory('${cat}')" style="background:var(--accent); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;">+ 추가</button>
                    </div>
                </div>`;
        }

        // ✨ [수정됨] 세부 항목이 있으면 인풋을 잠그고 '자동합산' 표시
        return `
            <div class="budget-row" style="margin-bottom: 16px;">
                <div class="budget-row-top" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="budget-cat" onclick="toggleCat('${cat}')" style="cursor: pointer; user-select: none;">
                        ${isExpanded ? '🔽' : '▶️'} ${cat}
                    </span>
                    <div class="budget-input-wrap">
                        <input type="text" class="budget-input" id="budget-input-${cat}" 
                               value="${budAmt > 0 ? window.fmt(budAmt) : ''}" 
                               placeholder="${hasSubCats ? '자동 합산됨' : '총 예산 입력'}"
                               ${hasSubCats ? 'readonly style="background:#efefef; color:#888;" title="세부 항목의 합계입니다"' : 'oninput="this.value=window.fmtInput(this.value)"'}>
                        <span class="budget-unit">원</span>
                        ${hasSubCats 
                            ? `<span style="font-size:11px; color:#888; margin-left:4px; font-weight:bold;">(합산)</span>` 
                            : `<button onclick="saveBudget('${cat}')" style="background:var(--accent); color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; margin-left:4px;">저장</button>`}
                    </div>
                </div>
                <div class="budget-bar-bg" style="margin-top: 8px;">
                    <div class="budget-bar ${over ? 'over' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></div>
                </div>
                <div class="budget-stat" style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px;">
                    <span>${window.fmt(spent)}원 지출</span>
                    <span>${budAmt > 0 ? (over ? `<span class="over-text">${window.fmt(spent - budAmt)}원 초과</span>` : `<span class="remain-text">${window.fmt(budAmt - spent)}원 남음</span>`) : '예산을 설정해주세요'}</span>
                </div>
                ${subCatHtml}
            </div>`;
    }).join('');
}

// 1. 새로운 세부 항목 이름 추가 (✨ 추가 시 합산 갱신)
window.addSubCategory = async (cat) => {
    const nameInput = document.getElementById(`new-sub-name-${cat}`);
    const subName = nameInput.value.trim();
    if (!subName) return alert('세부항목 이름을 입력하세요.');

    const ym = state.currentMonth;
    const pid = state.currentProfile.id;
    const budgetId = `${pid}_${ym}_${cat}`;
    
    const existingData = state.budgets[`${ym}_${cat}`] || {};
    const subCategories = { ...(existingData.subCategories || {}) };
    
    if (subCategories[subName] !== undefined) {
        return alert('이미 존재하는 세부항목입니다.');
    }
    
    subCategories[subName] = 0; 
    
    // 세부 항목들의 총합 계산
    const newTotalAmount = Object.values(subCategories).reduce((sum, val) => sum + (val || 0), 0);

    try {
        await setDoc(doc(db, 'budgets', budgetId), {
            profileId: pid,
            yearMonth: ym,
            category: cat,
            amount: newTotalAmount, // ✨ 총 예산 덮어쓰기
            subCategories: subCategories,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        if (window.showToast) window.showToast(`${subName} 항목이 추가되었습니다.`);
    } catch (error) {
        console.error(error);
        alert("항목 추가에 실패했습니다.");
    }
};

// 2. 세부 항목 예산 금액 저장 (✨ 저장 시 합산 갱신)
window.saveSubBudget = async (cat, subName, safeSubName) => {
    const inputEl = document.getElementById(`sub-input-${cat}-${safeSubName}`);
    if (!inputEl) return;
    
    const amount = parseInt(inputEl.value.replace(/,/g, '')) || 0;
    const ym = state.currentMonth;
    const pid = state.currentProfile.id;
    const budgetId = `${pid}_${ym}_${cat}`;
    
    const existingData = state.budgets[`${ym}_${cat}`] || {};
    const subCategories = { ...(existingData.subCategories || {}) };
    
    subCategories[subName] = amount; 
    
    // 세부 항목들의 총합 계산
    const newTotalAmount = Object.values(subCategories).reduce((sum, val) => sum + (val || 0), 0);

    try {
        await setDoc(doc(db, 'budgets', budgetId), {
            profileId: pid,
            yearMonth: ym,
            category: cat,
            amount: newTotalAmount, // ✨ 총 예산 덮어쓰기
            subCategories: subCategories,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        if (window.showToast) window.showToast(`${subName} 예산이 저장되었습니다.`);
    } catch (error) {
        console.error(error);
    }
};

// 3. 세부 항목 삭제 (✨ 삭제 시 남은 항목 합산 갱신)
window.deleteSubBudget = async (cat, subName) => {
    if(!confirm(`'${subName}' 항목을 삭제하시겠습니까?`)) return;

    const ym = state.currentMonth;
    const pid = state.currentProfile.id;
    const budgetId = `${pid}_${ym}_${cat}`;
    
    // 합계를 먼저 계산하기 위해 객체 준비
    const existingData = state.budgets[`${ym}_${cat}`] || {};
    const subCategories = { ...(existingData.subCategories || {}) };
    
    delete subCategories[subName]; // 삭제할 항목 제외
    
    // 남은 항목들의 총합 계산
    const newTotalAmount = Object.values(subCategories).reduce((sum, val) => sum + (val || 0), 0);

    try {
        await updateDoc(doc(db, 'budgets', budgetId), {
            amount: newTotalAmount, // ✨ 총 예산 덮어쓰기
            [`subCategories.${subName}`]: deleteField(),
            updatedAt: serverTimestamp()
        });
        
        if (window.showToast) window.showToast(`${subName} 항목이 삭제되었습니다.`);
    } catch (error) {
        console.error("세부 항목 삭제 실패:", error);
        alert("항목 삭제에 실패했습니다.");
    }
};


window.renderBudget = renderBudget;


// rules_version = '2';
// service cloud.firestore {
// match /databases/{database}/documents {


// // ─────────────────────────────
// // 공통 함수
// // ─────────────────────────────
// function isSignedIn() {
//   return request.auth != null;
// }

// function isProfileOwner(profileId) {
//   return get(/databases/$(database)/documents/profiles/$(profileId)).data.uid
//     == request.auth.uid;
// }

// // ─────────────────────────────
// // profiles
// // ─────────────────────────────
// match /profiles/{profileId} {

//   // 생성
//   allow create: if isSignedIn()
//     && request.resource.data.uid == request.auth.uid;

//   // 조회 (🔥 query-safe)
//   allow read: if isSignedIn()
//     && resource.data.uid == request.auth.uid;

//   // 수정/삭제
//   allow update, delete: if isSignedIn()
//     && resource.data.uid == request.auth.uid;
// }

// // ─────────────────────────────
// // transactions
// // ─────────────────────────────
// match /transactions/{txId} {

//   // 생성
//   allow create: if isSignedIn()
//     && isProfileOwner(request.resource.data.profileId)
//     && request.resource.data.amount is number
//     && request.resource.data.amount > 0
//     && request.resource.data.profileId is string;

//   // 조회 / 수정 / 삭제
//   allow read, update, delete: if isSignedIn()
//     && isProfileOwner(resource.data.profileId);
// }

// // ─────────────────────────────
// // budgets
// // ─────────────────────────────
// match /budgets/{budgetId} {

//   // 생성
//   allow create: if isSignedIn()
//     && isProfileOwner(request.resource.data.profileId)
//     && request.resource.data.amount is number
//     && request.resource.data.amount >= 0;

//   // 조회 / 수정 / 삭제
//   allow read, update, delete: if isSignedIn()
//     && isProfileOwner(resource.data.profileId);
// }


// }
// }
