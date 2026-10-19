import { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * ====================================================================
 * STUDIBL SECURE BACKEND COMMUNITY SERVICE ROUTER
 * Handles persistent database storage, multi-user authorization,
 * CRUD operations for posts, nested comments, likes, groups,
 * direct messaging chats, and peer connections directly backed by
 * Supabase and local persistent state.
 * ====================================================================
 */

// Path to the persistent database file on disk for fallback persistence
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'community_db.json');

/**
 * Interface representing a community post record
 */
export interface PostRecord {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  author_role: string;
  author_bio?: string;
  content: string;
  tags: string[];
  images: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Interface representing a comment or reply record
 */
export interface CommentRecord {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface representing a like entry on a post or comment
 */
export interface LikeRecord {
  target_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Interface representing a study group hub
 */
export interface GroupRecord {
  id: string;
  name: string;
  description: string;
  image: string;
  tag: string;
  base_members: number;
  creator_id?: string;
  created_at?: string;
}

/**
 * Interface representing group membership
 */
export interface GroupMemberRecord {
  group_id: string;
  user_id: string;
  joined_at: string;
}

/**
 * Interface representing peer connections
 */
export interface ConnectionRecord {
  user_id: string;
  target_user_name: string;
  target_user_id?: string;
  created_at: string;
}

/**
 * Interface representing a direct or group chat thread
 */
export interface ChatRecord {
  id: string;
  participants: {
    user_id: string;
    user_name: string;
    user_avatar: string;
    user_role: string;
  }[];
  last_message: string;
  updated_at: string;
}

/**
 * Interface representing an individual chat message
 */
export interface MessageRecord {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  type: 'text' | 'image' | 'file';
  attachment?: {
    name: string;
    url: string;
    size?: string;
  };
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
}

/**
 * Complete shape of the persistent community database
 */
export interface CommunityDatabase {
  posts: PostRecord[];
  comments: CommentRecord[];
  post_likes: LikeRecord[];
  comment_likes: LikeRecord[];
  groups: GroupRecord[];
  group_members: GroupMemberRecord[];
  connections: ConnectionRecord[];
  chats: ChatRecord[];
  messages: MessageRecord[];
}

// In-memory reference to the active database state
let db: CommunityDatabase;

/**
 * Returns a clean, empty database structure with NO mock data
 */
function getInitialEmptyData(): CommunityDatabase {
  return {
    posts: [],
    comments: [],
    post_likes: [],
    comment_likes: [],
    groups: [],
    group_members: [],
    connections: [],
    chats: [],
    messages: []
  };
}

/**
 * Ensures data directory exists and initializes persistent storage
 */
function initDatabase(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
      // Ensure all arrays are defined
      db.posts = db.posts || [];
      db.comments = db.comments || [];
      db.post_likes = db.post_likes || [];
      db.comment_likes = db.comment_likes || [];
      db.groups = db.groups || [];
      db.group_members = db.group_members || [];
      db.connections = db.connections || [];
      db.chats = db.chats || [];
      db.messages = db.messages || [];

      // Clean out any legacy mock data containing hardcoded peer names, mock groups, or fake users
      const legacyMockGroupNames = new Set(['Fluid Dynamics Hub', 'Algorithm Avengers', 'Quantum Realm Scholars', 'Pure Mathematics Guild', 'Quantum Realm', 'Fluid Dynamics']);
      db.groups = db.groups.filter(g => !legacyMockGroupNames.has(g.name));
      
      const legacyMockAuthors = new Set(['Sarah Chen', 'Marcus Vance', 'Elena Rostova', 'David Kalu', 'Chidi Okafor', 'Amina Yusuf', 'Peer Scholar']);
      const legacyMockIds = new Set(['user-sarah-chen', 'peer-user-sarah', 'peer-user-marcus', 'peer-user-elena', 'peer-user-david', 'peer-user-chidi', 'peer-user-amina']);

      db.posts = db.posts.filter(p => !legacyMockAuthors.has(p.author_name) && !legacyMockIds.has(p.author_id));
      db.comments = db.comments.filter(c => !legacyMockAuthors.has(c.author_name) && !legacyMockIds.has(c.author_id));
      db.post_likes = db.post_likes.filter(l => !legacyMockIds.has(l.user_id));
      db.comment_likes = db.comment_likes.filter(l => !legacyMockIds.has(l.user_id));
      db.group_members = db.group_members.filter(m => !legacyMockIds.has(m.user_id));
      db.connections = db.connections.filter(c => !legacyMockAuthors.has(c.target_user_name) && (!c.target_user_id || !legacyMockIds.has(c.target_user_id)) && !legacyMockIds.has(c.user_id));
      db.chats = db.chats.filter(c => !c.participants.some(p => legacyMockAuthors.has(p.user_name) || legacyMockIds.has(p.user_id)));
      db.messages = db.messages.filter(m => !legacyMockAuthors.has(m.sender_name) && !legacyMockIds.has(m.sender_id));

      saveDatabase();
      console.log(`[Community DB] Loaded community database: ${db.posts.length} posts, ${db.groups.length} groups.`);
    } else {
      db = getInitialEmptyData();
      saveDatabase();
      console.log('[Community DB] Initialized fresh clean community database.');
    }
  } catch (err) {
    console.error('[Community DB] Error during database initialization:', err);
    db = getInitialEmptyData();
  }
}

/**
 * Safely writes the current database state to disk using an atomic write pattern
 */
function saveDatabase(): void {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Community DB] Failed to persist database to disk:', err);
  }
}

