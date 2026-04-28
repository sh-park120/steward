import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import { showScreen } from './ui.js';
import { loadFriendships } from './friends.js';
import {
    collection, doc, addDoc, getDoc, getDocs, deleteDoc,
    query, where, updateDoc, arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const EMOJI_LIST = [
    '😊', '😄', '😁', '🙂', '😉', '😎', '🤗', '😇', '😌',
    '🥰', '😍', '😺', '🐶', '🐱', '🐻', '🐼', '🦊', '🐰', '🧸',
    '✨', '🌙', '⭐', '🌟', '💫', '🌈', '☁️', '🌸', '🌼', '🍀',
    '🔥', '💪', '🚀', '🌱', '🌿', '🏆', '🎯', '💡', '⚡', '📈',
    '🎮', '🎧', '🎨', '🎬', '🎤', '🎸', '📚', '✏️', '🖌️', '📷',
    '☕', '🍵', '🍜', '🍣', '🍰', '🍪', '🛋️', '🕯️', '🧺', '🛍️',
    '🏖️', '🌊', '🏝️', '🌲', '🌳', '🏔️', '🌅', '🌄', '🚗', '✈️',
    '💬', '📌', '🧭', '📝', '📷', '🔖', '📎', '📦', '🔑', '🪪'
];

export function initEmojiPicker() {
    const grid = document.getElementById('emoji-grid');
    if (!grid) return;
    grid.innerHTML = EMOJI_LIST.map(emoji =>
        `<span onclick="selectEmoji('${emoji}')">${emoji}</span>`
    ).join('');
}

window.toggleEmojiPicker = (e) => {
    if (e) e.stopPropagation();
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    picker.style.display = (picker.style.display === 'none') ? 'block' : 'none';
};

window.selectEmoji = (emoji) => {
    const display = document.getElementById('profile-emoji-display');
    const input   = document.getElementById('profile-emoji');
    const picker  = document.getElementById('emoji-picker');
    if (display) display.textContent = emoji;
    if (input)   input.value = emoji;
    if (picker)  picker.style.display = 'none';
};

// ── Profile CRUD ──

export async function loadProfiles() {
    try {
        const uid = state.currentUser.uid;
        const byId = {};

        // Query 1: profiles owned by this user (works for both old and new structure)
        const ownedSnap = await getDocs(
            query(collection(db, 'profiles'), where('uid', '==', uid))
        );
        ownedSnap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });

        // Query 2: shared profiles where user is a non-owner member
        // Kept separate so a failure here doesn't block owned profiles from loading
        try {
            const memberSnap = await getDocs(
                query(collection(db, 'profiles'), where('members', 'array-contains', uid))
            );
            memberSnap.docs.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
        } catch (e) {
            console.warn("공유 프로필 쿼리 실패 (무시됨):", e.message);
        }

        state.allProfiles = Object.values(byId);

        // Migrate old profiles that don't have a members field yet
        // Only migrate profiles the current user owns (uid matches)
        const toMigrate = state.allProfiles.filter(p => !p.members && p.uid === uid);
        if (toMigrate.length > 0) {
            await Promise.all(toMigrate.map(p =>
                updateDoc(doc(db, 'profiles', p.id), { members: [p.uid], isShared: false })
            ));
            toMigrate.forEach(p => { p.members = [p.uid]; p.isShared = false; });
        }

        renderProfiles();
    } catch (error) {
        console.error("프로필 로드 에러:", error);
    }
}

function renderProfiles() {
    const list = document.getElementById('profile-list');
    if (!list) return;

    if (state.allProfiles.length === 0) {
        list.innerHTML = '<p class="no-profile">아직 프로필이 없어요. 새 프로필을 만들어보세요!</p>';
        return;
    }

    list.innerHTML = state.allProfiles.map(p => {
        const isOwner  = p.uid === state.currentUser.uid;
        const isShared = p.isShared || (p.members && p.members.length > 1);

        return `
        <div class="profile-card" onclick="selectProfile('${p.id}')">
            <div class="profile-avatar">${p.emoji || '👤'}</div>
            <div class="profile-info">
                <div class="profile-pname">
                    ${p.name}
                    ${isShared ? '<span class="shared-badge">공유</span>' : ''}
                </div>
                <div class="profile-hint">${isOwner ? '탭해서 입장 →' : '공유 플래너'}</div>
            </div>
            <div class="profile-actions">
                ${isOwner
                    ? `<button class="profile-share-btn" onclick="openShareModal('${p.id}', event)" title="공유 관리">👥</button>
                       <button class="profile-delete" onclick="deleteProfile('${p.id}', event)">✕</button>`
                    : `<button class="profile-leave-btn" onclick="leaveProfile('${p.id}', event)">나가기</button>`}
            </div>
        </div>`;
    }).join('');
}

window.createProfile = async () => {
    const nameInput  = document.getElementById('profile-name');
    const emojiInput = document.getElementById('profile-emoji');
    const name  = nameInput.value.trim();
    const emoji = emojiInput.value || '😊';

    if (!name) return alert('이름을 입력해주세요');

    try {
        await addDoc(collection(db, 'profiles'), {
            uid: state.currentUser.uid,
            members: [state.currentUser.uid],
            name, emoji,
            isShared: false,
            createdAt: serverTimestamp()
        });

        nameInput.value = '';
        document.getElementById('profile-emoji-display').textContent = '😊';
        document.getElementById('profile-emoji').value = '😊';

        showToast('새 프로필이 생성되었습니다!');
        await loadProfiles();
    } catch (e) {
        console.error(e);
        alert('프로필 생성 실패');
    }
};

