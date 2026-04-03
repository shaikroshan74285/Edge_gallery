# Student & Developer Documentation

## Overview
Welcome to the RemiAI Edge Gallery! This document helps you understand how to customize, configure, and extend the application. This framework is built to be **Plug-and-Play**—no Python or complex AI setup required.

## 🛠️ Setup & Customization

### Quick Setup (Important!)

Before running the app, ensure the AI engine files are downloaded correctly. GitHub/Hugging Face uses **Git LFS** for large files.

1. **Install Git LFS**:
   - Download from [git-lfs.com](https://git-lfs.com)
   - Run: `git lfs install`

2. **Pull Large Files**:
   - Run: `git lfs pull` in the project folder
   - Without this, engine files may be incomplete

3. **Install & Run**:
   ```bash
   npm install
   npm start
   ```

### Changing the AI Name/Branding

1. Open `index.html` in any text editor
2. Search for "RemiAI" and replace with your desired name
3. Replace `remiai.ico` with your own icon file
4. Update `package.json` name field
5. Restart the app

### Adding Your Own Models

**Method 1: Drag & Drop Upload**
1. Open the app to **Model Gallery** or **My Models** tab
2. Drag your `.gguf` file onto the **Upload Zone** at the top
3. Follow the import dialog to name and save the model

**Method 2: Use the Built-in Upload Feature**
1. Go to **My Models** tab
2. Click **Upload Custom Model**
3. Enter a name and browse to your `.gguf` file
4. Click **Import**

**Method 3: Manual File Placement**
1. Download a GGUF model from [Hugging Face](https://huggingface.co/models?library=gguf)
2. Choose Q4_K_M or Q5_K_M quantization (good balance)
3. Place the `.gguf` file in your configured models directory
4. Add an entry to `models.js` (see existing entries for format)

### Modifying the Model Catalog

Edit `models.js` to add or remove models:

```javascript
{
    id: 'unique-model-id',           // Unique identifier
    name: 'Display Name',            // Shown in UI
    params: '3B',                    // Parameter count
    size: '2.0 GB',                  // Download size
    category: 'chat',                // chat, code, instruct, chinese
    description: 'Short description',
    filename: 'model-file.gguf',     // Filename in engine/models/
    url: 'https://huggingface.co/...' // Direct download URL
}
```

### Customizing the UI

**Styles**: Edit `styles.css` for colors, fonts, animations
- CSS variables in `:root` control the entire color scheme
- Dark mode colors in `body.dark-mode`

**AI Characters**: Edit `models.js` to add new personalities:
```javascript
{ id: 'mychar', name: 'My Character', instruction: 'Custom prompt', emoji: '🎭' }
```

**Custom Character**: Users can also set a custom system prompt directly from the settings panel by selecting "✏️ Custom Character" from the AI Character dropdown — no code editing needed!

### Changing Model Storage Location

- On **first launch**, the app prompts you to choose a storage directory
- To change later: click **"📂 Change Storage"** in the left panel system info
- All existing models are automatically **moved** to the new location
- Configuration saved in `AppData/remiai-edge-gallery/config.json`

## 📁 File Structure Explained

| File | Purpose |
|------|---------|
| `main.js` | Electron main process - engine management, IPC handlers, file operations, disk space detection |
| `preload.js` | Secure bridge exposing APIs to renderer |
| `renderer.js` | UI logic, chat functionality, settings, think mode, model management |
| `models.js` | Model catalog with URLs, metadata, AI characters |
| `index.html` | Application UI structure (upload zones, settings panel, modals) |
| `styles.css` | Complete styling with dark/light themes |
| `engine/` | Contains llama.cpp binaries |
| `config.json` | User preferences (storage path) - in AppData |

## ❓ FAQ

**Q: Do I need Python?**
A: **No.** The app includes pre-compiled binaries (`bujji_engine.exe`) that run models directly.

**Q: What are AVX/AVX2?**
A: CPU instruction sets that speed up AI calculations. The app auto-detects your CPU's capabilities.

**Q: The app says "Engine Missing"**
A: Run `git lfs pull` to download the actual engine binaries (not just pointers).

**Q: Model loads but no response**
A: 
- Wait 1-2 minutes for large models to fully load
- Check the "Ready" status indicator
- Try a smaller model first

**Q: How do I add my own GGUF model?**
A: Drag your `.gguf` file onto the upload zone, use the **Upload Custom Model** button in My Models, or manually place the file in your configured models directory.

**Q: Chat doesn't remember previous messages**
A: 
- Conversation memory is set to 20 messages by default
- Disable "Speed Mode" in settings for memory
- Very long conversations may exceed context window
- Increase the "Context Memory" setting for longer conversations

**Q: What is Think Mode?**
A: 
- Enable **🧠 Think Mode** in Chat Settings to see the model's reasoning process
- The model will show its step-by-step thinking in a collapsible block above the answer
- Click the "Thought for Xs" header to expand and view the full reasoning
- Disable it for faster, direct responses without the thinking overhead

**Q: How do I customize the AI's behavior?**
A: Select "✏️ Custom Character" from the AI Character dropdown in Settings, then type your own system prompt in the textarea that appears.

**Q: Where are my models stored?**
A: In the directory you chose on first launch. You can see the path in the left panel under "📂 Path". Click "Change Storage" to move all models to a new location.

**Q: The disk space shows as "Unknown"**
A: This can happen on some Windows configurations. The app will still function normally — downloads will proceed without space warnings.

**Q: How do I build a distributable .exe?**
A: Run `npm run dist` (use PowerShell as Administrator if errors occur)

## 🔧 Hardware Requirements

| Configuration | Recommended Models |
|--------------|-------------------|
| 8GB RAM, any CPU | Models < 1B params (SmolLM2, Qwen2.5-0.5B) |
| 16GB RAM, modern CPU | Models < 3B params (Phi-3, Gemma-2, Llama-3.2-3B) |
| 32GB RAM | Larger 7B models (Yi-1.5-6B) |

**Warning**: Running large AI models generates heat. Ensure adequate cooling and don't use very old laptops (5+ years) with limited thermal capacity.

## 🎨 Theming

Toggle dark/light mode with the button in the left panel. To customize:

```css
:root {
    --bg-main: #f8f9fc;      /* Main background */
    --bg-panel: #ffffff;      /* Panel backgrounds */
    --accent: #6366f1;        /* Primary accent color */
    --success: #10b981;       /* Success indicators */
    --text: #1a1a2e;          /* Main text color */
}

body.dark-mode {
    --bg-main: #0d0d12;
    /* ... dark mode overrides ... */
}
```

## 🚀 Tips for Best Performance

1. **Use Q4_K_M quantization** - Best balance of speed and quality
2. **Enable Speed Mode** for quick interactions
3. **Use Think Mode** when you want to see the model's reasoning (slower but transparent)
4. **Choose models under your RAM limit** - Leave headroom for the system
5. **Close other apps** when using larger models
6. **Reduce Max Tokens** in settings for faster responses

---

**Questions?** Check the README.md for more details or open an issue on the repository!
