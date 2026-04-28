export const fmt = (n) => Math.abs(n).toLocaleString('ko-KR');

export const fmtInput = (v) => {
    const n = parseInt(v.replace(/,/g, '')) || '';
    return n ? n.toLocaleString('ko-KR') : '';
};

export function showToast(msg, type = 'ok') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 2500);
}

// Expose to HTML inline event handlers
window.fmt = fmt;
window.fmtInput = fmtInput;
window.showToast = showToast;
