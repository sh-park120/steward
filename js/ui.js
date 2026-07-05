import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './constants.js';
import { getAllTags } from './tags.js';

let modalTags = [];

// Snapshot of the chips as last rendered, so index-based toggles stay in sync
let tagSelectList = [];

// Tags are toggled from the managed list (see tags.js) instead of typed
window.renderModalTagSelect = () => {
    const container = document.getElementById('modal-tag-select');
    if (!container) return;
    // Include already-selected tags even if they left the managed list
    tagSelectList = [...new Set([...getAllTags(), ...modalTags])];
    container.innerHTML =
        tagSelectList.map((tag, i) =>
            `<button type="button" class="tag-filter-chip${modalTags.includes(tag) ? ' active' : ''}"
                     onclick="toggleModalTag(${i})">${tag}</button>`
        ).join('') +
        `<button type="button" class="tag-filter-chip tag-manage-open" onclick="openTagManageModal()">⚙️ 태그 관리</button>`;
};

window.toggleModalTag = (index) => {
    const tag = tagSelectList[index];
    if (!tag) return;
    modalTags = modalTags.includes(tag)
        ? modalTags.filter(t => t !== tag)
        : [...modalTags, tag];
    window.renderModalTagSelect();
};

// Called from tags.js after a rename (newName) or delete (newName = null)
window.replaceModalTag = (oldName, newName) => {
    modalTags = modalTags.filter(t => t !== oldName);
    if (newName && !modalTags.includes(newName)) modalTags.push(newName);
    window.renderModalTagSelect();
};

window.getModalTags = () => [...modalTags];

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
    modalTags = [];
    window.renderModalTagSelect();
    window.setTxType('expense');
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
    modalTags = [...(tx.tags || [])];
    window.renderModalTagSelect();
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
