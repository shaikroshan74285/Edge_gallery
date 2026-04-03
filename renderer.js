/**
 * RemiAI Edge Gallery - Renderer
 * Uses HTTP API like the working old app
 */

// State
let currentRamTab = '8gb';
let currentCategory = 'all';
let downloadedModels = [];
let currentModel = null;
let currentModelFilename = null;
let chatHistory = [];
let currentChatId = null;
let messages = [];
let settings = { ...DEFAULT_MODEL_SETTINGS, character: 'assistant', inputTokens: 1024, systemPrompt: '' };
let modelToDelete = null;
let isDarkMode = false;
let currentView = 'models';
let isGenerating = false;
let isEngineReady = false;
let abortController = null;
let selectedFilePath = null;
let currentUploadType = 'text';
let activeModelDownloadType = 'text';
let activeModelDownloadId = null;
let detachGlobalProgressListener = null;
let detachGlobalCompleteListener = null;
let detachGlobalCancelledListener = null;
let isChatSettingsOpen = false;
let chatSettingsHideTimer = null;
let autoApplyTimer = null;

// DOM
const chatArea = document.getElementById('chat-area');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressStats = document.getElementById('progress-stats');
const modelFilters = document.getElementById('model-filters');
const rightPanel = document.getElementById('right-panel');
let currentChatCategory = 'text';
let refreshSTTInferenceModels = () => { };
let refreshTTSInferenceModels = () => { };

function bytesToMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 1024 ? 1 : 2);
}

function estimateTokensFromText(text = '') {
    return Math.max(1, Math.ceil(String(text).length / 4));
}

function buildContextAwareMessages(systemContent, chatMessages, options = {}) {
    const normalizedSystemContent = String(systemContent || '').trim();
    const contextWindow = Math.max(512, options.contextSize || 2048);
    const outputReserve = Math.max(128, options.maxTokens || 1000);
    const speedMode = !!options.speedMode;
    const systemTokens = normalizedSystemContent ? estimateTokensFromText(normalizedSystemContent) : 0;
    const safetyReserve = speedMode ? 160 : 256;
    const rawBudget = Math.max(192, contextWindow - outputReserve - safetyReserve - systemTokens);
    const historyBudget = speedMode ? Math.max(128, Math.floor(rawBudget * 0.45)) : rawBudget;
    const packedMessages = [];
    let usedTokens = 0;
    const normalizedMessages = (Array.isArray(chatMessages) ? chatMessages : [])
        .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
        .map(message => ({
            role: message.role === 'user' ? 'user' : 'assistant',
            content: String(message.content || '').trim()
        }))
        .filter(message => message.content);

    for (let i = normalizedMessages.length - 1; i >= 0; i -= 1) {
        const normalized = normalizedMessages[i];
        const messageTokens = estimateTokensFromText(normalized.content) + 6;

        if (packedMessages.length > 0 && usedTokens + messageTokens > historyBudget) {
            break;
        }

        packedMessages.unshift(normalized);
        usedTokens += messageTokens;
    }

    const latestMessage = packedMessages[packedMessages.length - 1] || null;
    const requestMessages = [];

    if (normalizedSystemContent) {
        requestMessages.push({ role: 'system', content: normalizedSystemContent });
    }

    if (!latestMessage) {
        return requestMessages;
    }

    if (speedMode) {
        requestMessages.push(latestMessage);
        return requestMessages;
    }

    requestMessages.push(...packedMessages);
    return requestMessages;
}

function normalizeChatHistory(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];

    return rawHistory
        .filter(chat => chat && typeof chat === 'object')
        .map((chat, index) => {
            const safeMessages = Array.isArray(chat.messages)
                ? chat.messages
                    .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
                    .map(message => ({
                        role: message.role === 'user' ? 'user' : 'assistant',
                        content: String(message.content || ''),
                        thinking: typeof message.thinking === 'string' ? message.thinking : '',
                        thinkDuration: Number.isFinite(message.thinkDuration) ? message.thinkDuration : 0
                    }))
                    .filter(message => message.content.trim() || message.thinking.trim())
                : [];

            return {
                id: Number.isFinite(chat.id) ? chat.id : Date.now() + index,
                title: typeof chat.title === 'string' && chat.title.trim() ? chat.title : 'New Chat',
                model: typeof chat.model === 'string' ? chat.model : null,
                messages: safeMessages,
                updatedAt: Number.isFinite(chat.updatedAt) ? chat.updatedAt : Date.now()
            };
        });
}

function ensureChatWatermark() {
    if (!chatArea) return;
    let watermark = document.getElementById('chat-watermark');
    if (!watermark) {
        watermark = document.createElement('div');
        watermark.id = 'chat-watermark';
        watermark.className = 'chat-watermark';
        watermark.setAttribute('aria-hidden', 'true');
        chatArea.prepend(watermark);
    } else if (chatArea.firstChild !== watermark) {
        chatArea.prepend(watermark);
    }
}

function enhanceChatSettingsPanel() {
    if (!rightPanel) return;

    const chatContentText = document.getElementById('chat-content-text');
    const chatHeader = chatContentText?.querySelector('.tts-chat-header');
    const chatAreaEl = document.getElementById('chat-area');
    const settingsToggleBtn = document.getElementById('chat-settings-toggle');
    const statusWrap = document.getElementById('status-badge')?.parentElement;
    const controlsWrap = chatHeader?.querySelector('div');

    if (chatContentText && chatHeader && chatAreaEl && rightPanel.parentElement !== chatContentText) {
        chatContentText.insertBefore(rightPanel, chatAreaEl);
    }

    if (chatHeader) {
        chatHeader.style.alignItems = 'flex-start';
    }

    // The following block has been removed as the user requested the chat settings button to be beside the model select, which is the original HTML layout.

    if (settingsToggleBtn) {
        settingsToggleBtn.style.alignSelf = 'center';
        settingsToggleBtn.style.whiteSpace = 'nowrap';
    }

    if (statusWrap) {
        statusWrap.style.marginTop = '2px';
        statusWrap.style.alignSelf = 'flex-start';
    }

    rightPanel.style.position = 'relative';
    rightPanel.style.top = '0';
    rightPanel.style.right = '0';
    rightPanel.style.width = 'auto';
    rightPanel.style.maxHeight = '60vh';
    rightPanel.style.margin = '0 24px 14px 24px';
    rightPanel.style.border = '1px solid var(--border)';
    rightPanel.style.borderLeft = '1px solid var(--border)';
    rightPanel.style.borderRadius = '16px';
    rightPanel.style.boxShadow = '0 10px 28px rgba(15, 23, 42, 0.10)';
    rightPanel.style.opacity = '0';
    rightPanel.style.transform = 'translateY(-12px)';
    rightPanel.style.pointerEvents = 'none';
    rightPanel.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    rightPanel.style.flexShrink = '0';
    rightPanel.style.background = 'var(--bg-card)';
    rightPanel.style.overflowY = 'auto';
    rightPanel.style.overflowX = 'hidden';

    const sections = rightPanel.children;
    const header = sections[0];
    const settingsBody = sections[1];
    const footer = sections[2];

    if (header) {
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.gap = '16px';

        if (!document.getElementById('chat-settings-close')) {
            const closeBtn = document.createElement('button');
            closeBtn.id = 'chat-settings-close';
            closeBtn.type = 'button';
            closeBtn.className = 'secondary-btn';
            closeBtn.textContent = 'Close';
            closeBtn.style.padding = '7px 12px';
            closeBtn.style.fontSize = '12px';
            closeBtn.addEventListener('click', () => toggleChatSettingsPanel(false));
            header.appendChild(closeBtn);
        }
    }

    if (settingsBody) {
        settingsBody.style.display = 'grid';
        settingsBody.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        settingsBody.style.gap = '14px 16px';
        settingsBody.style.padding = '18px 20px';

        Array.from(settingsBody.children).forEach((child) => {
            if (child.tagName === 'HR') {
                child.style.gridColumn = '1 / -1';
                child.style.margin = '2px 0';
                return;
            }

            if (child.id === 'custom-character-box') {
                child.style.gridColumn = '1 / -1';
                return;
            }

            if (child.tagName === 'BUTTON') {
                child.style.gridColumn = '1 / -1';
                child.style.justifySelf = 'start';
                child.style.marginTop = '2px';
                return;
            }

            if (child.querySelector('input[type="checkbox"]')) {
                child.style.alignSelf = 'end';
                child.style.paddingBottom = '8px';
            }

            child.style.minWidth = '0';
        });
    }

    if (footer) {
        footer.style.display = 'flex';
        footer.style.flexDirection = 'column';
        footer.style.gap = '12px';
        footer.style.padding = '16px 20px 20px 20px';
    }
}

function formatDownloadStats(downloadedBytes = 0, totalBytes = 0, stage = '') {
    if (!downloadedBytes && !totalBytes) return '';
    const stageLabel = stage === 'config' ? 'Config' : stage === 'model' ? 'Model' : 'Downloaded';
    if (totalBytes > 0) return `${stageLabel}: ${bytesToMB(downloadedBytes)} MB / ${bytesToMB(totalBytes)} MB`;
    return `${stageLabel}: ${bytesToMB(downloadedBytes)} MB`;
}

function setModalVisible(modalId, visible, displayMode = 'flex') {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden', !visible);
    modal.style.display = visible ? displayMode : 'none';
}

function setTextDownloadStats(text) {
    if (progressStats) progressStats.textContent = text || '';
}

function setDownloadBarState(fillEl, textEl, statsEl, payload = {}) {
    if (fillEl && typeof payload.progress === 'number') fillEl.style.width = payload.progress + '%';
    if (textEl && typeof payload.progress === 'number') textEl.textContent = Math.round(payload.progress) + '%';
    if (statsEl) statsEl.textContent = formatDownloadStats(payload.downloadedBytes, payload.totalBytes, payload.stage);
}

async function resolveElectronFilePath(file) {
    if (!file) return '';
    if (typeof file.path === 'string' && file.path) return file.path;
    if (window.electronAPI?.getFilePath) {
        const resolvedPath = await window.electronAPI.getFilePath(file);
        if (resolvedPath) return resolvedPath;
    }
    return '';
}

function celebrateImportSuccess(message) {
    requestAnimationFrame(() => {
        launchConfetti();
        showNotification(message, 'success');
    });
}

function getUploadModalElements() {
    const modal = document.getElementById('upload-modal');
    if (!modal) return {};
    const title = modal.querySelector('h3');
    const subtitle = modal.querySelector('p');
    const labels = modal.querySelectorAll('label');
    const fileLabel = labels[1];
    const browseBtn = modal.querySelector('.secondary-btn[onclick="browseModelFile()"]');
    return { modal, title, subtitle, fileLabel, browseBtn };
}

