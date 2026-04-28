import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import { showScreen } from './ui.js';
import {
    collection, doc, addDoc, getDocs, deleteDoc, query, where, serverTimestamp
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

export async function loadProfiles() {
    try {
        const q = query(
            collection(db, 'profiles'),
            where('uid', '==', state.currentUser.uid)
        );
        const snap = await getDocs(q);
        state.allProfiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

    list.innerHTML = state.allProfiles.map(p => `
        <div class="profile-card" onclick="selectProfile('${p.id}')">
            <div class="profile-avatar">${p.emoji || '👤'}</div>
            <div class="profile-info">
                <div class="profile-pname">${p.name}</div>
                <div class="profile-hint">탭해서 입장 →</div>
            </div>
            <button class="profile-delete" onclick="deleteProfile('${p.id}', event)">✕</button>
        </div>`).join('');
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
            name, emoji,
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

window.backToProfiles = () => {
    showScreen('profile');
    loadProfiles();
};
