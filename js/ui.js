import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './constants.js';

export function showScreen(name) {
    ['login', 'profile', 'app'].forEach(s => {
        const el = document.getElementById(`screen-${s}`);
        if (el) el.style.display = (s === name) ? '' : 'none';
    });
}

window.openAddModal = () => {
    document.getElementById('add-modal').classList.add('open');
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    if (window.updateCatOptions) window.updateCatOptions();
};

window.closeModal = (id) => document.getElementById(id).classList.remove('open');

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
