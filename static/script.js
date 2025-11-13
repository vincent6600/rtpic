document.addEventListener('DOMContentLoaded', async () => {

    // ============== 全局变量和状态管理 ==============
    let state = {
        currentModel: 'chatgpt',
        apiKeys: {
            openai: '',
            openrouter: '',
            modelscope: ''
        },
        isGenerating: false,
        abortController: null,
        history: [],
        theme: 'light',
        spaceCount: 0,
        lastSpaceTrigger: 0
    };

    // ============== 元素获取 ==============
    const body = document.body;
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const modelCards = document.querySelectorAll('.model-card');
    const controlPanels = document.querySelectorAll('.control-panel');
    
    // API密钥输入框
    const apiKeyInputOpenAI = document.getElementById('api-key-input-openai');
    const apiKeyInputOpenRouter = document.getElementById('api-key-input-openrouter');
    const apiKeyInputModelScope = document.getElementById('api-key-input-modelscope');
    
    // 提示词输入框
    const promptInputChatGPT = document.getElementById('prompt-input-chatgpt');
    const promptInputNanoBanana = document.getElementById('prompt-input-nanobanana');
    const promptInputPositive = document.getElementById('prompt-input-positive');
    const promptInputNegative = document.getElementById('prompt-input-negative');
    
    // 优化按钮
    const optimizeButtons = document.querySelectorAll('.prompt-optimize-btn');
    
    // 图片上传相关
    const imageUploadChatGPT = document.getElementById('image-upload-chatgpt');
    const imageUpload = document.getElementById('image-upload');
    const thumbnailsContainerChatGPT = document.getElementById('thumbnails-container-chatgpt');
    const thumbnailsContainer = document.getElementById('thumbnails-container');
    
    // 生成按钮
    const generateButtons = document.querySelectorAll('.generate-btn');
    
    // 结果展示
    const mainResultImage = document.getElementById('main-result-image');
    const resultThumbnails = document.getElementById('result-thumbnails');
    
    // 模态框
    const fullscreenModal = document.getElementById('fullscreen-modal');
    const modalImage = document.getElementById('modal-image');
    const closeBtn = document.querySelector('.close-btn');
    
    // 优化相关元素
    const optimizeToastContainer = document.getElementById('optimize-toast-container');
    const spaceFeedback = document.getElementById('space-trigger-feedback');

    // ============== 主题切换功能 ==============
    function initThemeToggle() {
        // 从localStorage获取主题设置
        const savedTheme = localStorage.getItem('rtpic_theme') || 'light';
        applyTheme(savedTheme);

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('rtpic_theme', newTheme);
        });
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
        }
        state.theme = theme;
    }

    // ============== 模型切换功能 ==============
    function initModelSelector() {
        // 默认选择第一个模型
        const firstModelCard = document.querySelector('.model-card.active') || modelCards[0];
        if (firstModelCard) {
            switchModel(firstModelCard.dataset.model);
        }

        modelCards.forEach(card => {
            card.addEventListener('click', () => {
                const modelId = card.dataset.model;
                switchModel(modelId);
            });
        });
    }

    function switchModel(modelId) {
        state.currentModel = modelId;
        
        // 更新模型选择器UI
        modelCards.forEach(card => {
            card.classList.remove('active');
            if (card.dataset.model === modelId) {
                card.classList.add('active');
            }
        });

        // 更新控制面板显示
        controlPanels.forEach(panel => {
            panel.classList.add('hidden');
        });
        
        const activePanel = document.getElementById(`${modelId}-controls`);
        if (activePanel) {
            activePanel.classList.remove('hidden');
        }

        // 恢复该模型的保存状态
        restoreModelState(modelId);
        
        // 保存当前状态
        saveModelState(modelId);
    }

    function saveModelState(modelId) {
        const inputs = getModelInputs(modelId);
        localStorage.setItem(`rtpic_${modelId}_state`, JSON.stringify(inputs));
    }

    function restoreModelState(modelId) {
        try {
            const savedState = localStorage.getItem(`rtpic_${modelId}_state`);
            if (savedState) {
                const inputs = JSON.parse(savedState);
                const inputElements = getModelInputs(modelId);
                
                if (inputElements.prompt) inputElements.prompt.value = inputs.prompt || '';
                if (inputElements.negative) inputElements.negative.value = inputs.negative || '';
                if (inputElements.seed) inputElements.seed.value = inputs.seed || '-1';
                if (inputElements.steps) inputElements.steps.value = inputs.steps || '30';
                if (inputElements.guidance) inputElements.guidance.value = inputs.guidance || '3.5';
            }
        } catch (error) {
            console.error('恢复模型状态失败:', error);
        }
    }

    function getModelInputs(modelId) {
        switch (modelId) {
            case 'chatgpt':
                return {
                    prompt: promptInputChatGPT,
                    negative: null
                };
            case 'nanobanana':
                return {
                    prompt: promptInputNanoBanana,
                    negative: null
                };
            case 'Qwen/Qwen-Image':
            case 'MusePublic/489_ckpt_FLUX_1':
            case 'MusePublic/FLUX.1-Kontext-Dev':
            case 'black-forest-labs/FLUX.1-Krea-dev':
                return {
                    prompt: promptInputPositive,
                    negative: promptInputNegative,
                    seed: document.getElementById('seed-input'),
                    steps: document.getElementById('steps-input'),
                    guidance: document.getElementById('guidance-input')
                };
            default:
                return {
                    prompt: promptInputPositive,
                    negative: promptInputNegative
                };
        }
    }

    // ============== API密钥管理 ==============
    function initApiKeyManagement() {
        // 从localStorage恢复API密钥
        const savedKeys = {
            openai: localStorage.getItem('rtpic_openai_key') || '',
            openrouter: localStorage.getItem('rtpic_openrouter_key') || '',
            modelscope: localStorage.getItem('rtpic_modelscope_key') || ''
        };

        apiKeyInputOpenAI.value = savedKeys.openai;
        apiKeyInputOpenRouter.value = savedKeys.openrouter;
        apiKeyInputModelScope.value = savedKeys.modelscope;

        state.apiKeys = savedKeys;

        // API密钥输入事件
        apiKeyInputOpenAI.addEventListener('input', (e) => {
            state.apiKeys.openai = e.target.value;
            localStorage.setItem('rtpic_openai_key', e.target.value);
        });

        apiKeyInputOpenRouter.addEventListener('input', (e) => {
            state.apiKeys.openrouter = e.target.value;
            localStorage.setItem('rtpic_openrouter_key', e.target.value);
        });

        apiKeyInputModelScope.addEventListener('input', (e) => {
            state.apiKeys.modelscope = e.target.value;
            localStorage.setItem('rtpic_modelscope_key', e.target.value);
        });
    }

    // ============== 图片上传功能 ==============
    function initImageUpload() {
        // ChatGPT模型图片上传
        const uploadAreaChatGPT = document.querySelector('#chatgpt-controls .upload-area');
        if (uploadAreaChatGPT) {
            setupDragAndDrop(uploadAreaChatGPT, 'chatgpt');
        }

        // 其他模型图片上传
        const uploadArea = document.querySelector('#nanobanana-controls .upload-area, #modelscope-controls .upload-area');
        if (uploadArea) {
            setupDragAndDrop(uploadArea, 'general');
        }

        // 文件输入
        imageUploadChatGPT?.addEventListener('change', handleImageUpload);
        imageUpload?.addEventListener('change', handleImageUpload);
    }

    function setupDragAndDrop(uploadArea, modelType) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            handleFileUpload(files, modelType);
        });

        uploadArea.addEventListener('click', () => {
            const fileInput = modelType === 'chatgpt' ? imageUploadChatGPT : imageUpload;
            fileInput?.click();
        });
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageUpload(e) {
        const files = e.target.files;
        const modelType = e.target.id.includes('chatgpt') ? 'chatgpt' : 'general';
        handleFileUpload(files, modelType);
    }

    function handleFileUpload(files, modelType) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            showToast('请上传图片文件', 'error');
            return;
        }

        const container = modelType === 'chatgpt' ? thumbnailsContainerChatGPT : thumbnailsContainer;
        
        imageFiles.forEach(file => {
            createThumbnail(file, container);
        });
    }

    function createThumbnail(file, container) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'thumbnail-wrapper';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'thumbnail';
            
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.className = 'remove-btn';
            removeBtn.onclick = () => wrapper.remove();
            
            wrapper.appendChild(img);
            wrapper.appendChild(removeBtn);
            container.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
    }

    // ============== 生成功能 ==============
    function initGenerateButtons() {
        generateButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                await handleGenerate(state.currentModel);
            });
        });
    }

    async function handleGenerate(modelId) {
        if (state.isGenerating) {
            showToast('正在生成中，请稍候...', 'warn');
            return;
        }

        const inputs = getModelInputs(modelId);
        if (!inputs.prompt.value.trim()) {
            showToast('请输入提示词', 'warn');
            return;
        }

        const requestData = {
            model: modelId,
            prompt: inputs.prompt.value,
            negative_prompt: inputs.negative?.value || '',
            images: getUploadedImages()
        };

        // 添加参数
        if (inputs.seed) requestData.seed = parseInt(inputs.seed.value) || -1;
        if (inputs.steps) requestData.steps = parseInt(inputs.steps.value) || 30;
        if (inputs.guidance) requestData.guidance = parseFloat(inputs.guidance.value) || 3.5;

        try {
            state.isGenerating = true;
            setButtonLoading(true);
            
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`生成失败: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data.images);
            
        } catch (error) {
            console.error('生成失败:', error);
            showToast('生成失败，请重试', 'error');
        } finally {
            state.isGenerating = false;
            setButtonLoading(false);
        }
    }

    function setButtonLoading(loading) {
        generateButtons.forEach(btn => {
            const spinner = btn.querySelector('.spinner');
            const btnText = btn.querySelector('.btn-text');
            
            if (loading) {
                spinner.classList.remove('hidden');
                btnText.textContent = '生成中...';
                btn.disabled = true;
            } else {
                spinner.classList.add('hidden');
                btnText.textContent = '生成';
                btn.disabled = false;
            }
        });
    }

    function getUploadedImages() {
        // 返回已上传的图片数据
        const images = [];
        const thumbnails = document.querySelectorAll('.thumbnail');
        thumbnails.forEach(img => {
            images.push(img.src);
        });
        return images;
    }

    function displayResults(images) {
        mainResultImage.innerHTML = '';
        resultThumbnails.innerHTML = '';

        if (images && images.length > 0) {
            // 显示主图
            const mainImg = document.createElement('img');
            mainImg.src = images[0];
            mainImg.alt = '生成结果';
            mainImg.addEventListener('click', () => openFullscreen(images[0]));
            mainResultImage.appendChild(mainImg);

            // 显示缩略图
            images.forEach((image, index) => {
                const thumb = document.createElement('img');
                thumb.src = image;
                thumb.className = 'result-thumb';
                if (index === 0) thumb.classList.add('active');
                thumb.addEventListener('click', () => {
                    mainImg.src = image;
                    document.querySelectorAll('.result-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                resultThumbnails.appendChild(thumb);
            });
        } else {
            mainResultImage.innerHTML = '<p>暂无生成结果</p>';
        }
    }

    // ============== 提示词优化功能 ==============
    function initPromptOptimization() {
        // 绑定优化按钮点击事件
        optimizeButtons.forEach(button => {
            button.addEventListener('click', () => handleOptimizeButtonClick(button));
        });

        // 绑定空格触发事件
        bindSpaceTriggerEvents();

        // 加载角色提示词
        loadSystemPrompt();
    }

    let systemPrompt = '';
    
    async function loadSystemPrompt() {
        try {
            const response = await fetch('./prompt_system.txt');
            if (response.ok) {
                systemPrompt = await response.text();
            } else {
                // 如果无法加载文件，使用默认提示词
                systemPrompt = `你是一位专业的电商产品主图提示词优化专家，专门负责优化AI图像生成的提示词。

## 你的任务
将用户输入的基础提示词进行专业优化扩写，重点关注电商产品主图的视觉效果。

## 优化维度
1. **产品特征**：详细描述产品的材质、质感、细节
2. **光线效果**：专业摄影级别的光线设置
3. **背景设计**：简洁专业的背景或场景设计
4. **构图布局**：适合电商展示的构图
5. **质感提升**：突出产品的高端质感

## 输出要求
- 保持原意的基础上，大幅扩展和细化
- 使用丰富的描述性词汇
- 确保每个维度都有具体描述
- 如果输入是中文，优化后如果是flux/krea等模型，请提供英文版本
- 直接输出优化后的提示词，不需要解释`;
            }
        } catch (error) {
            console.error('加载角色提示词失败:', error);
            systemPrompt = '你是一位专业的提示词优化专家。';
        }
    }

    async function handleOptimizeButtonClick(button) {
        const model = button.getAttribute('data-model');
        const input = getPromptInputByModel(model);
        
        if (!input || !input.value.trim()) {
            showToast('请先输入提示词内容', 'warn');
            return;
        }

        try {
            setButtonLoading(button, true);
            showToast('正在优化提示词...', 'info');
            
            const optimized = await optimizePrompt(input.value.trim(), model);
            
            if (optimized && optimized !== input.value.trim()) {
                input.value = optimized;
                input.dispatchEvent(new Event('input'));
                showToast('优化成功！', 'success');
            } else {
                showToast('优化结果与原内容相同', 'info');
            }
            
        } catch (error) {
            console.error('优化失败:', error);
            showToast('优化失败，请重试', 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    function getPromptInputByModel(model) {
        switch (model) {
            case 'chatgpt':
                return promptInputChatGPT;
            case 'nanobanana':
                return promptInputNanoBanana;
            case 'modelscope-positive':
                return promptInputPositive;
            case 'modelscope-negative':
                return promptInputNegative;
            default:
                return promptInputPositive;
        }
    }

    function setButtonLoading(button, loading) {
        const icon = button.querySelector('.optimize-icon');
        const text = button.querySelector('.optimize-text');
        
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
            icon.textContent = '⏳';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            icon.textContent = '✨';
            text.textContent = '提示词优化';
        }
    }

    async function optimizePrompt(prompt, model) {
        // 首先尝试API优化
        try {
            return await optimizeWithAPI(prompt, model);
        } catch (error) {
            console.error('API优化失败，使用本地优化:', error);
            return optimizeLocally(prompt, model);
        }
    }

    async function optimizeWithAPI(prompt, model) {
        const apiKey = state.apiKeys.openrouter;
        if (!apiKey) {
            throw new Error('未配置OpenRouter API密钥');
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请优化这个提示词: ${prompt}` }
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'RTPic Prompt Optimization'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status}`);
        }

        const data = await response.json();
        let optimized = data.choices[0]?.message?.content?.trim();

        // 如果是flux/krea等模型，需要翻译成英文
        if (['MusePublic/489_ckpt_FLUX_1', 'MusePublic/FLUX.1-Kontext-Dev', 'black-forest-labs/FLUX.1-Krea-dev'].includes(model)) {
            optimized = await translateToEnglish(optimized);
        }

        return optimized;
    }

    async function translateToEnglish(text) {
        try {
            const response = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                headers: {
                    'Authorization': 'DeepL-Auth-Key YOUR_API_KEY', // 需要替换为实际的API key
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `text=${encodeURIComponent(text)}&target_lang=EN`
            });

            if (response.ok) {
                const data = await response.json();
                return data.translations[0]?.text || text;
            } else {
                // 如果翻译API失败，返回原文
                console.warn('翻译失败，返回原文');
                return text;
            }
        } catch (error) {
            console.error('翻译失败:', error);
            return text; // 返回原文
        }
    }

    function optimizeLocally(prompt, model) {
        // 本地优化逻辑
        let optimized = prompt;

        // 添加质量关键词
        if (['chatgpt', 'nanobanana'].includes(model)) {
            // 中文模型优化
            if (!prompt.includes('高清')) optimized += '，高清细节，专业摄影质感';
            if (!prompt.includes('4K')) optimized += '，4K超清画质';
        } else {
            // 英文模型优化
            const qualityKeywords = ['masterpiece', 'best quality', 'highly detailed', '8k resolution', 'professional photography'];
            qualityKeywords.forEach(keyword => {
                if (!optimized.includes(keyword)) {
                    optimized += `, ${keyword}`;
                }
            });
        }

        // 添加构图建议
        const compositionTerms = ['professional composition', 'perfect lighting', 'clean background'];
        if (!optimized.includes('composition')) {
            optimized += `, ${compositionTerms[Math.floor(Math.random() * compositionTerms.length)]}`;
        }

        return optimized;
    }

    // ============== 空格触发功能 ==============
    function bindSpaceTriggerEvents() {
        const promptInputs = [
            promptInputChatGPT,
            promptInputNanoBanana,
            promptInputPositive,
            promptInputNegative
        ].filter(input => input);

        promptInputs.forEach(input => {
            let lastKeyTime = 0;
            const SPACE_DELAY = 500; // 500ms内连续按空格视为连续操作

            input.addEventListener('keydown', (e) => {
                const currentTime = Date.now();
                
                if (e.key === ' ') {
                    if (currentTime - lastKeyTime < SPACE_DELAY) {
                        state.spaceCount++;
                    } else {
                        state.spaceCount = 1;
                    }
                    lastKeyTime = currentTime;

                    // 检测到连续三个空格
                    if (state.spaceCount === 3) {
                        e.preventDefault();
                        triggerSpaceOptimization(input);
                        state.spaceCount = 0;
                    }
                } else {
                    state.spaceCount = 0;
                }
            });
        });
    }

    function triggerSpaceOptimization(input) {
        // 显示激活提示
        showSpaceFeedback();
        
        // 自动触发优化
        setTimeout(() => {
            const model = getModelByInputId(input.id);
            const button = document.querySelector(`[data-model="${model}"]`);
            if (button && input.value.trim()) {
                handleOptimizeButtonClick(button);
            }
        }, 500);
    }

    function showSpaceFeedback() {
        spaceFeedback.classList.remove('hidden');
        setTimeout(() => {
            spaceFeedback.classList.add('hidden');
        }, 1500);
    }

    function getModelByInputId(inputId) {
        switch (inputId) {
            case 'prompt-input-chatgpt':
                return 'chatgpt';
            case 'prompt-input-nanobanana':
                return 'nanobanana';
            case 'prompt-input-positive':
                return 'modelscope-positive';
            case 'prompt-input-negative':
                return 'modelscope-negative';
            default:
                return 'chatgpt';
        }
    }

    // ============== 消息提示功能 ==============
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        optimizeToastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    optimizeToastContainer.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // ============== 全屏预览功能 ==============
    function initFullscreenModal() {
        closeBtn.addEventListener('click', closeFullscreen);
        fullscreenModal.addEventListener('click', (e) => {
            if (e.target === fullscreenModal) {
                closeFullscreen();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeFullscreen();
            }
        });
    }

    function openFullscreen(imageSrc) {
        modalImage.src = imageSrc;
        fullscreenModal.classList.remove('hidden');
    }

    function closeFullscreen() {
        fullscreenModal.classList.add('hidden');
        modalImage.src = '';
    }

    // ============== 参数设置功能 ==============
    function initParameterSettings() {
        const seedInput = document.getElementById('seed-input');
        const stepsInput = document.getElementById('steps-input');
        const guidanceInput = document.getElementById('guidance-input');
        const sizeSelect = document.getElementById('size-select');
        const countButtons = document.querySelectorAll('.count-btn');

        // 随机种子按钮
        if (seedInput) {
            seedInput.addEventListener('click', () => {
                if (seedInput.value === '-1') {
                    seedInput.value = Math.floor(Math.random() * 1000000);
                } else {
                    seedInput.value = '-1';
                }
            });
        }

        // 数量选择按钮
        countButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                countButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 参数变化时自动保存
        [seedInput, stepsInput, guidanceInput, sizeSelect].forEach(input => {
            if (input) {
                input.addEventListener('change', () => {
                    saveModelState(state.currentModel);
                });
            }
        });
    }

    // ============== 初始化应用 ==============
    async function init() {
        try {
            // 初始化各个功能模块
            initThemeToggle();
            initModelSelector();
            initApiKeyManagement();
            initImageUpload();
            initGenerateButtons();
            initPromptOptimization();
            initFullscreenModal();
            initParameterSettings();

            console.log('RTPic 应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
            showToast('应用初始化失败', 'error');
        }
    }

    // 启动应用
    await init();

    // ============== 工具函数 ==============
    
    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

});