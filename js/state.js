export const state = {
    currentUser: null,
    currentProfile: null,
    allProfiles: [],
    transactions: [],
    budgets: {},
    currentMonth: new Date().toISOString().slice(0, 7)
};
