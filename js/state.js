export const state = {
    currentUser:    null,
    myUser:         null,
    currentProfile: null,
    allProfiles:    [],
    transactions:   [],
    budgets:        {},
    currentMonth:   new Date().toISOString().slice(0, 7),
    planners:       [],
    currentPlanner: null,
    friends:        [],
    friendships:    { sent: [], received: [] },
    friendUserMap:  {}
};

// Call before switching profiles to avoid stale data bleeding through
export function resetProfileState() {
    state.transactions   = [];
    state.budgets        = {};
    state.planners       = [];
    state.currentPlanner = null;
}
