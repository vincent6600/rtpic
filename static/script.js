document.addEventListener('DOMContentLoaded', async () => {
    // --- 元素获取 ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    const modelSelectorContainer = document.querySelector('.model-selector-container');
    const modelCards = document.querySelectorAll('.model-card');
    const nanobananaControls = document.getElementById('nanobanana-controls');
    const chatgptControls = document.getElementById('chatgpt-controls');
    const modelscopeControls = document.getElementById('modelscope-controls');
    const apiKeyOpenRouterInput = document.getElementById('api-key-input-openrouter');
    const apiKeyOpenAIInput = document.getElementById('api-key-input-openai');
    const apiKeyModelScopeInput = document.getElementById('api-key-input-modelscope');
    const generateBtns = document.querySelectorAll('.generate-btn');

    const countButtons = document.querySelectorAll('.count-btn');
    const mainResultImageContainer = document.getElementById('main-result-image');
    const resultThumbnailsContainer = document.getElementById('result-thumbnails');
    const downloadBtn = document.getElementById('download-btn');
    const downloadSection = document.getElementById('download-section');
    
    const chatgptOptimizeBtn = document.getElementById('chatgpt-prompt-optimize-btn');
    const nanobananaOptimizeBtn = document.getElementById('nanobanana-prompt-optimize-btn');
    const modelscopeOptimizeBtn = document.getElementById('modelscope-prompt-optimize-btn');
    
    const nanobananaPromptRemark = document.getElementById('nanobanana-prompt-remark');
    const chatgptPromptRemark = document.getElementById('chatgpt-prompt-remark');
    const modelscopePromptRemark = document.getElementById('modelscope-prompt-remark');
    const modelscopeNegativePromptRemark = document.getElementById('modelscope-negative-prompt-remark');

    const fullscreenModal = document.getElementById('fullscreen-modal');
    const modalImage = document.getElementById('modal-image');
    const closeModalBtn = document.querySelector('.close-btn');

    // Nano Banana 元素
    const uploadAreaNano = document.querySelector('#nanobanana-controls .upload-area');
    const fileInputNano = document.getElementById('image-upload');
    const thumbnailsContainerNano = document.getElementById('thumbnails-container');
    const promptNanoBananaInput = document.getElementById('prompt-input-nanobanana');

    // ChatGPT 元素
    const uploadAreaChatGPT = document.querySelector('#chatgpt-controls .upload-area');
    const fileInputChatGPT = document.getElementById('image-upload-chatgpt');
    const thumbnailsContainerChatGPT = document.getElementById('thumbnails-container-chatgpt');
    const promptChatGPTInput = document.getElementById('prompt-input-chatgpt');

    // ModelScope 元素
    const promptPositiveInput = document.getElementById('prompt-input-positive');
    const promptNegativeInput = document.getElementById('prompt-input-negative');
    const sizeSelect = document.getElementById('size-select');
    const stepsInput = document.getElementById('steps-input');
    const guidanceInput = document.getElementById('guidance-input');
    const seedInput = document.getElementById('seed-input');

    // --- 状态变量 ---
    let selectedFilesNano = [];
    let selectedFilesChatGPT = [];
    let currentModel = 'chatgpt';
    
    const modelStates = {};
    modelCards.forEach(card => {
        const modelId = card.dataset.model;
        modelStates[modelId] = {
            inputs: {
                prompt: '',
                negative_prompt: '',
                size: '1328x1328',
                steps: 30,
                guidance: 3.5,
                seed: -1,
                count: 1,
                files: []
            },
            task: {
                isRunning: false,
                statusText: ''
            },
            results: []
        };
    });

    // --- 初始化函数 ---
    function initialize() {
        setupTheme();
        loadStateForCurrentModel();
        setupInputValidation();
        setUniformButtonWidth();
        updateHighlightPosition();
        setupModalListeners();
        setupFileUploads();
        setupDownloadListeners();
        setupPromptOptimizationListeners();
        
        fetch('/api/key-status').then(res => res.json()).then(data => {
            if (data.isSet) { apiKeyOpenRouterInput.parentElement.style.display = 'none'; }
        }).catch(error => console.error("无法检查 OpenRouter API key 状态:", error));

        fetch('/api/openai-key-status').then(res => res.json()).then(data => {
            if (data.isSet) { apiKeyOpenAIInput.parentElement.style.display = 'none'; }
        }).catch(error => console.error("无法检查 OpenAI API key 状态:", error));

        fetch('/api/modelscope-key-status').then(res => res.json()).then(data => {
            if (data.isSet) { apiKeyModelScopeInput.parentElement.style.display = 'none'; }
        }).catch(error => console.error("无法检查 ModelScope API key 状态:", error));
    }
    
    function saveStateForModel(modelId) {
        const state = modelStates[modelId];
        if (!state) return;
        
        if (modelId === 'nanobanana') {
            state.inputs.prompt = promptNanoBananaInput.value;
            state.inputs.files = selectedFilesNano;
        } else if (modelId === 'chatgpt') {
            state.inputs.prompt = promptChatGPTInput.value;
            state.inputs.files = selectedFilesChatGPT;
        } else {
            state.inputs.prompt = promptPositiveInput.value;
            state.inputs.negative_prompt = promptNegativeInput.value;
            state.inputs.size = sizeSelect.value;
            state.inputs.steps = parseInt(stepsInput.value, 10);
            state.inputs.guidance = parseFloat(guidanceInput.value);
            state.inputs.seed = parseInt(seedInput.value, 10);
            state.inputs.count = parseInt(modelscopeControls.querySelector('.count-btn.active').dataset.count, 10);
        }
    }

    function loadStateForCurrentModel() {
        const state = modelStates[currentModel];
        if (!state) return;
        
        updateActiveModelUI();
        
        if (currentModel === 'nanobanana') {
            promptNanoBananaInput.value = state.inputs.prompt;
            selectedFilesNano = state.inputs.files;
            thumbnailsContainerNano.innerHTML = '';
            selectedFilesNano.forEach(createThumbnail);
        } else if (currentModel === 'chatgpt') {
            promptChatGPTInput.value = state.inputs.prompt;
            selectedFilesChatGPT = state.inputs.files;
            thumbnailsContainerChatGPT.innerHTML = '';
            selectedFilesChatGPT.forEach(file => createThumbnail(file, 'chatgpt'));
        } else {
            promptPositiveInput.value = state.inputs.prompt;
            promptNegativeInput.value = state.inputs.negative_prompt;
            sizeSelect.value = state.inputs.size;
            stepsInput.value = state.inputs.steps;
            guidanceInput.value = state.inputs.guidance;
            seedInput.value = state.inputs.seed;
            countButtons.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.count, 10) === state.inputs.count);
            });
        }
        
        if (state.task.isRunning) {
            updateResultStatusWithSpinner(state.task.statusText || '正在生成中...');
        } else if (state.results.length > 0) {
            displayResults(state.results);
        } else {
            clearResults();
        }
        
        updateGenerateButtonState();
    }

    function clearResults() { 
        mainResultImageContainer.innerHTML = `<div class="image-preview-container"><p>生成的图片将显示在这里</p></div>`; 
        resultThumbnailsContainer.innerHTML = ''; 
        // 隐藏下载按钮
        if (downloadSection) {
            downloadSection.style.display = 'none';
        }
        if (downloadBtn) {
            downloadBtn.classList.add('hidden');
        }
    }
    
    // 下载功能相关函数
    function setupDownloadListeners() {
        downloadBtn.addEventListener('click', downloadImage);
    }
    
    function downloadImage() {
        if (!currentModel) {
            showDownloadError('请先选择一个模型');
            return;
        }
        
        let currentImageUrl = null;
        const mainImg = document.querySelector('#main-result-image img');
        if (mainImg) {
            currentImageUrl = mainImg.src;
        } else {
            showDownloadError('没有找到可下载的图片');
            return;
        }
        
        if (!currentImageUrl || currentImageUrl.includes('placeholder')) {
            showDownloadError('请先生成图片');
            return;
        }
        
        const filename = `generated-image-${Date.now()}.png`;
        
        downloadBtn.disabled = true;
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = `<div class="spinner"></div>下载中...`;
        
        fetch(currentImageUrl)
            .then(response => {
                if (!response.ok) throw new Error('下载失败');
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showDownloadSuccess();
            })
            .catch(error => {
                console.error('下载失败详细信息:', {
                    error: error,
                    message: error.message,
                    stack: error.stack,
                    url: currentImageUrl,
                    filename: filename
                });
                showDownloadError(error.message || '下载失败');
            })
            .finally(() => {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalText;
            });
    }
    
    function showDownloadSuccess() {
        const hint = document.createElement('div');
        hint.className = 'download-success-hint';
        hint.innerHTML = '✅ 图片下载成功';
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    function showDownloadError(message = '图片下载失败') {
        const hint = document.createElement('div');
        hint.className = 'download-error-hint';
        hint.innerHTML = `❌ ${message}`;
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    // 提示词优化功能相关函数
    function setupPromptOptimizationListeners() {
        // 按钮点击事件
        chatgptOptimizeBtn.addEventListener('click', () => optimizePrompt('chatgpt', promptChatGPTInput));
        nanobananaOptimizeBtn.addEventListener('click', () => optimizePrompt('nanobanana', promptNanoBananaInput));
        modelscopeOptimizeBtn.addEventListener('click', () => optimizePrompt('modelscope', promptPositiveInput));
    }
    
    function optimizePrompt(model, inputElement) {
        const originalPrompt = inputElement.value.trim();
        if (!originalPrompt) {
            showOptimizationError('请先输入提示词');
            return;
        }
        
        showOptimizationLoading('正在优化提示词...');
        
        fetch('/prompt-optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: originalPrompt,
                targetModel: model,
                apikey: getApiKeyForModel(model)
            })
        })
        .then(response => {
            if (!response.ok) throw new Error('请求失败');
            return response.json();
        })
        .then(data => {
            if (data.success && data.optimizedPrompt) {
                inputElement.value = data.optimizedPrompt;
                showOptimizationSuccess('提示词优化成功');
                saveState();
            } else {
                throw new Error(data.error || '优化失败');
            }
        })
        .catch(error => {
            console.error('提示词优化失败:', error);
            showOptimizationError(error.message || '提示词优化失败，请稍后重试');
        });
    }
    
    function showOptimizationSuccess(message) {
        const hint = document.createElement('div');
        hint.className = 'optimization-success-hint';
        hint.innerHTML = '✅ ' + message;
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }
    
    function showOptimizationError(message) {
        const hint = document.createElement('div');
        hint.className = 'optimization-error-hint';
        hint.innerHTML = '❌ ' + message;
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 3000);
    }
    
    function showOptimizationLoading(message) {
        const loadingHint = document.createElement('div');
        loadingHint.className = 'optimization-loading-hint';
        loadingHint.innerHTML = `🔄 ${message}`;
        loadingHint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
        `;
        
        document.body.appendChild(loadingHint);
        
        setTimeout(() => {
            if (loadingHint.parentNode) {
                loadingHint.parentNode.removeChild(loadingHint);
            }
        }, 10000);
    }
    
    function getApiKeyForModel(model) {
        switch(model) {
            case 'chatgpt': return apiKeyOpenAIInput?.value || '';
            case 'nanobanana': return apiKeyOpenRouterInput?.value || '';
            case 'modelscope': return apiKeyModelScopeInput?.value || '';
            default: return '';
        }
    }
    
    function setupModalListeners() {
        closeModalBtn.onclick = () => { fullscreenModal.classList.add('hidden'); };
        fullscreenModal.onclick = (e) => { if (e.target === fullscreenModal) { fullscreenModal.classList.add('hidden'); } };
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !fullscreenModal.classList.contains('hidden')) { fullscreenModal.classList.add('hidden'); } });
    }

    function openModal(imageUrl) { modalImage.src = imageUrl; fullscreenModal.classList.remove('hidden'); }
    
    function setupTheme() {
        function applyTheme(theme) { body.className = theme + '-mode'; localStorage.setItem('theme', theme); }
        themeToggleBtn.addEventListener('click', () => { const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark'; applyTheme(newTheme); });
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) { applyTheme(savedTheme); } else if (prefersDark) { applyTheme('dark'); } else { applyTheme('light'); }
    }
    
    function setUniformButtonWidth() {
        let maxWidth = 0;
        modelCards.forEach(card => { card.style.width = 'auto'; const cardWidth = card.offsetWidth; if (cardWidth > maxWidth) { maxWidth = cardWidth; } });
        modelCards.forEach(card => { card.style.width = `${maxWidth}px`; });
        updateHighlightPosition();
    }

    function updateHighlightPosition() {
        const activeButton = modelSelectorContainer.querySelector('.model-card.active');
        if (activeButton) { const left = activeButton.offsetLeft; const width = activeButton.offsetWidth; modelSelectorContainer.style.setProperty('--highlight-left', `${left}px`); modelSelectorContainer.style.setProperty('--highlight-width', `${width}px`); }
    }

    function updateActiveModelUI() {
        // 隐藏所有控制面板
        nanobananaControls.classList.add('hidden');
        chatgptControls.classList.add('hidden');
        modelscopeControls.classList.add('hidden');
        
        // 显示当前模型的控制面板
        if (currentModel === 'nanobanana') { 
            nanobananaControls.classList.remove('hidden'); 
        } else if (currentModel === 'chatgpt') { 
            chatgptControls.classList.remove('hidden'); 
        } else { 
            modelscopeControls.classList.remove('hidden'); 
        }
        
        // 清除提示词备注
        nanobananaPromptRemark.textContent = '';
        chatgptPromptRemark.textContent = '';
        modelscopePromptRemark.textContent = '';
        modelscopeNegativePromptRemark.textContent = '';
        
        // 设置提示词备注
        if (currentModel === 'nanobanana') { 
            nanobananaPromptRemark.textContent = '(支持中文提示词)'; 
        } else if (currentModel === 'chatgpt') { 
            chatgptPromptRemark.textContent = '(支持中文提示词)'; 
        } else {
            let remarkText = '';
            if (currentModel === 'Qwen/Qwen-Image') { 
                remarkText = '(支持中文提示词)'; 
            } else if (currentModel.includes('FLUX') || currentModel.includes('Kontext') || currentModel.includes('Krea')) { 
                remarkText = '(请使用英文提示词)'; 
            }
            modelscopePromptRemark.textContent = remarkText;
            modelscopeNegativePromptRemark.textContent = remarkText;
        }
    }
    
    function setupInputValidation() {
        const inputsToValidate = [stepsInput, guidanceInput, seedInput];
        inputsToValidate.forEach(input => {
            input.addEventListener('input', () => validateInput(input));
            if (input.id === 'seed-input') { input.addEventListener('change', () => validateInput(input)); }
        });
    }

    function validateInput(inputElement) {
        const min = inputElement.dataset.min ? parseFloat(inputElement.dataset.min) : null;
        const max = inputElement.dataset.max ? parseFloat(inputElement.dataset.max) : null;
        const value = inputElement.value;
        const errorMessageElement = inputElement.nextElementSibling;
        if (value === '') { errorMessageElement.classList.add('hidden'); inputElement.classList.remove('input-error'); return true; }
        const numValue = parseFloat(value);
        let isValid = true;
        let errorMessage = '';
        if (min !== null && numValue < min) { isValid = false; errorMessage = max !== null ? `值必须在 ${min} 和 ${max} 之间` : `值必须大于等于 ${min}`; } 
        else if (max !== null && numValue > max) { isValid = false; errorMessage = `值必须在 ${min} 和 ${max} 之间`; }
        if (inputElement.step === "1" || !inputElement.step) { if (!Number.isInteger(numValue)) { isValid = false; errorMessage = '请输入一个整数'; } }
        if (isValid) { errorMessageElement.classList.add('hidden'); errorMessageElement.textContent = ''; inputElement.classList.remove('input-error'); } 
        else { errorMessageElement.classList.remove('hidden'); errorMessageElement.textContent = errorMessage; inputElement.classList.add('input-error'); }
        return isValid;
    }

    function updateGenerateButtonState() {
        const isTaskRunning = modelStates[currentModel].task.isRunning;
        const currentPanel = (currentModel === 'nanobanana') ? nanobananaControls : (currentModel === 'chatgpt') ? chatgptControls : modelscopeControls;
        const currentButton = currentPanel.querySelector('.generate-btn');
        const btnText = currentButton.querySelector('.btn-text');
        const spinner = currentButton.querySelector('.spinner');
        setLoading(isTaskRunning, currentButton, btnText, spinner);
    }

    function setupFileUploads() {
        // Nano Banana 文件上传
        ['dragenter', 'dragover'].forEach(eventName => uploadAreaNano.addEventListener(eventName, () => uploadAreaNano.classList.add('drag-over')));
        ['dragleave', 'drop'].forEach(eventName => uploadAreaNano.addEventListener(eventName, () => uploadAreaNano.classList.remove('drag-over')));
        uploadAreaNano.addEventListener('drop', (e) => handleFiles(Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/')), 'nanobanana'));
        fileInputNano.addEventListener('change', (e) => handleFiles(Array.from(e.target.files).filter(file => file.type.startsWith('image/')), 'nanobanana'));
        
        // ChatGPT 文件上传
        ['dragenter', 'dragover'].forEach(eventName => uploadAreaChatGPT.addEventListener(eventName, () => uploadAreaChatGPT.classList.add('drag-over')));
        ['dragleave', 'drop'].forEach(eventName => uploadAreaChatGPT.addEventListener(eventName, () => uploadAreaChatGPT.classList.remove('drag-over')));
        uploadAreaChatGPT.addEventListener('drop', (e) => handleFiles(Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/')), 'chatgpt'));
        fileInputChatGPT.addEventListener('change', (e) => handleFiles(Array.from(e.target.files).filter(file => file.type.startsWith('image/')), 'chatgpt'));

        // 添加粘贴功能
        setupPasteFunctionality();
    }

    function setupPasteFunctionality() {
        let isMouseOverNano = false;
        let isMouseOverChatGPT = false;

        // 监听鼠标进入/离开上传区域
        uploadAreaNano.addEventListener('mouseenter', () => { isMouseOverNano = true; });
        uploadAreaNano.addEventListener('mouseleave', () => { isMouseOverNano = false; });
        
        uploadAreaChatGPT.addEventListener('mouseenter', () => { isMouseOverChatGPT = true; });
        uploadAreaChatGPT.addEventListener('mouseleave', () => { isMouseOverChatGPT = false; });

        // 监听键盘事件（全局级别，因为剪贴板事件需要在文档级别捕获）
        document.addEventListener('keydown', async (e) => {
            // 检查是否按下 Ctrl+V 或 Cmd+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                
                // 鼠标在哪个区域就处理哪个区域
                if (isMouseOverChatGPT) {
                    await handlePasteImage('chatgpt');
                } else if (isMouseOverNano) {
                    await handlePasteImage('nanobanana');
                }
            }
        });
    }

    async function handlePasteImage(modelId) {
        try {
            // 尝试多种方法获取剪贴板内容
            
            // 方法1: 使用现代 Clipboard API 获取图片数据
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            const file = new File([blob], `pasted-image-${Date.now()}.${type.split('/')[1]}`, { type });
                            handleFiles([file], modelId);
                            showPasteSuccessHint(modelId);
                            return;
                        }
                    }
                }
            } catch (err) {
                console.log('现代剪贴板API不可用:', err.message);
            }

            // 方法2: 尝试从文件系统中获取（适用于从文件管理器复制的文件）
            if (navigator.clipboard && navigator.clipboard.readFiles) {
                try {
                    const files = await navigator.clipboard.readFiles();
                    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                    if (imageFiles.length > 0) {
                        handleFiles(imageFiles, modelId);
                        showPasteSuccessHint(modelId);
                        return;
                    }
                } catch (err) {
                    console.log('文件读取API不可用:', err.message);
                }
            }

            // 方法3: 监听paste事件（适用于从Finder等复制的文件）
            try {
                const data = await new Promise((resolve) => {
                    const handlePaste = (e) => {
                        if (e.clipboardData && e.clipboardData.files) {
                            const imageFiles = Array.from(e.clipboardData.files).filter(file => file.type.startsWith('image/'));
                            if (imageFiles.length > 0) {
                                document.removeEventListener('paste', handlePaste);
                                resolve(imageFiles);
                            }
                        }
                    };
                    document.addEventListener('paste', handlePaste, { once: true });
                    
                    // 触发粘贴事件
                    const pasteEvent = new ClipboardEvent('paste');
                    Object.defineProperty(pasteEvent, 'clipboardData', { value: {
                        files: []
                    }});
                    document.dispatchEvent(pasteEvent);
                    
                    // 如果2秒内没有获取到数据，清理
                    setTimeout(() => {
                        document.removeEventListener('paste', handlePaste);
                        resolve([]);
                    }, 2000);
                });
                
                if (data && data.length > 0) {
                    handleFiles(data, modelId);
                    showPasteSuccessHint(modelId);
                    return;
                }
            } catch (err) {
                console.log('Paste事件监听失败:', err.message);
            }
            
            showPasteNoImageHint();
            
        } catch (error) {
            console.error('粘贴图片失败:', error);
            showPasteErrorHint();
        }
    }

    function showPasteSuccessHint(modelId) {
        const container = modelId === 'chatgpt' ? uploadAreaChatGPT : uploadAreaNano;
        const hint = document.createElement('div');
        hint.className = 'paste-success-hint';
        hint.innerHTML = '✅ 图片已粘贴成功';
        hint.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #4CAF50;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        container.style.position = 'relative';
        container.appendChild(hint);
        
        // 2秒后移除提示
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    function showPasteNoImageHint() {
        const hint = document.createElement('div');
        hint.className = 'paste-no-image-hint';
        hint.innerHTML = '❌ 剪贴板中没有图片';
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FF6B6B;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    function showPasteErrorHint() {
        const hint = document.createElement('div');
        hint.className = 'paste-error-hint';
        hint.innerHTML = '❌ 粘贴失败，请重试';
        hint.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FF6B6B;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    function handleFiles(files, modelId) {
        if (modelId === 'nanobanana') {
            files.forEach(file => {
                if (!selectedFilesNano.some(f => f.name === file.name)) {
                    selectedFilesNano.push(file);
                    createThumbnail(file, 'nanobanana');
                }
            });
        } else if (modelId === 'chatgpt') {
            files.forEach(file => {
                if (!selectedFilesChatGPT.some(f => f.name === file.name)) {
                    selectedFilesChatGPT.push(file);
                    createThumbnail(file, 'chatgpt');
                }
            });
        }
    }

    function createThumbnail(file, modelId) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div'); 
            wrapper.className = 'thumbnail-wrapper';
            const img = document.createElement('img'); 
            img.src = e.target.result; 
            img.alt = file.name;
            const removeBtn = document.createElement('button'); 
            removeBtn.className = 'remove-btn'; 
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                if (modelId === 'nanobanana') {
                    selectedFilesNano = selectedFilesNano.filter(f => f.name !== file.name);
                } else if (modelId === 'chatgpt') {
                    selectedFilesChatGPT = selectedFilesChatGPT.filter(f => f.name !== file.name);
                }
                wrapper.remove();
            };
            wrapper.appendChild(img); 
            wrapper.appendChild(removeBtn);
            
            if (modelId === 'nanobanana') {
                thumbnailsContainerNano.appendChild(wrapper);
            } else if (modelId === 'chatgpt') {
                thumbnailsContainerChatGPT.appendChild(wrapper);
            }
        };
        reader.readAsDataURL(file);
    }

    modelCards.forEach(card => {
        card.addEventListener('click', () => {
            saveStateForModel(currentModel);
            currentModel = card.dataset.model;
            modelCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            loadStateForCurrentModel();
            updateHighlightPosition();
        });
    });

    countButtons.forEach(button => {
        button.addEventListener('click', () => {
            countButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
    
    window.addEventListener('resize', setUniformButtonWidth);

    generateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modelToGenerate = currentModel;
            if (modelStates[modelToGenerate].task.isRunning) {
                alert('当前模型有任务正在生成中，请稍候...');
                return;
            }
            saveStateForModel(modelToGenerate);
            runGenerationTask(modelToGenerate, btn);
        });
    });

    async function runGenerationTask(modelId, btn) {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        const state = modelStates[modelId];
        
        try {
            state.task.isRunning = true;
            setLoading(true, btn, btnText, spinner);
            
            const statusUpdate = (text) => {
                state.task.statusText = text;
                if (modelId === currentModel) {
                    updateResultStatusWithSpinner(text);
                }
            };
            
            statusUpdate('准备请求...');

            let imageUrls;
            if (modelId === 'nanobanana') {
                imageUrls = await handleNanoBananaGeneration(statusUpdate);
            } else if (modelId === 'chatgpt') {
                imageUrls = await handleChatGPTGeneration(statusUpdate);
            } else {
                imageUrls = await handleModelScopeGeneration(statusUpdate);
            }
            
            state.results = imageUrls;

            if (modelId === currentModel) {
                displayResults(imageUrls);
            }

        } catch (error) {
            if (modelId === currentModel) {
                updateResultStatus(error.message);
            }
            console.error(`模型 ${modelId} 生成失败:`, error);
        } finally {
            state.task.isRunning = false;
            state.task.statusText = '';
            if (modelId === currentModel) {
                setLoading(false, btn, btnText, spinner);
            }
        }
    }
    
    async function fetchWithTimeout(resource, options, timeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    }

    async function handleNanoBananaGeneration(statusUpdate) {
        if (apiKeyOpenRouterInput.parentElement.style.display !== 'none' && !apiKeyOpenRouterInput.value.trim()) { throw new Error('请输入 OpenRouter API 密钥'); }
        if (!promptNanoBananaInput.value.trim()) { throw new Error('请输入提示词'); }
        statusUpdate('正在生成图片...');
        const base64Images = await Promise.all(selectedFilesNano.map(fileToBase64));
        const requestBody = { model: 'nanobanana', prompt: modelStates.nanobanana.inputs.prompt, images: base64Images, apikey: apiKeyOpenRouterInput.value };
        const response = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        const data = await response.json();
        if (!response.ok || data.error) { throw new Error(data.error || `服务器错误: ${response.status}`); }
        return [data.imageUrl];
    }

    async function handleChatGPTGeneration(statusUpdate) {
        if (apiKeyOpenAIInput.parentElement.style.display !== 'none' && !apiKeyOpenAIInput.value.trim()) { throw new Error('请输入 OpenAI API 密钥'); }
        if (!promptChatGPTInput.value.trim()) { throw new Error('请输入提示词'); }
        statusUpdate('正在生成图片...');
        const base64Images = await Promise.all(selectedFilesChatGPT.map(fileToBase64));
        const requestBody = { model: 'chatgpt', prompt: modelStates.chatgpt.inputs.prompt, images: base64Images, apikey: apiKeyOpenAIInput.value };
        const response = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        const data = await response.json();
        if (!response.ok || data.error) { throw new Error(data.error || `服务器错误: ${response.status}`); }
        return [data.imageUrl];
    }

    async function handleModelScopeGeneration(statusUpdate) {
        const inputs = modelStates[currentModel].inputs;
        const isStepsValid = validateInput(stepsInput);
        const isGuidanceValid = validateInput(guidanceInput);
        const isSeedValid = validateInput(seedInput);
        if (!isStepsValid || !isGuidanceValid || !isSeedValid) { throw new Error('请修正参数错误后再生成'); }
        if (apiKeyModelScopeInput.parentElement.style.display !== 'none' && !apiKeyModelScopeInput.value.trim()) { throw new Error('请输入 Modelscope 的 API Key'); }
        if (!inputs.prompt) { throw new Error('请输入正向提示词'); }
        
        const isQwen = currentModel.includes('Qwen');
        const timeoutPerRequest = isQwen ? 120 * 1000 : 180 * 1000;
        const totalTimeout = isQwen ? 360 * 1000 : timeoutPerRequest;
        
        const baseRequestBody = { model: currentModel, apikey: apiKeyModelScopeInput.value, parameters: { prompt: inputs.prompt, negative_prompt: inputs.negative_prompt, size: inputs.size, steps: inputs.steps, guidance: inputs.guidance, seed: inputs.seed }, timeout: timeoutPerRequest / 1000 };
        const results = [];
        const controller = new AbortController();
        const overallTimeoutId = setTimeout(() => controller.abort(), totalTimeout);
        try {
            if (isQwen && inputs.count > 1) {
                for (let i = 0; i < inputs.count; i++) {
                    statusUpdate(`正在生成 ${i + 1}/${inputs.count} 张图片...`);
                    const requestBody = JSON.parse(JSON.stringify(baseRequestBody));
                    if (requestBody.parameters.seed === -1) { requestBody.parameters.seed = Math.floor(Math.random() * (2**31 - 1)); }
                    const response = await fetchWithTimeout('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }, timeoutPerRequest);
                    const data = await response.json();
                    if (!response.ok || data.error) { throw new Error(`第 ${i + 1} 张图片生成失败: ${data.error}`); }
                    results.push(data);
                }
            } else {
                const fetchPromises = [];
                for (let i = 0; i < inputs.count; i++) {
                    const requestBody = JSON.parse(JSON.stringify(baseRequestBody));
                    if (requestBody.parameters.seed === -1) { requestBody.parameters.seed = Math.floor(Math.random() * (2**31 - 1)); }
                    fetchPromises.push(fetchWithTimeout('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }, timeoutPerRequest));
                }
                statusUpdate(`正在生成 1/${inputs.count} 张图片...`);
                let completedCount = 0;
                const processPromise = async (promise) => {
                    const response = await promise;
                    const data = await response.json();
                    completedCount++;
                    const statusText = (completedCount < inputs.count) ? `正在生成 ${completedCount + 1}/${inputs.count} 张图片...` : `已完成 ${completedCount}/${inputs.count} 张图片...`;
                    statusUpdate(statusText);
                    if (!response.ok || data.error) { return { error: `第 ${completedCount} 张图片生成失败: ${data.error}` }; }
                    return data;
                };
                const parallelResults = await Promise.all(fetchPromises.map(processPromise));
                const firstError = parallelResults.find(r => r.error);
                if (firstError) { throw new Error(firstError.error); }
                results.push(...parallelResults);
            }
            clearTimeout(overallTimeoutId);
            return results.map(data => data.imageUrl);
        } catch (error) {
            clearTimeout(overallTimeoutId);
            if (error.name === 'AbortError') { throw new Error('生成超时，请稍后再试。'); }
            throw error;
        }
    }

    function displayResults(imageUrls) {
        if (!imageUrls || imageUrls.length === 0 || !imageUrls[0]) { 
            updateResultStatus("模型没有返回有效的图片URL。"); 
            return; 
        }
        
        mainResultImageContainer.innerHTML = ''; 
        resultThumbnailsContainer.innerHTML = '';
        
        const imagePreviewContainer = document.createElement('div');
        imagePreviewContainer.className = 'image-preview-container';
        
        const mainImg = document.createElement('img');
        mainImg.src = imageUrls[0];
        mainImg.onclick = () => openModal(mainImg.src);
        
        imagePreviewContainer.appendChild(mainImg);
        mainResultImageContainer.appendChild(imagePreviewContainer);
        
        if (imageUrls.length > 1) {
            imageUrls.forEach((url, index) => {
                if (index === 0) return; // 跳过大图
                const thumbImg = document.createElement('img');
                thumbImg.src = url;
                thumbImg.className = 'result-thumb';
                thumbImg.onclick = () => openModal(thumbImg.src);
                
                if (index === 0) { thumbImg.classList.add('active'); }
                thumbImg.addEventListener('click', () => { 
                    mainImg.src = thumbImg.src; 
                    document.querySelectorAll('.result-thumb').forEach(t => t.classList.remove('active')); 
                    thumbImg.classList.add('active'); 
                });
                resultThumbnailsContainer.appendChild(thumbImg);
            });
        }
        
        // 显示下载按钮
        if (downloadSection) {
            downloadSection.style.display = 'flex';
        }
        if (downloadBtn) {
            downloadBtn.classList.remove('hidden');
        }
    }

    function updateResultStatus(text) { 
        mainResultImageContainer.innerHTML = `<div class="image-preview-container"><p>${text}</p></div>`; 
        resultThumbnailsContainer.innerHTML = '';
        // 隐藏下载按钮
        if (downloadSection) {
            downloadSection.style.display = 'none';
        }
        if (downloadBtn) {
            downloadBtn.classList.add('hidden');
        }
    }
    function updateResultStatusWithSpinner(text) { 
        mainResultImageContainer.innerHTML = `<div class="image-preview-container"><div class="loading-spinner"></div><p>${text}</p></div>`; 
        resultThumbnailsContainer.innerHTML = '';
        // 隐藏下载按钮
        if (downloadSection) {
            downloadSection.style.display = 'none';
        }
        if (downloadBtn) {
            downloadBtn.classList.add('hidden');
        }
    }
    
    function setLoading(isLoading, btn, btnText, spinner) {
        btn.disabled = isLoading;
        btnText.textContent = isLoading ? '正在生成...' : '生成';
        spinner.classList.toggle('hidden', !isLoading);
    }

    function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
    
    initialize();
});