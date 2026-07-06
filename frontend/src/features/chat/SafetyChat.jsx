import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { api } from '../../lib/api';

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
        content: '⚠️ Failed to connect to SafeHer AI. In an emergency, please use the SOS button or dial 999.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot color="var(--color-brand)" /> SafeHer Assistant
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Powered by Groq + L3Cube</p>
      </div>

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, i) => (
          <div 
            key={i} 
            style={{ 
              display: 'flex', 
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '0.5rem',
              alignItems: 'flex-start'
            }}
          >
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: msg.role === 'user' ? 'var(--color-brand)' : msg.role === 'assistant' ? 'var(--color-bg-tertiary)' : 'var(--color-warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} color={msg.role === 'system' ? 'var(--color-warning)' : 'white'} />}
            </div>
            
            <div style={{
              background: msg.role === 'user' ? 'var(--color-brand)' : 'var(--color-bg-secondary)',
              color: msg.role === 'system' ? 'var(--color-warning)' : 'white',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              borderTopRightRadius: msg.role === 'user' ? '4px' : 'var(--radius-lg)',
              borderTopLeftRadius: msg.role !== 'user' ? '4px' : 'var(--radius-lg)',
              maxWidth: '80%',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              border: msg.role === 'system' ? '1px solid var(--color-warning)' : 'none'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--color-text-muted)' }}>
            <Loader2 size={16} className="animate-spin" /> SafeHer is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '1rem', background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Ask for safety advice (English or Bengali)..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={!input.trim() || isLoading}
            style={{ padding: '0.75rem' }}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
