import { supabase } from '../supabaseClient';

/**
 * ====================================================================
 * STUDIBL SECURE SUPABASE DATA-LAYER PERSISTENCE SERVICE
 * Handles modular CRUD querying for all 24 database tables mapped in
 * Phase 2, with fully customized row integrations and safe offline
 * fallback patterns for academic, chat, streak, and referral contexts.
 * ====================================================================
 */

// Helper to determine if a user ID is a valid Postgres physical UUID
export function isRealUserSession(userId?: string): boolean {
  if (!userId || userId === 'sandbox-guest-id') return false;
  // A standard UUID is 36 characters long with hyphens
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}


// ==========================================
// 1. USER ACADEMIC PROFILES
// ==========================================

export async function getProfile(userId: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.warn('Notice: profiles query for user:', error.message || error);
    return null;
  }
  return data;
}

export async function updateProfile(userId: string, updates: { full_name?: string; avatar_url?: string; major?: string; contact_number?: string }) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating profiles on Supabase:', error);
    throw error;
  }
  return data;
}


// ==========================================
// 2. STUDY STATISTICS & MASTERIES
// ==========================================

export async function getUserStats(userId: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.warn('Notice: user stats query:', error.message || error);
    return null;
  }
  return data;
}

/**
 * Persists high-level user statistics to Supabase `user_stats` table.
 * All numeric metric counters (XP, question counts, study minutes) are strictly rounded
 * to whole integers using Math.round to comply with PostgreSQL integer column constraints
 * and prevent syntax errors (code 22P02) caused by fractional values.
 */
export async function saveUserStats(userId: string, stats: { 
  total_xp: number; 
  total_questions_answered: number; 
  correct_answers_value: number; 
  quiz_count: number; 
  exam_count: number; 
  total_study_minutes: number; 
  subjects: any;
  performance_metrics: any;
}) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: userId,
      total_xp: Math.round(Number(stats.total_xp) || 0),
      total_questions_answered: Math.round(Number(stats.total_questions_answered) || 0),
      correct_answers_value: Math.round(Number(stats.correct_answers_value) || 0),
      quiz_count: Math.round(Number(stats.quiz_count) || 0),
      exam_count: Math.round(Number(stats.exam_count) || 0),
      total_study_minutes: Math.round(Number(stats.total_study_minutes) || 0),
      subjects: stats.subjects,
      performance_metrics: stats.performance_metrics,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving user stats:', error);
    throw error;
  }
  return data;
}


// ==========================================
// 3. STUDY PROGRESS HISTORY
// ==========================================

export async function getProgressHistory(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('study_progress_history')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching progress history:', error);
    return [];
  }
  return data;
}

export async function saveProgressHistoryItem(userId: string, item: { date: string; xp: number; accuracy: number; study_minutes: number }) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('study_progress_history')
    .upsert({
      user_id: userId,
      date: item.date,
      xp: Math.round(Number(item.xp) || 0),
      accuracy: Math.round((Number(item.accuracy) || 0) * 100) / 100,
      study_minutes: Math.round(Number(item.study_minutes) || 0)
    }, {
      onConflict: 'user_id,date'
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting progress history item:', error);
  }
  return data;
}


// ==========================================
// 4. ACHIEVEMENT BADGES
// ==========================================

export async function getAwardedBadges(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('awarded_badges')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error loading awarded badges from Supabase:', error);
    return [];
  }
  return data;
}

export async function saveAwardedBadge(userId: string, award: { badgeId: string; awardedAt: string; reason: string }) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('awarded_badges')
    .upsert({
      user_id: userId,
      badge_id: award.badgeId,
      awarded_at: award.awardedAt,
      reason: award.reason
    }, {
      onConflict: 'user_id,badge_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving badge to Supabase:', error);
  }
  return data;
}

export async function clearAwardedBadges(userId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('awarded_badges')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing awarded badges:', error);
  }
}


// ==========================================
// 5. DAILY ACTIVITY / MISSION LOGS
// ==========================================

