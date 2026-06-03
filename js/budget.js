import { db } from './firebase.js';
import { state, filters } from './state.js';
import { fmt, parseAmount, showToast, todayYM, shiftMonth, ymToDisplay } from './utils.js';
import { EXPENSE_CATEGORIES, getCatColor } from './constants.js';
import { buildDonutSlices, buildDonutSVGCircles } from './charts.js';
import {
    doc, setDoc, updateDoc, deleteField, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let expandedCats = {};
let budgetView   = 'row';

function getAvailableBudgetMonths() {
    if (!state.currentPlanner) return [];
    const pid = state.currentPlanner.id;
    const plannerTx = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && state.currentPlanner.isDefault)
    );
    const monthSet = new Set(plannerTx.map(t => t.date?.slice(0, 7)).filter(Boolean));
    return [...monthSet].sort().reverse();
}

function renderBudgetMonthNav() {
    const navEl = document.getElementById('budget-month-nav');
    if (!navEl) return;

    const availableMonths = getAvailableBudgetMonths();
    const ym    = filters.budget.month;
    const isAll = ym === '';
    const today = todayYM();
    const prevYM  = isAll ? today : shiftMonth(ym, -1);
    const nextYM  = isAll ? '' : shiftMonth(ym, 1);
    const canNext = !isAll && nextYM <= today;

    const chipsHtml = availableMonths.length > 0
        ? `<div class="month-chips-row">${availableMonths.map(m => {
              const [y, mo] = m.split('-');
              return `<button class="month-chip${m === ym ? ' active' : ''}" onclick="setBudgetMonth('${m}')">${y.slice(2)}.${mo}</button>`;
          }).join('')}</div>`
        : '';

    navEl.innerHTML = `
        <div class="month-nav-row">
            <button class="month-all-btn${isAll ? ' active' : ''}" onclick="setBudgetMonth('')">전체</button>
            <button class="month-arrow" onclick="setBudgetMonth('${prevYM}')"${isAll ? ' disabled' : ''}>&#9664;</button>
            <span class="month-nav-label">${isAll ? '전체 기간' : ymToDisplay(ym)}</span>
            <button class="month-arrow" onclick="setBudgetMonth('${nextYM}')"${!canNext ? ' disabled' : ''}>&#9654;</button>
        </div>
        ${chipsHtml}`;
}

function renderBudgetChart(catData) {
    const container = document.getElementById('budget-chart');
    if (!container) return;

    const budgetedCats = catData.filter(c => c.budAmt > 0);
    const total        = budgetedCats.reduce((s, c) => s + c.budAmt, 0);

    if (total === 0) { container.innerHTML = ''; return; }

    const items  = budgetedCats.map(c => ({ ...c, amount: c.budAmt, color: getCatColor(c.cat) }));
    const slices = buildDonutSlices(items).map(s => ({ ...s, pct: (s.amount / total) * 100 }));

    const legendItems = slices.map(s => `
        <div class="budget-chart-legend-item">
            <span class="budget-chart-dot" style="background:${s.color}"></span>
            <span class="budget-chart-cat">${s.cat}</span>
            <span class="budget-chart-pct">${s.pct.toFixed(1)}%</span>
            <span class="budget-chart-amt">${fmt(s.budAmt)}원</span>
        </div>`).join('');

    container.innerHTML = `
        <div class="budget-chart-wrap">
            <div class="budget-chart-donut">
                <svg viewBox="0 0 200 200" width="180" height="180">
                    ${buildDonutSVGCircles(slices)}
                    <text x="100" y="93" text-anchor="middle" class="chart-center-label">총 예산</text>
                    <text x="100" y="113" text-anchor="middle" class="chart-center-amount">${fmt(total)}</text>
                    <text x="100" y="128" text-anchor="middle" class="chart-center-unit">원</text>
                </svg>
            </div>
            <div class="budget-chart-legend">${legendItems}</div>
        </div>`;
}

window.setBudgetView = (view) => {
    budgetView = view;
    document.getElementById('btn-budget-row-view')?.classList.toggle('active', view === 'row');
    document.getElementById('btn-budget-block-view')?.classList.toggle('active', view === 'block');
    renderBudget();
};

window.toggleCat = (cat, event) => {
    if (event && event.target.closest('.budget-input-wrap')) return;
    expandedCats[cat] = !expandedCats[cat];
    renderBudget();
};

