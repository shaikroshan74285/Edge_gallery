/**
 * RemiAI Edge Gallery - Main Process
 * Uses bujji_engine as persistent HTTP server (like the working old app)
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn, exec, execSync } = require('child_process');
const os = require('os');

let mainWindow;
let apiProcess;
let currentDownload = null;
let windowDestroyed = false;
let isModelLoading = false;
let modelsDir; // Will be set after app is ready

function clearCurrentDownload(downloadState) {
    if (!downloadState || currentDownload === downloadState) {
        currentDownload = null;
    }
}

function safeUnlink(filePath) {
    if (!filePath) return;
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Failed to delete partial download:', filePath, err.message);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForWhisperServer(port, attempts = 80, delayMs = 500) {
    return new Promise((resolve, reject) => {
        let remaining = attempts;

        const tryConnect = () => {
            const req = http.request({
                hostname: '127.0.0.1',
                port,
                path: '/',
                method: 'GET',
                timeout: 800
            }, res => {
                res.resume();
                resolve();
            });

            req.on('error', async () => {
                remaining -= 1;
                if (remaining <= 0) {
                    reject(new Error('Whisper server did not start in time'));
                    return;
                }
                await delay(delayMs);
                tryConnect();
            });

            req.on('timeout', async () => {
                req.destroy();
                remaining -= 1;
                if (remaining <= 0) {
                    reject(new Error('Whisper server startup timed out'));
                    return;
                }
                await delay(delayMs);
                tryConnect();
            });

            req.end();
        };

        tryConnect();
    });
}

// Forward main-process log messages to renderer DevTools console
function sttLog(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.log(msg);
    safeSend('stt-log', msg);
}

function isValidWavFile(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(44);
        fs.readSync(fd, buf, 0, 44, 0);
        fs.closeSync(fd);
        if (buf.toString('ascii', 0, 4) !== 'RIFF') return false;
        if (buf.toString('ascii', 8, 12) !== 'WAVE') return false;
        const sampleRate = buf.readUInt32LE(24);
        const channels = buf.readUInt16LE(22);
        return { valid: true, sampleRate, channels };
    } catch { return false; }
}

function convertToWav16k(audioPath, basePath) {
    return new Promise((resolve) => {
        const engineDir = path.join(basePath, 'engine', 'cpu_avx2');
        const ffmpegExe = path.join(engineDir, 'ffmpeg.exe');
        if (!fs.existsSync(ffmpegExe)) {
            sttLog('[FFmpeg] ffmpeg.exe not found at', ffmpegExe, '- skipping pre-conversion');
            resolve({ convertedPath: audioPath, tempFile: null, preConverted: false });
            return;
        }

        const tempWav = path.join(app.getPath('temp'), `stt_converted_${Date.now()}.wav`);
        const args = [
            '-y', '-i', audioPath,
            '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav',
            tempWav
        ];

        sttLog('[FFmpeg] Converting:', audioPath, '->', tempWav);
        const proc = spawn(ffmpegExe, args, {
            windowsHide: true,
            cwd: engineDir
        });

        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', code => {
            if (code === 0 && fs.existsSync(tempWav)) {
                const stats = fs.statSync(tempWav);
                const wavInfo = isValidWavFile(tempWav);
                sttLog('[FFmpeg] OK, size:', stats.size, 'bytes, wav:', JSON.stringify(wavInfo));
                if (wavInfo && wavInfo.valid && stats.size > 100) {
                    resolve({ convertedPath: tempWav, tempFile: tempWav, preConverted: true });
                } else {
                    sttLog('[FFmpeg] WARNING: output WAV is invalid or too small, using original');
                    safeDeleteTempFile(tempWav);
                    resolve({ convertedPath: audioPath, tempFile: null, preConverted: false });
                }
            } else {
                sttLog('[FFmpeg] FAILED code', code, ':', stderr.slice(0, 300));
                resolve({ convertedPath: audioPath, tempFile: null, preConverted: false });
            }
        });

        proc.on('error', err => {
            sttLog('[FFmpeg] Spawn error:', err.message);
            resolve({ convertedPath: audioPath, tempFile: null, preConverted: false });
        });
    });
}

function safeDeleteTempFile(filePath) {
    if (!filePath) return;
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
        console.error('[Cleanup] Failed to delete temp file:', filePath, err.message);
    }
}

function transcribeWithWhisperServer(port, audioPath) {
    return new Promise((resolve, reject) => {
        const boundary = `----RemiAIWhisper${Date.now()}`;
        const fileBuffer = fs.readFileSync(audioPath);
        const fileName = path.basename(audioPath);
        const header = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const payload = Buffer.concat([header, fileBuffer, footer]);

        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/inference',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length
            },
            timeout: 120000
        }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`Whisper server returned HTTP ${res.statusCode}: ${body}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(body);
                    resolve((parsed.text || '').trim());
                } catch {
                    resolve(body.trim());
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Whisper transcription request timed out')));
        req.write(payload);
        req.end();
    });
}

function resolveDownloadUrl(rawUrl, baseUrl) {
    try {
        return new URL(rawUrl, baseUrl).toString();
    } catch {
        throw new Error(`Invalid URL: ${rawUrl || 'missing download URL'}`);
    }
}

function createDownloadState(type, id, resolve, reject) {
    const state = {
        type,
        id,
        resolve,
        reject,
        request: null,
        response: null,
        fileStream: null,
        cleanupPaths: new Set(),
        settled: false,
        cancelled: false
    };

    state.finishSuccess = (value) => {
        if (state.settled) return;
        state.settled = true;
        clearCurrentDownload(state);
        resolve(value);
    };

    state.finishError = (err, shouldCleanup = true) => {
        if (state.settled) return;
        state.settled = true;
        clearCurrentDownload(state);
        if (shouldCleanup) {
            for (const filePath of state.cleanupPaths) safeUnlink(filePath);
        }
        reject(err);
    };

    state.cancel = () => {
        if (state.settled || state.cancelled) return;
        state.cancelled = true;
        try { state.request?.destroy(new Error('Download canceled')); } catch { }
        try { state.response?.destroy(new Error('Download canceled')); } catch { }
        try { state.fileStream?.destroy(new Error('Download canceled')); } catch { }
        safeSend('download-cancelled', { type: state.type, id: state.id });
        state.finishError(new Error('Download canceled'));
    };

    return state;
}

function downloadToFile(url, destPath, state, onProgress, redirectCount = 0) {
    if (redirectCount > 5) {
        state.finishError(new Error('Too many redirects'));
        return;
    }

    let finalUrl;
    try {
        finalUrl = resolveDownloadUrl(url);
    } catch (err) {
        state.finishError(err, false);
        return;
    }

    console.log('Downloading from:', finalUrl);
    state.cleanupPaths.add(destPath);
    const protocol = finalUrl.startsWith('https:') ? https : http;

    const request = protocol.get(finalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, response => {
        state.response = response;

        if ([301, 302, 307, 308].includes(response.statusCode)) {
            const location = response.headers.location;
            response.resume();
            try {
                const redirectUrl = resolveDownloadUrl(location, finalUrl);
                downloadToFile(redirectUrl, destPath, state, onProgress, redirectCount + 1);
            } catch (err) {
                state.finishError(err, false);
            }
            return;
        }

        if (response.statusCode !== 200) {
            response.resume();
            state.finishError(new Error(`HTTP ${response.statusCode}`));
            return;
        }

        const total = parseInt(response.headers['content-length'], 10) || 0;
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        state.fileStream = file;

        response.on('data', chunk => {
            if (state.cancelled || state.settled) return;
            downloaded += chunk.length;
            if (onProgress) {
                onProgress({
                    progress: total ? (downloaded / total) * 100 : 0,
                    downloadedBytes: downloaded,
                    totalBytes: total
                });
            }
        });

        response.on('error', err => {
            if (state.cancelled) return;
            state.finishError(err);
        });

        file.on('error', err => {
            if (state.cancelled) return;
            state.finishError(err);
        });

        file.on('finish', () => {
            file.close(err => {
                if (err) {
                    state.finishError(err);
                    return;
                }
                if (!state.cancelled && onProgress) {
                    onProgress({
                        progress: 100,
                        downloadedBytes: total || downloaded,
                        totalBytes: total
                    });
                }
                state.fileStream = null;
                if (typeof state.onStepComplete === 'function') {
                    state.onStepComplete();
                }
            });
        });

        response.pipe(file);
    });

    request.on('error', err => {
        if (state.cancelled) return;
        state.finishError(err);
    });

    state.request = request;
    currentDownload = state;
}

function getConfigPath() {
    return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch { }
    return {};
}

function saveConfig(config) {
    try {
        fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save config:', e);
    }
}

function initModelsDir(customDir) {
    if (customDir) {
        modelsDir = customDir;
    } else {
        const config = loadConfig();
        if (config.modelsDir && fs.existsSync(config.modelsDir)) {
            modelsDir = config.modelsDir;
        } else {
            // Default fallback
            modelsDir = path.join(app.getPath('userData'), 'models');
        }
    }
    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
    }
    console.log('Models directory:', modelsDir);
}

async function promptForModelsDir() {
    const config = loadConfig();
    // Only prompt on first launch (no saved modelsDir in config)
    if (config.modelsDir) {
        initModelsDir(config.modelsDir);
        return;
    }

    const defaultDir = path.join(app.getPath('userData'), 'models');
    const dialogOptions = {
        title: 'Select folder to store AI model weights',
        defaultPath: defaultDir,
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Use This Folder'
    };
    const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

    let chosenDir;
    if (result.canceled || result.filePaths.length === 0) {
        chosenDir = defaultDir;
    } else {
        chosenDir = result.filePaths[0];
    }

    config.modelsDir = chosenDir;
    saveConfig(config);
    initModelsDir(chosenDir);
}

function getDiskFree() {
    try {
        const drive = modelsDir.charAt(0).toUpperCase();
        // Use PowerShell instead of wmic (wmic is deprecated/removed in newer Windows)
        const output = execSync(
            `powershell -NoProfile -Command "(Get-PSDrive -Name '${drive}').Free"`,
            { encoding: 'utf8', timeout: 5000 }
        );
        const freeBytes = parseInt(output.trim());
        if (!isNaN(freeBytes) && freeBytes > 0) {
            return Math.round(freeBytes / 1073741824 * 10) / 10;
        }
    } catch (e) {
        console.error('Failed to get disk space:', e.message);
    }
    // Fallback: try Node.js fs.statfsSync if available (Node 18.15+)
    try {
        if (fs.statfsSync) {
            const stats = fs.statfsSync(modelsDir);
            return Math.round((stats.bavail * stats.bsize) / 1073741824 * 10) / 10;
        }
    } catch { }
    return -1; // Return -1 to indicate unknown (don't trigger false low-space warnings)
}

// Safe IPC send that checks if window is still valid
function safeSend(channel, data) {
    if (!windowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send(channel, data);
        } catch (e) {
            // Window was destroyed, ignore
        }
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'remiai.ico'),
        title: 'RemiAI Edge Gallery',
        autoHideMenuBar: true
    });
    mainWindow.loadFile('index.html');

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // Intercept same-window navigation (links without target="_blank")
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
}

function selectEngineDir() {
    // When packaged, extraResources are placed in process.resourcesPath
    // In dev mode, __dirname works fine
    const basePath = app.isPackaged ? process.resourcesPath : __dirname;

    const avx2Dir = path.join(basePath, 'engine', 'cpu_avx2');
    const avxDir = path.join(basePath, 'engine', 'cpu_avx');

    console.log('Engine base path:', basePath);
    console.log('Checking AVX2 dir:', avx2Dir);

    if (fs.existsSync(path.join(avx2Dir, 'bujji_engine.exe'))) return avx2Dir;
    if (fs.existsSync(avx2Dir)) return avx2Dir;
    return avxDir;
}

function findEngine(dir) {
    const names = ['bujji_engine.exe', 'llama-server.exe'];
    for (const name of names) {
        const p = path.join(dir, name);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function killEngine() {
    try {
        execSync('taskkill /IM bujji_engine.exe /F /T 2>nul', { stdio: 'ignore' });
        execSync('taskkill /IM llama-server.exe /F /T 2>nul', { stdio: 'ignore' });
    } catch { }
    if (apiProcess) {
        apiProcess.kill();
        apiProcess = null;
    }
}

// Start the AI engine server
async function startEngine(modelFilename, contextSize = 2048) {
    killEngine();
    isModelLoading = true;
    await new Promise(resolve => setTimeout(resolve, 500));

    const engineDir = selectEngineDir();
    const enginePath = findEngine(engineDir);

    if (!enginePath) {
        console.error('No engine found in:', engineDir);
        isModelLoading = false;
        safeSend('engine-error', 'No engine found');
        return;
    }

    const modelPath = path.join(modelsDir, modelFilename);
    if (!fs.existsSync(modelPath)) {
        console.error('Model not found:', modelPath);
        isModelLoading = false;
        safeSend('engine-error', 'Model file not found');
        return;
    }

    // Use user-configured context size
    const ctx = Math.max(512, Math.min(contextSize, 8192));
    const threads = Math.min(4, os.cpus().length - 1);
    const args = [
        '-m', modelPath,
        '-c', ctx.toString(),
        '--batch-size', '512',
        '--port', '5000',
        '-t', threads.toString(),
        '--n-gpu-layers', '0',
        '--no-mmap'
    ];

    console.log('Starting engine:', enginePath);
    console.log('Model:', modelFilename);
    console.log('Args:', args.join(' '));

    try {
        apiProcess = spawn(enginePath, args, {
            cwd: engineDir,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        apiProcess.stdout.on('data', d => console.log('[Engine]', d.toString().slice(0, 200)));
        apiProcess.stderr.on('data', d => console.log('[Engine ERR]', d.toString().slice(0, 200)));
        apiProcess.on('error', err => {
            console.error('[Engine SPAWN ERROR]', err);
            // Only show error if not in loading phase (larger models take time)
            if (!isModelLoading) {
                safeSend('engine-error', err.message);
            }
        });
        apiProcess.on('exit', (code, signal) => {
            console.log('[Engine EXIT] code:', code, 'signal:', signal);
            // Only show exit error if not in loading phase and engine actually failed
            if (code !== 0 && !isModelLoading) {
                safeSend('engine-error', `Engine exited with code ${code}`);
            }
        });

        // Check when engine is ready
        let attempts = 0;
        const checkReady = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch('http://127.0.0.1:5000/health');
                if (res.ok) {
                    clearInterval(checkReady);
                    isModelLoading = false;
                    console.log('[Engine] Ready after', attempts, 'seconds!');
                    safeSend('model-ready');
                }
            } catch { }
            if (attempts > 120) {
                clearInterval(checkReady);
                isModelLoading = false;
                console.error('[Engine] Failed to start after 120 seconds');
                safeSend('engine-error', 'Engine timeout');
            }
        }, 1000);

    } catch (e) {
        console.error('Spawn error:', e);
        isModelLoading = false;
        safeSend('engine-error', e.message);
    }
}

// IPC Handlers
ipcMain.handle('get-system-info', async () => {
    const totalRam = Math.round(os.totalmem() / 1073741824 * 10) / 10;
    let modelsSize = 0;
    if (modelsDir && fs.existsSync(modelsDir)) {
        for (const f of fs.readdirSync(modelsDir)) {
            try { modelsSize += fs.statSync(path.join(modelsDir, f)).size; } catch { }
        }
    }
    const diskFree = getDiskFree();
    return {
        ram: totalRam,
        diskFree: diskFree,
        modelsSize: Math.round(modelsSize / 1073741824 * 100) / 100,
        modelsPath: modelsDir || 'Not set'
    };
});

ipcMain.handle('switch-model', async (event, modelFilename, contextSize) => {
    await startEngine(modelFilename, contextSize || 2048);
});

// Download with redirect handling
ipcMain.handle('download-model', async (event, { id, url, filename }) => {
    const filePath = path.join(modelsDir, filename);
    return new Promise((resolve, reject) => {
        const state = createDownloadState('text', id, resolve, reject);
        state.onStepComplete = () => {
            safeSend('download-progress', { type: 'text', id, progress: 100, downloadedBytes: 0, totalBytes: 0 });
            safeSend('download-complete', { type: 'text', id });
            state.finishSuccess(true);
        };

        downloadToFile(url, filePath, state, payload => {
            safeSend('download-progress', { type: 'text', id, ...payload });
        });
    });
});

ipcMain.handle('cancel-download', () => {
    currentDownload?.cancel?.();
    currentDownload = null;
});

ipcMain.handle('check-model', async (event, filename) => {
    const modelPath = path.join(modelsDir, filename);
    if (!fs.existsSync(modelPath)) return { exists: false };
    try {
        const fd = fs.openSync(modelPath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        return { exists: true, valid: buffer.toString('ascii') === 'GGUF' };
    } catch { return { exists: true, valid: false }; }
});

ipcMain.handle('delete-model', async (event, filename) => {
    const filePath = path.join(modelsDir, filename);
    if (fs.existsSync(filePath)) {
        // Permanently delete - not recycle bin
        fs.unlinkSync(filePath);
        // Verify file is truly gone
        if (fs.existsSync(filePath)) {
            console.error('File still exists after deletion:', filePath);
            throw new Error('Failed to permanently delete model file');
        }
        console.log('Model permanently deleted:', filePath);
    }
});

// Change models storage directory
ipcMain.handle('select-models-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select New Folder for AI Model Weights',
        defaultPath: modelsDir,
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Use This Folder'
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const newDir = result.filePaths[0];
    if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
    }

    // Move existing models to new directory
    if (fs.existsSync(modelsDir)) {
        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.gguf'));
        for (const file of files) {
            const src = path.join(modelsDir, file);
            const dst = path.join(newDir, file);
            if (!fs.existsSync(dst)) {
                try {
                    fs.copyFileSync(src, dst);
                    fs.unlinkSync(src); // permanently delete original
                } catch (e) {
                    console.error('Failed to move model:', file, e);
                }
            }
        }
    }

    modelsDir = newDir;
    const config = loadConfig();
    config.modelsDir = newDir;
    saveConfig(config);

    return newDir;
});

ipcMain.handle('get-models-dir', async () => {
    return modelsDir;
});

// Custom model upload feature
ipcMain.handle('select-model-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select GGUF Model File',
        filters: [{ name: 'GGUF Models', extensions: ['gguf'] }],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('import-custom-model', async (event, { sourcePath, modelName }) => {
    try {
        // Validate the file is a GGUF file
        const fd = fs.openSync(sourcePath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        if (buffer.toString('ascii') !== 'GGUF') {
            return { success: false, error: 'Not a valid GGUF file' };
        }

        // Create safe filename from model name
        const safeFilename = modelName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.gguf';
        const destPath = path.join(modelsDir, safeFilename);

        // Check if file already exists
        if (fs.existsSync(destPath)) {
            return { success: false, error: 'Model with this name already exists' };
        }

        // Copy file to models directory
        fs.copyFileSync(sourcePath, destPath);

        // Get file size
        const stats = fs.statSync(destPath);
        const sizeMB = Math.round(stats.size / 1048576);

        return {
            success: true,
            filename: safeFilename,
            size: sizeMB > 1000 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB} MB`
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// --- STT and TTS Handlers ---

ipcMain.handle('download-stt-model', async (event, { id, url, filename }) => {
    return new Promise((resolve, reject) => {
        const filePath = path.join(modelsDir, filename);
        const state = createDownloadState('stt', id, resolve, reject);
        state.onStepComplete = () => {
            safeSend('download-progress', { type: 'stt', id, progress: 100, downloadedBytes: 0, totalBytes: 0 });
            safeSend('download-complete', { type: 'stt', id });
            state.finishSuccess(true);
        };

        downloadToFile(url, filePath, state, payload => {
            safeSend('download-progress', { type: 'stt', id, ...payload });
        });
    });
});

ipcMain.handle('delete-stt-model', async (event, filename) => {
    const filePath = path.join(modelsDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
});

ipcMain.handle('check-stt-model', async (event, filename) => {
    return fs.existsSync(path.join(modelsDir, filename));
});

ipcMain.handle('select-stt-model-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Whisper Model',
        filters: [{ name: 'Whisper Models', extensions: ['bin'] }],
        properties: ['openFile']
    });
    return (result.canceled || result.filePaths.length === 0) ? null : result.filePaths[0];
});

ipcMain.handle('import-custom-stt-model', async (event, { sourcePath, modelName }) => {
    try {
        const safeFilename = modelName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.bin';
        const destPath = path.join(modelsDir, safeFilename);
        if (fs.existsSync(destPath)) return { success: false, error: 'Model exists' };
        fs.copyFileSync(sourcePath, destPath);
        const sizeMB = Math.round(fs.statSync(destPath).size / 1048576);
        return { success: true, filename: safeFilename, size: sizeMB + ' MB' };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('run-stt', async (event, { model, audioPath, language }) => {
    const modelPath = path.join(modelsDir, model);
    const basePath = app.isPackaged ? process.resourcesPath : __dirname;
    const engineDir = path.join(basePath, 'engine', 'cpu_avx2');
    const whisperExe = path.join(engineDir, 'whisper.exe');

    sttLog('[STT] === Starting STT ===' );
    sttLog('[STT] isPackaged:', app.isPackaged, '| basePath:', basePath);
    sttLog('[STT] whisperExe exists:', fs.existsSync(whisperExe));
    sttLog('[STT] model:', model, '| exists:', fs.existsSync(modelPath));
    sttLog('[STT] audioPath:', audioPath, '| exists:', fs.existsSync(audioPath));

    if (!fs.existsSync(whisperExe)) {
        throw new Error(`Whisper executable not found at ${whisperExe}`);
    }
    if (!fs.existsSync(modelPath)) {
        throw new Error(`STT model not found: ${model}`);
    }
    if (!audioPath || !fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath || '(empty path)'}`);
    }

    // Log original audio info
    const origStats = fs.statSync(audioPath);
    const origWav = isValidWavFile(audioPath);
    sttLog('[STT] Original audio size:', origStats.size, 'bytes, wav:', JSON.stringify(origWav));

    // Pre-convert audio to 16kHz mono WAV using bundled ffmpeg.
    // CRITICAL: We must NOT rely on whisper server's --convert flag in production
    // because whisper internally calls ffmpeg via system() which breaks when the
    // install path contains spaces (e.g. "RemiAI Edge Gallery").
    const { convertedPath, tempFile, preConverted } = await convertToWav16k(audioPath, basePath);
    sttLog('[STT] Pre-converted:', preConverted, '| using:', convertedPath);

    try {
        return await new Promise((resolve, reject) => {
            const port = 8090 + Math.floor(Math.random() * 500);
            const args = [
                '-m', modelPath,
                '--host', '127.0.0.1',
                '--port', String(port),
                '--inference-path', '/inference',
                '-nt'
            ];

            // Only add --convert if our pre-conversion failed.
            // When pre-conversion succeeds, audio is already 16kHz WAV
            // and whisper's internal --convert (which uses system() ffmpeg
            // call) can break on paths with spaces in production.
            if (!preConverted) {
                args.push('--convert');
                sttLog('[STT] Pre-conversion failed, using whisper --convert fallback');
            }

            if (language) {
                args.push('-l', language);
            }

            sttLog('[STT] Whisper server port:', port, '| args:', args.join(' '));

            // Build clean environment with engine dir in PATH
            const envCopy = Object.assign({}, process.env);
            const currentPath = envCopy.PATH || envCopy.Path || envCopy.path || '';
            delete envCopy.PATH;
            delete envCopy.Path;
            delete envCopy.path;
            envCopy.PATH = `${engineDir}${path.delimiter}${currentPath}`;

            const proc = spawn(whisperExe, args, {
                cwd: engineDir,
                windowsHide: true,
                env: envCopy
            });

            let stderr = '';
            proc.stdout.on('data', d => sttLog('[Whisper OUT]', d.toString().trim()));
            proc.stderr.on('data', d => {
                const text = d.toString();
                stderr += text;
                sttLog('[Whisper LOG]', text.trim());
            });

            let settled = false;
            const finish = (err, result) => {
                if (settled) return;
                settled = true;
                try { proc.kill(); } catch { }
                if (err) reject(err);
                else resolve(result);
            };

            proc.on('error', err => {
                sttLog('[Whisper] Process error:', err.message);
                finish(err);
            });
            proc.on('close', code => {
                sttLog('[Whisper] Exited code:', code);
                if (!settled && code !== 0) {
                    finish(new Error(stderr.trim() || `Whisper failed with code ${code}`));
                }
            });

            (async () => {
                try {
                    await waitForWhisperServer(port);
                    sttLog('[STT] Server ready, sending audio bytes...');
                    const transcript = await transcribeWithWhisperServer(port, convertedPath);
                    sttLog('[STT] Result length:', transcript.length, '| text:', transcript.slice(0, 100));
                    finish(null, transcript);
                } catch (err) {
                    sttLog('[STT] Transcription error:', err.message);
                    finish(err);
                }
            })();
        });
    } finally {
        safeDeleteTempFile(tempFile);
    }
});

ipcMain.handle('download-tts-model', async (event, { id, url, jsonUrl, filename }) => {
    return new Promise((resolve, reject) => {
        const filePath = path.join(modelsDir, filename);
        const jsonPath = filePath + '.json';
        if (!jsonUrl) {
            reject(new Error('Missing TTS config URL'));
            return;
        }

        const state = createDownloadState('tts', id, resolve, reject);
        let step = 'model';

        state.onStepComplete = () => {
            if (step === 'model') {
                step = 'config';
                downloadToFile(jsonUrl, jsonPath, state, payload => {
                    safeSend('download-progress', {
                        type: 'tts',
                        id,
                        progress: 50 + (payload.progress / 2),
                        downloadedBytes: payload.downloadedBytes,
                        totalBytes: payload.totalBytes,
                        stage: 'config'
                    });
                });
                return;
            }

            safeSend('download-progress', { type: 'tts', id, progress: 100, downloadedBytes: 0, totalBytes: 0 });
            safeSend('download-complete', { type: 'tts', id });
            state.finishSuccess(true);
        };

        downloadToFile(url, filePath, state, payload => {
            safeSend('download-progress', {
                type: 'tts',
                id,
                progress: payload.progress / 2,
                downloadedBytes: payload.downloadedBytes,
                totalBytes: payload.totalBytes,
                stage: 'model'
            });
        });
    });
});

ipcMain.handle('delete-tts-model', async (event, filename) => {
    const filePath = path.join(modelsDir, filename);
    const jsonPath = filePath + '.json';
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
});

ipcMain.handle('check-tts-model', async (event, filename) => {
    const filePath = path.join(modelsDir, filename);
    const jsonPath = filePath + '.json';
    return fs.existsSync(filePath) && fs.existsSync(jsonPath);
});

ipcMain.handle('select-tts-model-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Piper ONNX and JSON Files',
        filters: [
            { name: 'Piper Model Files', extensions: ['onnx', 'json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
    });
    return (result.canceled || result.filePaths.length === 0) ? null : result.filePaths;
});

ipcMain.handle('import-custom-tts-model', async (event, { sourcePath, jsonPath, modelName }) => {
    try {
        const safeFilename = modelName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.onnx';
        const destPath = path.join(modelsDir, safeFilename);
        const destJsonPath = destPath + '.json';
        if (fs.existsSync(destPath)) return { success: false, error: 'Model exists' };
        fs.copyFileSync(sourcePath, destPath);
        fs.copyFileSync(jsonPath, destJsonPath);
        const sizeMB = Math.round(fs.statSync(destPath).size / 1048576);
        return { success: true, filename: safeFilename, size: sizeMB + ' MB' };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('run-tts', async (event, { model, text }) => {
    return new Promise((resolve, reject) => {
        const modelPath = path.join(modelsDir, model);
        const basePath = app.isPackaged ? process.resourcesPath : __dirname;
        const piperExe = path.join(basePath, 'engine', 'cpu_avx2', 'piper.exe');
        if (!fs.existsSync(piperExe)) {
            reject(new Error(`Piper executable not found at ${piperExe}`));
            return;
        }
        if (!fs.existsSync(modelPath)) {
            reject(new Error(`TTS model not found: ${model}`));
            return;
        }
        
        const timestamp = Date.now();
        const outputWav = path.join(app.getPath('temp'), `tts_${timestamp}.wav`);
        
        const proc = spawn(piperExe, ['-m', modelPath, '-f', outputWav], { windowsHide: true });
        
        proc.stdin.write(text);
        proc.stdin.end();
        
        proc.stderr.on('data', d => console.log('[Piper]', d.toString()));
        proc.on('close', code => {
            if (code === 0) resolve(outputWav);
            else reject(new Error('Piper failed with code ' + code));
        });
    });
});

ipcMain.handle('offload-engine', async (event, currentCategory) => {
    // We only need to offload the persistent text-gen server process
    // STT (Whisper) and TTS (Piper) are one-shot executable runs so they don't hold memory in background
    if (currentCategory !== 'text' && apiProcess) {
        console.log(`[Engine] Offloading text model due to switch to ${currentCategory}`);
        killEngine(); // Kills the llama cpp server and resets state
    }
});

app.whenReady().then(async () => {
    createWindow();
    await promptForModelsDir();
});
app.on('window-all-closed', () => {
    windowDestroyed = true;
    killEngine();
    if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
    windowDestroyed = true;
});
app.on('will-quit', killEngine);
