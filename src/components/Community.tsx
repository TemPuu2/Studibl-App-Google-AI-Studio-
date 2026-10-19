import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Users, 
  MessageSquare, 
  Heart, 
  Share2, 
  Search, 
  TrendingUp, 
  Filter, 
  Plus, 
  Send, 
  MoreHorizontal, 
  Check, 
  CheckCheck, 
  Circle, 
  Rss, 
  MessageCircle, 
  X, 
  UserPlus, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Reply, 
  ArrowLeft, 
  Edit2, 
  Image as ImageIcon, 
  Tag, 
  Bold, 
  Italic, 
  Type, 
  Link as LinkIcon, 
  AtSign, 
  Pencil, 
  List,
  Loader2,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { supabase } from '../supabaseClient';
import UserProfileBottomSheet from './UserProfileBottomSheet';
import ChatInterface from './ChatInterface';
import UserAvatar, { getOptimisticAvatar } from './UserAvatar';
import { 
  CommunityFeedSkeleton, 
  CommunityGroupsSkeleton, 
  CommunityChatsSkeleton, 
  CommunityProfileSkeleton, 
  CommunityCommentsSkeleton 
} from './Skeletons';
import * as communityService from '../services/communityService';
import { 
  CommunityPost, 
  CommentItem as Comment, 
  StudyGroup, 
  CommunityChat as Chat, 
  Author 
} from '../services/communityService';
import { compressImage } from '../lib/imageUtils';

/**
 * Cached in-memory reference to community authors for mention suggestions and highlighted text
 */
let cachedCommunityUsers: Author[] = [];

export function getCachedCommunityUsers(): Author[] {
  return cachedCommunityUsers;
}

export function setCachedCommunityUsers(users: Author[]) {
  cachedCommunityUsers = users;
}

/**
 * Props for the MentionInput component
 */
interface MentionInputProps {
  value: string;
  onChange: (e: any) => void;
  onKeyDown: (e: any) => void;
  placeholder: string;
  autoFocus?: boolean;
  className?: string;
  rows?: number;
  padding?: string;
}

/**
 * Specialized text input component that supports @mentions, #hashtags, and auto-growing height
 */
const MentionInput = ({ 
  value, 
  onChange, 
  onKeyDown, 
  placeholder, 
  autoFocus = false,
  className,
  rows = 1,
  padding = "p-0"
}: MentionInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and highlighted ghost overlay
  const handleScroll = () => {
    if (textareaRef.current && ghostRef.current) {
      ghostRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Auto-resize logic based on scrollHeight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const highlightContent = (text: string) => {
    if (!text) return '\u00A0';
    
    const parts = text.split(/(@\w+|#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-brand-primary font-bold">{part}</span>;
      }
      if (part.startsWith('#')) {
        return <span key={i} className="text-brand-primary font-bold">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Visual ghost layer with colored mentions */}
      <div 
        ref={ghostRef}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 pointer-events-none whitespace-pre-wrap break-words z-0 text-transparent select-none overflow-hidden",
          className,
          padding
        )}
      >
        {highlightContent(value)}
      </div>

      {/* Interactive textarea layer */}
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "relative z-10 w-full bg-transparent resize-none outline-none overflow-y-auto max-h-[160px] scrollbar-hide text-white placeholder:text-white/20",
          className,
          padding
        )}
      />
    </div>
  );
};

/**
 * Community Screen Component
 * Synchronizes posts, comments, likes, groups, direct chats, and connections
 * with the real authenticated backend database, eliminating mock sources.
 */