export async function getMissionLogs(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('mission_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching mission logs:', error);
    return [];
  }
  return data;
}

export async function saveMissionLog(userId: string, log: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('mission_logs')
    .upsert({
      id: log.id,
      user_id: userId,
      title: log.title,
      type: log.type,
      score: Math.round(Number(log.score) || 0),
      total: Math.round(Number(log.total) || 0),
      accuracy: Math.round((Number(log.accuracy) || 0) * 100) / 100,
      time_spent_seconds: Math.round(Number(log.timeSpentSeconds ?? log.time_spent_seconds) || 0),
      xp_gained: Math.round(Number(log.xpGained ?? log.xp_gained) || 0),
      date: log.date,
      is_exam: log.isExam || log.is_exam || false,
      is_perfect: log.isPerfect || log.is_perfect || false,
      is_high_score: log.isHighScore || log.is_high_score || false,
      is_fastest: log.isFastest || log.is_fastest || false,
      status: log.status,
      redeemed: log.redeemed || false,
      subject: log.subject
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving mission log:', error);
  }
  return data;
}


// ==========================================
// 6. USER PLAN PLANNED MISSIONS
// ==========================================

export async function getUserMissions(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('user_missions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error loading user missions:', error);
    return [];
  }
  return data;
}

export async function saveUserMission(userId: string, mission: any) {
  if (!isRealUserSession(userId)) return null;
  // Guard against saving static demo/mock missions to user's database
  if (['1', '2', '3', '4'].includes(String(mission.id))) {
    return null;
  }
  const { data, error } = await supabase
    .from('user_missions')
    .upsert({
      id: mission.id,
      user_id: userId,
      title: mission.title,
      duration: mission.duration,
      status: mission.status,
      type: mission.type,
      course_id: mission.courseId || mission.course_id,
      topic: mission.topic,
      updated_at: mission.updatedAt || mission.updated_at,
      metadata: mission.metadata || {}
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      console.warn('Notice: RLS policy prevented mission save:', error.message);
      return null;
    }
    console.error('Error saving user mission:', error);
  }
  return data;
}


// ==========================================
// 7. LECTURE MATERIAL & VIDEOS
// ==========================================

export async function getLectures(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('lectures')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error matching lectures:', error);
    return [];
  }
  return data;
}

export async function saveLecture(userId: string, lecture: any) {
  if (!isRealUserSession(userId)) return null;
  // Guard against syncing mock lectures or non-user items
  if (!lecture.isMine || ['1', '2', '3', '4'].includes(String(lecture.id))) {
    return null;
  }
  const { data, error } = await supabase
    .from('lectures')
    .upsert({
      id: lecture.id,
      user_id: userId,
      type: lecture.type,
      title: lecture.title,
      course: lecture.course,
      date: lecture.date,
      duration: lecture.duration,
      size: lecture.size,
      thumbnail: lecture.thumbnail,
      url: lecture.url,
      video_url: lecture.video_url || lecture.videoUrl,
      is_mine: lecture.isMine || lecture.is_mine || false,
      fill_in_the_blanks: lecture.fillInTheBlanks || lecture.fill_in_the_blanks || [],
      extracted_youtube_metadata: lecture.extractedYoutubeMetadata || lecture.extracted_youtube_metadata || false,
      channel: lecture.channel,
      ai_context_analysis: lecture.aiContextAnalysis || lecture.ai_context_analysis,
      ai_insights: lecture.aiInsights || lecture.ai_insights || {}
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      console.warn('Notice: RLS policy prevented lecture save:', error.message);
      return null;
    }
    console.error('Error saving lecture details:', error);
    return null;
  }
  return data;
}

export async function deleteLecture(userId: string, lectureId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('lectures')
    .delete()
    .eq('id', lectureId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting lecture from Supabase:', error);
  }
}


// ==========================================
// 8. LECTURE BINARY BLOB CHUNKS (fileStorage alternate)
// ==========================================

