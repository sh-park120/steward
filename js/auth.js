import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase 설정
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

// 전역 상태 관리 객체
export const state = {
    currentUser: null,
    currentProfile: null,
    allProfiles: [],
    transactions: [],
    budgets: {},
    currentMonth: new Date().toISOString().slice(0, 7)
};

// ─────────────────────────────
// 이모지 피커 설정 (최종 동기화 리스트)
// ─────────────────────────────
const EMOJI_LIST = [
    '😊', '😄', '😁', '🙂', '😉', '😎', '🤗', '😇', '😌', // 😀 기본 표정
    '🥰', '😍', '😺', '🐶', '🐱', '🐻', '🐼', '🦊', '🐰', '🧸', // 💕 귀여움
    '✨', '🌙', '⭐', '🌟', '💫', '🌈', '☁️', '🌸', '🌼', '🍀', // ✨ 감성
    '🔥', '💪', '🚀', '🌱', '🌿', '🏆', '🎯', '💡', '⚡', '📈', // 🔥 에너지
    '🎮', '🎧', '🎨', '🎬', '🎤', '🎸', '📚', '✏️', '🖌️', '📷', // 🎨 취미
    '☕', '🍵', '🍜', '🍣', '🍰', '🍪', '🛋️', '🕯️', '🧺', '🛍️', // ☕ 일상
    '🏖️', '🌊', '🏝️', '🌲', '🌳', '🏔️', '🌅', '🌄', '🚗', '✈️', // 🌍 여행
    '💬', '📌', '🧭', '📝', '📷', '🔖', '📎', '📦', '🔑', '🪪'  // 🧭 아이콘
];

export function initEmojiPicker() {
    const grid = document.getElementById('emoji-grid');
    if (!grid) return;

    // 리스트 불일치 방지를 위해 항상 비우고 새로 그림
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
    const input = document.getElementById('profile-emoji');
    const picker = document.getElementById('emoji-picker');
    
    if (display) display.textContent = emoji;
    if (input) input.value = emoji;
    if (picker) picker.style.display = 'none';
};

// ─────────────────────────────
// AUTH FUNCTIONS
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
        // 유저 아바타 업데이트
        const avatarEl = document.getElementById('user-avatar-small');
        if (avatarEl) {
            avatarEl.textContent = user.displayName ? user.displayName[0] : '👤';
            if (user.photoURL) avatarEl.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        
        showScreen('profile');
        loadProfiles();
        
        // 프로필 화면 진입 시 이모지 피커 확실히 초기화
        setTimeout(initEmojiPicker, 100);
    } else {
        showScreen('login');
    }
});

// ─────────────────────────────
// PROFILE FUNCTIONS
// ─────────────────────────────

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
    const emojiInput = document.getElementById('profile-emoji');
    const name = nameInput.value.trim();
    const emoji = emojiInput.value || '😊';

    if (!name) return alert('이름을 입력해주세요');

    try {
        await addDoc(collection(db, 'profiles'), {
            uid: state.currentUser.uid,
            name,
            emoji,
            createdAt: serverTimestamp()
        });

        nameInput.value = '';
        document.getElementById('profile-emoji-display').textContent = '😊';
        document.getElementById('profile-emoji').value = '😊';
        
        if (window.showToast) window.showToast('새 프로필이 생성되었습니다!');
        loadProfiles();
    } catch (e) {
        console.error(e);
        alert('프로필 생성 실패');
    }
};

window.selectProfile = (id) => {
    state.currentProfile = state.allProfiles.find(p => p.id === id);
    if (!state.currentProfile) return;

    // 요소가 없어도 에러가 나지 않도록 안전하게 클래스 이름으로도 찾도록 보완합니다.
    const nameEl = document.getElementById('current-profile-name') || document.querySelector('.topbar-name');
    const emojiEl = document.getElementById('current-profile-emoji') || document.querySelector('.topbar-emoji');
    
    if (nameEl) nameEl.textContent = state.currentProfile.name;
    if (emojiEl) emojiEl.textContent = state.currentProfile.emoji;
    
    // app.js의 데이터 구독 시작
    if (typeof window.initAppData === 'function') {
        window.initAppData();
    } else {
        console.error("initAppData 함수가 없습니다. app.js가 정상적으로 로드되었는지 확인하세요.");
    }
};

window.deleteProfile = async (id, e) => {
    e.stopPropagation();
    if (!confirm('프로필과 관련된 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
    
    try {
        await deleteDoc(doc(db, 'profiles', id));
        if (window.showToast) window.showToast('프로필이 삭제되었습니다.', 'warn');
        loadProfiles();
    } catch (e) {
        console.error(e);
    }
};

// ─────────────────────────────
// UI HELPERS
// ─────────────────────────────

export function showScreen(name) {
    const screens = ['login', 'profile', 'app'];
    screens.forEach(s => {
        const el = document.getElementById(`screen-${s}`);
        if (el) el.style.display = (s === name) ? '' : 'none';
    });
}

window.backToProfiles = () => {
    // 실시간 구독 해제 로직이 app.js에 있다면 호출 필요
    showScreen('profile');
    loadProfiles();
};

// 화면 바깥 클릭 시 이모지 피커 닫기
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-picker');
    const display = document.getElementById('profile-emoji-display');
    if (picker && picker.style.display === 'block' && !picker.contains(e.target) && e.target !== display) {
        picker.style.display = 'none';
    }
});