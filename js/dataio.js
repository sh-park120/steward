import { db } from './firebase.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import {
    collection, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const COLUMNS = ['date', 'type', 'category', 'subCategory', 'amount', 'description', 'tags'];

// ── Shared helpers ──

function plannerTx() {
    const p = state.currentPlanner;
    if (!p) return [];
    return state.transactions
        .filter(t => t.plannerId === p.id || (!t.plannerId && p.isDefault))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function txToRow(t) {
    return {
        date:        t.date || '',
        type:        t.type || '',
        category:    t.category || '',
        subCategory: t.subCategory || '',
        amount:      t.amount || 0,
        description: t.description || '',
        tags:        (t.tags || []).join('|')
    };
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportFilename(ext) {
    const name = state.currentPlanner?.name || 'ledger';
    return `가계부_${name}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// ── CSV ──

function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
    const lines = [COLUMNS.join(',')];
    rows.forEach(r => lines.push(COLUMNS.map(c => csvEscape(r[c])).join(',')));
    // BOM so Excel opens Korean text correctly
    return '\uFEFF' + lines.join('\r\n');
}

function parseCsv(text) {
    text = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field); field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            rows.push(row); row = [];
        } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (rows.length < 2) return [];
    const header = rows[0].map(h => h.trim());
    return rows.slice(1)
        .filter(r => r.some(v => v !== ''))
        .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// ── XLSX (SheetJS, loaded on demand) ──

let _xlsx = null;
async function loadXlsx() {
    if (!_xlsx) _xlsx = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    return _xlsx;
}

// ── Export selection ──

// Snapshot of the planner's logs while the modal is open; `selected` marks
// which of them will be included in the export
let exportList = [];
let selected   = new Set();

function updateExportCount() {
    const el = document.getElementById('export-count');
    if (el) el.textContent = `${selected.size} / ${exportList.length}건 선택됨`;
}

function renderExportList() {
    const el = document.getElementById('export-tx-list');
    if (!el) return;
    el.innerHTML = exportList.length
        ? exportList.map((t, i) => `
            <label class="export-tx-row">
                <input type="checkbox" ${selected.has(i) ? 'checked' : ''} onchange="toggleExportTx(${i}, this.checked)">
                <span class="export-tx-date">${(t.date || '').slice(5)}</span>
                <span class="export-tx-cat">${t.category || ''}</span>
                <span class="export-tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${(t.amount || 0).toLocaleString()}</span>
                <span class="export-tx-desc">${t.description || ''}</span>
            </label>`).join('')
        : '<div class="tag-manage-empty">기록이 없습니다</div>';
    updateExportCount();
}

window.toggleExportTx = (index, checked) => {
    if (checked) selected.add(index);
    else selected.delete(index);
    updateExportCount();
};

window.exportSelectAll = () => {
    selected = new Set(exportList.map((_, i) => i));
    renderExportList();
};

window.exportDeselectAll = () => {
    selected = new Set();
    renderExportList();
};

window.exportSelectPeriod = () => {
    const from = document.getElementById('export-date-from').value;
    const to   = document.getElementById('export-date-to').value;
    if (!from && !to) { showToast('기간을 선택해주세요', 'warn'); return; }
    selected = new Set(exportList
        .map((t, i) => [t, i])
        .filter(([t]) => (!from || t.date >= from) && (!to || t.date <= to))
        .map(([, i]) => i));
    renderExportList();
};

window.openDataModal = () => {
    exportList = plannerTx();
    selected   = new Set(exportList.map((_, i) => i)); // everything included by default

    const dates = exportList.map(t => t.date).filter(Boolean);
    document.getElementById('export-date-from').value = dates[0] || '';
    document.getElementById('export-date-to').value   = dates[dates.length - 1] || '';

    renderExportList();
    document.getElementById('data-modal').classList.add('open');
};

// ── Export ──

window.exportLedger = async (format) => {
    const rows = exportList.filter((_, i) => selected.has(i)).map(txToRow);
    if (!rows.length) { showToast('내보낼 기록을 선택해주세요', 'warn'); return; }

    try {
        if (format === 'csv') {
            downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }),
                exportFilename('csv'));
        } else if (format === 'xlsx') {
            const XLSX = await loadXlsx();
            const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '가계부');
            XLSX.writeFile(wb, exportFilename('xlsx'));
        }
        showToast(`${rows.length}건을 내보냈습니다!`);
    } catch (e) {
        console.error(e);
        showToast('내보내기 실패', 'error');
    }
};

// ── Import sample files ──

const SAMPLE_ROWS = [
    { date: '2026-07-01', type: 'expense', category: '식비',   subCategory: '외식', amount: 15000,   description: '점심 식사', tags: '회사|점심' },
    { date: '2026-07-02', type: 'expense', category: '교통',   subCategory: '',     amount: 1550,    description: '지하철',    tags: '통근' },
    { date: '2026-07-03', type: 'expense', category: '쇼핑',   subCategory: '',     amount: 32000,   description: '',          tags: '' },
    { date: '2026-07-05', type: 'income',  category: '월급',   subCategory: '',     amount: 3000000, description: '7월 급여',  tags: '' }
];

window.downloadImportSample = async (format) => {
    try {
        if (format === 'csv') {
            downloadBlob(new Blob([toCsv(SAMPLE_ROWS)], { type: 'text/csv;charset=utf-8' }),
                '가계부_가져오기_샘플.csv');
        } else {
            const XLSX = await loadXlsx();
            const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: COLUMNS });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '가계부');
            XLSX.writeFile(wb, '가계부_가져오기_샘플.xlsx');
        }
    } catch (e) {
        console.error(e);
        showToast('샘플 다운로드 실패', 'error');
    }
};

// ── Import ──

const TYPE_MAP = { income: 'income', '수입': 'income', expense: 'expense', '지출': 'expense' };
const KEY_MAP  = {
    date: 'date', '날짜': 'date',
    type: 'type', '유형': 'type', '구분': 'type',
    category: 'category', '카테고리': 'category',
    subcategory: 'subCategory', '세부항목': 'subCategory',
    amount: 'amount', '금액': 'amount',
    description: 'description', '메모': 'description', '내용': 'description',
    tags: 'tags', '태그': 'tags'
};

function normalizeRow(raw) {
    const r = {};
    Object.entries(raw).forEach(([k, v]) => {
        const key = KEY_MAP[String(k).trim().toLowerCase().replace(/[\s_]/g, '')];
        if (key) r[key] = v;
    });

    let date = r.date;
    if (date instanceof Date) {
        date = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 10);
    } else {
        date = String(date ?? '').trim().slice(0, 10).replace(/[./]/g, '-');
    }
    const type   = TYPE_MAP[String(r.type ?? '').trim().toLowerCase()];
    const amount = Math.round(Number(String(r.amount ?? '').replace(/,/g, '')));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !type || !amount || amount <= 0) return null;
    if (!String(r.category ?? '').trim()) return null;

    const tags = String(r.tags ?? '').split(/[|;]/).map(t => t.trim()).filter(Boolean);
    const tx = {
        date, type, amount,
        category:    String(r.category).trim(),
        description: String(r.description ?? '').trim(),
        tags
    };
    const subCat = String(r.subCategory ?? '').trim();
    if (type === 'expense' && subCat) tx.subCategory = subCat;
    return tx;
}

window.importLedgerFile = async (input) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!state.currentProfile || !state.currentPlanner) {
        showToast('플래너를 먼저 선택해주세요', 'warn');
        return;
    }

    try {
        const ext = file.name.split('.').pop().toLowerCase();
        let raws;
        if (ext === 'csv') {
            raws = parseCsv(await file.text());
        } else if (ext === 'xlsx') {
            const XLSX = await loadXlsx();
            const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
            raws = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        } else {
            showToast('지원하지 않는 파일 형식입니다 (.csv / .xlsx)', 'warn');
            return;
        }

        let txs = raws.map(normalizeRow).filter(Boolean);
        const invalid = raws.length - txs.length;

        // Duplicate check against logs already in this planner (and within the file)
        let dups = 0;
        if (document.getElementById('import-skip-dup')?.checked) {
            const txKey = t => [t.date, t.type, t.amount, t.category,
                t.subCategory || '', t.description].join('|');
            const seen = new Set(plannerTx().map(txKey));
            txs = txs.filter(t => {
                const key = txKey(t);
                if (seen.has(key)) { dups++; return false; }
                seen.add(key);
                return true;
            });
        }

        if (!txs.length) {
            showToast(dups ? '모두 이미 존재하는 기록입니다' : '가져올 수 있는 기록이 없습니다', 'warn');
            return;
        }

        const notes = [];
        if (dups)    notes.push(`이미 존재하는 ${dups}건 제외`);
        if (invalid) notes.push(`형식이 맞지 않는 ${invalid}건 제외`);
        const planner = state.currentPlanner;
        if (!confirm(`${txs.length}건의 기록을 '${planner.name}' 플래너로 가져오시겠습니까?`
            + (notes.length ? `\n(${notes.join(', ')})` : ''))) return;

        // Firestore caps a batch at 500 writes
        for (let i = 0; i < txs.length; i += 500) {
            const batch = writeBatch(db);
            txs.slice(i, i + 500).forEach(tx => {
                batch.set(doc(collection(db, 'transactions')), {
                    ...tx,
                    profileId: state.currentProfile.id,
                    plannerId: planner.id,
                    createdAt: serverTimestamp()
                });
            });
            await batch.commit();
        }

        if (window.closeModal) window.closeModal('data-modal');
        const excluded = dups + invalid;
        showToast(`${txs.length}건 가져오기 완료!${excluded ? ` (${excluded}건 제외)` : ''}`);
    } catch (e) {
        console.error(e);
        showToast('가져오기 실패 (파일 형식을 확인해주세요)', 'error');
    }
};
