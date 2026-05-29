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
    dashboard: {
        month:       todayYM(),
        compareView: 'row',
        catFilter:   { mode: 'all', month: '', from: '', to: '' }
    }
};

// Call before switching profiles to avoid stale data bleeding through
export function resetProfileState() {
    state.transactions   = [];
    state.budgets        = {};
    state.planners       = [];
    state.currentPlanner = null;
}
