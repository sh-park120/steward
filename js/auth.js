import { auth } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import { showScreen } from './ui.js';
import { loadProfiles, initEmojiPicker } from './profile.js';
import {
    GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

window.signInGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (e) {
        console.error(e);
        showToast('로그인 실패: ' + e.message, 'error');
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
        const avatarEl = document.getElementById('user-avatar-small');
        if (avatarEl) {
            avatarEl.textContent = user.displayName ? user.displayName[0] : '👤';
            if (user.photoURL) {
                avatarEl.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;">`;
            }
        }
        showScreen('profile');
        loadProfiles();
        setTimeout(initEmojiPicker, 100);
    } else {
        showScreen('login');
    }
});
