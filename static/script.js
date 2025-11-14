// AI Image Generator - 提示词优化版本
const ThemeManager = {
    init() {
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.addEventListener('click', this.toggleTheme.bind(this));
    },
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
};

const ModelConfig = {
    'chatgpt': { name: 'ChatGPT', promptElement: 'chatgpt-prompt', controlsId: 'chatgpt-controls' },
    'nano-banana': { name: 'Nano Banana', promptElement: 'nanobanana-prompt', controlsId: 'nanobanana-controls' },
    'qwen-image': { name: 'Qwen-Image', promptElement: 'modelscope-prompt', controlsId: 'modelscope-controls' },
    'flux': { name: 'Flux', promptElement: 'modelscope-prompt', controlsId: 'modelscope-controls' },
    'kontext': { name: 'Kontext', promptElement: 'modelscope-prompt', controlsId: 'modelscope-controls' },
    'krea': { name: 'Krea', promptElement: 'modelscope-prompt', controlsId: 'modelscope-controls' }
};

const ModelSwitcher = {
    init() {
        document.querySelectorAll('.model-card').forEach(card => {
            card.addEventListener('click', () => {
                const modelId = card.getAttribute('data-model');
                this.switchModel(modelId);
            });
        });
        const firstModel = document.querySelector('.model-card');
        if (firstModel) this.switchModel(firstModel.getAttribute('data-model'));
    },
    switchModel(modelId) {
        document.querySelectorAll('.model-controls').forEach(control => control.style.display = 'none');
        document.querySelectorAll('.model-card').forEach(card => card.classList.remove('selected'));
        
        const config = ModelConfig[modelId];
        if (config) {
            const controls = document.getElementById(config.controlsId);
            if (controls) controls.style.display = 'block';
            
            const currentCard = document.querySelector(`[data-model="${modelId}"]`);
            if (currentCard) currentCard.classList.add('selected');
            
            localStorage.setItem('currentModel', modelId);
        }
    }
};

const ImageGenerators = {
    async callOpenRouter(prompt, parameters, modelId) {
        const apiKey = localStorage.getItem('OPENROUTER_API_KEYS');
        if (!apiKey) throw new Error('未找到API密钥');
        
        const body = {
            model: modelId,
            messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
        };
        if (parameters) body.parameters = parameters;
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin, 'X-Title': 'AI Image Generator' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error('无效的API响应格式');
        return data.choices[0].message.content;
    },
    
    async callModelScope(prompt, negativePrompt, parameters) {
        const apiKey = localStorage.getItem('OPENROUTER_API_KEYS');
        if (!apiKey) throw new Error('未找到API密钥');
        
        const body = {
            model: parameters.model,
            messages: [{ role: "user", content: [{ type: "text", text: negativePrompt ? `${prompt}\n\nNegative prompt: ${negativePrompt}` : prompt }] }],
            parameters: {
                height: parseInt(parameters.height), width: parseInt(parameters.width),
                num_inference_steps: parseInt(parameters.steps), guidance_scale: parseFloat(parameters.guidance_scale),
                num_outputs: 1, prompt: `${prompt}, steps:${parameters.steps}, cfg_scale:${parameters.guidance_scale}, size:${parameters.width}x${parameters.height}`
            }
        };
        
        if (parameters.seed) body.parameters.seed = parseInt(parameters.seed);
        if (parameters.safety_checker === 'true') body.parameters.safety_checker = true;
        if (parameters.enhance_prompt === 'true') body.parameters.enhance_prompt = true;
        if (parameters.aesthetic_score) body.parameters.aesthetic_score = parseFloat(parameters.aesthetic_score);
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin, 'X-Title': 'AI Image Generator' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error('无效的API响应格式');
        return data.choices[0].message.content;
    }
};

