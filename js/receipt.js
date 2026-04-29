import { showToast } from './utils.js';

const EXPENSE_CATS = ['식비','플로잉','교통','쇼핑','의료','문화','통신','주거','교육','저축','기타지출'];
const INCOME_CATS  = ['월급','용돈','부수입','상여금','금융소득','기타수입'];

function getApiKey() {
    return localStorage.getItem('gemini_api_key');
}

function promptForApiKey() {
    const key = prompt(
        'Google Gemini API 키를 입력하세요.\n' +
        '(한 번만 입력하면 이 기기에 저장됩니다)\n\n' +
        'https://aistudio.google.com 에서 무료로 발급받을 수 있습니다.'
    );
    if (key && key.trim().length > 10) {
        localStorage.setItem('gemini_api_key', key.trim());
        return key.trim();
    }
    if (key !== null) {
        showToast('유효하지 않은 API 키입니다', 'error');
    }
    return null;
}

function setLoading(on) {
    document.getElementById('receipt-loading').style.display = on ? 'flex' : 'none';
    document.getElementById('receipt-upload-btn').disabled   = on;
}

function setReceiptError(msg) {
    const el = document.getElementById('receipt-error');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = msg ? 'block' : 'none';
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => {
            const dataUrl   = reader.result;
            const [header, base64] = dataUrl.split(',');
            const mediaType = header.match(/:(.*?);/)[1];
            resolve({ base64, mediaType });
        };
        reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'));
        reader.readAsDataURL(file);
    });
}

async function callGeminiVision(base64, mediaType, apiKey) {
    const PROMPT = `이 영수증/결제 화면 이미지를 분석해서 다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "type": "expense",
  "amount": 숫자(원 단위 정수),
  "category": "카테고리명",
  "memo": "가게명 또는 설명",
  "date": "YYYY-MM-DD"
}

규칙:
- type은 반드시 "income" 또는 "expense" 중 하나
- 대부분의 영수증은 "expense"
- category는 반드시 다음 목록 중 하나 (expense일 때): 식비, 플로잉, 교통, 쇼핑, 의료, 문화, 통신, 주거, 교육, 저축, 기타지출
- category는 반드시 다음 목록 중 하나 (income일 때): 월급, 용돈, 부수입, 상여금, 금융소득, 기타수입
- amount는 쉼표 없는 순수 숫자
- date는 YYYY-MM-DD 형식. 연도가 없으면 올해(${new Date().getFullYear()})로 가정
- 값을 알 수 없으면 null로 표시`;

    const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: mediaType, data: base64 } },
                        { text: PROMPT }
                    ]
                }],
                generationConfig: { maxOutputTokens: 256 }
            })
        }
    );

    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        if (resp.status === 400 || resp.status === 403) {
            localStorage.removeItem('gemini_api_key');
            const e = new Error('Invalid API key');
            e.userMessage = 'API 키가 올바르지 않습니다. 다시 시도하면 재입력 화면이 나옵니다.';
            throw e;
        }
        const e = new Error(`API ${resp.status}`);
        e.userMessage = `API 오류 (${resp.status}): ${body.error?.message || '알 수 없는 오류'}`;
        throw e;
    }

    const data = await resp.json();
    return data.candidates[0].content.parts[0].text;
}

function parseAIResponse(rawText) {
    const cleaned = rawText.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        const e = new Error('JSON parse failed');
        e.userMessage = '분석 결과를 읽을 수 없습니다. 다시 시도해주세요.';
        throw e;
    }

    const type     = (parsed.type === 'income') ? 'income' : 'expense';
    const validCats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
    const category  = validCats.includes(parsed.category) ? parsed.category : (type === 'income' ? '기타수입' : '기타지출');
    const amount    = parseInt(parsed.amount) || null;

    const today       = new Date().toISOString().slice(0, 10);
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const date        = (parsed.date && datePattern.test(parsed.date)) ? parsed.date : today;

    const memo = typeof parsed.memo === 'string' ? parsed.memo.slice(0, 100) : '';

    return { type, amount, category, memo, date };
}

function autofillForm({ type, amount, category, memo, date }) {
    if (window.setTxType) window.setTxType(type);

    const amountEl = document.getElementById('tx-amount');
    if (amountEl && amount) amountEl.value = amount.toLocaleString('ko-KR');

    const catEl = document.getElementById('tx-cat');
    if (catEl && category) {
        catEl.value = category;
        if (window.updateSubCategoryOptions) window.updateSubCategoryOptions();
    }

    const descEl = document.getElementById('tx-desc');
    if (descEl) descEl.value = memo;

    const dateEl = document.getElementById('tx-date');
    if (dateEl && date) dateEl.value = date;
}

export async function handleReceiptFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        showToast('JPG, PNG, WebP 이미지만 지원합니다', 'warn');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('이미지 크기는 5MB 이하여야 합니다', 'warn');
        return;
    }

    let apiKey = getApiKey();
    if (!apiKey) {
        apiKey = promptForApiKey();
        if (!apiKey) return;
    }

    const objectUrl = URL.createObjectURL(file);
    document.getElementById('receipt-preview-img').src = objectUrl;
    document.getElementById('receipt-preview-wrap').style.display = 'flex';
    setReceiptError('');

    setLoading(true);
    try {
        const { base64, mediaType } = await fileToBase64(file);
        const rawJson  = await callGeminiVision(base64, mediaType, apiKey);
        const parsed   = parseAIResponse(rawJson);
        autofillForm(parsed);
        showToast('영수증 분석 완료! 내용을 확인해주세요 ✓');
    } catch (err) {
        console.error('[receipt] API error:', err);
        setReceiptError(err.userMessage || '분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
        setLoading(false);
        URL.revokeObjectURL(objectUrl);
        event.target.value = '';
    }
}

export function clearReceiptPreview() {
    document.getElementById('receipt-file-input').value = '';
    document.getElementById('receipt-preview-img').src  = '';
    document.getElementById('receipt-preview-wrap').style.display = 'none';
    setReceiptError('');
}

window.handleReceiptFile  = handleReceiptFile;
window.clearReceiptPreview = clearReceiptPreview;