export async function getLectureFile(userId: string, id: string): Promise<{ file_base64: string; mime_type: string } | null> {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('lecture_files')
    .select('file_base64, mime_type')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.warn(`Notice: lecture files ${id}:`, error.message || error);
    return null;
  }
  return data;
}

export async function saveLectureFile(userId: string, id: string, base64Data: string, mimeType?: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('lecture_files')
    .upsert({
      id,
      user_id: userId,
      file_base64: base64Data,
      mime_type: mimeType
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing base64 file block on Supabase:', error);
  }
  return data;
}

export async function deleteLectureFile(userId: string, id: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('lecture_files')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting file:', error);
  }
}


// ==========================================
// 9. CHAT CONVERSATIONS & SESSIONS
// ==========================================

export async function getChatSessions(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_update', { ascending: false });

  if (error) {
    console.error('Error loading chat sessions:', error);
    return [];
  }
  return data;
}

export async function getChatMessagesForSessions(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error matching messages:', error);
    return [];
  }
  return data;
}

export async function saveChatSession(userId: string, session: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('chat_sessions')
    .upsert({
      id: session.id,
      user_id: userId,
      title: session.title,
      date: session.date,
      last_update: session.lastUpdate || session.last_update,
      draft_input: session.draftInput || session.draft_input || '',
      scroll_position: session.scrollPosition || session.scroll_position || 0
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      console.warn('Notice: RLS policy prevented chat session save:', error.message);
      return null;
    }
    console.error('Error saving chat session:', error);
  }
  return data;
}

export async function saveChatMessage(userId: string, sessionId: string, msg: any) {
  if (!isRealUserSession(userId)) return null;
  // Never attempt to sync the client-side welcome message to Supabase
  if (msg.id === 'welcome-message') {
    return null;
  }
  const { data, error } = await supabase
    .from('chat_messages')
    .upsert({
      id: msg.id,
      session_id: sessionId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
      attached_files: msg.attachedFiles || msg.attached_files || [],
      explanation: msg.explanation || null,
      quiz: msg.quiz || null,
      analysis: msg.analysis || null,
      feedback: msg.feedback || null
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      console.warn('Notice: RLS policy prevented chat message save:', error.message);
      return null;
    }
    console.error('Error writing message:', error);
  }
  return data;
}

export async function deleteChatSession(userId: string, sessionId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    if (error.code === '42501') return;
    console.error('Error deleting session:', error);
  }
}


// ==========================================
// 10. SAVED AI CONTENT SUMMARY BOOKMARKS
// ==========================================

export async function getSavedAIContent(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('saved_ai_content')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading AI summary bookmarks:', error);
    return [];
  }
  return data;
}

export async function saveAIContent(userId: string, item: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('saved_ai_content')
    .upsert({
      id: item.id,
      user_id: userId,
      message_id: item.messageId || item.message_id,
      title: item.title,
      content: item.content,
      type: item.type,
      timestamp: item.timestamp,
      session_title: item.sessionTitle || item.session_title,
      metadata: item.metadata || {}
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      console.warn('Notice: RLS policy prevented AI content save:', error.message);
      return null;
    }
    console.error('Error saving AI content shortcut:', error);
  }
  return data;
}

export async function deleteAIContent(userId: string, id: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('saved_ai_content')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting saved AI content:', error);
  }
}


// ==========================================
// 11. LOGIN CONSISTENCY STREAKS
// ==========================================

export async function getLoginDates(userId: string): Promise<string[]> {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('user_login_dates')
    .select('login_date')
    .eq('user_id', userId);

  if (error) {
    console.error('Error getting login dates:', error);
    return [];
  }
  return (data || []).map(row => row.login_date);
}

export async function saveLoginDate(userId: string, loginDate: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('user_login_dates')
    .upsert({
      user_id: userId,
      login_date: loginDate
    }, {
      onConflict: 'user_id,login_date'
    })
    .select()
    .single();

  if (error) {
    // Unique violation can be ignored since date is already recorded, but log other issues
    if (!error.message.includes('duplicate key')) {
      console.error('Error indexing login event on Supabase:', error);
    }
  }
  return data;
}


