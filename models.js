/**
 * RemiAI Edge Gallery - Model Catalog
 * Only includes pure llama.cpp compatible GGUF models with verified working URLs
 */

const MODEL_CATEGORIES = {
    'chat': { name: 'Chat', icon: '🗨️' },
    'code': { name: 'Code', icon: '💻' },
    'instruct': { name: 'Instruct', icon: '📝' },
    'chinese': { name: 'Chinese', icon: '🇨🇳' },
    'multilingual': { name: 'Multilingual', icon: '🌍' }
};

const MODEL_CATALOG = {
    // 8GB RAM - Under 1B parameters (STRICT RULE: all models below 1B params)
    '8gb': [
        {
            id: 'smollm2-360m',
            name: 'SmolLM2-360M-Instruct',
            params: '360M',
            size: '290 MB',
            category: 'chat',
            description: 'HuggingFace ultra-tiny model',
            filename: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf'
        },
        {
            id: 'smollm2-135m',
            name: 'SmolLM2-135M-Instruct',
            params: '135M',
            size: '120 MB',
            category: 'chat',
            description: 'Smallest SmolLM2 variant',
            filename: 'SmolLM2-135M-Instruct-Q8_0.gguf',
            url: 'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf'
        },
        {
            id: 'qwen2.5-0.5b',
            name: 'Qwen2.5-0.5B-Instruct',
            params: '0.5B',
            size: '397 MB',
            category: 'instruct',
            description: 'Alibaba ultra-efficient model',
            filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
            url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf'
        },
        {
            id: 'danube3-500m',
            name: 'Danube3-500M-Instruct',
            params: '500M',
            size: '380 MB',
            category: 'chat',
            description: 'H2O.ai tiny chat model',
            filename: 'h2o-danube3-500m-chat-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/h2o-danube3-500m-chat-GGUF/resolve/main/h2o-danube3-500m-chat-Q4_K_M.gguf'
        },
        {
            id: 'qwen2-0.5b',
            name: 'Qwen2-0.5B-Instruct',
            params: '0.5B',
            size: '397 MB',
            category: 'multilingual',
            description: 'Compact multilingual instruct model',
            filename: 'qwen2-0_5b-instruct-q4_k_m.gguf',
            url: 'https://huggingface.co/Qwen/Qwen2-0.5B-Instruct-GGUF/resolve/main/qwen2-0_5b-instruct-q4_k_m.gguf'
        },
        {
            id: 'qwen2.5-coder-0.5b',
            name: 'Qwen2.5-Coder-0.5B-Instruct',
            params: '0.5B',
            size: '431 MB',
            category: 'code',
            description: 'Tiny coding-focused instruct model',
            filename: 'qwen2.5-coder-0.5b-instruct-q4_k_m.gguf',
            url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-0.5b-instruct-q4_k_m.gguf'
        },
        {
            id: 'falcon-h1-0.5b',
            name: 'Falcon-H1-0.5B-Instruct',
            params: '0.5B',
            size: '532 MB',
            category: 'chat',
            description: 'Small Falcon instruct model in GGUF format',
            filename: 'Falcon-H1-0.5B-Instruct-Q8_0.gguf',
            url: 'https://huggingface.co/ggml-org/Falcon-H1-0.5B-Instruct-Q8_0-GGUF/resolve/main/Falcon-H1-0.5B-Instruct-Q8_0.gguf'
        },
    ],

    // 16GB RAM - Under 7B parameters (STRICT RULE: all models below 7B params)
    '16gb': [
        {
            id: 'llama-3.2-1b',
            name: 'Llama-3.2-1B-Instruct',
            params: '1B',
            size: '810 MB',
            category: 'instruct',
            description: 'Meta latest small model',
            filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf'
        },
        {
            id: 'tinyllama-1.1b',
            name: 'TinyLlama-1.1B-Chat',
            params: '1.1B',
            size: '638 MB',
            category: 'chat',
            description: 'Fast lightweight Llama',
            filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
            url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
        },
        {
            id: 'smollm2-1.7b',
            name: 'SmolLM2-1.7B-Instruct',
            params: '1.7B',
            size: '1.1 GB',
            category: 'chat',
            description: 'HuggingFace balanced model',
            filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf'
        },
        {
            id: 'qwen2.5-1.5b',
            name: 'Qwen2.5-1.5B-Instruct',
            params: '1.5B',
            size: '1.1 GB',
            category: 'instruct',
            description: 'Alibaba balanced model',
            filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
            url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf'
        },
        {
            id: 'qwen2.5-3b',
            name: 'Qwen2.5-3B-Instruct',
            params: '3B',
            size: '2.0 GB',
            category: 'instruct',
            description: 'Alibaba mid-size model',
            filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
            url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf'
        },
        {
            id: 'gemma-2-2b-it',
            name: 'Gemma-2-2B-IT',
            params: '2B',
            size: '1.5 GB',
            category: 'instruct',
            description: 'Google Gemma 2 instruct',
            filename: 'gemma-2-2b-it-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf'
        },
        {
            id: 'phi-3.5-mini',
            name: 'Phi-3.5-mini-instruct',
            params: '3.8B',
            size: '2.4 GB',
            category: 'instruct',
            description: 'Microsoft Phi 3.5 mini',
            filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf'
        },
        {
            id: 'phi-3-mini',
            name: 'Phi-3-mini-4k-instruct',
            params: '3.8B',
            size: '2.4 GB',
            category: 'instruct',
            description: 'Microsoft Phi 3 mini',
            filename: 'Phi-3-mini-4k-instruct-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf'
        },
        {
            id: 'llama-3.2-3b',
            name: 'Llama-3.2-3B-Instruct',
            params: '3B',
            size: '2.0 GB',
            category: 'instruct',
            description: 'Meta Llama 3.2 medium',
            filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf'
        },
        {
            id: 'stablelm-zephyr-3b',
            name: 'StableLM-Zephyr-3B',
            params: '3B',
            size: '1.8 GB',
            category: 'chat',
            description: 'Stability AI Zephyr',
            filename: 'stablelm-zephyr-3b.Q4_K_M.gguf',
            url: 'https://huggingface.co/TheBloke/stablelm-zephyr-3b-GGUF/resolve/main/stablelm-zephyr-3b.Q4_K_M.gguf'
        },
        {
            id: 'phi-2',
            name: 'Phi-2',
            params: '2.7B',
            size: '1.6 GB',
            category: 'code',
            description: 'Microsoft reasoning model',
            filename: 'phi-2.Q4_K_M.gguf',
            url: 'https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf'
        },
        {
            id: 'deepseek-coder-1.3b',
            name: 'DeepSeek-Coder-1.3B',
            params: '1.3B',
            size: '990 MB',
            category: 'code',
            description: 'DeepSeek code model',
            filename: 'deepseek-coder-1.3b-instruct.Q4_K_M.gguf',
            url: 'https://huggingface.co/TheBloke/deepseek-coder-1.3b-instruct-GGUF/resolve/main/deepseek-coder-1.3b-instruct.Q4_K_M.gguf'
        },
        {
            id: 'codegemma-2b',
            name: 'CodeGemma-2B',
            params: '2B',
            size: '1.5 GB',
            category: 'code',
            description: 'Google code Gemma',
            filename: 'codegemma-2b-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/codegemma-2b-GGUF/resolve/main/codegemma-2b-Q4_K_M.gguf'
        },
        {
            id: 'rocket-3b',
            name: 'Rocket-3B',
            params: '3B',
            size: '1.7 GB',
            category: 'chat',
            description: 'Fast chat model',
            filename: 'rocket-3b.Q4_K_M.gguf',
            url: 'https://huggingface.co/TheBloke/rocket-3B-GGUF/resolve/main/rocket-3b.Q4_K_M.gguf'
        },
        {
            id: 'danube2-1.8b',
            name: 'Danube2-1.8B-Chat',
            params: '1.8B',
            size: '1.2 GB',
            category: 'chat',
            description: 'H2O.ai danube chat',
            filename: 'h2o-danube2-1.8b-chat-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/h2o-danube2-1.8b-chat-GGUF/resolve/main/h2o-danube2-1.8b-chat-Q4_K_M.gguf'
        },
        {
            id: 'yi-1.5-6b',
            name: 'Yi-1.5-6B-Chat',
            params: '6B',
            size: '3.6 GB',
            category: 'chinese',
            description: '01.AI Yi 1.5 medium',
            filename: 'Yi-1.5-6B-Chat-Q4_K_M.gguf',
            url: 'https://huggingface.co/bartowski/Yi-1.5-6B-Chat-GGUF/resolve/main/Yi-1.5-6B-Chat-Q4_K_M.gguf'
        },
        {
            id: 'qwen2-1.5b',
            name: 'Qwen2-1.5B-Instruct',
            params: '1.5B',
            size: '1.1 GB',
            category: 'chinese',
            description: 'Alibaba Qwen2 small',
            filename: 'qwen2-1_5b-instruct-q4_k_m.gguf',
            url: 'https://huggingface.co/Qwen/Qwen2-1.5B-Instruct-GGUF/resolve/main/qwen2-1_5b-instruct-q4_k_m.gguf'
        }
    ]
};