function setUploadModalContent(type) {
    const { title, subtitle, fileLabel, browseBtn } = getUploadModalElements();
    const nameInput = document.getElementById('custom-model-name');

    const config = {
        text: {
            title: 'Upload Custom Model',
            subtitle: 'Import your own GGUF model file',
            fileLabel: 'Selected File',
            placeholder: 'e.g. My-Custom-Model'
        },
        stt: {
            title: 'Upload STT Model',
            subtitle: 'Import a Whisper .bin model file',
            fileLabel: 'Selected Whisper File',
            placeholder: 'e.g. My-Whisper-Model'
        },
        tts: {
            title: 'Upload TTS Model',
            subtitle: 'Import a Piper .onnx file with its .json config',
            fileLabel: 'Selected Files',
            placeholder: 'e.g. My-Piper-Voice'
        }
    }[type] || {
        title: 'Upload Custom Model',
        subtitle: 'Import your local model file',
        fileLabel: 'Selected File',
        placeholder: 'e.g. My-Model'
    };

    if (title) title.textContent = config.title;
    if (subtitle) subtitle.textContent = config.subtitle;
    if (fileLabel) fileLabel.textContent = config.fileLabel;
    if (browseBtn) browseBtn.textContent = type === 'tts' ? 'Browse Files' : 'Browse';
    if (nameInput) nameInput.placeholder = config.placeholder;
}

function getSelectedUploadLabel(payload, type = currentUploadType) {
    if (!payload) return 'No file selected';
    if (Array.isArray(payload)) {
        return payload.map(getBaseFileName).join(', ');
    }
    if (type === 'tts' && typeof payload === 'object') {
        return [payload.onnx, payload.json].filter(Boolean).map(getBaseFileName).join(', ');
    }
    return getBaseFileName(payload);
}

function applyUploadSelection(payload, type = currentUploadType) {
    selectedFilePath = payload;
    document.getElementById('selected-file-name').textContent = getSelectedUploadLabel(payload, type);
    const nameInput = document.getElementById('custom-model-name');
    if (!nameInput) return;

    if (!nameInput.value.trim()) {
        let suggestedName = '';
        if (Array.isArray(payload) && payload.length > 0) {
            const primary = payload.find(file => file.endsWith('.onnx')) || payload[0];
            suggestedName = stripFileExtension(getBaseFileName(primary)).replace(/\.onnx$/i, '');
        } else if (typeof payload === 'string') {
            suggestedName = stripFileExtension(getBaseFileName(payload)).replace(/\.onnx$/i, '');
        }
        if (suggestedName) nameInput.value = suggestedName;
    }
}

async function registerCustomSTTModel(modelName, result) {
    const id = 'custom-stt-' + Date.now();
    customSTTModels.push({ id, name: modelName, size: result.size, filename: result.filename, isCustom: true });
    localStorage.setItem('custom_stt_models', JSON.stringify(customSTTModels));
    if (!downloadedSTTModels.includes(id)) downloadedSTTModels.push(id);
    localStorage.setItem('downloaded_stt_models', JSON.stringify(downloadedSTTModels));
    renderSTTModels();
    refreshSTTInferenceModels();
    updateSystemInfo();
}

async function registerCustomTTSModel(modelName, result) {
    const id = 'custom-tts-' + Date.now();
    customTTSModels.push({ id, name: modelName, size: result.size, filename: result.filename, isCustom: true });
    localStorage.setItem('custom_tts_models', JSON.stringify(customTTSModels));
    if (!downloadedTTSModels.includes(id)) downloadedTTSModels.push(id);
    localStorage.setItem('downloaded_tts_models', JSON.stringify(downloadedTTSModels));
    renderTTSModels();
    refreshTTSInferenceModels();
    updateSystemInfo();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadSettings();
    loadTheme();
    loadChatHistory();
    loadDownloadedModels();
    enhanceChatSettingsPanel();
    
    renderModelGrid();
    renderSTTModels();
    renderTTSModels();

    // Update system info with retry - modelsDir may not be initialized immediately
    updateSystemInfo();
    setTimeout(() => updateSystemInfo(), 1000);
    setTimeout(() => updateSystemInfo(), 3000);
    setTimeout(() => updateSystemInfo(), 6000);
    setInterval(() => updateSystemInfo(), 5000);
    window.addEventListener('focus', () => updateSystemInfo());
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateSystemInfo();
    });

    userInput?.addEventListener('input', autoResize);
    userInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn?.addEventListener('click', sendMessage);
    document.getElementById('setting-temp')?.addEventListener('input', e => {
        document.getElementById('temp-val').textContent = e.target.value;
        autoApplySettings();
    });
    document.getElementById('setting-top-p')?.addEventListener('input', e => {
        document.getElementById('top-p-val').textContent = e.target.value;
        autoApplySettings();
    });
    document.getElementById('setting-repeat-penalty')?.addEventListener('input', e => {
        document.getElementById('repeat-penalty-val').textContent = e.target.value;
        autoApplySettings();
    });

    // Auto-apply settings on any input change
    ['setting-context', 'setting-input-tokens', 'setting-max-tokens'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => autoApplySettings());
    });
    ['speed-mode', 'think-mode'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => autoApplySettings());
    });
    document.getElementById('character-select')?.addEventListener('change', () => {
        toggleCustomCharacter();
        autoApplySettings();
    });
    document.getElementById('setting-system-prompt')?.addEventListener('change', () => autoApplySettings());
    document.addEventListener('click', e => {
        const target = e.target;
        if (!isChatSettingsOpen || !rightPanel) return;
        if (rightPanel.contains(target) || document.getElementById('chat-settings-toggle')?.contains(target)) return;
        toggleChatSettingsPanel(false);
    });

    if (document.getElementById('view-chat') && !document.getElementById('view-models')) {
        switchView('chat');
    } else if (window.location.hash === '#downloaded') {
        switchView('downloaded');
    }

    updatePanelVisibility();

    // Listen for model ready events
    if (window.electronAPI) {
        window.electronAPI.onModelReady(() => {
            isEngineReady = true;
            setStatus('online', 'Online');
            userInput.disabled = false;
            sendBtn.disabled = false;
            showNotification('Model loaded!', 'success');
        });

        window.electronAPI.onEngineError(msg => {
            setStatus('offline', 'Error');
            showNotification('Engine error: ' + msg, 'error');
        });
    }

    // Initialize STT and TTS SPA modules
    initSTTModelsPage();
    initSTTInferencePage();
    initTTSModelsPage();
    initTTSInferencePage();
    
    // Wire up Drag and drop
    setupDragAndDrop();

    // Forward main process STT logs to DevTools console (critical for production debugging)
    if (window.electronAPI?.onSTTLog) {
        window.electronAPI.onSTTLog((msg) => {
            console.log('%c[MAIN]', 'color: #f59e0b; font-weight: bold', msg);
        });
    }
});

// Drag and Drop Logic
function setupDragAndDrop() {
    const zones = [
        { id: 'upload-zone-models', type: 'text' },
        { id: 'upload-zone-downloaded', type: 'text' },
        { id: 'stt-upload-zone', type: 'stt' },
        { id: 'tts-upload-zone', type: 'tts' }
    ];

    zones.forEach(({ id, type }) => {
        const zone = document.getElementById(id);
        if (!zone) return;

        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.style.borderColor = 'var(--accent)';
            zone.style.backgroundColor = 'var(--bg-hover)';
        });

        zone.addEventListener('dragleave', e => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border)';
            zone.style.backgroundColor = 'var(--bg-card)';
        });

        zone.addEventListener('drop', async e => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border)';
            zone.style.backgroundColor = 'var(--bg-card)';
            
            if (!window.electronAPI) {
                showNotification('Runs locally only', 'error');
                return;
            }

            const files = Array.from(e.dataTransfer.files).map(f => f.path);
            if (files.length === 0) return;

            if (type === 'text') {
                const file = files[0];
                if (!file.endsWith('.gguf')) return showNotification('Only .gguf files allowed', 'error');
                showUploadModalWithFile(file, 'text');
            } else if (type === 'stt') {
                const file = files[0];
                if (!file.endsWith('.bin')) return showNotification('Only .bin files allowed', 'error');
                showUploadModalWithFile(file, 'stt');
            } else if (type === 'tts') {
                if (files.length < 2) return showNotification('Need both a .onnx file and its .onnx.json config', 'error');
                const onnx = files.find(f => f.endsWith('.onnx'));
                const json = files.find(f => f.endsWith('.onnx.json') || f.endsWith('.json'));
                if (!onnx || !json) return showNotification('Need both .onnx and .json', 'error');
                showUploadModalWithFile([onnx, json], 'tts');
            }
        });
    });
}

// View Switching
function switchView(view) {
    if (view === 'chat' && !document.getElementById('view-chat')) {
        window.location.href = 'chat.html';
        return;
    }
    if ((view === 'models' || view === 'downloaded') && (!document.getElementById('view-models') || !document.getElementById('view-downloaded'))) {
        window.location.href = view === 'downloaded' ? 'index.html#downloaded' : 'index.html';
        return;
    }

    currentView = view;
    document.querySelectorAll('.nav-btn').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add('active');
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    
    const targetElement = document.getElementById(`view-${view}`);
    if (targetElement) {
        targetElement.classList.remove('hidden');
    }

    updatePanelVisibility();
    updateSystemInfo();

    if (view === 'models') { renderModelGrid(); switchCategory('text', 'models'); }
    if (view === 'downloaded') { renderDownloadedGrid(); switchCategory('text', 'downloaded'); }
    if (view === 'chat') { renderChatHistory(); renderChatArea(); updateModelDropdown(); switchCategory('text', 'chat'); }
}

