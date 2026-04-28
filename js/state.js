export const state = {
    currentUser: null,
    myUser: null,
    currentProfile: null,
    allProfiles: [],
    transactions: [],
    budgets: {},
    currentMonth: new Date().toISOString().slice(0, 7),
    planners: [],
    currentPlanner: null,
    friends: [],
    friendships: { sent: [], received: [] },
    friendUserMap: {}
};
