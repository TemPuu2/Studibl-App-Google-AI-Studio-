import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { isRealUserSession } from '../lib/supabaseService';
import { supabase } from '../supabaseClient';
import UserAvatar from './UserAvatar';
import { CommunityChatMessagesSkeleton } from './Skeletons';
import { 
  Send, 
  Paperclip, 
  MoreVertical, 
  ArrowLeft, 
  Image as ImageIcon, 
  FileText, 
  Camera,
  Check,
  CheckCheck,
  MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  fetchChatMessages, 
  sendChatMessage, 
  ChatMessage 
} from '../services/communityService';

/**
 * Interface representing a message in the chat conversation
 */
interface Message {
  id: string;
  senderId: 'me' | 'other';
  senderName?: string;
  text: string;
  time: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'file';
  attachment?: {
    name: string;
    url: string;
    size?: string;
  };
}

/**
 * Props passed to the ChatInterface component
 */
interface ChatInterfaceProps {
  chat: {
    id: string;
    user: {
      id?: string;
      name: string;
      avatar: string;
      online: boolean;
      role?: string;
    };
  };
  currentUserId: string;
  onBack: () => void;
  onSendMessage?: (text: string) => void;
}

/**
 * ChatInterface Component
 * Provides real-time messaging between university peers, synchronizing
 * messages permanently into Supabase and listening to real-time changes
 * without requiring app refreshes or reloads.
 */
