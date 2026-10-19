import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { LectureContent, MOCK_LECTURES } from '../constants';
import { SavedAIContent } from '../types';
import { useChat } from './ChatContext';
import { useAuth } from './AuthContext';
import { generateAIBookmarkTitle } from './utils';
import { saveFile, getFile, deleteFile } from './fileStorage';
import { supabase } from '../supabaseClient';
import { 
  getLectures, 
  saveLecture, 
  deleteLecture, 
  getLectureFile, 
  saveLectureFile, 
  deleteLectureFile, 
  getLectureOverrides, 
  saveLectureOverride, 
  getRemovedLectures, 
  saveRemovedLecture, 
  getRecentCourses, 
  saveRecentCourse, 
  isRealUserSession 
} from './supabaseService';

export interface UnifiedLecture extends LectureContent {
  isFromAI?: boolean;
  aiData?: SavedAIContent;
}

export interface UploadTask {
  id: string;
  title: string;
  type: LectureContent['type'];
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  size: string;
}

interface ActivityEntry {
  courseName: string;
  lastActive: number;
}

interface LectureLibraryContextType {
  userLectures: LectureContent[];
  unifiedLectures: UnifiedLecture[];
  addLecture: (lecture: LectureContent, file?: File | Blob) => void;
  updateLecture: (id: string, updates: Partial<LectureContent>) => void;
  removeLecture: (id: string, permanent?: boolean) => void;
  restoreLecture: (id: string) => void;
  removedFromLibrary: string[];
  recentCourses: ActivityEntry[];
  trackActivity: (courseName: string) => void;
  uploadingFiles: UploadTask[];
  setUploadingFiles: React.Dispatch<React.SetStateAction<UploadTask[]>>;
}

const LectureLibraryContext = createContext<LectureLibraryContextType | undefined>(undefined);

const USER_LECTURES_KEY = 'studibl_user_lectures';
const LECTURE_OVERRIDES_KEY = 'studibl_lecture_overrides';
const REMOVED_LECTURES_KEY = 'studibl_removed_lectures';
const RECENT_COURSES_KEY = 'studibl_recent_courses';

