// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

/**
 * Chat Interface Module
 * Handles chat UI, messaging, input management, and AI communication
 */

// Chat history to store the last 4 messages for context
let chatHistory = [];

/**
 * Disable chat input with optional message
 * @param {string} message - Message to show in placeholder
 */
function disableChatInput(message = "Loading...") {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = message;
    }
}

/**
 * Enable chat input and restore focus
 */
function enableChatInput() {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = "Type your message...";
        // Return focus to the input field
        chatInput.focus();
    }
}

/**
 * Add a message to the chat interface
 * @param {string} message - The message content
 * @param {boolean} isUser - Whether this is a user message (vs assistant)
 * @returns {HTMLElement} The created message element
 */
function addChatMessage(message, isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    if (isUser) {
        // Keep user messages as plain text
        messageDiv.textContent = message;
    } else {
        // Render assistant messages as markdown
        messageDiv.innerHTML = marked.parse(message);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add message to chat history for context (skip empty messages and typing indicators)
    if (message.trim() && !message.startsWith('Thinking')) {
        chatHistory.push({
            role: isUser ? 'user' : 'assistant',
            content: message.trim()
        });
        
        // Keep only the last 4 messages
        if (chatHistory.length > 4) {
            chatHistory.shift(); // Remove the oldest message
        }
        
        console.log("Updated chat history:", chatHistory);
    }
    
    return messageDiv; // Return the element for potential manipulation
}

/**
 * Handle chat input submission
 * Processes user input, sends to AI, and handles response
 */
function handleChatInput() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message) {
        // Disable input during processing
        disableChatInput("Processing...");
        
        // Add user message
        addChatMessage(message, true);
        
        // Clear input
        chatInput.value = '';
        
        // Auto-resize textarea back to single line
        chatInput.style.height = 'auto';
        
        // Show typing indicator with animation - start with proper formatting
        const typingDiv = addChatMessage('', false); // Start empty
        typingDiv.classList.add('typing'); // Apply typing class immediately
        
        // Set initial content with proper spacing
        let dotCount = 1;
        let direction = 1; // 1 for increasing, -1 for decreasing
        const dots = '.'.repeat(dotCount);
        const spaces = '\u00A0'.repeat(4 - dotCount);
        typingDiv.textContent = 'Thinking' + dots + spaces;
        
        const thinkingInterval = setInterval(() => {
            dotCount += direction;
            if (dotCount === 4) {
                direction = -1; // Start decreasing
            } else if (dotCount === 1) {
                direction = 1; // Start increasing
            }
            // Keep text length consistent by padding with spaces
            const dots = '.'.repeat(dotCount);
            const spaces = '\u00A0'.repeat(4 - dotCount); // Non-breaking spaces
            typingDiv.textContent = 'Thinking' + dots + spaces;
        }, 400); // Back to smooth 400ms animation
        
        // Store the interval so we can clear it later
        typingDiv.thinkingInterval = thinkingInterval;
        
        // Log the request being sent to server
        console.log("=== FRONTEND REQUEST ===");
        console.log("User message:", message);
        console.log("Current chart config:", window.ChartChatState?.currentChartConfig);
        console.log("Chat history:", chatHistory);
        console.log("========================");
        
        // Send message to Azure OpenAI
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                currentChart: window.ChartChatState?.currentChartConfig,
                chatHistory: chatHistory
            })
        })
        .then(response => response.json())
        .then(data => {
            // Clear the thinking animation interval and remove typing indicator
            if (typingDiv.thinkingInterval) {
                clearInterval(typingDiv.thinkingInterval);
            }
            typingDiv.remove();
            
            // Re-enable input
            enableChatInput();
            
            if (data.error) {
                const errorMessage = `Server error: ${data.error}. Details: ${data.details || 'No details'}`;
                window.ChartChatUtilities?.logError(new Error(errorMessage), 'Chat API Response');
                addChatMessage(`Error: ${data.error}`, false);
            } else {
                // Log the raw AI response for debugging
                console.log("=== SERVER SUCCESS RESPONSE ===");
                console.log("Raw AI response:", data.response);
                console.log("================================");
                
                // Try to parse the AI response as JSON
                try {
                    const aiResponse = JSON.parse(data.response);
                    
                    console.log("=== PARSED AI RESPONSE ===");
                    console.log("Chat Response:", aiResponse.chatResponse);
                    console.log("Chart Action:", aiResponse.chartAction);
                    console.log("==========================");
                    
                    // Add chat response to chat history
                    if (aiResponse.chatResponse) {
                        addChatMessage(aiResponse.chatResponse, false);
                    }
                    
                    // If there's a chart action, update the chart
                    if (aiResponse.chartAction) {
                        console.log("=== PROCESSING CHART ACTION ===");
                        console.log("Chart action received:", aiResponse.chartAction);
                        console.log("===============================");
                        // Call chart operations module function
                        if (window.ChartChatOperations?.updateChartFromAI) {
                            window.ChartChatOperations.updateChartFromAI(aiResponse.chartAction);
                        }
                    }
                    
                } catch (parseError) {
                    // If it's not JSON, treat it as a regular text response
                    window.ChartChatUtilities?.logError(parseError, 'AI Response JSON Parse');
                    console.log("Non-JSON response received, treating as text");
                    addChatMessage(data.response, false);
                }
            }
        })
        .catch(error => {
            // Clear the thinking animation interval and remove typing indicator
            if (typingDiv.thinkingInterval) {
                clearInterval(typingDiv.thinkingInterval);
            }
            typingDiv.remove();
            
            // Re-enable input even on error
            enableChatInput();
            
            window.ChartChatUtilities?.logError(error, 'Chat Request');
            addChatMessage('Sorry, I encountered an error. Please try again.', false);
        });
    }
}

/**
 * Auto-resize textarea based on content
 * @param {HTMLTextAreaElement} textarea - The textarea element to resize
 */
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

/**
 * Initialize chat interface event handlers
 */
function initializeChatInterface() {
    // Chat input handlers
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            autoResizeTextarea(this);
        });
        
        chatInput.addEventListener('keypress', function(e) {
            if (e.which === 13 && !e.shiftKey) { // Enter key without Shift
                e.preventDefault();
                // Only handle input if not disabled
                if (!this.disabled) {
                    handleChatInput();
                }
            }
        });
    }
    
    console.log('Chat interface initialized');
}

// Export functions for use by other modules
window.ChartChatInterface = {
    disableChatInput,
    enableChatInput,
    addChatMessage,
    handleChatInput,
    autoResizeTextarea,
    initializeChatInterface,
    // Expose chatHistory for other modules
    get chatHistory() { return chatHistory; },
    set chatHistory(value) { chatHistory = value; }
};