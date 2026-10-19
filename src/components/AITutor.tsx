import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, FileUp, Brain, GraduationCap, ArrowRight, ArrowUp, ArrowDown, ArrowLeft, Quote, Mic, MicOff, X, FileText, History, ThumbsUp, ThumbsDown, Star, Check, Swords, RotateCcw, Plus, Trash2, Volume2, VolumeX, BookOpen, Play, Copy, Share2, RefreshCcw, WifiOff, Bookmark, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn, generateAIBookmarkTitle } from '../lib/utils';
import Skeleton from './ui/Skeleton';
import { useOffline } from '../lib/useOffline';
import { aiService } from '../services/aiService';
import { UserIntentMode, QuizQuestion, Message, AttachedFile, ChatSession } from '../types';
import { useChat } from '../lib/ChatContext';
import { useLectureLibrary } from '../lib/LectureLibraryContext';
import { useMissions } from '../lib/MissionsContext';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - pdfjs-dist/build/pdf.worker.min.mjs exists but types might be missing for the ?url suffix
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import { useAuth } from '../lib/AuthContext';
import { isRealUserSession } from '../lib/supabaseService';
import { supabase } from '../supabaseClient';
import { MOCK_LECTURES, LectureContent } from '../constants';

export default function AITutor({ 
  preselectedTopic, 
  onClearTopic, 
  onNavigate,
  resumeMission,
  onClearResume,
  aiContext,
  onClearContext
}: { 
  preselectedTopic?: string | null, 
  onClearTopic?: () => void, 
  onNavigate?: (tab: any) => void,
  resumeMission?: any | null,
  onClearResume?: () => void,
  aiContext?: { document: any; prompts: string[] } | null,
  onClearContext?: () => void
}) {
  const { user } = useAuth() || {};
  const [customContextPrompts, setCustomContextPrompts] = useState<string[]>([]);

  const { 
    sessions: history, 
    activeSession, 
    activeSessionId, 
    setActiveSessionId, 
    updateSession, 
    createNewSession, 
    deleteSession: deleteSessionFromCtx, 
    deleteMultipleSessions: deleteMultipleFromCtx 
  } = useChat();

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Use messages loaded from the active chat session (defaulting to empty array)
  const messages = activeSession?.messages || [];

  // Local state to manage attached files in real-time, bypassing parent session
  // load lag and preventing silent initialization failures.
  const [localAttachedFiles, setLocalAttachedFiles] = useState<AttachedFile[]>(() => activeSession?.attachedFiles || []);
  const attachedFiles = localAttachedFiles;

  // Bidirectional synchronization to keep local attachment state fully aligned
  // with updates in the active session context as the user switches sessions.
  useEffect(() => {
    if (activeSession) {
      const sessionFiles = activeSession.attachedFiles || [];
      // Verify array contents to prevent unnecessary state triggers and render cycles
      const isIdentical = sessionFiles.length === localAttachedFiles.length &&
        sessionFiles.every((f, i) => f.id === localAttachedFiles[i]?.id && f.content === localAttachedFiles[i]?.content);
      if (!isIdentical) {
        setLocalAttachedFiles(sessionFiles);
      }
    } else {
      if (localAttachedFiles.length > 0) {
        setLocalAttachedFiles([]);
      }
    }
  }, [activeSessionId, activeSession?.attachedFiles]);

  const [input, setInput] = useState(activeSession?.draftInput || '');
  const [interimInput, setInterimInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isHistorySelectionMode, setIsHistorySelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [showContextMenu, setShowContextMenu] = useState<{ x: number, y: number, messageId: string } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const historyLongPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{questions: QuizQuestion[], index: number, score: number, answers: number[]} | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const { 
    unifiedLectures: library,
    removedFromLibrary
  } = useLectureLibrary();
  const { trackActivity } = useMissions();
  const [showLibrary, setShowLibrary] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Resume logic
  useEffect(() => {
    if (resumeMission && resumeMission.metadata) {
      const { sessionId, topic, isVoice } = resumeMission.metadata;
      
      if (sessionId) {
        setActiveSessionId(sessionId);
      } else if (topic) {
        // Fallback or legacy handling
        console.log("Resuming topic:", topic);
      }

      if (isVoice) {
        setIsVoiceMode(true);
      }
      
      // Clear after handling
      if (onClearResume) onClearResume();
    }
  }, [resumeMission, setActiveSessionId, onClearResume]);

  // Handle contextual learning pass from Lectures Hub
  useEffect(() => {
    if (aiContext && aiContext.document) {
      const doc = aiContext.document;
      
      // 1. Setup a fresh interactive tutoring session
      const sessionId = createNewSession();
      
      // 2. Prepare the document mock file attachment
      const newAttachedFile = {
        id: `lecture-${doc.id}`,
        name: `${doc.title}.${doc.type || 'pdf'}`,
        content: `Course: ${doc.course}\nTopic: ${doc.title}\nCategory: ${doc.type}\nReconstructed notes loaded as custom intelligence context for tutoring.`,
        isPinned: true
      };
      
      // Give the session creation a brief tick to populate state, then update it with loaded assets
      setTimeout(() => {
        updateSession(sessionId, {
          title: `Tutor: ${doc.title}`,
          attachedFiles: [newAttachedFile],
          messages: [
            {
              id: `welcome-${Date.now()}`,
              role: 'assistant',
              content: `Hello! I have loaded the lecture **"${doc.title}"** (${doc.course}) as core chat context.\n\nWe can study key terms, walk through quiz formulas, or re-explain sections in simple analogies. Choose one of the pre-generated learning prompts below to kick off our study sprint!`
            }
          ]
        });
      }, 80);

      // 3. Register pre-loaded starter prompts as clickable suggestion chips
      setCustomContextPrompts(aiContext.prompts || []);

      // 4. Clean parent state to avoid repeat triggering
      if (onClearContext) {
        onClearContext();
      }
    }
  }, [aiContext, createNewSession, updateSession, onClearContext]);

  // Helper to append/update messages belonging to the current session.
  // Securely auto-provisions a fresh session just-in-time if activeSessionId is null.
  // Defers session update via queueMicrotask to prevent "Cannot update a component while rendering a different component" warnings.
  const setMessages = React.useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    queueMicrotask(() => {
      const targetId = activeSessionId || (history.length > 0 ? history[0].id : createNewSession());
      updateSession(targetId, (session) => {
        const currentMessages = session.messages || [];
        const newMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
        return { messages: newMessages };
      });
    });
  }, [activeSessionId, history, createNewSession, updateSession]);

  // Helper utility to attach reference tags, files, and camera snapshots to the workspace.
  // Updates local state immediately, and defers context sync outside the pure reducer
  // to avoid "Cannot update a component while rendering a different component" warnings.
  const setAttachedFiles = React.useCallback((updater: AttachedFile[] | ((prev: AttachedFile[]) => AttachedFile[])) => {
    const targetId = activeSessionId || (history.length > 0 ? history[0].id : createNewSession());
    setLocalAttachedFiles(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      // Defer external context mutation outside of the state reducer
      queueMicrotask(() => {
        updateSession(targetId, { attachedFiles: updated });
      });
      return updated;
    });
  }, [activeSessionId, history, createNewSession, updateSession]);

  // Ensure active session exists
  useEffect(() => {
    if (!activeSessionId && history.length === 0) {
      createNewSession();
    } else if (!activeSessionId && history.length > 0) {
      setActiveSessionId(history[0].id);
    } else if (activeSessionId) {
      // Track session as active mission
      trackActivity({
        title: activeSession?.title || 'Mentor Session',
        duration: '10m',
        type: 'ai-breakdown',
        metadata: { sessionId: activeSessionId }
      });
    }
  }, [activeSessionId, history, activeSession?.title, trackActivity, createNewSession, setActiveSessionId]);

  const isInitialLoadRef = useRef(true);
  const lastScrollPosRef = useRef(activeSession?.scrollPosition || 0);

  // Restore input and scroll when session changes
  useEffect(() => {
    if (activeSession) {
      setInput(activeSession.draftInput || '');
      lastScrollPosRef.current = activeSession.scrollPosition || 0;
      isInitialLoadRef.current = true;
      
      // Delay scroll restoration slightly to ensure DOM content is rendered
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = activeSession.scrollPosition || 0;
          // Brief delay before allowing auto-scrolling to prevent it from jumping
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 150);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeSessionId]);

  // Save current input and scroll on unmount or before session change
  useEffect(() => {
    return () => {
      if (activeSessionId) {
        updateSession(activeSessionId, { 
          draftInput: inputRef.current,
          scrollPosition: lastScrollPosRef.current
        });
      }
    };
  }, [activeSessionId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isInitialLoadRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      lastScrollPosRef.current = scrollTop;
      
      // Show button if not at bottom (with 100px threshold)
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 150);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const isOffline = useOffline();
  const inputTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef(input);
  const isVoiceModeRef = useRef(isVoiceMode);
  const isLoadingRef = useRef(isLoading);

  const MODE_COLORS: Record<string, string> = {
    [UserIntentMode.SOCIAL]: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    [UserIntentMode.DIRECTIONAL]: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    [UserIntentMode.DEEP]: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    [UserIntentMode.CONFUSED]: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    [UserIntentMode.SHORTCUT]: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  useEffect(() => {
    inputRef.current = input;
    isVoiceModeRef.current = isVoiceMode;
    isLoadingRef.current = isLoading;
  }, [input, isVoiceMode, isLoading]);

  const stopSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startSilenceTimer = () => {
    stopSilenceTimer();
    if (isVoiceMode) {
      silenceTimerRef.current = setTimeout(() => {
        const currentVal = inputRef.current.trim();
        if (currentVal && !isLoading) {
           console.log("Auto-sending transcript:", currentVal);
           handleSend();
           if (recognitionRef.current) {
             try {
               recognitionRef.current.stop();
             } catch (e) {
               console.error("Stop failed", e);
             }
           }
        }
      }, 2500); // Increased timeout for better natural pauses
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setInput(value);
    setCursorPos(position);

    // Detect @mention
    const lastAt = value.lastIndexOf('@', position - 1);
    if (lastAt !== -1) {
      const query = value.substring(lastAt + 1, position);
      if (!query.includes(' ')) {
        setMentionSearch(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  // Auto-resize textarea when input changes (especially for long prompts)
  useEffect(() => {
    if (inputTextAreaRef.current) {
      inputTextAreaRef.current.style.height = 'auto';
      inputTextAreaRef.current.style.height = `${Math.min(inputTextAreaRef.current.scrollHeight, 280)}px`;
    }
  }, [input]);

  const addFromLibrary = async (lecture: LectureContent) => {
    if (attachedFiles.some(f => f.id === lecture.id)) return;

    const newAttached: AttachedFile = {
      id: lecture.id,
      name: lecture.title,
      content: undefined // Pre-loaded asynchronously below
    };

    setAttachedFiles(prev => [...prev, newAttached]);
    setShowMentions(false);
    setShowLibrary(false);
    
    // If it was a mention, clear the mention text
    if (showMentions) {
        const lastAt = input.lastIndexOf('@', cursorPos - 1);
        const newValue = input.substring(0, lastAt) + input.substring(cursorPos);
        setInput(newValue);
    }

    // Process and pre-hydrate the lecture context in the background
    try {
      let text = '';
      if (lecture.type === 'pdf' && lecture.url) {
        try {
          const response = await fetch(lecture.url);
          const blob = await response.blob();
          const file = new File([blob], lecture.title, { type: 'application/pdf' });
          text = await extractTextFromPDF(file);
        } catch (e) {
          console.warn("Library PDF fetch failed, using fallback summary", e);
          text = `Content of ${lecture.title} (${lecture.course}). This is a lecture material about thermodynamics and fluid mechanics.`;
        }
      } else {
        text = `[Lecture Material: ${lecture.title}]\nCourse: ${lecture.course}\nType: ${lecture.type || 'N/A'}\nSummary: ${lecture.aiContextAnalysis || 'Study material for regular review.'}\nKey takeaways:\n${Array.isArray(lecture.aiInsights) ? lecture.aiInsights.map((ins: any) => `- ${ins.title || ins}: ${ins.description || ''}`).join('\n') : ''}`;
      }

      setAttachedFiles(prev => prev.map(f => f.id === lecture.id ? { ...f, content: text } : f));
    } catch (err) {
      console.error("Failed pre-processing library item:", err);
    }
  };

  // Handle preselected topic from Analytics
  useEffect(() => {
    if (preselectedTopic) {
      setInput(preselectedTopic);
      // Automatically trigger explanation
      const triggerExplain = async () => {
        const userMessage: Message = {
            id: `pre-user-${generateId()}`,
            role: 'user',
            content: `Can you explain ${preselectedTopic}? I need to improve on this.`
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        try {
            const result = await aiService.explainTopic(preselectedTopic);
            const assistantMessage: Message = {
                id: `pre-ai-${generateId()}`,
                role: 'assistant',
                content: `Sure, let's dive into ${preselectedTopic} to boost your mastery:`,
                explanation: result
            };
            setMessages(prev => [...prev, assistantMessage]);
            speakMessage(assistantMessage.content + " " + (result.explanation || ""));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
            if (onClearTopic) onClearTopic();
            setInput('');
        }
      };
      triggerExplain();
    }
  }, [preselectedTopic]);

  // Auto-scroll logic refined: preserve position unless near bottom
  useEffect(() => {
    if (scrollRef.current && !isInitialLoadRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 250;
      
      // Only auto-scroll if user is already near bottom or if it's a very short session
      if (isAtBottom || messages.length <= 2) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages]);

  const handleUpdateMessage = (id: string, newContent: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent } : m));
    setEditingMessageId(null);
  };


  const extractTextFromPDF = React.useCallback(async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        text += strings.join(' ') + '\n';
      }
      return text.trim();
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error('Failed to extract text from PDF. The file might be corrupted or protected.');
    }
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to read file as data url.'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const processAndAttachFile = async (af: AttachedFile) => {
    // 1. Add immediately with empty/undefined content for rapid UI response
    setAttachedFiles(prev => {
      if (prev.some(f => f.id === af.id)) return prev;
      return [...prev, af];
    });

    if (af.file) {
      try {
        let text = '';
        let signedUrl = '';
        let storagePath = '';

        // Upload attachment to private Supabase bucket starts with user.id folder
        if (user && isRealUserSession(user.id)) {
          const filePath = `${user.id}/tutor-attachments/${af.id}-${af.file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('app-files')
            .upload(filePath, af.file, { cacheControl: '3600', upsert: true });

          if (uploadErr) {
            console.error("Error uploading tutor attachment code:", uploadErr);
          } else {
            storagePath = filePath;
            // Generate private signed URL valid for 7 days
            const { data: signedData, error: signErr } = await supabase.storage
              .from('app-files')
              .createSignedUrl(filePath, 60 * 60 * 24 * 7);
            if (!signErr && signedData?.signedUrl) {
              signedUrl = signedData.signedUrl;
            }
          }
        }

        if (af.file.type === 'application/pdf') {
          text = await extractTextFromPDF(af.file);
        } else if (af.file.type.startsWith('image/')) {
          try {
            const base64 = await fileToBase64(af.file);
            text = await aiService.describeImage(base64, af.file.type);
          } catch (imgErr) {
            console.error("Failed to describe image with Vision:", imgErr);
            text = `[Visual Reference: Captured photo/snapshot titled "${af.name}"]`;
          }
        } else {
          text = await af.file.text();
        }

        // 2. Hydrate text contents, path, and signed URL back to the item
        setAttachedFiles(prev => prev.map(f => f.id === af.id ? { 
          ...f, 
          content: text,
          path: storagePath || (f as any).path,
          url: signedUrl || f.url
        } : f));
      } catch (err) {
        console.error("Failed background parsing of files:", err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = Array.from(files as FileList).map((file: File) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      file: file,
    }));

    if (fileInputRef.current) fileInputRef.current.value = '';

    // Process all files concurrently
    await Promise.all(newFiles.map(processAndAttachFile));
  };

  const handleCameraCapture = async (file: File) => {
    const newFile: AttachedFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Capture-${new Date().toLocaleTimeString()}.jpg`,
      file: file,
    };
    setShowCamera(false);
    await processAndAttachFile(newFile);
  };

  const removeFile = async (id: string) => {
    const target = attachedFiles.find(f => f.id === id);
    if (target && (target as any).path && user && isRealUserSession(user.id)) {
      try {
        await supabase.storage.from('app-files').remove([(target as any).path]);
      } catch (delErr) {
        console.error("Error removing file from Supabase storage bucket:", delErr);
      }
    }
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Utility handler to execute preselected prompts or suggestions instantly.
  // Invokes handleSend directly with the prompt string, completely eliminating
  // DOM selectors and race conditions.
  const handleSendWithPrompt = async (prompt: string) => {
    setInput('');
    await handleSend(prompt);
  };

  const speakMessage = React.useCallback((text: string) => {
    trackActivity({
      title: 'Voice Session: AI Feedback',
      duration: '3m',
      type: 'voice',
      topic: activeSession?.title || preselectedTopic || 'AITutor'
    });
    if (!isMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      // Clean up markdown/extra symbols for better speech
      const cleanText = text.replace(/[#*`_~]/g, '').slice(0, 500);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [isMuted]);

  const handleSend = React.useCallback(async (arg?: string | React.MouseEvent | React.KeyboardEvent) => {
    const textToSend = typeof arg === 'string' ? arg : input;
    const hasAttachments = attachedFiles.length > 0;
    
    if ((!textToSend.trim() && !hasAttachments) || isLoading) return;

    if (inputTextAreaRef.current) inputTextAreaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      // Process files FIRST to get content for both AI context and message history
      const processedFiles = await Promise.all(attachedFiles.map(async (af) => {
        if (af.content) return af; // Already processed

        const libraryItem = library.find(l => l.id === af.id);
        
        if (af.file || libraryItem) {
          try {
            let text = '';
            
            if (af.file) {
              if (af.file.type === 'application/pdf') {
                text = await extractTextFromPDF(af.file);
              } else if (af.file.type.startsWith('image/')) {
                try {
                  const base64 = await fileToBase64(af.file);
                  text = await aiService.describeImage(base64, af.file.type);
                } catch (imgErr) {
                  console.error("Failed to process image with Vision:", imgErr);
                  text = `[Visual Reference: Captured photo/snapshot titled "${af.name}"]`;
                }
              } else {
                text = await af.file.text();
              }
            } else if (libraryItem) {
              if (libraryItem.type === 'pdf' && libraryItem.url) {
                try {
                  const response = await fetch(libraryItem.url);
                  const blob = await response.blob();
                  const file = new File([blob], libraryItem.title, { type: 'application/pdf' });
                  text = await extractTextFromPDF(file);
                } catch (e) {
                   console.warn("Library PDF fetch failed, using fallback summary", e);
                   text = `Content of ${libraryItem.title} (${libraryItem.course}). This is a lecture material about thermodynamics and fluid mechanics.`;
                }
              } else {
                text = `[Lecture Material: ${libraryItem.title}]\nCourse: ${libraryItem.course}\nType: ${libraryItem.type || 'N/A'}\nSummary: ${libraryItem.aiContextAnalysis || 'Study material for regular review.'}\nKey takeaways:\n${Array.isArray(libraryItem.aiInsights) ? libraryItem.aiInsights.map((ins: any) => `- ${ins.title || ins}: ${ins.description || ''}`).join('\n') : ''}`;
              }
            }
            // Return processed file with text content and WITHOUT the raw File object for persistence
            return { ...af, content: text, file: undefined };
          } catch (err) {
            console.error(`Failed to index ${af.name}:`, err);
            return af;
          }
        }
        return af;
      }));

      const userMessage: Message = {
        id: `user-${generateId()}`,
        role: 'user',
        content: textToSend,
        attachedFiles: processedFiles
      };

      setMessages(prev => [...prev, userMessage]);
      const currentInput = textToSend;
      
      setInput('');
      setAttachedFiles([]);
      
      // Clear draft and pending files for this session
      if (activeSessionId) {
        updateSession(activeSessionId, { 
          draftInput: '',
          attachedFiles: [] 
        });
      }

      // Aggregate all indexing errors if any
      const failedFiles = processedFiles.filter(f => !f.content && (f.file || library.find(l => l.id === f.id)));
      if (failedFiles.length > 0) {
        const errorMsg: Message = {
          id: `error-${generateId()}`,
          role: 'assistant',
          content: `⚠️ **Processing Error:** I couldn't read the following files: ${failedFiles.map(f => f.name).join(', ')}. Please ensure they are valid PDF, Image, or Text files.`
        };
        setMessages(prev => [...prev, errorMsg]);
      }

      // Consolidate context from ALL previous user messages in the session
      const previousFiles: AttachedFile[] = [];
      const seenFileIds = new Set<string>();
      
      messages.forEach(m => {
        if (m.attachedFiles && m.role === 'user') {
          m.attachedFiles.forEach(file => {
            if (!seenFileIds.has(file.id)) {
              seenFileIds.add(file.id);
              previousFiles.push(file);
            }
          });
        }
      });

      // Filter tags and documents from both previous and current processed files
      const allFiles = [...previousFiles, ...processedFiles];

      // Extract reference tags vs physical documents to attach context properly
      const tags = allFiles
        .filter(f => f.id.startsWith('tag-'))
        .map(f => f.content?.replace('CONTEXT_TAG:', '').trim() || f.name);

      const documentsOnly = allFiles
        .filter(f => f.content && !f.id.startsWith('tag-'));

      let combinedContext = documentsOnly
        .map(f => {
          const prefix = f.isPinned ? `[IMPORTANT CONTEXT SOURCE: ${f.name}]\n` : `--- Document: ${f.name} ---\n`;
          return `${prefix}${f.content}`;
        })
        .join('\n\n');

      if (tags.length > 0) {
        const tagDirectives = `[ACTIVE SESSION FOCUS TAGS]: Applied by user to tutor on uploads - ${tags.join(', ')}\n`;
        combinedContext = `${tagDirectives}\n${combinedContext}`.trim();
      }

      // Inject tag directives directly into the input to force the Gemini LLM to adhere to the requested tutoring mode
      let processedInput = currentInput;
      if (tags.length > 0) {
        processedInput += `\n\n[Active Tutoring Directive: Please tailor and focus your response, as well as any of the uploaded materials context, strictly around these concepts/modes: ${tags.join(', ')}]`;
      }

      // Check if user is asking for a quiz specifically
      const isQuizRequest = currentInput.toLowerCase().includes('quiz') || currentInput.toLowerCase().includes('test');
      
      if (isQuizRequest) {
        trackActivity({
          title: `Interactive Quiz: ${activeSession?.title || currentInput.slice(0, 20)}`,
          duration: '5m',
          type: 'quiz',
          topic: activeSession?.title || 'Knowledge Check'
        });
        const quizResult = await aiService.generateFullQuiz(processedInput, combinedContext);
        const assistantMessage: Message = {
          id: `quiz-${generateId()}`,
          role: 'assistant',
          content: quizResult.message || `Knowledge Checkpoint: I've generated a tailored quiz based on ${documentsOnly.length > 0 ? `${documentsOnly.length} uploaded document(s)` : 'the topic'}.`,
          quiz: quizResult.questions
        };
        setMessages(prev => [...prev, assistantMessage]);
        speakMessage(assistantMessage.content);
      } else {
        trackActivity({
          title: `AI Summary: ${activeSession?.title || currentInput.slice(0, 20)}`,
          duration: '10m',
          type: 'ai-breakdown',
          topic: activeSession?.title || 'Topic Deep Dive'
        });
        const historyData = messages.map(m => ({ role: m.role, content: m.content }));
        const result = await aiService.explainTopic(processedInput, combinedContext, historyData);
        
        const assistantMessage: Message = {
          id: `explain-${generateId()}`,
          role: 'assistant',
          content: result.intent === UserIntentMode.SOCIAL 
            ? "" // Don't add base content for social, let markdown handle it
            : `Based on your request ${documentsOnly.length > 0 ? `and ${documentsOnly.length} uploaded document(s)` : ''}:`,
          explanation: result
        };
        setMessages(prev => [...prev, assistantMessage]);
        speakMessage((assistantMessage.content ? assistantMessage.content + " " : "") + (result.explanation || ""));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [input, attachedFiles, isLoading, extractTextFromPDF, speakMessage, library, messages, activeSessionId, activeSession?.title, trackActivity, updateSession]);

  const handleFeedback = (id: string) => {
    setFeedbackTarget(id);
    setFeedbackText('');
    setFeedbackRating(0);
  };

  const submitFeedback = () => {
    if (!feedbackTarget) return;
    setMessages(prev => prev.map(m => 
      m.id === feedbackTarget ? { ...m, feedback: { rating: feedbackRating, comment: feedbackText } } : m
    ));
    setFeedbackTarget(null);
  };

  const handleQuizFinish = async (score: number, total: number, questions: QuizQuestion[], userAnswers: number[]) => {
    setActiveQuiz(null);
    setIsLoading(true);

    try {
      const results = questions.map((q, i) => ({
        question: q.question,
        isCorrect: userAnswers[i] === q.answerIndex,
        explanation: q.explanation
      }));

      const analysis = await aiService.analyzeQuizResults("Concept Mastery Check", results);

      const assistantMsg: Message = {
        id: `analysis-${generateId()}`,
        role: 'assistant',
        content: analysis.message || `Arena Cleared! Final Score: ${score}/${total}. ${score === total ? "Perfection achieved. You've mastered this segment." : "Solid effort. I've analyzed your performance to help you bridge the remaining gaps."}`,
        analysis: analysis
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true;
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => {
            const trimmed = prev.trim();
            const newVal = trimmed ? `${trimmed} ${finalTranscript}` : finalTranscript;
            inputRef.current = newVal;
            return newVal;
          });
          setInterimInput('');
          if (isVoiceModeRef.current) startSilenceTimer();
        } else {
          setInterimInput(interimTranscript);
          if (isVoiceModeRef.current) stopSilenceTimer();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        isRecognitionActiveRef.current = false;
        if (event.error === 'not-allowed') {
          setIsRecording(false);
          setIsVoiceMode(false);
          setMessages(prev => [
            ...prev,
            {
              id: `mic-warn-${Date.now()}`,
              role: 'assistant',
              content: '⚠️ **Microphone Access:** Microphone permission is blocked. Please allow microphone access in your browser settings to use voice input.'
            }
          ]);
        }
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;
        if (isVoiceModeRef.current && !isLoadingRef.current) {
          try {
            if (!isRecognitionActiveRef.current) {
              recognition.start();
            }
          } catch (e) {
            // Likely already started
          }
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setMessages(prev => [
        ...prev,
        {
          id: `voice-warn-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ **Speech Recognition:** Voice recognition is not supported in this browser environment.'
        }
      ]);
      return;
    }

    if (isRecording) {
      setIsVoiceMode(false);
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        isRecognitionActiveRef.current = false;
      }
      setInterimInput('');
      stopSilenceTimer();
    } else {
      setIsVoiceMode(true);
      setIsRecording(true);
      try {
        if (recognitionRef.current && !isRecognitionActiveRef.current) {
          recognitionRef.current.start();
        }
      } catch (e) {
        console.error("Failed to start recording:", e);
      }
    }
  };

  const startQuiz = (questions: QuizQuestion[]) => {
    setActiveQuiz({
      questions,
      index: 0,
      score: 0,
      answers: []
    });
  };

  const dynamicSuggestions = React.useMemo(() => {
    const suggs: { label: string, prompt: string }[] = [];

    // Prioritize dedicated pre-generated starter prompts for the loaded document
    if (customContextPrompts && customContextPrompts.length > 0) {
      customContextPrompts.forEach((prompt, index) => {
        const labels = ["Core Takeaways", "Exam Concepts", "Simplify Idea"];
        suggs.push({
          label: labels[index] || "Starter Prompt",
          prompt: prompt
        });
      });
    }

    // Context from pinned or attached files
    const primaryFile = attachedFiles.find(f => f.isPinned) || attachedFiles[0];
    if (primaryFile) {
      suggs.push({ 
        label: "Summarize File", 
        prompt: `Can you provide a concise summary of the key points in ${primaryFile.name}?` 
      });
      suggs.push({ 
        label: "Exam Content", 
        prompt: `Based on ${primaryFile.name}, what are the most likely high-probability exam topics?` 
      });
      suggs.push({ 
        label: "Practice Quiz", 
        prompt: `Generate a 3-question quiz based on ${primaryFile.name} to test my understanding.` 
      });
    }

    // Context from ongoing chat
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg && lastAssistantMsg.id !== 'welcome-message') {
      suggs.push({ 
        label: "Give Example", 
        prompt: "Can you give me a real-world example of what you just explained?" 
      });
      suggs.push({ 
        label: "Explain Simply", 
        prompt: "Can you re-explain the last point but way more simply, using an analogy?" 
      });
      suggs.push({ 
        label: "Key Takeaways", 
        prompt: "What are the 3 most important things I should remember from your last explanation?" 
      });
    }

    // Default high-value prompts
    if (suggs.length < 3) {
      suggs.push({ 
        label: "Study Strategy", 
        prompt: "How should I structure my study session for maximum retention today?" 
      });
      suggs.push({ 
        label: "Concept Explorer", 
        prompt: "Explain a difficult concept from my courses using the Feynman Technique." 
      });
      if (library.length > 0) {
        const uniqueCourses = Array.from(new Set(library.map(l => l.course)));
        const randomCourse = uniqueCourses[Math.floor(Math.random() * uniqueCourses.length)];
        suggs.push({ 
          label: `${randomCourse} Intro`, 
          prompt: `What are the core fundamentals I need to know for ${randomCourse}?` 
        });
      }
    }

    return suggs.slice(0, 8);
  }, [messages, attachedFiles, library, customContextPrompts]);

  const handleSuggestion = (topic: string) => {
    setInput(topic);
    if (inputTextAreaRef.current) {
      inputTextAreaRef.current.focus();
      // Brief delay to ensure state has updated before measuring
      setTimeout(() => {
        if (inputTextAreaRef.current) {
          inputTextAreaRef.current.style.height = 'auto';
          inputTextAreaRef.current.style.height = `${inputTextAreaRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  const loadSession = (session: ChatSession) => {
    // Clear current input before switching to avoid saving it to the new session's draft
    setInput('');
    setActiveSessionId(session.id);
    setShowHistory(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSessionFromCtx(id);
  };

  const handleHistoryLongPressStart = (id: string) => {
    historyLongPressTimer.current = setTimeout(() => {
      setIsHistorySelectionMode(true);
      setSelectedSessionIds([id]);
    }, 700);
  };

  const handleHistoryLongPressEnd = () => {
    if (historyLongPressTimer.current) {
      clearTimeout(historyLongPressTimer.current);
      historyLongPressTimer.current = null;
    }
  };

  const toggleHistorySelection = (id: string) => {
    setSelectedSessionIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedSessions = () => {
    deleteMultipleFromCtx(selectedSessionIds);
    setSelectedSessionIds([]);
    setIsHistorySelectionMode(false);
  };

  const newChat = () => {
    setInput('');
    createNewSession();
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-dark-bg">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".pdf,.txt"
        multiple
      />

      <AnimatePresence>
        {showCamera && (
          <CameraModal 
            onCapture={handleCameraCapture} 
            onClose={() => setShowCamera(false)} 
          />
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="px-6 pt-2 pb-4 glass-surface border-b border-white/5 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onNavigate?.('home')}
              className="p-1 -ml-2 text-white/40 hover:text-white transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </motion.button>
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Brain size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Studibl AI</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowHistory(true)}
              className="p-2.5 glass rounded-xl text-white/40 hover:text-white transition-all"
              title="Session History"
            >
              <History size={18} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSendWithPrompt("Generate a comprehensive quiz based on my notes")}
              className="p-2.5 glass rounded-xl text-brand-primary/60 hover:text-brand-primary transition-all flex items-center gap-2 group"
              title="Arena Mode"
            >
              <Swords size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Arena Mode</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div 
        ref={scrollRef} 
        onScroll={handleScroll}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto px-6 py-6 scrollbar-hide space-y-6 transition-opacity duration-300",
          isOffline ? "opacity-50 pointer-events-none" : "opacity-100"
        )}
      >
        <AnimatePresence initial={false}>
          {messages.map((m, msgIdx) => (
            <motion.div
              key={`tutor-msg-${m.id || msgIdx}-${msgIdx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 2 }}
              className={cn(
                "flex w-full mb-6 lg:mb-10",
                m.role === 'user' ? 'justify-end' : 'justify-center'
              )}
            >
              <div className={cn(
                m.role === 'user' 
                  ? 'max-w-[85%] sm:max-w-[70%] self-end' 
                  : 'w-full max-w-[700px] px-0'
              )}>
                {m.role === 'user' ? (
                  <div className="flex flex-col items-end gap-2 group/msg relative">
                    {m.attachedFiles && m.attachedFiles.length > 0 && (
                      <div className="flex flex-col gap-1 w-full items-end">
                        {m.attachedFiles.map((file, fIdx) => {
                          const isTag = file.id.startsWith('tag-');
                          const isLibrary = library.some(l => l.id === file.id);
                          return (
                            <div 
                              key={`msg-file-${file.id || fIdx}-${fIdx}`} 
                              className="flex items-center gap-2 px-3 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-brand-primary"
                            >
                              {isTag ? <Brain size={14} /> : isLibrary ? <BookOpen size={14} /> : <FileText size={14} />}
                              <span className="text-[10px] font-bold truncate max-w-[150px]">{file.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(m.content || (!m.attachedFiles || m.attachedFiles.length === 0)) && (
                      <div 
                        onMouseDown={(e) => {
                          longPressTimer.current = setTimeout(() => {
                            setShowContextMenu({ x: e.clientX, y: e.clientY, messageId: m.id });
                          }, 600);
                        }}
                        onMouseUp={() => {
                          if (longPressTimer.current) clearTimeout(longPressTimer.current);
                        }}
                        onTouchStart={(e) => {
                          const touch = e.touches[0];
                          longPressTimer.current = setTimeout(() => {
                            setShowContextMenu({ x: touch.clientX, y: touch.clientY, messageId: m.id });
                          }, 600);
                        }}
                        onTouchEnd={() => {
                          if (longPressTimer.current) clearTimeout(longPressTimer.current);
                        }}
                        className={cn(
                          "glass bg-brand-primary/10 border-brand-primary/20 p-4 rounded-2xl rounded-tr-none text-sm text-white shadow-lg shadow-brand-primary/5 cursor-pointer active:scale-[0.98] transition-transform",
                          editingMessageId === m.id && "ring-2 ring-brand-primary/50"
                        )}
                      >
                        {editingMessageId === m.id ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <textarea
                              autoFocus
                              value={editInput}
                              onChange={(e) => setEditInput(e.target.value)}
                              className="w-full bg-black/20 border-none text-white text-sm focus:outline-none resize-none min-h-[60px]"
                            />
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingMessageId(null)}
                                className="text-[10px] uppercase font-black text-white/40"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleUpdateMessage(m.id, editInput)}
                                className="text-[10px] uppercase font-black text-brand-primary"
                              >
                                Update
                              </button>
                            </div>
                          </div>
                        ) : (
                          m.content || "Uploaded files for analysis"
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Simplified Reading Interface (Container-free) */}
                    <div className="relative group/ai">
                      <div className="space-y-3">
                        {m.explanation ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 opacity-50">
                                <Brain size={18} className="text-brand-primary" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">AI Analysis & Logic</span>
                              </div>
                              {m.explanation.intent && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                    MODE_COLORS[m.explanation.intent] || "text-white/40 bg-white/5 border-white/10"
                                  )}
                                >
                                  {m.explanation.intent}
                                </motion.div>
                              )}
                            </div>
                            <div className="markdown-body prose prose-invert prose-sm max-w-none text-white/90">
                              <Markdown>
                                {m.explanation.explanation}
                              </Markdown>
                            </div>
                            {m.explanation.suggestedFollowUp && (
                              <div className="pt-2 flex flex-col gap-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Elite Recommendation</span>
                                <button 
                                  onClick={() => handleSuggestion(m.explanation!.suggestedFollowUp!)}
                                  className="text-left text-xs text-brand-primary/80 hover:text-brand-primary transition-colors flex items-center gap-2 group"
                                >
                                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                  {m.explanation.suggestedFollowUp}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : m.analysis ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4 opacity-50">
                              <Sparkles size={18} className="text-brand-primary" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Performance Insights</span>
                            </div>
                            <div className="markdown-body prose prose-invert prose-sm max-w-none text-white/90 italic">
                                <Markdown>{m.analysis.summary}</Markdown>
                            </div>
                              
                            <div className="space-y-2 pt-4 border-t border-white/5">
                              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                                <GraduationCap size={14} /> Strategic Study Plan
                              </h4>
                              <div className="markdown-body prose prose-invert prose-sm max-w-none text-white/70 font-normal leading-relaxed">
                                <Markdown>{m.analysis.studyPlan}</Markdown>
                              </div>
                            </div>
                          </div>
                        ) : m.quiz ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-2 opacity-50">
                              <Swords size={18} className="text-brand-secondary" />
                              <span className="text-[11px] font-normal uppercase tracking-[0.2em] text-white/50">Interactive Session ready</span>
                            </div>
                            <div className="markdown-body prose prose-invert prose-sm max-w-none text-white/90 font-normal text-sm leading-relaxed">
                              <Markdown>{m.content}</Markdown>
                            </div>
                            <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                startQuiz(m.quiz!);
                                localStorage.setItem('studibl_latest_ai_quiz', JSON.stringify({
                                  title: `AI Topic Check: ${m.content.split('based on ')[1]?.replace('.', '') || 'Concept Mastery'}`,
                                  questions: m.quiz
                                }));
                              }}
                              className="w-full py-3 bg-brand-secondary text-white font-black uppercase tracking-[0.2em] rounded-xl text-[9px] hover:neon-glow transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-secondary/20"
                            >
                              <Plus size={16} /> Start Interactive Session
                            </motion.button>
                          </div>
                        ) : (
                          <div className="markdown-body prose prose-invert prose-sm max-w-none text-white/80">
                            <Markdown>{m.content}</Markdown>
                          </div>
                        )}
                      </div>


                      {/* Action Bar - Styled subtly at bottom */}
                      <div className="mt-4 pt-2 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity flex justify-center">
                         <MessageActions 
                           message={m}
                           onFeedback={(rating) => {
                             setFeedbackTarget(m.id);
                             setFeedbackRating(rating);
                             submitFeedback();
                           }}
                           onSpeak={() => speakMessage(m.content + " " + (m.explanation?.explanation || m.analysis?.summary || ""))}
                           onRegenerate={() => {
                             const lastUserMsg = [...messages].reverse().find(msg => msg.role === 'user');
                             if (lastUserMsg) handleSendWithPrompt(lastUserMsg.content);
                           }}
                         />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="flex justify-start"
            >
              <div className="flex flex-col gap-4 w-full max-w-[500px]">
                <div className="flex items-center gap-3 glass p-4 rounded-2xl rounded-tl-none border-white/5 bg-white/[0.02]">
                  <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-brand-primary animate-pulse" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">AI Tutor is thinking</span>
                    </div>
                    <Skeleton className="w-3/4 h-2" borderRadius="2px" />
                  </div>
                </div>
                {/* Visual Skeleton of the response */}
                <div className="space-y-3 pl-11">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-5/6 h-4" />
                  <Skeleton className="w-2/3 h-4" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="w-24 h-8" borderRadius="12px" />
                    <Skeleton className="w-24 h-8" borderRadius="12px" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showContextMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" 
              onClick={() => setShowContextMenu(null)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 50 }}
              className="fixed bottom-10 left-6 right-6 z-[120] bg-[#2F2F2F] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-2 max-w-sm mx-auto"
            >
              <div className="p-3 border-b border-white/5 mb-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Message Actions</p>
              </div>
              <button 
                onClick={() => {
                  const msg = messages.find(m => m.id === showContextMenu.messageId);
                  if (msg) {
                    setEditingMessageId(showContextMenu.messageId);
                    setEditInput(msg.content);
                  }
                  setShowContextMenu(null);
                }}
                className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/5 transition-all text-left group rounded-2xl"
              >
                <div className="p-2 bg-brand-primary/10 rounded-xl">
                  <FileText size={20} className="text-brand-primary" />
                </div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-white">Edit Message</p>
                   <p className="text-[10px] text-white/40 font-medium">Modify your prompt for better results</p>
                </div>
              </button>
              
              <button 
                onClick={() => setShowContextMenu(null)}
                className="w-full py-4 text-center text-xs font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* History Sidebar/Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 w-[85%] md:w-[400px] bg-dark-bg border-l border-white/5 z-[101] flex flex-col p-6"
            >
              <div className="flex items-center justify-between mb-8">
                 <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-2">
                   <History size={24} className="text-brand-primary" /> Session Logs
                 </h2>
                 <div className="flex items-center gap-1">
                   {isHistorySelectionMode && (
                     <motion.button 
                       initial={{ scale: 0 }}
                       animate={{ scale: 1 }}
                       onClick={deleteSelectedSessions}
                       disabled={selectedSessionIds.length === 0}
                       className="p-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 flex items-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50"
                       title="Delete Selected Sessions"
                     >
                       <Trash2 size={18} />
                       {selectedSessionIds.length > 0 && <span>{selectedSessionIds.length}</span>}
                     </motion.button>
                   )}
                   {isHistorySelectionMode && (
                     <button 
                       onClick={() => {
                         setIsHistorySelectionMode(false);
                         setSelectedSessionIds([]);
                       }}
                       className="p-2.5 text-white/40 hover:text-white transition-colors"
                       title="Cancel Selection"
                     >
                       <X size={20} />
                     </button>
                   )}
                   {!isHistorySelectionMode && (
                     <button onClick={() => setShowHistory(false)} className="p-2.5 text-white/20 hover:text-white transition-colors">
                       <X size={20} />
                     </button>
                   )}
                 </div>
              </div>

              <button 
                onClick={newChat}
                disabled={isHistorySelectionMode}
                className={cn(
                  "w-full py-4 border border-brand-primary/20 rounded-2xl flex items-center justify-center gap-2 text-brand-primary font-black uppercase text-[10px] tracking-widest hover:bg-brand-primary/5 transition-all mb-8",
                  isHistorySelectionMode && "opacity-20 grayscale pointer-events-none"
                )}
              >
                 <Plus size={16} /> New Learning Session
              </button>

              {!isHistorySelectionMode && history.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button 
                    onClick={() => setIsHistorySelectionMode(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:underline px-1 py-1"
                  >
                    Select
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4">
                 {history.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                     <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/10 ring-1 ring-white/5 shadow-inner">
                       <History size={28} />
                     </div>
                     <p className="text-white/40 text-sm font-bold">No saved sessions</p>
                     <p className="text-[10px] text-white/20 uppercase tracking-widest max-w-[200px] leading-relaxed mx-auto">
                       Start your first session to preserve study notes
                     </p>
                   </div>
                 ) : history.map((session, sIdx) => (
                   <motion.div 
                     key={`ai-session-${session.id || sIdx}-${sIdx}`} 
                     className="relative group/session"
                     onMouseDown={() => handleHistoryLongPressStart(session.id)}
                     onMouseUp={handleHistoryLongPressEnd}
                     onMouseLeave={handleHistoryLongPressEnd}
                     onTouchStart={() => handleHistoryLongPressStart(session.id)}
                     onTouchEnd={handleHistoryLongPressEnd}
                   >
                     <button 
                       onClick={() => {
                         if (isHistorySelectionMode) {
                           toggleHistorySelection(session.id);
                         } else {
                           loadSession(session);
                         }
                       }}
                       className={cn(
                         "w-full p-4 glass border-white/5 rounded-2xl text-left group hover:border-white/20 transition-all flex items-center gap-4",
                         activeSessionId === session.id && !isHistorySelectionMode && "border-brand-primary/30 bg-brand-primary/5 shadow-[0_0_15px_rgba(204,255,0,0.05)]",
                         selectedSessionIds.includes(session.id) && "border-brand-primary/50 bg-brand-primary/5"
                       )}
                     >
                        {isHistorySelectionMode && (
                          <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                             <div className={cn(
                               "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                               selectedSessionIds.includes(session.id) 
                                 ? "bg-brand-primary border-brand-primary" 
                                 : "border-white/20"
                             )}>
                               {selectedSessionIds.includes(session.id) && <Check size={14} className="text-dark-bg" />}
                             </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                           <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1">
                             {new Date(session.date).toLocaleDateString()}
                           </div>
                           <h4 className={cn(
                             "text-sm font-bold truncate transition-colors pr-8",
                             activeSessionId === session.id && !isHistorySelectionMode ? "text-brand-primary" : "text-white group-hover:text-brand-primary"
                           )}>
                             {session.title}
                           </h4>
                           {session.attachedFiles && session.attachedFiles.length > 0 && (
                             <div className="flex flex-wrap gap-1 mt-2">
                                {session.attachedFiles.map((file, fIdx) => (
                                  <span key={`sess-file-${file.id || fIdx}-${fIdx}`} className="flex items-center gap-1 text-[8px] bg-brand-primary/5 px-2 py-0.5 rounded-md text-brand-primary/60 font-bold border border-brand-primary/10">
                                    <FileText size={8} /> {file.name}
                                  </span>
                                ))}
                             </div>
                           )}
                        </div>
                     </button>
                     {!isHistorySelectionMode && (
                       <button 
                         onClick={(e) => deleteSession(session.id, e)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/5 opacity-0 group-hover/session:opacity-100 hover:text-red-500 transition-all z-20"
                         title="Delete Session"
                       >
                         <Trash2 size={14} />
                       </button>
                     )}
                   </motion.div>
                 ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quiz Overlay */}
      <AnimatePresence>
        {activeQuiz && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[200] bg-dark-bg p-6 flex flex-col"
          >
             <div className="flex items-center justify-between mb-12">
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                  Stage 0{activeQuiz.index + 1} / {activeQuiz.questions.length}
                </span>
                <button onClick={() => setActiveQuiz(null)} className="p-2 glass rounded-xl text-white/20">
                  <X size={20} />
                </button>
             </div>

             <div className="flex-1 space-y-12">
                <h2 className="text-xl md:text-2xl font-bold leading-tight">
                  {activeQuiz.questions[activeQuiz.index].question}
                </h2>

                <div className="space-y-4">
                  {activeQuiz.questions[activeQuiz.index].options.map((option, idx) => (
                    <motion.button 
                      key={idx}
                      whileHover={{ scale: 1.01, borderColor: "rgba(204, 255, 0, 0.3)", backgroundColor: "rgba(204, 255, 0, 0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const isCorrect = idx === activeQuiz.questions[activeQuiz.index].answerIndex;
                        const newScore = isCorrect ? activeQuiz.score + 1 : activeQuiz.score;
                        
                        if (activeQuiz.index + 1 < activeQuiz.questions.length) {
                          setActiveQuiz({
                            ...activeQuiz,
                            index: activeQuiz.index + 1,
                            score: newScore,
                            answers: [...activeQuiz.answers, idx]
                          });
                        } else {
                          // Quiz Finished
                          handleQuizFinish(newScore, activeQuiz.questions.length, activeQuiz.questions, [...activeQuiz.answers, idx]);
                        }
                      }}
                      className="w-full p-5 glass border-white/5 rounded-2xl text-left text-sm font-medium transition-all"
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedbackTarget && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="glass w-full max-w-md p-8 rounded-[32px] border-white/10 space-y-8"
             >
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-black uppercase tracking-tighter text-white italic">Tutor Feedback</h3>
                   <button onClick={() => setFeedbackTarget(null)} className="p-2 text-white/20"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Helpfulness Level</p>
                   <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star} 
                          onClick={() => setFeedbackRating(star)}
                          className={cn(
                            "transition-all p-1",
                            feedbackRating >= star ? "text-brand-primary scale-125" : "text-white/10"
                          )}
                        >
                           <Star size={20} fill={feedbackRating >= star ? "currentColor" : "none"} />
                        </button>
                      ))}
                   </div>
                   <div className="flex justify-between text-[8px] font-bold text-white/20 uppercase tracking-widest px-1">
                     <span>Not Helpful</span>
                     <span>Masterpiece</span>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Detailed Context (Optional)</p>
                   <textarea 
                     value={feedbackText}
                     onChange={(e) => setFeedbackText(e.target.value)}
                     placeholder="e.g., The explanation was too technical, help me understand the 'why'..."
                     className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs min-h-[120px] focus:outline-none focus:border-brand-primary/40 transition-colors placeholder:text-white/10"
                   />
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgba(204, 255, 0, 0.3)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitFeedback}
                  className="w-full py-4 bg-brand-primary text-dark-bg font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-brand-primary/20 transition-all"
                >
                   Finalize Feedback
                </motion.button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "px-4 pb-2 sm:pb-3 space-y-2 relative z-20 transition-all duration-300",
        isFocused ? "pb-4 mb-2 bg-dark-bg/80 backdrop-blur-md" : ""
      )}>
        {/* Subtle Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && !isFocused && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 z-50"
            >
              <button
                onClick={scrollToBottom}
                className="bg-brand-primary/10 backdrop-blur-md text-brand-primary p-2 rounded-full border border-brand-primary/20 hover:bg-brand-primary/20 transition-all shadow-lg flex items-center justify-center group"
              >
                <ArrowDown size={14} strokeWidth={3} className="group-active:translate-y-0.5 transition-transform" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {isOffline && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 rounded-t-[32px] -mx-4 sm:mx-0">
            <WifiOff className="text-orange-400 mb-2" size={32} />
            <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-tighter">AI Tutor is Offline</h3>
            <p className="text-[10px] text-white/50 leading-relaxed max-w-[200px]">Studibl's AI requires an internet connection. Access your offline lectures in the Library instead.</p>
          </div>
        )}

        {/* Dynamic Suggestion Bar */}
        {!isLoading && !input.trim() && !isRecording && !isFocused && dynamicSuggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory max-w-3xl mx-auto w-full px-1">
            {dynamicSuggestions.map((s, i) => (
              <div key={i} className="snap-start shrink-0">
                <SuggestionChip 
                  label={s.label} 
                  onClick={() => handleSuggestion(s.prompt)} 
                />
              </div>
            ))}
          </div>
        )}

        <div className="max-w-3xl mx-auto w-full relative group/input">
          <div className={cn(
            "relative flex flex-col bg-[#2F2F2F] border border-white/5 rounded-2xl transition-all duration-300",
            (isFocused || isRecording) ? "shadow-2xl ring-1 ring-brand-primary/30 bg-[#2F2F2F] -translate-y-1" : "bg-[#2F2F2F]/90 shadow-lg"
          )}>
            {/* Context Chips (Top) */}
            {attachedFiles.length > 0 && (
              <div className={cn(
                "flex flex-nowrap items-center gap-2 px-4 pt-3 pb-2.5 overflow-x-auto scrollbar-hide border-b border-white/5 mb-1 bg-white/[0.02] rounded-t-2xl transition-all",
                isFocused ? "pt-2 pb-2" : "pt-3 pb-2.5"
              )}>
                {attachedFiles.map((f, fIdx) => {
                  const isTag = f.id.startsWith('tag-');
                  const isLibrary = library.some(l => l.id === f.id);
                  return (
                    <motion.div 
                      key={`attached-file-${f.id || fIdx}-${fIdx}`}
                      initial={{ opacity: 0, scale: 0.9, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all shadow-sm shrink-0",
                        isTag 
                          ? "bg-brand-primary/10 border-brand-primary/20 text-brand-primary" 
                          : isLibrary
                            ? "bg-blue-500/10 border-blue-500/20 text-sky-400"
                            : "bg-white/5 border-white/10 text-white/50"
                      )}
                    >
                      {isTag ? <Brain size={12} /> : isLibrary ? <BookOpen size={12} /> : <FileText size={12} />}
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(f.id);
                        }}
                        className="hover:bg-white/10 p-0.5 rounded-full transition-colors ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="flex items-end gap-1 px-1 py-1">
              {/* Plus Button */}
              <div className="relative mb-0.5">
                <PlusButton 
                  onClick={() => setShowPlusMenu(!showPlusMenu)} 
                  isActive={showPlusMenu}
                  variant="integrated"
                />
                <PlusMenu 
                  show={showPlusMenu} 
                  onClose={() => setShowPlusMenu(false)}
                  onUpload={() => fileInputRef.current?.click()}
                  onLibrary={() => setShowLibrary(true)}
                  onAddContext={(tag) => {
                    const id = `tag-${tag.toLowerCase().replace(/[^\w]/g, '-')}`;
                    if (!attachedFiles.some(f => f.id === id)) {
                      setAttachedFiles(prev => [...prev, {
                        id,
                        name: tag.replace(/[\[\]]/g, ''),
                        content: `CONTEXT_TAG:${tag}`
                      }]);
                    }
                    setShowPlusMenu(false);
                    inputTextAreaRef.current?.focus();
                  }}
                  onCamera={() => setShowCamera(true)}
                />
              </div>

              {/* Input Area */}
              <div className="flex-1 relative min-h-[32px] flex items-center">
                {showMentions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute bottom-full left-0 mb-4 w-64 glass-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-1"
                  >
                    <div className="px-3 py-2 border-b border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Select Context</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
                      {library
                        .filter(l => !removedFromLibrary.includes(l.id))
                        .filter(l => l.title.toLowerCase().includes(mentionSearch.toLowerCase()))
                        .map((lecture, lIdx) => (
                          <button 
                            key={`mention-${lecture.id || lIdx}-${lIdx}`}
                            onClick={() => addFromLibrary(lecture)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-all text-left group"
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              lecture.type === 'pdf' ? "bg-red-500/10 text-red-400" :
                              lecture.type === 'video' ? "bg-blue-500/10 text-blue-400" :
                              "bg-brand-secondary/10 text-brand-secondary"
                            )}>
                              {lecture.type === 'pdf' ? <FileText size={14} /> : <Play size={14} />}
                            </div>
                            <div className="min-w-0">
                               <p className="text-xs font-bold text-white truncate group-hover:text-brand-primary transition-colors">{lecture.title}</p>
                               <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">{lecture.course}</p>
                            </div>
                          </button>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
                <textarea
                  ref={inputTextAreaRef}
                  value={input}
                  onChange={handleInputChange}
                  onFocus={() => {
                    setIsFocused(true);
                  }}
                  onBlur={() => setTimeout(() => {
                    if (!showPlusMenu) {
                      setIsFocused(false);
                    }
                  }, 200)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder={isRecording ? (isVoiceMode ? "Hands-free Active..." : "Listening...") : "Ask anything, @ to mention"}
                  rows={1}
                  className={cn(
                    "w-full bg-transparent border-none py-1.5 px-2 text-xs text-white focus:outline-none transition-all resize-none min-h-[32px] max-h-[100px] sm:max-h-[200px] overflow-y-auto placeholder:text-[11px] placeholder:text-white/25",
                    isRecording && "animate-pulse"
                  )}
                />
                {isRecording && interimInput && (
                  <div className="absolute left-2 top-0 pointer-events-none py-1.5 text-xs text-white/30 truncate w-full">
                    <span className="invisible whitespace-pre-wrap">{input}{input ? ' ' : ''}</span>
                    {interimInput}
                  </div>
                )}
              </div>

              {/* Actions (Bottom-Right) */}
              <div className="flex items-center gap-1.5 shrink-0 pb-0.5 pr-0.5">
                <AnimatePresence mode="popLayout">
                  {!input.trim() && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8, x: 5 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: 5 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleRecording}
                      className={cn(
                        "p-1.5 rounded-full transition-all overflow-hidden",
                        isRecording ? "text-brand-primary bg-brand-primary/10" : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                    </motion.button>
                  )}
                </AnimatePresence>
                
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full transition-all shadow-md",
                    (input.trim() || attachedFiles.length > 0)
                      ? "bg-white text-black translate-y-0" 
                      : "bg-white/5 text-white/10"
                  )}
                >
                  {isLoading ? (
                    <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : input.trim() || attachedFiles.length > 0 ? (
                    <ArrowUp size={14} strokeWidth={2.5} />
                  ) : (
                    <ArrowUp size={14} />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Library Selection Modal */}
      <AnimatePresence>
        {showLibrary && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLibrary(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[500]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed inset-x-0 bottom-0 h-[80vh] bg-dark-bg border-t border-white/5 z-[501] rounded-t-[40px] flex flex-col p-8"
            >
              <div className="flex justify-between items-center mb-8">
                 <div>
                   <h2 className="text-2xl font-black italic uppercase text-white flex items-center gap-2">
                     <BookOpen size={28} className="text-brand-primary" /> Lecture Library
                   </h2>
                   <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">Select context for your AI session</p>
                 </div>
                 <button onClick={() => setShowLibrary(false)} className="p-3 glass rounded-2xl text-white/20 hover:text-white transition-all">
                   <X size={24} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pr-1">
                 {library
                   .filter(l => !removedFromLibrary.includes(l.id))
                   .map((lecture) => {
                   const isAttached = attachedFiles.some(f => f.id === lecture.id);
                   return (
                     <button 
                       key={`lib-modal-${lecture.id}`}
                       disabled={isAttached}
                       onClick={() => addFromLibrary(lecture)}
                       className={cn(
                         "w-full p-4 glass border-white/5 rounded-2xl flex items-center gap-4 group transition-all text-left",
                         isAttached ? "opacity-40 grayscale cursor-default" : "hover:border-brand-primary/30 hover:bg-brand-primary/5 active:scale-98"
                       )}
                     >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                          lecture.type === 'pdf' ? "bg-red-500/10 text-red-400" :
                          lecture.type === 'video' ? "bg-blue-500/10 text-blue-400" :
                          "bg-brand-secondary/10 text-brand-secondary"
                        )}>
                           {lecture.type === 'pdf' ? <FileText size={24} /> : <Play size={24} />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="text-sm font-bold text-white truncate group-hover:text-brand-primary transition-colors">{lecture.title}</h4>
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest leading-none">{lecture.course}</span>
                             <span className="text-[10px] text-white/20 font-bold">•</span>
                             <span className="text-[10px] text-white/20 font-black uppercase tracking-widest leading-none">{lecture.date}</span>
                           </div>
                        </div>
                        <div className={cn(
                          "w-8 h-8 rounded-full border flex items-center justify-center transition-all",
                          isAttached ? "border-brand-primary bg-brand-primary text-dark-bg" : "border-white/10 text-white/10 group-hover:border-brand-primary/40 group-hover:text-brand-primary"
                        )}>
                           {isAttached ? <Check size={16} /> : <Plus size={16} />}
                        </div>
                     </button>
                   );
                 })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageActions({ 
  message, 
  onFeedback, 
  onSpeak, 
  onRegenerate
}: { 
  message: Message, 
  onFeedback: (rating: number) => void,
  onSpeak: () => void,
  onRegenerate: () => void
}) {
  const { savedItems, saveItem, removeItem, activeSession } = useChat();
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const labelTimeout = useRef<NodeJS.Timeout | null>(null);

  const isSaved = savedItems.some(i => i.messageId === message.id);

  const showLabel = (text: string) => {
    if (labelTimeout.current) clearTimeout(labelTimeout.current);
    setActionLabel(text);
    labelTimeout.current = setTimeout(() => setActionLabel(null), 2000);
  };

  const toggleSave = () => {
    if (isSaved) {
      removeItem(message.id);
      showLabel('REMOVED FROM LIBRARY HUB');
    } else {
      let type: 'explanation' | 'analysis' | 'quiz' | 'general' = 'general';
      if (message.explanation) type = 'explanation';
      else if (message.analysis) type = 'analysis';
      else if (message.quiz) type = 'quiz';

      saveItem({
        id: `saved-${Date.now()}`,
        messageId: message.id,
        title: generateAIBookmarkTitle(message),
        content: message.content,
        type,
        timestamp: new Date().toISOString(),
        sessionTitle: activeSession?.title,
        metadata: {
          explanation: message.explanation,
          analysis: message.analysis,
          quiz: message.quiz
        }
      });

      // Success feedback for saving
      showLabel('SAVED TO LIBRARY HUB');
    }
  };

  const handleCopy = () => {
    const text = message.explanation 
      ? `${message.content}\n\n${message.explanation.explanation}`
      : message.content;
    
    navigator.clipboard.writeText(text);
    showLabel('Copied');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Studibl AI Tutor Insight',
        text: message.content,
        url: window.location.href
      }).then(() => {
        showLabel('Shared');
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(window.location.href);
          showLabel('Link Copied');
        }
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showLabel('Link Copied');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-5 p-2 py-1 relative">
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleSave}
          className={cn(
            "transition-all",
            isSaved ? "text-brand-primary" : "text-white/40 hover:text-white"
          )}
          title={isSaved ? "Saved to Hub" : "Save to Hub"}
        >
          <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
        </motion.button>

        <button 
          onClick={handleCopy}
          className="text-white/40 hover:text-white transition-all active:scale-90"
          title="Copy"
        >
          <Copy size={18} />
        </button>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              onFeedback(5);
              showLabel('Helpful rated');
            }}
            className={cn(
              "transition-all active:scale-90",
              message.feedback?.rating === 5 ? "text-brand-primary" : "text-white/40 hover:text-white"
            )}
            title="Good Response"
          >
            <ThumbsUp size={18} />
          </button>
          
          <button 
            onClick={() => {
              onFeedback(1);
              showLabel('Feedback received');
            }}
            className={cn(
              "transition-all active:scale-90",
              message.feedback?.rating === 1 ? "text-red-400" : "text-white/40 hover:text-white"
            )}
            title="Bad Response"
          >
            <ThumbsDown size={18} />
          </button>
        </div>
        
        <button 
          onClick={onSpeak}
          className="text-white/40 hover:text-white transition-all active:scale-90"
          title="Read Aloud"
        >
          <Volume2 size={18} />
        </button>
        
        <button 
          onClick={onRegenerate}
          className="text-white/40 hover:text-white transition-all active:scale-90"
          title="Regenerate"
        >
          <RefreshCcw size={18} />
        </button>
        
        <button 
          onClick={handleShare}
          className="text-white/40 hover:text-white transition-all active:scale-90"
          title="Share"
        >
          <Share2 size={18} />
        </button>
      </div>

      <AnimatePresence>
        {actionLabel && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-primary/60 bg-brand-primary/5 px-3 py-1 rounded-full border border-brand-primary/10"
          >
            {actionLabel}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <motion.button 
      whileHover={{ 
        scale: 1.02, 
        backgroundColor: "rgba(204, 255, 0, 0.15)",
        borderColor: "rgba(204, 255, 0, 0.3)"
      }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="shrink-0 glass px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] text-white/50 hover:text-brand-primary whitespace-nowrap transition-all flex items-center gap-2.5 border border-white/5 shadow-lg"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
      {label}
    </motion.button>
  );
}

function PlusButton({ onClick, isActive, variant }: { onClick: () => void, isActive: boolean, variant: 'integrated' | 'circular' }) {
  return (
    <motion.button 
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "transition-all flex items-center justify-center shrink-0",
        variant === 'integrated' 
          ? "p-[6px] text-white/50 hover:text-white" 
          : "w-11 h-11 rounded-full bg-[#2F2F2F] text-white hover:bg-[#3F3F3F] border border-white/5"
      )}
    >
      <Plus size={variant === 'integrated' ? 16 : 24} className={cn("transition-transform duration-300", isActive && "rotate-45")} />
    </motion.button>
  );
}

function PlusMenu({ show, onClose, onUpload, onLibrary, onAddContext, onCamera }: { 
  show: boolean, 
  onClose: () => void, 
  onUpload: () => void, 
  onLibrary: () => void,
  onAddContext: (tag: string) => void,
  onCamera: () => void
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-4 w-64 bg-[#2F2F2F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[70] p-1.5"
          >
            <div className="p-2 mb-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-2 mb-2">Context Reference</p>
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => onAddContext("[EXAM PREP]")}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-brand-primary/10 rounded-xl transition-all group"
                >
                  <GraduationCap size={14} className="text-brand-primary" />
                  <span className="text-[10px] font-bold text-white/80">Exam Prep</span>
                </button>
                <button 
                  onClick={() => onAddContext("[SUMMARIZE]")}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-brand-secondary/10 rounded-xl transition-all group"
                >
                  <Sparkles size={14} className="text-brand-secondary" />
                  <span className="text-[10px] font-bold text-white/80">Summarize</span>
                </button>
                <button 
                  onClick={() => onAddContext("[SIMPLIFY]")}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-amber-400/10 rounded-xl transition-all group"
                >
                  <Brain size={14} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-white/80">Simplify</span>
                </button>
                <button 
                  onClick={() => onAddContext("[SECTION: ...]")}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-emerald-400/10 rounded-xl transition-all group"
                >
                  <Copy size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-bold text-white/80">Ref Section</span>
                </button>
                <button 
                  onClick={() => onAddContext("[DEEP DIVE]")}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-blue-400/10 rounded-xl transition-all group"
                >
                  <Swords size={14} className="text-blue-400" />
                  <span className="text-[10px] font-bold text-white/80">Deep Dive</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5 mx-2 my-1" />

            <button 
              onClick={() => { onCamera(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Camera size={18} />
              </div>
              <span className="text-sm font-medium text-white/90">Camera Capture</span>
            </button>
            <button 
              onClick={() => { onUpload(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <FileUp size={18} />
              </div>
              <span className="text-sm font-medium text-white/90">Upload Files</span>
            </button>
            <button 
              onClick={() => { onLibrary(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 text-brand-secondary flex items-center justify-center">
                <BookOpen size={18} />
              </div>
              <span className="text-sm font-medium text-white/90">Lecture Library</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CameraModal({ onCapture, onClose }: { onCapture: (file: File) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' },
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Failed to access camera. Please check permissions.");
      }
    }
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "captured-image.jpg", { type: "image/jpeg" });
            onCapture(file);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
    >
      <div className="relative w-full max-w-lg bg-[#111] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
        >
          <X size={20} />
        </button>

        <div className="aspect-[3/4] relative bg-black overflow-hidden flex items-center justify-center">
          {error ? (
            <div className="p-8 text-center space-y-4">
              <WifiOff size={48} className="mx-auto text-white/20" />
              <p className="text-white/60 font-medium">{error}</p>
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-brand-primary text-dark-bg rounded-xl font-bold uppercase tracking-widest text-[10px]"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
                <button 
                  onClick={takePhoto}
                  className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center p-1 hover:scale-105 active:scale-95 transition-all"
                >
                  <div className="w-full h-full rounded-full bg-white" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-[#111] text-center">
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Capture Document or Note</p>
        </div>
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.8, 1.1, 0.8]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
          className="w-1 h-1 bg-brand-primary rounded-full shadow-[0_0_5px_rgba(204,255,0,0.5)]"
        />
      ))}
    </div>
  );
}

