 // --- START OF FILE main.ts ---

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

// --- 辅助函数：创建 JSON 错误响应 ---
function createJsonErrorResponse(message: string, statusCode = 500) {
    return new Response(JSON.stringify({ error: message }), {
        status: statusCode,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}

// --- 辅助函数：休眠/等待 ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =======================================================
// 模块 1: OpenRouter API 调用逻辑 (用于 nano banana)
// =======================================================
async function callOpenRouter(messages: any[], apiKey: string): Promise<{ type: 'image' | 'text'; content: string }> {
    if (!apiKey) { throw new Error("callOpenRouter received an empty apiKey."); }
    const openrouterPayload = { model: "google/gemini-2.5-flash-image-preview", messages };
    console.log("Sending payload to OpenRouter:", JSON.stringify(openrouterPayload, null, 2));
    const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(openrouterPayload)
    });
    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        throw new Error(`OpenRouter API error: ${apiResponse.status} ${apiResponse.statusText} - ${errorBody}`);
    }
    const responseData = await apiResponse.json();
    console.log("OpenRouter Response:", JSON.stringify(responseData, null, 2));
    const message = responseData.choices?.[0]?.message;
    if (message?.images?.[0]?.image_url?.url) { return { type: 'image', content: message.images[0].image_url.url }; }
    if (typeof message?.content === 'string' && message.content.startsWith('data:image/')) { return { type: 'image', content: message.content }; }
    if (typeof message?.content === 'string' && message.content.trim() !== '') { return { type: 'text', content: message.content }; }
    return { type: 'text', content: "[模型没有返回有效内容]" };
}

// =======================================================
// 模块 1.5: OpenRouter GPT-5 Image API 调用逻辑 (用于 ChatGPT)
// =======================================================
async function callDALLE3(prompt: string, apiKey: string, images: string[] = []): Promise<{ type: 'image' | 'text'; content: string }> {
    if (!apiKey) { throw new Error("callDALLE3 received an empty apiKey."); }
    
    // 构建请求体 - 使用OpenRouter上实际可用的GPT-5 Image模型
    const requestBody: any = {
        model: "openai/gpt-5-image-mini",  // 使用Mini版本，成本较低
        prompt: prompt,
        n: 1
    };

    // 处理图片上传
    const contentPayload: any[] = [{ type: "text", text: prompt }];
    if (images && images.length > 0) {
        const imageParts = images.map(img => ({ type: "image_url", image_url: { url: img } }));
        contentPayload.push(...imageParts);
    }

    // 构建OpenRouter API格式的消息
    const webUiMessages = [{ role: "user", content: contentPayload }];
    
    console.log("Sending GPT-5 Image request to OpenRouter:", JSON.stringify({ model: requestBody.model, messages: webUiMessages }, null, 2));
    
    const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", 
        headers: { 
            "Authorization": `Bearer ${apiKey}`, 
            "Content-Type": "application/json" 
        },
        body: JSON.stringify({ model: requestBody.model, messages: webUiMessages })
    });
    
    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        throw new Error(`OpenRouter GPT-5 Image API error: ${apiResponse.status} ${apiResponse.statusText} - ${errorBody}`);
    }
    
    const responseData = await apiResponse.json();
    console.log("OpenRouter GPT-5 Image Response:", JSON.stringify(responseData, null, 2));
    
    const message = responseData.choices?.[0]?.message;
    if (message?.images?.[0]?.image_url?.url) { 
        return { type: 'image', content: message.images[0].image_url.url }; 
    }
    if (typeof message?.content === 'string' && message.content.startsWith('data:image/')) { 
        return { type: 'image', content: message.content }; 
    }
    if (typeof message?.content === 'string' && message.content.trim() !== '') { 
        return { type: 'text', content: message.content }; 
    }
    
    return { type: 'text', content: "[模型没有返回有效内容]" };
}

