import { db, state } from './auth.js';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. 프로필 목록 렌더링 (로그인 후 첫 화면)
export function renderProfiles(profiles) {
    const list = document.getElementById('profile-list');
    if (!list) return;

    if (profiles.length === 0) {
        list.innerHTML = '<p class="no-profile">아직 프로필이 없어요. 새 프로필을 만들어보세요!</p>';
        return;
    }

    list.innerHTML = profiles.map(p => `
      <div class="profile-card" onclick="selectProfile('${p.id}')">
        <div class="profile-avatar">${p.emoji || '👤'}</div>
        <div class="profile-info">
          <div class="profile-pname">${p.name}</div>
          <div class="profile-hint">탭해서 입장 →</div>
        </div>
        <button class="profile-delete" onclick="deleteProfile('${p.id}', event)">✕</button>
      </div>
    `).join('');
}

// 2. 가계부 내역 렌더링 (steward_record)
export function renderLedger() {
    const ym = document.getElementById('ledger-month')?.value || state.currentMonth;
    const filterType = document.getElementById('filter-type')?.value || 'all';
    
    // 현재 선택된 월의 데이터만 필터링
    let txList = state.transactions.filter(t => t.date && t.date.startsWith(ym));
    if (filterType !== 'all') txList = txList.filter(t => t.type === filterType);

    // 상단 요약 수치 계산
    const income  = txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    // 수입, 지출 렌더링
    const ledgerInc = document.getElementById('ledger-income');
    const ledgerExp = document.getElementById('ledger-expense');
    if (ledgerInc) ledgerInc.textContent = window.fmt(income);
    if (ledgerExp) ledgerExp.textContent = window.fmt(expense);

    // ✨ [수정됨] 잔액 부호 및 색상 처리 로직 적용
    const ledgerBal = document.getElementById('ledger-balance');
    if (ledgerBal) {
        if (balance > 0) {
            ledgerBal.textContent = '+' + window.fmt(balance);
            ledgerBal.style.color = '#3b82f6'; // 파란색
        } else if (balance < 0) {
            // 하단의 window.fmt 함수가 이미 절댓값(Math.abs) 처리를 하므로 '-' 기호만 붙이면 됩니다.
            ledgerBal.textContent = '-' + window.fmt(balance); 
            ledgerBal.style.color = '#ef4444'; // 빨간색
        } else {
            ledgerBal.textContent = '0';
            ledgerBal.style.color = '#ffffff'; // 흰색
        }
    }

    const container = document.getElementById('tx-list');
    if (txList.length === 0) {
        container.innerHTML = '<div class="empty-state">이 달의 기록이 없어요<br><span>+ 버튼으로 추가해보세요</span></div>';
        return;
    }

    // 날짜별 그룹화 및 출력
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
                <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${window.fmt(t.amount)}원</span>
                <button class="tx-del" onclick="deleteTx('${t.id}')">✕</button>
            </div>
        `).join('');
        return `<div class="day-group"><div class="day-header">${date}</div>${items}</div>`;
    }).join('');
}


// 4. 금액 포맷팅 헬퍼
window.fmt = (n) => Math.abs(n).toLocaleString('ko-KR');
window.fmtInput = (v) => {
    const n = parseInt(v.replace(/,/g, '')) || '';
    return n ? n.toLocaleString('ko-KR') : '';
};