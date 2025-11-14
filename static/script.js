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
    
    // 模态框元素
    const optimizeModal = document.getElementById('optimize-modal');
    const optimizeLoadingModal = document.getElementById('optimize-loading-modal');
    const fullscreenModal = document.getElementById('fullscreen-modal');
    const modalImage = document.getElementById('modal-image');
    const originalPromptText = document.getElementById('original-prompt-text');
    const optimizedPromptText = document.getElementById('optimized-prompt-text');
    const applyOptimizedBtn = document.getElementById('apply-optimized-btn');
    const copyOptimizedBtn = document.getElementById('copy-optimized-btn');

    // ============== 主题管理 ==============
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        state.theme = savedTheme;
        body.classList.add(`${savedTheme}-mode`);
        updateThemeIcon();
    }

    function toggleTheme() {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        state.theme = newTheme;
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(`${newTheme}-mode`);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon();
    }

    function updateThemeIcon() {
        const sunIcon = themeToggleBtn.querySelector('.icon-sun');
        const moonIcon = themeToggleBtn.querySelector('.icon-moon');
        if (state.theme === 'light') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    // ============== 模型切换 ==============
    function initModelSelection() {
        // 设置初始模型
        switchModel('chatgpt');
        
        modelCards.forEach(card => {
            card.addEventListener('click', () => {
                const modelId = card.dataset.model;
                switchModel(modelId);
            });
        });
    }

    function switchModel(modelId) {
        state.currentModel = modelId;
        
        // 更新模型卡片状态
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
        
        // 更新高亮位置
        updateModelSelectorHighlight();
    }

    function updateModelSelectorHighlight() {
        const container = document.querySelector('.model-selector-container');
        const activeCard = document.querySelector('.model-card.active');
        if (container && activeCard) {
            const containerRect = container.getBoundingClientRect();
            const cardRect = activeCard.getBoundingClientRect();
            const relativeLeft = cardRect.left - containerRect.left;
            
            container.style.setProperty('--highlight-left', `${relativeLeft}px`);
            container.style.setProperty('--highlight-width', `${cardRect.width}px`);
        }
    }

    // ============== 文件上传处理 ==============
    function initFileUpload() {
        // ChatGPT文件上传
        if (imageUploadChatGPT && thumbnailsContainerChatGPT) {
            setupFileUpload(imageUploadChatGPT, thumbnailsContainerChatGPT, 'chatgpt');
        }
        
        // Nano Banana文件上传
        if (imageUpload && thumbnailsContainer) {
            setupFileUpload(imageUpload, thumbnailsContainer, 'nanobanana');
        }
    }

    function setupFileUpload(fileInput, container, modelType) {
        const uploadArea = fileInput.closest('.upload-area');
        
        // 点击上传
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files, container);
        });
        
        // 文件选择
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files, container);
        });
        
        // 粘贴上传
        document.addEventListener('paste', (e) => {
            if (e.clipboardData.files.length > 0) {
                handleFiles(e.clipboardData.files, container);
                showToast('图片已粘贴', 'success');
            }
        });
    }

    function handleFiles(files, container) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const thumbnail = createThumbnail(e.target.result, file.name);
                    container.appendChild(thumbnail);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function createThumbnail(src, filename) {
        const wrapper = document.createElement('div');
        wrapper.className = 'thumbnail-wrapper';
        
        wrapper.innerHTML = `
            <img src="${src}" alt="${filename}">
            <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
        `;
        
        return wrapper;
    }

    // ============== 生成功能 ==============
    function initGeneration() {
        generateButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const panel = button.closest('.control-panel');
                const modelId = panel.id.replace('-controls', '');
                await generateImage(modelId);
            });
        });
    }

    async function generateImage(modelId) {
        if (state.isGenerating) {
            showToast('正在生成中，请稍候...', 'warn');
            return;
        }

        const panel = document.getElementById(`${modelId}-controls`);
        if (!panel) return;

        // 获取API密钥
        let apiKey = '';
        if (modelId === 'chatgpt') {
            apiKey = apiKeyInputOpenAI?.value || '';
        } else if (modelId === 'nanobanana') {
            apiKey = apiKeyInputOpenRouter?.value || '';
        } else if (modelId === 'modelscope') {
            apiKey = apiKeyInputModelScope?.value || '';
        }

        if (!apiKey) {
            showToast('请输入API密钥', 'error');
            return;
        }

        // 获取提示词
        let prompt = '';
        if (modelId === 'chatgpt') {
            prompt = promptInputChatGPT?.value || '';
        } else if (modelId === 'nanobanana') {
            prompt = promptInputNanoBanana?.value || '';
        } else if (modelId === 'modelscope') {
            prompt = promptInputPositive?.value || '';
        }

        if (!prompt.trim()) {
            showToast('请输入提示词', 'error');
            return;
        }

        state.isGenerating = true;
        updateGenerateButton(modelId, true);

        try {
            // 这里添加实际的API调用逻辑
            showToast(`${modelId}模型生成功能待实现`, 'info');
        } catch (error) {
            showToast('生成失败: ' + error.message, 'error');
        } finally {
            state.isGenerating = false;
            updateGenerateButton(modelId, false);
        }
    }

    function updateGenerateButton(modelId, isGenerating) {
        const panel = document.getElementById(`${modelId}-controls`);
        const button = panel?.querySelector('.generate-btn');
        const btnText = button?.querySelector('.btn-text');
        const spinner = button?.querySelector('.spinner');

        if (button && btnText && spinner) {
            if (isGenerating) {
                button.disabled = true;
                btnText.textContent = '生成中...';
                spinner.classList.remove('hidden');
            } else {
                button.disabled = false;
                btnText.textContent = '生成';
                spinner.classList.add('hidden');
            }
        }
    }

    // ============== 提示词优化功能 ==============
    function initPromptOptimization() {
        // 为优化按钮添加事件监听器
        optimizeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modelId = button.dataset.model;
                optimizePrompt(modelId);
            });
        });

        // 空格键触发优化
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                handleSpaceKeyPress();
            }
        });

        // 模态框事件
        setupModalEvents();
    }

    function handleSpaceKeyPress() {
        const now = Date.now();
        if (now - state.lastSpaceTrigger < 1000) {
            state.spaceCount++;
            if (state.spaceCount >= 3) {
                const activePanel = document.querySelector('.control-panel:not(.hidden)');
                if (activePanel) {
                    const modelId = activePanel.id.replace('-controls', '');
                    optimizePrompt(modelId);
                    state.spaceCount = 0;
                }
            }
        } else {
            state.spaceCount = 1;
        }
        state.lastSpaceTrigger = now;
        
        // 显示触发提示
        showSpaceTriggerFeedback();
    }

    function showSpaceTriggerFeedback() {
        const feedback = document.getElementById('space-trigger-feedback');
        if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => {
                feedback.classList.add('hidden');
            }, 2000);
        }
    }

    async function optimizePrompt(modelId) {
        let prompt = '';
        let promptElement = null;

        // 获取当前模型的提示词
        if (modelId === 'chatgpt') {
            prompt = promptInputChatGPT?.value || '';
            promptElement = promptInputChatGPT;
        } else if (modelId === 'nanobanana') {
            prompt = promptInputNanoBanana?.value || '';
            promptElement = promptInputNanoBanana;
        } else if (modelId === 'modelscope-positive') {
            prompt = promptInputPositive?.value || '';
            promptElement = promptInputPositive;
        } else if (modelId === 'modelscope-negative') {
            prompt = promptInputNegative?.value || '';
            promptElement = promptInputNegative;
        }

        if (!prompt.trim()) {
            showToast('请先输入提示词', 'warn');
            return;
        }

        // 显示加载模态框
        showOptimizeLoadingModal();

        try {
            // 调用优化API
            const optimizedPrompt = await callOptimizeAPI(prompt, modelId);
            
            // 隐藏加载模态框，显示结果模态框
            hideOptimizeLoadingModal();
            showOptimizeResultModal(prompt, optimizedPrompt, promptElement);
            
        } catch (error) {
            hideOptimizeLoadingModal();
            showToast('优化失败: ' + error.message, 'error');
        }
    }

    async function callOptimizeAPI(prompt, modelId) {
        // 这里实现实际的API调用逻辑
        // 使用OpenRouter API调用Claude 3.5 Sonnet进行优化
        
        const apiKeys = getOpenRouterApiKeys();
        if (!apiKeys || apiKeys.length === 0) {
            throw new Error('未找到OpenRouter API密钥，请设置OPENROUTER_API_KEYS环境变量');
        }

        const apiKey = apiKeys[0]; // 使用第一个可用的API密钥
        
        const systemPrompt = getOptimizationSystemPrompt(modelId);
        
        const requestBody = {
            model: "anthropic/claude-3-5-sonnet-latest",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: `请优化以下提示词：\n\n${prompt}`
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'RTPic Prompt Optimizer'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    function getOpenRouterApiKeys() {
        // 从环境变量获取API密钥
        const keys = process.env.OPENROUTER_API_KEYS;
        if (!keys) return [];
        
        return keys.split(',').map(key => key.trim()).filter(key => key);
    }

    function getOptimizationSystemPrompt(modelId) {
        const basePrompt = `你是一个专业的AI提示词优化专家。你的任务是优化用户提供的提示词，使其更适合指定的AI模型生成高质量的图像。

优化原则：
1. 保持原意的同时增强描述的准确性和细节
2. 使用模型偏好的关键词和风格术语
3. 添加合适的质量修饰词
4. 优化语言表达，使其更符合AI理解习惯
5. 确保提示词长度适中（通常20-100个词）

请直接返回优化后的提示词，不要添加解释或前缀。`;

        if (modelId === 'chatgpt' || modelId === 'nanobanana') {
            return basePrompt + `

对于ChatGPT/Nano Banana模型：
- 支持中文提示词，可以保留中文描述
- 注重场景描述的完整性和细节丰富度
- 可以包含情感、氛围等描述词汇`;
        } else if (modelId === 'modelscope-positive') {
            return basePrompt + `

对于ModelScope正向提示词：
- 优先使用英文表达
- 包含质量关键词如：masterpiece, best quality, highly detailed
- 添加艺术风格描述
- 包含光影、构图等视觉元素描述`;
        } else if (modelId === 'modelscope-negative') {
            return basePrompt + `

对于ModelScope负向提示词：
- 列出需要避免的负面特征
- 包含质量问题的描述：low quality, bad anatomy, distorted
- 添加技术缺陷：blurry, pixelated, artifacts
- 包含不需要的元素：text, watermark, signature`;
        }

        return basePrompt;
    }

    function showOptimizeLoadingModal() {
        if (optimizeLoadingModal) {
            optimizeLoadingModal.classList.remove('hidden');
        }
    }

    function hideOptimizeLoadingModal() {
        if (optimizeLoadingModal) {
            optimizeLoadingModal.classList.add('hidden');
        }
    }

    function showOptimizeResultModal(originalPrompt, optimizedPrompt, promptElement) {
        if (optimizeModal && originalPromptText && optimizedPromptText) {
            originalPromptText.textContent = originalPrompt;
            optimizedPromptText.textContent = optimizedPrompt;
            optimizeModal.classList.remove('hidden');
            
            // 保存当前提示词元素引用，用于应用优化结果
            optimizeModal.dataset.targetElement = promptElement ? promptElement.id : '';
        }
    }

    function setupModalEvents() {
        // 关闭模态框
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-btn') || e.target === optimizeModal || e.target === optimizeLoadingModal || e.target === fullscreenModal) {
                hideAllModals();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideAllModals();
            }
        });

        // 应用优化按钮
        if (applyOptimizedBtn) {
            applyOptimizedBtn.addEventListener('click', () => {
                const targetElementId = optimizeModal.dataset.targetElement;
                const targetElement = document.getElementById(targetElementId);
                if (targetElement && optimizedPromptText) {
                    targetElement.value = optimizedPromptText.textContent;
                    showToast('提示词已应用', 'success');
                }
                hideAllModals();
            });
        }

        // 复制优化按钮
        if (copyOptimizedBtn) {
            copyOptimizedBtn.addEventListener('click', async () => {
                if (optimizedPromptText) {
                    try {
                        await navigator.clipboard.writeText(optimizedPromptText.textContent);
                        showToast('已复制到剪贴板', 'success');
                    } catch (err) {
                        showToast('复制失败', 'error');
                    }
                }
            });
        }
    }

    function hideAllModals() {
        if (optimizeModal) optimizeModal.classList.add('hidden');
        if (optimizeLoadingModal) optimizeLoadingModal.classList.add('hidden');
        if (fullscreenModal) fullscreenModal.classList.add('hidden');
    }

    // ============== 消息提示 ==============
    function showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10001',
            animation: 'slideInRight 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // 设置背景色
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warn: '#F59E0B',
            info: '#3B82F6'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(toast);

        // 3秒后自动移除
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // ============== 全屏预览 ==============
    function initFullscreenPreview() {
        // 为结果图片添加点击事件
        if (mainResultImage) {
            mainResultImage.addEventListener('click', (e) => {
                if (e.target.tagName === 'IMG') {
                    showFullscreenModal(e.target.src);
                }
            });
        }

        // 为缩略图添加点击事件
        if (resultThumbnails) {
            resultThumbnails.addEventListener('click', (e) => {
                if (e.target.classList.contains('result-thumb')) {
                    showFullscreenModal(e.target.src);
                }
            });
        }
    }

    function showFullscreenModal(imageSrc) {
        if (fullscreenModal && modalImage) {
            modalImage.src = imageSrc;
            fullscreenModal.classList.remove('hidden');
        }
    }

    // ============== 初始化 ==============
    function init() {
        try {
            initTheme();
            initModelSelection();
            initFileUpload();
            initGeneration();
            initPromptOptimization();
            initFullscreenPreview();
            updateModelSelectorHighlight();
            
            console.log('RTPic应用初始化完成，已启用提示词优化功能');
        } catch (error) {
            console.error('初始化失败:', error);
            showToast('应用初始化失败', 'error');
        }
    }

    // ============== 启动应用 ==============
    init();

});

// ============== CSS动画样式注入 ==============
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);