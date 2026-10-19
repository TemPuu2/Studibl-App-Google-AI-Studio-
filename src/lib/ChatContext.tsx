import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Message, ChatSession, AttachedFile, SavedAIContent } from '../types';
import { useAuth } from './AuthContext';
import { 
  getChatSessions, 
  getChatMessagesForSessions, 
  saveChatSession, 
  saveChatMessage, 
  deleteChatSession, 
  getSavedAIContent, 
  saveAIContent, 
  deleteAIContent, 
  isRealUserSession 
} from './supabaseService';

interface ChatContextType {
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  setActiveSessionId: (id: string | null) => void;
  updateSession: (id: string, updates: Partial<ChatSession> | ((prev: ChatSession) => Partial<ChatSession>)) => void;
  createNewSession: () => string;
  deleteSession: (id: string) => void;
  deleteMultipleSessions: (ids: string[]) => void;
  savedItems: SavedAIContent[];
  saveItem: (item: SavedAIContent) => void;
  removeItem: (messageId: string) => void;
  isLoading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = 'studibl_ai_history';
const ACTIVE_SESSION_STORAGE_KEY = 'studibl_current_session_id';
const SAVED_ITEMS_KEY = 'studibl_saved_ai';

const WELCOME_MESSAGE: Message = {
  id: 'welcome-message',
  role: 'assistant',
  content: "Hello! I'm your Studibl AI Tutor. Upload your lecture notes or ask me anything about your current courses. How can I help you excel today?\n\nIf you want, I can start by analyzing your latest lecture slides to identify the highest-probability exam topics for you."
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() || {};

  // Initialize sessions synchronously from localStorage or fallback to default session
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load initial sessions from storage', e);
    }
    const defaultId = generateId();
    return [{
      id: defaultId,
      title: 'New Session',
      date: new Date().toISOString(),
      messages: [WELCOME_MESSAGE],
      attachedFiles: [],
      lastUpdate: Date.now(),
      draftInput: '',
      scrollPosition: 0
    }];
  });

  // Initialize activeSessionId synchronously matching saved session or the first session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      const savedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      const savedSessions = localStorage.getItem(STORAGE_KEY);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (savedActiveId && parsed.some(s => s.id === savedActiveId)) {
            return savedActiveId;
          }
          return parsed[0].id;
        }
      }
    } catch (e) {}
    return null;
  });

  // Initialize savedItems synchronously
  const [savedItems, setSavedItems] = useState<SavedAIContent[]>(() => {
    try {
      const savedAiItems = localStorage.getItem(SAVED_ITEMS_KEY);
      if (savedAiItems) {
        return JSON.parse(savedAiItems);
      }
    } catch (e) {
      console.error('Failed to load initial saved items', e);
    }
    return [];
  });

  const [isInitializing, setIsInitializing] = useState(false);
  const isLoadedRef = useRef(false);

  // Sync activeSessionId if null but sessions exist
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  // Pull chat history from Supabase on authenticate
  useEffect(() => {
    if (user && isRealUserSession(user.id)) {
      isLoadedRef.current = false;
      const loadChatFromSupabase = async () => {
        try {
          const dbSessions = await getChatSessions(user.id);
          const dbMessages = await getChatMessagesForSessions(user.id);
          const dbSavedAI = await getSavedAIContent(user.id);

          if (dbSavedAI && dbSavedAI.length > 0) {
            setSavedItems(dbSavedAI.map((item: any) => ({
              id: item.id,
              messageId: item.message_id,
              title: item.title,
              content: item.content,
              type: item.type,
              timestamp: item.timestamp,
              sessionTitle: item.session_title,
              metadata: item.metadata || {}
            })));
          } else {
            // Overwrite with empty state if none are retrieved from Supabase
            setSavedItems([]);
          }

          if (dbSessions && dbSessions.length > 0) {
            setSessions(prevSessions => {
              const localSessionMap = new Map<string, ChatSession>();
              if (Array.isArray(prevSessions)) {
                prevSessions.forEach(ps => {
                  if (ps && ps.id) localSessionMap.set(ps.id, ps);
                });
              }

              return dbSessions.map((s: any) => {
                const matchingMsgs = dbMessages
                  .filter((m: any) => m.session_id === s.id)
                  .map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    attachedFiles: m.attached_files,
                    explanation: m.explanation,
                    quiz: m.quiz,
                    analysis: m.analysis,
                    feedback: m.feedback
                  }));

                const localSession = localSessionMap.get(s.id);
                const preservedAttached = localSession ? (localSession.attachedFiles || []) : [];
                const preservedDraft = localSession ? (localSession.draftInput || '') : (s.draft_input || '');

                return {
                  id: s.id,
                  title: s.title,
                  date: s.date,
                  messages: matchingMsgs.length > 0 ? matchingMsgs : [WELCOME_MESSAGE],
                  attachedFiles: preservedAttached,
                  lastUpdate: s.last_update,
                  draftInput: preservedDraft,
                  scrollPosition: s.scroll_position || 0
                };
              });
            });
          } else {
            // Overwrite with empty base state if none are retrieved from Supabase
            setSessions([]);
          }
        } catch (e) {
          console.error("Error loading chat sessions from Supabase:", e);
        } finally {
          isLoadedRef.current = true;
        }
      };
      loadChatFromSupabase();
    } else {
      isLoadedRef.current = true;
    }
  }, [user]);

  // Save to localStorage and sync to Supabase whenever sessions change (debounced to prevent network flooding)
  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }

    if (user && isRealUserSession(user.id) && isLoadedRef.current) {
      const timer = setTimeout(async () => {
        try {
          for (const s of sessions) {
            await saveChatSession(user.id, s);
            if (s.messages && s.messages.length > 0) {
              for (const msg of s.messages) {
                // Never sync static client-side welcome message to Supabase
                if (msg.id !== 'welcome-message') {
                  await saveChatMessage(user.id, s.id, msg);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error syncing chat to Supabase:", e);
        }
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [sessions, user, isInitializing]);

  // Save savedItems to localStorage and sync to Supabase (debounced)
  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(savedItems));
    }

    if (user && isRealUserSession(user.id) && isLoadedRef.current) {
      const timer = setTimeout(async () => {
        try {
          for (const item of savedItems) {
            await saveAIContent(user.id, item);
          }
        } catch (e) {
          console.error("Error syncing saved items:", e);
        }
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [savedItems, user, isInitializing]);

  // Save active session ID
  useEffect(() => {
    if (!isInitializing && activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    }
  }, [activeSessionId, isInitializing]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const createNewSession = React.useCallback(() => {
    const newId = generateId();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Session',
      date: new Date().toISOString(),
      messages: [WELCOME_MESSAGE],
      attachedFiles: [],
      lastUpdate: Date.now(),
      draftInput: '',
      scrollPosition: 0
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    return newId;
  }, []);

  const updateSession = React.useCallback((id: string, updates: Partial<ChatSession> | ((prev: ChatSession) => Partial<ChatSession>)) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const actualUpdates = typeof updates === 'function' ? updates(s) : updates;
        
        // If updating messages, also update title if it was default
        let newTitle = s.title;
        if (actualUpdates.messages && actualUpdates.messages.length > 1 && (s.title === 'New Session' || s.title.includes('...'))) {
          const firstUserMsg = actualUpdates.messages.find(m => m.role === 'user');
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }

        return { 
          ...s, 
          ...actualUpdates, 
          title: actualUpdates.title || newTitle,
          lastUpdate: Date.now() 
        };
      }
      return s;
    }));
  }, []);

  const deleteSession = React.useCallback(async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionId(current => current === id ? null : current);

    if (user && isRealUserSession(user.id)) {
      try {
        await deleteChatSession(user.id, id);
      } catch (e) {
        console.error("Error deleting session on Supabase:", e);
      }
    }
  }, [user]);

  const deleteMultipleSessions = React.useCallback(async (ids: string[]) => {
    setSessions(prev => prev.filter(s => !ids.includes(s.id)));
    setActiveSessionId(current => (current && ids.includes(current)) ? null : current);

    if (user && isRealUserSession(user.id)) {
      try {
        for (const id of ids) {
          await deleteChatSession(user.id, id);
        }
      } catch (e) {
        console.error("Error deleting multiple sessions:", e);
      }
    }
  }, [user]);

  const saveItem = React.useCallback((item: SavedAIContent) => {
    setSavedItems(prev => {
      // Prevent duplicates
      if (prev.some(i => i.messageId === item.messageId)) return prev;
      return [item, ...prev];
    });
  }, []);

  const removeItem = React.useCallback(async (messageId: string) => {
    const target = savedItems.find(i => i.messageId === messageId || i.id === messageId);
    setSavedItems(prev => prev.filter(i => i.messageId !== messageId && i.id !== messageId));
    
    if (user && isRealUserSession(user.id)) {
      try {
        if (target) {
          await deleteAIContent(user.id, target.id);
        }
      } catch (e) {
        console.error("Error deleting bookmarks from Supabase:", e);
      }
    }
  }, [user, savedItems]);

  return (
    <ChatContext.Provider value={{
      sessions,
      activeSessionId,
      activeSession,
      setActiveSessionId,
      updateSession,
      createNewSession,
      deleteSession,
      deleteMultipleSessions,
      savedItems,
      saveItem,
      removeItem,
      isLoading: isInitializing
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
