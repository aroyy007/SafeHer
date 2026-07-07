import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { api } from '../../lib/api';
import './chat.css';

export function SafetyChat() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Hi, I am SafeHer AI. Need help finding a safe place, or have a question about local safety guidelines?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const data = await api.chat(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'system',
        content: '⚠ Failed to connect to SafeHer AI. In an emergency, please use the SOS button or dial 999.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat">
      {/* Header */}
      <div className="chat__head">
        <div>
          <div className="eyebrow">Assistant</div>
          <h2 className="chat__title">SafeHer AI</h2>
          <p className="chat__meta">Powered by Groq + L3Cube · Bengali &amp; English</p>
        </div>
      </div>

      {/* Messages */}
      <div className="chat__body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat__msg chat__msg--${msg.role}`}>
            <div className="chat__avatar">
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="chat__bubble">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="chat__loading">
            <Loader2 size={14} className="animate-spin" /> SafeHer is thinking…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="chat__form">
        <input
          type="text"
          className="input-field chat__input"
          placeholder="Ask about safety, rights, or local help…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="btn btn-primary chat__send"
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}