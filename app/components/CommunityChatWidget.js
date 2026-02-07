"use client";
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './chat.css';

export default function CommunityChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const messagesEndRef = useRef(null);

    // Initial Load - Mock Data
    useEffect(() => {
        if (isOpen) {
            setConversations([
                { id: '1', name: 'Dr. Lucas P.', lastMessage: 'Te envié el oficio pendiente.', unread: 2 },
                { id: '2', name: 'Dra. Laura M.', lastMessage: '¿Recibiste la notificación?', unread: 0 },
            ]);
        }
    }, [isOpen]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, activeConversation]);

    const handleSelectConversation = (conv) => {
        setActiveConversation(conv);
        setMessages([
            { id: 1, sender: 'them', content: 'Hola! Cómo estás?', time: '10:00' },
            { id: 2, sender: 'me', content: 'Todo bien, trabajando en el caso.', time: '10:05' },
            { id: 3, sender: 'them', content: conv.lastMessage, time: '10:10' }
        ]);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim()) return;

        const content = messageInput;
        setMessageInput('');

        const newMessage = {
            id: Date.now(),
            sender: 'me',
            content: content,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, newMessage]);
    };

    return (
        <div className="chat-widget-container community-chat">
            {/* Trigger Button */}
            <button
                className={`chat-trigger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Comunidad de Abogados"
            >
                {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        {activeConversation ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setActiveConversation(null)} className="chat-close-btn mr-2">
                                    <ChevronLeft size={20} />
                                </button>
                                <h3>{activeConversation.name}</h3>
                            </div>
                        ) : (
                            <h3>Comunidad Legal</h3>
                        )}
                        <button onClick={() => setIsOpen(false)} className="chat-close-btn">
                            <X size={20} />
                        </button>
                    </div>

                    {activeConversation ? (
                        <>
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
                                    placeholder="Escribe un mensaje..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                />
                                <button type="submit" className="chat-send-btn">
                                    <Send size={18} />
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="chat-list">
                            {conversations.map(conv => (
                                <div key={conv.id} className="chat-item" onClick={() => handleSelectConversation(conv)}>
                                    <div className="chat-avatar">
                                        {conv.name.charAt(4)}
                                    </div>
                                    <div className="chat-info">
                                        <span className="chat-name">{conv.name}</span>
                                        <span className="chat-preview">{conv.lastMessage}</span>
                                    </div>
                                    {conv.unread > 0 && (
                                        <div className="bg-amber-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                            {conv.unread}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
