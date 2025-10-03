import React, { useState, useEffect, useRef } from 'react'
import './ChatPanel.css'

const ChatPanel = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      content: "Hi! I'm your Chart Chat agent. I can help you with your Power BI charts. Ask me about what fields are available or you can ask me to make a chart like \"Show me Sales by Month\" or \"Show me Units by District\".",
      isUser: false,
      timestamp: Date.now()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isInputDisabled, setIsInputDisabled] = useState(true)
  const [placeholder, setPlaceholder] = useState('Loading report... Please wait.')
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingText, setThinkingText] = useState('Thinking.')
  
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const chatHistoryRef = useRef([])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle thinking animation
  useEffect(() => {
    let interval
    if (isThinking) {
      let dotCount = 1
      let direction = 1
      
      interval = setInterval(() => {
        dotCount += direction
        if (dotCount === 4) {
          direction = -1
        } else if (dotCount === 1) {
          direction = 1
        }
        const dots = '.'.repeat(dotCount)
        const spaces = '\u00A0'.repeat(4 - dotCount)
        setThinkingText('Thinking' + dots + spaces)
      }, 400)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isThinking])

  // Listen for PowerBI state changes
  useEffect(() => {
    const handlePowerBIState = (event) => {
      const { enableChat, disableReason } = event.detail
      if (enableChat) {
        enableInput()
      } else if (disableReason) {
        disableInput(disableReason)
      }
    }

    const handleChartError = (event) => {
      const { message } = event.detail
      addMessage(message, false)
    }

    window.addEventListener('powerbi-chat-state', handlePowerBIState)
    window.addEventListener('chart-error', handleChartError)

    return () => {
      window.removeEventListener('powerbi-chat-state', handlePowerBIState)
      window.removeEventListener('chart-error', handleChartError)
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const enableInput = () => {
    setIsInputDisabled(false)
    setPlaceholder('Type your message...')
    // Focus the input after a short delay to ensure it's enabled
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const disableInput = (message = 'Loading...') => {
    setIsInputDisabled(true)
    setPlaceholder(message)
  }

  const addMessage = (content, isUser = false) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      content,
      isUser,
      timestamp: Date.now()
    }
    
    setMessages(prev => [...prev, newMessage])
    
    // Add to chat history (skip empty messages and typing indicators)
    if (content.trim() && !content.startsWith('Thinking')) {
      chatHistoryRef.current.push({
        role: isUser ? 'user' : 'assistant',
        content: content.trim()
      })
      
      // Keep only the last 4 messages
      if (chatHistoryRef.current.length > 4) {
        chatHistoryRef.current.shift()
      }
      
      console.log('Updated chat history:', chatHistoryRef.current)
    }
    
    return newMessage
  }

  const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px'
  }

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    autoResizeTextarea(e.target)
  }

  const handleKeyPress = (e) => {
    if (e.which === 13 && !e.shiftKey) { // Enter key without Shift
      e.preventDefault()
      if (!isInputDisabled) {
        handleSubmit()
      }
    }
  }

  const handleSubmit = async () => {
    const message = inputValue.trim()
    if (!message) return

    // Disable input during processing
    disableInput('Processing...')
    
    // Add user message
    addMessage(message, true)
    
    // Clear input
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    
    // Show thinking indicator
    setIsThinking(true)
    
    try {
      console.log('=== FRONTEND REQUEST ===')
      console.log('User message:', message)
      console.log('Chat history:', chatHistoryRef.current)
      console.log('========================')
      
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: message,
          currentChart: null, // TODO: Get current chart config
          chatHistory: chatHistoryRef.current
        })
      })
      
      const data = await response.json()
      
      // Hide thinking indicator
      setIsThinking(false)
      
      // Re-enable input
      enableInput()
      
      if (data.error) {
        const errorMessage = `Server error: ${data.error}. Details: ${data.details || 'No details'}`
        console.error(errorMessage)
        addMessage(`Error: ${data.error}`, false)
      } else {
        console.log('=== SERVER SUCCESS RESPONSE ===')
        console.log('Raw AI response:', data.response)
        console.log('================================')
        
        try {
          const aiResponse = JSON.parse(data.response)
          
          console.log('=== PARSED AI RESPONSE ===')
          console.log('Chat Response:', aiResponse.chatResponse)
          console.log('Chart Action:', aiResponse.chartAction)
          console.log('==========================')
          
          // Add chat response
          if (aiResponse.chatResponse) {
            addMessage(aiResponse.chatResponse, false)
          }
          
          // Handle chart action
          if (aiResponse.chartAction) {
            console.log('=== PROCESSING CHART ACTION ===')
            console.log('Chart action received:', aiResponse.chartAction)
            console.log('===============================')
            // TODO: Integrate with chart operations
          }
          
        } catch (parseError) {
          console.log('Non-JSON response received, treating as text')
          addMessage(data.response, false)
        }
      }
    } catch (error) {
      console.error('Chat Request Error:', error)
      setIsThinking(false)
      enableInput()
      addMessage('Sorry, I encountered an error. Please try again.', false)
    }
  }

  // Parse markdown for assistant messages (enhanced implementation)
  const parseMarkdown = (text) => {
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks and inline code
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Lists
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      // Wrap lists in ul tags
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Line breaks
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        Power BI Embedded Chart Chat Agent
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.isUser ? 'user' : 'assistant'}`}>
            {message.isUser ? (
              message.content
            ) : (
              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }} />
            )}
          </div>
        ))}
        
        {isThinking && (
          <div className="message assistant typing">
            {thinkingText}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={isInputDisabled}
          rows="1"
        />
      </div>
    </div>
  )
}

export default ChatPanel