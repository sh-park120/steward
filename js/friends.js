import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import { findUserByUsername } from './user.js';
import {
    collection, doc, getDoc, addDoc, query, where,
    getDocs, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function loadFriendships() {
    const uid = state.currentUser.uid;

    const [sentSnap, receivedSnap] = await Promise.all([
        getDocs(query(collection(db, 'friendships'), where('fromUid', '==', uid))),
        getDocs(query(collection(db, 'friendships'), where('toUid', '==', uid)))
    ]);

    const sent     = sentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const received = receivedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.friendships = { sent, received };

    // Load user data for all friendship parties
    const allUids = new Set([
        ...sent.map(f => f.toUid),
        ...received.map(f => f.fromUid)
    ]);

    const userDocs = await Promise.all(
        [...allUids].map(fuid => getDoc(doc(db, 'users', fuid)))
    );
    state.friendUserMap = {};
    userDocs.filter(d => d.exists()).forEach(d => {
        state.friendUserMap[d.id] = d.data();
    });

    // Build accepted friends list
    const acceptedUids = [
        ...sent.filter(f => f.status === 'accepted').map(f => f.toUid),
        ...received.filter(f => f.status === 'accepted').map(f => f.fromUid)
    ];
    state.friends = acceptedUids.map(fuid => state.friendUserMap[fuid]).filter(Boolean);
}

export async function sendFriendRequest(username) {
    if (username === state.myUser?.username) {
        showToast('자기 자신을 추가할 수 없습니다.', 'warn');
        return;
    }

    const targetUser = await findUserByUsername(username);
    if (!targetUser) {
        showToast('존재하지 않는 ID입니다.', 'warn');
        return;
    }

    const all = [...state.friendships.sent, ...state.friendships.received];
    const already = all.some(f =>
        f.fromUid === targetUser.uid || f.toUid === targetUser.uid
    );
    if (already) {
        showToast('이미 친구이거나 요청 중입니다.', 'warn');
        return;
    }

    try {
        await addDoc(collection(db, 'friendships'), {
            fromUid: state.currentUser.uid,
            toUid: targetUser.uid,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        showToast(`@${targetUser.username}님께 친구 요청을 보냈습니다!`);
        await loadFriendships();
        renderFriendsModal();
    } catch (e) {
        console.error(e);
        showToast('요청 전송 실패', 'error');
    }
}

export async function acceptFriendRequest(friendshipId) {
    try {
        await updateDoc(doc(db, 'friendships', friendshipId), { status: 'accepted' });
        showToast('친구 요청을 수락했습니다!');
        await loadFriendships();
        renderFriendsModal();
    } catch (e) {
        console.error(e);
        showToast('수락 실패', 'error');
    }
}

export async function rejectOrCancelRequest(friendshipId) {
    try {
        await deleteDoc(doc(db, 'friendships', friendshipId));
        await loadFriendships();
        renderFriendsModal();
        showToast('요청이 처리되었습니다.', 'warn');
    } catch (e) {
        console.error(e);
        showToast('오류가 발생했습니다.', 'error');
    }
}

export function renderFriendsModal() {
    const content = document.getElementById('friends-modal-content');
    if (!content) return;

    const { sent, received } = state.friendships;
    const pendingIn  = received.filter(f => f.status === 'pending');
    const pendingOut = sent.filter(f => f.status === 'pending');

    const friendsHtml = state.friends.length > 0
        ? state.friends.map(f => `
            <div class="friend-card">
                <div class="friend-avatar">${f.displayName?.[0] || '?'}</div>
                <div class="friend-info">
                    <div class="friend-name">@${f.username}</div>
                    <div class="friend-display">${f.displayName || ''}</div>
                </div>
            </div>`).join('')
        : '<div class="friends-empty">아직 친구가 없어요</div>';

    const pendingInHtml = pendingIn.length === 0 ? '' : `
        <div class="friends-section-label" style="margin-top:16px;">받은 요청 (${pendingIn.length})</div>
        ${pendingIn.map(f => {
            const u = state.friendUserMap[f.fromUid] || {};
            return `
                <div class="friend-card">
                    <div class="friend-avatar">${u.displayName?.[0] || '?'}</div>
                    <div class="friend-info">
                        <div class="friend-name">@${u.username || '알 수 없음'}</div>
                        <div class="friend-display">${u.displayName || ''}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button class="friend-accept-btn" onclick="acceptRequest('${f.id}')">수락</button>
                        <button class="friend-reject-btn" onclick="cancelRequest('${f.id}')">거절</button>
                    </div>
                </div>`;
        }).join('')}`;

    const pendingOutHtml = pendingOut.length === 0 ? '' : `
        <div class="friends-section-label" style="margin-top:16px;">보낸 요청 (${pendingOut.length})</div>
        ${pendingOut.map(f => {
            const u = state.friendUserMap[f.toUid] || {};
            return `
                <div class="friend-card">
                    <div class="friend-avatar" style="background:var(--surface2);color:var(--muted);">⏳</div>
                    <div class="friend-info">
                        <div class="friend-name">@${u.username || '알 수 없음'}</div>
                        <div class="friend-display">${u.displayName || ''}</div>
                    </div>
                    <button class="friend-reject-btn" onclick="cancelRequest('${f.id}')">취소</button>
                </div>`;
        }).join('')}`;

    content.innerHTML = `
        <div class="friends-section-label">친구 (${state.friends.length})</div>
        ${friendsHtml}
        ${pendingInHtml}
        ${pendingOutHtml}
    `;
}

// ── Window-exposed handlers ──

window.acceptRequest = acceptFriendRequest;
window.cancelRequest = rejectOrCancelRequest;

window.openFriendsModal = async () => {
    document.getElementById('friends-modal').classList.add('open');
    const fmid = document.getElementById('friends-modal-myid');
    if (fmid && state.myUser) fmid.textContent = '@' + state.myUser.username;
    await loadFriendships();
    renderFriendsModal();
};

window.closeFriendsModal = () => {
    document.getElementById('friends-modal').classList.remove('open');
};

window.searchAndSendRequest = async () => {
    const input    = document.getElementById('friend-search-input');
    const username = input.value.trim().replace('@', '').toLowerCase();
    if (!username) return;
    await sendFriendRequest(username);
    input.value = '';
};