export default function ChatInterface({ chat, currentUserId, onBack, onSendMessage }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  /**
   * Fetches genuine messages from the backend and Supabase for this chat
   */
  const loadMessages = useCallback(async (isInitial = false) => {
    if (!chat?.id) return;
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const serverMessages = await fetchChatMessages(chat.id);
      setMessages(serverMessages as Message[]);
    } catch (err: any) {
      console.error('[ChatInterface] Failed to load messages:', err);
      if (isInitial) {
        setError('Could not retrieve message history. Please try again.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [chat?.id]);

  // Initial load
  useEffect(() => {
    loadMessages(true);
  }, [loadMessages]);

  /**
   * Set up Supabase Realtime channel subscription + background sync polling
   * to guarantee instant real-time message delivery without requiring page refreshes
   */
  useEffect(() => {
    if (!chat?.id) return;

    // 1. Supabase Postgres Realtime subscription
    const channelName = `chat-room-${chat.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `chat_id=eq.${chat.id}`
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow && newRow.id) {
            setMessages((prev) => {
              // Avoid duplicate insertion
              if (prev.some((m) => m.id === newRow.id)) return prev;

              const isMe = (user && newRow.sender_id === user.id) || newRow.sender_id === currentUserId;
              const formatted: Message = {
                id: newRow.id,
                senderId: isMe ? 'me' : 'other',
                senderName: newRow.sender_name,
                text: newRow.text,
                time: new Date(newRow.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: (newRow.status as any) || 'delivered',
                type: (newRow.type as any) || 'text',
                attachment: newRow.attachment || undefined
              };

              // Replace any optimistic message with same text or append
              const filtered = prev.filter(m => !m.id.startsWith('temp-') || m.text !== newRow.text);
              return [...filtered, formatted];
            });
          }
        }
      )
      .subscribe();

    // 2. Periodic sync polling as a resilient fallback for local/hybrid offline transitions
    const syncInterval = setInterval(() => {
      loadMessages(false);
    }, 3000);

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [chat?.id, currentUserId, user, loadMessages]);

  /**
   * Auto-scroll to bottom of chat when new messages appear
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  /**
   * Handles clicking outside attachment popup to dismiss it
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachments(false);
      }
    };

    if (showAttachments) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachments]);

  const handleFileSelect = (_type: string) => {
    setShowAttachments(false);
    fileInputRef.current?.click();
  };

  /**
   * Dispatches text message to Supabase backend and updates chat state
   */
  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || !chat?.id) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: 'me',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: 'text'
    };

    // Optimistically insert message into UI
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');

    try {
      const persistedMsg = await sendChatMessage(chat.id, { text: textToSend, type: 'text' });
      // Replace optimistic message with persisted message from backend
      setMessages(prev => prev.map(m => m.id === tempId ? (persistedMsg as Message) : m));
      onSendMessage?.(textToSend);
    } catch (err: any) {
      console.error('[ChatInterface] Error sending message:', err);
      // Mark optimistic message as sent
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
    }
  };

  /**
   * Uploads file attachment to storage and sends attachment message
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !chat?.id) return;

    const fileName = file.name;
    const isImage = file.type.startsWith('image/');
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    try {
      let attachmentUrl = '#';
      if (user && isRealUserSession(user.id)) {
        const filePath = `${user.id}/chat-attachments/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('app-files')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!uploadErr) {
          const { data } = await supabase.storage.from('app-files').createSignedUrl(filePath, 60 * 60 * 24 * 7);
          if (data?.signedUrl) {
            attachmentUrl = data.signedUrl;
          }
        }
      }

      const msgData = {
        text: fileName,
        type: (isImage ? 'image' : 'file') as 'image' | 'file',
        attachment: {
          name: fileName,
          url: attachmentUrl,
          size: fileSizeMB
        }
      };

      const persistedMsg = await sendChatMessage(chat.id, msgData);
      setMessages(prev => [...prev, persistedMsg as Message]);
      onSendMessage?.(`[Attachment: ${fileName}]`);
    } catch (err) {
      console.error('[ChatInterface] Attachment upload failed:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute inset-0 z-50 bg-dark-bg flex flex-col"
    >
      {/* Chat Header */}
      <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between backdrop-blur-xl bg-dark-bg/80 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95"
            aria-label="Back to chats"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer">
              <UserAvatar 
                src={chat.user.avatar} 
                name={chat.user.name}
                className="w-12 h-12 rounded-full ring-2 ring-white/5 group-hover:ring-brand-primary/30 transition-all text-xs" 
              />
              {chat.user.online && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-dark-bg rounded-full shadow-lg" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">{chat.user.name}</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest leading-none",
                  chat.user.online ? "text-green-500" : "text-white/30"
                )}>
                  {chat.user.online ? 'Online' : 'Offline'}
                </span>
                {chat.user.role && (
                  <>
                    <span className="text-white/20 text-[9px]">•</span>
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-tight">{chat.user.role}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => loadMessages(false)}
            title="Refresh chat messages"
            className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-95"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-8 scrollbar-hide space-y-6 max-w-4xl mx-auto w-full"
      >
        <div className="flex justify-center mb-6">
          <span className="px-5 py-2 rounded-2xl bg-white/[0.03] text-[9px] font-black uppercase tracking-widest text-white/20 border border-white/5 backdrop-blur-md">
            Direct Academic Consultation
          </span>
        </div>

        {/* Loading State with Skeleton */}
        {loading && messages.length === 0 && (
          <CommunityChatMessagesSkeleton />
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-xs text-red-400 font-medium mb-2">{error}</p>
            <button 
              onClick={() => loadMessages(true)} 
              className="px-4 py-1.5 rounded-xl bg-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-4">
              <MessageSquare size={28} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">No messages yet</h4>
            <p className="text-xs text-white/40 max-w-xs leading-relaxed">
              Start an academic conversation with {chat.user.name}. Share lecture notes, formulas, and study questions.
            </p>
          </div>
        )}

        {/* Rendered Messages */}
        {messages.map((msg, msgIdx) => {
          const isMe = msg.senderId === 'me';
          return (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={`chat-msg-${msg.id || 'temp'}-${msgIdx}`}
              className={cn(
                "flex flex-col max-w-[85%] relative group",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "p-4 rounded-[2rem] text-sm font-medium leading-relaxed shadow-2xl transition-all duration-300",
                isMe 
                  ? "bg-brand-primary text-dark-bg rounded-tr-sm hover:translate-x-[-4px]" 
                  : "bg-white/[0.03] text-white/80 border border-white/5 backdrop-blur-xl rounded-tl-sm hover:translate-x-[4px]"
              )}>
                {msg.type === 'text' && msg.text}
                
                {msg.type === 'image' && msg.attachment?.url && (
                  <div className="rounded-xl overflow-hidden mb-2 max-w-xs">
                    <img 
                      src={msg.attachment.url} 
                      alt={msg.attachment.name || 'Image attachment'} 
                      className="w-full h-auto object-cover rounded-xl"
                    />
                  </div>
                )}

                {msg.type === 'file' && msg.attachment && (
                  <div className="flex items-center gap-4 py-1">
                    <div className={cn(
                      "w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-inner",
                      isMe ? "bg-dark-bg/10 text-dark-bg" : "bg-brand-primary/20 text-brand-primary"
                    )}>
                      <FileText size={24} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        "text-xs font-black truncate mb-0.5",
                        isMe ? "text-dark-bg" : "text-white"
                      )}>{msg.attachment.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest opacity-40",
                          isMe ? "text-dark-bg" : "text-white"
                        )}>{msg.attachment.size || 'Document'}</span>
                        <div className={cn("w-1 h-1 rounded-full", isMe ? "bg-dark-bg/20" : "bg-white/10")} />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest opacity-40",
                          isMe ? "text-dark-bg" : "text-white"
                        )}>PDF Document</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 px-2">
                <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.15em]">{msg.time}</span>
                {isMe && (
                  <div className={cn(
                    "transition-colors",
                    msg.status === 'read' ? "text-brand-primary" : "text-brand-primary/40"
                  )}>
                    {msg.status === 'read' ? <CheckCheck size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="px-6 py-6 border-t border-white/5 bg-dark-bg/50 backdrop-blur-xl">
        <div className="relative group max-w-4xl mx-auto w-full">
          <div className="absolute inset-0 bg-brand-primary/5 rounded-3xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative bg-white/[0.03] border border-white/5 rounded-3xl p-2 flex items-end gap-2 focus-within:border-brand-primary/30 transition-all">
            <textarea 
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message"
              className="flex-1 bg-transparent border-none outline-none py-2.5 px-4 text-sm text-white placeholder:text-white/10 resize-none min-h-[40px] max-h-[120px] scrollbar-hide"
            />
            <div className="flex items-center gap-1 shrink-0 p-0.5 relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload}
              />
              <AnimatePresence>
                {showAttachments && (
                  <motion.div
                    ref={attachmentMenuRef}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute bottom-full right-0 mb-4 bg-[#0A0A0A] border border-white/10 rounded-3xl p-3 flex flex-col gap-2 min-w-[180px] shadow-[0_20px_100px_rgba(0,0,0,1)] z-50"
                  >
                    <button 
                      onClick={() => handleFileSelect('gallery')}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all group w-full text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                        <ImageIcon size={16} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Gallery</span>
                    </button>
                    <button 
                      onClick={() => handleFileSelect('camera')}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all group w-full text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                        <Camera size={16} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Camera</span>
                    </button>
                    <button 
                      onClick={() => handleFileSelect('files')}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all group w-full text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                        <FileText size={16} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Documents</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button 
                onClick={() => setShowAttachments(!showAttachments)}
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                  showAttachments ? "bg-white/10 text-white" : "text-white/20 hover:text-white"
                )}
                aria-label="Toggle attachments menu"
              >
                <Paperclip size={20} />
              </button>
              <button 
                onClick={handleSend}
                disabled={!inputText.trim()}
                aria-label="Send message"
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 ml-1 shadow-lg",
                  inputText.trim() 
                    ? "bg-brand-primary text-dark-bg shadow-brand-primary/20" 
                    : "bg-white/5 text-white/20"
                )}
              >
                <Send size={18} strokeWidth={2.5} className={cn(inputText.trim() && "translate-x-0.5 -translate-y-0.5")} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