// ==========================================
// 12. REFERRAL PROGRAM ENGINE
// ==========================================

export async function getReferralConfig(userId: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('referral_configs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.warn('Notice: referral config not found:', error.message || error);
    return null;
  }
  return data;
}

export async function saveReferralConfig(userId: string, config: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('referral_configs')
    .upsert({
      user_id: userId,
      commission_percentage: config.commissionPercentage || config.commission_percentage,
      subscription_price: config.subscriptionPrice || config.subscription_price,
      min_withdrawal_threshold: config.minWithdrawalThreshold || config.min_withdrawal_threshold,
      multi_tier_enabled: config.multiTierEnabled || config.multi_tier_enabled,
      second_tier_percentage: config.secondTierPercentage || config.second_tier_percentage
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating config on Supabase:', error);
  }
  return data;
}

export async function getReferrals(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error loader referrals:', error);
    return [];
  }
  return data;
}

export async function saveReferral(userId: string, referral: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('referrals')
    .upsert({
      id: referral.id,
      user_id: userId,
      name: referral.name,
      email: referral.email,
      status: referral.status,
      date_created: referral.dateCreated || referral.date_created,
      last_updated: referral.lastUpdated || referral.last_updated,
      clicks_count: referral.clicksCount || referral.clicks_count || 0,
      first_time_commission_of: referral.firstTimeCommissionOf || referral.first_time_commission_of || 0,
      recurring_commission_of: referral.recurringCommissionOf || referral.recurring_commission_of || 0,
      total_payments_completed: referral.totalPaymentsCompleted || referral.total_payments_completed || 0,
      fraud_score: referral.fraudScore || referral.fraud_score || 0,
      ip_address: referral.ipAddress || referral.ip_address,
      is_flagged: referral.isFlagged || referral.is_flagged || false
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving referral user:', error);
  }
  return data;
}

export async function getPayoutDetails(userId: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('payout_details')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.warn('Notice: payout details not configured:', error.message || error);
    return null;
  }
  return data;
}

export async function savePayoutDetails(userId: string, details: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('payout_details')
    .upsert({
      user_id: userId,
      bank_name: details.bankName || details.bank_name,
      account_number: details.accountNumber || details.account_number,
      account_name: details.accountName || details.account_name,
      payout_method: details.payoutMethod || details.payout_method
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving payout info:', error);
  }
  return data;
}

export async function getPayoutItems(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('payout_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading payout history:', error);
    return [];
  }
  return data;
}

export async function savePayoutItem(userId: string, payout: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('payout_items')
    .upsert({
      id: payout.id,
      user_id: userId,
      amount: payout.amount,
      date_requested: payout.dateRequested || payout.date_requested,
      date_processed: payout.dateProcessed || payout.date_processed,
      method: payout.method,
      status: payout.status,
      reference: payout.reference
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving payout history log:', error);
  }
  return data;
}

export async function getReferralTransactions(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('referral_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return data;
}

export async function saveReferralTransaction(userId: string, tx: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('referral_transactions')
    .upsert({
      id: tx.id,
      user_id: userId,
      referred_user_id: tx.referredUserId || tx.referred_user_id,
      referred_user_name: tx.referredUserName || tx.referred_user_name,
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      timestamp: tx.timestamp,
      notes: tx.notes
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing referral transaction:', error);
  }
  return data;
}

export async function getAuditLogs(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error matching security audit logs:', error);
    return [];
  }
  return data;
}

export async function saveAuditLog(userId: string, log: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('audit_logs')
    .upsert({
      id: log.id,
      user_id: userId,
      timestamp: log.timestamp,
      action: log.action,
      details: log.details,
      category: log.category,
      severity: log.severity
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging audit sequence:', error);
  }
  return data;
}


// ==========================================
// 13. MATERIAL LEARNING PROGRESS (Doc & Video)
// ==========================================

export async function getDocumentProgress(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('document_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error getting document progresses:', error);
    return [];
  }
  return data;
}

export async function saveDocumentProgress(userId: string, docId: string, progress: { percentage: number; lastUnitId?: string; consumedUnitIds: string[]; maxTotalUnits: number }) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('document_progress')
    .upsert({
      id: docId,
      user_id: userId,
      percentage: Math.round(Number(progress.percentage) || 0),
      last_unit_id: progress.lastUnitId || null,
      consumed_unit_ids: progress.consumedUnitIds,
      max_total_units: Math.round(Number(progress.maxTotalUnits) || 0),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error indexing doc progress:', error);
  }
  return data;
}

export async function getVideoProgress(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('video_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error loading video segments progress:', error);
    return [];
  }
  return data;
}

export async function saveVideoProgress(userId: string, videoId: string, progress: { watchedSegments: [number, number][]; progress: number; lastPosition: number }) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('video_progress')
    .upsert({
      video_id: videoId,
      user_id: userId,
      watched_segments: progress.watchedSegments,
      progress: Math.round(Number(progress.progress) || 0),
      last_position: Number(progress.lastPosition) || 0,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating video progress segment tracking page:', error);
  }
  return data;
}


// ==========================================
// 14. MATERIAL MODIFIERS (Overrides & Deletes)
// ==========================================

export async function getLectureOverrides(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('lecture_overrides')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching lecture overrides from Supabase:', error);
    return [];
  }
  return data;
}