/**
 * Formats ISO timestamp to human-friendly relative duration
 */
function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Extracts and authenticates user identity from the incoming request
 */
async function resolveAuthUser(req: Request, supabaseClient: SupabaseClient) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  // 1. Sandbox fallback simulation token for offline guest preview
  if (token === 'sandbox-token') {
    const sandboxName = (req.headers['x-sandbox-user-name'] as string) || 'Scholarly Student';
    const sandboxEmail = (req.headers['x-sandbox-user-email'] as string) || 'student@studibl.internal';
    const sandboxAvatar = (req.headers['x-sandbox-user-avatar'] as string) || '';

    return {
      id: 'sandbox-guest-id',
      name: sandboxName,
      avatar: sandboxAvatar,
      role: 'Engineering Senior',
      bio: 'Studying hard for upcoming university engineering & coding exams.',
      banner: '',
      academicLevel: 'Senior Undergraduate',
      department: 'Engineering',
      email: sandboxEmail
    };
  }

  // 2. Real Supabase authenticated user verification
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return null;
    }

    // Pull full profile attributes from Supabase 'profiles' table
    let fullName = user.user_metadata?.full_name || '';
    let avatarUrl = user.user_metadata?.avatar_url || '';
    let major = user.user_metadata?.major || user.user_metadata?.faculty || user.user_metadata?.department || 'University Student';
    let bio = user.user_metadata?.bio || 'Passionate university scholar on Studibl.';
    let banner = user.user_metadata?.banner_url || '';
    let academicLevel = user.user_metadata?.academicLevel || 'Academic Scholar';
    let department = user.user_metadata?.department || user.user_metadata?.faculty || 'General';

    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.full_name) fullName = profile.full_name;
        if (profile.avatar_url) avatarUrl = profile.avatar_url;
        if (profile.major) major = profile.major;
        if ((profile as any).bio) bio = (profile as any).bio;
        if ((profile as any).banner_url) banner = (profile as any).banner_url;
        if ((profile as any).academic_level) academicLevel = (profile as any).academic_level;
        if ((profile as any).department) department = (profile as any).department;
      }
    } catch (profileErr) {
      // Non-fatal, fallback to auth metadata
    }

    if (!fullName) {
      fullName = user.email?.split('@')[0] || 'Student';
    }

    if (!avatarUrl) {
      avatarUrl = '';
    }

    return {
      id: user.id,
      name: fullName,
      avatar: avatarUrl,
      role: major,
      bio,
      banner,
      academicLevel,
      department,
      email: user.email
    };
  } catch (err) {
    console.error('[Community Auth] Verification error:', err);
    return null;
  }
}

/**
 * Registers all Community backend endpoints on the Express application
 */