// Category Switching (Text Gen / STT / TTS)
function switchCategory(category, viewName) {
    // 1. Update active tab styling
    const tabsContainer = document.getElementById(`${viewName}-top-tabs`);
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.color = 'var(--text-muted)';
            btn.style.fontWeight = '500';
            btn.style.borderBottom = '3px solid transparent';
        });
        
        let index = category === 'text' ? 0 : (category === 'stt' ? 1 : 2);
        const activeBtn = tabsContainer.querySelectorAll('.tab-btn')[index];
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.color = 'var(--text)';
            activeBtn.style.fontWeight = '600';
            activeBtn.style.borderBottom = '3px solid var(--accent)';
        }
    }

    // 2. Toggle content containers
    const contentPrefix = viewName === 'models' ? 'models' : (viewName === 'downloaded' ? 'downloaded' : 'chat');
    
    // Engine offload logic when switching categories in view = chat
    if (viewName === 'chat' && window.electronAPI) {
        window.electronAPI.offloadEngine(category);
    }
    
    const textEl = document.getElementById(`${contentPrefix}-content-text`);
    const sttEl = document.getElementById(`${contentPrefix}-content-stt`);
    const ttsEl = document.getElementById(`${contentPrefix}-content-tts`);
    
    if (textEl) textEl.style.display = category === 'text' ? (viewName === 'chat' ? 'flex' : 'block') : 'none';
    if (sttEl) sttEl.style.display = category === 'stt' ? (viewName === 'chat' ? 'flex' : 'block') : 'none';
    if (ttsEl) ttsEl.style.display = category === 'tts' ? (viewName === 'chat' ? 'flex' : 'block') : 'none';

    // 3. Render specific content and manage right panel for chat view
    if (viewName === 'chat') {
        currentChatCategory = category;
        if (category !== 'text') isChatSettingsOpen = false;
        updatePanelVisibility();
    }

    if (category === 'stt') {
        if (viewName === 'models' || viewName === 'downloaded') renderSTTModels();
    } else if (category === 'tts') {
        if (viewName === 'models' || viewName === 'downloaded') renderTTSModels();
    }

    // Keep system info updated on tab switches
    updateSystemInfo();
}

function updatePanelVisibility() {
    const settingsToggleBtn = document.getElementById('chat-settings-toggle');
    const shouldAllowSettings = currentView === 'chat' && currentChatCategory === 'text';

    if (settingsToggleBtn) {
        settingsToggleBtn.style.display = shouldAllowSettings ? 'inline-flex' : 'none';
        settingsToggleBtn.setAttribute('aria-expanded', shouldAllowSettings && isChatSettingsOpen ? 'true' : 'false');
        settingsToggleBtn.style.background = shouldAllowSettings && isChatSettingsOpen ? 'var(--accent)' : '';
        settingsToggleBtn.style.color = shouldAllowSettings && isChatSettingsOpen ? '#fff' : '';
        settingsToggleBtn.style.borderColor = shouldAllowSettings && isChatSettingsOpen ? 'var(--accent)' : '';
    }

    if (rightPanel) {
        if (chatSettingsHideTimer) {
            clearTimeout(chatSettingsHideTimer);
            chatSettingsHideTimer = null;
        }

        if (shouldAllowSettings && isChatSettingsOpen) {
            rightPanel.classList.remove('hidden');
            rightPanel.style.display = 'flex';
            rightPanel.style.pointerEvents = 'auto';
            rightPanel.style.opacity = '1';
            rightPanel.style.transform = 'translateY(0)';
        } else {
            rightPanel.style.pointerEvents = 'none';
            rightPanel.style.opacity = '0';
            rightPanel.style.transform = 'translateY(-12px)';
            chatSettingsHideTimer = setTimeout(() => {
                rightPanel.style.display = 'none';
                rightPanel.classList.add('hidden');
            }, 180);
        }
    }
}

function toggleChatSettingsPanel(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !isChatSettingsOpen;
    isChatSettingsOpen = currentView === 'chat' && currentChatCategory === 'text' ? nextState : false;
    updatePanelVisibility();
}

