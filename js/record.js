import { db, state } from './auth.js';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ----------------------------------------------------
// 🌟 [추가됨] 메인 카테고리 선택 시 세부 항목 드롭다운 업데이트
// HTML에서 메인 카테고리 select 태그에 onchange="updateSubCategoryOptions()" 속성을 추가해주세요.
// ----------------------------------------------------
export function updateSubCategoryOptions() {
    const catEl = document.getElementById('tx-cat');
    const subCatEl = document.getElementById('tx-subcat');
    if (!catEl || !subCatEl) return;

    const selectedCat = catEl.value;
    const ym = state.currentMonth; 
    const type = document.querySelector('.type-btn.active')?.dataset.type;

    // 수입이거나 카테고리가 없으면 세부 항목 숨김
    if (type !== 'expense' || !selectedCat) {
        subCatEl.style.display = 'none';
        subCatEl.innerHTML = '<option value="">세부 항목 (선택)</option>';
        return;
    }

    // 예산 데이터에서 해당 카테고리의 하위 항목 가져오기
    const budgetData = state.budgets[`${ym}_${selectedCat}`] || {};
    const subCategories = budgetData.subCategories || {};
    const subCatKeys = Object.keys(subCategories);

    // 세부 카테고리 select 태그 초기화
    subCatEl.innerHTML = '<option value="">세부 항목 (선택)</option>';
    
    if (subCatKeys.length > 0) {
        subCatEl.style.display = 'block'; // 하위 항목이 있으면 표시
        subCatKeys.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            subCatEl.appendChild(option);
        });
    } else {
        // 하위 항목이 없으면 숨김
        subCatEl.style.display = 'none'; 
    }
}

// ----------------------------------------------------
// 내역 추가 함수 (세부 카테고리 저장 로직 추가)
// ----------------------------------------------------
export async function addTransaction() {
  const amountEl = document.getElementById('tx-amount');
  const descEl   = document.getElementById('tx-desc');
  const catEl    = document.getElementById('tx-cat');
  const subCatEl = document.getElementById('tx-subcat'); // 세부 항목 DOM 추가
  const dateEl   = document.getElementById('tx-date');
  
  const type   = document.querySelector('.type-btn.active')?.dataset.type;
  const amount = parseInt(amountEl.value.replace(/,/g, ''));
  const cat    = catEl.value;
  const subCat = subCatEl ? subCatEl.value : ''; // 세부 카테고리 값
  const desc   = descEl.value.trim();
  const date   = dateEl.value;

  // 1. 유효성 검사
  if (!type) { window.showToast('수입/지출을 선택해주세요', 'warn'); return; }
  if (!amount || amount <= 0) { window.showToast('금액을 정확히 입력해주세요', 'warn'); return; }
  if (!cat) { window.showToast('카테고리를 선택해주세요', 'warn'); return; }
  if (!date) { window.showToast('날짜를 선택해주세요', 'warn'); return; }

  try {
    // 2. Firestore에 저장할 데이터 구성
    const txData = {
      profileId: state.currentProfile.id,
      type, 
      amount, 
      category: cat, 
      description: desc, 
      date,
      createdAt: serverTimestamp()
    };

    // 지출이면서 세부 카테고리가 선택된 경우에만 데이터에 병합
    if (type === 'expense' && subCat) {
        txData.subCategory = subCat;
    }

    // 3. Firestore 저장
    await addDoc(collection(db, 'transactions'), txData);

    // 4. UI 정리
    amountEl.value = '';
    descEl.value = '';
    if (subCatEl) subCatEl.value = ''; // 세부 항목 초기화
    
    if (window.showToast) window.showToast('기록 완료! ✓');
    
    // 모달 닫기
    if (window.closeModal) window.closeModal('add-modal');
    
  } catch (error) {
    console.error("내역 추가 에러:", error);
    if (window.showToast) window.showToast('저장에 실패했습니다 (권한 확인)', 'error');
  }
}

// ----------------------------------------------------
// 내역 삭제 함수 (변경 없음)
// ----------------------------------------------------
export async function deleteTx(id) {
  if (confirm('이 항목을 삭제할까요?')) {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      if (window.showToast) window.showToast('삭제되었습니다', 'warn');
    } catch (error) {
      console.error("내역 삭제 에러:", error);
      if (window.showToast) window.showToast('삭제 권한이 없습니다', 'error');
    }
  }
}
window.addTransaction = addTransaction;
window.updateSubCategoryOptions = updateSubCategoryOptions;