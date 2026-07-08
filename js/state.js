import { todayYM } from './utils.js';

export const state = {
    currentUser:    null,
    myUser:         null,
    currentProfile: null,
    allProfiles:    [],
    transactions:   [],
    budgets:        {},
    planners:       [],
    currentPlanner: null,
    friends:        [],
    friendships:    { sent: [], received: [] },
    friendUserMap:  {}
};

// UI filter state — kept separate from server data
export const filters = {
    ledger: {
        month: todayYM(),
        tags:  new Set()
    },
    budget: {
        month: todayYM()
    },
    dashboard: {
        month:       todayYM(),
        compareView: 'row',
        catFilter:   { mode: 'all', month: '', from: '', to: '' }
    }
};

// A transaction belongs to a planner when its plannerId matches. Legacy logs
// (added before planners existed, or whose planner was since deleted) have no
// matching planner doc — those fall back to the default planner so they stay visible.
export function txInPlanner(t, planner) {
    if (!planner) return false;
    if (t.plannerId === planner.id) return true;
    if (!planner.isDefault) return false;
    return !t.plannerId || !state.planners.some(p => p.id === t.plannerId);
}

// Call before switching profiles to avoid stale data bleeding through
export function resetProfileState() {
    state.transactions   = [];
    state.budgets        = {};
    state.planners       = [];
    state.currentPlanner = null;
}
