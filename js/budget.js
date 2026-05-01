import { db } from './firebase.js';
import { state } from './state.js';
import { fmt, showToast } from './utils.js';
import { EXPENSE_CATEGORIES } from './constants.js';
import {
    doc, setDoc, updateDoc, deleteField, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.expandedCats = window.expandedCats || {};
let budgetView = 'row'; // 'row' | 'block'

window.setBudgetView = (view) => {
    budgetView = view;
    document.getElementById('btn-budget-row-view')?.classList.toggle('active', view === 'row');
    document.getElementById('btn-budget-block-view')?.classList.toggle('active', view === 'block');
    renderBudget();
};

window.toggleCat = (cat, event) => {
    if (event && event.target.closest('.budget-input-wrap')) return;
    window.expandedCats[cat] = !window.expandedCats[cat];
    renderBudget();
};

export function renderBudget() {
    const container = document.getElementById('budget-list');
    if (!container) return;

    if (!state.currentPlanner) {
        container.innerHTML = '<div class="empty-state">플래너를 선택해주세요</div>';
        return;
    }

    const pid        = state.currentPlanner.id;
    // Transactions in this planner (old transactions without plannerId belong to default)
    const plannerTx  = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && state.currentPlanner.isDefault)
    );

    const catData = EXPENSE_CATEGORIES.map(cat => {
        const key           = `${pid}_${cat}`;
        const budgetData    = state.budgets[key] || {};
        const budAmt        = budgetData.amount || 0;
        const subCategories = budgetData.subCategories || {};
        const subCatKeys    = Object.keys(subCategories);
        const hasSubCats    = subCatKeys.length > 0;
        const spent = plannerTx
            .filter(t => t.type === 'expense' && t.category === cat)
            .reduce((s, t) => s + t.amount, 0);
        const pct  = budAmt > 0 ? Math.min(100, Math.round((spent / budAmt) * 100)) : 0;
        const over = budAmt > 0 && spent > budAmt;
        return { cat, budAmt, subCategories, subCatKeys, hasSubCats, spent, pct, over };
    });

    if (budgetView === 'block') {
        container.innerHTML = `<div class="budget-grid">${catData.map(({ cat, budAmt, spent, pct, over }) => {
            const statusCls = over ? 'bblock-over' : pct > 80 ? 'bblock-warn' : budAmt > 0 ? 'bblock-ok' : '';
            const remainHtml = budAmt > 0
                ? (over
                    ? `<span class="bblock-over-text">${fmt(spent - budAmt)}원 초과</span>`
                    : `<span class="bblock-remain-text">${fmt(budAmt - spent)}원 남음</span>`)
                : `<span class="bblock-unset">미설정</span>`;
            return `
            <div class="budget-block ${statusCls}">
                <div class="bblock-name">${cat}</div>
                <div class="bblock-bar-bg"><div class="bblock-bar ${over ? 'over' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></div></div>
                <div class="bblock-spent">${fmt(spent)}원 지출</div>
                <div class="bblock-remain">${remainHtml}</div>
            </div>`;
        }).join('')}</div>`;
        return;
    }

    container.innerHTML = catData.map(({ cat, budAmt, subCategories, subCatKeys, hasSubCats, spent, pct, over }) => {
        const isExpanded = window.expandedCats[cat];

        let subCatHtml = '';
        if (isExpanded) {
            const subListHtml = subCatKeys.map(subName => {
                const subAmt   = subCategories[subName];
                const subSpent = plannerTx
                    .filter(t => t.type === 'expense' && t.category === cat && t.subCategory === subName)
                    .reduce((s, t) => s + t.amount, 0);
                const safeSubName = subName.replace(/\s+/g, '');

                return `
                    <div class="sub-budget-row" style="display:flex; justify-content:space-between; align-items:center; margin: 6px 0 6px 12px; padding: 6px; border-left: 2px solid var(--accent); background: #fdfdfd;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span style="font-size: 13px; color: #555; font-weight: bold;">- ${subName}</span>
                            <span style="font-size: 11px; color: #888;">지출: ${fmt(subSpent)}원</span>
                        </div>
                        <div class="budget-input-wrap">
                            <input type="text" class="budget-input" id="sub-input-${cat}-${safeSubName}"
                                   value="${subAmt > 0 ? fmt(subAmt) : ''}"
                                   placeholder="세부 예산" style="width: 70px; font-size: 12px;"
                                   oninput="this.value=window.fmtInput(this.value)">
                            <span class="budget-unit" style="font-size: 12px;">원</span>
                            <button onclick="saveSubBudget('${cat}', '${subName}', '${safeSubName}')" style="background:#ddd; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:4px;">저장</button>
                            <button onclick="deleteSubBudget('${cat}', '${subName}')" style="background:#ffdddd; color:#cc0000; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:2px;">삭제</button>
                        </div>
                    </div>`;
            }).join('');

            subCatHtml = `
                <div class="sub-budget-container" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px; font-weight: bold;">👇 세부 예산 설정</div>
                    ${subListHtml}
                    <div style="display:flex; gap: 6px; margin-top: 10px; margin-left: 12px;">
                        <input type="text" id="new-sub-name-${cat}" placeholder="새 항목 (예: 회식)" style="padding: 4px; font-size: 12px; flex: 1; border: 1px solid #ddd; border-radius: 4px;">
                        <button onclick="addSubCategory('${cat}')" style="background:var(--accent); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;">+ 추가</button>
                    </div>
                </div>`;
        }

        return `
            <div class="budget-row" style="margin-bottom: 16px;">
                <div class="budget-main-area" onclick="toggleCat('${cat}', event)" style="cursor: pointer; padding: 6px; border-radius: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='transparent'">
                    <div class="budget-row-top" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="budget-cat" style="user-select: none;">
                            ${isExpanded ? '🔽' : '▶️'} ${cat}
                        </span>
                        <div class="budget-input-wrap" onclick="event.stopPropagation()">
                            <input type="text" class="budget-input" id="budget-input-${cat}"
                                   value="${budAmt > 0 ? fmt(budAmt) : ''}"
                                   placeholder="${hasSubCats ? '자동 합산됨' : '총 예산 입력'}"
                                   ${hasSubCats
                                       ? 'readonly style="background:#efefef; color:#888;" title="세부 항목의 합계입니다"'
                                       : 'oninput="this.value=window.fmtInput(this.value)"'}>
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
                        <span>${fmt(spent)}원 지출</span>
                        <span>${budAmt > 0
                            ? (over
                                ? `<span class="over-text">${fmt(spent - budAmt)}원 초과</span>`
                                : `<span class="remain-text">${fmt(budAmt - spent)}원 남음</span>`)
                            : '예산을 설정해주세요'}</span>
                    </div>
                </div>
                ${subCatHtml}
            </div>`;
    }).join('');
}

