class ChatApp {
    constructor() {
        this.messages = document.getElementById('messages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.modelSelect = document.getElementById('modelSelect');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.chatHistory = document.getElementById('chatHistory');
        
        this.API_KEYS = [
            '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',
            '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'
        ];
        this.API_URL = 'https://api.groq.com/openai/v1/chat/completions';
        this.apiCallCount = {};
        
        // 系统提示,强制使用中文回答
        this.systemMessage = {
            role: "system",
            content: `你是一个AI助手。请注意：
1. 始终使用简体中文回答所有问题，即使用户使用其他语言提问
2. 回答要简洁专业
3. 使用 Markdown 格式组织回答内容，包括：
   - 使用标题层级（#）来组织内容结构
   - 使用列表（- 或 1.）来枚举要点
   - 使用代码块（\`\`\`）来显示代码
   - 使用表格来展示结构化数据
   - 适当使用粗体（**）和斜体（*）来强调重要内容
4. 确保回答的可读性和结构性`
        };

        this.currentChatId = null;
        this.chats = this.loadChats();
        
        // 从本地存储加载上次选择的模型
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
            this.modelSelect.value = savedModel;
        }

        // 添加模型选择变化的事件监听
        this.modelSelect.addEventListener('change', () => {
            localStorage.setItem('selectedModel', this.modelSelect.value);
        });

        this.initEventListeners();
        this.renderChatHistory();

        // 初始化 API 调用计数器
        this.API_KEYS.forEach(key => {
            this.apiCallCount[key] = {
                count: 0,
                lastReset: Date.now()
            };
        });

        // 每分钟重置计数器
        setInterval(() => this.resetApiCounters(), 60000);

        // 配置 marked 选项
        marked.setOptions({
            renderer: new marked.Renderer(),
            highlight: function(code, language) {
                const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
                return hljs.highlight(code, { language: validLanguage }).value;
            },
            pedantic: false,
            gfm: true,
            breaks: true,
            sanitize: false,
            smartypants: false,
            xhtml: false
        });
    }

    initEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.chatHistory.addEventListener('click', (e) => {
            if (e.target.classList.contains('chat-item')) {
                this.switchChat(e.target.dataset.id);
            }
        });
        this.userInput.addEventListener('input', () => this.adjustTextareaHeight());
    }

    loadChats() {
        return JSON.parse(localStorage.getItem('chats') || '[]');
    }

    saveChats() {
        localStorage.setItem('chats', JSON.stringify(this.chats));
    }

    createNewChat() {
        const chatId = Date.now().toString();
        const newChat = {
            id: chatId,
            title: '新对话',
            messages: []
        };
        
        this.chats.unshift(newChat);
        this.saveChats();
        this.switchChat(chatId);
        this.renderChatHistory();
        this.userInput.focus();
    }

    switchChat(chatId) {
        if (!chatId && this.chats.length === 0) {
            this.messages.innerHTML = `
                <div class="empty-state">
                    <p>没有对话记录</p>
                    <p>点击"新建对话"开始聊天</p>
                </div>
            `;
            return;
        }

        this.currentChatId = chatId;
        this.messages.innerHTML = '';
        
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            chat.messages.forEach(msg => {
                this.addMessage(msg.content, msg.type, false);
            });
            this.scrollToBottom();
        }
        
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === chatId);
        });
    }

    renderChatHistory() {
        this.chatHistory.innerHTML = '';
        this.chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            chatItem.dataset.id = chat.id;

            // 创建对话标题容器
            const chatContent = document.createElement('div');
            chatContent.className = 'chat-item-content';
            chatContent.textContent = chat.title;
            chatContent.addEventListener('click', () => this.switchChat(chat.id));

            // 创建删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            `;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发切换对话
                this.deleteChat(chat.id);
            });

            chatItem.appendChild(chatContent);
            chatItem.appendChild(deleteBtn);
            this.chatHistory.appendChild(chatItem);
        });
    }

    deleteChat(chatId) {
        // 添加确认对话框
        if (!confirm('确定要删除这个对话吗？此操作不可撤销。')) {
            return;
        }

        // 从数组中移除对话
        this.chats = this.chats.filter(chat => chat.id !== chatId);
        this.saveChats();

        // 如果删除的是当前对话，切换到最新的对话
        if (this.currentChatId === chatId) {
            this.currentChatId = null;
            this.messages.innerHTML = '';
            if (this.chats.length > 0) {
                this.switchChat(this.chats[0].id);
            }
        }

        // 重新渲染历史记录
        this.renderChatHistory();
    }

    // 重置 API 计数器
    resetApiCounters() {
        const now = Date.now();
        Object.keys(this.apiCallCount).forEach(key => {
            if (now - this.apiCallCount[key].lastReset >= 60000) {
                this.apiCallCount[key].count = 0;
                this.apiCallCount[key].lastReset = now;
            }
        });
    }

    // 获取可用的 API 密钥
    getAvailableApiKey() {
        const availableKeys = this.API_KEYS.filter(key => {
            return !this.apiCallCount[key] || this.apiCallCount[key].count < 30;
        });

        if (availableKeys.length === 0) {
            throw new Error('所有 API 密钥已达到调用限制，请稍后再试');
        }

        const selectedKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        
        if (!this.apiCallCount[selectedKey]) {
            this.apiCallCount[selectedKey] = {
                count: 0,
                lastReset: Date.now()
            };
        }
        
        this.apiCallCount[selectedKey].count++;
        return selectedKey;
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        if (!this.currentChatId) {
            this.createNewChat();
        }

        // 添加用户消息
        this.addMessage(message, 'user', true);
        this.userInput.value = '';
        this.adjustTextareaHeight();

        try {
            // 添加加载状态消息并保存其 ID
            const loadingId = this.addMessage('正在思考...', 'assistant loading', false);
            
            // 调用API获取响应
            await this.callGroqAPI(message, loadingId);
            
            // 更新对话标题（仅在第一次回复时）
            const currentChat = this.chats.find(c => c.id === this.currentChatId);
            if (currentChat && currentChat.messages.length === 2) {
                currentChat.title = message.slice(0, 20) + (message.length > 20 ? '...' : '');
                this.saveChats();
                this.renderChatHistory();
            }
        } catch (error) {
            console.error('Error:', error);
            
            // 移除加载状态消息（如果存在）
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) {
                this.messages.removeChild(loadingElement);
            }

            // 添加错误消息，但不保存到历史记录中
            this.addMessage('抱歉,出现了一些错误。请稍后再试。', 'error', false);
        }
    }

    async callGroqAPI(message, loadingId) {
        let selectedApiKey;
        try {
            selectedApiKey = this.getAvailableApiKey();
        } catch (error) {
            throw new Error('API调用受限：' + error.message);
        }

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${selectedApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.modelSelect.value,
                messages: [
                    this.systemMessage,
                    ...this.getContextMessages(),
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                // 如果是认证错误，尝试使用其他 API 密钥
                const index = this.API_KEYS.indexOf(selectedApiKey);
                if (index > -1) {
                    this.API_KEYS.splice(index, 1); // 移除无效的密钥
                }
                if (this.API_KEYS.length > 0) {
                    return this.callGroqAPI(message, loadingId); // 使用其他密钥重试
                }
            }
            throw new Error(`API调用失败: ${response.status}`);
        }

        const reader = response.body.getReader();
        let content = '';
        let messageDiv = null;
        let messageContent = null;
        let lastRenderedContent = '';  // 添加变量跟踪最后渲染的内容
        
        try {
            // 移除加载状态消息
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) {
                this.messages.removeChild(loadingElement);
            }

            // 创建新的消息元素
            messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            messageDiv.appendChild(messageContent);
            this.messages.appendChild(messageDiv);

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (!line.trim() || line.includes('[DONE]')) continue;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonData = line.slice(6);
                            if (jsonData.trim()) {
                                const data = JSON.parse(jsonData);
                                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                    content += data.choices[0].delta.content;
                                    // 使用 Markdown 渲染内容
                                    messageContent.innerHTML = marked.parse(content);
                                    // 代码高亮
                                    messageContent.querySelectorAll('pre code').forEach((block) => {
                                        hljs.highlightBlock(block);
                                    });
                                    this.scrollToBottom();
                                }
                            }
                        } catch (parseError) {
                            console.error('解析响应数据时出错:', parseError);
                            continue;
                        }
                    }
                }
            }

            // 检测是否为英文回答并翻译
            if (this.isEnglishContent(content)) {
                try {
                    content = await this.translateToChineseUsingGroq(content, selectedApiKey);
                    // 使用 Markdown 渲染翻译后的内容
                    messageContent.innerHTML = marked.parse(content);
                    // 代码高亮
                    messageContent.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                } catch (translateError) {
                    console.error('翻译错误:', translateError);
                }
            }

            // 保存消息到历史记录
            if (this.currentChatId && content) {
                const chat = this.chats.find(c => c.id === this.currentChatId);
                if (chat) {
                    chat.messages.push({ content, type: 'assistant' });
                    this.saveChats();
                }
            }
        } catch (error) {
            if (messageDiv) {
                this.messages.removeChild(messageDiv);
            }
            throw error;
        } finally {
            reader.releaseLock();
        }
    }

    getContextMessages() {
        const currentChat = this.chats.find(c => c.id === this.currentChatId);
        if (!currentChat) return [];

        return currentChat.messages.slice(-5).map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));
    }

    addMessage(content, type, save = true) {
        const messageDiv = document.createElement('div');
        const id = `msg-${Date.now()}`;
        messageDiv.id = id;
        messageDiv.className = `message ${type}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // 如果是助手的回答，使用 Markdown 渲染
        if (type === 'assistant') {
            messageContent.innerHTML = marked.parse(content);
            // 代码高亮
            messageContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        this.messages.appendChild(messageDiv);
        
        if (save && this.currentChatId) {
            const chat = this.chats.find(c => c.id === this.currentChatId);
            if (chat) {
                chat.messages.push({ content, type });
                this.saveChats();
            }
        }
        
        this.scrollToBottom();
        return id;
    }

    isEnglishContent(text) {
        // 移除 Markdown 标记后再检测
        const plainText = text.replace(/[#*`\[\]()_-]/g, '');
        const englishChars = plainText.match(/[a-zA-Z]/g) || [];
        const totalChars = plainText.replace(/\s/g, '').length;
        return (englishChars.length / totalChars) > 0.5;
    }

    async translateToChineseUsingGroq(englishText, apiKey) {
        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.modelSelect.value,
                messages: [
                    {
                        role: "system",
                        content: `你是一个专业的翻译助手。请注意：
1. 将英文文本翻译成简体中文
2. 保持专业和准确性
3. 使用 Markdown 格式组织内容
4. 如果是列表内容，保持列表格式
5. 不要重复输出内容
6. 不要在翻译后附加原文`
                    },
                    {
                        role: "user",
                        content: `请翻译以下内容：\n\n${englishText}`
                    }
                ],
                temperature: 0.3,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`翻译请求失败: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messages.scrollTop = this.messages.scrollHeight;
        });
    }

    adjustTextareaHeight() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = this.userInput.scrollHeight + 'px';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
}); 