// RAM/Category Filters
function filterRam(ram) {
    currentRamTab = ram;
    document.querySelectorAll('.ram-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.ram-btn[data-ram="${ram}"]`)?.classList.add('active');
    renderModelGrid();
}

function filterCategory(category) {
    currentCategory = category;
    renderModelGrid();
}

// Render Models
function renderModelGrid() {
    const grid = document.getElementById('model-grid');
    if (!grid) return;
    let models = MODEL_CATALOG[currentRamTab] || [];
    if (currentCategory !== 'all') models = models.filter(m => m.category === currentCategory);

    if (models.length === 0) {
        grid.innerHTML = '<p class="empty-msg">No models found</p>';
        return;
    }

    grid.innerHTML = models.map(m => {
        const isDownloaded = downloadedModels.includes(m.id);
        const catIcon = MODEL_CATEGORIES[m.category]?.icon || '📄';
        return `
        <div class="${isDownloaded ? 'local-model-item' : 'catalog-item'}">
            <div>
                <h3 class="model-name">${catIcon} ${m.name}</h3>
                <p>${m.description}</p>
                <div class="chip-row">
                    <span class="chip">📦 ${m.size}</span>
                    <span class="chip">${m.params}</span>
                </div>
            </div>
            <div class="actions">
                ${isDownloaded ? `
                    <button class="primary-btn" onclick="useModel('${m.id}')">Use</button>
                    <button class="danger-btn" onclick="showDeleteModal('${m.id}')"><i data-lucide="trash-2" style="width: 14px;"></i> Delete</button>
                ` : `
                    <button class="primary-btn" onclick="downloadModel('${m.id}')">Download</button>
                `}
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function renderDownloadedGrid() {
    const grid = document.getElementById('downloaded-grid');
    if (!grid) return;
    if (downloadedModels.length === 0) {
        grid.innerHTML = '<p class="empty-msg">No models downloaded</p>';
        return;
    }
    const allModels = getAllModels();
    grid.innerHTML = downloadedModels.map(id => {
        const m = allModels.find(x => x.id === id);
        if (!m) return '';
        const catIcon = MODEL_CATEGORIES[m.category]?.icon || '📄';
        return `
        <div class="local-model-item">
            <div>
                <h3 class="model-name">${catIcon} ${m.name}</h3>
                <p>${m.description}</p>
                <div class="chip-row">
                    <span class="chip">📦 ${m.size}</span>
                    <span class="chip">${m.params}</span>
                </div>
            </div>
            <div class="actions">
                <button class="primary-btn" onclick="useModel('${m.id}')">Use</button>
                <button class="danger-btn" onclick="showDeleteModal('${m.id}')"><i data-lucide="trash-2" style="width: 14px;"></i> Delete</button>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function updateModelDropdown() {
    if (!modelSelect) return;
    const allModels = getAllModels();
    modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
    downloadedModels.forEach(id => {
        const m = allModels.find(x => x.id === id);
        if (m) {
            const catIcon = MODEL_CATEGORIES[m.category]?.icon || '';
            modelSelect.innerHTML += `<option value="${id}">${catIcon} ${m.name}</option>`;
        }
    });
    if (currentModel) modelSelect.value = currentModel;
    modelSelect.onchange = () => { if (modelSelect.value) useModel(modelSelect.value); };
}

// Model Actions
let pendingDownloadModelId = null;

function parseSizeToMB(sizeStr) {
    if (!sizeStr) return 0;
    const num = parseFloat(sizeStr);
    if (sizeStr.includes('GB')) return num * 1024;
    if (sizeStr.includes('MB')) return num;
    return num;
}

async function downloadModel(modelId) {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    if (!model) return;

    // Check disk space before downloading
    try {
        const info = await window.electronAPI.getSystemInfo();
        // Only check if disk space is known (not -1)
        if (info.diskFree > 0) {
            const freeSpaceMB = info.diskFree * 1024; // convert GB to MB
            const modelSizeMB = parseSizeToMB(model.size);

            if (modelSizeMB > 0 && freeSpaceMB < modelSizeMB) {
                pendingDownloadModelId = modelId;
                document.getElementById('low-space-msg').textContent =
                    `You have ${info.diskFree} GB free but "${model.name}" needs ${model.size}. ` +
                    `Do you want to download anyway?`;
                setModalVisible('low-space-modal', true);
                return;
            }
        }
    } catch { }

    startDownload(modelId);
}

function closeLowSpaceModal() {
    setModalVisible('low-space-modal', false);
    pendingDownloadModelId = null;
}

function confirmLowSpaceDownload() {
    setModalVisible('low-space-modal', false);
    if (pendingDownloadModelId) {
        startDownload(pendingDownloadModelId);
        pendingDownloadModelId = null;
    }
}

async function startDownload(modelId) {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    if (!model) return;

    activeModelDownloadType = 'text';
    activeModelDownloadId = modelId;
    setModalVisible('download-modal', true);
    document.getElementById('download-title').textContent = `Downloading ${model.name}...`;
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    setTextDownloadStats('');

    try {
        await window.electronAPI.downloadModel({ id: modelId, url: model.url, filename: model.filename });
    } catch (err) {
        setModalVisible('download-modal', false);
        showNotification('Download failed: ' + err.message, 'error');
    }
}

function cancelDownload() {
    window.electronAPI.cancelDownload();
    activeModelDownloadId = null;
    setModalVisible('download-modal', false);
}

async function useModel(modelId) {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    if (!model) return;

    const check = await window.electronAPI.checkModel(model.filename);
    if (!check.exists) {
        showNotification('Model file not found. Please re-download.', 'error');
        return;
    }
    if (!check.valid) {
        showNotification('Model file is corrupted. Please re-download.', 'error');
        return;
    }

    currentModel = modelId;
    currentModelFilename = model.filename;

    switchView('chat');
    createNewChat();
    updateModelDropdown();
    modelSelect.value = modelId;
    document.getElementById('welcome')?.classList.add('hidden');

    // Start loading the model
    isEngineReady = false;
    userInput.disabled = true;
    sendBtn.disabled = true;
    setStatus('loading', 'Loading...');

    // Tell main process to start the engine with this model and context size
    await window.electronAPI.switchModel(model.filename, settings.contextSize || 2048);

    showNotification(`Loading ${model.name}... Please wait`, 'info');
}

// Delete Modal
function showDeleteModal(modelId) {
    modelToDelete = modelId;
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    document.getElementById('delete-name').textContent = `Delete "${model?.name}"?`;
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modelToDelete = null;
}

async function confirmDelete() {
    if (!modelToDelete) return;
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelToDelete);

    try {
        await window.electronAPI.deleteModel(model.filename);
        downloadedModels = downloadedModels.filter(id => id !== modelToDelete);
        localStorage.setItem('downloaded_models', JSON.stringify(downloadedModels));
        if (model.isCustom) {
            customModels = customModels.filter(entry => entry.id !== modelToDelete);
            localStorage.setItem('custom_models', JSON.stringify(customModels));
        }
        renderModelGrid();
        renderDownloadedGrid();
        updateModelDropdown();
        updateSystemInfo();
        showNotification('Model deleted', 'success');
    } catch (err) {
        showNotification('Delete failed', 'error');
    }
    closeDeleteModal();
}

// Chat Functions
function createNewChat() {
    const chatId = Date.now();
    const allModels = getAllModels();
    const modelName = currentModel ? (allModels.find(m => m.id === currentModel)?.name || 'Chat') : 'New Chat';
    currentChatId = chatId;
    messages = [];
    chatHistory.unshift({ id: chatId, title: modelName, model: currentModel, messages: [], updatedAt: Date.now() });
    saveChatHistory();
    renderChatArea();
    renderChatHistory();
}

function saveCurrentChat() {
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages = [...messages];
        chat.model = currentModel;
        chat.updatedAt = Date.now();
        if (messages.length > 0) chat.title = messages[0].content.slice(0, 25) + '...';
        saveChatHistory();
    }
}

function loadChat(chatId) {
    saveCurrentChat();
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;
    currentChatId = chatId;
    messages = [...chat.messages];
    if (chat.model) { currentModel = chat.model; modelSelect.value = currentModel; }
    renderChatArea();
    renderChatHistory();
}

function deleteChat(chatId, e) {
    e.stopPropagation();
    chatHistory = chatHistory.filter(c => c.id !== chatId);
    saveChatHistory();
    if (chatId === currentChatId) {
        if (chatHistory.length > 0) loadChat(chatHistory[0].id);
        else createNewChat();
    }
    renderChatHistory();
}

function renderChatHistory() {
    document.getElementById('chat-history').innerHTML = chatHistory.slice(0, 8).map(c => `
        <div class="history-item ${c.id === currentChatId ? 'active' : ''}" onclick="loadChat(${c.id})">
            <span>${c.title}</span>
            <span onclick="deleteChat(${c.id}, event)">✕</span>
        </div>
    `).join('');
}

function renderChatArea() {
    chatArea.innerHTML = '';
    ensureChatWatermark();
    if (messages.length === 0) {
        chatArea.innerHTML = `<div class="welcome" id="welcome">
            <h1>Start Chatting</h1>
            <p>Select a downloaded model above</p>
        </div>`;
        ensureChatWatermark();
        return;
    }
    messages.forEach(m => {
        if (m.role === 'user') {
            addMessageRow(m.content, true);
        } else {
            addMessageRow(m.content, false, false, m.thinking, m.thinkDuration);
        }
    });
}

function addMessageRow(text, isUser, isTemporary = false, thinkingText = null, thinkDuration = 0) {
    ensureChatWatermark();
    document.getElementById('welcome')?.classList.add('hidden');
    const row = document.createElement('div');
    row.className = 'message-row';
    const formattedText = isUser ? escapeHtml(text) : (typeof marked !== 'undefined' ? marked.parse(text) : text);

    let thinkingHtml = '';
    if (!isUser && thinkingText && thinkingText.trim()) {
        const durationLabel = thinkDuration > 0 ? `Thought for ${thinkDuration}s` : 'Thought process';
        const thinkFormatted = typeof marked !== 'undefined' ? marked.parse(thinkingText) : thinkingText;
        thinkingHtml = `
            <div class="thinking-block">
                <div class="thinking-header" onclick="toggleThinking(this)">
                    <span class="think-icon">🧠</span>
                    <span>${durationLabel}</span>
                    <span class="think-arrow">▶</span>
                </div>
                <div class="thinking-content">
                    <div class="thinking-content-inner">${thinkFormatted}</div>
                </div>
            </div>
        `;
    }

    row.innerHTML = `
        <div class="avatar ${isUser ? 'user' : 'ai'}">${isUser ? 'U' : 'AI'}</div>
        <div class="message-content">${thinkingHtml}${formattedText}</div>
    `;
    chatArea.appendChild(row);
    chatArea.scrollTop = chatArea.scrollHeight;
    return row;
}

function toggleThinking(header) {
    header.classList.toggle('expanded');
    const content = header.nextElementSibling;
    content.classList.toggle('expanded');
}

// Send Message - Uses HTTP API like old app
async function sendMessage() {
    if (isGenerating) {
        if (abortController) abortController.abort();
        isGenerating = false;
        updateSendButton();
        return;
    }

    let text = userInput.value.trim();
    if (!text || !isEngineReady) {
        if (!isEngineReady) showNotification('Model not ready yet', 'error');
        return;
    }

    // Truncate input if exceeds inputTokens limit (rough estimate: 1 token ≈ 4 chars)
    const maxInputChars = (settings.inputTokens || 1024) * 4;
    if (text.length > maxInputChars) {
        text = text.substring(0, maxInputChars);
        showNotification('Input truncated to fit token limit', 'info');
    }

    isGenerating = true;
    updateSendButton();
    userInput.value = '';
    autoResize.call(userInput);

    messages.push({ role: 'user', content: text });
    saveCurrentChat();
    addMessageRow(text, true);

    const aiRow = addMessageRow('', false, true);
    const aiContent = aiRow.querySelector('.message-content');

    const isThinkMode = settings.thinkMode || false;

    // Show appropriate loading indicator
    if (isThinkMode) {
        aiContent.innerHTML = `
            <div class="thinking-indicator" id="live-thinking">
                <span class="brain-pulse">🧠</span>
                <span>Thinking</span>
                <div class="think-dots"><span></span><span></span><span></span></div>
            </div>
        `;
    } else {
        aiContent.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    }

    abortController = new AbortController();
    let fullResponse = '';
    let thinkingContent = '';
    let finalContent = '';
    let insideThink = false;
    let thinkStartTime = Date.now();
    let thinkDuration = 0;

    try {
        let systemContent = (settings.systemPrompt || '').trim() || (settings.customInstruction || '').trim() || '';

        // Add chain-of-thought instruction only if Think Mode is enabled
        if (isThinkMode) {
            systemContent = `${systemContent}${systemContent ? '\n\n' : ''}Think step by step. Put your internal reasoning inside <think>...</think> tags. After closing the think tag, provide your final clear answer outside the tags.`;
        }

        const apiMessages = buildContextAwareMessages(systemContent, messages, {
            contextSize: settings.contextSize || 2048,
            maxTokens: settings.maxTokens || 1000,
            speedMode: settings.speedMode || false
        });

        // Adjust temperature based on mode
        const temperature = settings.temperature || 0.7;
        const topP = settings.topP || 0.9;
        const repeatPenalty = settings.repeatPenalty || 1.1;

        // Call the server API
        const response = await fetch('http://127.0.0.1:5000/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: apiMessages,
                stream: true,
                max_tokens: settings.maxTokens || 1000,
                temperature: temperature,
                top_p: topP,
                repeat_penalty: repeatPenalty
            }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let firstToken = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.substring(6));
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) {
                            if (!firstToken) {
                                firstToken = true;
                            }
                            fullResponse += content;

                            if (isThinkMode) {
                                // Parse <think> tags in real-time
                                renderThinkStream(aiContent, fullResponse);
                            } else {
                                // Normal mode: direct render
                                if (aiContent.querySelector('.typing')) {
                                    aiContent.innerHTML = '';
                                }
                                aiContent.innerHTML = typeof marked !== 'undefined' ? marked.parse(fullResponse) : fullResponse;
                            }
                            chatArea.scrollTop = chatArea.scrollHeight;
                        }
                    } catch { }
                }
            }
        }

        // Finalize the message
        if (isThinkMode) {
            const parsed = parseThinkTags(fullResponse);
            thinkingContent = parsed.thinking;
            finalContent = parsed.answer;
            thinkDuration = Math.round((Date.now() - thinkStartTime) / 1000);

            // Only show thinking block if model actually produced thinking content
            if (thinkingContent) {
                renderFinalThinkMessage(aiContent, thinkingContent, finalContent, thinkDuration);
            } else {
                // Model didn't use <think> tags — show response normally, no duplication
                aiContent.innerHTML = typeof marked !== 'undefined' ? marked.parse(finalContent) : finalContent;
            }

            messages.push({ role: 'assistant', content: finalContent, thinking: thinkingContent || '', thinkDuration });
        } else {
            messages.push({ role: 'assistant', content: fullResponse });
        }
        saveCurrentChat();

    } catch (e) {
        if (e.name !== 'AbortError') {
            aiContent.innerHTML = `<span style="color:var(--danger)">Error: ${e.message}</span>`;
        }
        saveCurrentChat();
    }

    isGenerating = false;
    abortController = null;
    updateSendButton();
}

// Parse <think>...</think> tags from response
function parseThinkTags(text) {
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
        const thinking = thinkMatch[1].trim();
        const answer = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return { thinking, answer };
    }
    // If no closing tag, check for opening only (model still thinking)
    const openMatch = text.match(/<think>([\s\S]*)/i);
    if (openMatch) {
        return { thinking: openMatch[1].trim(), answer: '', incomplete: true };
    }
    return { thinking: '', answer: text };
}