export async function saveLectureOverride(userId: string, lectureId: string, updates: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('lecture_overrides')
    .upsert({
      lecture_id: lectureId,
      user_id: userId,
      updates
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting lecture override metrics:', error);
  }
  return data;
}

export async function getRemovedLectures(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('removed_lectures')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching deleted lectures array:', error);
    return [];
  }
  return (data || []).map(row => row.lecture_id);
}

export async function saveRemovedLecture(userId: string, lectureId: string) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('removed_lectures')
    .upsert({
      lecture_id: lectureId,
      user_id: userId
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving deleted lecture pointer:', error);
  }
  return data;
}

export async function getRecentCourses(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('recent_courses')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error listing recent courses:', error);
    return [];
  }
  return data;
}

export async function saveRecentCourse(userId: string, courseName: string, lastActive: number) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('recent_courses')
    .upsert({
      course_name: courseName,
      user_id: userId,
      last_active: lastActive
    })
    .select()
    .single();

  if (error) {
    console.error('Error indexing course recent duration active:', error);
  }
  return data;
}


// ==========================================
// 15. BROADCAST SYSTEM NOTIFICATIONS
// ==========================================

export async function getUserNotifications(userId: string) {
  if (!isRealUserSession(userId)) return [];
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading alerts:', error);
    return [];
  }
  return data;
}

export async function saveUserNotification(userId: string, nStr: any) {
  if (!isRealUserSession(userId)) return null;
  const { data, error } = await supabase
    .from('user_notifications')
    .upsert({
      id: nStr.id,
      user_id: userId,
      title: nStr.title,
      message: nStr.message,
      time: nStr.time,
      type: nStr.type,
      read: nStr.read || false
    })
    .select()
    .single();

  if (error) {
    console.error('Error posting push notification row:', error);
  }
  return data;
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('user_notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error flagging alert read:', error);
  }
}