export default function Community({ setNavVisibility, onAddNotification }: { 
  setNavVisibility?: (visible: boolean) => void;
  onAddNotification?: (n: any) => void;
}) {
  const { user } = useAuth();
  
  // Real authenticated user information from Supabase profiles
  const [profileData, setProfileData] = useState<{
    bio?: string;
    avatar?: string;
    banner?: string;
    name?: string;
    role?: string;
    academicLevel?: string;
    department?: string;
  }>({});

  // Group creation modal state
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupTag, setNewGroupTag] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Sync profile details directly from Supabase profiles table
  const loadSupabaseUserProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        let resolvedAvatar = profile.avatar_url;
        // Resolve Supabase storage file path to signed URL if needed
        if (resolvedAvatar && !resolvedAvatar.startsWith('http') && !resolvedAvatar.startsWith('data:') && !resolvedAvatar.startsWith('blob:')) {
          try {
            const { data } = await supabase.storage.from('app-files').createSignedUrl(resolvedAvatar, 60 * 60 * 24 * 7);
            if (data?.signedUrl) {
              resolvedAvatar = data.signedUrl;
              localStorage.setItem(`studibl_avatar_cache_${user.id}`, resolvedAvatar);
            }
          } catch (e) {
            console.warn('[Community] Avatar signing error:', e);
          }
        } else if (resolvedAvatar) {
          localStorage.setItem(`studibl_avatar_cache_${user.id}`, resolvedAvatar);
        }

        setProfileData({
          bio: profile.bio || profile.about,
          avatar: resolvedAvatar,
          banner: profile.banner_url,
          name: profile.full_name,
          role: profile.major,
          academicLevel: profile.academic_level,
          department: profile.department
        });
      }
    } catch (err) {
      console.warn('[Community] Error loading profile from Supabase:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSupabaseUserProfile();
  }, [loadSupabaseUserProfile]);

  const cachedAvatar = user?.id ? localStorage.getItem(`studibl_avatar_cache_${user.id}`) : null;
  const currentUserName = profileData.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Scholarly Student';
  const currentUserAvatar = profileData.avatar || cachedAvatar || user?.user_metadata?.avatar_url || '';
  const currentUserId = user?.id || 'sandbox-guest-id';
  const currentUserBio = profileData.bio !== undefined ? profileData.bio : (user?.user_metadata?.bio || 'Dedicated scholar collaborating on Studibl.');
  const currentUserBanner = profileData.banner || user?.user_metadata?.banner_url || '';
  const currentUserDepartment = profileData.department || user?.user_metadata?.department || user?.user_metadata?.faculty || profileData.role || user?.user_metadata?.major || '';
  const currentUserRole = profileData.role || user?.user_metadata?.major || user?.user_metadata?.faculty || currentUserDepartment || 'Student';

  const currentUser = useMemo(() => ({
    id: currentUserId,
    name: currentUserName,
    avatar: currentUserAvatar,
    role: currentUserRole,
    bio: currentUserBio,
    banner: currentUserBanner,
    academicLevel: profileData.academicLevel || 'Academic Scholar',
    department: currentUserDepartment
  }), [currentUserId, currentUserName, currentUserAvatar, currentUserRole, currentUserBio, currentUserBanner, currentUserDepartment, profileData]);

  // Primary navigation and tab states
  const [activeTab, setActiveTab] = useState<'feeds' | 'chats' | 'groups'>('feeds');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [groupFilter, setGroupFilter] = useState<string>('Discovery');
  
  // Core data states loaded from real backend
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [communityUsers, setCommunityUsers] = useState<Author[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Set<string>>(new Set());
  const [connectionStates, setConnectionStates] = useState<Record<string, boolean>>({});
  const [connectionCounts, setConnectionCounts] = useState<Record<string, number>>({});
  const [myConnectionCount, setMyConnectionCount] = useState<number>(0);
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});

  // Loading and feedback states
  const [loading, setLoading] = useState<boolean>(true);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isFabVisible, setIsFabVisible] = useState(true);

  // Overlay and modal states
  const [viewedPost, setViewedPost] = useState<CommunityPost | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Author | null>(null);
  const [fullProfile, setFullProfile] = useState<Author | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isSearchingChats, setIsSearchingChats] = useState(false);

  // Comment management states
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null);
  const [viewingReplies, setViewingReplies] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'top' | 'new'>('top');
  const [activeCommentMenuId, setActiveCommentMenuId] = useState<string | null>(null);
  const [activePostMenuId, setActivePostMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [editCommentText, setEditCommentText] = useState('');
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  // Mentions autocomplete logic
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<Author[]>([]);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [mentionContext, setMentionContext] = useState<'comment' | 'reply' | null>(null);

  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Loads all core community resources from backend endpoints
   */
  const loadCommunityData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedPosts, fetchedGroups, fetchedChats, fetchedConnsData, fetchedUsers] = await Promise.all([
        communityService.fetchCommunityPosts(selectedTag),
        communityService.fetchStudyGroups(),
        communityService.fetchCommunityChats(),
        communityService.fetchConnectionsFull(),
        communityService.fetchCommunityUsers()
      ]);

      setPosts(fetchedPosts);
      setGroups(fetchedGroups);
      
      const joinedSet = new Set<string>();
      fetchedGroups.forEach(g => {
        if (g.isJoined) joinedSet.add(g.id);
      });
      setJoinedGroups(joinedSet);
      
      setChats(fetchedChats);
      setConnectionStates(fetchedConnsData.connections);
      setConnectionCounts(fetchedConnsData.connectionCounts);
      setMyConnectionCount(fetchedConnsData.myCount);
      setCommunityUsers(fetchedUsers);
      setCachedCommunityUsers(fetchedUsers);
    } catch (err) {
      console.error('[Community] Error loading community feeds:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTag]);

  /**
   * Fetches real comments for the actively viewed post
   */
  const loadPostComments = useCallback(async (postId: string, sort: 'top' | 'new' = 'top') => {
    try {
      setCommentsLoading(true);
      const comments = await communityService.fetchPostComments(postId, sort);
      setPostComments(prev => ({
        ...prev,
        [postId]: comments
      }));
    } catch (err) {
      console.error('[Community] Error loading comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  // Initial load and reload on auth or tag filter changes
  useEffect(() => {
    loadCommunityData();
  }, [loadCommunityData, user]);

  /**
   * Set up real-time subscriptions for posts, comments, connections, and direct messages
   * to guarantee instant UI synchronization without requiring manual reloads
   */
  useEffect(() => {
    const communityChannel = supabase
      .channel('community-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => {
          loadCommunityData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_connections' },
        () => {
          communityService.fetchConnectionsFull().then(connsData => {
            setConnectionStates(connsData.connections);
            setConnectionCounts(connsData.connectionCounts);
            setMyConnectionCount(connsData.myCount);
          }).catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_comments' },
        (payload) => {
          const newComment = payload.new as any;
          if (newComment && newComment.post_id) {
            loadPostComments(newComment.post_id, sortOrder);
            setPosts(prev => prev.map(p => p.id === newComment.post_id ? { ...p, comments: p.comments + 1 } : p));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(communityChannel);
    };
  }, [loadCommunityData, loadPostComments, sortOrder]);

  // Sync comments whenever active viewed post changes
  useEffect(() => {
    if (viewedPost?.id) {
      loadPostComments(viewedPost.id, sortOrder);
    }
  }, [viewedPost?.id, sortOrder, loadPostComments]);

  // Auto-dismiss success notifications
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Global dismiss click handler for dropdown menus
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activePostMenuId && !target.closest('.post-menu-container')) {
        setActivePostMenuId(null);
      }
      if (activeCommentMenuId && !target.closest('.comment-menu-container')) {
        setActiveCommentMenuId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activePostMenuId, activeCommentMenuId]);

  // Handle scroll to toggle nav visibility cleanly
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!setNavVisibility) return;
    const currentScrollY = e.currentTarget.scrollTop;
    if (Math.abs(currentScrollY - lastScrollY.current) < 5) return;

    if (currentScrollY < lastScrollY.current || currentScrollY < 50) {
      setNavVisibility(true);
      setIsFabVisible(true);
    } else {
      setNavVisibility(false);
      setIsFabVisible(false);
    }
    lastScrollY.current = currentScrollY;
  };

  useEffect(() => {
    return () => {
      setNavVisibility?.(true);
    };
  }, [setNavVisibility]);

  /**
   * Toggles like state on a post with optimistic UI and real backend persistence
   */
  const toggleLike = async (postId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Optimistic toggle
    setPosts(current => current.map(p => {
      if (p.id === postId) {
        const nextLiked = !p.isLiked;
        return { 
          ...p, 
          isLiked: nextLiked, 
          likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1) 
        };
      }
      return p;
    }));

    if (viewedPost?.id === postId) {
      setViewedPost(prev => {
        if (!prev) return null;
        const nextLiked = !prev.isLiked;
        return {
          ...prev,
          isLiked: nextLiked,
          likes: nextLiked ? prev.likes + 1 : Math.max(0, prev.likes - 1)
        };
      });
    }

    try {
      const result = await communityService.togglePostLike(postId);
      setPosts(current => current.map(p => p.id === postId ? { ...p, isLiked: result.isLiked, likes: result.likes } : p));
      if (viewedPost?.id === postId) {
        setViewedPost(prev => prev ? { ...prev, isLiked: result.isLiked, likes: result.likes } : null);
      }
    } catch (err) {
      console.error('[Community] Like toggle error:', err);
    }
  };

  /**
   * Toggles like on a top-level comment or nested reply
   */
  const toggleCommentLike = async (commentId: string, isReply = false, parentId?: string) => {
    if (!viewedPost) return;

    setPostComments(prev => {
      const currentComments = [...(prev[viewedPost.id] || [])];
      if (!isReply) {
        return {
          ...prev,
          [viewedPost.id]: currentComments.map(c => {
            if (c.id === commentId) {
              const nextLiked = !c.isLiked;
              return { 
                ...c, 
                isLiked: nextLiked, 
                likes: nextLiked ? c.likes + 1 : Math.max(0, c.likes - 1) 
              };
            }
            return c;
          })
        };
      } else {
        return {
          ...prev,
          [viewedPost.id]: currentComments.map(c => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: (Array.isArray(c.replies) ? c.replies : []).map(r => {
                  if (r.id === commentId) {
                    const nextLiked = !r.isLiked;
                    return { 
                      ...r, 
                      isLiked: nextLiked, 
                      likes: nextLiked ? r.likes + 1 : Math.max(0, r.likes - 1) 
                    };
                  }
                  return r;
                })
              };
            }
            return c;
          })
        };
      }
    });

    try {
      const res = await communityService.toggleCommentLike(commentId);
      setPostComments(prev => {
        const currentComments = [...(prev[viewedPost.id] || [])];
        if (!isReply) {
          return {
            ...prev,
            [viewedPost.id]: currentComments.map(c => c.id === commentId ? { ...c, isLiked: res.isLiked, likes: res.likes } : c)
          };
        } else {
          return {
            ...prev,
            [viewedPost.id]: currentComments.map(c => c.id === parentId ? {
              ...c,
              replies: (Array.isArray(c.replies) ? c.replies : []).map(r => r.id === commentId ? { ...r, isLiked: res.isLiked, likes: res.likes } : r)
            } : c)
          };
        }
      });
    } catch (err) {
      console.error('[Community] Comment like toggle error:', err);
    }
  };

  /**
   * Toggles visibility of nested replies for a comment
   */
  const toggleReplyVisibility = (commentId: string) => {
    setViewingReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  /**
   * Submits a new comment or reply and persists to backend
   */
  const handleSendComment = async (text: string, commentId?: string) => {
    if (!text.trim() || !viewedPost) return;
    const postId = viewedPost.id;
    const commentBody = text.trim();
    
    setCommentText('');
    setShowMentions(false);

    try {
      const createdComment = await communityService.addPostComment(postId, commentBody, commentId);

      // Check for user mentions to trigger client notifications
      communityUsers.forEach(u => {
        if (commentBody.includes(`@${u.name}`) && u.name !== currentUser.name) {
          onAddNotification?.({
            title: 'You were mentioned',
            message: `${currentUser.name} mentioned you in a discussion.`,
            type: 'info'
          });
        }
      });

      if (commentId) {
        setPostComments(prev => ({
          ...prev,
          [postId]: (Array.isArray(prev[postId]) ? prev[postId] : []).map(c => {
            if (c.id === commentId) {
              return {
                ...c,
                replies: [...(Array.isArray(c.replies) ? c.replies : []), createdComment]
              };
            }
            return c;
          })
        }));
        setReplyingTo(null);
        setViewingReplies(prev => new Set(prev).add(commentId));
      } else {
        setPostComments(prev => ({
          ...prev,
          [postId]: [createdComment, ...(Array.isArray(prev[postId]) ? prev[postId] : [])]
        }));
      }

      // Increment comment count on local views
      setPosts(current => current.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
      setViewedPost(prev => prev ? { ...prev, comments: prev.comments + 1 } : null);
    } catch (err) {
      console.error('[Community] Error publishing comment:', err);
      setSuccessToast('Failed to post comment. Please try again.');
    }
  };

  /**
   * Deletes a comment or reply (authorized for author or post owner)
   */
  const deleteComment = async (commentId: string, isReply = false, parentId?: string) => {
    if (!viewedPost) return;
    const postId = viewedPost.id;

    let commentsRemoved = 0;
    const currentPostComments = Array.isArray(postComments[postId]) ? postComments[postId] : [];

    if (!isReply) {
      const commentToDelete = currentPostComments.find(c => c.id === commentId);
      if (commentToDelete) {
        commentsRemoved = 1 + (commentToDelete.replies?.length || 0);
      }
    } else {
      commentsRemoved = 1;
    }

    setPostComments(prev => {
      const currentCommentsForPost = Array.isArray(prev[postId]) ? [...prev[postId]] : [];
      if (!isReply) {
        return {
          ...prev,
          [postId]: currentCommentsForPost.filter(c => c.id !== commentId)
        };
      } else {
        return {
          ...prev,
          [postId]: currentCommentsForPost.map(c => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: (Array.isArray(c.replies) ? c.replies : []).filter(r => r.id !== commentId)
              };
            }
            return c;
          })
        };
      }
    });

    setPosts(current => current.map(p => 
      p.id === postId ? { ...p, comments: Math.max(0, p.comments - commentsRemoved) } : p
    ));
    setViewedPost(prev => prev ? { ...prev, comments: Math.max(0, prev.comments - commentsRemoved) } : null);
    setActiveCommentMenuId(null);

    try {
      await communityService.deletePostComment(commentId);
    } catch (err) {
      console.error('[Community] Error deleting comment:', err);
    }
  };

  const startEditingPost = (post: CommunityPost) => {
    setEditingPostId(post.id);
    setEditPostText(post.content);
    setActivePostMenuId(null);
  };

  /**
   * Saves edits to an existing post
   */
  const handleSavePostEdit = async () => {
    if (!editingPostId || !editPostText.trim()) return;
    const targetId = editingPostId;
    const updatedContent = editPostText.trim();
    
    setPosts(current => current.map(p => 
      p.id === targetId ? { ...p, content: updatedContent } : p
    ));
    if (viewedPost?.id === targetId) {
      setViewedPost(prev => prev ? { ...prev, content: updatedContent } : null);
    }
    
    setEditingPostId(null);
    setEditPostText('');

    try {
      await communityService.updateCommunityPost(targetId, { content: updatedContent });
      setSuccessToast('Post updated successfully');
    } catch (err) {
      console.error('[Community] Error updating post:', err);
      setSuccessToast('Failed to update post.');
    }
  };

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
    setActiveCommentMenuId(null);
  };

  /**
   * Saves edits to a comment or reply
   */
  const handleSaveCommentEdit = async (commentId: string, isReply = false, parentId?: string) => {
    if (!editCommentText.trim() || !viewedPost) return;
    const updatedText = editCommentText.trim();
    const postId = viewedPost.id;

    setPostComments(prev => {
      const currentComments = Array.isArray(prev[postId]) ? [...prev[postId]] : [];
      if (!isReply) {
        return {
          ...prev,
          [postId]: currentComments.map(c => 
            c.id === commentId ? { ...c, content: updatedText } : c
          )
        };
      } else {
        return {
          ...prev,
          [postId]: currentComments.map(c => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: (Array.isArray(c.replies) ? c.replies : []).map(r => 
                  r.id === commentId ? { ...r, content: updatedText } : r
                )
              };
            }
            return c;
          })
        };
      }
    });

    setEditingCommentId(null);
    setEditCommentText('');

    try {
      await communityService.editPostComment(commentId, updatedText);
    } catch (err) {
      console.error('[Community] Error updating comment:', err);
    }
  };

  /**
   * Deletes a post owned by the authenticated user
   */
  const deletePost = async (postId: string) => {
    setPosts(current => current.filter(p => p.id !== postId));
    if (viewedPost?.id === postId) {
      setViewedPost(null);
    }
    setActivePostMenuId(null);

    try {
      await communityService.deleteCommunityPost(postId);
      setSuccessToast('Post deleted successfully');
    } catch (err) {
      console.error('[Community] Error deleting post:', err);
    }
  };

  /**
   * Toggles joining or leaving an academic study group
   */
  const toggleJoinGroup = async (groupId: string) => {
    const isAlreadyJoined = joinedGroups.has(groupId);
    
    // Optimistic UI updates
    setJoinedGroups(prev => {
      const next = new Set(prev);
      if (isAlreadyJoined) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          isJoined: !isAlreadyJoined,
          members: isAlreadyJoined ? Math.max(0, g.members - 1) : g.members + 1
        };
      }
      return g;
    }));

    try {
      const result = await communityService.toggleJoinStudyGroup(groupId);
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, isJoined: result.isJoined, members: result.members } : g));
      if (result.isJoined) {
        onAddNotification?.({
          title: 'Joined Group!',
          message: 'Welcome to the study hub! Dive into collaborative discussions.',
          type: 'info'
        });
      } else {
        onAddNotification?.({
          title: 'Left Group',
          message: 'You are no longer a member of this hub.',
          type: 'info'
        });
      }
    } catch (err) {
      console.error('[Community] Group join toggle error:', err);
    }
  };

  /**
   * Persists bio update to Supabase
   */
  const handleUpdateBio = async (newBio: string) => {
    try {
      await communityService.updateCommunityUserProfile({ bio: newBio });
      if (user?.id) {
        await supabase.from('profiles').update({ bio: newBio }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { bio: newBio } }).catch(() => {});
      }
      setProfileData(prev => ({ ...prev, bio: newBio }));
      setSuccessToast('Bio updated successfully');
    } catch (err) {
      console.error('[Community] Failed to update bio:', err);
      setSuccessToast('Failed to save bio');
    }
  };

  /**
   * Persists profile picture update to Supabase
   */
  const handleUpdateAvatar = async (newAvatarUrl: string) => {
    try {
      await communityService.updateCommunityUserProfile({ avatar: newAvatarUrl });
      if (user?.id) {
        await supabase.from('profiles').update({ avatar_url: newAvatarUrl }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { avatar_url: newAvatarUrl } }).catch(() => {});
      }
      setProfileData(prev => ({ ...prev, avatar: newAvatarUrl }));
      setSuccessToast('Profile picture updated successfully');
    } catch (err) {
      console.error('[Community] Failed to update avatar:', err);
      setSuccessToast('Failed to save profile picture');
    }
  };

  /**
   * Persists profile banner update to Supabase
   */
  const handleUpdateBanner = async (newBannerUrl: string) => {
    try {
      await communityService.updateCommunityUserProfile({ banner: newBannerUrl });
      if (user?.id) {
        await supabase.from('profiles').update({ banner_url: newBannerUrl }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { banner_url: newBannerUrl } }).catch(() => {});
      }
      setProfileData(prev => ({ ...prev, banner: newBannerUrl }));
      setSuccessToast('Profile banner updated successfully');
    } catch (err) {
      console.error('[Community] Failed to update banner:', err);
      setSuccessToast('Failed to save banner');
    }
  };

  /**
   * Creates a new real study group in Supabase
   */
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setIsCreatingGroup(true);
      const created = await communityService.createStudyGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        tag: newGroupTag.trim() || 'General'
      });
      setGroups(prev => [created, ...prev]);
      setJoinedGroups(prev => new Set(prev).add(created.id));
      setShowGroupCreator(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupTag('');
      setSuccessToast(`Created group "${created.name}"`);
    } catch (err: any) {
      console.error('[Community] Failed to create group:', err);
      setSuccessToast(err.message || 'Failed to create study group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  /**
   * Initiates or navigates to a direct chat conversation with a peer
   */
  const openChatWithUser = async (targetUser: { name: string; avatar: string; role?: string; id?: string }) => {
    // Prevent self-chatting
    if (targetUser.name === currentUser.name || targetUser.id === currentUser.id) return;

    setActiveTab('chats');
    setSelectedProfile(null);
    setFullProfile(null);

    try {
      const activeOrNewChat = await communityService.openOrCreateChat(targetUser);
      setChats(prev => {
        const exists = prev.find(c => c.id === activeOrNewChat.id);
        if (exists) return prev;
        return [activeOrNewChat, ...prev];
      });
      setActiveChatId(activeOrNewChat.id);
    } catch (err) {
      console.error('[Community] Error opening direct chat:', err);
    }
  };

  /**
   * Toggles peer connection with target user
   */
  const toggleConnect = async (targetUser: any) => {
    if (!targetUser) return;
    // Prevent self-connection
    if (targetUser.name === currentUser.name || targetUser.id === currentUser.id) return;

    const targetName = targetUser.name;
    const targetId = targetUser.id;
    const isConnectedNow = !!connectionStates[targetName] || !!(targetId && connectionStates[targetId]);

    // Optimistic toggle
    setConnectionStates(prev => ({
      ...prev,
      [targetName]: !isConnectedNow,
      ...(targetId ? { [targetId]: !isConnectedNow } : {})
    }));
    setConnectionCounts(prev => ({
      ...prev,
      [targetName]: Math.max(0, (prev[targetName] || 0) + (!isConnectedNow ? 1 : -1)),
      ...(targetId ? { [targetId]: Math.max(0, (prev[targetId] || 0) + (!isConnectedNow ? 1 : -1)) } : {})
    }));
    setMyConnectionCount(prev => Math.max(0, prev + (!isConnectedNow ? 1 : -1)));

    try {
      const res = await communityService.togglePeerConnection(targetName, targetId);
      setConnectionStates(prev => ({
        ...prev,
        [targetName]: res.isConnected,
        ...(targetId ? { [targetId]: res.isConnected } : {})
      }));
      setConnectionCounts(prev => ({
        ...prev,
        [targetName]: res.connectionCount,
        ...(targetId ? { [targetId]: res.connectionCount } : {})
      }));
      if (typeof res.myCount === 'number') {
        setMyConnectionCount(res.myCount);
      }
      if (res.isConnected) {
        onAddNotification?.({
          title: 'Peer Connected!',
          message: `You are now connected with ${targetName}.`,
          type: 'info'
        });
      }
    } catch (err) {
      console.error('[Community] Connection toggle error:', err);
    }
  };

  const isConnected = (userNameOrId: string) => !!connectionStates[userNameOrId];
  const getConnectionCount = (userNameOrId: string) => {
    if (!userNameOrId) return 0;
    if (userNameOrId === currentUser.name || userNameOrId === currentUser.id) {
      return myConnectionCount;
    }
    return connectionCounts[userNameOrId] || 0;
  };

  const toggleExpand = (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleShare = (post: CommunityPost) => {
    if (navigator.share) {
      navigator.share({
        title: `Study Post by ${post.author.name}`,
        text: post.content,
        url: window.location.href,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      });
    } else {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
      }
      setSuccessToast(`Link copied to clipboard for post by ${post.author.name}!`);
    }
  };

  /**
   * Mentions autocomplete input handler
   */
  const handleInputChange = (text: string, context: 'comment' | 'reply') => {
    setCommentText(text);
    const lastAtPos = text.lastIndexOf('@');
    if (lastAtPos !== -1 && (lastAtPos === 0 || text[lastAtPos - 1] === ' ' || text[lastAtPos - 1] === '\n')) {
      const rest = text.slice(lastAtPos + 1);
      const query = rest.split(/[\s\n]/)[0];
      setMentionQuery(query);
      
      const filtered = communityUsers.filter(u => 
        u.name.toLowerCase().replace(/\s+/g, '').includes(query.toLowerCase())
      );
      
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
      setMentionContext(context);
      setActiveMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (userName: string) => {
    const lastAtPos = commentText.lastIndexOf('@');
    const beforeAt = commentText.slice(0, lastAtPos);
    const rest = commentText.slice(lastAtPos + 1);
    const firstWhitespace = rest.search(/[\s\n]/);
    
    if (firstWhitespace !== -1) {
      const afterQuery = rest.slice(firstWhitespace);
      setCommentText(`${beforeAt}@${userName} ${afterQuery.trimStart()}`);
    } else {
      setCommentText(`${beforeAt}@${userName} `);
    }
    setShowMentions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionSuggestions[activeMentionIndex].name);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (commentText.trim()) {
        handleSendComment(commentText, replyingTo?.commentId);
      }
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  // Filter groups according to active tag
  const displayedGroups = groups.filter(g => {
    if (groupFilter === 'Discovery') return true;
    if (groupFilter === 'My Groups') return joinedGroups.has(g.id);
    return g.tag.toLowerCase() === groupFilter.toLowerCase();
  });

  return (
    <div className="h-full flex flex-col bg-dark-bg overflow-hidden relative">
      <AnimatePresence mode="wait">
        {/* Full Profile View Modal */}
        {fullProfile && (
          <FullProfileView 
            user={fullProfile} 
            isCurrentUser={fullProfile.name === currentUser.name || fullProfile.id === currentUser.id}
            onBack={() => setFullProfile(null)}
            posts={posts}
            onPostClick={(post) => {
              setViewedPost(post);
              setFullProfile(null);
            }}
            onChat={() => {
              if (fullProfile) openChatWithUser(fullProfile);
            }}
            isConnected={isConnected(fullProfile.name)}
            onToggleConnect={toggleConnect}
            connectionCount={getConnectionCount(fullProfile.name)}
            currentUserName={currentUser.name}
            onDeletePost={deletePost}
            onToggleLike={toggleLike}
            onToggleMenu={(id) => setActivePostMenuId(activePostMenuId === id ? null : id)}
            activePostMenuId={activePostMenuId}
            onProfileClick={setSelectedProfile}
            onShare={handleShare}
            onEdit={startEditingPost}
            onToggleExpand={(id) => toggleExpand(id)}
            editingPostId={editingPostId}
            editPostText={editPostText}
            setEditPostText={setEditPostText}
            onSaveEdit={handleSavePostEdit}
            onCancelEdit={() => setEditingPostId(null)}
            onUpdateBio={handleUpdateBio}
            onUpdateAvatar={handleUpdateAvatar}
            onUpdateBanner={handleUpdateBanner}
          />
        )}

        {/* Real-Time Chat Conversation View */}
        <AnimatePresence>
          {activeChat && (
            <ChatInterface 
              chat={activeChat}
              currentUserId={currentUser.id}
              onBack={() => setActiveChatId(null)}
              onSendMessage={(_text) => {
                onAddNotification?.({
                  title: 'Message Sent',
                  message: `Your message was delivered to ${activeChat.user.name}.`,
                  type: 'info'
                });
              }}
            />
          )}
        </AnimatePresence>
      </AnimatePresence>

      {/* Post Discussion Detail View Overlay */}
      <AnimatePresence>
        {viewedPost && !fullProfile && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[60] bg-dark-bg flex flex-col pt-2"
          >
            <div className="flex-1 overflow-y-auto px-6 pb-10 scrollbar-hide">
              <div className="flex items-center justify-between py-6 mb-2">
                <button 
                  onClick={() => {
                    setViewedPost(null);
                    setActivePostMenuId(null);
                    setActiveCommentMenuId(null);
                  }}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                  title="Go back"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Post Discussion</h3>
                <div className="w-10" />
              </div>
              
              {/* Detailed Post Content Card */}
              <div className="glass-card border border-white/5 p-5 mb-6 relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div 
                      className="cursor-pointer active:scale-95 transition-transform"
                      onClick={() => setSelectedProfile(viewedPost.author)}
                    >
                      <img 
                        src={viewedPost.author.avatar} 
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/5" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div 
                      className="cursor-pointer"
                      onClick={() => setSelectedProfile(viewedPost.author)}
                    >
                      <h4 className="text-sm font-bold text-white hover:text-brand-primary transition-colors">{viewedPost.author.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-tight">{viewedPost.author.role}</p>
                        <span className="text-[10px] text-white/10">•</span>
                        <span className="text-[9px] font-medium text-white/20">{viewedPost.time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative post-menu-container">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePostMenuId(activePostMenuId === viewedPost.id ? null : viewedPost.id);
                      }}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    <AnimatePresence>
                      {activePostMenuId === viewedPost.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-full mt-2 w-32 bg-dark-bg border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20"
                        >
                          {(viewedPost.author.name === currentUser.name || viewedPost.author.id === currentUser.id) && (
                            <>
                              <button 
                                onClick={() => startEditingPost(viewedPost)}
                                className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-colors flex items-center gap-2"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button 
                                onClick={() => deletePost(viewedPost.id)}
                                className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                              >
                                <X size={12} /> Delete
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => {
                              setSuccessToast('Post reported. Thank you for keeping the community safe.');
                              setActivePostMenuId(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Info size={12} /> Report
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="text-sm text-white/80 leading-relaxed mb-4">
                  {editingPostId === viewedPost.id ? (
                    <div className="space-y-4">
                      <div className="bg-white/5 border border-white/10 rounded-2xl focus-within:border-brand-primary transition-all p-4">
                        <MentionInput 
                          value={editPostText}
                          onChange={(e) => setEditPostText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) handleSavePostEdit();
                          }}
                          placeholder="Edit your thoughts..."
                          className="text-white text-sm"
                          autoFocus
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => setEditingPostId(null)}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSavePostEdit}
                          className="px-5 py-2 rounded-xl bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <FormattedContent content={viewedPost.content} onProfileClick={setSelectedProfile} />
                  )}
                </div>

                {viewedPost.image && (
                  <div className="rounded-2xl overflow-hidden mb-4 border border-white/5 max-h-96">
                    <img src={viewedPost.image} className="w-full h-full object-cover" />
                  </div>
                )}

                {viewedPost.tags && viewedPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {viewedPost.tags.map((tag, tIdx) => (
                      <span key={`vtag-${tag}-${tIdx}`} className="text-[10px] font-black uppercase tracking-wider text-brand-primary/80 bg-brand-primary/5 px-2 py-0.5 rounded-md border border-brand-primary/10">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                  <button 
                    onClick={(e) => toggleLike(viewedPost.id, e)}
                    className={cn(
                      "flex items-center gap-2 transition-colors",
                      viewedPost.isLiked ? "text-red-400" : "text-white/30 hover:text-red-400"
                    )}
                  >
                    <Heart size={18} fill={viewedPost.isLiked ? "currentColor" : "none"} />
                    <span className="text-xs font-bold">{viewedPost.likes}</span>
                  </button>
                  <div className="flex items-center gap-2 text-brand-primary">
                    <MessageSquare size={18} />
                    <span className="text-xs font-bold">{viewedPost.comments}</span>
                  </div>
                  <button 
                    onClick={() => handleShare(viewedPost)}
                    className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors ml-auto active:scale-90"
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>

              {/* Comment Input Bar */}
              <div className="flex flex-col mb-8 p-1">
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                    <img src={currentUser.avatar} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex gap-3">
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl focus-within:border-brand-primary transition-all group relative">
                      {showMentions && mentionContext === 'comment' && (
                        <MentionDropdown 
                          suggestions={mentionSuggestions}
                          activeIndex={activeMentionIndex}
                          onSelect={selectMention}
                        />
                      )}
                      <MentionInput 
                        value={commentText}
                        onChange={(e) => handleInputChange(e.target.value, 'comment')}
                        onKeyDown={handleKeyDown}
                        placeholder={replyingTo ? `Replying to @${replyingTo.authorName}...` : "Add a comment..."}
                        className="text-white text-[12px] font-medium"
                        padding="px-4 py-3"
                        rows={1}
                      />
                    </div>
                    <button 
                      onClick={() => handleSendComment(commentText, replyingTo?.commentId)}
                      disabled={!commentText.trim()}
                      className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-dark-bg shadow-lg shadow-brand-primary/20 active:scale-95 transition-transform disabled:opacity-50 disabled:grayscale"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
                {replyingTo && (
                  <div className="flex items-center gap-2 mt-2 ml-14 text-xs text-white/40">
                    <span>Replying to <strong className="text-brand-primary">@{replyingTo.authorName}</strong></span>
                    <button onClick={() => setReplyingTo(null)} className="text-white/20 hover:text-white ml-2">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Enhanced Comment List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Comments</h4>
                  <div className="relative">
                    <button 
                      onClick={() => setSortOrder(prev => prev === 'top' ? 'new' : 'top')}
                      className="text-[10px] font-black uppercase tracking-widest text-brand-primary/60 flex items-center gap-1 hover:text-brand-primary transition-colors"
                    >
                      Sort by {sortOrder === 'top' ? 'Top' : 'New'} <ChevronDown size={12} className={cn("transition-transform", sortOrder === 'new' && "rotate-180")} />
                    </button>
                  </div>
                </div>

                {commentsLoading && (
                  <CommunityCommentsSkeleton />
                )}
                
                {!commentsLoading && (Array.isArray(postComments[viewedPost.id]) ? postComments[viewedPost.id] : []).length > 0 ? (
                  (Array.isArray(postComments[viewedPost.id]) ? postComments[viewedPost.id] : [])
                    .slice()
                    .sort((a, b) => {
                      if (sortOrder === 'top') return b.likes - a.likes;
                      return b.id.localeCompare(a.id);
                    })
                    .map((comment, i) => (
                      <div key={`comment-container-${comment.id}-${i}`} className="flex flex-col gap-2">
                        <div className="flex gap-4 group">
                          <div 
                            className="cursor-pointer active:scale-95 transition-transform h-fit flex-shrink-0"
                            onClick={() => setSelectedProfile({ name: comment.author.name, avatar: comment.author.avatar, role: 'Contributor' })}
                          >
                            <UserAvatar 
                              src={comment.author.avatar} 
                              name={comment.author.name}
                              className="w-9 h-9 rounded-full ring-1 ring-white/10" 
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span 
                                  className="text-xs font-bold text-white tracking-tight cursor-pointer hover:text-brand-primary transition-colors truncate"
                                  onClick={() => setSelectedProfile({ name: comment.author.name, avatar: comment.author.avatar, role: 'Contributor' })}
                                >
                                  {comment.author.name}
                                </span>
                                <span className="text-[10px] font-medium text-white/30 shrink-0">{comment.time}</span>
                              </div>
                              <div className="relative comment-menu-container">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCommentMenuId(activeCommentMenuId === comment.id ? null : comment.id);
                                  }}
                                  className="text-white/20 hover:text-white/60 transition-colors"
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                                <AnimatePresence>
                                  {activeCommentMenuId === comment.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                      className="absolute right-0 top-full mt-2 w-32 bg-dark-bg border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20"
                                    >
                                      {(comment.author.name === currentUser.name || comment.author.id === currentUser.id) && (
                                        <button 
                                          onClick={() => startEditingComment(comment)}
                                          className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-colors flex items-center gap-2"
                                        >
                                          <Edit2 size={12} /> Edit
                                        </button>
                                      )}
                                      {(viewedPost.author.name === currentUser.name || comment.author.name === currentUser.name || comment.author.id === currentUser.id) && (
                                        <button 
                                          onClick={() => deleteComment(comment.id)}
                                          className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                                        >
                                          <X size={12} /> Delete
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => {
                                          setSuccessToast('Comment reported. Thank you for keeping the community safe.');
                                          setActiveCommentMenuId(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-colors flex items-center gap-2"
                                      >
                                        <Info size={12} /> Report
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                            
                            <div className="bg-white/5 rounded-2xl rounded-tl-none p-3.5 border border-white/5 mb-2 overflow-hidden">
                              {editingCommentId === comment.id ? (
                                <div className="space-y-3">
                                  <div className="bg-white/5 border border-white/10 rounded-xl focus-within:border-brand-primary transition-all">
                                    <MentionInput 
                                      value={editCommentText}
                                      onChange={(e) => setEditCommentText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey) handleSaveCommentEdit(comment.id);
                                      }}
                                      placeholder="Edit your comment..."
                                      className="text-white text-xs"
                                      padding="px-3 py-2"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setEditingCommentId(null)}
                                      className="text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={() => handleSaveCommentEdit(comment.id)}
                                      className="text-[9px] font-black uppercase tracking-widest text-brand-primary hover:text-white transition-colors"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-white/70 leading-relaxed font-medium break-words">
                                  <FormattedContent content={comment.content} onProfileClick={setSelectedProfile} />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4 px-1">
                              <button 
                                onClick={() => toggleCommentLike(comment.id)}
                                className={cn(
                                  "flex items-center gap-1.5 transition-colors group/heart",
                                  comment.isLiked ? "text-red-400" : "text-white/30 hover:text-red-400"
                                )}
                              >
                                <Heart size={14} className={cn("transition-all", comment.isLiked ? "fill-red-400 scale-110" : "group-hover/heart:fill-red-400 group-hover/heart:scale-110")} />
                                <span className="text-[10px] font-bold">{comment.likes}</span>
                              </button>
                              <button 
                                onClick={() => {
                                  setReplyingTo({ commentId: comment.id, authorName: comment.author.name });
                                  setCommentText(`@${comment.author.name} `);
                                }}
                                className="flex items-center gap-1.5 text-white/30 hover:text-brand-primary transition-colors"
                              >
                                <Reply size={14} />
                                <span className="text-[10px] font-bold">Reply</span>
                              </button>
                            </div>

                            {/* Nested Replies Rendering */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="mt-3">
                                <button 
                                  onClick={() => toggleReplyVisibility(comment.id)}
                                  className="text-[10px] font-black uppercase tracking-widest text-brand-primary flex items-center gap-1.5 hover:underline mb-2"
                                >
                                  {viewingReplies.has(comment.id) ? (
                                    <>
                                      <ChevronUp size={12} /> Hide {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={12} /> View {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                    </>
                                  )}
                                </button>
                                
                                {viewingReplies.has(comment.id) && (
                                  <div className="space-y-3 pl-4 border-l-2 border-white/5 ml-2 mt-2">
                                    {comment.replies.map((reply, rIndex) => (
                                      <div key={`reply-${reply.id}-${rIndex}`} className="flex gap-3">
                                        <UserAvatar 
                                          src={reply.author.avatar} 
                                          name={reply.author.name}
                                          className="w-7 h-7 rounded-full ring-1 ring-white/10 shrink-0 cursor-pointer"
                                          onClick={() => setSelectedProfile({ name: reply.author.name, avatar: reply.author.avatar, role: 'Contributor' })}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-0.5">
                                            <div className="flex items-center gap-2">
                                              <span 
                                                className="text-[11px] font-bold text-white cursor-pointer hover:text-brand-primary"
                                                onClick={() => setSelectedProfile({ name: reply.author.name, avatar: reply.author.avatar, role: 'Contributor' })}
                                              >
                                                {reply.author.name}
                                              </span>
                                              <span className="text-[9px] text-white/30">{reply.time}</span>
                                            </div>
                                            {(reply.author.name === currentUser.name || reply.author.id === currentUser.id) && (
                                              <button 
                                                onClick={() => deleteComment(reply.id, true, comment.id)}
                                                className="text-white/20 hover:text-red-400 transition-colors"
                                                title="Delete reply"
                                              >
                                                <X size={12} />
                                              </button>
                                            )}
                                          </div>
                                          <div className="bg-white/5 rounded-xl p-2.5 text-xs text-white/70 mb-1.5">
                                            <FormattedContent content={reply.content} onProfileClick={setSelectedProfile} />
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <button 
                                              onClick={() => toggleCommentLike(reply.id, true, comment.id)}
                                              className={cn(
                                                "flex items-center gap-1 text-[9px] font-bold transition-colors",
                                                reply.isLiked ? "text-red-400" : "text-white/30 hover:text-red-400"
                                              )}
                                            >
                                              <Heart size={12} fill={reply.isLiked ? "currentColor" : "none"} />
                                              <span>{reply.likes}</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                ) : !commentsLoading && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-3">
                      <MessageSquare size={22} />
                    </div>
                    <p className="text-xs text-white/40 font-medium">No comments yet.</p>
                    <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">Be the first to share your academic thoughts!</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Bottom Sheet Modal */}
      <UserProfileBottomSheet 
        user={selectedProfile as any}
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        onChat={() => {
          if (selectedProfile) openChatWithUser(selectedProfile);
        }}
        onViewFullProfile={(u) => {
          setFullProfile(u as any);
          setSelectedProfile(null);
        }}
        isConnected={selectedProfile ? isConnected(selectedProfile.name) : false}
        onToggleConnect={toggleConnect}
        isSelf={selectedProfile ? (selectedProfile.name === currentUser.name || (selectedProfile as any).id === currentUser.id) : false}
      />

      {/* Primary Tab Switcher */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        <div className="flex bg-white/5 p-1 rounded-2xl mb-4 relative overflow-hidden">
          <motion.div 
            className="absolute top-1 bottom-1 bg-brand-primary rounded-xl z-0"
            animate={{ 
              left: activeTab === 'feeds' ? '4px' : activeTab === 'groups' ? 'calc(33.33% + 2px)' : 'calc(66.66%)',
              width: 'calc(33.33% - 4px)' 
            }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
          <button 
            onClick={() => {
              setActiveTab('feeds');
              setActivePostMenuId(null);
              setActiveCommentMenuId(null);
            }}
            className={cn(
              "flex-1 py-3 transition-colors relative z-10 flex justify-center items-center gap-2",
              activeTab === 'feeds' ? "text-dark-bg font-black" : "text-white/40"
            )}
          >
            <Rss size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Feeds</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('groups');
              setActivePostMenuId(null);
              setActiveCommentMenuId(null);
            }}
            className={cn(
              "flex-1 py-3 transition-colors relative z-10 flex justify-center items-center gap-2",
              activeTab === 'groups' ? "text-dark-bg font-black" : "text-white/40"
            )}
          >
            <Users size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Groups</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('chats');
              setActivePostMenuId(null);
              setActiveCommentMenuId(null);
            }}
            className={cn(
              "flex-1 py-3 transition-colors relative z-10 flex justify-center items-center gap-2",
              activeTab === 'chats' ? "text-dark-bg font-black" : "text-white/40"
            )}
          >
            <MessageCircle size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Chats</span>
          </button>
        </div>
      </div>

      {/* Content Area with Smooth Stable Tab Preservation (No Flicker) */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-20"
      >
        {/* Feeds Tab */}
        <div className={cn("space-y-6 pt-1", activeTab === 'feeds' ? "block" : "hidden")}>
          {loading && posts.length === 0 && (
            <CommunityFeedSkeleton />
          )}

          {!loading && posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 glass-card border-white/5 p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-2">
                <Rss size={32} />
              </div>
              <h3 className="text-sm font-bold text-white">No discussions yet</h3>
              <p className="text-xs text-white/40 leading-relaxed max-w-xs mx-auto">
                Publish a new discussion post or formula concept to start the academic peer feed.
              </p>
              <button
                onClick={() => setShowPostCreator(true)}
                className="px-6 py-3 bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_15px_rgba(204,255,0,0.2)]"
              >
                Create First Post
              </button>
            </div>
          ) : (
            posts.map((post, pIdx) => (
              <PostCard 
                key={`post-${post.id}-${pIdx}`}
                post={post}
                currentUserName={currentUser.name}
                onProfileClick={setSelectedProfile}
                onPostClick={setViewedPost}
                onToggleLike={toggleLike}
                onShare={handleShare}
                activePostMenuId={activePostMenuId}
                onToggleMenu={(id) => setActivePostMenuId(id)}
                onEdit={startEditingPost}
                onDelete={deletePost}
                editingPostId={editingPostId}
                editPostText={editPostText}
                setEditPostText={setEditPostText}
                onSaveEdit={handleSavePostEdit}
                onToggleExpand={() => toggleExpand(post.id)}
                onCancelEdit={() => setEditingPostId(null)}
                onReport={() => setSuccessToast('Post reported. Thank you for keeping the community safe.')}
              />
            ))
          )}

          {/* Floating Action Button */}
          <AnimatePresence>
            {isFabVisible && activeTab === 'feeds' && (
              <motion.button
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: 20 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowPostCreator(true)}
                className="fixed bottom-24 right-6 w-14 h-14 bg-brand-primary rounded-full flex items-center justify-center text-dark-bg shadow-[0_8px_30px_rgba(204,255,0,0.4)] z-40"
                aria-label="Create Post"
              >
                <Plus size={28} strokeWidth={3} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Groups Tab */}
        <div className={cn("space-y-6 pt-1", activeTab === 'groups' ? "block" : "hidden")}>
          <div className="flex items-center justify-between pb-1">
            <div className="flex gap-2">
              {(['All Groups', 'My Groups'] as const).map(filter => (
                <button 
                  key={filter} 
                  onClick={() => setGroupFilter(filter)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap",
                    groupFilter === filter 
                      ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary" 
                      : "border-white/5 bg-white/5 text-white/40 hover:text-white/80"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowGroupCreator(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary text-dark-bg font-black text-[10px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_15px_rgba(204,255,0,0.2)]"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Create Hub</span>
            </button>
          </div>

          {loading && groups.length === 0 ? (
            <CommunityGroupsSkeleton />
          ) : displayedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 glass-card border-white/5 p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-1">
                <Users size={28} />
              </div>
              <h3 className="text-sm font-bold text-white">No study groups found</h3>
              <p className="text-xs text-white/40 max-w-xs leading-relaxed mx-auto">
                {groupFilter === 'My Groups' 
                  ? "You haven't joined any study groups yet. Switch to All Groups or create your own hub!" 
                  : "No study groups created yet on the platform. Create the very first group hub!"}
              </p>
              <button
                onClick={() => setShowGroupCreator(true)}
                className="px-5 py-2.5 bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_15px_rgba(204,255,0,0.2)]"
              >
                Create Study Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {displayedGroups.map((group, gIdx) => (
                <div key={`group-${group.id}-${gIdx}`} className="glass-card overflow-hidden border-none p-0 group hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-500">
                  <div className="h-28 relative overflow-hidden">
                    <img src={group.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/20 to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-brand-primary text-dark-bg px-2 py-1 rounded shadow-lg">
                        {group.tag}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-white tracking-tight mb-1">{group.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-brand-primary font-black uppercase tracking-[0.1em]">
                          <Users size={12} strokeWidth={3} /> {group.members.toLocaleString()} Members
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleJoinGroup(group.id)}
                        className={cn(
                          "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                          joinedGroups.has(group.id) 
                            ? "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10" 
                            : "bg-brand-primary text-dark-bg shadow-[0_4px_20px_rgba(204,255,0,0.2)] hover:shadow-brand-primary/40 hover:brightness-110"
                        )}
                      >
                        {joinedGroups.has(group.id) ? 'Joined' : 'Join Group'}
                      </button>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed font-medium">{group.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chats Tab */}
        <div className={cn("space-y-3 pt-1", activeTab === 'chats' ? "block" : "hidden")}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Direct Messages</h3>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setIsSearchingChats(!isSearchingChats)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  isSearchingChats ? "bg-brand-primary text-dark-bg" : "bg-white/5 text-white/40 hover:text-white"
                )}
                title="Search chats or peers"
              >
                <Search size={14} />
              </button>
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="px-3 py-1.5 rounded-full bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-[0_2px_10px_rgba(204,255,0,0.2)]"
                title="Start a new chat"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* Optional Search Bar */}
          <AnimatePresence>
            {isSearchingChats && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pb-2"
              >
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input 
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Search conversations or classmates..."
                    className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-primary"
                    autoFocus
                  />
                  {chatSearchQuery && (
                    <button 
                      onClick={() => setChatSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Peer Bubbles Row */}
          <div className="flex gap-4 mb-6 overflow-x-auto scrollbar-hide pb-2">
            <div 
              onClick={() => setShowNewChatModal(true)}
              className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 group-hover:border-brand-primary/50 group-hover:text-brand-primary transition-all">
                <Plus size={24} />
              </div>
              <span className="text-[10px] font-bold text-white/40">New Chat</span>
            </div>

            {chats.map((chat, cIdx) => (
              <div 
                key={`recent-${chat.id}-${cIdx}`} 
                className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer"
                onClick={() => setActiveChatId(chat.id)}
              >
                <div className="relative">
                  <UserAvatar 
                    src={chat.user.avatar} 
                    name={chat.user.name}
                    className="w-14 h-14 rounded-full ring-2 ring-white/5 active:scale-95 transition-transform group-hover:ring-brand-primary/30" 
                  />
                  {chat.user.online && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-dark-bg rounded-full animate-pulse" />
                  )}
                  {chat.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-primary text-dark-bg border-2 border-dark-bg rounded-full flex items-center justify-center">
                      <span className="text-[8px] font-black">{chat.unread}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-white/40 group-hover:text-white transition-colors truncate max-w-[60px]">
                  {chat.user.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          {loading && chats.length === 0 ? (
            <CommunityChatsSkeleton />
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/10 mb-2">
                <MessageSquare size={32} />
              </div>
              <h3 className="text-sm font-bold text-white/60">No active conversations</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">
                Connect and exchange insights directly with registered classmates.
              </p>
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="px-5 py-2.5 rounded-xl bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_15px_rgba(204,255,0,0.2)]"
              >
                Start a Conversation
              </button>
            </div>
          ) : (
            chats
              .filter(chat => {
                if (!chatSearchQuery.trim()) return true;
                const q = chatSearchQuery.toLowerCase();
                return chat.user.name.toLowerCase().includes(q) || (chat.lastMessage && chat.lastMessage.toLowerCase().includes(q));
              })
              .map((chat, cIdx) => (
                <button 
                  key={`all-chats-${chat.id}-${cIdx}`}
                  onClick={() => setActiveChatId(chat.id)}
                  className="w-full text-left p-4 rounded-3xl bg-white/[0.02] hover:bg-white/5 active:scale-[0.98] transition-all border border-transparent hover:border-white/5 flex gap-4 group"
                >
                  <div 
                    className="relative shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProfile({ ...chat.user, role: chat.user.role || 'Student' });
                    }}
                  >
                    <UserAvatar 
                      src={chat.user.avatar} 
                      name={chat.user.name}
                      className="w-12 h-12 rounded-full ring-2 ring-white/5 group-hover:ring-brand-primary/30 transition-all" 
                    />
                    {chat.user.online && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-dark-bg rounded-full shadow-lg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-black text-white tracking-tight group-hover:text-brand-primary transition-colors truncate">
                        {chat.user.name}
                      </h4>
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{chat.time}</span>
                    </div>
                    <p className="text-xs text-white/40 font-medium truncate group-hover:text-white/60 transition-colors">
                      {chat.lastMessage}
                    </p>
                  </div>
                  {chat.unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-brand-primary text-dark-bg flex items-center justify-center self-center shrink-0 shadow-lg shadow-brand-primary/20">
                      <span className="text-[9px] font-black">{chat.unread}</span>
                    </div>
                  )}
                </button>
              ))
          )}
        </div>
      </div>

      {/* Start New Chat Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card border border-white/10 p-6 rounded-3xl w-full max-w-md bg-dark-bg shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">New Conversation</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Select a classmate to chat with</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto scrollbar-hide space-y-2 py-1">
                {communityUsers.filter(u => u.name !== currentUser.name && u.id !== currentUser.id).length === 0 ? (
                  <div className="py-8 text-center text-white/40 text-xs font-medium">
                    No other registered classmates found yet.
                  </div>
                ) : (
                  communityUsers
                    .filter(u => u.name !== currentUser.name && u.id !== currentUser.id)
                    .map((peer, idx) => (
                      <button
                        key={`new-chat-peer-${peer.id || peer.name}-${idx}`}
                        onClick={() => {
                          setShowNewChatModal(false);
                          openChatWithUser(peer);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/10 active:scale-[0.98] transition-all text-left group"
                      >
                        <UserAvatar 
                          src={peer.avatar} 
                          name={peer.name}
                          className="w-10 h-10 rounded-full ring-1 ring-white/10 group-hover:ring-brand-primary/40" 
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors truncate">
                            {peer.name}
                          </h4>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold truncate">
                            {peer.role || 'Student'}
                          </p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          Chat
                        </span>
                      </button>
                    ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Study Group Hub Modal */}
      <AnimatePresence>
        {showGroupCreator && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card border border-white/10 p-6 rounded-3xl w-full max-w-md bg-dark-bg shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Create Study Group</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Launch an academic collaborative hub</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGroupCreator(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Quantum Computing Lab"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">
                    Subject / Department
                  </label>
                  <input
                    type="text"
                    value={newGroupTag}
                    onChange={(e) => setNewGroupTag(e.target.value)}
                    placeholder="e.g. CS, Physics, Math, Biology"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">
                    Description *
                  </label>
                  <textarea
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Describe group research topics, meeting times, or collaboration goals..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary resize-none"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGroupCreator(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-xs font-bold text-white/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingGroup || !newGroupName.trim()}
                    className="px-5 py-2.5 rounded-xl bg-brand-primary text-dark-bg text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCreatingGroup ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create Hub
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            key="success-toast-message-pop"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-brand-primary text-dark-bg px-6 py-3 rounded-2xl shadow-[0_10px_30px_rgba(204,255,0,0.3)] flex items-center gap-3"
          >
            <div className="w-6 h-6 rounded-full bg-dark-bg/20 flex items-center justify-center">
              <Check size={14} strokeWidth={3} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{successToast}</span>
            <button onClick={() => setSuccessToast(null)} className="ml-2 py-1 px-2 hover:bg-dark-bg/10 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post Creator Modal */}
      <AnimatePresence>
        {showPostCreator && (
          <CreatePostModal 
            onClose={() => setShowPostCreator(false)}
            communityUsers={communityUsers}
            onSubmit={async (postData) => {
              try {
                const createdPost = await communityService.createCommunityPost({
                  content: postData.content,
                  tags: postData.tags,
                  images: postData.images || []
                });
                setPosts(prev => [createdPost, ...prev]);
                setShowPostCreator(false);
                setSuccessToast('Your thought is now live in the community.');
                onAddNotification?.({
                  title: 'Post Created!',
                  message: 'Your thought is now live in the community.',
                  type: 'success'
                });
              } catch (err: any) {
                console.error('[Community] Error publishing post:', err);
                setSuccessToast('Failed to publish post.');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Interface representing post creator submit payload
 */
interface CreatePostData {
  content: string;
  images?: string[];
  tags: string[];
}

/**
 * Modal component for composing and publishing academic discussion posts
 */
function CreatePostModal({ 
  onClose, 
  onSubmit, 
  communityUsers 
}: { 
  onClose: () => void; 
  onSubmit: (data: CreatePostData) => void;
  communityUsers: Author[];
}) {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Scholarly Student';
  const displayEmail = user?.email || 'student@mainframe.edu';
  const displayAvatar = user?.user_metadata?.avatar_url || '';

  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFormatting, setIsFormatting] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formattingMenuRef = useRef<HTMLDivElement>(null);
  const formattingToggleRef = useRef<HTMLButtonElement>(null);
  
  // Mentions logic
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<Author[]>([]);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  // Tags logic
  const [showTags, setShowTags] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [activeTagIndex, setActiveTagIndex] = useState(0);

  const availableTags = ['General', 'Engineering', 'CS', 'Physics', 'Math', 'HelpNeeded', 'StudyResource'];

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      for (const file of files) {
        try {
          const compressed = await compressImage(file, 1280, 960, 0.82);
          setImages(prev => [...prev, compressed]);
        } catch (err) {
          console.warn('[Community] Image compression notice:', err);
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleBack = () => {
    if (images.length > 0) {
      setImages([]);
    } else {
      onClose();
    }
  };

  // Click-away logic for dropdowns and formatting menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showMentions || showTags) {
        if (!target.closest('.editor-container')) {
          setShowMentions(false);
          setShowTags(false);
        }
      }
      
      if (isFormatting && 
          formattingMenuRef.current && 
          !formattingMenuRef.current.contains(target) &&
          formattingToggleRef.current && 
          !formattingToggleRef.current.contains(target)) {
        setIsFormatting(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMentions, showTags, isFormatting]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);

    // Check for @mentions
    const lastAtPos = text.lastIndexOf('@');
    if (lastAtPos !== -1 && (lastAtPos === 0 || text[lastAtPos - 1] === ' ' || text[lastAtPos - 1] === '\n')) {
      const rest = text.slice(lastAtPos + 1);
      const query = rest.split(/[\s\n]/)[0];
      setMentionQuery(query);
      
      const filtered = communityUsers.filter(u => 
        u.name.toLowerCase().replace(/\s+/g, '').includes(query.toLowerCase())
      );
      
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
      setShowTags(false);
      setActiveMentionIndex(0);
      return;
    } else {
      setShowMentions(false);
    }

    // Check for #hashtags
    const lastHashPos = text.lastIndexOf('#');
    if (lastHashPos !== -1 && (lastHashPos === 0 || text[lastHashPos - 1] === ' ' || text[lastHashPos - 1] === '\n')) {
      const rest = text.slice(lastHashPos + 1);
      const query = rest.split(/[\s\n]/)[0];
      
      const filtered = availableTags.filter(t => 
        t.toLowerCase().includes(query.toLowerCase()) && !selectedTags.includes(t)
      );
      
      setTagSuggestions(filtered);
      setShowTags(filtered.length > 0);
      setShowMentions(false);
      setActiveTagIndex(0);
      return;
    } else {
      setShowTags(false);
    }
  };

  const selectMention = (userName: string) => {
    const lastAtPos = content.lastIndexOf('@');
    const beforeAt = content.slice(0, lastAtPos);
    const rest = content.slice(lastAtPos + 1);
    const firstWhitespace = rest.search(/[\s\n]/);
    
    if (firstWhitespace !== -1) {
      const afterQuery = rest.slice(firstWhitespace);
      setContent(`${beforeAt}@${userName} ${afterQuery.trimStart()}`);
    } else {
      setContent(`${beforeAt}@${userName} `);
    }
    setShowMentions(false);
  };

  const selectTag = (tag: string) => {
    const lastHashPos = content.lastIndexOf('#');
    const beforeHash = content.slice(0, lastHashPos);
    const rest = content.slice(lastHashPos + 1);
    const firstWhitespace = rest.search(/[\s\n]/);
    
    if (firstWhitespace !== -1) {
      const afterQuery = rest.slice(firstWhitespace);
      setContent(`${beforeHash}#${tag} ${afterQuery.trimStart()}`);
    } else {
      setContent(`${beforeHash}#${tag} `);
    }

    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setShowTags(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionSuggestions[activeMentionIndex].name);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (showTags && tagSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveTagIndex(prev => (prev + 1) % tagSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveTagIndex(prev => (prev - 1 + tagSuggestions.length) % tagSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectTag(tagSuggestions[activeTagIndex]);
      } else if (e.key === 'Escape') {
        setShowTags(false);
      }
    }
  };

  const wrapSelection = (prefix: string, suffix: string = prefix) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = `${prefix}${selected}${suffix}`;
    
    setContent(content.slice(0, start) + replacement + content.slice(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-dark-bg/80 backdrop-blur-xl flex flex-col justify-end"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-dark-bg border-t border-white/10 rounded-t-[2.5rem] flex flex-col h-[90vh] w-full max-w-2xl mx-auto overflow-hidden shadow-2xl relative"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
          <button 
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10">
              <UserAvatar src={displayAvatar} name={displayName} className="w-full h-full" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">{displayName}</span>
              <span className="text-[9px] text-white/30 uppercase tracking-widest block font-black">Share with Community</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/*" 
              multiple 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              title="Add image"
            >
              <ImageIcon size={18} />
            </button>
            <button 
              ref={formattingToggleRef}
              onClick={() => setIsFormatting(!isFormatting)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isFormatting ? "bg-brand-primary text-dark-bg" : "bg-white/5 text-white/60 hover:text-white"
              )}
              title="Format text"
            >
              <Type size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Editor Container */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide flex flex-col">
          <div className="flex-1 flex flex-col relative editor-container">
            <div className="flex-1 flex flex-col min-h-[150px] relative">
              <textarea 
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder="Share your academic discoveries, study notes, or questions..."
                className="w-full flex-1 bg-transparent border-none outline-none resize-none text-white text-base leading-relaxed placeholder:text-white/20 p-2 scrollbar-hide font-normal"
                autoFocus
              />

              {/* Mentions Suggestion Dropdown - Docked cleanly inside editor container */}
              <AnimatePresence>
                {showMentions && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 right-0 top-12 z-50 shadow-2xl"
                  >
                    <MentionDropdown 
                      suggestions={mentionSuggestions}
                      activeIndex={activeMentionIndex}
                      onSelect={selectMention}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tags Suggestion Dropdown - Docked cleanly inside editor container */}
              <AnimatePresence>
                {showTags && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 right-0 top-12 z-50 shadow-2xl"
                  >
                    <TagDropdown 
                      suggestions={tagSuggestions}
                      activeIndex={activeTagIndex}
                      onSelect={selectTag}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inline Formatting Bar */}
              <AnimatePresence>
                {isFormatting && (
                  <motion.div 
                    ref={formattingMenuRef}
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="mt-6 p-2 bg-dark-bg/95 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] flex flex-wrap gap-2"
                  >
                    <button onClick={() => wrapSelection('**')} className="p-3.5 hover:bg-brand-primary/10 rounded-[1rem] text-white/40 hover:text-brand-primary transition-all"><Bold size={13} /></button>
                    <button onClick={() => wrapSelection('*')} className="p-3.5 hover:bg-brand-primary/10 rounded-[1rem] text-white/40 hover:text-brand-primary transition-all"><Italic size={13} /></button>
                    <button onClick={() => wrapSelection('`')} className="p-3.5 hover:bg-brand-primary/10 rounded-[1rem] text-white/40 hover:text-brand-primary transition-all"><Type size={13} /></button>
                    <button onClick={() => wrapSelection('[', '](url)')} className="p-3.5 hover:bg-brand-primary/10 rounded-[1rem] text-white/40 hover:text-brand-primary transition-all"><LinkIcon size={13} /></button>
                    <div className="w-px bg-white/10 mx-2" />
                    <button onClick={() => wrapSelection('\n- ')} className="p-3.5 hover:bg-brand-primary/10 rounded-[1rem] text-white/40 hover:text-brand-primary transition-all"><List size={13} /></button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Images Preview Grid */}
          <AnimatePresence>
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                {images.map((img, idx) => (
                  <motion.div 
                    key={`preview-image-${idx}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative overflow-hidden border border-white/10 aspect-square bg-black/40 group/img rounded-2xl"
                  >
                    <img src={img} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:bg-red-500 z-10"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Confirmation Modal Overlay */}
        <AnimatePresence>
          {showConfirmPublish && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card border-white/20 p-8 max-w-[320px] text-center"
              >
                <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-brand-primary" />
                </div>
                <h4 className="text-white font-bold mb-2">Ready to post?</h4>
                <p className="text-white/40 text-[10px] leading-relaxed mb-6 uppercase tracking-widest font-black">Your insights will be shared with the entire community.</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      onSubmit({ content, images, tags: selectedTags });
                      setShowConfirmPublish(false);
                    }}
                    className="w-full py-3.5 bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_15px_rgba(204,255,0,0.2)]"
                  >
                    Confirm & Publish
                  </button>
                  <button 
                    onClick={() => setShowConfirmPublish(false)}
                    className="w-full py-3 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Not yet
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with Publish Button */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
          <button 
            disabled={!content.trim()}
            onClick={() => setShowConfirmPublish(true)}
            className="w-full py-3.5 bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-[0_8px_20px_rgba(204,255,0,0.2)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:grayscale disabled:scale-100 disabled:shadow-none"
          >
            Publish
            <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Props for individual PostCard component
 */
interface PostCardProps {
  key?: React.Key;
  post: CommunityPost;
  currentUserName: string;
  onProfileClick?: (author: any) => void;
  onPostClick: (post: any) => void;
  onToggleLike?: (id: string, e?: React.MouseEvent) => void;
  onShare?: (post: any) => void;
  activePostMenuId?: string | null;
  onToggleMenu?: (id: string | null) => void;
  onEdit?: (post: CommunityPost) => void;
  onDelete?: (id: string) => void;
  editingPostId?: string | null;
  editPostText?: string;
  setEditPostText?: (text: string) => void;
  onSaveEdit?: () => void;
  onToggleExpand?: () => void;
  onCancelEdit?: () => void;
  onReport?: (post: CommunityPost) => void;
}

/**
 * Renders formatted markdown text with highlighted mentions and tags
 */
function FormattedContent({ content, onProfileClick }: { content: string; onProfileClick?: (user: any) => void }) {
  if (!content) return null;
  
  return (
    <div className="markdown-content max-w-none">
      <Markdown
        components={{
          p: ({ children }) => {
            const textContent = React.Children.toArray(children)
              .map(child => (typeof child === 'string' ? child : ''))
              .join('');
            return (
              <p className="mb-1 last:mb-0">
                <MentionHighlight text={textContent} onProfileClick={onProfileClick} />
              </p>
            );
          }
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

/**
 * Splits text by user mentions and tags to render clickable interactive links
 */
function MentionHighlight({ text, onProfileClick }: { text: string; onProfileClick?: (user: any) => void }) {
  if (!text) return null;
  const activeUsers = getCachedCommunityUsers();
  const names = activeUsers.map(u => u.name).sort((a, b) => b.length - a.length);
  const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  const mentionsRegexStr = escapedNames.length > 0 
    ? `@(?:${escapedNames.join('|')})(?![a-zA-Z0-9])`
    : '@[a-zA-Z0-9_]+';
  const combinedRegex = new RegExp(`(${mentionsRegexStr}|#\\w+)`, 'g');
  
  const parts = text.split(combinedRegex);
  
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        const partKey = `mention-highlight-part-${i}-${part.slice(0, 5)}`;
        
        if (part.startsWith('@')) {
          const nameOnly = part.slice(1);
          const user = activeUsers.find(u => u.name === nameOnly);
          if (user) {
            return (
              <span 
                key={partKey} 
                onClick={(e) => { e.stopPropagation(); onProfileClick?.(user); }}
                className="text-brand-primary cursor-pointer hover:underline font-bold"
              >
                {part}
              </span>
            );
          }
        }
        
        if (part.startsWith('#')) {
          return (
            <span 
              key={partKey}
              className="text-brand-primary font-bold hover:underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {part}
            </span>
          );
        }
        
        return <React.Fragment key={partKey}>{part}</React.Fragment>;
      })}
    </>
  );
}

function TagDropdown({ 
  suggestions, 
  activeIndex, 
  onSelect 
}: { 
  suggestions: string[]; 
  activeIndex: number; 
  onSelect: (tag: string) => void; 
}) {
  return (
    <div className="w-full bg-dark-bg border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1.5 backdrop-blur-xl">
      <div className="px-3 py-2 border-b border-white/5 mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
          <Tag size={12} /> Select Tag
        </span>
        <span className="text-[8px] font-bold text-white/20 uppercase tracking-tighter">Use # to filter</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-0.5">
        {suggestions.map((tag, i) => (
          <button
            key={`tag-sugg-${tag}-${i}`}
            onClick={() => onSelect(tag)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
              i === activeIndex ? "bg-brand-primary text-dark-bg" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              i === activeIndex ? "bg-dark-bg/20" : "bg-white/5 group-hover:bg-white/10"
            )}>
              <Tag size={10} />
            </div>
            <span className="text-xs font-bold truncate">#{tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MentionDropdown({ 
  suggestions, 
  activeIndex, 
  onSelect 
}: { 
  suggestions: any[]; 
  activeIndex: number; 
  onSelect: (name: string) => void; 
}) {
  return (
    <div className="w-full bg-dark-bg border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1.5 backdrop-blur-xl">
      <div className="px-3 py-2 border-b border-white/5 mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
          <AtSign size={12} /> Mention User
        </span>
      </div>
      <div className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-0.5 text-white">
        {suggestions.map((suggestion, i) => (
          <button
            key={`mention-sugg-${suggestion.name}-${i}`}
            onClick={() => onSelect(suggestion.name)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
              i === activeIndex ? "bg-brand-primary text-dark-bg" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <UserAvatar 
              src={suggestion.avatar} 
              name={suggestion.name} 
              className="w-8 h-8 rounded-full ring-2 ring-white/5" 
            />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{suggestion.name}</div>
              <div className={cn(
                "text-[9px] truncate font-medium uppercase tracking-tight",
                i === activeIndex ? "text-dark-bg/60" : "text-white/30"
              )}>{suggestion.role}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * PostCard Component
 * Displays a single discussion post with like, comment, and share interactions
 */
function PostCard({ 
  post, 
  currentUserName, 
  onProfileClick, 
  onPostClick,
  onToggleLike,
  onShare,
  activePostMenuId,
  onToggleMenu,
  onEdit,
  onDelete,
  editingPostId,
  editPostText,
  setEditPostText,
  onSaveEdit,
  onToggleExpand,
  onCancelEdit,
  onReport
}: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-card border border-white/5 p-5 group relative">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div 
            className={cn(
              "relative transition-transform",
              onProfileClick && "cursor-pointer active:scale-95"
            )}
            onClick={() => onProfileClick?.(post.author)}
          >
            <UserAvatar 
              src={post.author.avatar} 
              name={post.author.name} 
              className="w-10 h-10 rounded-full ring-2 ring-white/5" 
            />
          </div>
          <div>
            <h4 
              className={cn(
                "text-sm font-bold text-white transition-colors tracking-tight",
                onProfileClick && "cursor-pointer hover:text-brand-primary"
              )}
              onClick={() => onProfileClick?.(post.author)}
            >
              {post.author.name}
            </h4>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-tight">{post.author.role}</p>
              <span className="text-[10px] text-white/10">•</span>
              <span className="text-[9px] font-medium text-white/20">{post.time}</span>
            </div>
          </div>
        </div>

        {/* Options Menu Button */}
        <div className="relative post-menu-container">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu?.(activePostMenuId === post.id ? null : post.id);
            }}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors"
          >
            <MoreHorizontal size={18} />
          </button>
          <AnimatePresence>
            {activePostMenuId === post.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 top-full mt-2 w-32 bg-dark-bg border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20"
              >
                {post.author.name === currentUserName && (
                  <>
                    <button 
                      onClick={() => onEdit?.(post)}
                      className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button 
                      onClick={() => onDelete?.(post.id)}
                      className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <X size={12} /> Delete
                    </button>
                  </>
                )}
                <button 
                  onClick={() => onReport?.(post)}
                  className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Info size={12} /> Report
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Post Text Content */}
      <div className="text-sm text-white/70 leading-relaxed mb-4">
        {editingPostId === post.id ? (
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl focus-within:border-brand-primary transition-all">
              <MentionInput 
                value={editPostText || ''}
                onChange={(e) => setEditPostText?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) onSaveEdit?.();
                }}
                placeholder="Edit your post..."
                className="text-white text-sm"
                padding="p-3"
                autoFocus
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={onCancelEdit}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={onSaveEdit}
                className="px-4 py-1.5 rounded-lg bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className={cn(!isExpanded && post.content.length > 200 && "line-clamp-3")}>
              <FormattedContent content={post.content} onProfileClick={onProfileClick} />
            </div>
            {post.content.length > 200 && (
              <button 
                onClick={() => {
                  setIsExpanded(!isExpanded);
                  onToggleExpand?.();
                }}
                className="text-[10px] font-bold uppercase tracking-widest text-brand-primary hover:underline mt-2 inline-block"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Post Image Attachment */}
      {post.image && (
        <div 
          onClick={() => onPostClick(post)}
          className="rounded-2xl overflow-hidden mb-4 border border-white/5 max-h-80 cursor-pointer group-hover:border-white/10 transition-colors"
        >
          <img 
            src={post.image} 
            alt="Attachment" 
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" 
          />
        </div>
      )}

      {/* Post Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map((tag, tIdx) => (
            <span key={`post-tag-${tag}-${tIdx}`} className="text-[10px] font-black uppercase tracking-wider text-brand-primary/60 bg-brand-primary/5 px-2 py-0.5 rounded-md border border-brand-primary/10">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom Action Stats Bar */}
      <div className="flex items-center gap-6 pt-4 border-t border-white/5">
        <button 
          onClick={(e) => onToggleLike?.(post.id, e)}
          className={cn(
            "flex items-center gap-2 transition-colors",
            post.isLiked ? "text-red-400" : "text-white/30 hover:text-red-400"
          )}
        >
          <Heart size={18} fill={post.isLiked ? "currentColor" : "none"} />
          <span className="text-xs font-bold">{post.likes}</span>
        </button>
        <button 
          onClick={() => onPostClick(post)}
          className="flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 transition-colors"
        >
          <MessageSquare size={18} />
          <span className="text-xs font-bold">{post.comments}</span>
        </button>
        {onShare && (
          <button 
            onClick={() => onShare(post)}
            className="ml-auto flex items-center gap-2 text-white/20 hover:text-white/60 transition-colors active:scale-95"
          >
            <Share2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * FullProfileView Component
 * Detailed full-screen modal showing an authenticated student or peer user's academic profile and posts
 */
function FullProfileView({ 
  user, 
  isCurrentUser = false,
  onBack, 
  posts, 
  onPostClick,
  onChat,
  isConnected,
  onToggleConnect,
  connectionCount,
  currentUserName,
  onDeletePost,
  onToggleLike,
  onToggleMenu,
  activePostMenuId,
  onProfileClick,
  onShare,
  onEdit,
  onToggleExpand,
  editingPostId,
  editPostText,
  setEditPostText,
  onSaveEdit,
  onCancelEdit,
  onUpdateBio,
  onUpdateAvatar,
  onUpdateBanner
}: { 
  user: any; 
  isCurrentUser?: boolean;
  onBack: () => void; 
  posts: any[];
  onPostClick: (post: any) => void;
  onChat: () => void;
  isConnected: boolean;
  onToggleConnect: (user: any) => void;
  connectionCount: number;
  currentUserName: string;
  onDeletePost: (id: string) => void;
  onToggleLike: (id: string, e: React.MouseEvent) => void;
  onToggleMenu: (id: string) => void;
  activePostMenuId: string | null;
  onProfileClick: (user: any) => void;
  onShare: (post: any) => void;
  onEdit: (post: CommunityPost) => void;
  onToggleExpand: (id: string) => void;
  editingPostId: string | null;
  editPostText: string;
  setEditPostText: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdateBio?: (bio: string) => Promise<void>;
  onUpdateAvatar?: (avatar: string) => Promise<void>;
  onUpdateBanner?: (banner: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'posts' | 'media' | 'about'>('posts');
  
  // Profile state for direct editable items
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatar || '');
  const [bannerUrl, setBannerUrl] = useState<string>(user.banner || '');
  const [currentBio, setCurrentBio] = useState<string>(
    user.bio || "Dedicated scholar collaborating on Studibl."
  );
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(currentBio);
  const [isSavingBio, setIsSavingBio] = useState(false);

  // Sync if prop updates
  useEffect(() => {
    if (user.avatar) setAvatarUrl(user.avatar);
    if (user.banner) setBannerUrl(user.banner);
    if (user.bio) {
      setCurrentBio(user.bio);
      setBioInput(user.bio);
    }
  }, [user.avatar, user.banner, user.bio]);

  const handleSaveBio = async () => {
    if (!onUpdateBio) return;
    try {
      setIsSavingBio(true);
      await onUpdateBio(bioInput.trim());
      setCurrentBio(bioInput.trim());
      setIsEditingBio(false);
    } catch (err) {
      console.error('[Community] Error saving bio:', err);
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 400, 0.85);
      setAvatarUrl(compressed);
      if (onUpdateAvatar) await onUpdateAvatar(compressed);
    } catch (err) {
      console.error('[Community] Error processing avatar image:', err);
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1280, 480, 0.82);
      setBannerUrl(compressed);
      if (onUpdateBanner) await onUpdateBanner(compressed);
    } catch (err) {
      console.error('[Community] Error processing banner image:', err);
    }
  };

  const fullUser = {
    ...user,
    handle: `@${user.name.toLowerCase().replace(/\s+/g, '')}`,
    academicLevel: user.academicLevel || 'Academic Scholar',
  };

  const userPosts = posts.filter(p => p.author.name === user.name);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[150] bg-dark-bg flex flex-col pt-0 overflow-y-auto scrollbar-hide"
    >
      {/* Cover Photo / Banner */}
      <div className="relative h-52 w-full shrink-0 bg-gradient-to-br from-white/10 via-dark-bg/80 to-dark-bg border-b border-white/5 flex flex-col justify-end">
        {bannerUrl ? (
          <>
            <img 
              src={bannerUrl} 
              className="w-full h-full object-cover absolute inset-0"
              alt="Cover Banner"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-dark-bg" />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-white/[0.04] to-dark-bg/90">
            {isCurrentUser ? (
              <label 
                className="cursor-pointer group flex flex-col items-center gap-2 p-4 rounded-2xl border border-dashed border-white/20 hover:border-brand-primary/50 hover:bg-white/5 transition-all"
                title="Upload cover banner"
              >
                <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera size={18} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-white/70 group-hover:text-white">
                  Add Cover Banner
                </span>
                <span className="text-[9px] text-white/30 max-w-[200px] leading-tight">
                  Personalize your academic presence on Studibl
                </span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleBannerFileChange} 
                />
              </label>
            ) : (
              <div className="text-white/20 text-xs font-bold uppercase tracking-widest">
                Academic Scholar Profile
              </div>
            )}
          </div>
        )}
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-colors z-30 shadow-lg"
          title="Go back"
        >
          <ArrowLeft size={20} />
        </button>

        {isCurrentUser && bannerUrl && (
          <label 
            className="absolute top-6 right-6 px-3.5 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:bg-white/20 active:scale-95 transition-all z-30 shadow-lg"
            title="Change banner photo"
          >
            <Camera size={14} />
            <span>Edit Banner</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleBannerFileChange} 
            />
          </label>
        )}
      </div>

      {/* Profile Info */}
      <div className="px-6 -mt-14 relative z-10">
        <div className="relative mb-4 inline-block">
          <UserAvatar 
            src={avatarUrl} 
            name={fullUser.name}
            className="w-28 h-28 rounded-full border-4 border-dark-bg shadow-2xl"
          />
          {isCurrentUser ? (
            <label 
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-brand-primary text-dark-bg flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-transform" 
              title="Change profile picture"
            >
              <Camera size={15} strokeWidth={2.5} />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarFileChange} 
              />
            </label>
          ) : (
            fullUser.online && (
              <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-2 border-dark-bg rounded-full shadow-lg" />
            )
          )}
        </div>

        <h2 className="text-3xl font-black text-white mb-1 tracking-tight">{fullUser.name}</h2>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-white/40 font-medium">{fullUser.handle}</span>
          <span className="text-white/20">•</span>
          <span className="text-xs text-white/40 font-medium">{fullUser.role || fullUser.academicLevel}</span>
          <span className="text-white/20">•</span>
          <span className="text-xs font-bold text-brand-primary">{connectionCount} {connectionCount === 1 ? 'Connection' : 'Connections'}</span>
        </div>

        {/* Bio Section with Pencil Edit Icon */}
        {isEditingBio ? (
          <div className="mb-6 space-y-3">
            <textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              placeholder="Tell other scholars about your academic goals and research..."
              rows={3}
              className="w-full bg-white/5 border border-brand-primary/40 rounded-2xl p-3 text-sm text-white focus:outline-none focus:border-brand-primary resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBioInput(currentBio);
                  setIsEditingBio(false);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingBio}
                onClick={handleSaveBio}
                className="px-4 py-1.5 rounded-xl bg-brand-primary text-dark-bg text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                {isSavingBio ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 mb-6 group/bio">
            <p className="text-sm text-white/70 leading-relaxed font-medium flex-1">
              {currentBio || "Dedicated scholar collaborating on Studibl."}
            </p>
            {isCurrentUser && (
              <button
                type="button"
                onClick={() => {
                  setBioInput(currentBio);
                  setIsEditingBio(true);
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-brand-primary hover:text-dark-bg text-white/40 transition-all shrink-0 active:scale-90"
                title="Edit bio"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}

        {/* Action Buttons: Only shown if viewing another authenticated user's profile */}
        {!isCurrentUser && (
          <div className="flex gap-3 mb-8">
            <button 
              onClick={() => onToggleConnect(user)}
              className={cn(
                "flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all shadow-xl",
                isConnected 
                  ? "bg-white/5 border border-white/10 text-white/60 shadow-none" 
                  : "bg-brand-primary text-dark-bg shadow-brand-primary/20 hover:brightness-110"
              )}
            >
              {isConnected ? <Check size={16} /> : <UserPlus size={16} />}
              {isConnected ? 'Connected' : 'Connect'}
            </button>
            <button 
              onClick={onChat}
              className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[11px] hover:bg-white/10 active:scale-95 transition-all"
            >
              <MessageCircle size={16} />
              Chat
            </button>
          </div>
        )}

        {/* Profile Tabs */}
        <div className="flex border-b border-white/5 mb-8">
          {(['posts', 'media', 'about'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-4 px-6 text-xs font-black uppercase tracking-widest relative transition-colors",
                activeTab === tab ? "text-white" : "text-white/30 hover:text-white/60"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div 
                  layoutId="active-profile-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pb-20 space-y-6">
          {activeTab === 'posts' && (
            userPosts.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs font-bold uppercase tracking-widest">
                No posts published yet by {user.name}
              </div>
            ) : (
              userPosts.map((post, upIdx) => (
                <PostCard 
                  key={`user-post-${post.id}-${upIdx}`}
                  post={post}
                  currentUserName={currentUserName}
                  onPostClick={onPostClick}
                  onToggleLike={onToggleLike}
                  onShare={onShare}
                  onToggleMenu={onToggleMenu}
                  activePostMenuId={activePostMenuId}
                  onProfileClick={onProfileClick}
                  onEdit={onEdit}
                  onDelete={onDeletePost}
                  editingPostId={editingPostId}
                  editPostText={editPostText}
                  setEditPostText={setEditPostText}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                />
              ))
            )
          )}

          {activeTab === 'media' && (
            <div className="grid grid-cols-2 gap-3">
              {userPosts.filter(p => p.image).length === 0 ? (
                <div className="col-span-2 text-center py-12 text-white/30 text-xs font-bold uppercase tracking-widest">
                  No media shared yet
                </div>
              ) : (
                userPosts.filter(p => p.image).map((post, mIdx) => (
                  <div 
                    key={`media-${post.id}-${mIdx}`} 
                    onClick={() => onPostClick(post)}
                    className="aspect-square rounded-2xl overflow-hidden border border-white/5 cursor-pointer group relative"
                  >
                    <img src={post.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                      <span className="flex items-center gap-1 text-xs font-bold"><Heart size={14} fill="white" /> {post.likes}</span>
                      <span className="flex items-center gap-1 text-xs font-bold"><MessageSquare size={14} fill="white" /> {post.comments}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="glass-card border border-white/5 p-6 space-y-6">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Academic Information</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs text-white/60">Faculty / Major</span>
                    <span className="text-xs font-bold text-white">{fullUser.role || 'Engineering'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs text-white/60">Role</span>
                    <span className="text-xs font-bold text-white">{fullUser.academicLevel}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
