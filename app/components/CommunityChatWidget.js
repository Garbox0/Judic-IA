"use client";
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronLeft, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import './chat.css';

export default function CommunityChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [userId, setUserId] = useState(null);
    const messagesEndRef = useRef(null);

    // 1. Initial Load: Auth & Fetch Conversations
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                fetchConversations(user.id);
            }
        };
        init();
    }, []);

    // 2. Fetch Conversations from DB
    const fetchConversations = async (uid) => {
        try {
            // Get conversations where the user is a participant
            const { data, error } = await supabase
                .from('chat_participants')
                .select(`
                    conversation_id,
                    chat_conversations (
                        id,
                        title,
                        updated_at
                    )
                `)
                .eq('user_id', uid)
                .order('chat_conversations(updated_at)', { ascending: false });

            if (error) throw error;

            const formatted = data.map(item => ({
                id: item.conversation_id,
                name: item.chat_conversations.title || 'Conversación'
            }));

            setConversations(formatted);
        } catch (err) {
            console.error("Error fetching conversations:", err);
        }
    };

    // 3. Fetch Messages for Active Conversation
    useEffect(() => {
        if (!activeConversation) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', activeConversation.id)
                .order('created_at', { ascending: true });

            if (!error) setMessages(data);
        };

        fetchMessages();

        // Realtime Subscription for new messages
        const channel = supabase
            .channel(`convo_${activeConversation.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${activeConversation.id}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeConversation]);

    // 4. Handle "Open Chat" event from external components (like Federal Hub)
    useEffect(() => {
        const handleOpenExternal = (e) => {
            const { conversationId, partnerName } = e.detail;
            setIsOpen(true);
            setActiveConversation({ id: conversationId, name: partnerName });

            // Re-fetch conversations to ensure the new one is in the list
            if (userId) fetchConversations(userId);
        };

        window.addEventListener('judicia-open-chat', handleOpenExternal);
        return () => window.removeEventListener('judicia-open-chat', handleOpenExternal);
    }, [userId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, activeConversation]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !activeConversation || !userId) return;

        const content = messageInput;
        setMessageInput('');

        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert([{
                    conversation_id: activeConversation.id,
                    sender_id: userId,
                    content: content
                }]);

            if (error) throw error;

            // Update conversation 'updated_at' to move to top of list
            await supabase
                .from('chat_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', activeConversation.id);

        } catch (err) {
            toast.error("Fallo al enviar: " + err.message);
            setMessageInput(content); // Restore input on fail
        }
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
                {!isOpen && conversations.length > 0 && (
                    <span className="chat-notification-dot"></span>
                )}
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
                                {messages.length === 0 && (
                                    <div className="text-center opacity-40 text-xs py-8">
                                        Principio de la conversación
                                    </div>
                                )}
                                {messages.map(msg => (
                                    <div key={msg.id} className={`message-bubble ${msg.sender_id === userId ? 'sent' : 'received'}`}>
                                        {msg.content}
                                        <span className="message-time">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form className="chat-input-area" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    className="chat-input"
                                    autoFocus
                                    placeholder="Escribe un mensaje..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                />
                                <button type="submit" className="chat-send-btn" disabled={!messageInput.trim()}>
                                    <Send size={18} />
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="chat-list">
                            {conversations.length === 0 ? (
                                <div className="text-center opacity-40 py-12 px-4">
                                    <User size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No tienes conversaciones activas.</p>
                                    <p className="text-xs mt-2">Busca colegas en el Hub Federal para iniciar una consulta.</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <div key={conv.id} className="chat-item" onClick={() => setActiveConversation(conv)}>
                                        <div className="chat-avatar">
                                            {conv.name.charAt(0)}
                                        </div>
                                        <div className="chat-info">
                                            <span className="chat-name">{conv.name}</span>
                                            <span className="chat-preview truncate">Ver conversación...</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