const DEFAULT_MODEL_SETTINGS = {
    contextSize: 2048,
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9,
    repeatPenalty: 1.1,
    speedMode: false
};

const AI_CHARACTERS = [
    { id: 'assistant', name: 'Helpful Assistant', instruction: 'You are helpful, accurate, and concise.', emoji: '🤖' },
    { id: 'tutor', name: 'AI Tutor', instruction: 'Explain concepts step by step like a patient teacher. Use examples and analogies.', emoji: '📚' },
    { id: 'coder', name: 'Code Helper', instruction: 'Help with programming. Provide clean, well-commented code with explanations.', emoji: '💻' },
    { id: 'creative', name: 'Creative Writer', instruction: 'Help with creative writing. Be imaginative, expressive, and use vivid language.', emoji: '✨' },
    { id: 'scientist', name: 'Scientist', instruction: 'Explain things scientifically with evidence-based reasoning. Use data and research references.', emoji: '🔬' },
    { id: 'translator', name: 'Translator', instruction: 'Help translate text between languages accurately. Preserve meaning and cultural context.', emoji: '🌍' },
    { id: 'philosopher', name: 'Philosopher', instruction: 'Engage in deep philosophical thinking. Explore multiple perspectives and ask thought-provoking questions.', emoji: '🧘' }
];

