// Entry point — imports trigger all module side-effects (window assignments, listeners)
import { db } from './firebase.js';
import { state } from './state.js';
import './utils.js';
import './user.js';
import './friends.js';
import './auth.js';
import './profile.js';
import './ui.js';
import './record.js';
import './planner.js';
import { renderLedger } from './ledger.js';
import { renderBudget } from './budget.js';
import { renderDashboard } from './dashboard.js';
import { showScreen } from './ui.js';
import { ensureDefaultPlanner } from './planner.js';
import {
    collection, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function refreshAll() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'ledger';
    if (activeTab === 'ledger')    renderLedger();
    if (activeTab === 'budget')    renderBudget();
    if (activeTab === 'dashboard') renderDashboard();
}

// Exposed so planner.js and others can trigger a re-render after state changes
window.refreshAll = refreshAll;

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    const targetTab   = document.querySelector(`[data-tab="${tab}"]`);
    const targetPanel = document.getElementById(`panel-${tab}`);
    if (targetTab)   targetTab.classList.add('active');
    if (targetPanel) targetPanel.classList.add('active');

    refreshAll();
};

window.initAppData = async () => {
    if (!state.currentProfile) return;
    const pid = state.currentProfile.id;

    // Load (or create) planners before subscriptions fire so the first render
    // already has state.currentPlanner set
    await ensureDefaultPlanner(pid);

    // Real-time: all transactions for this profile (filtered by planner at render time)
    const txQ = query(
        collection(db, 'transactions'),
        where('profileId', '==', pid),
        orderBy('date', 'desc')
    );
    onSnapshot(txQ, snap => {
        state.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        refreshAll();
    });

    // Real-time: all budgets for this profile (keyed by plannerId_category)
    const budgetQ = query(collection(db, 'budgets'), where('profileId', '==', pid));
    onSnapshot(budgetQ, snap => {
        state.budgets = {};
        snap.docs.forEach(d => {
            const data = d.data();
            // Only index new-style budget documents that have a plannerId
            if (data.plannerId) {
                state.budgets[`${data.plannerId}_${data.category}`] = { id: d.id, ...data };
            }
        });
        refreshAll();
    });

    showScreen('app');
    window.switchTab('ledger');
};