// =======================================================
// 模块 2: ModelScope API 调用逻辑 (用于 Qwen-Image 等)
// =======================================================
// [修改] 函数接收一个 timeoutSeconds 参数
async function callModelScope(model: string, apikey: string, parameters: any, timeoutSeconds: number): Promise<{ imageUrl: string }> {
    const base_url = 'https://api-inference.modelscope.cn/';
    const common_headers = {
        "Authorization": `Bearer ${apikey}`,
        "Content-Type": "application/json",
    };
    console.log(`[ModelScope] Submitting task for model: ${model}`);
    const generationResponse = await fetch(`${base_url}v1/images/generations`, {
        method: "POST",
        headers: { ...common_headers, "X-ModelScope-Async-Mode": "true" },
        body: JSON.stringify({ model, ...parameters }),
    });
    if (!generationResponse.ok) {
        const errorBody = await generationResponse.text();
        throw new Error(`ModelScope API Error (Generation): ${generationResponse.status} - ${errorBody}`);
    }
    const { task_id } = await generationResponse.json();
    if (!task_id) { throw new Error("ModelScope API did not return a task_id."); }
    console.log(`[ModelScope] Task submitted. Task ID: ${task_id}`);
    
    // [修改] 动态计算最大轮询次数
    const pollingIntervalSeconds = 5;
    const maxRetries = Math.ceil(timeoutSeconds / pollingIntervalSeconds);
    console.log(`[ModelScope] Task timeout set to ${timeoutSeconds}s, polling a max of ${maxRetries} times.`);

    for (let i = 0; i < maxRetries; i++) {
        await sleep(pollingIntervalSeconds * 1000); // 使用变量
        console.log(`[ModelScope] Polling task status... Attempt ${i + 1}/${maxRetries}`);
        const statusResponse = await fetch(`${base_url}v1/tasks/${task_id}`, { headers: { ...common_headers, "X-ModelScope-Task-Type": "image_generation" } });
        if (!statusResponse.ok) {
            console.error(`[ModelScope] Failed to get task status. Status: ${statusResponse.status}`);
            continue;
        }
        const data = await statusResponse.json();
        if (data.task_status === "SUCCEED") {
            console.log("[ModelScope] Task Succeeded.");
            if (data.output?.images?.[0]?.url) {
                return { imageUrl: data.output.images[0].url };
            } else if (data.output_images?.[0]) {
                return { imageUrl: data.output_images[0] };
            } else {
                throw new Error("ModelScope task succeeded but returned no images.");
            }
        } else if (data.task_status === "FAILED") {
            console.error("[ModelScope] Task Failed.", data);
            throw new Error(`ModelScope task failed: ${data.message || 'Unknown error'}`);
        }
    }
    throw new Error(`ModelScope task timed out after ${timeoutSeconds} seconds.`);
}

