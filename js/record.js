 import { db } from './firebase.js';                                           
  import { state } from './state.js';                                           
  import { showToast } from './utils.js';                                       
  import {                                                                      
      collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp            
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";    
                                                                                
  export function updateSubCategoryOptions() {                                  
      const catEl    = document.getElementById('tx-cat');                       
      const subCatEl = document.getElementById('tx-subcat');                    
      if (!catEl || !subCatEl) return;
                                                                                
      const selectedCat = catEl.value;
      const type        =                                                       
  document.querySelector('.type-btn.active')?.dataset.type;                     
   
      if (type !== 'expense' || !selectedCat || !state.currentPlanner) {        
          subCatEl.style.display = 'none';
          subCatEl.innerHTML = '<option value="">세부 항목 (선택)</option>';    
          return; 
      }

      const budgetData    =                                                     
  state.budgets[`${state.currentPlanner.id}_${selectedCat}`] || {};
      const subCategories = budgetData.subCategories || {};                     
      const subCatKeys    = Object.keys(subCategories);

      subCatEl.innerHTML = '<option value="">세부 항목 (선택)</option>';        
   
      if (subCatKeys.length > 0) {                                              
          subCatEl.style.display = 'block';
          subCatKeys.forEach(sub => {                                           
              const option = document.createElement('option');
              option.value = sub;                                               
              option.textContent = sub;
              subCatEl.appendChild(option);                                     
          });
      } else {                                                                  
          subCatEl.style.display = 'none';
      }
  }

  export async function addTransaction() {
      const amountEl = document.getElementById('tx-amount');
      const descEl   = document.getElementById('tx-desc');                      
      const catEl    = document.getElementById('tx-cat');
      const subCatEl = document.getElementById('tx-subcat');                    
      const dateEl   = document.getElementById('tx-date');
                                                                                
      const type   = document.querySelector('.type-btn.active')?.dataset.type;
      const amount = parseInt(amountEl.value.replace(/,/g, ''));                
      const cat    = catEl.value;                                               
      const subCat = subCatEl ? subCatEl.value : '';
      const desc   = descEl.value.trim();                                       
      const date   = dateEl.value;
                                                                                
      if (!type)              { showToast('수입/지출을 선택해주세요', 'warn');  
  return; }
      if (!amount || amount <= 0) { showToast('금액을 정확히 입력해주세요',     
  'warn'); return; }                                                            
      if (!cat)               { showToast('카테고리를 선택해주세요', 'warn');
  return; }                                                                     
      if (!date)              { showToast('날짜를 선택해주세요', 'warn');
  return; }                                                                     
      if (!state.currentPlanner) { showToast('플래너를 먼저 선택해주세요',
  'warn'); return; }                                                            
                  
      try {                                                                     
          const txData = {
              profileId:  state.currentProfile.id,
              plannerId:  state.currentPlanner.id,                              
              type, amount, category: cat, description: desc, date,
              createdAt: serverTimestamp()                                      
          };      
                                                                                
          if (type === 'expense' && subCat) {
              txData.subCategory = subCat;
          }                                                                     
   
          await addDoc(collection(db, 'transactions'), txData);                 
                  
          amountEl.value = '';
          descEl.value   = '';
          if (subCatEl) subCatEl.value = '';                                    
   
          showToast('기록 완료! ✓');                                            
          if (window.closeModal) window.closeModal('add-modal');
      } catch (error) {                                                         
          console.error("내역 추가 에러:", error);
          showToast('저장에 실패했습니다 (권한 확인)', 'error');                
      }                                                                         
  }                                                                             
                                                                                
  export async function deleteTx(id) {
      if (confirm('이 항목을 삭제할까요?')) {
          try {                                                                 
              await deleteDoc(doc(db, 'transactions', id));
              showToast('삭제되었습니다', 'warn');                              
          } catch (error) {                                                     
              console.error("내역 삭제 에러:", error);
              showToast('삭제 권한이 없습니다', 'error');                       
          }       
      }                                                                         
  }
                                                                                
  // Opens the add-modal pre-filled with existing transaction data for editing  
  export function editTx(id) {
      const tx = state.transactions.find(t => t.id === id);                     
      if (!tx) { showToast('항목을 찾을 수 없습니다', 'error'); return; }
                                                                                
      // Switch modal title and submit button to edit mode, storing the target  
  id                                                                            
      document.querySelector('#add-modal .modal-title').textContent = '내역수정';                                                                        
      const submitBtn = document.querySelector('#add-modal .btn-submit');
      submitBtn.textContent = '수정하기';                                       
      submitBtn.onclick = () => window.updateTransaction(id);
                                                                                
      // Set type toggle
      if (window.setTxType) window.setTxType(tx.type);                          
                                                                                
      // Populate category then subcategory (updateCatOptions must run first to build options)                                                                
      if (window.updateCatOptions) window.updateCatOptions(tx.type);            
      document.getElementById('tx-cat').value = tx.category;
                                                                                
      // Rebuild subcategory list for the selected category, then restore       
  selection                                                                     
      if (window.updateSubCategoryOptions) window.updateSubCategoryOptions();   
      const subCatEl = document.getElementById('tx-subcat');
      if (subCatEl && tx.subCategory) {
          subCatEl.value = tx.subCategory;                                      
      }
                                                                                
      document.getElementById('tx-amount').value = tx.amount.toLocaleString();  
      document.getElementById('tx-desc').value   = tx.description || '';
      document.getElementById('tx-date').value   = tx.date;                     
                  
      document.getElementById('add-modal').classList.add('open');               
  }
                                                                                
  // Saves edited fields back to Firestore and resets the modal to add mode     
  export async function updateTransaction(id) {
      const amountEl = document.getElementById('tx-amount');                    
      const descEl   = document.getElementById('tx-desc');                      
      const catEl    = document.getElementById('tx-cat');
      const subCatEl = document.getElementById('tx-subcat');                    
      const dateEl   = document.getElementById('tx-date');                      
   
      const type   = document.querySelector('.type-btn.active')?.dataset.type;  
      const amount = parseInt(amountEl.value.replace(/,/g, ''));
      const cat    = catEl.value;
      const subCat = subCatEl ? subCatEl.value : '';                            
      const desc   = descEl.value.trim();
      const date   = dateEl.value;                                              
                  
      if (!type)                  { showToast('수입/지출을 선택해주세요', 'warn'); return; }
      if (!amount || amount <= 0) { showToast('금액을 정확히 입력해주세요', 'warn'); return; }                                                            
      if (!cat)                   { showToast('카테고리를 선택해주세요', 'warn'); return; }                                                            
      if (!date)                  { showToast('날짜를 선택해주세요', 'warn'); return; }                                                                     
   
      try {                                                                     
          const updates = { type, amount, category: cat, description: desc, date};

          if (type === 'expense' && subCat) {                                   
              updates.subCategory = subCat;
          } else {                                                              
              // Clear subCategory if type changed to income or subcat was 
  removed                                                                       
              updates.subCategory = '';
          }                                                                     
                  
          await updateDoc(doc(db, 'transactions', id), updates);                
   
          showToast('수정 완료! ✓');                                            
          if (window.closeModal) window.closeModal('add-modal');
      } catch (error) {
          console.error("내역 수정 에러:", error);
          showToast('수정에 실패했습니다 (권한 확인)', 'error');                
      } finally {
          // Restore modal to add mode regardless of success or failure         
          document.querySelector('#add-modal .modal-title').textContent = '내역추가';
          const submitBtn = document.querySelector('#add-modal .btn-submit');   
          submitBtn.textContent = '기록하기';                                   
          submitBtn.onclick = () => window.addTransaction();
      }                                                                         
  }               

  window.addTransaction           = addTransaction;                             
  window.updateSubCategoryOptions = updateSubCategoryOptions;
  window.deleteTx                 = deleteTx;                                   
  window.editTx                   = editTx;
  window.updateTransaction        = updateTransaction;
