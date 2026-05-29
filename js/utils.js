export const fmt = (n) => Math.abs(n).toLocaleString('ko-KR');

export const fmtInput = (v) => {
    const n = parseInt(v.replace(/,/g, '')) || '';
    return n ? n.toLocaleString('ko-KR') : '';
};

export function parseAmount(el) {
    return parseInt(el.value.replace(/,/g, '')) || 0;
}

export function showToast(msg, type = 'ok') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 2500);
}

export function todayYM() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ymToDisplay(ym) {
    const [y, m] = ym.split('-');
    return `${y}년 ${parseInt(m)}월`;
}

// Expose to HTML inline event handlers
window.fmt      = fmt;
window.fmtInput = fmtInput;
window.showToast = showToast;
