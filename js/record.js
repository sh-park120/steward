import { db, state } from './firebase-config.js';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 내역 추가 함수
export async function addTransaction() {
  const amountEl = document.getElementById('tx-amount');
  const descEl   = document.getElementById('tx-desc');
  const catEl    = document.getElementById('tx-cat');
  const dateEl   = document.getElementById('tx-date');
  
  const type   = document.querySelector('.type-btn.active')?.dataset.type;
  const amount = parseInt(amountEl.value.replace(/,/g, ''));
  const cat    = catEl.value;
  const desc   = descEl.value.trim();
  const date   = dateEl.value;

  // 1. 유효성 검사 (보안 규칙의 조건과 일치해야 함)
  if (!type) { window.showToast('수입/지출을 선택해주세요', 'warn'); return; }
  if (!amount || amount <= 0) { window.showToast('금액을 정확히 입력해주세요', 'warn'); return; }
  if (!cat) { window.showToast('카테고리를 선택해주세요', 'warn'); return; }
  if (!date) { window.showToast('날짜를 선택해주세요', 'warn'); return; }

  try {
    // 2. Firestore 저장
    await addDoc(collection(db, 'transactions'), {
      profileId: state.currentProfile.id,
      type, 
      amount, 
      category: cat, 
      description: desc, 
      date,
      createdAt: serverTimestamp()
    });

    // 3. UI 정리
    amountEl.value = '';
    descEl.value = '';
    window.showToast('기록 완료! ✓');
    
    // 모달 닫기 (UI 관리 함수가 ui.js 등에 있다면 호출)
    if (window.closeModal) window.closeModal('add-modal');
    
  } catch (error) {
    console.error("내역 추가 에러:", error);
    window.showToast('저장에 실패했습니다 (권한 확인)', 'error');
  }
}

// 내역 삭제 함수
export async function deleteTx(id) {
  if (confirm('이 항목을 삭제할까요?')) {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      window.showToast('삭제되었습니다', 'warn');
    } catch (error) {
      console.error("내역 삭제 에러:", error);
      window.showToast('삭제 권한이 없습니다', 'error');
    }
  }
}