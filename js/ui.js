import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './constants.js';

export function showScreen(name) {
    ['login', 'profile', 'app'].forEach(s => {
        const el = document.getElementById(`screen-${s}`);
        if (el) el.style.display = (s === name) ? '' : 'none';
    });
}

window.openAddModal = () => {
    document.querySelector('#add-modal .modal-title').textContent = '내역 추가';
    const submitBtn = document.querySelector('#add-modal .btn-submit');
    submitBtn.textContent = '기록하기';
    submitBtn.onclick = () => window.addTransaction();

    document.getElementById('add-modal').classList.add('open');
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-desc').value   = '';
    document.getElementById('tx-date').value   = new Date().toISOString().slice(0, 10);
    window.setTxType('income');
    if (window.updateCatOptions) window.updateCatOptions();
};

window.closeModal = (id) => document.getElementById(id).classList.remove('open');

window.openEditModal = (tx) => {
    document.querySelector('#add-modal .modal-title').textContent = '내역 수정';
    const submitBtn = document.querySelector('#add-modal .btn-submit');
    submitBtn.textContent = '수정하기';
    submitBtn.onclick = () => window.updateTransaction(tx.id);

    document.getElementById('add-modal').classList.add('open');

    window.setTxType(tx.type);
    if (window.updateCatOptions) window.updateCatOptions(tx.type);

    document.getElementById('tx-cat').value = tx.category;
    if (window.updateSubCategoryOptions) window.updateSubCategoryOptions();

    const subCatEl = document.getElementById('tx-subcat');
    if (subCatEl && tx.subCategory) subCatEl.value = tx.subCategory;

    document.getElementById('tx-amount').value = tx.amount.toLocaleString();
    document.getElementById('tx-desc').value   = tx.description || '';
    document.getElementById('tx-date').value   = tx.date;
};

window.setTxType = (type) => {
    document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
    });
    if (window.updateCatOptions) window.updateCatOptions(type);
};

window.updateCatOptions = (type) => {
    if (!type) {
        const activeBtn = document.querySelector('.type-btn.active');
        type = activeBtn ? activeBtn.dataset.type : 'expense';
    }

    const catSelect = document.getElementById('tx-cat');
    if (!catSelect) return;

    const options = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    catSelect.innerHTML = options.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    if (window.updateSubCategoryOptions) window.updateSubCategoryOptions();
};

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-picker');
    const display = document.getElementById('profile-emoji-display');
    if (picker && picker.style.display === 'block' && !picker.contains(e.target) && e.target !== display) {
        picker.style.display = 'none';
    }
});
