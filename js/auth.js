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

// 전역 상태 관리 객체 (다른 파일에서 import하여 사용)
export const state = {
    currentUser: null,
    currentProfile: null,
    allProfiles: [],
    transactions: [],
    budgets: {},
    currentMonth: new Date().toISOString().slice(0, 7)
};

// --- AUTH FUNCTIONS ---
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
        // 유저 아바타 업데이트 (선택 사항)
        const avatarEl = document.getElementById('user-avatar-small');
        if (avatarEl) {
            avatarEl.textContent = user.displayName ? user.displayName[0] : '👤';
            if (user.photoURL) avatarEl.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        showScreen('profile');
        loadProfiles();
    } else {
        showScreen('login');
    }
});

// --- PROFILE FUNCTIONS ---
export async function loadProfiles() {
    try {
        const q = query(
            collection(db, 'profiles'), 
            where('uid', '==', state.currentUser.uid), 
            orderBy('createdAt', 'asc')
        );
        const snap = await getDocs(q);
        state.allProfiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // ledger.js에 있는 renderProfiles가 아니라 auth.js 내부 정의 혹은 import 필요
        renderProfiles(); 
    } catch (error) {
        console.error("프로필 로드 에러:", error);
        // 복합 인덱스 에러 발생 시 콘솔 링크 확인 필요
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
    const emoji = emojiInput.value || '👤';

    if (!name) return alert('이름을 입력해주세요');

    await addDoc(collection(db, 'profiles'), {
        uid: state.currentUser.uid,
        name,
        emoji,
        createdAt: serverTimestamp()
    });

    nameInput.value = '';
    emojiInput.value = '';
    loadProfiles();
};

window.selectProfile = (id) => {
    state.currentProfile = state.allProfiles.find(p => p.id === id);
    if (!state.currentProfile) return;

    // UI 업데이트
    document.getElementById('current-profile-name').textContent = state.currentProfile.name;
    document.getElementById('current-profile-emoji').textContent = state.currentProfile.emoji;
    
    // app.js에 정의된 데이터 구독 함수 호출
    if (window.initAppData) {
        window.initAppData();
    } else {
        console.error("initAppData 함수를 찾을 수 없습니다. app.js가 로드되었는지 확인하세요.");
    }
};

window.deleteProfile = async (id, e) => {
    e.stopPropagation();
    if (!confirm('프로필과 관련된 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
    
    await deleteDoc(doc(db, 'profiles', id));
    loadProfiles();
};

// UI 헬퍼
export function showScreen(name) {
    const screens = ['login', 'profile', 'app'];
    screens.forEach(s => {
        const el = document.getElementById(`screen-${s}`);
        if (el) el.style.display = (s === name) ? '' : 'none';
    });
}