window.selectProfile = (id) => {
    state.currentProfile = state.allProfiles.find(p => p.id === id);
    if (!state.currentProfile) return;

    const nameEl  = document.getElementById('current-profile-name');
    const emojiEl = document.getElementById('current-profile-emoji');
    if (nameEl)  nameEl.textContent  = state.currentProfile.name;
    if (emojiEl) emojiEl.textContent = state.currentProfile.emoji;

    if (typeof window.initAppData === 'function') {
        window.initAppData();
    }
};

window.deleteProfile = async (id, e) => {
    e.stopPropagation();
    if (!confirm('프로필과 관련된 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;

    try {
        await deleteDoc(doc(db, 'profiles', id));
        showToast('프로필이 삭제되었습니다.', 'warn');
        loadProfiles();
    } catch (e) {
        console.error(e);
    }
};

window.leaveProfile = async (profileId, event) => {
    event.stopPropagation();
    if (!confirm('이 공유 플래너에서 나가시겠습니까?')) return;

    try {
        await updateDoc(doc(db, 'profiles', profileId), {
            members: arrayRemove(state.currentUser.uid)
        });
        showToast('플래너에서 나갔습니다.', 'warn');
        await loadProfiles();
    } catch (e) {
        console.error(e);
        showToast('오류가 발생했습니다.', 'error');
    }
};

window.backToProfiles = () => {
    showScreen('profile');
    loadProfiles();
};

// ── Share Modal ──

window.openShareModal = async (profileId, event) => {
    event.stopPropagation();

    const profile = state.allProfiles.find(p => p.id === profileId);
    if (!profile) return;

    // Ensure friend data is loaded
    if (!state.friends.length && !Object.keys(state.friendUserMap).length) {
        await loadFriendships();
    }

    // Load user data for current non-owner members
    const memberUids    = (profile.members || []).filter(uid => uid !== state.currentUser.uid);
    const memberDocs    = await Promise.all(memberUids.map(uid => getDoc(doc(db, 'users', uid))));
    const memberUsers   = memberDocs.filter(d => d.exists()).map(d => d.data());

    // Friends not yet in the profile
    const availableFriends = state.friends.filter(f =>
        !(profile.members || []).includes(f.uid)
    );

    const content = document.getElementById('share-modal-content');
    content.innerHTML = `
        <div class="share-profile-name">${profile.emoji} ${profile.name}</div>

        <div class="friends-section-label" style="margin-top:16px;">현재 멤버</div>
        <div class="friend-card">
            <div class="friend-avatar">${state.myUser?.displayName?.[0] || '?'}</div>
            <div class="friend-info">
                <div class="friend-name">@${state.myUser?.username || '나'}</div>
            </div>
            <span style="font-size:11px;color:var(--muted);">소유자</span>
        </div>
        ${memberUsers.map(u => `
            <div class="friend-card">
                <div class="friend-avatar">${u.displayName?.[0] || '?'}</div>
                <div class="friend-info">
                    <div class="friend-name">@${u.username}</div>
                    <div class="friend-display">${u.displayName || ''}</div>
                </div>
                <button class="friend-reject-btn" onclick="removeMember('${profileId}', '${u.uid}')">제거</button>
            </div>`).join('')}

        <div class="friends-section-label" style="margin-top:16px;">친구 초대</div>
        ${availableFriends.length > 0
            ? availableFriends.map(f => `
                <div class="friend-card">
                    <div class="friend-avatar">${f.displayName?.[0] || '?'}</div>
                    <div class="friend-info">
                        <div class="friend-name">@${f.username}</div>
                        <div class="friend-display">${f.displayName || ''}</div>
                    </div>
                    <button class="friend-accept-btn" onclick="inviteFriend('${profileId}', '${f.uid}')">초대</button>
                </div>`).join('')
            : `<div class="friends-empty">${state.friends.length === 0
                ? '친구를 먼저 추가해보세요!'
                : '모든 친구가 이미 멤버예요'}</div>`}
    `;

    document.getElementById('share-modal').classList.add('open');
};

window.inviteFriend = async (profileId, friendUid) => {
    try {
        await updateDoc(doc(db, 'profiles', profileId), {
            members: arrayUnion(friendUid),
            isShared: true
        });
        showToast('친구를 초대했습니다!');
        await loadProfiles();
        await window.openShareModal(profileId, { stopPropagation: () => {} });
    } catch (e) {
        console.error(e);
        showToast('초대 실패', 'error');
    }
};

window.removeMember = async (profileId, memberUid) => {
    if (!confirm('이 멤버를 제거하시겠습니까?')) return;

    try {
        const profile         = state.allProfiles.find(p => p.id === profileId);
        const remaining       = (profile.members || []).filter(uid => uid !== memberUid);
        const isStillShared   = remaining.length > 1;

        await updateDoc(doc(db, 'profiles', profileId), {
            members: arrayRemove(memberUid),
            isShared: isStillShared
        });
        showToast('멤버가 제거되었습니다.');
        await loadProfiles();
        await window.openShareModal(profileId, { stopPropagation: () => {} });
    } catch (e) {
        console.error(e);
        showToast('제거 실패', 'error');
    }
};