const STT_MODELS = [
    {
        id: 'whisper-tiny-en',
        name: 'Whisper Tiny (English)',
        size: '78 MB',
        description: 'Ultra-fast, English only',
        filename: 'ggml-tiny.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin'
    },
    {
        id: 'whisper-tiny-multi',
        name: 'Whisper Tiny (Multilingual)',
        size: '77 MB',
        description: 'Fastest, supports multiple languages',
        filename: 'ggml-tiny.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'
    },
    {
        id: 'whisper-base-en',
        name: 'Whisper Base (English)',
        size: '148 MB',
        description: 'Good balance of speed and accuracy (English)',
        filename: 'ggml-base.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
    },
    {
        id: 'whisper-base-multi',
        name: 'Whisper Base (Multilingual)',
        size: '148 MB',
        description: 'Good balance, supports multiple languages',
        filename: 'ggml-base.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
    },
    {
        id: 'whisper-small-en',
        name: 'Whisper Small (English)',
        size: '488 MB',
        description: 'High accuracy, English only',
        filename: 'ggml-small.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin'
    },
    {
        id: 'whisper-small-multi',
        name: 'Whisper Small (Multilingual)',
        size: '488 MB',
        description: 'High accuracy, supports 99+ languages',
        filename: 'ggml-small.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
    },
    {
        id: 'whisper-medium-en',
        name: 'Whisper Medium (English)',
        size: '1.5 GB',
        description: 'Best English accuracy, slower',
        filename: 'ggml-medium.en.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin'
    },
    {
        id: 'whisper-medium-multi',
        name: 'Whisper Medium (Multilingual)',
        size: '1.5 GB',
        description: 'Best multilingual accuracy, slower',
        filename: 'ggml-medium.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin'
    }
];