const UIManager = {
    init() {
        this.setupChatGPTHandlers();
        this.setupNanoBananaHandlers();
        this.setupModelScopeHandlers();
        this.setupPromptOptimization();
    },
    
    setupChatGPTHandlers() {
        const generateBtn = document.getElementById('chatgpt-generate');
        const clearBtn = document.getElementById('chatgpt-clear');
        
        generateBtn.addEventListener('click', async () => {
            try {
                const prompt = document.getElementById('chatgpt-prompt').value;
                const size = document.getElementById('chatgpt-size').value;
                const quality = document.getElementById('chatgpt-quality').value;
                const style = document.getElementById('chatgpt-style').value;
                
                if (!prompt.trim()) throw new Error('请输入提示词');
                
                generateBtn.disabled = true;
                generateBtn.textContent = '生成中...';
                
                const parameters = { size, quality, style };
                const result = await ImageGenerators.callOpenRouter(prompt, parameters, 'gpt-image-1');
                this.displayResult('chatgpt', result);
            } catch (error) {
                this.displayError('chatgpt', error.message);
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Image';
            }
        });
        
        clearBtn.addEventListener('click', () => {
            document.getElementById('chatgpt-prompt').value = '';
            document.getElementById('chatgpt-result').style.display = 'none';
        });
    },
    
    setupNanoBananaHandlers() {
        const generateBtn = document.getElementById('nanobanana-generate');
        const clearBtn = document.getElementById('nanobanana-clear');
        
        generateBtn.addEventListener('click', async () => {
            try {
                const prompt = document.getElementById('nanobanana-prompt').value;
                const size = document.getElementById('nanobanana-size').value;
                const quality = document.getElementById('nanobanana-quality').value;
                const steps = document.getElementById('nanobanana-steps').value;
                
                if (!prompt.trim()) throw new Error('请输入提示词');
                
                generateBtn.disabled = true;
                generateBtn.textContent = '生成中...';
                
                const parameters = { size: parseInt(size), quality: parseInt(quality), steps: parseInt(steps) };
                const result = await ImageGenerators.callOpenRouter(prompt, parameters, 'nano-banana');
                this.displayResult('nanobanana', result);
            } catch (error) {
                this.displayError('nanobanana', error.message);
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Image';
            }
        });
        
        clearBtn.addEventListener('click', () => {
            document.getElementById('nanobanana-prompt').value = '';
            document.getElementById('nanobanana-result').style.display = 'none';
        });
    },
    
    setupModelScopeHandlers() {
        const generateBtn = document.getElementById('modelscope-generate');
        const clearBtn = document.getElementById('modelscope-clear');
        
        generateBtn.addEventListener('click', async () => {
            try {
                const prompt = document.getElementById('modelscope-prompt').value;
                const negativePrompt = document.getElementById('modelscope-negative-prompt').value;
                const size = document.getElementById('modelscope-size').value;
                const steps = document.getElementById('modelscope-steps').value;
                const guidanceScale = document.getElementById('modelscope-guidance-scale').value;
                const seed = document.getElementById('modelscope-seed').value;
                const safetyChecker = document.getElementById('modelscope-safety-checker').value;
                const enhancePrompt = document.getElementById('modelscope-enhance-prompt').value;
                const aestheticScore = document.getElementById('modelscope-aesthetic-score').value;
                
                if (!prompt.trim()) throw new Error('请输入提示词');
                
                generateBtn.disabled = true;
                generateBtn.textContent = '生成中...';
                
                const parameters = {
                    model: 'black-forest-labs/flux-schnell',
                    width: parseInt(size.split('x')[0]),
                    height: parseInt(size.split('x')[1]) || parseInt(size),
                    steps: parseInt(steps), guidance_scale: parseFloat(guidanceScale),
                    seed: seed ? parseInt(seed) : undefined, safety_checker: safetyChecker,
                    enhance_prompt: enhancePrompt, aesthetic_score: parseFloat(aestheticScore)
                };
                
                const result = await ImageGenerators.callModelScope(prompt, negativePrompt, parameters);
                this.displayResult('modelscope', result);
            } catch (error) {
                this.displayError('modelscope', error.message);
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Image';
            }
        });
        
        clearBtn.addEventListener('click', () => {
            document.getElementById('modelscope-prompt').value = '';
            document.getElementById('modelscope-negative-prompt').value = '';
            document.getElementById('modelscope-result').style.display = 'none';
        });
    },
    
    displayResult(modelType, result) {
        const resultDiv = document.getElementById(`${modelType}-result`);
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '';
        
        const imageUrlMatch = result.match(/(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg))/i);
        
        if (imageUrlMatch) {
            const img = document.createElement('img');
            img.src = imageUrlMatch[1];
            img.alt = '生成的图片';
            img.onload = () => console.log('图片加载成功');
            img.onerror = () => this.displayTextResult(resultDiv, result);
            resultDiv.appendChild(img);
            
            const link = document.createElement('a');
            link.href = imageUrlMatch[1];
            link.target = '_blank';
            link.textContent = '在新窗口中打开';
            link.style.display = 'block';
            link.style.marginTop = '0.5rem';
            resultDiv.appendChild(link);
        } else {
            this.displayTextResult(resultDiv, result);
        }
    },
    
    displayTextResult(container, text) {
        const textResult = document.createElement('div');
        textResult.innerHTML = `<h4>API响应:</h4><pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; overflow-x: auto; color: var(--text-primary);">${text}</pre>`;
        container.appendChild(textResult);
    },
    
    displayError(modelType, errorMessage) {
        const resultDiv = document.getElementById(`${modelType}-result`);
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `<div style="color: var(--error-color); background-color: var(--bg-secondary); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--error-color);"><strong>错误:</strong> ${errorMessage}</div>`;
    }
};
const PromptOptimizer = {
    systemPrompt: `你是一个专业的电商产品主图优化专家，专注于帮助商家优化AI图像生成的提示词，以获得更吸引人的产品展示效果。

## 优化目标
为电商产品主图提供更好的视觉效果和销售转化率，确保生成的图片符合电商平台规范。

## 优化维度
1. **产品清晰度**: 确保产品主体清晰突出，细节丰富
2. **背景设计**: 简洁干净的背景，突出产品本身
3. **光线效果**: 自然柔和的光线，展现产品的质感和色彩
4. **构图布局**: 合理的产品布局，符合视觉美学
5. **色彩搭配**: 协调的色彩搭配，增强视觉冲击力
6. **风格定位**: 符合目标市场和用户偏好的设计风格
7. **技术参数**: 包含AI生成所需的技术描述
8. **商业元素**: 添加适当的商业展示元素（如品牌元素、价格标签等）

## 模型适配规则
- **ChatGPT/GPT-Image**: 偏向自然语言描述，注重创意和细节
- **Nano Banana**: 简洁明了，重点突出，参数化描述
- **Flux/ModelScope模型**: 技术参数详细，构图明确，适合高质量输出

## 输出要求
1. 优化后的提示词应该比原文更加详细和具体
2. 保留原文的核心产品信息
3. 添加必要的视觉效果描述
4. 包含适合的技术参数
5. 确保提示词的专业性和可执行性

请基于以上原则优化以下提示词：`,

    init() {
        document.querySelectorAll('.prompt-optimize-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target');
                this.startOptimization(targetId);
            });
        });
        
        this.setupModalEvents();
        this.setupSpacebarOptimization();
    },
    
    setupModalEvents() {
        const modal = document.getElementById('optimization-modal');
        const closeBtn = modal.querySelector('.close-modal');
        const applyBtn = document.getElementById('apply-optimized');
        const rejectBtn = document.getElementById('reject-optimized');
        const retryBtn = document.getElementById('retry-optimization');
        
        closeBtn.addEventListener('click', () => this.hideModal());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal();
        });
        
        applyBtn.addEventListener('click', () => this.applyOptimization());
        rejectBtn.addEventListener('click', () => this.hideModal());
        retryBtn.addEventListener('click', () => this.retryOptimization());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') this.hideModal();
        });
    },
    
    setupSpacebarOptimization() {
        document.querySelectorAll('textarea[id$="-prompt"]').forEach(textarea => {
            let spacebarPressed = false;
            
            textarea.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && !spacebarPressed) {
                    spacebarPressed = true;
                    e.preventDefault();
                    
                    const prompt = textarea.value.trim();
                    if (prompt && prompt.length > 5) {
                        setTimeout(() => this.startOptimization(textarea.id), 100);
                    }
                }
            });
            
            textarea.addEventListener('keyup', (e) => {
                if (e.code === 'Space') spacebarPressed = false;
            });
        });
    },
    
    startOptimization(textareaId) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;
        
        const prompt = textarea.value.trim();
        if (!prompt) {
            alert('请先输入提示词再进行优化');
            return;
        }
        
        this.currentTargetTextarea = textareaId;
        this.showModal();
        this.performOptimization(prompt);
    },
    
    async performOptimization(prompt) {
        try {
            this.showLoading();
            
            const apiKey = localStorage.getItem('OPENROUTER_API_KEYS');
            if (!apiKey) throw new Error('未找到API密钥');
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'AI Image Generator'
                },
                body: JSON.stringify({
                    model: 'claude-3.5-sonnet',
                    messages: [
                        { role: "system", content: this.systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `优化失败: ${response.status}`);
            }
            
            const data = await response.json();
            if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error('无效的优化响应');
            
            this.showOptimizationResult(data.choices[0].message.content.trim());
        } catch (error) {
            this.showOptimizationError(error.message);
        }
    },
    
    showModal() {
        document.getElementById('optimization-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },
    
    hideModal() {
        document.getElementById('optimization-modal').style.display = 'none';
        document.body.style.overflow = '';
        this.currentTargetTextarea = null;
    },
    
    showLoading() {
        document.getElementById('optimization-status').style.display = 'block';
        document.getElementById('optimization-result').style.display = 'none';
        document.getElementById('optimization-error').style.display = 'none';
    },
    
    showOptimizationResult(optimizedPrompt) {
        document.getElementById('optimization-status').style.display = 'none';
        document.getElementById('optimization-result').style.display = 'block';
        document.getElementById('optimization-error').style.display = 'none';
        document.getElementById('optimized-prompt').value = optimizedPrompt;
    },
    
    showOptimizationError(errorMessage) {
        document.getElementById('optimization-status').style.display = 'none';
        document.getElementById('optimization-result').style.display = 'none';
        document.getElementById('optimization-error').style.display = 'block';
        document.getElementById('error-message').textContent = errorMessage;
    },
    
    applyOptimization() {
        if (this.currentTargetTextarea) {
            const optimizedPrompt = document.getElementById('optimized-prompt').value;
            document.getElementById(this.currentTargetTextarea).value = optimizedPrompt;
        }
        this.hideModal();
    },
    
    retryOptimization() {
        if (this.currentTargetTextarea) {
            const prompt = document.getElementById(this.currentTargetTextarea).value.trim();
            if (prompt) {
                this.showLoading();
                this.performOptimization(prompt);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    try {
        ThemeManager.init();
        ModelSwitcher.init();
        UIManager.init();
        PromptOptimizer.init();
        console.log('AI Image Generator 初始化完成');
    } catch (error) {
        console.error('初始化失败:', error);
        alert('应用初始化失败，请刷新页面重试');
    }
});