export function renderBudget() {
    renderBudgetMonthNav();

    const container = document.getElementById('budget-list');
    if (!container) return;

    if (!state.currentPlanner) {
        container.innerHTML = '<div class="empty-state">플래너를 선택해주세요</div>';
        return;
    }

    const pid = state.currentPlanner.id;
    let plannerTx = state.transactions.filter(t =>
        t.plannerId === pid || (!t.plannerId && state.currentPlanner.isDefault)
    );

    const ym = filters.budget.month;
    if (ym) plannerTx = plannerTx.filter(t => t.date?.startsWith(ym));

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

    renderBudgetChart(catData);

    if (budgetView === 'block') {
        container.innerHTML = `<div class="budget-grid">${catData.map(({ cat, budAmt, spent, pct, over }) => {
            const statusCls  = over ? 'bblock-over' : pct > 80 ? 'bblock-warn' : budAmt > 0 ? 'bblock-ok' : '';
            const remainHtml = budAmt > 0
                ? over
                    ? `<span class="bblock-over-text">${fmt(spent - budAmt)}원 초과</span>`
                    : `<span class="bblock-remain-text">${fmt(budAmt - spent)}원 남음</span>`
                : `<span class="bblock-unset">미설정</span>`;
            return `
            <div class="budget-block ${statusCls} cat-clickable" onclick="showCatTxModal('${cat}', '')">
                <div class="bblock-name">${cat}</div>
                <div class="bblock-bar-bg"><div class="bblock-bar ${over ? 'over' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></div></div>
                <div class="bblock-spent">${fmt(spent)}원 지출</div>
                <div class="bblock-remain">${remainHtml}</div>
            </div>`;
        }).join('')}</div>`;
        return;
    }

    container.innerHTML = catData.map(({ cat, budAmt, subCategories, subCatKeys, hasSubCats, spent, pct, over }) => {
        const isExpanded = expandedCats[cat];

        let subCatHtml = '';
        if (isExpanded) {
            const subListHtml = subCatKeys.map(subName => {
                const subAmt     = subCategories[subName];
                const safeSubName = subName.replace(/\s+/g, '');
                const subSpent   = plannerTx
                    .filter(t => t.type === 'expense' && t.category === cat && t.subCategory === subName)
                    .reduce((s, t) => s + t.amount, 0);
                return `
                    <div class="sub-budget-row">
                        <div class="sub-budget-info">
                            <span class="sub-budget-name">- ${subName}</span>
                            <span class="sub-budget-spent">지출: ${fmt(subSpent)}원</span>
                        </div>
                        <div class="budget-input-wrap">
                            <input type="text" class="budget-input sub-input" id="sub-input-${cat}-${safeSubName}"
                                   value="${subAmt > 0 ? fmt(subAmt) : ''}"
                                   placeholder="세부 예산"
                                   oninput="this.value=window.fmtInput(this.value)">
                            <span class="budget-unit">원</span>
                            <button class="sub-save-btn" onclick="saveSubBudget('${cat}', '${subName}', '${safeSubName}')">저장</button>
                            <button class="sub-delete-btn" onclick="deleteSubBudget('${cat}', '${subName}')">삭제</button>
                        </div>
                    </div>`;
            }).join('');

            subCatHtml = `
                <div class="sub-budget-container">
                    <div class="sub-budget-header">세부 예산 설정</div>
                    ${subListHtml}
                    <div class="sub-budget-new-row">
                        <input type="text" id="new-sub-name-${cat}" class="sub-budget-name-input" placeholder="새 항목 (예: 회식)">
                        <button class="sub-budget-add-btn" onclick="addSubCategory('${cat}')">+ 추가</button>
                    </div>
                </div>`;
        }

        return `
            <div class="budget-row">
                <div class="budget-main-area" onclick="toggleCat('${cat}', event)">
                    <div class="budget-row-top">
                        <span class="budget-cat">
                            ${isExpanded ? '🔽' : '▶️'} ${cat}
                            <button class="budget-history-btn" onclick="event.stopPropagation(); showCatTxModal('${cat}', '')" title="내역 보기">내역</button>
                        </span>
                        <div class="budget-input-wrap" onclick="event.stopPropagation()">
                            <input type="text" class="budget-input" id="budget-input-${cat}"
                                   value="${budAmt > 0 ? fmt(budAmt) : ''}"
                                   placeholder="${hasSubCats ? '자동 합산됨' : '총 예산 입력'}"
                                   ${hasSubCats
                                       ? 'readonly title="세부 항목의 합계입니다"'
                                       : 'oninput="this.value=window.fmtInput(this.value)"'}>
                            <span class="budget-unit">원</span>
                            ${hasSubCats
                                ? `<span class="budget-sum-label">(합산)</span>`
                                : `<button class="budget-save-btn" onclick="saveBudget('${cat}')">저장</button>`}
                        </div>
                    </div>
                    <div class="budget-bar-bg" style="margin-top:8px">
                        <div class="budget-bar ${over ? 'over' : pct > 80 ? 'warn' : ''}" style="width:${pct}%"></div>
                    </div>
                    <div class="budget-stat">
                        <span>${fmt(spent)}원 지출</span>
                        <span>${budAmt > 0
                            ? over
                                ? `<span class="over-text">${fmt(spent - budAmt)}원 초과</span>`
                                : `<span class="remain-text">${fmt(budAmt - spent)}원 남음</span>`
                            : '예산을 설정해주세요'}</span>
                    </div>
                </div>
                ${subCatHtml}
            </div>`;
    }).join('');
}