const TTS_MODELS = [
    {
        id: 'piper-en-lessac-medium',
        name: 'Lessac (English US, Female)',
        size: '50 MB',
        description: 'Clear and natural American female voice',
        filename: 'en_US-lessac-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json'
    },
    {
        id: 'piper-en-ryan-high',
        name: 'Ryan (English US, Male)',
        size: '85 MB',
        description: 'High quality American male voice',
        filename: 'en_US-ryan-high.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high/en_US-ryan-high.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high/en_US-ryan-high.onnx.json'
    },
    {
        id: 'piper-en-amy-medium',
        name: 'Amy (English UK, Female)',
        size: '55 MB',
        description: 'British English female voice',
        filename: 'en_GB-amy-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/amy/medium/en_GB-amy-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/amy/medium/en_GB-amy-medium.onnx.json'
    },
    {
        id: 'piper-en-libritts-high',
        name: 'LibriTTS (English US, Female)',
        size: '85 MB',
        description: 'Professional audiobook-quality female voice',
        filename: 'en_US-libritts-high.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts/high/en_US-libritts-high.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts/high/en_US-libritts-high.onnx.json'
    },
    {
        id: 'piper-en-joe-medium',
        name: 'Joe (English US, Male)',
        size: '50 MB',
        description: 'Casual American male voice',
        filename: 'en_US-joe-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/joe/medium/en_US-joe-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/joe/medium/en_US-joe-medium.onnx.json'
    },
    {
        id: 'piper-de-thorsten-medium',
        name: 'Thorsten (German, Male)',
        size: '50 MB',
        description: 'German male voice',
        filename: 'de_DE-thorsten-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json'
    },
    {
        id: 'piper-fr-siwis-medium',
        name: 'Siwis (French, Female)',
        size: '50 MB',
        description: 'French female voice',
        filename: 'fr_FR-siwis-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json'
    },
    {
        id: 'piper-es-carlfm-medium',
        name: 'Carlos (Spanish, Male)',
        size: '50 MB',
        description: 'Spanish male voice',
        filename: 'es_ES-carlfm-x_low.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx.json'
    },
    // Indian Languages
    {
        id: 'piper-hi-female',
        name: 'Hindi (Female)',
        size: '50 MB',
        description: 'Hindi female voice — Indian 🇮🇳',
        filename: 'hi_IN-swara-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/hi/hi_IN/swara/medium/hi_IN-swara-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/hi/hi_IN/swara/medium/hi_IN-swara-medium.onnx.json'
    },
    {
        id: 'piper-bn-male',
        name: 'Bengali (Male)',
        size: '50 MB',
        description: 'Bengali male voice — Indian 🇮🇳',
        filename: 'bn_BD-sagar-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/bn/bn_BD/sagar/medium/bn_BD-sagar-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/bn/bn_BD/sagar/medium/bn_BD-sagar-medium.onnx.json'
    },
    {
        id: 'piper-hi-pratham-medium',
        name: 'Pratham (Hindi, Male)',
        size: '63 MB',
        description: 'Hindi male voice for India',
        filename: 'hi_IN-pratham-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json'
    },
    {
        id: 'piper-hi-rohan-medium',
        name: 'Rohan (Hindi, Male)',
        size: '63 MB',
        description: 'Hindi male voice tuned for Indian speech',
        filename: 'hi_IN-rohan-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/rohan/medium/hi_IN-rohan-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/rohan/medium/hi_IN-rohan-medium.onnx.json'
    },
    {
        id: 'piper-hi-priyamvada-medium',
        name: 'Priyamvada (Hindi, Female)',
        size: '64 MB',
        description: 'Hindi female voice for Indian language support',
        filename: 'hi_IN-priyamvada-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx.json'
    },
    {
        id: 'piper-te-maya-medium',
        name: 'Maya (Telugu, Female)',
        size: '63 MB',
        description: 'Telugu female voice for Indian language playback',
        filename: 'te_IN-maya-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/te/te_IN/maya/medium/te_IN-maya-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/te/te_IN/maya/medium/te_IN-maya-medium.onnx.json'
    },
    {
        id: 'piper-ml-arjun-medium',
        name: 'Arjun (Malayalam, Male)',
        size: '63 MB',
        description: 'Malayalam male voice for Indian language playback',
        filename: 'ml_IN-arjun-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx.json'
    },
    {
        id: 'piper-ml-meera-medium',
        name: 'Meera (Malayalam, Female)',
        size: '63 MB',
        description: 'Malayalam female voice for Indian language playback',
        filename: 'ml_IN-meera-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx.json'
    },
    {
        id: 'piper-ne-female',
        name: 'Nepali (Female)',
        size: '50 MB',
        description: 'Nepali female voice — South Asian 🇳🇵',
        filename: 'ne_NP-google-medium.onnx',
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ne/ne_NP/google/medium/ne_NP-google-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ne/ne_NP/google/medium/ne_NP-google-medium.onnx.json'
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MODEL_CATALOG, MODEL_CATEGORIES, DEFAULT_MODEL_SETTINGS, AI_CHARACTERS, STT_MODELS, TTS_MODELS };
}