// ── Budget save helpers ──

function currentBudgetId(cat) {
    const pid      = state.currentProfile.id;
    const plannerId = state.currentPlanner.id;
    return `${pid}_${plannerId}_${cat}`;
}

function baseBudgetDoc(cat) {
    const pid       = state.currentProfile.id;
    const plannerId  = state.currentPlanner.id;
    return {
        profileId: pid,
        plannerId,
        category: cat,
        updatedAt: serverTimestamp()
    };
}

window.saveBudget = async (cat) => {
    const inputEl = document.getElementById(`budget-input-${cat}`);
    if (!inputEl || !state.currentPlanner) return;

    const amount = parseInt(inputEl.value.replace(/,/g, '')) || 0;

    try {
        await setDoc(doc(db, 'budgets', currentBudgetId(cat)), {
            ...baseBudgetDoc(cat), amount
        }, { merge: true });
        showToast(`${cat} 예산이 저장되었습니다!`);
    } catch (e) {
        console.error(e);
        alert('예산 저장에 권한 문제가 있거나 실패했습니다.');
    }
};

window.addSubCategory = async (cat) => {
    if (!state.currentPlanner) return;
    const nameInput = document.getElementById(`new-sub-name-${cat}`);
    const subName   = nameInput.value.trim();
    if (!subName) return alert('세부항목 이름을 입력하세요.');

    const key           = `${state.currentPlanner.id}_${cat}`;
    const existingData  = state.budgets[key] || {};
    const subCategories = { ...(existingData.subCategories || {}) };

    if (subCategories[subName] !== undefined) return alert('이미 존재하는 세부항목입니다.');
    subCategories[subName] = 0;
    const newTotal = Object.values(subCategories).reduce((s, v) => s + (v || 0), 0);

    try {
        await setDoc(doc(db, 'budgets', currentBudgetId(cat)), {
            ...baseBudgetDoc(cat), amount: newTotal, subCategories
        }, { merge: true });
        showToast(`${subName} 항목이 추가되었습니다.`);
    } catch (e) {
        console.error(e);
        alert('항목 추가에 실패했습니다.');
    }
};

window.saveSubBudget = async (cat, subName, safeSubName) => {
    if (!state.currentPlanner) return;
    const inputEl = document.getElementById(`sub-input-${cat}-${safeSubName}`);
    if (!inputEl) return;

    const amount        = parseInt(inputEl.value.replace(/,/g, '')) || 0;
    const key           = `${state.currentPlanner.id}_${cat}`;
    const existingData  = state.budgets[key] || {};
    const subCategories = { ...(existingData.subCategories || {}) };
    subCategories[subName] = amount;
    const newTotal = Object.values(subCategories).reduce((s, v) => s + (v || 0), 0);

    try {
        await setDoc(doc(db, 'budgets', currentBudgetId(cat)), {
            ...baseBudgetDoc(cat), amount: newTotal, subCategories
        }, { merge: true });
        showToast(`${subName} 예산이 저장되었습니다.`);
    } catch (e) {
        console.error(e);
    }
};

window.deleteSubBudget = async (cat, subName) => {
    if (!state.currentPlanner || !confirm(`'${subName}' 항목을 삭제하시겠습니까?`)) return;

    const key           = `${state.currentPlanner.id}_${cat}`;
    const existingData  = state.budgets[key] || {};
    const subCategories = { ...(existingData.subCategories || {}) };
    delete subCategories[subName];
    const newTotal = Object.values(subCategories).reduce((s, v) => s + (v || 0), 0);

    try {
        await updateDoc(doc(db, 'budgets', currentBudgetId(cat)), {
            amount: newTotal,
            [`subCategories.${subName}`]: deleteField(),
            updatedAt: serverTimestamp()
        });
        showToast(`${subName} 항목이 삭제되었습니다.`);
    } catch (e) {
        console.error(e);
        alert('항목 삭제에 실패했습니다.');
    }
};