export function registerCommunityRoutes(app: Express, supabaseClient: SupabaseClient): void {
  initDatabase();

  /**
   * Helper authentication middleware to guard endpoints
   */
  const requireAuth = async (req: Request, res: Response, next: () => void) => {
    const authUser = await resolveAuthUser(req, supabaseClient);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized: Valid authentication token required' });
    }
    (req as any).authUser = authUser;
    next();
  };

  // ====================================================================
  // 1. POSTS ENDPOINTS
  // ====================================================================

  /**
   * GET /api/community/posts
   * Returns list of community posts with likes count, comment count, and isLiked state
   */
  app.get('/api/community/posts', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;

      // Attempt to query Supabase community_posts table first if available
      let postsList = db.posts;
      try {
        const { data: sbPosts, error } = await supabaseClient
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(sbPosts) && sbPosts.length > 0) {
          postsList = sbPosts.map((p: any) => ({
            id: p.id,
            author_id: p.user_id || p.author_id,
            author_name: p.author_name,
            author_avatar: p.author_avatar,
            author_role: p.author_role,
            author_bio: p.author_bio,
            content: p.content,
            tags: p.tags || [],
            images: p.images || [],
            created_at: p.created_at,
            updated_at: p.updated_at || p.created_at
          }));
        }
      } catch (sbErr) {
        // Table may not yet be provisioned; fallback cleanly to memory/file
      }

      // Map posts with dynamic counts and requesting user's like status
      const mappedPosts = postsList.map(post => {
        const postLikes = db.post_likes.filter(l => l.target_id === post.id);
        const isLiked = postLikes.some(l => l.user_id === authUser.id);
        const commentsCount = db.comments.filter(c => c.post_id === post.id).length;

        return {
          id: post.id,
          author: {
            id: post.author_id,
            name: post.author_name,
            avatar: post.author_avatar,
            role: post.author_role,
            bio: post.author_bio
          },
          content: post.content,
          likes: postLikes.length,
          comments: commentsCount,
          tags: post.tags || [],
          image: post.images?.[0] || null,
          images: post.images || [],
          time: formatRelativeTime(post.created_at),
          created_at: post.created_at,
          isLiked
        };
      });

      // Sort newest posts first
      mappedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return res.json({ success: true, posts: mappedPosts });
    } catch (err: any) {
      console.error('[Community Posts Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch community posts' });
    }
  });

  /**
   * POST /api/community/posts
   * Creates a new community post authored by the authenticated user
   */
  app.post('/api/community/posts', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { content, tags, images } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Post content cannot be empty' });
      }

      const now = new Date().toISOString();
      const newPost: PostRecord = {
        id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        author_id: authUser.id,
        author_name: authUser.name,
        author_avatar: authUser.avatar,
        author_role: authUser.role,
        author_bio: authUser.bio,
        content: content.trim(),
        tags: Array.isArray(tags) ? tags : [],
        images: Array.isArray(images) ? images : [],
        created_at: now,
        updated_at: now
      };

      // Try inserting into Supabase community_posts table
      try {
        await supabaseClient.from('community_posts').insert([{
          id: newPost.id,
          user_id: authUser.id,
          author_name: authUser.name,
          author_avatar: authUser.avatar,
          author_role: authUser.role,
          author_bio: authUser.bio,
          content: newPost.content,
          tags: newPost.tags,
          images: newPost.images,
          created_at: now,
          updated_at: now
        }]);
      } catch (sbErr) {
        // Fallback
      }

      db.posts.unshift(newPost);
      saveDatabase();

      return res.status(201).json({
        success: true,
        post: {
          id: newPost.id,
          author: {
            id: newPost.author_id,
            name: newPost.author_name,
            avatar: newPost.author_avatar,
            role: newPost.author_role,
            bio: newPost.author_bio
          },
          content: newPost.content,
          likes: 0,
          comments: 0,
          tags: newPost.tags,
          image: newPost.images?.[0] || null,
          images: newPost.images,
          time: 'Just now',
          created_at: newPost.created_at,
          isLiked: false
        }
      });
    } catch (err: any) {
      console.error('[Community Post Create Error]', err);
      return res.status(500).json({ error: 'Failed to publish post' });
    }
  });

  /**
   * PUT /api/community/posts/:id
   * Updates an existing post (only author is authorized)
   */
  app.put('/api/community/posts/:id', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id } = req.params;
      const { content, tags, images } = req.body;

      const postIndex = db.posts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const post = db.posts[postIndex];
      // Enforce author identity security check
      if (post.author_id !== authUser.id && post.author_name !== authUser.name) {
        return res.status(403).json({ error: 'Forbidden: You are only authorized to edit your own posts' });
      }

      if (content && typeof content === 'string') {
        post.content = content.trim();
      }
      if (Array.isArray(tags)) post.tags = tags;
      if (Array.isArray(images)) post.images = images;
      post.updated_at = new Date().toISOString();

      try {
        await supabaseClient.from('community_posts').update({
          content: post.content,
          tags: post.tags,
          images: post.images,
          updated_at: post.updated_at
        }).eq('id', id);
      } catch (sbErr) {
        // Fallback
      }

      saveDatabase();
      return res.json({ success: true, post });
    } catch (err: any) {
      console.error('[Community Post Update Error]', err);
      return res.status(500).json({ error: 'Failed to update post' });
    }
  });

  /**
   * DELETE /api/community/posts/:id
   * Deletes an existing post and cascades its likes and comments (only author is authorized)
   */
  app.delete('/api/community/posts/:id', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id } = req.params;

      const postIndex = db.posts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const post = db.posts[postIndex];
      // Enforce author identity security check
      if (post.author_id !== authUser.id && post.author_name !== authUser.name) {
        return res.status(403).json({ error: 'Forbidden: You are only authorized to delete your own posts' });
      }

      try {
        await supabaseClient.from('community_posts').delete().eq('id', id);
      } catch (sbErr) {
        // Fallback
      }

      // Remove post, its comments, and associated likes
      db.posts.splice(postIndex, 1);
      db.comments = db.comments.filter(c => c.post_id !== id);
      db.post_likes = db.post_likes.filter(l => l.target_id !== id);

      saveDatabase();
      return res.json({ success: true, message: 'Post successfully deleted' });
    } catch (err: any) {
      console.error('[Community Post Delete Error]', err);
      return res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  /**
   * POST /api/community/posts/:id/like
   * Toggles the like status on a post for the authenticated user
   */
  app.post('/api/community/posts/:id/like', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id } = req.params;

      const postExists = db.posts.some(p => p.id === id);
      if (!postExists) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const existingIndex = db.post_likes.findIndex(
        l => l.target_id === id && l.user_id === authUser.id
      );

      let isLiked = false;
      if (existingIndex > -1) {
        // User already liked this post: unlike it
        db.post_likes.splice(existingIndex, 1);
        isLiked = false;
        try {
          await supabaseClient.from('community_post_likes').delete().match({ post_id: id, user_id: authUser.id });
        } catch (sbErr) {}
      } else {
        // User has not liked this post: add like
        db.post_likes.push({
          target_id: id,
          user_id: authUser.id,
          created_at: new Date().toISOString()
        });
        isLiked = true;
        try {
          await supabaseClient.from('community_post_likes').insert([{ post_id: id, user_id: authUser.id }]);
        } catch (sbErr) {}
      }

      saveDatabase();

      const totalLikes = db.post_likes.filter(l => l.target_id === id).length;
      return res.json({ success: true, isLiked, likes: totalLikes });
    } catch (err: any) {
      console.error('[Community Post Like Toggle Error]', err);
      return res.status(500).json({ error: 'Failed to update like status' });
    }
  });

  // ====================================================================
  // 2. COMMENTS & REPLIES ENDPOINTS
  // ====================================================================

  /**
   * GET /api/community/posts/:id/comments
   * Returns structured comments and nested replies for a given post
   */
  app.get('/api/community/posts/:id/comments', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: postId } = req.params;
      const sort = req.query.sort as string || 'top';

      const postComments = db.comments.filter(c => c.post_id === postId);

      const topLevel = postComments.filter(c => !c.parent_id);
      const replies = postComments.filter(c => !!c.parent_id);

      const formatComment = (comment: CommentRecord) => {
        const commentLikes = db.comment_likes.filter(l => l.target_id === comment.id);
        const isLiked = commentLikes.some(l => l.user_id === authUser.id);
        
        return {
          id: comment.id,
          author: {
            id: comment.author_id,
            name: comment.author_name,
            avatar: comment.author_avatar
          },
          content: comment.content,
          time: formatRelativeTime(comment.created_at),
          created_at: comment.created_at,
          likes: commentLikes.length,
          isLiked,
          replies: [] as any[]
        };
      };

      const result = topLevel.map(comment => {
        const item = formatComment(comment);
        const commentReplies = replies.filter(r => r.parent_id === comment.id);
        item.replies = commentReplies.map(formatComment);
        item.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return item;
      });

      if (sort === 'top') {
        result.sort((a, b) => b.likes - a.likes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      return res.json({ success: true, comments: result });
    } catch (err: any) {
      console.error('[Community Comments Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  /**
   * POST /api/community/posts/:id/comments
   * Adds a new comment or nested reply authored by the authenticated user
   */
  app.post('/api/community/posts/:id/comments', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: postId } = req.params;
      const { content, parentId } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Comment text cannot be empty' });
      }

      const postExists = db.posts.some(p => p.id === postId);
      if (!postExists) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (parentId) {
        const parentExists = db.comments.some(c => c.id === parentId && c.post_id === postId);
        if (!parentExists) {
          return res.status(404).json({ error: 'Parent comment not found' });
        }
      }

      const now = new Date().toISOString();
      const newComment: CommentRecord = {
        id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        post_id: postId,
        parent_id: parentId || null,
        author_id: authUser.id,
        author_name: authUser.name,
        author_avatar: authUser.avatar,
        content: content.trim(),
        created_at: now,
        updated_at: now
      };

      try {
        await supabaseClient.from('community_comments').insert([{
          id: newComment.id,
          post_id: postId,
          parent_id: newComment.parent_id,
          user_id: authUser.id,
          author_name: authUser.name,
          author_avatar: authUser.avatar,
          content: newComment.content,
          created_at: now,
          updated_at: now
        }]);
      } catch (sbErr) {}

      db.comments.push(newComment);
      saveDatabase();

      return res.status(201).json({
        success: true,
        comment: {
          id: newComment.id,
          author: {
            id: newComment.author_id,
            name: newComment.author_name,
            avatar: newComment.author_avatar
          },
          content: newComment.content,
          time: 'Just now',
          created_at: newComment.created_at,
          likes: 0,
          isLiked: false,
          replies: []
        }
      });
    } catch (err: any) {
      console.error('[Community Comment Add Error]', err);
      return res.status(500).json({ error: 'Failed to publish comment' });
    }
  });

  /**
   * PUT /api/community/comments/:id
   * Edits an existing comment (author only)
   */
  app.put('/api/community/comments/:id', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: commentId } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Comment content cannot be empty' });
      }

      const comment = db.comments.find(c => c.id === commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.author_id !== authUser.id && comment.author_name !== authUser.name) {
        return res.status(403).json({ error: 'Forbidden: You are only authorized to edit your own comments' });
      }

      comment.content = content.trim();
      comment.updated_at = new Date().toISOString();

      try {
        await supabaseClient.from('community_comments').update({
          content: comment.content,
          updated_at: comment.updated_at
        }).eq('id', commentId);
      } catch (sbErr) {}

      saveDatabase();
      return res.json({ success: true, comment });
    } catch (err: any) {
      console.error('[Community Comment Edit Error]', err);
      return res.status(500).json({ error: 'Failed to update comment' });
    }
  });

  /**
   * DELETE /api/community/comments/:id
   * Deletes a comment or reply (author or post owner)
   */
  app.delete('/api/community/comments/:id', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: commentId } = req.params;

      const commentIndex = db.comments.findIndex(c => c.id === commentId);
      if (commentIndex === -1) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const comment = db.comments[commentIndex];
      const parentPost = db.posts.find(p => p.id === comment.post_id);

      const isAuthor = comment.author_id === authUser.id || comment.author_name === authUser.name;
      const isPostOwner = parentPost && (parentPost.author_id === authUser.id || parentPost.author_name === authUser.name);

      if (!isAuthor && !isPostOwner) {
        return res.status(403).json({ error: 'Forbidden: You are not authorized to delete this comment' });
      }

      // Collect IDs to remove (comment + any nested replies)
      const idsToRemove = [commentId];
      const childReplies = db.comments.filter(c => c.parent_id === commentId);
      childReplies.forEach(r => idsToRemove.push(r.id));

      db.comments = db.comments.filter(c => !idsToRemove.includes(c.id));
      db.comment_likes = db.comment_likes.filter(l => !idsToRemove.includes(l.target_id));

      try {
        await supabaseClient.from('community_comments').delete().in('id', idsToRemove);
      } catch (sbErr) {}

      saveDatabase();
      return res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (err: any) {
      console.error('[Community Comment Delete Error]', err);
      return res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  /**
   * POST /api/community/comments/:id/like
   * Toggles like state on a comment
   */
  app.post('/api/community/comments/:id/like', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: commentId } = req.params;

      const commentExists = db.comments.some(c => c.id === commentId);
      if (!commentExists) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const existingIndex = db.comment_likes.findIndex(
        l => l.target_id === commentId && l.user_id === authUser.id
      );

      let isLiked = false;
      if (existingIndex > -1) {
        db.comment_likes.splice(existingIndex, 1);
        isLiked = false;
        try {
          await supabaseClient.from('community_comment_likes').delete().match({ comment_id: commentId, user_id: authUser.id });
        } catch (sbErr) {}
      } else {
        db.comment_likes.push({
          target_id: commentId,
          user_id: authUser.id,
          created_at: new Date().toISOString()
        });
        isLiked = true;
        try {
          await supabaseClient.from('community_comment_likes').insert([{ comment_id: commentId, user_id: authUser.id }]);
        } catch (sbErr) {}
      }

      saveDatabase();

      const totalLikes = db.comment_likes.filter(l => l.target_id === commentId).length;
      return res.json({ success: true, isLiked, likes: totalLikes });
    } catch (err: any) {
      console.error('[Community Comment Like Toggle Error]', err);
      return res.status(500).json({ error: 'Failed to toggle comment like' });
    }
  });

  // ====================================================================
  // 3. STUDY GROUPS ENDPOINTS (REAL CREATED GROUPS ONLY)
  // ====================================================================

  /**
   * GET /api/community/groups
   * Returns authenticated list of study groups that actually exist in the database
   */
  app.get('/api/community/groups', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;

      // First check Supabase community_groups table
      let groupsList = db.groups;
      try {
        const { data: sbGroups, error } = await supabaseClient
          .from('community_groups')
          .select('*');

        if (!error && Array.isArray(sbGroups) && sbGroups.length > 0) {
          groupsList = sbGroups.map((g: any) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            image: g.image || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80',
            tag: g.tag || 'Academic',
            base_members: g.base_members || 1,
            creator_id: g.creator_id,
            created_at: g.created_at
          }));
        }
      } catch (sbErr) {
        // Fallback
      }

      // Compute dynamic member count and user join status
      const groupsWithStatus = groupsList.map(group => {
        const memberRecords = db.group_members.filter(m => m.group_id === group.id);
        const isJoined = memberRecords.some(m => m.user_id === authUser.id) || group.creator_id === authUser.id;
        const totalMembers = Math.max(1, (group.base_members || 1) + memberRecords.length);

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          image: group.image,
          tag: group.tag,
          members: totalMembers,
          isJoined,
          creator_id: group.creator_id
        };
      });

      return res.json({ success: true, groups: groupsWithStatus });
    } catch (err: any) {
      console.error('[Community Groups Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch study groups' });
    }
  });

  /**
   * POST /api/community/groups
   * Allows an authenticated user to create a new study group
   */
  app.post('/api/community/groups', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { name, description, tag, image } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      const now = new Date().toISOString();
      const newGroup: GroupRecord = {
        id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        name: name.trim(),
        description: (description || 'Collaborative university study hub.').trim(),
        image: image || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80',
        tag: (tag || 'General').trim(),
        base_members: 1,
        creator_id: authUser.id,
        created_at: now
      };

      try {
        await supabaseClient.from('community_groups').insert([{
          id: newGroup.id,
          name: newGroup.name,
          description: newGroup.description,
          image: newGroup.image,
          tag: newGroup.tag,
          base_members: 1,
          creator_id: authUser.id,
          created_at: now
        }]);
      } catch (sbErr) {}

      db.groups.unshift(newGroup);
      db.group_members.push({
        group_id: newGroup.id,
        user_id: authUser.id,
        joined_at: now
      });
      saveDatabase();

      return res.status(201).json({
        success: true,
        group: {
          ...newGroup,
          members: 1,
          isJoined: true
        }
      });
    } catch (err: any) {
      console.error('[Community Group Create Error]', err);
      return res.status(500).json({ error: 'Failed to create study group' });
    }
  });

  /**
   * POST /api/community/groups/:id/join
   * Toggles membership in a study group for the authenticated user
   */
  app.post('/api/community/groups/:id/join', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: groupId } = req.params;

      const group = db.groups.find(g => g.id === groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const existingIndex = db.group_members.findIndex(
        m => m.group_id === groupId && m.user_id === authUser.id
      );

      let isJoined = false;
      if (existingIndex > -1) {
        db.group_members.splice(existingIndex, 1);
        isJoined = false;
        try {
          await supabaseClient.from('community_group_members').delete().match({ group_id: groupId, user_id: authUser.id });
        } catch (sbErr) {}
      } else {
        db.group_members.push({
          group_id: groupId,
          user_id: authUser.id,
          joined_at: new Date().toISOString()
        });
        isJoined = true;
        try {
          await supabaseClient.from('community_group_members').insert([{ group_id: groupId, user_id: authUser.id }]);
        } catch (sbErr) {}
      }

      saveDatabase();

      const memberCount = (group.base_members || 1) + db.group_members.filter(m => m.group_id === groupId).length;
      return res.json({ success: true, isJoined, members: memberCount });
    } catch (err: any) {
      console.error('[Community Group Join Toggle Error]', err);
      return res.status(500).json({ error: 'Failed to update group membership' });
    }
  });

  // ====================================================================
  // 4. DIRECT CHAT THREADS & MESSAGING ENDPOINTS
  // ====================================================================

  /**
   * GET /api/community/chats
   * Returns list of direct conversation threads involving the authenticated user
   */
  app.get('/api/community/chats', requireAuth, (req, res) => {
    try {
      const authUser = (req as any).authUser;

      // Filter chats where authenticated user is a participant
      const userChats = db.chats.filter(c =>
        c.participants.some(p => p.user_id === authUser.id || p.user_name === authUser.name)
      );

      const formattedChats = userChats.map(chat => {
        // Resolve the other peer participant
        const peer = chat.participants.find(p => p.user_id !== authUser.id && p.user_name !== authUser.name) ||
          chat.participants[0] || {
            user_id: 'unknown',
            user_name: 'Peer Scholar',
            user_avatar: 'https://picsum.photos/100/100',
            user_role: 'Student'
          };

        // Compute unread message count for this user
        const unreadCount = db.messages.filter(m =>
          m.chat_id === chat.id &&
          m.sender_id !== authUser.id &&
          m.sender_name !== authUser.name &&
          m.status !== 'read'
        ).length;

        return {
          id: chat.id,
          user: {
            id: peer.user_id,
            name: peer.user_name,
            avatar: peer.user_avatar,
            online: true,
            role: peer.user_role
          },
          lastMessage: chat.last_message || 'Active academic discussion',
          time: formatRelativeTime(chat.updated_at),
          unread: unreadCount
        };
      });

      // Sort by recent activity
      formattedChats.sort((a, b) => {
        const chatA = userChats.find(c => c.id === a.id);
        const chatB = userChats.find(c => c.id === b.id);
        return new Date(chatB?.updated_at || 0).getTime() - new Date(chatA?.updated_at || 0).getTime();
      });

      return res.json({ success: true, chats: formattedChats });
    } catch (err: any) {
      console.error('[Community Chats Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  /**
   * POST /api/community/chats
   * Finds or initiates a direct chat conversation between authenticated user and another peer
   */
  app.post('/api/community/chats', requireAuth, (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { targetUser } = req.body;

      if (!targetUser || !targetUser.name) {
        return res.status(400).json({ error: 'Target user information is required' });
      }

      // CRITICAL: A user must never be able to message themselves!
      if (targetUser.name === authUser.name || (targetUser.id && targetUser.id === authUser.id)) {
        return res.status(400).json({ error: 'You cannot direct message yourself' });
      }

      // Check for existing conversation with this peer
      let chat = db.chats.find(c =>
        c.participants.some(p => p.user_id === authUser.id || p.user_name === authUser.name) &&
        c.participants.some(p => p.user_name === targetUser.name || (targetUser.id && p.user_id === targetUser.id))
      );

      if (!chat) {
        const now = new Date().toISOString();
        chat = {
          id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          participants: [
            {
              user_id: authUser.id,
              user_name: authUser.name,
              user_avatar: authUser.avatar,
              user_role: authUser.role
            },
            {
              user_id: targetUser.id || `peer-${Date.now()}`,
              user_name: targetUser.name,
              user_avatar: targetUser.avatar,
              user_role: targetUser.role || 'Student'
            }
          ],
          last_message: 'Conversation started',
          updated_at: now
        };

        db.chats.unshift(chat);
        saveDatabase();
      }

      return res.status(200).json({
        success: true,
        chat: {
          id: chat.id,
          user: {
            id: targetUser.id,
            name: targetUser.name,
            avatar: targetUser.avatar,
            online: true,
            role: targetUser.role
          },
          lastMessage: chat.last_message,
          time: 'Just now',
          unread: 0
        }
      });
    } catch (err: any) {
      console.error('[Community Chat Init Error]', err);
      return res.status(500).json({ error: 'Failed to initiate direct chat' });
    }
  });

  /**
   * GET /api/community/chats/:id/messages
   * Returns ordered messages for a chat thread and marks unread messages as read
   */
  app.get('/api/community/chats/:id/messages', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: chatId } = req.params;

      const chat = db.chats.find(c => c.id === chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Verify that requesting user is a participant in this conversation
      const isParticipant = chat.participants.some(
        p => p.user_id === authUser.id || p.user_name === authUser.name
      );
      if (!isParticipant) {
        return res.status(403).json({ error: 'Forbidden: You are not a participant in this chat' });
      }

      // Mark incoming messages as read
      db.messages
        .filter(m => m.chat_id === chatId && m.sender_id !== authUser.id && m.status !== 'read')
        .forEach(m => { m.status = 'read'; });
      saveDatabase();

      // Attempt to load live messages from Supabase
      try {
        const { data: sbMessages } = await supabaseClient
          .from('community_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (sbMessages && sbMessages.length > 0) {
          // Sync any new messages into in-memory db
          sbMessages.forEach((sm: any) => {
            if (!db.messages.some(m => m.id === sm.id)) {
              db.messages.push({
                id: sm.id,
                chat_id: sm.chat_id,
                sender_id: sm.sender_id,
                sender_name: sm.sender_name,
                text: sm.text,
                type: sm.type || 'text',
                attachment: sm.attachment,
                status: sm.status || 'delivered',
                created_at: sm.created_at
              });
            }
          });
          saveDatabase();
        }
      } catch (sbErr) {
        // Fallback to in-memory db
      }

      const chatMessages = db.messages
        .filter(m => m.chat_id === chatId)
        .map(msg => ({
          id: msg.id,
          senderId: (msg.sender_id === authUser.id || msg.sender_name === authUser.name) ? 'me' : 'other',
          senderName: msg.sender_name,
          text: msg.text,
          time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: msg.status,
          type: msg.type,
          attachment: msg.attachment
        }));

      return res.json({ success: true, messages: chatMessages });
    } catch (err: any) {
      console.error('[Community Messages Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  /**
   * POST /api/community/chats/:id/messages
   * Sends a new message in a chat thread and persists to Supabase
   */
  app.post('/api/community/chats/:id/messages', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { id: chatId } = req.params;
      const { text, type, attachment } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Message text cannot be empty' });
      }

      const chat = db.chats.find(c => c.id === chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Verify that requesting user is a participant
      const isParticipant = chat.participants.some(
        p => p.user_id === authUser.id || p.user_name === authUser.name
      );
      if (!isParticipant) {
        return res.status(403).json({ error: 'Forbidden: You cannot send messages in this chat' });
      }

      const now = new Date().toISOString();
      const newMsg: MessageRecord = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        chat_id: chatId,
        sender_id: authUser.id,
        sender_name: authUser.name,
        text: text.trim(),
        type: type || 'text',
        attachment: attachment || undefined,
        status: 'delivered',
        created_at: now
      };

      db.messages.push(newMsg);
      chat.last_message = newMsg.text;
      chat.updated_at = now;
      saveDatabase();

      // Permanently persist to Supabase community_messages table
      try {
        await supabaseClient.from('community_messages').insert({
          id: newMsg.id,
          chat_id: chatId,
          sender_id: authUser.id,
          sender_name: authUser.name,
          text: newMsg.text,
          type: newMsg.type,
          attachment: newMsg.attachment || null,
          status: newMsg.status,
          created_at: now
        });
      } catch (sbMsgErr) {
        console.warn('[Community Messages] Notice inserting into Supabase community_messages:', sbMsgErr);
      }

      return res.status(201).json({
        success: true,
        message: {
          id: newMsg.id,
          senderId: 'me',
          senderName: newMsg.sender_name,
          text: newMsg.text,
          time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: newMsg.status,
          type: newMsg.type,
          attachment: newMsg.attachment
        }
      });
    } catch (err: any) {
      console.error('[Community Message Send Error]', err);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // ====================================================================
  // 5. CONNECTIONS ENDPOINTS (PREVENTS SELF-FOLLOW)
  // ====================================================================

  /**
   * GET /api/community/connections
   * Returns peer connection statuses and real connection counts for the authenticated user
   */
  app.get('/api/community/connections', requireAuth, (req, res) => {
    try {
      const authUser = (req as any).authUser;

      const userConns = db.connections.filter(c => c.user_id === authUser.id);
      const connectionMap: Record<string, boolean> = {};
      userConns.forEach(c => {
        connectionMap[c.target_user_name] = true;
        if (c.target_user_id) {
          connectionMap[c.target_user_id] = true;
        }
      });

      // Compute exact real connections count for all community users
      const connectionCounts: Record<string, number> = {};
      db.connections.forEach(c => {
        // Person who connected
        connectionCounts[c.user_id] = (connectionCounts[c.user_id] || 0) + 1;
        // Target recipient
        connectionCounts[c.target_user_name] = (connectionCounts[c.target_user_name] || 0) + 1;
        if (c.target_user_id) {
          connectionCounts[c.target_user_id] = (connectionCounts[c.target_user_id] || 0) + 1;
        }
      });

      // Real connection count for current user
      const myCount = connectionCounts[authUser.id] || connectionCounts[authUser.name] || 0;

      return res.json({ 
        success: true, 
        connections: connectionMap,
        connectionCounts,
        myCount 
      });
    } catch (err: any) {
      console.error('[Community Connections Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch connections' });
    }
  });

  /**
   * POST /api/community/connections
   * Toggles connection with a peer for the authenticated user
   */
  app.post('/api/community/connections', requireAuth, (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { targetName, targetId } = req.body;

      if (!targetName) {
        return res.status(400).json({ error: 'Target user name required' });
      }

      // CRITICAL: A user must never be able to connect/follow themselves!
      if (targetName === authUser.name || (targetId && targetId === authUser.id)) {
        return res.status(400).json({ error: 'You cannot connect with yourself' });
      }

      const existingIndex = db.connections.findIndex(
        c => c.user_id === authUser.id && (c.target_user_name === targetName || (targetId && c.target_user_id === targetId))
      );

      let isConnected = false;
      if (existingIndex > -1) {
        db.connections.splice(existingIndex, 1);
        isConnected = false;
      } else {
        db.connections.push({
          user_id: authUser.id,
          target_user_name: targetName,
          target_user_id: targetId,
          created_at: new Date().toISOString()
        });
        isConnected = true;
      }

      saveDatabase();

      // Compute total real connections targeting or involving this target user
      const targetCount = db.connections.filter(c => 
        c.target_user_name === targetName || (targetId && c.target_user_id === targetId) || (targetId && c.user_id === targetId)
      ).length;

      // Compute total real connections for authenticated user
      const myCount = db.connections.filter(c => 
        c.user_id === authUser.id || c.target_user_name === authUser.name || c.target_user_id === authUser.id
      ).length;

      return res.json({ 
        success: true, 
        isConnected, 
        connectionCount: targetCount,
        myCount 
      });
    } catch (err: any) {
      console.error('[Community Connection Toggle Error]', err);
      return res.status(500).json({ error: 'Failed to toggle connection' });
    }
  });

  // ====================================================================
  // 6. REAL SUPABASE USERS DIRECTORY
  // ====================================================================

  /**
   * GET /api/community/users
   * Returns active community users and registered peers from Supabase profiles
   */
  app.get('/api/community/users', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const userMap = new Map<string, any>();

      // 1. Fetch real registered users from Supabase profiles table
      try {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('*');

        if (profiles && Array.isArray(profiles)) {
          profiles.forEach((p: any) => {
            const name = p.full_name || 'Academic Scholar';
            userMap.set(p.id, {
              id: p.id,
              name,
              avatar: p.avatar_url || '',
              role: p.major || p.department || 'Student',
              bio: p.bio || 'Dedicated scholar collaborating on Studibl.',
              banner: p.banner_url || '',
              department: p.department || p.major || 'General',
              online: p.id === authUser.id
            });
          });
        }
      } catch (err) {
        console.warn('[Community Users] Notice querying profiles:', err);
      }

      // 2. Add current authenticated user with full Supabase details
      userMap.set(authUser.id, {
        id: authUser.id,
        name: authUser.name,
        avatar: authUser.avatar,
        role: authUser.role,
        bio: authUser.bio,
        banner: authUser.banner,
        academicLevel: authUser.academicLevel,
        department: authUser.department,
        online: true
      });

      // 3. Collect any other post authors from the database
      db.posts.forEach(p => {
        if (!userMap.has(p.author_id)) {
          userMap.set(p.author_id, {
            id: p.author_id,
            name: p.author_name,
            avatar: p.author_avatar,
            role: p.author_role,
            bio: p.author_bio || 'Dedicated scholar collaborating on Studibl.',
            online: false
          });
        }
      });

      return res.json({ success: true, users: Array.from(userMap.values()) });
    } catch (err: any) {
      console.error('[Community Users Fetch Error]', err);
      return res.status(500).json({ error: 'Failed to fetch community users' });
    }
  });

  // ====================================================================
  // 7. USER PROFILE PERSISTENCE TO SUPABASE
  // ====================================================================

  /**
   * PUT /api/community/profile
   * Updates bio, avatar, banner, or academic info in Supabase
   */
  app.put('/api/community/profile', requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { bio, avatar, banner, name, role, academicLevel, department } = req.body;

      // Update Supabase profiles table
      try {
        await supabaseClient.from('profiles').upsert({
          id: authUser.id,
          full_name: name || authUser.name,
          avatar_url: avatar || authUser.avatar,
          major: role || authUser.role,
          bio: bio !== undefined ? bio : authUser.bio,
          banner_url: banner !== undefined ? banner : authUser.banner,
          academic_level: academicLevel || authUser.academicLevel,
          department: department || authUser.department,
          updated_at: new Date().toISOString()
        });
      } catch (sbErr) {
        console.warn('[Community Profile Update] Notice updating profiles table:', sbErr);
      }

      // Update in-memory and disk records for this user across posts, comments, chats
      db.posts.forEach(p => {
        if (p.author_id === authUser.id) {
          if (name) p.author_name = name;
          if (avatar) p.author_avatar = avatar;
          if (role) p.author_role = role;
          if (bio !== undefined) p.author_bio = bio;
        }
      });

      db.comments.forEach(c => {
        if (c.author_id === authUser.id) {
          if (name) c.author_name = name;
          if (avatar) c.author_avatar = avatar;
        }
      });

      db.chats.forEach(ch => {
        const p = ch.participants.find(part => part.user_id === authUser.id);
        if (p) {
          if (name) p.user_name = name;
          if (avatar) p.user_avatar = avatar;
          if (role) p.user_role = role;
        }
      });

      saveDatabase();

      return res.json({
        success: true,
        user: {
          id: authUser.id,
          name: name || authUser.name,
          avatar: avatar || authUser.avatar,
          banner: banner || authUser.banner,
          bio: bio !== undefined ? bio : authUser.bio,
          role: role || authUser.role,
          academicLevel: academicLevel || authUser.academicLevel,
          department: department || authUser.department
        }
      });
    } catch (err: any) {
      console.error('[Community Profile Update Error]', err);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  console.log('[Community Routes] Successfully registered all /api/community routes on server.');
}
