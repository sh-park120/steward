import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import {
    doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function loadMyUser() {
    const snap = await getDoc(doc(db, 'users', state.currentUser.uid));
    if (snap.exists()) {
        state.myUser = snap.data();
        return state.myUser;
    }
    return null;
}

export async function isUsernameAvailable(username) {
    const snap = await getDoc(doc(db, 'usernames', username));
    return !snap.exists();
}

export async function setupUsername(username) {
    const uid = state.currentUser.uid;
    if (!(await isUsernameAvailable(username))) {
        return { success: false, error: '이미 사용 중인 ID입니다.' };
    }
    try {
        // Write the unique index first, then the user document
        await setDoc(doc(db, 'usernames', username), { uid });
        const userData = {
            uid,
            username,
            displayName: state.currentUser.displayName || '',
            photoURL: state.currentUser.photoURL || '',
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', uid), userData);
        state.myUser = userData;
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: '오류가 발생했습니다.' };
    }
}

export async function findUserByUsername(username) {
    const idxSnap = await getDoc(doc(db, 'usernames', username));
    if (!idxSnap.exists()) return null;
    const userSnap = await getDoc(doc(db, 'users', idxSnap.data().uid));
    return userSnap.exists() ? userSnap.data() : null;
}

export function updateMyIdDisplay() {
    const bar = document.getElementById('my-id-bar');
    const val = document.getElementById('my-id-value');
    if (state.myUser) {
        if (bar) bar.style.display = 'flex';
        if (val) val.textContent = '@' + state.myUser.username;
    }
}

export function openUsernameModal() {
    document.getElementById('username-modal').classList.add('open');
}

// ── Window-exposed handlers ──

let _checkTimer = null;

window.checkUsernameAvailability = () => {
    const input = document.getElementById('username-input');
    const msg   = document.getElementById('username-check-msg');

    // Sanitize to allowed chars
    input.value = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const val = input.value;

    if (_checkTimer) clearTimeout(_checkTimer);

    if (val.length === 0) { msg.textContent = ''; return; }
    if (val.length < 3)  {
        msg.textContent = '3자 이상 입력해주세요';
        msg.className = 'username-check-msg muted';
        return;
    }
    if (val.length > 20) {
        msg.textContent = '20자 이하로 입력해주세요';
        msg.className = 'username-check-msg error';
        return;
    }

    msg.textContent = '확인 중...';
    msg.className = 'username-check-msg muted';

    _checkTimer = setTimeout(async () => {
        const available = await isUsernameAvailable(val);
        msg.textContent = available ? '✓ 사용 가능한 ID입니다' : '✕ 이미 사용 중인 ID입니다';
        msg.className = 'username-check-msg ' + (available ? 'ok' : 'error');
    }, 500);
};

window.submitUsername = async () => {
    const input    = document.getElementById('username-input');
    const msg      = document.getElementById('username-check-msg');
    const username = input.value.trim();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        msg.textContent = '영문 소문자, 숫자, _ 만 사용 가능 (3-20자)';
        msg.className = 'username-check-msg error';
        return;
    }

    const btn = document.querySelector('#username-modal .btn-submit');
    if (btn) btn.disabled = true;

    const result = await setupUsername(username);

    if (result.success) {
        document.getElementById('username-modal').classList.remove('open');
        updateMyIdDisplay();
        showToast('ID가 설정되었습니다!');
    } else {
        msg.textContent = result.error;
        msg.className = 'username-check-msg error';
        if (btn) btn.disabled = false;
    }
};

window.copyMyId = () => {
    if (!state.myUser) return;
    const id = '@' + state.myUser.username;
    navigator.clipboard.writeText(id)
        .then(() => showToast('ID가 복사되었습니다!'))
        .catch(() => showToast(id));
};
