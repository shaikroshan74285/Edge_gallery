/**
 * RemiAI Edge Gallery - Preload Script
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onDownloadProgress: (callback) => {
        const listener = (e, payload) => callback(payload);
        ipcRenderer.on('download-progress', listener);
        return () => ipcRenderer.removeListener('download-progress', listener);
    },
    onDownloadComplete: (callback) => {
        const listener = (e, payload) => callback(payload);
        ipcRenderer.on('download-complete', listener);
        return () => ipcRenderer.removeListener('download-complete', listener);
    },
    onDownloadCancelled: (callback) => {
        const listener = (e, payload) => callback(payload);
        ipcRenderer.on('download-cancelled', listener);
        return () => ipcRenderer.removeListener('download-cancelled', listener);
    },

    // System
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    getFilePath: (file) => {
        try {
            return file ? webUtils.getPathForFile(file) : '';
        } catch {
            return '';
        }
    },

    // Model Management
    switchModel: (filename, contextSize) => ipcRenderer.invoke('switch-model', filename, contextSize),
    downloadModel: (data) => ipcRenderer.invoke('download-model', data),
    cancelDownload: () => ipcRenderer.invoke('cancel-download'),
    deleteModel: (filename) => ipcRenderer.invoke('delete-model', filename),
    checkModel: (filename) => ipcRenderer.invoke('check-model', filename),

    // Custom Model Upload
    selectModelFile: () => ipcRenderer.invoke('select-model-file'),
    importCustomModel: (data) => ipcRenderer.invoke('import-custom-model', data),

    // Storage Directory
    selectModelsDir: () => ipcRenderer.invoke('select-models-dir'),
    getModelsDir: () => ipcRenderer.invoke('get-models-dir'),

    // Events
    onModelReady: (callback) => ipcRenderer.on('model-ready', () => callback()),
    onEngineError: (callback) => ipcRenderer.on('engine-error', (e, msg) => callback(msg)),

    // STT Management
    downloadSTTModel: (data) => ipcRenderer.invoke('download-stt-model', data),
    deleteSTTModel: (filename) => ipcRenderer.invoke('delete-stt-model', filename),
    checkSTTModel: (filename) => ipcRenderer.invoke('check-stt-model', filename),
    importCustomSTTModel: (data) => ipcRenderer.invoke('import-custom-stt-model', data),
    selectSTTModelFile: () => ipcRenderer.invoke('select-stt-model-file'),
    runSTT: (model, audioPath, language) => ipcRenderer.invoke('run-stt', { model, audioPath, language }),

    // TTS Management
    downloadTTSModel: (data) => ipcRenderer.invoke('download-tts-model', data),
    deleteTTSModel: (filename) => ipcRenderer.invoke('delete-tts-model', filename),
    checkTTSModel: (filename) => ipcRenderer.invoke('check-tts-model', filename),
    importCustomTTSModel: (data) => ipcRenderer.invoke('import-custom-tts-model', data),
    selectTTSModelFiles: () => ipcRenderer.invoke('select-tts-model-files'),
    runTTS: (model, text) => ipcRenderer.invoke('run-tts', { model, text }),
    
    // Engine Management
    offloadEngine: (category) => ipcRenderer.invoke('offload-engine', category)
});
