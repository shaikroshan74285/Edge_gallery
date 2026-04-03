# RemiAI Edge Gallery

🚀 **Download, run, and experiment with open-source AI models locally** - No cloud, no API keys, just plug and play!

## What is RemiAI Edge Gallery?

RemiAI Edge Gallery is a Windows desktop application that lets anyone easily download and run open-source Large Language Models (LLMs) directly on their laptop. Perfect for:

- 🎓 **Students** learning about AI without complex setup
- 🔬 **Researchers** experimenting with different models offline  
- 💻 **Developers** testing LLMs locally before deployment

## Features

### Core Features
- **Model Gallery** - Browse and download models categorized by RAM requirements
- **8GB RAM Models** - Lightweight models under 1B parameters
- **16GB RAM Models** - More powerful models up to 7B parameters
- **One-Click Download** - Direct download from Hugging Face (no account needed)
- **Model Switching** - Switch between models seamlessly during chat
- **Offline Chat** - Everything runs locally on your device

### Chat Features
- **Conversation Memory** - Remembers up to 20 messages for context
- **Speed Mode** - Fast responses without conversation memory (each reply is independent)
- **Think Mode** - Optional chain-of-thought reasoning with collapsible thinking display
- **AI Characters** - 7 built-in personalities + custom character with your own system prompt
- **Markdown Support** - AI responses render with proper formatting

### Custom Model Upload
- **Upload Zones** - Large drag-and-drop upload areas in both Model Gallery and My Models views
- **Upload Your Own Models** - Import any `.gguf` model file from your computer
- **GGUF Validation** - Automatically validates model format before import
- **Easy Integration** - Custom models appear in your downloaded models list

