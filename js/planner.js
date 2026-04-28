import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import {
    collection, doc, addDoc, getDocs, deleteDoc,
    query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Core logic ──

async function loadPlanners(profileId) {
    const snap = await getDocs(
        query(collection(db, 'budgetPlanners'), where('profileId', '==', profileId))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ensureDefaultPlanner(profileId) {
    let planners = await loadPlanners(profileId);

    if (planners.length === 0) {
        const docRef = await addDoc(collection(db, 'budgetPlanners'), {
            profileId,
            name: '기본 플래너',
            isDefault: true,
            createdAt: serverTimestamp()
        });
        planners = [{ id: docRef.id, profileId, name: '기본 플래너', isDefault: true }];
    }

    // Default planner always first
    state.planners = planners.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
    });

    // Restore previously selected planner if it still exists, otherwise use default
    const savedId = sessionStorage.getItem(`planner_${profileId}`);
    state.currentPlanner =
        state.planners.find(p => p.id === savedId) ||
        state.planners.find(p => p.isDefault) ||
        state.planners[0];

    renderPlannerStrip();
}

export function renderPlannerStrip() {
    const strip  = document.getElementById('planner-strip');
    const select = document.getElementById('planner-select');
    if (!strip || !select) return;

    select.innerHTML = state.planners.map(p =>
        `<option value="${p.id}" ${p.id === state.currentPlanner?.id ? 'selected' : ''}>
            ${p.isDefault ? '🏠 ' : '📋 '}${p.name}
        </option>`
    ).join('');

    strip.style.display = 'flex';
}

// ── Window-exposed handlers ──

window.switchPlanner = (plannerId) => {
    const planner = state.planners.find(p => p.id === plannerId);
    if (!planner) return;
    state.currentPlanner = planner;
    // Remember selection for this profile session
    if (state.currentProfile) {
        sessionStorage.setItem(`planner_${state.currentProfile.id}`, plannerId);
    }
    if (window.refreshAll) window.refreshAll();
};

window.openNewPlannerModal = () => {
    document.getElementById('new-planner-modal').classList.add('open');
    const input = document.getElementById('planner-name-input');
    input.value = '';
    setTimeout(() => input.focus(), 100);
};

window.createPlanner = async () => {
    const input = document.getElementById('planner-name-input');
    const name  = input.value.trim();
    if (!name) { showToast('플래너 이름을 입력해주세요', 'warn'); return; }

    const pid = state.currentProfile?.id;
    if (!pid) return;

    try {
        const docRef = await addDoc(collection(db, 'budgetPlanners'), {
            profileId: pid,
            name,
            isDefault: false,
            createdAt: serverTimestamp()
        });

        const newPlanner = { id: docRef.id, profileId: pid, name, isDefault: false };
        state.planners.push(newPlanner);
        state.currentPlanner = newPlanner;
        sessionStorage.setItem(`planner_${pid}`, newPlanner.id);

        renderPlannerStrip();
        if (window.closeModal) window.closeModal('new-planner-modal');
        showToast(`'${name}' 플래너가 생성되었습니다!`);
        if (window.refreshAll) window.refreshAll();
    } catch (e) {
        console.error(e);
        showToast('플래너 생성 실패', 'error');
    }
};

window.deletePlanner = async (plannerId, event) => {
    event?.stopPropagation();
    const planner = state.planners.find(p => p.id === plannerId);
    if (!planner) return;
    if (planner.isDefault) { showToast('기본 플래너는 삭제할 수 없습니다.', 'warn'); return; }
    if (!confirm(`'${planner.name}' 플래너를 삭제하시겠습니까?\n(해당 플래너의 예산 데이터가 삭제됩니다)`)) return;

    try {
        await deleteDoc(doc(db, 'budgetPlanners', plannerId));
        state.planners = state.planners.filter(p => p.id !== plannerId);

        // Fall back to default planner
        state.currentPlanner = state.planners.find(p => p.isDefault) || state.planners[0];
        renderPlannerStrip();
        showToast('플래너가 삭제되었습니다.', 'warn');
        if (window.refreshAll) window.refreshAll();
    } catch (e) {
        console.error(e);
        showToast('삭제 실패', 'error');
    }
};
