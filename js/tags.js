import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import {
    collection, doc, getDocs, updateDoc, writeBatch,
    query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// The managed list lives on the profile doc; legacy tags still present on
// loaded transactions are merged in so they stay selectable and manageable.
export function getAllTags() {
    const managed = state.currentProfile?.tags || [];
    const inUse   = state.transactions.flatMap(t => t.tags || []);
    return [...new Set([...managed, ...inUse])].sort();
}

async function saveProfileTags(tags) {
    await updateDoc(doc(db, 'profiles', state.currentProfile.id), { tags });
    state.currentProfile.tags = tags;
}

// Rename (or strip, when newName is null) a tag on every transaction of this
// profile — queried directly so it covers all planners, not just the loaded one
async function propagateTagChange(oldName, newName) {
    const snap = await getDocs(query(
        collection(db, 'transactions'),
        where('profileId', '==', state.currentProfile.id),
        where('tags', 'array-contains', oldName)
    ));
    // Firestore caps a batch at 500 writes
    for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach(d => {
            const tags = (d.data().tags || []).filter(t => t !== oldName);
            if (newName && !tags.includes(newName)) tags.push(newName);
            batch.update(d.ref, { tags });
        });
        await batch.commit();
    }
}

// Snapshot of the list as last rendered, so index-based handlers stay in sync
let manageList = [];

function renderTagManageList() {
    const el = document.getElementById('tag-manage-list');
    if (!el) return;
    manageList = getAllTags();
    el.innerHTML = manageList.length
        ? manageList.map((tag, i) => `
            <div class="tag-manage-row">
                <span class="tag-manage-name">${tag}</span>
                <button class="tag-manage-btn" onclick="renameTag(${i})" title="이름 변경">✏️</button>
                <button class="tag-manage-btn" onclick="deleteTag(${i})" title="삭제">✕</button>
            </div>`).join('')
        : '<div class="tag-manage-empty">아직 태그가 없습니다</div>';
}

window.openTagManageModal = () => {
    renderTagManageList();
    document.getElementById('new-tag-input').value = '';
    document.getElementById('tag-manage-modal').classList.add('open');
};

window.createTag = async () => {
    const input = document.getElementById('new-tag-input');
    const name  = input.value.trim();
    if (!name) { showToast('태그 이름을 입력해주세요', 'warn'); return; }
    if (getAllTags().includes(name)) { showToast('이미 있는 태그입니다', 'warn'); return; }

    try {
        await saveProfileTags([...(state.currentProfile.tags || []), name]);
        input.value = '';
        renderTagManageList();
        if (window.renderModalTagSelect) window.renderModalTagSelect();
        showToast(`'${name}' 태그가 추가되었습니다!`);
    } catch (e) {
        console.error(e);
        showToast('태그 추가 실패', 'error');
    }
};

window.renameTag = async (index) => {
    const oldName = manageList[index];
    if (!oldName) return;
    const newName = prompt(`'${oldName}' 태그의 새 이름을 입력하세요`, oldName)?.trim();
    if (!newName || newName === oldName) return;
    if (getAllTags().includes(newName)) { showToast('이미 있는 태그입니다', 'warn'); return; }

    try {
        // filter+push migrates legacy (transaction-only) tags into the managed list
        const managed = (state.currentProfile.tags || []).filter(t => t !== oldName);
        await saveProfileTags([...managed, newName]);
        await propagateTagChange(oldName, newName);

        if (window.replaceModalTag) window.replaceModalTag(oldName, newName);
        renderTagManageList();
        if (window.renderModalTagSelect) window.renderModalTagSelect();
        showToast(`'${newName}'(으)로 변경되었습니다!`);
    } catch (e) {
        console.error(e);
        showToast('이름 변경 실패', 'error');
    }
};

window.deleteTag = async (index) => {
    const name = manageList[index];
    if (!name) return;
    if (!confirm(`'${name}' 태그를 삭제하시겠습니까?\n(모든 기록에서 이 태그가 제거됩니다)`)) return;

    try {
        await saveProfileTags((state.currentProfile.tags || []).filter(t => t !== name));
        await propagateTagChange(name, null);

        if (window.replaceModalTag) window.replaceModalTag(name, null);
        renderTagManageList();
        if (window.renderModalTagSelect) window.renderModalTagSelect();
        showToast('태그가 삭제되었습니다.', 'warn');
    } catch (e) {
        console.error(e);
        showToast('태그 삭제 실패', 'error');
    }
};