### Storage & Disk Management
- **Storage Directory Picker** - Choose where to store model weights on first launch
- **Change Storage Location** - Move all models to a new directory at any time
- **Real Disk Space Detection** - Accurate free space display using PowerShell
- **Low-Space Alerts** - Warning before downloading when disk space is low (doesn't block)
- **Permanent Deletion** - Models are permanently deleted, not sent to recycle bin

### UI Features
- **Dark/Light Theme** - Toggle between themes
- **System Info Display** - Shows RAM usage, disk space, and storage path
- **Download Progress** - Real-time download progress with cancel option
- **Confetti Animation** - Celebration when downloads complete!

## Quick Start

### Prerequisites
- Windows 10/11
- Node.js 18+ installed
- 8GB RAM minimum (16GB recommended for larger models)

### Installation

```bash
# Clone the repository
git clone https://huggingface.co/spaces/remiai/edge-gallery
cd edge-gallery

# Install Git LFS (required for engine binaries)
git lfs install
git lfs pull

# Install dependencies
npm install

# Start the application
npm start
```

### First Run
1. Open the app - you'll be asked to **choose a storage folder** for model weights
2. You'll see the **Model Gallery** with upload zones at the top
3. Choose a model based on your RAM (8GB or 16GB tab)
4. Click **Download** and wait for it to complete
5. Click **Use Model** to start chatting!

### Upload Custom Model
1. Go to **My Models** tab
2. Click **Upload Custom Model** button
3. Enter a name for your model
4. Click **Browse** to select your `.gguf` file
5. Click **Import** - model is copied and ready to use!

## Available Models

### 8GB RAM (Under 1B Parameters)
| Model | Parameters | Size | Category |
|-------|------------|------|----------|
| Llama-3.2-1B-Instruct | 1B | 810 MB | Instruct |
| SmolLM2-360M-Instruct | 360M | 290 MB | Chat |
| SmolLM2-135M-Instruct | 135M | 120 MB | Chat |
| Qwen2.5-0.5B-Instruct | 0.5B | 397 MB | Instruct |
| Danube3-500M-Instruct | 500M | 380 MB | Chat |
| TinyLlama-1.1B-Chat | 1.1B | 638 MB | Chat |

### 16GB RAM (Under 7B Parameters)
| Model | Parameters | Size | Category |
|-------|------------|------|----------|
| SmolLM2-1.7B-Instruct | 1.7B | 1.1 GB | Chat |
| Qwen2.5-1.5B-Instruct | 1.5B | 1.1 GB | Instruct |
| Qwen2.5-3B-Instruct | 3B | 2.0 GB | Instruct |
| Gemma-2-2B-IT | 2B | 1.5 GB | Instruct |
| Phi-3.5-mini-instruct | 3.8B | 2.4 GB | Instruct |
| Phi-3-mini-4k-instruct | 3.8B | 2.4 GB | Instruct |
| Llama-3.2-3B-Instruct | 3B | 2.0 GB | Instruct |
| StableLM-Zephyr-3B | 3B | 1.8 GB | Chat |
| Phi-2 | 2.7B | 1.6 GB | Code |
| DeepSeek-Coder-1.3B | 1.3B | 990 MB | Code |
| CodeGemma-2B | 2B | 1.5 GB | Code |
| Rocket-3B | 3B | 1.7 GB | Chat |
| Danube2-1.8B-Chat | 1.8B | 1.2 GB | Chat |
| Yi-1.5-6B-Chat | 6B | 3.6 GB | Chinese |
| Qwen2-1.5B-Instruct | 1.5B | 1.1 GB | Chinese |

## Model Settings

Customize your chat experience with these settings:

- **Context Memory** - Total conversation memory window (512-8192 tokens)
- **Max Input Tokens** - Maximum length of your input messages (100-4096 tokens)
- **Max Output Tokens** - Maximum response length (100-4096 tokens)
- **Temperature** - Creativity level (0 = focused, 2 = creative)
- **Speed Mode** - No conversation memory — each reply is independent (fastest responses)
- **Think Mode** - Shows the model's step-by-step reasoning in a collapsible block above the answer
- **AI Character** - Choose personality type:
  - 🤖 **Helpful Assistant** - General assistance
  - 📚 **AI Tutor** - Step-by-step explanations with examples
  - 💻 **Code Helper** - Clean, well-commented programming assistance
  - ✨ **Creative Writer** - Imaginative, expressive writing help
  - 🔬 **Scientist** - Evidence-based scientific explanations
  - 🌍 **Translator** - Accurate language translation
  - 🧘 **Philosopher** - Deep philosophical discussions
  - ✏️ **Custom Character** - Write your own system prompt!

## File Structure

```
remiai-edge-gallery/
├── main.js           # Electron main process, engine management, IPC handlers
├── preload.js        # Secure bridge between main and renderer
├── renderer.js       # UI logic, chat functionality, model management
├── models.js         # Model catalog with verified download URLs
├── index.html        # Application UI layout
├── styles.css        # Modern dark/light theme styling
├── engine/           # LLM engine binaries (llama.cpp based)
│   ├── cpu_avx/      # AVX version (broader compatibility)
│   ├── cpu_avx2/     # AVX2 version (faster if supported)
│   └── models/       # Downloaded model files (.gguf)
├── package.json      # Project configuration
├── README.md         # This file
├── document.md       # Student/Developer documentation
└── report.md         # Technical architecture report
```

## How It Works

1. **Engine**: Uses `bujji_engine.exe` (llama.cpp based) for CPU inference
2. **Format**: All models use `.gguf` format (quantized for efficiency)
3. **API**: Engine runs a local server on port 5000 with OpenAI-compatible API
4. **Download**: Models downloaded directly from Hugging Face (no login required)
5. **Storage**: Models saved in user-chosen directory (configurable, defaults to AppData)
6. **Custom Models**: Users can import their own `.gguf` files via upload zones or browse dialog
7. **Disk Space**: Detected via PowerShell `Get-PSDrive` with `fs.statfsSync` fallback
8. **Deletion**: Models permanently deleted via `fs.unlinkSync` with verification

## Troubleshooting

### Model won't load
- Check if the `.gguf` file downloaded completely
- Ensure you have enough free RAM
- Try a smaller model first
- Wait for "Ready" status (larger models take longer to load)

### Slow responses
- Enable **Speed Mode** in settings
- Disable **Think Mode** if you don't need the reasoning display
- Use a smaller model (< 1B parameters)
- Close other applications to free RAM
- Reduce **Max Tokens** in settings

### Download fails
- Check your internet connection
- Try downloading again (downloads resume from where they stopped)
- Some models may require Hugging Face authentication

### "Object destroyed" error
- Fixed in latest version - update your code
- The app now safely handles window close during operations

### Engine error during loading
- Wait 1-2 minutes for large models to load
- The engine takes time to load larger models into memory

## Building for Distribution

```bash
# Create Windows installer
npm run dist
```

The installer will be created in the `release/` folder.

**Tip**: Run PowerShell as Administrator if you encounter build permission errors.

## License

MIT License - Free for educational and personal use.

---

**Made with ❤️ by RemiAI** - Making AI education accessible to everyone!
