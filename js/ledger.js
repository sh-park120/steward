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

    document.getElementById('ledger-income').textContent  = window.fmt(income);
    document.getElementById('ledger-expense').textContent = window.fmt(expense);
    document.getElementById('ledger-balance').textContent = window.fmt(income - expense);

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

// 3. 내역 추가 (기존 로직 보완)
window.addTransaction = async () => {
    const type = document.querySelector('.type-btn.active')?.dataset.type;
    const amountStr = document.getElementById('tx-amount').value;
    const amount = parseInt(amountStr.replace(/,/g, ''));
    const cat = document.getElementById('tx-cat').value;
    const date = document.getElementById('tx-date').value;
    const desc = document.getElementById('tx-desc')?.value || "";

    if (!amount || !cat || !date) {
        alert('모든 정보를 입력해주세요!');
        return;
    }

    try {
        await addDoc(collection(db, 'transactions'), {
            profileId: state.currentProfile.id,
            type, amount, category: cat, date, description: desc,
            createdAt: serverTimestamp()
        });
        
        // 입력창 초기화 및 모달 닫기
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-desc').value = '';
        document.getElementById('add-modal').classList.remove('open');
        if (window.showToast) window.showToast('기록되었습니다! ✓');
    } catch (e) {
        console.error(e);
        alert('저장에 실패했습니다.');
    }
};

window.deleteTx = async (id) => {
    if (confirm('이 항목을 삭제할까요?')) {
        await deleteDoc(doc(db, 'transactions', id));
        if (window.showToast) window.showToast('삭제되었습니다.', 'warn');
    }
};

// 4. 금액 포맷팅 헬퍼
window.fmt = (n) => Math.abs(n).toLocaleString('ko-KR');
window.fmtInput = (v) => {
    const n = parseInt(v.replace(/,/g, '')) || '';
    return n ? n.toLocaleString('ko-KR') : '';
};