export function LectureLibraryProvider({ children }: { children: ReactNode }) {
  const { savedItems } = useChat();
  const { user } = useAuth() || {};
  
  const [userLectures, setUserLectures] = useState<LectureContent[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(USER_LECTURES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading user lectures:", e);
        return [];
      }
    }
    return [];
  });

  // Track dynamic session-specific Object URLs for user-uploaded raw binary files
  const [sessionUrls, setSessionUrls] = useState<Record<string, string>>({});

  // Track file upload tasks globally (so uploads continue seamlessly in the background)
  const [uploadingFiles, setUploadingFiles] = useState<UploadTask[]>([]);

  const [lectureOverrides, setLectureOverrides] = useState<Record<string, Partial<LectureContent>>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem(LECTURE_OVERRIDES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading lecture overrides:", e);
        return {};
      }
    }
    return {};
  });

  const [removedFromLibrary, setRemovedFromLibrary] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(REMOVED_LECTURES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading removed IDs:", e);
        return [];
      }
    }
    return [];
  });

  const [recentCourses, setRecentCourses] = useState<ActivityEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(RECENT_COURSES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading recent courses:", e);
        return [];
      }
    }
    return [];
  });

  // Track whether library data has been loaded from Supabase to prevent initial race-condition sync
  const isLoadedRef = useRef(false);

  // Pull library data from Supabase on mount or authentication change
  useEffect(() => {
    if (user && isRealUserSession(user.id)) {
      isLoadedRef.current = false;
      const loadLibraryData = async () => {
        try {
          const dbLectures = await getLectures(user.id);
          if (dbLectures && dbLectures.length > 0) {
            setUserLectures(dbLectures.map((l: any) => ({
              id: l.id,
              type: l.type,
              title: l.title,
              course: l.course,
              date: l.date,
              duration: l.duration,
              size: l.size,
              thumbnail: l.thumbnail,
              url: l.url,
              video_url: l.video_url,
              isMine: l.is_mine,
              fillInTheBlanks: l.fill_in_the_blanks,
              extractedYoutubeMetadata: l.extracted_youtube_metadata,
              channel: l.channel,
              aiContextAnalysis: l.ai_context_analysis,
              aiInsights: l.ai_insights
            })));
          } else {
            setUserLectures([]);
          }

          const dbOverrides = await getLectureOverrides(user.id);
          if (dbOverrides && dbOverrides.length > 0) {
            const parsedOverrides: any = {};
            dbOverrides.forEach((row: any) => {
              parsedOverrides[row.lecture_id] = row.updates;
            });
            setLectureOverrides(parsedOverrides);
          } else {
            setLectureOverrides({});
          }

          const dbRemoved = await getRemovedLectures(user.id);
          if (dbRemoved) {
            setRemovedFromLibrary(dbRemoved);
          } else {
            setRemovedFromLibrary([]);
          }

          const dbRecent = await getRecentCourses(user.id);
          if (dbRecent && dbRecent.length > 0) {
            setRecentCourses(dbRecent.map((r: any) => ({
              courseName: r.course_name,
              lastActive: r.last_active
            })));
          } else {
            setRecentCourses([]);
          }
        } catch (e) {
          console.error("Error loading library data from Supabase:", e);
        } finally {
          isLoadedRef.current = true;
        }
      };
      loadLibraryData();
    } else {
      isLoadedRef.current = true;
    }
  }, [user]);

  // Synchronize local states to Supabase on change (only after initial load has finished)
  useEffect(() => {
    localStorage.setItem(USER_LECTURES_KEY, JSON.stringify(userLectures));
    
    if (user && isRealUserSession(user.id) && isLoadedRef.current) {
      const syncLectures = async () => {
        try {
          for (const l of userLectures) {
            // Only sync user-owned uploaded lectures, never static mock demo lectures
            if (l.isMine && l.id !== '1' && l.id !== '2' && l.id !== '3' && l.id !== '4') {
              await saveLecture(user.id, l);
            }
          }
        } catch (e) {
          console.error("Error sync lectures to Supabase:", e);
        }
      };
      syncLectures();
    }
  }, [userLectures, user]);

  useEffect(() => {
    localStorage.setItem(LECTURE_OVERRIDES_KEY, JSON.stringify(lectureOverrides));

    if (user && isRealUserSession(user.id) && isLoadedRef.current) {
      const syncOverrides = async () => {
        try {
          for (const [lectureId, updates] of Object.entries(lectureOverrides)) {
            await saveLectureOverride(user.id, lectureId, updates);
          }
        } catch (e) {
          console.error("Error syncing lecture overrides:", e);
        }
      };
      syncOverrides();
    }
  }, [lectureOverrides, user]);

  useEffect(() => {
    localStorage.setItem(REMOVED_LECTURES_KEY, JSON.stringify(removedFromLibrary));

    if (user && isRealUserSession(user.id) && isLoadedRef.current) {
      const syncRemoved = async () => {
        try {
          for (const lectureId of removedFromLibrary) {
            await saveRemovedLecture(user.id, lectureId);
          }
        } catch (e) {
          console.error("Error syncing removed lectures list:", e);
        }
      };
      syncRemoved();
    }
  }, [removedFromLibrary, user]);

  useEffect(() => {
    localStorage.setItem(RECENT_COURSES_KEY, JSON.stringify(recentCourses));

    if (user && isRealUserSession(user.id)) {
      const syncRecent = async () => {
        try {
          for (const entry of recentCourses) {
            await saveRecentCourse(user.id, entry.courseName, entry.lastActive);
          }
        } catch (e) {
          console.error("Error syncing recent courses active index:", e);
        }
      };
      syncRecent();
    }
  }, [recentCourses, user]);

  // Generate serialized key from user lectures to ensure effect triggers cleanly without infinite dependency loops
  const userLectureIdsStr = useMemo(() => {
    return userLectures.map(l => l.id).join(',');
  }, [userLectures]);

  // Load binary items asynchronously from IndexedDB or Supabase on mount
  useEffect(() => {
    let active = true;
    
    const loadSessionUrls = async () => {
      const urls: Record<string, string> = { ...sessionUrls };
      let updated = false;

      for (const lecture of userLectures) {
        if (lecture.isMine && !(lecture as any).isFromAI) {
          if (!urls[lecture.id]) {
            try {
              // Priority 1: Check if lecture URL points to a private storage path
              if (lecture.url && !lecture.url.startsWith('http') && !lecture.url.startsWith('data:')) {
                try {
                  const { data: signRes, error: signErr } = await supabase.storage
                    .from('app-files')
                    .createSignedUrl(lecture.url, 60 * 60 * 24); // 24 hours validity
                  if (!signErr && signRes?.signedUrl) {
                    urls[lecture.id] = signRes.signedUrl;
                    updated = true;
                    continue;
                  }
                } catch (signErr) {
                  console.warn("Failed signing private lecture URL:", signErr);
                }
              }

              // Priority 2: Fallback to IndexedDB local file storage
              let blob = await getFile(lecture.id);
              
              if (!blob && user && isRealUserSession(user.id)) {
                const dbFile = await getLectureFile(user.id, lecture.id);
                if (dbFile?.file_base64) {
                  const binaryString = window.atob(dbFile.file_base64);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  blob = new Blob([bytes], { type: dbFile.mime_type || 'application/pdf' });
                  await saveFile(lecture.id, blob);
                }
              }

              if (blob && active) {
                urls[lecture.id] = URL.createObjectURL(blob);
                updated = true;
              }
            } catch (err) {
              console.warn(`Could not hydrate file URL for ${lecture.id}:`, err);
            }
          }
        }
      }

      if (updated && active) {
        setSessionUrls(urls);
      }
    };

    loadSessionUrls();

    return () => {
      active = false;
    };
  }, [userLectureIdsStr, user]);

  const trackActivity = React.useCallback((courseName: string) => {
    if (!courseName) return;
    setRecentCourses(prev => {
      const filtered = prev.filter(c => c.courseName !== courseName);
      return [{ courseName, lastActive: Date.now() }, ...filtered].slice(0, 10);
    });
  }, []);

  /**
   * Adds an uploaded lecture. Stores binary file directly to IndexedDB / Supabase.
   */
  const addLecture = React.useCallback(async (lecture: LectureContent, file?: File | Blob) => {
    let finalUrl = lecture.url;

    // Optimistically insert into user lectures state immediately so file appears in UI instantly
    setUserLectures(prev => {
      if (prev.some(l => l.id === lecture.id)) return prev;
      return [lecture, ...prev];
    });

    if (file && user && isRealUserSession(user.id)) {
      try {
        const fileName = (file as File).name || 'lecture-file';
        const filePath = `${user.id}/lectures/${lecture.id}/${fileName}`;

        // Upload to app-files private bucket
        const { error: uploadErr } = await supabase.storage
          .from('app-files')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadErr) {
          console.error("Error uploading lecture material to app-files bucket:", uploadErr);
        } else {
          finalUrl = filePath;
          // Generate a signed URL for immediate preview
          const { data: signedData } = await supabase.storage
            .from('app-files')
            .createSignedUrl(filePath, 60 * 60 * 24);
          if (signedData?.signedUrl) {
            setSessionUrls(prev => ({
              ...prev,
              [lecture.id]: signedData.signedUrl
            }));
          }
        }

        // Overwrite optimistic state with populated backend URLs and sync row
        const dbLecture = {
          ...lecture,
          url: finalUrl
        };

        setUserLectures(prev => 
          prev.map(l => l.id === lecture.id ? dbLecture : l)
        );

        await saveLecture(user.id, dbLecture);
      } catch (err) {
        console.error("Failed saving lecture file in Supabase Storage:", err);
      }
    } else if (file) {
      // Local IndexedDB fallback
      saveFile(lecture.id, file).then(() => {
        const localBlobUrl = URL.createObjectURL(file);
        setSessionUrls(prev => ({
          ...prev,
          [lecture.id]: localBlobUrl
        }));
        
        setUserLectures(prev => 
          prev.map(l => l.id === lecture.id ? { ...l, url: localBlobUrl } : l)
        );
      }).catch(err => {
        console.error("IndexedDB write failed for lecture:", lecture.id, err);
      });
    }
  }, [user]);

  const updateLecture = React.useCallback((id: string, updates: Partial<LectureContent>) => {
    setLectureOverrides(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...updates }
    }));
  }, []);

  /**
   * Deletes a lecture. Purges from IndexedDB, Supabase Storage, and Supabase tables.
   */
  const removeLecture = React.useCallback(async (id: string, permanent: boolean = false) => {
    if (permanent) {
      deleteFile(id).catch(err => console.warn(`Purge file failed for ID ${id}:`, err));
      
      const targetLecture = userLectures.find(l => l.id === id);
      if (targetLecture && targetLecture.url && !targetLecture.url.startsWith('http') && !targetLecture.url.startsWith('data:')) {
        if (user && isRealUserSession(user.id)) {
          try {
            await supabase.storage.from('app-files').remove([targetLecture.url]);
          } catch (delErr) {
            console.error("Error removing lecture file from storage bucket:", delErr);
          }
        }
      }

      if (user && isRealUserSession(user.id)) {
        deleteLectureFile(user.id, id).catch(e => console.warn(e));
        deleteLecture(user.id, id).catch(e => console.warn(e));
      }

      setSessionUrls(prev => {
        const next = { ...prev };
        if (next[id]) {
          try {
            URL.revokeObjectURL(next[id]);
          } catch (e) {}
          delete next[id];
        }
        return next;
      });

      setUserLectures(prev => prev.filter(l => l.id !== id));
      setRemovedFromLibrary(prev => prev.filter(rid => rid !== id));
      setLectureOverrides(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setRemovedFromLibrary(prev => [...new Set([...prev, id])]);
    }
  }, [user, userLectures]);

  const restoreLecture = React.useCallback((id: string) => {
    setRemovedFromLibrary(prev => prev.filter(rid => rid !== id));
  }, []);

  const unifiedLectures = useMemo(() => {
    // 1. Build the core set from Mock + User Uploads
    // Use a Map for O(n) deduplication by ID
    const lectureMap = new Map<string, UnifiedLecture>();
    
    // Check if we are running in a real authenticated user context
    const isRealUser = user && isRealUserSession(user.id);

    // Only add MOCK items first if the user is a guest/sandbox user to keep the authenticated profile pristine
    if (!isRealUser) {
      MOCK_LECTURES.forEach(l => lectureMap.set(l.id, { ...l, ...lectureOverrides[l.id] }));
    }
    
    // Add/Overwrite with User items (user items with same ID take precedence if any)
    userLectures.forEach(l => {
      // Merge in dynamic session-specific Object URLs if they exist in state
      const resolvedUrl = sessionUrls[l.id] || l.url;
      lectureMap.set(l.id, { ...l, url: resolvedUrl, ...lectureOverrides[l.id] });
    });

    // 2. Add AI Saved Items
    savedItems.forEach(item => {
      // AI items have their own ID, map them to UnifiedLecture
      const baseAI: UnifiedLecture = {
        id: item.id,
        type: 'explanation' as const,
        title: generateAIBookmarkTitle(item),
        course: 'AI',
        date: new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        size: 'AI Logic',
        isMine: true,
        isFromAI: true,
        aiData: item
      };
      
      lectureMap.set(item.id, { ...baseAI, ...lectureOverrides[item.id] });
    });

    // 3. Return as array
    return Array.from(lectureMap.values());
  }, [userLectures, savedItems, lectureOverrides, sessionUrls]);

  return (
    <LectureLibraryContext.Provider value={{
      userLectures,
      unifiedLectures,
      addLecture,
      updateLecture,
      removeLecture,
      restoreLecture,
      removedFromLibrary,
      recentCourses,
      trackActivity,
      uploadingFiles,
      setUploadingFiles
    }}>
      {children}
    </LectureLibraryContext.Provider>
  );
}

export function useLectureLibrary() {
  const context = useContext(LectureLibraryContext);
  if (context === undefined) {
    throw new Error('useLectureLibrary must be used within a LectureLibraryProvider');
  }
  return context;
}
