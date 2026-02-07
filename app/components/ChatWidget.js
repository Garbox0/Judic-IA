"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send } from 'lucide-react';
import './chat.css';

// Restored AI Chat Widget
export default function ChatWidget({ initialMessage = "Hola, soy Judic-IA." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [messages, setMessages] = useState([]);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (initialMessage && messages.length === 0) {
            setMessages([{ id: 'init', sender: 'ai', content: initialMessage, time: new Date().toLocaleTimeString() }]);
        }
    }, [initialMessage]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim()) return;

        const content = messageInput;
        setMessageInput('');

        // User Message
        const userMsg = {
            id: Date.now(),
            sender: 'me',
            content: content,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, userMsg]);

        // Mock AI Response (Simple echo for restoration)
        setTimeout(() => {
            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                content: "Entiendo. Estoy procesando tu consulta...",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiMsg]);
        }, 1000);
    };

    return (
        <div className="chat-widget-container ai-chat" style={{ right: '2rem' }}>
            <button
                className={`chat-trigger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)' }}
            >
                {isOpen ? <X size={28} /> : <Bot size={28} />}
            </button>

            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <h3>Soporte Técnico IA</h3>
                        <button onClick={() => setIsOpen(false)} className="chat-close-btn">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="chat-messages-area">
                        {messages.map(msg => (
                            <div key={msg.id} className={`message-bubble ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                                {msg.content}
                                <span className="message-time">{msg.time}</span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="chat-input-area" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            className="chat-input"
                            placeholder="Consulta a la IA..."
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                        />
                        <button type="submit" className="chat-send-btn" style={{ background: '#3b82f6', color: 'white' }}>
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