export async function deleteUserNotification(userId: string, notificationId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting user notification:', error);
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('user_notifications')
    .update({ read: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

export async function clearAllUserNotifications(userId: string) {
  if (!isRealUserSession(userId)) return;
  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing all user notifications:', error);
  }
}


// ==========================================
// 16. COMMUNITY & SOCIAL PERSISTENCE SERVICE
// ==========================================

export interface CommunityPostData {
  id: string;
  author: {
    id?: string;
    name: string;
    avatar: string;
    role: string;
  };
  content: string;
  likes: number;
  comments: number;
  tags: string[];
  time: string;
  image?: string;
  isLiked: boolean;
}

export interface CommunityCommentData {
  id: string;
  author: {
    id?: string;
    name: string;
    avatar: string;
    role?: string;
  };
  content: string;
  time: string;
  likes: number;
  isLiked?: boolean;
  parentId?: string | null;
  replies?: CommunityCommentData[];
}

export interface CommunityGroupData {
  id: string;
  name: string;
  members: number;
  description: string;
  image: string;
  tag: string;
  isJoined?: boolean;
}

export interface CommunityChatData {
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
 * Fetches all community posts with like statuses and comment counts
 */
export async function fetchCommunityPosts(tag?: string, token?: string): Promise<CommunityPostData[]> {
  try {
    const url = tag && tag !== 'All' ? `/api/community/posts?tag=${encodeURIComponent(tag)}` : '/api/community/posts';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        return data.posts;
      }
    }
  } catch (err) {
    console.warn('Backend API /api/community/posts failed, querying Supabase directly:', err);
  }

  // Direct Supabase fallback
  try {
    let query = supabase
      .from('community_posts')
      .select('*, community_post_likes(user_id)')
      .order('created_at', { ascending: false });

    if (tag && tag !== 'All') {
      query = query.contains('tags', [tag]);
    }

    const { data: posts, error } = await query;
    if (!error && posts) {
      return posts.map((p: any) => ({
        id: p.id,
        author: {
          id: p.user_id,
          name: p.author_name,
          avatar: p.author_avatar || `https://picsum.photos/seed/${encodeURIComponent(p.author_name)}/100/100`,
          role: p.author_role || 'Engineering Student'
        },
        content: p.content,
        likes: p.likes_count || 0,
        comments: p.comments_count || 0,
        tags: p.tags || [],
        time: new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        image: p.image_url || undefined,
        isLiked: false
      }));
    }
  } catch (err) {
    console.error('Supabase direct query failed for posts:', err);
  }

  return [];
}

/**
 * Creates a new community post
 */
export async function createCommunityPost(
  postData: { content: string; tags: string[]; image?: string; authorName?: string; authorAvatar?: string; authorRole?: string },
  token?: string
): Promise<CommunityPostData | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify(postData)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.post) {
        return data.post;
      }
    }
  } catch (err) {
    console.error('Error creating post via backend:', err);
  }
  return null;
}

/**
 * Updates a community post's content
 */
export async function updateCommunityPost(postId: string, content: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content })
    });
    return res.ok;
  } catch (err) {
    console.error('Error updating community post:', err);
    return false;
  }
}

/**
 * Deletes a community post
 */
export async function deleteCommunityPost(postId: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers
    });
    return res.ok;
  } catch (err) {
    console.error('Error deleting community post:', err);
    return false;
  }
}

/**
 * Toggles like on a community post
 */
export async function toggleCommunityPostLike(postId: string, token?: string): Promise<{ isLiked: boolean; likes: number }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers
    });
    if (res.ok) {
      const data = await res.json();
      return { isLiked: data.isLiked, likes: data.likes };
    }
  } catch (err) {
    console.error('Error toggling post like:', err);
  }
  return { isLiked: false, likes: 0 };
}

/**
 * Fetches comments for a specific community post
 */
export async function fetchCommunityComments(postId: string, token?: string): Promise<CommunityCommentData[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.comments)) {
        return data.comments;
      }
    }
  } catch (err) {
    console.error('Error fetching comments:', err);
  }
  return [];
}

/**
 * Creates a comment or reply on a community post
 */
export async function createCommunityComment(
  postId: string,
  data: { content: string; parentId?: string | null; authorName?: string; authorAvatar?: string; authorRole?: string },
  token?: string
): Promise<CommunityCommentData | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.comment) {
        return json.comment;
      }
    }
  } catch (err) {
    console.error('Error posting comment:', err);
  }
  return null;
}

/**
 * Updates a comment's content
 */
export async function updateCommunityComment(commentId: string, content: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content })
    });
    return res.ok;
  } catch (err) {
    console.error('Error editing comment:', err);
    return false;
  }
}

/**
 * Deletes a comment
 */
export async function deleteCommunityComment(commentId: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers
    });
    return res.ok;
  } catch (err) {
    console.error('Error deleting comment:', err);
    return false;
  }
}

