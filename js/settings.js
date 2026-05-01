const LS_THEME = 'steward_theme';
const LS_BG    = 'steward_bg';
const LS_MODE  = 'steward_mode';

const THEMES = [
    { id: 'purple', name: '보라 (기본)',  bg: '#0f0f13', accent: '#7c6af7', accent2: '#a78bfa' },
    { id: 'red',    name: '빨간 장미',    bg: '#130a0a', accent: '#e05252', accent2: '#f87171' },
    { id: 'blue',   name: '바다 블루',    bg: '#090f1a', accent: '#3b82f6', accent2: '#60a5fa' },
    { id: 'green',  name: '숲 초록',      bg: '#091210', accent: '#10b981', accent2: '#34d399' },
    { id: 'gold',   name: '따뜻한 금',    bg: '#120f04', accent: '#d97706', accent2: '#fbbf24' },
    { id: 'pink',   name: '핑크 블러시',  bg: '#130a10', accent: '#db2777', accent2: '#f472b6' },
];

const BACKGROUNDS = [
    { id: 'plain',    name: '기본',       className: '',            previewClass: '' },
    { id: 'grid',     name: '그리드',     className: 'bg-grid',     previewClass: 'preview-grid' },
    { id: 'gradient', name: '그라데이션', className: 'bg-gradient', previewClass: 'preview-gradient' },
    { id: 'dots',     name: '도트',       className: 'bg-dots',     previewClass: 'preview-dots' },
];

function getCurrentThemeId() { return localStorage.getItem(LS_THEME) || 'purple'; }
function getCurrentBgId()    { return localStorage.getItem(LS_BG)    || 'plain'; }
function getCurrentModeId()  { return localStorage.getItem(LS_MODE)  || 'dark'; }
function isModalOpen()       { return document.getElementById('settings-modal')?.classList.contains('open'); }

function applyMode(modeId) {
    document.body.classList.toggle('light-mode', modeId === 'light');
    localStorage.setItem(LS_MODE, modeId);
    if (isModalOpen()) renderSettingsModal();
}

function applyTheme(themeId) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    if (theme.id === 'purple') delete document.body.dataset.theme;
    else document.body.dataset.theme = theme.id;
    localStorage.setItem(LS_THEME, theme.id);
    if (isModalOpen()) renderSettingsModal();
}

function applyBackground(bgId) {
    const allClasses = BACKGROUNDS.map(b => b.className).filter(Boolean);
    document.body.classList.remove(...allClasses);
    const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
    if (bg.className) document.body.classList.add(bg.className);
    localStorage.setItem(LS_BG, bg.id);
    if (isModalOpen()) renderSettingsModal();
}

function renderSettingsModal() {
    const themeId = getCurrentThemeId();
    const bgId    = getCurrentBgId();
    const modeId  = getCurrentModeId();

    document.getElementById('mode-toggle').innerHTML = `
        <div class="mode-toggle-row">
            <button class="mode-btn ${modeId === 'dark'  ? 'active' : ''}" onclick="applyMode('dark')">🌙 다크</button>
            <button class="mode-btn ${modeId === 'light' ? 'active' : ''}" onclick="applyMode('light')">☀️ 라이트</button>
        </div>`;

    document.getElementById('theme-swatches').innerHTML = THEMES.map(t => `
        <div class="theme-swatch ${themeId === t.id ? 'active' : ''}" onclick="applyTheme('${t.id}')">
            <div class="theme-swatch-circle"
                 style="background: conic-gradient(from 180deg, ${t.bg} 180deg, ${t.accent} 180deg)">
            </div>
            <span class="theme-swatch-name">${t.name}</span>
        </div>`).join('');

    document.getElementById('bg-options').innerHTML = BACKGROUNDS.map(b => `
        <div class="bg-option ${bgId === b.id ? 'active' : ''}" onclick="applyBackground('${b.id}')">
            <div class="bg-option-preview ${b.previewClass}"></div>
            <span class="bg-option-name">${b.name}</span>
        </div>`).join('');
}

export function loadSettings() {
    applyMode(getCurrentModeId());
    applyTheme(getCurrentThemeId());
    applyBackground(getCurrentBgId());
}

window.openSettingsModal = () => {
    renderSettingsModal();
    document.getElementById('settings-modal').classList.add('open');
};
window.applyMode       = applyMode;
window.applyTheme      = applyTheme;
window.applyBackground = applyBackground;