// =======================================================
// 主服务逻辑
// =======================================================
serve(async (req) => {
    const pathname = new URL(req.url).pathname;
    
    if (req.method === 'OPTIONS') { 
        return new Response(null, { 
            status: 204, 
            headers: { 
                "Access-Control-Allow-Origin": "*", 
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS", 
                "Access-Control-Allow-Headers": "Content-Type, Authorization" 
            } 
        }); 
    }

    if (pathname === "/api/key-status") {
        const isSet = !!Deno.env.get("OPENROUTER_API_KEY");
        return new Response(JSON.stringify({ isSet }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    if (pathname === "/api/openai-key-status") {
        const isSet = !!Deno.env.get("OPENAI_API_KEY");
        return new Response(JSON.stringify({ isSet }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    if (pathname === "/api/modelscope-key-status") {
        const isSet = !!Deno.env.get("MODELSCOPE_API_KEY");
        return new Response(JSON.stringify({ isSet }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    if (pathname === "/generate") {
        try {
            // [修改] 从请求体中解构出 timeout
            const requestData = await req.json();
            const { model, apikey, prompt, images, parameters, timeout } = requestData;

            if (model === 'nanobanana') {
                const openrouterApiKey = apikey || Deno.env.get("OPENROUTER_API_KEY");
                if (!openrouterApiKey) { return createJsonErrorResponse("OpenRouter API key is not set.", 500); }
                if (!prompt) { return createJsonErrorResponse("Prompt is required.", 400); }
                const contentPayload: any[] = [{ type: "text", text: prompt }];
                if (images && Array.isArray(images) && images.length > 0) {
                    const imageParts = images.map(img => ({ type: "image_url", image_url: { url: img } }));
                    contentPayload.push(...imageParts);
                }
                const webUiMessages = [{ role: "user", content: contentPayload }];
                const result = await callOpenRouter(webUiMessages, openrouterApiKey);
                if (result.type === 'image') {
                    return new Response(JSON.stringify({ imageUrl: result.content }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
                } else {
                    return createJsonErrorResponse(`Model returned text instead of an image: "${result.content}"`, 400);
                }
            } else if (model === 'chatgpt') {
                const openaiApiKey = apikey || Deno.env.get("OPENAI_API_KEY");
                if (!openaiApiKey) { return createJsonErrorResponse("OpenAI API key is not set.", 500); }
                if (!prompt) { return createJsonErrorResponse("Prompt is required.", 400); }
                
                // 直接传递prompt和images到GPT-5 Image函数
                const result = await callDALLE3(prompt, openaiApiKey, images || []);
                if (result.type === 'image') {
                    return new Response(JSON.stringify({ imageUrl: result.content }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
                } else {
                    return createJsonErrorResponse(`Model returned text instead of an image: "${result.content}"`, 400);
                }
            } else {
                const modelscopeApiKey = apikey || Deno.env.get("MODELSCOPE_API_KEY");
                if (!modelscopeApiKey) { return createJsonErrorResponse("ModelScope API key is not set.", 401); }
                if (!parameters?.prompt) { return createJsonErrorResponse("Positive prompt is required for ModelScope models.", 400); }
                
                // [修改] 将 timeout (或默认值) 传递给 callModelScope
                // Qwen 默认2分钟，其他默认3分钟
                const timeoutSeconds = timeout || (model.includes('Qwen') ? 120 : 180); 
                const result = await callModelScope(model, modelscopeApiKey, parameters, timeoutSeconds);

                return new Response(JSON.stringify(result), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }
        } catch (error) {
            console.error("Error handling /generate request:", error);
            return createJsonErrorResponse(error.message, 500);
        }
    }

    // =======================================================
    // 提示词优化 API 端点
    // =======================================================
    if (pathname === "/prompt-optimize") {
        try {
            if (req.method !== "POST") {
                return createJsonErrorResponse("Method not allowed. Use POST.", 405);
            }

            const requestData = await req.json();
            const { prompt, targetModel, apiKey } = requestData;

            if (!prompt || !targetModel) {
                return createJsonErrorResponse("Prompt and targetModel are required.", 400);
            }

            const openrouterApiKey = apiKey || Deno.env.get("OPENROUTER_API_KEY");
            if (!openrouterApiKey) {
                return createJsonErrorResponse("OpenRouter API key is not set.", 500);
            }

            // 读取角色提示词文件
            let systemPrompt = "";
            try {
                const roleFilePath = `${Deno.cwd()}/prompt-optimizer-role.txt`;
                systemPrompt = await Deno.readTextFile(roleFilePath);
            } catch (error) {
                console.warn("Could not read prompt-optimizer-role.txt:", error);
                // 如果文件读取失败，使用默认角色提示词
                systemPrompt = "你是一位专业的电商产品主图提示词优化专家。请根据用户提供的原始提示词，结合产品特性和目标模型的要求，提供更精确、更有效的优化版本。";
            }

            // 调用 Claude 3.5 Sonnet 进行提示词优化
            const optimizeResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openrouterApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "anthropic/claude-3.5-sonnet",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { 
                            role: "user", 
                            content: `请优化以下提示词，适配${targetModel}模型：\n\n原始提示词：${prompt}\n\n请直接返回优化后的提示词，不要添加任何解释或前缀。` 
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            if (!optimizeResponse.ok) {
                const errorBody = await optimizeResponse.text();
                throw new Error(`OpenRouter Claude API error: ${optimizeResponse.status} ${optimizeResponse.statusText} - ${errorBody}`);
            }

            const optimizeData = await optimizeResponse.json();
            let optimizedPrompt = optimizeData.choices?.[0]?.message?.content?.trim() || prompt;

            // 如果目标模型需要英文翻译（flux、kontext、krea），进行翻译
            const englishModels = ['flux', 'kontext', 'krea'];
            if (englishModels.includes(targetModel.toLowerCase())) {
                const translateResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openrouterApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "anthropic/claude-3.5-sonnet",
                        messages: [
                            { 
                                role: "system", 
                                content: "你是一个专业的英文翻译专家。请将中文提示词准确翻译成英文，保持技术术语和描述的精确性，只返回翻译结果。" 
                            },
                            { 
                                role: "user", 
                                content: `请将以下中文提示词翻译成英文：\n\n${optimizedPrompt}\n\n请直接返回英文翻译，不要添加任何解释或前缀。` 
                            }
                        ],
                        max_tokens: 1000,
                        temperature: 0.3
                    })
                });

                if (translateResponse.ok) {
                    const translateData = await translateResponse.json();
                    const englishPrompt = translateData.choices?.[0]?.message?.content?.trim();
                    if (englishPrompt) {
                        optimizedPrompt = englishPrompt;
                    }
                } else {
                    console.warn("Translation failed, using Chinese optimized prompt");
                }
            }

            return new Response(JSON.stringify({ 
                success: true, 
                optimizedPrompt: optimizedPrompt 
            }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });

        } catch (error) {
            console.error("Error handling /prompt-optimize request:", error);
            return createJsonErrorResponse(error.message, 500);
        }
    }

    return serveDir(req, { fsRoot: "static", urlRoot: "", showDirListing: true, enableCors: true });
});