/**
 * Toggles like on a comment
 */
export async function toggleCommunityCommentLike(commentId: string, token?: string): Promise<{ isLiked: boolean; likes: number }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}/like`, {
      method: 'POST',
      headers
    });
    if (res.ok) {
      const data = await res.json();
      return { isLiked: data.isLiked, likes: data.likes };
    }
  } catch (err) {
    console.error('Error liking comment:', err);
  }
  return { isLiked: false, likes: 0 };
}

/**
 * Fetches all community groups with membership status for current user
 */
export async function fetchCommunityGroups(token?: string): Promise<CommunityGroupData[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/groups', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        return data.groups;
      }
    }
  } catch (err) {
    console.error('Error fetching groups:', err);
  }
  return [];
}

/**
 * Creates a new community group
 */
export async function createCommunityGroup(
  groupData: { name: string; description: string; image?: string; tag?: string },
  token?: string
): Promise<CommunityGroupData | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/groups', {
      method: 'POST',
      headers,
      body: JSON.stringify(groupData)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.group) {
        return data.group;
      }
    }
  } catch (err) {
    console.error('Error creating group:', err);
  }
  return null;
}

/**
 * Updates authenticated user's community profile (bio, avatar, banner, details)
 */
export async function updateCommunityProfile(
  updates: { bio?: string; avatarUrl?: string; bannerUrl?: string; fullName?: string; major?: string; department?: string; academicLevel?: string },
  token?: string
): Promise<any | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.profile) {
        return data.profile;
      }
    }
  } catch (err) {
    console.error('Error updating profile:', err);
  }
  return null;
}

/**
 * Toggles group membership
 */
export async function toggleCommunityGroupMembership(groupId: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/groups/${encodeURIComponent(groupId)}/toggle-join`, {
      method: 'POST',
      headers
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.isJoined;
    }
  } catch (err) {
    console.error('Error toggling group membership:', err);
  }
  return false;
}

/**
 * Fetches all community users for mentions and peer connections
 */
export async function fetchCommunityUsers(token?: string): Promise<any[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/users', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        return data.users;
      }
    }
  } catch (err) {
    console.error('Error fetching community users:', err);
  }
  return [];
}

/**
 * Toggles connection with a peer user
 */
export async function toggleCommunityUserConnection(targetUserId: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/users/${encodeURIComponent(targetUserId)}/toggle-connect`, {
      method: 'POST',
      headers
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.isConnected;
    }
  } catch (err) {
    console.error('Error toggling connection:', err);
  }
  return false;
}

/**
 * Fetches community direct chats for user
 */
export async function fetchCommunityChats(token?: string): Promise<CommunityChatData[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/chats', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.chats)) {
        return data.chats;
      }
    }
  } catch (err) {
    console.error('Error fetching community chats:', err);
  }
  return [];
}

/**
 * Fetches messages for a chat thread
 */
export async function fetchCommunityChatMessages(chatId: string, token?: string): Promise<any[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/chats/${encodeURIComponent(chatId)}/messages`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        return data.messages;
      }
    }
  } catch (err) {
    console.error('Error fetching chat messages:', err);
  }
  return [];
}

/**
 * Sends a message in a chat thread
 */
export async function sendCommunityChatMessage(
  chatId: string,
  messageData: { text: string; receiverId?: string; type?: string; attachment?: any },
  token?: string
): Promise<any | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/community/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(messageData)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.message) {
        return data.message;
      }
    }
  } catch (err) {
    console.error('Error sending chat message:', err);
  }
  return null;
}

/**
 * Reports a community post, comment, or user
 */
export async function reportCommunityItem(
  itemType: 'post' | 'comment' | 'user',
  itemId: string,
  reason: string,
  token?: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/community/report', {
      method: 'POST',
      headers,
      body: JSON.stringify({ itemType, itemId, reason })
    });
    return res.ok;
  } catch (err) {
    console.error('Error reporting item:', err);
    return false;
  }
}

