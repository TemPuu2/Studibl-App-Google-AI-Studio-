import { supabase } from '../supabaseClient';

/**
 * ====================================================================
 * STUDIBL SECURE COMMUNITY CLIENT SERVICE
 * Communicates with the real backend /api/community routes for
 * authenticated posts, comments, likes, groups, direct chats, and
 * connections, ensuring all operations are tied to the authenticated user.
 * ====================================================================
 */

/**
 * Interface representing author information
 */
export interface Author {
  id?: string;
  name: string;
  avatar: string;
  role?: string;
  bio?: string;
  banner?: string;
  online?: boolean;
}

/**
 * Interface representing a community post received from the backend
 */
export interface CommunityPost {
  id: string;
  author: Author;
  content: string;
  likes: number;
  comments: number;
  tags: string[];
  image?: string | null;
  images?: string[];
  time: string;
  created_at: string;
  isLiked?: boolean;
}

/**
 * Interface representing a comment or reply
 */
export interface CommentItem {
  id: string;
  author: {
    id?: string;
    name: string;
    avatar: string;
  };
  content: string;
  time: string;
  created_at?: string;
  likes: number;
  isLiked?: boolean;
  replies?: CommentItem[];
}

/**
 * Interface representing a study group hub
 */
export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  image: string;
  tag: string;
  members: number;
  isJoined?: boolean;
}

/**
 * Interface representing a direct chat conversation
 */
export interface CommunityChat {
  id: string;
  user: {
    id?: string;
    name: string;
    avatar: string;
    online: boolean;
    role?: string;
  };
  lastMessage: string;
  time: string;
  unread: number;
}

/**
 * Interface representing a chat message
 */
export interface ChatMessage {
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
 * Resolves current session authorization headers for requests
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
      return headers;
    }

    // Check for sandbox session fallback
    if (typeof window !== 'undefined') {
      const sandboxUserRaw = localStorage.getItem('studibl_sandbox_user');
      if (sandboxUserRaw) {
        try {
          const sandboxUser = JSON.parse(sandboxUserRaw);
          headers['Authorization'] = 'Bearer sandbox-token';
          if (sandboxUser.name) headers['x-sandbox-user-name'] = sandboxUser.name;
          if (sandboxUser.email) headers['x-sandbox-user-email'] = sandboxUser.email;
          if (sandboxUser.avatar) headers['x-sandbox-user-avatar'] = sandboxUser.avatar;
          return headers;
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[CommunityService] Could not resolve session token:', err);
  }

  return headers;
}

/**
 * Fetches all community discussion posts with like and comment tallies
 */
export async function fetchCommunityPosts(tag?: string): Promise<CommunityPost[]> {
  const headers = await getAuthHeaders();
  const url = tag && tag !== 'All' ? `/api/community/posts?tag=${encodeURIComponent(tag)}` : '/api/community/posts';

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.posts || [];
}

/**
 * Publishes a new discussion post authored by the authenticated user
 */
export async function createCommunityPost(postData: {
  content: string;
  tags: string[];
  images: string[];
}): Promise<CommunityPost> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify(postData)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create post: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.post;
}

/**
 * Updates an existing post owned by the authenticated user
 */
export async function updateCommunityPost(
  postId: string,
  updates: { content: string; tags?: string[]; images?: string[] }
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update post: HTTP ${res.status}`);
  }
}

/**
 * Deletes a post owned by the authenticated user
 */
export async function deleteCommunityPost(postId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete post: HTTP ${res.status}`);
  }
}

/**
 * Toggles like status on a post for the authenticated user
 */
export async function togglePostLike(postId: string): Promise<{ isLiked: boolean; likes: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to toggle post like: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Fetches comments and nested replies for a post
 */
export async function fetchPostComments(postId: string, sort: 'top' | 'new' = 'top'): Promise<CommentItem[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments?sort=${sort}`, {
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch comments: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.comments || [];
}

/**
 * Adds a new comment or reply to a post
 */
export async function addPostComment(
  postId: string,
  content: string,
  parentId?: string
): Promise<CommentItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, parentId })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to add comment: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.comment;
}

/**
 * Updates a comment or reply owned by the authenticated user
 */
export async function editPostComment(commentId: string, content: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ content })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to edit comment: HTTP ${res.status}`);
  }
}

