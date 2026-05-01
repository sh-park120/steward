import { loadSettings } from './settings.js';
import { db } from './firebase.js';
import { state, resetProfileState } from './state.js';
import './utils.js';
import './user.js';
import './friends.js';
import './auth.js';
import './profile.js';
import './record.js';
import { renderLedger } from './ledger.js';
import { renderBudget } from './budget.js';
import { renderDashboard } from './dashboard.js';
import { showScreen } from './ui.js';
import { ensureDefaultPlanner } from './planner.js';
import {
    collection, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

loadSettings();

// Active Firestore listeners — stored so they can be torn down on profile switch
let _unsubTx      = null;
let _unsubBudgets = null;

function refreshAll() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'ledger';
    if (activeTab === 'ledger')    renderLedger();
    if (activeTab === 'budget')    renderBudget();
    if (activeTab === 'dashboard') renderDashboard();
}

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

    // Tear down any listeners from a previous profile session
    if (_unsubTx)      { _unsubTx();      _unsubTx = null; }
    if (_unsubBudgets) { _unsubBudgets(); _unsubBudgets = null; }

    // Clear stale data so renders don't show the previous profile's content
    resetProfileState();

    const pid = state.currentProfile.id;

    // Load (or create) planners before subscriptions fire so the first
    // render already has state.currentPlanner set
    await ensureDefaultPlanner(pid);

    _unsubTx = onSnapshot(
        query(
            collection(db, 'transactions'),
            where('profileId', '==', pid),
            orderBy('date', 'desc')
        ),
        snap => {
            state.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            refreshAll();
        }
    );

    _unsubBudgets = onSnapshot(
        query(collection(db, 'budgets'), where('profileId', '==', pid)),
        snap => {
            state.budgets = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.plannerId) {
                    state.budgets[`${data.plannerId}_${data.category}`] = { id: d.id, ...data };
                }
            });
            refreshAll();
        }
    );

    showScreen('app');
    window.switchTab('ledger');
};