// Real-time render of think stream
function renderThinkStream(container, rawText) {
    const parsed = parseThinkTags(rawText);

    if (parsed.thinking && !parsed.answer && parsed.incomplete !== false) {
        // Still inside <think> — show live thinking indicator with content
        const thinkFormatted = typeof marked !== 'undefined' ? marked.parse(parsed.thinking) : parsed.thinking;
        container.innerHTML = `
            <div class="thinking-indicator">
                <span class="brain-pulse">🧠</span>
                <span>Thinking</span>
                <div class="think-dots"><span></span><span></span><span></span></div>
            </div>
            <div class="thinking-content expanded" style="margin-bottom: 8px;">
                <div class="thinking-content-inner">${thinkFormatted}</div>
            </div>
        `;
    } else if (parsed.answer) {
        // Got past </think> — show thinking block collapsed + streaming answer
        const thinkFormatted = parsed.thinking ? (typeof marked !== 'undefined' ? marked.parse(parsed.thinking) : parsed.thinking) : '';
        const answerFormatted = typeof marked !== 'undefined' ? marked.parse(parsed.answer) : parsed.answer;
        let thinkBlock = '';
        if (parsed.thinking) {
            thinkBlock = `
                <div class="thinking-block">
                    <div class="thinking-header" onclick="toggleThinking(this)">
                        <span class="think-icon">🧠</span>
                        <span>Thinking...</span>
                        <span class="think-arrow">▶</span>
                    </div>
                    <div class="thinking-content">
                        <div class="thinking-content-inner">${thinkFormatted}</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = thinkBlock + answerFormatted;
    } else {
        // No think tags at all — in think mode, still show thinking indicator while streaming
        const formatted = typeof marked !== 'undefined' ? marked.parse(rawText) : rawText;
        container.innerHTML = `
            <div class="thinking-indicator">
                <span class="brain-pulse">🧠</span>
                <span>Thinking</span>
                <div class="think-dots"><span></span><span></span><span></span></div>
            </div>
        ` + formatted;
    }
}

// Final render after streaming completes in think mode
function renderFinalThinkMessage(container, thinkingText, finalText, duration) {
    let thinkBlock = '';
    if (thinkingText && thinkingText.trim()) {
        const thinkFormatted = typeof marked !== 'undefined' ? marked.parse(thinkingText) : thinkingText;
        const durationLabel = duration > 0 ? `Thought for ${duration}s` : 'Thought process';
        thinkBlock = `
            <div class="thinking-block">
                <div class="thinking-header" onclick="toggleThinking(this)">
                    <span class="think-icon">🧠</span>
                    <span>${durationLabel}</span>
                    <span class="think-arrow">▶</span>
                </div>
                <div class="thinking-content">
                    <div class="thinking-content-inner">${thinkFormatted}</div>
                </div>
            </div>
        `;
    }
    const answerFormatted = finalText ? (typeof marked !== 'undefined' ? marked.parse(finalText) : finalText) : '';
    container.innerHTML = thinkBlock + answerFormatted;
}

function updateSendButton() {
    if (!sendBtn) return;
    sendBtn.innerHTML = isGenerating 
        ? 'Stop <i data-lucide="square" style="width: 14px;"></i>' 
        : 'Send <i data-lucide="send" style="width: 14px;"></i>';
    lucide.createIcons();
}

// Settings
function applySettings(options = {}) {
    const { silent = false } = options;
    const previousContextSize = settings.contextSize || 2048;
    settings.contextSize = parseInt(document.getElementById('setting-context').value);
    settings.inputTokens = parseInt(document.getElementById('setting-input-tokens').value) || 1024;
    settings.maxTokens = parseInt(document.getElementById('setting-max-tokens').value);
    settings.temperature = parseFloat(document.getElementById('setting-temp').value);
    settings.topP = parseFloat(document.getElementById('setting-top-p')?.value) || 0.9;
    settings.repeatPenalty = parseFloat(document.getElementById('setting-repeat-penalty')?.value) || 1.1;
    settings.speedMode = document.getElementById('speed-mode').checked;
    settings.thinkMode = document.getElementById('think-mode').checked;
    settings.character = document.getElementById('character-select').value;
    settings.systemPrompt = document.getElementById('setting-system-prompt')?.value?.trim() || '';
    localStorage.setItem('model_settings', JSON.stringify(settings));
    if (!silent) showNotification('Settings applied!', 'success');

    // Only the context window requires a model restart.
    if (currentModelFilename && isEngineReady && (settings.contextSize || 2048) !== previousContextSize) {
        isEngineReady = false;
        userInput.disabled = true;
        sendBtn.disabled = true;
        setStatus('loading', 'Reloading with new settings...');
        window.electronAPI.switchModel(currentModelFilename, settings.contextSize || 2048);
        showNotification('Reloading model with new context size...', 'info');
    }
}

function autoApplySettings() {
    if (autoApplyTimer) clearTimeout(autoApplyTimer);

    autoApplyTimer = setTimeout(() => {
        const previousContextSize = settings.contextSize || 2048;
        applySettings({ silent: true });
        const nextContextSize = settings.contextSize || 2048;

        if (previousContextSize !== nextContextSize && currentModelFilename) {
            showNotification(`Context window updated to ${nextContextSize} tokens`, 'info');
        }
    }, 180);
}

function loadSettings() {
    const saved = localStorage.getItem('model_settings');
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
    settings.systemPrompt = settings.systemPrompt || settings.customInstruction || '';
    document.getElementById('setting-context').value = settings.contextSize || 2048;
    document.getElementById('setting-input-tokens').value = settings.inputTokens || 1024;
    document.getElementById('setting-max-tokens').value = settings.maxTokens || 1000;
    document.getElementById('setting-temp').value = settings.temperature || 0.7;
    document.getElementById('temp-val').textContent = settings.temperature || 0.7;
    const topPInput = document.getElementById('setting-top-p');
    const topPVal = document.getElementById('top-p-val');
    if (topPInput) topPInput.value = settings.topP || 0.9;
    if (topPVal) topPVal.textContent = settings.topP || 0.9;
    const repeatPenaltyInput = document.getElementById('setting-repeat-penalty');
    const repeatPenaltyVal = document.getElementById('repeat-penalty-val');
    if (repeatPenaltyInput) repeatPenaltyInput.value = settings.repeatPenalty || 1.1;
    if (repeatPenaltyVal) repeatPenaltyVal.textContent = settings.repeatPenalty || 1.1;
    document.getElementById('speed-mode').checked = settings.speedMode || false;
    document.getElementById('think-mode').checked = settings.thinkMode || false;
    document.getElementById('character-select').value = settings.character || 'assistant';
    const systemPrompt = document.getElementById('setting-system-prompt');
    if (systemPrompt) systemPrompt.value = settings.systemPrompt || '';
    toggleCustomCharacter();
}

function toggleCustomCharacter() {
    const customBox = document.getElementById('custom-character-box');
    const promptBox = document.getElementById('setting-system-prompt');
    if (customBox) {
        customBox.style.display = 'flex';
    }
    if (promptBox) {
        const sel = document.getElementById('character-select').value;
        promptBox.placeholder = sel === 'custom'
            ? 'Write the full system prompt and character behavior here.'
            : 'Optional: write your own system prompt. Leave blank to use the selected character preset.';
    }
}

// Theme
function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.removeAttribute('data-theme');
    }
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerHTML = isDarkMode ? '<span class="theme-icon">🌙</span> Light Mode' : '<span class="theme-icon">☀️</span> Dark Mode';
    }
    localStorage.setItem('dark_mode', isDarkMode);
}

function loadTheme() {
    isDarkMode = localStorage.getItem('dark_mode') === 'true';
    if (isDarkMode) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.removeAttribute('data-theme');
    }
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerHTML = isDarkMode ? '<span class="theme-icon">🌙</span> Light Mode' : '<span class="theme-icon">☀️</span> Dark Mode';
    }
}

function setStatus(state, text) {
    document.getElementById('status-badge').className = 'status-badge ' + state;
    document.getElementById('status-text').textContent = text;
}

async function updateSystemInfo() {
    try {
        if (!window.electronAPI) return;
        const info = await window.electronAPI.getSystemInfo();
        if (!info) return;
        
        const ramEl = document.getElementById('sys-ram');
        const diskEl = document.getElementById('sys-disk');
        const modelsEl = document.getElementById('models-size');
        const pathEl = document.getElementById('storage-path');
        
        if (ramEl && info.ram) ramEl.textContent = info.ram + ' GB';
        if (diskEl) diskEl.textContent = (info.diskFree < 0 ? 'Unknown' : info.diskFree + ' GB');
        if (modelsEl && info.modelsSize !== undefined) modelsEl.textContent = info.modelsSize + ' GB';

        // Display storage path (shortened)
        if (info.modelsPath && pathEl) {
            const shortPath = info.modelsPath.length > 20
                ? '...' + info.modelsPath.slice(-18)
                : info.modelsPath;
            pathEl.textContent = shortPath;
            pathEl.title = info.modelsPath;
        }
    } catch (err) {
        console.log('System info update pending...', err?.message || '');
    }
}

async function changeStorageDir() {
    try {
        const newDir = await window.electronAPI.selectModelsDir();
        if (newDir) {
            showNotification('Storage location changed to: ' + newDir, 'success');
            updateSystemInfo();
        }
    } catch (err) {
        showNotification('Failed to change storage: ' + err.message, 'error');
    }
}

// Confetti
function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = [];
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    for (let i = 0; i < 70; i++) {
        particles.push({
            x: viewportWidth / 2,
            y: viewportHeight / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12 - 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 7 + 3,
            alpha: 1
        });
    }
    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, viewportWidth, viewportHeight);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.28;
            p.alpha = Math.max(0, p.alpha - 0.012);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
        });
        ctx.globalAlpha = 1;
        if (++frame < 72) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    }
    animate();
}

// IPC
if (window.electronAPI) {
    detachGlobalProgressListener = window.electronAPI.onDownloadProgress((payload) => {
        const { type, id } = payload;
        if (type !== 'text' || activeModelDownloadType !== 'text' || activeModelDownloadId !== id) return;
        setDownloadBarState(progressFill, progressText, progressStats, payload);
    });
    detachGlobalCompleteListener = window.electronAPI.onDownloadComplete(({ type, id }) => {
        if (type !== 'text') return;
        setModalVisible('download-modal', false);
        activeModelDownloadId = null;
        if (!downloadedModels.includes(id)) {
            downloadedModels.push(id);
            localStorage.setItem('downloaded_models', JSON.stringify(downloadedModels));
        }
        renderModelGrid();
        renderDownloadedGrid();
        updateModelDropdown();
        refreshSTTInferenceModels();
        refreshTTSInferenceModels();
        updateSystemInfo();
        launchConfetti();
        showNotification('🎉 Download complete!', 'success');
    });
    detachGlobalCancelledListener = window.electronAPI.onDownloadCancelled(({ type, id }) => {
        if (type !== 'text') return;
        if (activeModelDownloadId === id) {
            activeModelDownloadId = null;
        }
        setModalVisible('download-modal', false);
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        setTextDownloadStats('');
        showNotification('Download canceled', 'info');
    });
}

// Helpers
function loadDownloadedModels() {
    downloadedModels = JSON.parse(localStorage.getItem('downloaded_models') || '[]');
    updateModelDropdown();
}
function loadChatHistory() {
    chatHistory = normalizeChatHistory(JSON.parse(localStorage.getItem('chat_history') || '[]'));
    if (!currentChatId && chatHistory.length > 0) {
        currentChatId = chatHistory[0].id;
        messages = [...chatHistory[0].messages];
        currentModel = chatHistory[0].model || currentModel;
    }
}
function saveChatHistory() {
    chatHistory = normalizeChatHistory(chatHistory)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    localStorage.setItem('chat_history', JSON.stringify(chatHistory));
}
function showNotification(msg, type) {
    const n = document.createElement('div');
    n.style.cssText = `position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;animation:fadeIn 0.3s;box-shadow:0 4px 20px rgba(0,0,0,0.15);`;
    n.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1';
    n.style.color = 'white';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}
function autoResize() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function getBaseFileName(filePath) { return filePath.split('\\').pop().split('/').pop(); }
function stripFileExtension(fileName) { return fileName.replace(/\.[^.]+$/, ''); }
function formatAudioDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}
function createWaveformBars(seedText, count = 40) {
    let seed = 0;
    const source = String(seedText || 'audio');
    for (let i = 0; i < source.length; i += 1) seed = ((seed * 31) + source.charCodeAt(i)) >>> 0;
    return Array.from({ length: count }, (_, index) => {
        seed = (seed * 1664525 + 1013904223 + index) >>> 0;
        const normalized = seed / 4294967295;
        return Math.max(18, Math.round(18 + normalized * 82));
    });
}
function getTranscriptSTTModel() {
    const selected = document.getElementById('stt-model-select')?.value;
    if (selected) {
        const active = getAllSTTModels().find(model => model.filename === selected);
        if (active) return active;
    }
    const firstDownloadedId = downloadedSTTModels[0];
    return getAllSTTModels().find(model => model.id === firstDownloadedId) || null;
}
function ensureTTSConversationStarted(messagesEl) {
    if (!messagesEl.dataset.hasConversation) {
        messagesEl.innerHTML = '';
        messagesEl.dataset.hasConversation = 'true';
    }
}
function buildSpeechModelCard(model, isDownloaded, kind) {
    const cardClass = isDownloaded ? 'local-model-item speech-model-item' : 'catalog-item speech-model-item';
    const iconLabel = kind === 'stt' ? 'Speech to Text' : 'Text to Speech';
    const actionButton = isDownloaded
        ? `<button class="danger-btn" onclick="${kind === 'stt' ? 'deleteSTTModel' : 'deleteTTSModel'}('${model.id}')"><i data-lucide="trash-2" style="width: 14px;"></i> Delete</button>`
        : `<button class="primary-btn" onclick="${kind === 'stt' ? 'downloadSTTModel' : 'downloadTTSModel'}('${model.id}')">Download</button>`;

    return `
        <div class="${cardClass}">
            <div>
                <h3 class="model-name">${iconLabel} ${model.name}</h3>
                <p>${model.description || `Local ${iconLabel.toLowerCase()} model`}</p>
                <div class="chip-row">
                    <span class="chip">Package ${model.size || 'Unknown'}</span>
                    <span class="chip">${model.isCustom ? 'Custom Import' : 'Gallery Model'}</span>
                </div>
            </div>
            <div class="actions">
                ${actionButton}
            </div>
        </div>`;
}
function initializeTTSAudioCard(card, seedText) {
    const audio = card.querySelector('audio');
    const playButton = card.querySelector('[data-role="play-audio"]');
    const durationLabel = card.querySelector('[data-role="audio-time"]');
    const barsHost = card.querySelector('[data-role="wave-bars"]');
    if (!audio || !playButton || !durationLabel || !barsHost) return;

    const bars = createWaveformBars(seedText);
    barsHost.innerHTML = bars.map(height => `<span class="waveform-bar" style="height:${height}%"></span>`).join('');
    const barEls = Array.from(barsHost.querySelectorAll('.waveform-bar'));

    const syncProgress = () => {
        const progress = audio.duration ? audio.currentTime / audio.duration : 0;
        const playedBars = Math.round(progress * barEls.length);
        barEls.forEach((bar, index) => bar.classList.toggle('played', index < playedBars));
        durationLabel.textContent = audio.duration
            ? `${formatAudioDuration(audio.currentTime)} / ${formatAudioDuration(audio.duration)}`
            : '0:00 / 0:00';
        playButton.textContent = audio.paused ? 'Play' : 'Pause';
    };

    playButton.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().catch(() => showNotification('Unable to play generated audio', 'error'));
        } else {
            audio.pause();
        }
    });

    audio.addEventListener('loadedmetadata', syncProgress);
    audio.addEventListener('timeupdate', syncProgress);
    audio.addEventListener('play', syncProgress);
    audio.addEventListener('pause', syncProgress);
    audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        syncProgress();
    });
    syncProgress();
}
function registerCustomTextModel(modelName, result) {
    const customId = 'custom-' + Date.now();
    const customModel = {
        id: customId,
        name: modelName,
        params: 'Custom',
        size: result.size,
        category: 'chat',
        description: 'Custom uploaded model',
        filename: result.filename,
        isCustom: true
    };

    customModels.push(customModel);
    localStorage.setItem('custom_models', JSON.stringify(customModels));

    if (!downloadedModels.includes(customId)) {
        downloadedModels.push(customId);
        localStorage.setItem('downloaded_models', JSON.stringify(downloadedModels));
    }

    renderModelGrid();
    renderDownloadedGrid();
    updateModelDropdown();
    updateSystemInfo();
}

// Custom Model Upload Feature
let customModels = JSON.parse(localStorage.getItem('custom_models') || '[]');

function showUploadModal(type = 'text') {
    currentUploadType = type;
    setUploadModalContent(type);
    document.getElementById('custom-model-name').value = '';
    document.getElementById('selected-file-name').textContent = 'No file selected';
    document.getElementById('import-btn').disabled = true;
    selectedFilePath = null;
    const modal = document.getElementById('upload-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function showUploadModalWithFile(filePath, type = currentUploadType) {
    showUploadModal(type);
    applyUploadSelection(filePath, type);
    updateImportButton();
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    selectedFilePath = null;
    currentUploadType = 'text';
}

async function browseModelFile() {
    let filePath = null;
    if (currentUploadType === 'stt') {
        filePath = await window.electronAPI.selectSTTModelFile();
    } else if (currentUploadType === 'tts') {
        filePath = await window.electronAPI.selectTTSModelFiles();
    } else {
        filePath = await window.electronAPI.selectModelFile();
    }
    if (filePath) {
        showUploadModalWithFile(filePath, currentUploadType);
    }
}

function updateImportButton() {
    const name = document.getElementById('custom-model-name').value.trim();
    const hasSelection = Array.isArray(selectedFilePath) ? selectedFilePath.length > 0 : !!selectedFilePath;
    document.getElementById('import-btn').disabled = !name || !hasSelection;
}

// Add event listener for name input
document.getElementById('custom-model-name')?.addEventListener('input', updateImportButton);

async function importCustomModel() {
    const modelName = document.getElementById('custom-model-name').value.trim();
    if (!modelName || !selectedFilePath) return;

    document.getElementById('import-btn').disabled = true;
    document.getElementById('import-btn').textContent = 'Importing...';

    try {
        let result;
        if (currentUploadType === 'stt') {
            result = await window.electronAPI.importCustomSTTModel({
                sourcePath: selectedFilePath,
                modelName
            });
            if (result.success) {
                await registerCustomSTTModel(modelName, result);
            }
        } else if (currentUploadType === 'tts') {
            const onnx = selectedFilePath.find(file => file.endsWith('.onnx'));
            const json = selectedFilePath.find(file => file.endsWith('.onnx.json') || file.endsWith('.json'));
            if (!onnx || !json) {
                showNotification('Please select both the .onnx model file and the .json config file.', 'error');
                return;
            }
            result = await window.electronAPI.importCustomTTSModel({
                sourcePath: onnx,
                jsonPath: json,
                modelName
            });
            if (result.success) {
                await registerCustomTTSModel(modelName, result);
            }
        } else {
            result = await window.electronAPI.importCustomModel({
                sourcePath: selectedFilePath,
                modelName
            });
            if (result.success) {
                registerCustomTextModel(modelName, result);
            }
        }

        if (result?.success) {
            closeUploadModal();
            celebrateImportSuccess('Model imported successfully!');
        } else if (result) {
            showNotification('Import failed: ' + result.error, 'error');
        }
    } finally {
        document.getElementById('import-btn').disabled = false;
        document.getElementById('import-btn').textContent = 'Import';
    }
}

// Override to include custom models
function getAllModels() {
    return [...MODEL_CATALOG['8gb'], ...MODEL_CATALOG['16gb'], ...customModels];
}

// Drag and drop support for upload zones
function setupUploadZones() {
    const zones = [
        document.getElementById('upload-zone-models'),
        document.getElementById('upload-zone-downloaded')
    ].filter(Boolean);
    zones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.gguf')) {
                    showUploadModalWithFile(file.path);
                } else {
                    showNotification('Only .gguf files are supported!', 'error');
                }
            }
        });
    });
}

// Initialize upload zones after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUploadZones);
} else {
    setupUploadZones();
}

// ==========================================
// STT and TTS Features
// ==========================================

// STT/TTS functions (now loaded as SPA, no separate pages)

// --- STT Models Page ---
let downloadedSTTModels = JSON.parse(localStorage.getItem('downloaded_stt_models') || '[]');
let customSTTModels = JSON.parse(localStorage.getItem('custom_stt_models') || '[]');

function getAllSTTModels() {
    return [...(typeof STT_MODELS !== 'undefined' ? STT_MODELS : []), ...customSTTModels];
}

function initSTTModelsPage() {
    renderSTTModels();
    const sttUploadBtn = document.getElementById('stt-upload-btn');
    const sttUploadZone = document.getElementById('stt-upload-zone');
    const sttCancelBtn = document.getElementById('stt-cancel-download-btn');
    const sttInput = document.createElement('input');
    sttInput.type = 'file';
    sttInput.accept = '.bin';
    sttInput.style.display = 'none';
    document.body.appendChild(sttInput);
    
    const importSTTModel = async (filePath) => {
        if (!window.electronAPI) { showNotification('Runs locally only', 'error'); return; }
        if (filePath) {
            const name = document.getElementById('stt-upload-label')?.value.trim() || 'Custom STT Model';
            try {
                const m = await window.electronAPI.importCustomSTTModel({ sourcePath: filePath, modelName: name });
                if (m.success) {
                    const id = 'custom-stt-' + Date.now();
                    customSTTModels.push({ id, name, size: m.size, filename: m.filename, isCustom: true });
                    localStorage.setItem('custom_stt_models', JSON.stringify(customSTTModels));
                    if (!downloadedSTTModels.includes(id)) downloadedSTTModels.push(id);
                    localStorage.setItem('downloaded_stt_models', JSON.stringify(downloadedSTTModels));
                    renderSTTModels();
                    refreshSTTInferenceModels();
                    updateSystemInfo();
                    celebrateImportSuccess('Custom STT model imported!');
                } else {
                    showNotification('Import failed: ' + m.error, 'error');
                }
            } catch(err) { showNotification('Import failed: ' + err.message, 'error'); }
        }
    };

    sttInput.onchange = async (e) => {
        const filePath = await resolveElectronFilePath(e.target.files[0]);
        sttInput.value = '';
        await importSTTModel(filePath);
    };

    const triggerSTTBrowse = () => {
        showUploadModal('stt');
    };

    if (sttUploadBtn) {
        sttUploadBtn.removeAttribute('onclick');
        sttUploadBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerSTTBrowse();
        };
    }
    
    // Clicking anywhere on the upload zone also opens browse
    if (sttUploadZone) {
        sttUploadZone.onclick = (e) => {
            // Don't trigger if user clicked the text input or button
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            triggerSTTBrowse();
        };
    }

    if (sttCancelBtn) {
        sttCancelBtn.onclick = () => window.electronAPI.cancelDownload();
    }
}

function renderSTTModels() {
    const localGrid = document.getElementById('stt-local-models');
    const catalogGrid = document.getElementById('stt-catalog');
    if (!localGrid || !catalogGrid) return;
    
    localGrid.innerHTML = '';
    catalogGrid.innerHTML = '';
    
    const all = getAllSTTModels();
    const speechCards = all.map(model => ({
        model,
        isDownloaded: downloadedSTTModels.includes(model.id),
        html: buildSpeechModelCard(model, downloadedSTTModels.includes(model.id), 'stt')
    }));
    localGrid.innerHTML = speechCards.filter(entry => entry.isDownloaded).map(entry => entry.html).join('');
    catalogGrid.innerHTML = speechCards.filter(entry => !entry.isDownloaded && !entry.model.isCustom).map(entry => entry.html).join('');
    lucide.createIcons();
    return;
    
    all.forEach(m => {
        const isDownloaded = downloadedSTTModels.includes(m.id);
        const cardHtml = `
            <div class="model-card ${isDownloaded ? 'downloaded' : ''}">
                <div class="model-card-header">
                    <h3>🎙 ${m.name}</h3>
                </div>
                <p class="model-card-desc">${m.description || ''}</p>
                <div class="model-card-meta"><span>📦 ${m.size}</span></div>
                <div class="model-card-actions">
                    ${isDownloaded ? 
                        `<button class="btn-del" onclick="deleteSTTModel('${m.id}')"><i data-lucide="trash-2"></i> Delete</button>` : 
                        `<button class="btn-download" onclick="downloadSTTModel('${m.id}')">Download</button>`
                    }
                </div>
            </div>
        `;
        if (isDownloaded) localGrid.innerHTML += cardHtml;
        else if (!m.isCustom) catalogGrid.innerHTML += cardHtml;
    });
    lucide.createIcons();
}

async function downloadSTTModel(id) {
    const m = getAllSTTModels().find(x => x.id === id);
    if (!m) return;
    activeModelDownloadType = 'stt';
    activeModelDownloadId = id;
    document.getElementById('stt-download-progress').style.display = 'block';
    const fill = document.getElementById('stt-progress-fill');
    const percentText = document.getElementById('stt-progress-text');
    const statsText = document.getElementById('stt-progress-stats');

    const stopProgress = window.electronAPI.onDownloadProgress((payload) => {
        const { type, id: completedId } = payload;
        if (type !== 'stt' || completedId !== id) return;
        setDownloadBarState(fill, percentText, statsText, payload);
    });
    const stopComplete = window.electronAPI.onDownloadComplete(({ type, id: completedId }) => {
        if (type !== 'stt' || completedId !== id) return;
        document.getElementById('stt-download-progress').style.display = 'none';
        activeModelDownloadId = null;
        fill.style.width = '100%';
        if (!downloadedSTTModels.includes(id)) downloadedSTTModels.push(id);
        localStorage.setItem('downloaded_stt_models', JSON.stringify(downloadedSTTModels));
        renderSTTModels();
        refreshSTTInferenceModels();
        updateSystemInfo();
        showNotification('STT download complete', 'success');
        stopProgress();
        stopComplete();
        stopCancelled();
    });
    const stopCancelled = window.electronAPI.onDownloadCancelled(({ type, id: cancelledId }) => {
        if (type !== 'stt' || cancelledId !== id) return;
        activeModelDownloadId = null;
        document.getElementById('stt-download-progress').style.display = 'none';
        fill.style.width = '0%';
        if (percentText) percentText.textContent = '0%';
        if (statsText) statsText.textContent = '';
        showNotification('STT download canceled', 'info');
        stopProgress();
        stopComplete();
        stopCancelled();
    });
    
    try {
        await window.electronAPI.downloadSTTModel({ id, url: m.url, filename: m.filename });
    } catch (e) {
        activeModelDownloadId = null;
        stopProgress();
        stopComplete();
        stopCancelled();
        document.getElementById('stt-download-progress').style.display = 'none';
        if (percentText) percentText.textContent = '0%';
        if (statsText) statsText.textContent = '';
        if (e.message !== 'Download canceled') {
            showNotification('Download failed: ' + e.message, 'error');
        }
    }
}

// Globals needed for click events
window.downloadSTTModel = downloadSTTModel;
window.deleteSTTModel = async function(id) {
    const m = getAllSTTModels().find(x => x.id === id);
    if (!m) return;
    try {
        await window.electronAPI.deleteSTTModel(m.filename);
        downloadedSTTModels = downloadedSTTModels.filter(x => x !== id);
        localStorage.setItem('downloaded_stt_models', JSON.stringify(downloadedSTTModels));
        if (m.isCustom) {
            customSTTModels = customSTTModels.filter(x => x.id !== id);
            localStorage.setItem('custom_stt_models', JSON.stringify(customSTTModels));
        }
        renderSTTModels();
        refreshSTTInferenceModels();
        updateSystemInfo();
        showNotification('Model deleted', 'success');
    } catch(e) { showNotification('Delete failed', 'error'); }
};

// --- TTS Models Page ---
let downloadedTTSModels = JSON.parse(localStorage.getItem('downloaded_tts_models') || '[]');
let customTTSModels = JSON.parse(localStorage.getItem('custom_tts_models') || '[]');

function getAllTTSModels() {
    return [...(typeof TTS_MODELS !== 'undefined' ? TTS_MODELS : []), ...customTTSModels];
}

function initTTSModelsPage() {
    renderTTSModels();
    const ttsUploadBtn = document.getElementById('tts-upload-btn');
    const ttsUploadZone = document.getElementById('tts-upload-zone');
    const ttsCancelBtn = document.getElementById('tts-cancel-download-btn');
    const ttsInput = document.createElement('input');
    ttsInput.type = 'file';
    ttsInput.accept = '.onnx,.json';
    ttsInput.multiple = true;
    ttsInput.style.display = 'none';
    document.body.appendChild(ttsInput);
    
    const importTTSModel = async (paths) => {
        if (!window.electronAPI) { showNotification('Runs locally only', 'error'); return; }
        if (paths && paths.length >= 2) {
            const onnx = paths.find(p => p.endsWith('.onnx'));
            const json = paths.find(p => p.endsWith('.onnx.json') || p.endsWith('.json'));
            if (!onnx || !json) {
                showNotification('⚠️ Both .onnx and .json files are required. Please select both files.', 'error');
                return;
            }
            const name = document.getElementById('tts-upload-label')?.value.trim() || 'Custom TTS Model';
            try {
                const m = await window.electronAPI.importCustomTTSModel({ sourcePath: onnx, jsonPath: json, modelName: name });
                if (m.success) {
                    const id = 'custom-tts-' + Date.now();
                    customTTSModels.push({ id, name, size: m.size, filename: m.filename, isCustom: true });
                    localStorage.setItem('custom_tts_models', JSON.stringify(customTTSModels));
                    if (!downloadedTTSModels.includes(id)) downloadedTTSModels.push(id);
                    localStorage.setItem('downloaded_tts_models', JSON.stringify(downloadedTTSModels));
                    renderTTSModels();
                    refreshTTSInferenceModels();
                    updateSystemInfo();
                    celebrateImportSuccess('Custom TTS model imported!');
                } else {
                    showNotification('Import failed: ' + m.error, 'error');
                }
            } catch(err) { showNotification('Import failed: ' + err.message, 'error'); }
        } else if (paths && paths.length === 1) {
            const file = paths[0];
            if (file.endsWith('.onnx')) {
                showNotification('⚠️ Missing .json config file! TTS models require BOTH the .onnx model file AND the .onnx.json config file. Please select both.', 'error');
            } else if (file.endsWith('.json')) {
                showNotification('⚠️ Missing .onnx model file! TTS models require BOTH the .onnx model file AND the .onnx.json config file. Please select both.', 'error');
            } else {
                showNotification('⚠️ Invalid file type. TTS models require a .onnx model file and a .json config file.', 'error');
            }
        }
    };

    ttsInput.onchange = async (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        const resolvedPaths = [];
        for (const file of selectedFiles) {
            const filePath = await resolveElectronFilePath(file);
            if (filePath) resolvedPaths.push(filePath);
        }
        ttsInput.value = '';
        await importTTSModel(resolvedPaths);
    };

    const triggerTTSBrowse = () => {
        showUploadModal('tts');
    };

    if (ttsUploadBtn) {
        ttsUploadBtn.removeAttribute('onclick');
        ttsUploadBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerTTSBrowse();
        };
    }
    
    // Clicking anywhere on the upload zone also opens browse
    if (ttsUploadZone) {
        ttsUploadZone.onclick = (e) => {
            // Don't trigger if user clicked the text input or button
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            triggerTTSBrowse();
        };
    }

    if (ttsCancelBtn) {
        ttsCancelBtn.onclick = () => window.electronAPI.cancelDownload();
    }
}

function renderTTSModels() {
    const localGrid = document.getElementById('tts-local-models');
    const catalogGrid = document.getElementById('tts-catalog');
    if (!localGrid || !catalogGrid) return;
    
    localGrid.innerHTML = '';
    catalogGrid.innerHTML = '';
    
    const all = getAllTTSModels();
    const speechCards = all.map(model => ({
        model,
        isDownloaded: downloadedTTSModels.includes(model.id),
        html: buildSpeechModelCard(model, downloadedTTSModels.includes(model.id), 'tts')
    }));
    localGrid.innerHTML = speechCards.filter(entry => entry.isDownloaded).map(entry => entry.html).join('');
    catalogGrid.innerHTML = speechCards.filter(entry => !entry.isDownloaded && !entry.model.isCustom).map(entry => entry.html).join('');
    lucide.createIcons();
    return;
    
    all.forEach(m => {
        const isDownloaded = downloadedTTSModels.includes(m.id);
        const cardHtml = `
            <div class="model-card ${isDownloaded ? 'downloaded' : ''}">
                <div class="model-card-header">
                    <h3>🔊 ${m.name}</h3>
                </div>
                <p class="model-card-desc">${m.description || ''}</p>
                <div class="model-card-meta"><span>📦 ${m.size}</span></div>
                <div class="model-card-actions">
                    ${isDownloaded ? 
                        `<button class="btn-del" onclick="deleteTTSModel('${m.id}')"><i data-lucide="trash-2"></i> Delete</button>` : 
                        `<button class="btn-download" onclick="downloadTTSModel('${m.id}')">Download</button>`
                    }
                </div>
            </div>
        `;
        if (isDownloaded) localGrid.innerHTML += cardHtml;
        else if (!m.isCustom) catalogGrid.innerHTML += cardHtml;
    });
    lucide.createIcons();
}

async function downloadTTSModel(id) {
    const m = getAllTTSModels().find(x => x.id === id);
    if (!m) return;
    activeModelDownloadType = 'tts';
    activeModelDownloadId = id;
    document.getElementById('tts-download-progress').style.display = 'block';
    const fill = document.getElementById('tts-progress-fill');
    const percentText = document.getElementById('tts-progress-text');
    const statsText = document.getElementById('tts-progress-stats');

    const stopProgress = window.electronAPI.onDownloadProgress((payload) => {
        const { type, id: completedId } = payload;
        if (type !== 'tts' || completedId !== id) return;
        setDownloadBarState(fill, percentText, statsText, payload);
    });
    const stopComplete = window.electronAPI.onDownloadComplete(({ type, id: completedId }) => {
        if (type !== 'tts' || completedId !== id) return;
        document.getElementById('tts-download-progress').style.display = 'none';
        activeModelDownloadId = null;
        fill.style.width = '100%';
        if (!downloadedTTSModels.includes(id)) downloadedTTSModels.push(id);
        localStorage.setItem('downloaded_tts_models', JSON.stringify(downloadedTTSModels));
        renderTTSModels();
        refreshTTSInferenceModels();
        updateSystemInfo();
        showNotification('TTS download complete', 'success');
        stopProgress();
        stopComplete();
        stopCancelled();
    });
    const stopCancelled = window.electronAPI.onDownloadCancelled(({ type, id: cancelledId }) => {
        if (type !== 'tts' || cancelledId !== id) return;
        activeModelDownloadId = null;
        document.getElementById('tts-download-progress').style.display = 'none';
        fill.style.width = '0%';
        if (percentText) percentText.textContent = '0%';
        if (statsText) statsText.textContent = '';
        showNotification('TTS download canceled', 'info');
        stopProgress();
        stopComplete();
        stopCancelled();
    });
    
    try {
        await window.electronAPI.downloadTTSModel({ id, url: m.url, jsonUrl: m.jsonUrl, filename: m.filename });
    } catch (e) {
        activeModelDownloadId = null;
        stopProgress();
        stopComplete();
        stopCancelled();
        document.getElementById('tts-download-progress').style.display = 'none';
        if (percentText) percentText.textContent = '0%';
        if (statsText) statsText.textContent = '';
        if (e.message !== 'Download canceled') {
            showNotification('Download failed: ' + e.message, 'error');
        }
    }
}

window.downloadTTSModel = downloadTTSModel;
window.deleteTTSModel = async function(id) {
    const m = getAllTTSModels().find(x => x.id === id);
    if (!m) return;
    try {
        await window.electronAPI.deleteTTSModel(m.filename);
        downloadedTTSModels = downloadedTTSModels.filter(x => x !== id);
        localStorage.setItem('downloaded_tts_models', JSON.stringify(downloadedTTSModels));
        if (m.isCustom) {
            customTTSModels = customTTSModels.filter(x => x.id !== id);
            localStorage.setItem('custom_tts_models', JSON.stringify(customTTSModels));
        }
        renderTTSModels();
        refreshTTSInferenceModels();
        updateSystemInfo();
        showNotification('Model deleted', 'success');
    } catch(e) { showNotification('Delete failed', 'error'); }
};

// --- STT Inference Page ---
let sttAudioPath = null;
function initSTTInferencePage() {
    const select = document.getElementById('stt-model-select');
    const lang = document.getElementById('stt-language-select');
    const runBtn = document.getElementById('stt-run-file-btn') || document.getElementById('stt-transcribe-btn');
    const result = document.getElementById('stt-result') || document.getElementById('stt-output');
    const fileName = document.getElementById('stt-file-name') || document.getElementById('audio-filename');
    const audioPlayer = document.getElementById('stt-audio-player');
    const playerSection = document.getElementById('stt-audio-player-section') || document.getElementById('audio-preview-container');
    const audioInput = document.getElementById('stt-audio-file');
    const statusEl = document.getElementById('stt-status');
    if (!select || !runBtn || !result) return;
    
    const setResultText = (text) => {
        if ('value' in result) {
            result.value = text;
        } else {
            result.innerHTML = text
                ? `<div style="white-space: pre-wrap;">${escapeHtml(text)}</div>`
                : '<div class="empty-state">Transcription will appear here...</div>';
        }
    };

    const setSelectedAudio = async (file) => {
        if (!file) return;
        sttAudioPath = await resolveElectronFilePath(file);
        if (!sttAudioPath) {
            showNotification('Unable to read local audio file path. Please try again.', 'error');
            return;
        }
        if (fileName) fileName.textContent = file.name;
        runBtn.disabled = false;
        if (audioPlayer) audioPlayer.src = URL.createObjectURL(file);
        if (playerSection) playerSection.style.display = 'flex';
    };

    function popModels() {
        select.innerHTML = '<option value="">-- Select STT Model --</option>';
        downloadedSTTModels.forEach(id => {
            const m = getAllSTTModels().find(x => x.id === id);
            if (m) select.innerHTML += `<option value="${m.filename}">${m.name}</option>`;
        });
    }
    refreshSTTInferenceModels = popModels;
    popModels();
    document.getElementById('stt-model-refresh-btn')?.addEventListener('click', popModels);
    
    document.getElementById('stt-select-file-btn')?.addEventListener('click', async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.wav,.mp3,.m4a,.ogg';
        input.onchange = async (e) => setSelectedAudio(e.target.files[0]);
        input.click();
    });

    if (audioInput) {
        audioInput.onchange = async (e) => setSelectedAudio(e.target.files[0]);
    }

    document.getElementById('stt-mic-btn')?.addEventListener('click', () => {
        showNotification('Mic recording not natively supported in app yet. Please select an audio file.', 'info');
    });
    
    document.getElementById('stt-copy-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(('value' in result ? result.value : result.textContent) || '');
        showNotification('Copied!', 'success');
    });
    
    const executeSTT = async () => {
        if (!select.value) { showNotification('Select a model first', 'error'); return; }
        if (!sttAudioPath) { showNotification('Select an audio file', 'error'); return; }
        
        runBtn.disabled = true;
        runBtn.textContent = 'Transcribing...';
        if (statusEl) statusEl.textContent = 'Running Whisper...';
        setResultText('');
        
        try {
            const text = await window.electronAPI.runSTT(select.value, sttAudioPath, lang ? lang.value : 'auto');
            const cleanedText = typeof text === 'string' ? text.trim() : '';
            setResultText(cleanedText || 'No speech detected in the selected audio.');
            if (statusEl) statusEl.textContent = cleanedText ? 'Done!' : 'No speech detected.';
        } catch (e) {
            if (statusEl) statusEl.textContent = 'Error: ' + e.message;
            showNotification('Transcription failed', 'error');
        }
        
        runBtn.disabled = false;
        runBtn.textContent = 'Transcribe Audio';
    };
    runBtn.onclick = executeSTT;
    window.runSTT = executeSTT;
    window.handleAudioUpload = async (event) => setSelectedAudio(event.target.files[0]);
}

// --- TTS Inference Page ---
function initTTSInferencePage() {
    const select = document.getElementById('tts-model-select');
    const input = document.getElementById('tts-input') || document.getElementById('tts-text-input');
    const sendBtn = document.getElementById('tts-speak-btn') || document.getElementById('tts-generate-btn');
    const messages = document.getElementById('tts-chat-messages') || document.getElementById('tts-chat-history');
    if (!select || !input || !sendBtn || !messages) return;
    
    function popModels() {
        select.innerHTML = '<option value="">-- Select TTS Model --</option>';
        downloadedTTSModels.forEach(id => {
            const m = getAllTTSModels().find(x => x.id === id);
            if (m) select.innerHTML += `<option value="${m.filename}">${m.name}</option>`;
        });
    }
    refreshTTSInferenceModels = popModels;
    popModels();
    document.getElementById('tts-model-refresh-btn')?.addEventListener('click', popModels);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeTTS();
        }
    });
    
    const executeTTS = async () => {
        const text = input.value.trim();
        if (!text) return;
        if (!select.value) { showNotification('Select a model first', 'error'); return; }
        
        ensureTTSConversationStarted(messages);
        messages.innerHTML += `<div class="tts-message user-msg"><div class="tts-msg-bubble">${escapeHtml(text)}</div></div>`;
        input.value = '';
        
        const loadId = 'tts-load-' + Date.now();
        messages.innerHTML += `<div class="tts-message ai-msg" id="${loadId}"><div class="tts-msg-bubble">Generating audio...</div></div>`;
        messages.scrollTop = messages.scrollHeight;
        
        try {
            const audioPath = await window.electronAPI.runTTS(select.value, text);
            const doc = document.getElementById(loadId);
            if (doc) {
                const transcriptModel = getTranscriptSTTModel();
                const fileUrl = encodeURI(`file:///${audioPath.replace(/\\/g, '/')}`);
                doc.innerHTML = `
                    <div class="tts-audio-result">
                        <div class="tts-audio-topline">
                            <span class="tts-audio-badge">Generated Audio</span>
                            <button class="tts-play-btn" type="button" data-role="play-audio">Play</button>
                        </div>
                        <div class="waveform-container tts-waveform-shell">
                            <div class="waveform-label">Voice Preview</div>
                            <div class="waveform-bars" data-role="wave-bars"></div>
                        </div>
                        <div class="tts-audio-footer">
                            <span class="tts-audio-time" data-role="audio-time">0:00 / 0:00</span>
                            <a href="${fileUrl}" download class="tts-download-link">Download audio</a>
                        </div>
                        <div class="tts-transcript-block">
                            <div class="tts-transcript-label">Speech Text Preview</div>
                            <div class="tts-transcript-text" data-role="tts-transcript">${transcriptModel ? 'Checking the generated speech text locally...' : 'Download at least one STT model to preview the generated speech text here.'}</div>
                        </div>
                        <audio preload="metadata" src="${fileUrl}"></audio>
                    </div>`;
                initializeTTSAudioCard(doc, `${text}-${audioPath}`);
                if (transcriptModel) {
                    const transcriptEl = doc.querySelector('[data-role="tts-transcript"]');
                    try {
                        const transcript = await window.electronAPI.runSTT(transcriptModel.filename, audioPath, 'auto');
                        const cleanedTranscript = typeof transcript === 'string' ? transcript.trim() : '';
                        if (transcriptEl) transcriptEl.textContent = cleanedTranscript || 'No speech detected in the generated audio.';
                    } catch (transcriptError) {
                        if (transcriptEl) transcriptEl.textContent = `Transcription failed: ${transcriptError.message}`;
                    }
                }
            }
        } catch (e) {
            const doc = document.getElementById(loadId);
            if (doc) doc.innerHTML = `<div class="tts-msg-bubble" style="color:var(--danger)">Error: ${e.message}</div>`;
        }
        messages.scrollTop = messages.scrollHeight;
    };
    sendBtn.onclick = executeTTS;
    window.runTTS = executeTTS;
}