/**
 * Deletes a comment or reply (authorized for comment author or post owner)
 */
export async function deletePostComment(commentId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete comment: HTTP ${res.status}`);
  }
}

/**
 * Toggles like on a comment or reply for the authenticated user
 */
export async function toggleCommentLike(commentId: string): Promise<{ isLiked: boolean; likes: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}/like`, {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to toggle comment like: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Fetches all academic study groups with live member counts and join status
 */
export async function fetchStudyGroups(): Promise<StudyGroup[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/groups', { headers });

  if (!res.ok) {
    throw new Error(`Failed to fetch groups: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.groups || [];
}

/**
 * Toggles joining or leaving a study group
 */
export async function toggleJoinStudyGroup(groupId: string): Promise<{ isJoined: boolean; members: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to toggle group membership: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Creates a new real study group hub authored by the authenticated user
 */
export async function createStudyGroup(groupData: {
  name: string;
  description: string;
  tag: string;
  image?: string;
}): Promise<StudyGroup> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/groups', {
    method: 'POST',
    headers,
    body: JSON.stringify(groupData)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create group: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.group;
}

/**
 * Updates the authenticated user's profile in Supabase (bio, avatar, banner, etc.)
 */
export async function updateCommunityUserProfile(updates: {
  bio?: string;
  avatar?: string;
  banner?: string;
  name?: string;
  role?: string;
  academicLevel?: string;
  department?: string;
}): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update profile: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.user;
}

/**
 * Fetches the chats where the authenticated user is a participant
 */
export async function fetchCommunityChats(): Promise<CommunityChat[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/chats', { headers });

  if (!res.ok) {
    throw new Error(`Failed to fetch chats: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.chats || [];
}

/**
 * Opens or retrieves an existing direct chat with a peer
 */
export async function openOrCreateChat(targetUser: {
  id?: string;
  name: string;
  avatar: string;
  role?: string;
}): Promise<CommunityChat> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/chats', {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetUser })
  });

  if (!res.ok) {
    throw new Error(`Failed to initialize chat: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.chat;
}

/**
 * Fetches messages in a chat thread
 */
export async function fetchChatMessages(chatId: string): Promise<ChatMessage[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/chats/${encodeURIComponent(chatId)}/messages`, {
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch messages: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.messages || [];
}

/**
 * Sends a message in a chat thread
 */
export async function sendChatMessage(
  chatId: string,
  messageData: { text: string; type?: 'text' | 'image' | 'file'; attachment?: any }
): Promise<ChatMessage> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/community/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(messageData)
  });

  if (!res.ok) {
    throw new Error(`Failed to send message: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.message;
}

/**
 * Response structure for connection data
 */
export interface ConnectionsResponse {
  connections: Record<string, boolean>;
  connectionCounts: Record<string, number>;
  myCount: number;
}

/**
 * Fetches connection states map and counts for authenticated user
 */
export async function fetchConnections(): Promise<Record<string, boolean>> {
  const data = await fetchConnectionsFull();
  return data.connections;
}

/**
 * Fetches full connection metadata including real connection counts
 */
export async function fetchConnectionsFull(): Promise<ConnectionsResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/connections', { headers });

  if (!res.ok) {
    return { connections: {}, connectionCounts: {}, myCount: 0 };
  }

  const data = await res.json();
  return {
    connections: data.connections || {},
    connectionCounts: data.connectionCounts || {},
    myCount: data.myCount || 0
  };
}

/**
 * Toggles peer connection with target user
 */
export async function togglePeerConnection(
  targetName: string,
  targetId?: string
): Promise<{ isConnected: boolean; connectionCount: number; myCount?: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/connections', {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetName, targetId })
  });

  if (!res.ok) {
    throw new Error(`Failed to toggle connection: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Fetches community users for @mentions and profile viewing
 */
export async function fetchCommunityUsers(): Promise<Author[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/community/users', { headers });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.users || [];
}