// ── Budget save helpers ──

function currentBudgetId(cat) {
    return `${state.currentProfile.id}_${state.currentPlanner.id}_${cat}`;
}

function baseBudgetDoc(cat) {
    return {
        profileId: state.currentProfile.id,
        plannerId: state.currentPlanner.id,
        category:  cat,
        updatedAt: serverTimestamp()
    };
}

window.saveBudget = async (cat) => {
    const inputEl = document.getElementById(`budget-input-${cat}`);
    if (!inputEl || !state.currentPlanner) return;
    const amount = parseAmount(inputEl);
    try {
        await setDoc(doc(db, 'budgets', currentBudgetId(cat)), { ...baseBudgetDoc(cat), amount }, { merge: true });
        showToast(`${cat} 예산이 저장되었습니다!`);
    } catch (e) {
        console.error(e);
        showToast('예산 저장에 실패했습니다', 'error');
    }
};

window.addSubCategory = async (cat) => {
    if (!state.currentPlanner) return;
    const nameInput = document.getElementById(`new-sub-name-${cat}`);
    const subName   = nameInput?.value.trim();
    if (!subName) { showToast('세부항목 이름을 입력하세요', 'warn'); return; }

    const key           = `${state.currentPlanner.id}_${cat}`;
    const subCategories = { ...(state.budgets[key]?.subCategories || {}) };
    if (subCategories[subName] !== undefined) { showToast('이미 존재하는 세부항목입니다', 'warn'); return; }

    subCategories[subName] = 0;
    const newTotal = Object.values(subCategories).reduce((s, v) => s + (v || 0), 0);
    try {
        await setDoc(doc(db, 'budgets', currentBudgetId(cat)), { ...baseBudgetDoc(cat), amount: newTotal, subCategories }, { merge: true });
        showToast(`${subName} 항목이 추가되었습니다`);
    } catch (e) {
        console.error(e);
        showToast('항목 추가에 실패했습니다', 'error');
    }
};

window.saveSubBudget = async (cat, subName, safeSubName) => {
    if (!state.currentPlanner) return;
    const inputEl = document.getElementById(`sub-input-${cat}-${safeSubName}`);
    if (!inputEl) return;

    const key           = `${state.currentPlanner.id}_${cat}`;
    const subCategories = { ...(state.budgets[key]?.subCategories || {}) };
    subCategories[subName] = parseAmount(inputEl);
    const newTotal = Object.values(subCategories).reduce((s, v) => s + (v || 0), 0);
    try {
        await setDoc(doc(db, 'budgets', currentBudgetId(cat)), { ...baseBudgetDoc(cat), amount: newTotal, subCategories }, { merge: true });
        showToast(`${subName} 예산이 저장되었습니다`);
    } catch (e) {
        console.error(e);
        showToast('저장에 실패했습니다', 'error');
    }
};

window.deleteSubBudget = async (cat, subName) => {
    if (!state.currentPlanner || !confirm(`'${subName}' 항목을 삭제하시겠습니까?`)) return;

    const key           = `${state.currentPlanner.id}_${cat}`;
    const subCategories = { ...(state.budgets[key]?.subCategories || {}) };
    delete subCategories[subName];
    const newTotal = Object.values(subCategories).reduce((s, v) => s + (v || 0), 0);
    try {
        await updateDoc(doc(db, 'budgets', currentBudgetId(cat)), {
            amount: newTotal,
            [`subCategories.${subName}`]: deleteField(),
            updatedAt: serverTimestamp()
        });
        showToast(`${subName} 항목이 삭제되었습니다`);
    } catch (e) {
        console.error(e);
        showToast('삭제에 실패했습니다', 'error');
    }
};

window.setBudgetMonth = (ym) => { filters.budget.month = ym; renderBudget(); };
