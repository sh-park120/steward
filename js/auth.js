import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase 설정 (기존과 동일)
const firebaseConfig = {
    apiKey: "AIzaSyAjK3PQBuu6J888-PSLpq-SW6zvZUux6dM",
    authDomain: "steward-260124.firebaseapp.com",
    projectId: "steward-260124",
    storageBucket: "steward-260124.firebasestorage.app",
    messagingSenderId: "636184848666",
    appId: "1:636184848666:web:71201464b737e6bb7c64a3",
    measurementId: "G-FZR7FGQQ7C"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const state = {
    currentUser: null,
    currentProfile: null,
    allProfiles: [],
    transactions: [],
    budgets: {},
    currentMonth: new Date().toISOString().slice(0, 7)
};

// ─────────────────────────────
// 이모지 피커 설정 (추가된 부분)
// ─────────────────────────────
const EMOJI_LIST = [
    // 😀 기본 표정 (호감형)
    '😊', '😄', '😁', '🙂', '😉', '😎', '🤗', '😇', '😌',

    // 💕 귀여움 / 친근함
    '🥰', '😍', '😺', '🐶', '🐱', '🐻', '🐼', '🦊', '🐰', '🧸',

    // ✨ 감성 / 분위기
    '✨', '🌙', '⭐', '🌟', '💫', '🌈', '☁️', '🌸', '🌼', '🍀',

    // 🔥 긍정 / 성장 / 에너지
    '🔥', '💪', '🚀', '🌱', '🌿', '🏆', '🎯', '💡', '⚡', '📈',

    // 🎨 취미 / 개성
    '🎮', '🎧', '🎨', '🎬', '🎤', '🎸', '📚', '✏️', '🖌️', '📷',

    // ☕ 일상 / 라이프스타일
    '☕', '🍵', '🍜', '🍣', '🍰', '🍪', '🛋️', '🕯️', '🧺', '🛍️',

    // 🌍 여행 / 자연
    '🏖️', '🌊', '🏝️', '🌲', '🌳', '🏔️', '🌅', '🌄', '🚗', '✈️',

    // 🧭 심플 아이콘 (깔끔한 프로필용)
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
    picker.style.display = (picker.style.display === 'none') ? 'block' : 'none';
};

window.selectEmoji = (emoji) => {
    document.getElementById('profile-emoji-display').textContent = emoji;
    document.getElementById('profile-emoji').value = emoji;
    document.getElementById('emoji-picker').style.display = 'none';
};

// ─────────────────────────────
// AUTH & PROFILE FUNCTIONS
// ─────────────────────────────

window.signInGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch(e) { 
        console.error(e);
        if (window.showToast) window.showToast('로그인 실패: ' + e.message, 'error'); 
    }
};

window.signOutUser = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
        await signOut(auth);
        location.reload(); 
    }
};

onAuthStateChanged(auth, user => {
    state.currentUser = user;
    if (user) {
        showScreen('profile');
        loadProfiles();
        // 로그인 성공 후 프로필 화면으로 올 때 이모지 피커 초기화
        initEmojiPicker();
    } else {
        showScreen('login');
    }
});

export async function loadProfiles() {
    try {
        const q = query(
            collection(db, 'profiles'), 
            where('uid', '==', state.currentUser.uid), 
            orderBy('createdAt', 'asc')
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
    const nameInput = document.getElementById('profile-name');
    const emojiInput = document.getElementById('profile-emoji'); // hidden input
    const name = nameInput.value.trim();
    const emoji = emojiInput.value || '😊';

    if (!name) return alert('이름을 입력해주세요');

    await addDoc(collection(db, 'profiles'), {
        uid: state.currentUser.uid,
        name,
        emoji,
        createdAt: serverTimestamp()
    });

    // 초기화
    nameInput.value = '';
    document.getElementById('profile-emoji-display').textContent = '😊';
    document.getElementById('profile-emoji').value = '😊';
    loadProfiles();
};

window.selectProfile = (id) => {
    state.currentProfile = state.allProfiles.find(p => p.id === id);
    if (!state.currentProfile) return;

    document.getElementById('current-profile-name').textContent = state.currentProfile.name;
    document.getElementById('current-profile-emoji').textContent = state.currentProfile.emoji;
    
    if (window.initAppData) {
        window.initAppData();
    }
};

window.deleteProfile = async (id, e) => {
    e.stopPropagation();
    if (!confirm('프로필과 관련된 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
    
    await deleteDoc(doc(db, 'profiles', id));
    loadProfiles();
};

export function showScreen(name) {
    const screens = ['login', 'profile', 'app'];
    screens.forEach(s => {
        const el = document.getElementById(`screen-${s}`);
        if (el) el.style.display = (s === name) ? '' : 'none';
    });
}

// 화면 바깥 클릭 시 이모지 피커 닫기
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-picker');
    const display = document.getElementById('profile-emoji-display');
    if (picker && picker.style.display === 'block' && !picker.contains(e.target) && e.target !== display) {
        picker.style.display = 'none';
    }
});