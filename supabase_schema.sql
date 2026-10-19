-- ====================================================================
-- STUDIBL FULL BACKEND DATABASE SCHEMA MIGRATION SCRIPT
-- Contains all tables, relationships, constraints, indexes, RLS policies,
-- and automated database triggers for the perfect full-stack integration.
-- ====================================================================

-- Enable UUID generation extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  avatar_url text,
  major text DEFAULT 'Undeclared',
  contact_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. USER STATISTICS TABLE
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  total_xp integer DEFAULT 15600,
  total_questions_answered integer DEFAULT 520,
  correct_answers_value integer DEFAULT 460,
  quiz_count integer DEFAULT 18,
  exam_count integer DEFAULT 3,
  total_study_minutes integer DEFAULT 1540,
  subjects jsonb DEFAULT '{"Logic": 82, "Code": 94, "Math": 72, "Theory": 88, "Security": 68, "Hardware": 54, "Linguistics": 75}'::jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. STUDY PROGRESS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.study_progress_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  date date NOT null,
  xp integer DEFAULT 0,
  accuracy numeric DEFAULT 0,
  study_minutes numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_date_progress UNIQUE (user_id, date)
);

-- 4. AWARDED BADGES TABLE
CREATE TABLE IF NOT EXISTS public.awarded_badges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  badge_id text NOT null,
  awarded_at timestamptz DEFAULT now(),
  reason text,
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

-- 5. DAILY ACTIVITY / MISSION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.mission_logs (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  title text NOT null,
  type text NOT null,
  score integer NOT null,
  total integer NOT null,
  accuracy numeric NOT null,
  time_spent_seconds integer NOT null,
  xp_gained integer NOT null,
  date date NOT null,
  is_exam boolean DEFAULT false,
  is_perfect boolean DEFAULT false,
  is_high_score boolean DEFAULT false,
  is_fastest boolean DEFAULT false,
  status text,
  redeemed boolean DEFAULT false,
  subject text,
  created_at timestamptz DEFAULT now()
);

-- 6. USER CHALLENGES & PLANNED MISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.user_missions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  title text NOT null,
  duration text,
  status text NOT null,
  type text,
  course_id text,
  topic text,
  updated_at bigint NOT null,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 7. LECTURE MATERIAL & VIDEOS TABLE
CREATE TABLE IF NOT EXISTS public.lectures (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- Nullable for standard pre-seeded static courses
  type text NOT null,
  title text NOT null,
  course text NOT null,
  date text,
  duration text,
  size text,
  thumbnail text,
  url text,
  video_url text,
  is_mine boolean DEFAULT false,
  fill_in_the_blanks jsonb DEFAULT '[]'::jsonb,
  extracted_youtube_metadata boolean DEFAULT false,
  channel text,
  ai_context_analysis text,
  ai_insights jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 8. UPLOADED BINARY MATERIALS FILE STORAGE TABLE (IndexedDB equivalent in DB)
CREATE TABLE IF NOT EXISTS public.lecture_files (
  id text REFERENCES public.lectures(id) ON DELETE CASCADE PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  file_base64 text NOT null,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

-- 9. CHAT CONVERSATIONS SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  title text NOT null,
  date text,
  last_update bigint NOT null,
  draft_input text,
  scroll_position numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 10. CHAT MESSAGE DETAILS TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text PRIMARY KEY,
  session_id text REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT null,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  role text NOT null,
  content text NOT null,
  attached_files jsonb DEFAULT '[]'::jsonb,
  explanation jsonb DEFAULT null,
  quiz jsonb DEFAULT null,
  analysis jsonb DEFAULT null,
  feedback jsonb DEFAULT null,
  created_at timestamptz DEFAULT now()
);

-- 11. SAVED AI CONTENT SUMMARY BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.saved_ai_content (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  message_id text,
  title text NOT null,
  content text NOT null,
  type text NOT null,
  timestamp text NOT null,
  session_title text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 12. CONSISTENCY LOGIN STREAKS TABLE
CREATE TABLE IF NOT EXISTS public.user_login_dates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  login_date date NOT null,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_login UNIQUE (user_id, login_date)
);

-- 13. REFERRAL SYSTEM SPECIFIC CONFIGURATIONS TABLE
CREATE TABLE IF NOT EXISTS public.referral_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  commission_percentage numeric DEFAULT 25,
  subscription_price numeric DEFAULT 2000,
  min_withdrawal_threshold numeric DEFAULT 3000,
  multi_tier_enabled boolean DEFAULT false,
  second_tier_percentage numeric DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_config_user UNIQUE (user_id)
);

-- 14. REFERRAL USERS AND INVITES TRACKER TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  name text,
  email text,
  status text DEFAULT 'Active',
  date_created text,
  last_updated text,
  clicks_count integer DEFAULT 0,
  first_time_commission_of numeric DEFAULT 0,
  recurring_commission_of numeric DEFAULT 0,
  total_payments_completed integer DEFAULT 0,
  fraud_score numeric DEFAULT 0,
  ip_address text,
  is_flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 15. PAYOUT BANK ACCOUNT DETAILS TABLE
CREATE TABLE IF NOT EXISTS public.payout_details (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  bank_name text,
  account_number text,
  account_name text,
  payout_method text,
  created_at timestamptz DEFAULT now()
);

-- 16. PAYOUT WITHDRAWAL BILLING ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.payout_items (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  amount numeric NOT null,
  date_requested text NOT null,
  date_processed text,
  method text NOT null,
  status text NOT null,
  reference text NOT null,
  created_at timestamptz DEFAULT now()
);

-- 17. FINANCIAL REFERRAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.referral_transactions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  referred_user_id text,
  referred_user_name text,
  type text NOT null,
  amount numeric NOT null,
  status text NOT null,
  timestamp text NOT null,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 18. SYSTEM AUDIT SECURITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  timestamp text NOT null,
  action text NOT null,
  details text,
  category text NOT null,
  severity text NOT null,
  created_at timestamptz DEFAULT now()
);

-- 19. DOCUMENT READING PROGRESS PERMUTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.document_progress (
  id text NOT null,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  percentage integer DEFAULT 0,
  last_unit_id text,
  consumed_unit_ids jsonb DEFAULT '[]'::jsonb,
  max_total_units integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

-- 20. VIDEO WATCH SEGMENTS TRACKER TABLE
CREATE TABLE IF NOT EXISTS public.video_progress (
  video_id text NOT null,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  watched_segments jsonb DEFAULT '[]'::jsonb,
  progress integer DEFAULT 0,
  last_position numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

-- 21. CUSTOM LECTURE OVERRIDES STATE TABLE
CREATE TABLE IF NOT EXISTS public.lecture_overrides (
  lecture_id text NOT null,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  updates jsonb NOT null,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (lecture_id, user_id)
);

-- 22. TRASHED / REMOVED LECTURES POINTER DELETIONS TABLE
CREATE TABLE IF NOT EXISTS public.removed_lectures (
  lecture_id text NOT null,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (lecture_id, user_id)
);

-- 23. RECENT SUBJECT COURSES VISITED TRACKER TABLE
CREATE TABLE IF NOT EXISTS public.recent_courses (
  course_name text NOT null,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  last_active bigint NOT null,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (course_name, user_id)
);

-- 24. PUSH NOTIFICATIONS BROADCAST & INBOX TABLE
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT null,
  title text NOT null,
  message text NOT null,
  time text,
  type text NOT null,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);


-- ====================================================================
-- PERFORMANCE CORRELATION INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_study_progress_user_date ON public.study_progress_history(user_id, date);
CREATE INDEX IF NOT EXISTS idx_awarded_badges_user ON public.awarded_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_logs_user ON public.mission_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_user ON public.user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_lectures_user ON public.lectures(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_saved_ai_content_user ON public.saved_ai_content(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_dates_user ON public.user_login_dates(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON public.referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_user ON public.payout_items(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_user ON public.referral_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications(user_id) WHERE read = false;


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) ACTIVATIONS
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awarded_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_ai_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removed_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) INDIVIDUAL ACCESS POLICIES
-- ====================================================================

CREATE POLICY "policy_profiles" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "policy_user_stats" ON public.user_stats FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_study_progress" ON public.study_progress_history FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_awarded_badges" ON public.awarded_badges FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_mission_logs" ON public.mission_logs FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_user_missions" ON public.user_missions FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_lectures" ON public.lectures FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "policy_lecture_files" ON public.lecture_files FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_chat_sessions" ON public.chat_sessions FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_chat_messages" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_saved_ai_content" ON public.saved_ai_content FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_user_login_dates" ON public.user_login_dates FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_referral_configs" ON public.referral_configs FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_referrals" ON public.referrals FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_payout_details" ON public.payout_details FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_payout_items" ON public.payout_items FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_referral_transactions" ON public.referral_transactions FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_document_progress" ON public.document_progress FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_video_progress" ON public.video_progress FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_lecture_overrides" ON public.lecture_overrides FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_removed_lectures" ON public.removed_lectures FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_recent_courses" ON public.recent_courses FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "policy_user_notifications" ON public.user_notifications FOR ALL TO authenticated USING (auth.uid() = user_id);


-- ====================================================================
-- AUTOMATED USER SIGNUP TRIGGER HANDLERS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Create Profile Row
  INSERT INTO public.profiles (id, full_name, avatar_url, major, contact_number)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'https://picsum.photos/seed/' || COALESCE(new.email, 'studibl') || '/200/200',
    COALESCE(new.raw_user_meta_data->>'major', 'Undeclared'),
    COALESCE(new.raw_user_meta_data->>'contact_number', '')
  );

  -- 2. Create Initial Stats Row
  INSERT INTO public.user_stats (
    user_id, total_xp, total_questions_answered, correct_answers_value, 
    quiz_count, exam_count, total_study_minutes, subjects
  ) VALUES (
    new.id,
    15600,
    520,
    460,
    18,
    3,
    1540,
    '{"Logic": 82, "Code": 94, "Math": 72, "Theory": 88, "Security": 68, "Hardware": 54, "Linguistics": 75}'::jsonb
  );

  -- 3. Create Initial Referral Config
  INSERT INTO public.referral_configs (
    user_id, commission_percentage, subscription_price, 
    min_withdrawal_threshold, multi_tier_enabled, second_tier_percentage
  ) VALUES (
    new.id,
    25,
    2000,
    3000,
    false,
    5
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ====================================================================
-- SUPABASE STORAGE CONFIGURATIONS
-- ====================================================================

-- 1. Initialize the app-files storage bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-files', 'app-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure Row Level Security (RLS) is active on storage (Managed automatically by Supabase; running this can trigger ownership errors in the SQL Editor)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Row-level security (RLS) policies for user-isolated folders in 'app-files'
CREATE POLICY "policy_storage_view_own" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'app-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "policy_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'app-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "policy_storage_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'app-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "policy_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'app-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ====================================================================
-- PREDICTIVE ACADEMIC INTELLIGENCE SCHEMAS
-- ====================================================================

-- 1. Historical Semester Results input by user (for CGPA calculation)
CREATE TABLE IF NOT EXISTS public.semester_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  semester_name text NOT NULL, -- e.g. 'Year 1 Semester 1', 'Year 1 Semester 2'
  gpa numeric NOT NULL,
  total_credit_units integer DEFAULT 0,
  courses_grades jsonb DEFAULT '[]'::jsonb, -- Array of course/grade info
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_semester UNIQUE (user_id, semester_name)
);
ALTER TABLE public.semester_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_semester_results" ON public.semester_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_semester_results" ON public.semester_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_semester_results" ON public.semester_results FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_semester_results" ON public.semester_results FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. General Academic Records
CREATE TABLE IF NOT EXISTS public.academic_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_code text NOT NULL,
  course_name text,
  grade text NOT NULL,
  credit_units integer DEFAULT 3,
  semester_name text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_course_rec UNIQUE (user_id, course_code)
);
ALTER TABLE public.academic_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_academic_records" ON public.academic_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_academic_records" ON public.academic_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_academic_records" ON public.academic_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_academic_records" ON public.academic_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Course Performance & Mastery Scores (Tracked per user course dynamically)
CREATE TABLE IF NOT EXISTS public.course_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_code text NOT NULL,
  mastery_percentage numeric DEFAULT 0,
  concept_retention_percentage numeric DEFAULT 0,
  exam_readiness_percentage numeric DEFAULT 0,
  knowledge_gap_percentage numeric DEFAULT 0,
  course_completion_percentage numeric DEFAULT 0,
  study_minutes integer DEFAULT 0,
  quizzes_taken integer DEFAULT 0,
  correct_ratio numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_course_perf UNIQUE (user_id, course_code)
);
ALTER TABLE public.course_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_course_performance" ON public.course_performance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_course_performance" ON public.course_performance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_course_performance" ON public.course_performance FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_course_performance" ON public.course_performance FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Course Predictions
CREATE TABLE IF NOT EXISTS public.course_predictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_code text NOT NULL,
  expected_score numeric,
  expected_grade text,
  pass_probability numeric,
  failure_probability numeric,
  risk_level text, -- 'Low', 'Medium', 'High', 'Critical'
  risk_score numeric,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_course_pred UNIQUE (user_id, course_code)
);
ALTER TABLE public.course_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_course_predictions" ON public.course_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_course_predictions" ON public.course_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_course_predictions" ON public.course_predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_course_predictions" ON public.course_predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. CGPA & Semester Predictions Snapshots
CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  current_gpa numeric DEFAULT 0,
  predicted_semester_gpa numeric DEFAULT 0,
  best_case_gpa numeric DEFAULT 0,
  worst_case_gpa numeric DEFAULT 0,
  graduation_cgpa numeric DEFAULT 0,
  confidence_percentage numeric DEFAULT 0,
  standing text,
  projected_classification text,
  graduation_classification text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.prediction_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_snapshots" ON public.prediction_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_snapshots" ON public.prediction_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_snapshots" ON public.prediction_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_snapshots" ON public.prediction_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Weak Topics Detection
CREATE TABLE IF NOT EXISTS public.weak_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_code text NOT NULL,
  weak_topics jsonb DEFAULT '[]'::jsonb, -- Array of string topics
  mastery numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_course_weak UNIQUE (user_id, course_code)
);
ALTER TABLE public.weak_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_weak_topics" ON public.weak_topics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_weak_topics" ON public.weak_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_weak_topics" ON public.weak_topics FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_weak_topics" ON public.weak_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Academic Health
CREATE TABLE IF NOT EXISTS public.academic_health (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  score integer NOT NULL,
  status text NOT NULL, -- 'Excellent', 'Good', 'Needs Improvement', 'At Risk'
  trend text NOT NULL, -- 'Improving', 'Stable', 'Declining'
  performance_trend_factor numeric,
  study_consistency_factor numeric,
  mastery_levels_factor numeric,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.academic_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_academic_health" ON public.academic_health FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_academic_health" ON public.academic_health FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_academic_health" ON public.academic_health FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_academic_health" ON public.academic_health FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_semester_results_user ON public.semester_results(user_id);
CREATE INDEX IF NOT EXISTS idx_academic_records_user ON public.academic_records(user_id);
CREATE INDEX IF NOT EXISTS idx_course_performance_user ON public.course_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_course_predictions_user ON public.course_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_user ON public.prediction_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_weak_topics_user ON public.weak_topics(user_id);


-- ====================================================================
-- 23. SUBSCRIPTION & BILLING SCHEMAS
-- ====================================================================

-- 1. Profiles Table Enhancement (Ensure email address is column)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Subscription Plans Definition Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  duration_days integer NOT NULL,
  plan_type text NOT NULL, -- 'trial', 'monthly', 'semester'
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for Plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select active subscription plans" ON public.subscription_plans 
  FOR SELECT TO authenticated USING (active = true);

-- 3. User Subscriptions Table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id text REFERENCES public.subscription_plans(id) ON DELETE RESTRICT NOT NULL,
  status text NOT NULL, -- 'trial', 'active', 'expired', 'cancelled', 'pending'
  start_date timestamptz DEFAULT now(),
  end_date timestamptz NOT NULL,
  auto_renew boolean DEFAULT true,
  payment_reference text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for User Subscriptions
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions 
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Payment History Receipts Table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  payment_provider text NOT NULL, -- 'paystack', 'flutterwave', etc.
  payment_reference text NOT NULL UNIQUE,
  payment_status text NOT NULL, -- 'pending', 'success', 'failed', 'refunded'
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own payments" ON public.payments 
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. Trial Usage Log Prevention Table
CREATE TABLE IF NOT EXISTS public.trial_usage (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  trial_started timestamptz DEFAULT now(),
  trial_ended timestamptz,
  has_used_trial boolean DEFAULT false
);

-- Enable RLS for Trial Usage
ALTER TABLE public.trial_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can check their own trial status" ON public.trial_usage 
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Seed subscription plans if empty
INSERT INTO public.subscription_plans (id, name, description, price, duration_days, plan_type, active)
VALUES 
  ('free_trial', 'Free Trial', 'Full Premium access to all premium Study tools for 24 hours to test our diagnostic engine.', 0, 1, 'trial', true),
  ('monthly_premium', 'Monthly Premium', 'Unlimited access to AI Tutor, academic dashboards, GPA prediction models, structured textbooks & chat, billed monthly.', 2000, 30, 'monthly', true),
  ('semester_premium', 'Semester Premium', 'Complete academic term coverage. No monthly renewals, priority access to predictive features, and 30%+ savings.', 7000, 120, 'semester', true)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 24. COMMUNITY & SOCIAL ACADEMIC COLLABORATION SCHEMAS
-- ====================================================================

-- 1. Community Discussion Posts
CREATE TABLE IF NOT EXISTS public.community_posts (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  author_name text NOT NULL,
  author_avatar text,
  author_role text DEFAULT 'Student',
  author_bio text,
  content text NOT NULL,
  images jsonb DEFAULT '[]'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view community posts" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can update their posts" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authors can delete their posts" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Post Likes
CREATE TABLE IF NOT EXISTS public.community_post_likes (
  post_id text REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post likes" ON public.community_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like posts" ON public.community_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON public.community_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Community Comments and Replies
CREATE TABLE IF NOT EXISTS public.community_comments (
  id text PRIMARY KEY,
  post_id text REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  parent_id text REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  author_name text NOT NULL,
  author_avatar text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view community comments" ON public.community_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create comments" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can update their comments" ON public.community_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authors and post owners can delete comments" ON public.community_comments FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.community_posts WHERE id = post_id AND user_id = auth.uid())
);

-- 4. Comment Likes
CREATE TABLE IF NOT EXISTS public.community_comment_likes (
  comment_id text REFERENCES public.community_comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.community_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comment likes" ON public.community_comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like comments" ON public.community_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike comments" ON public.community_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Study Groups & Hubs
CREATE TABLE IF NOT EXISTS public.community_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  image text,
  tag text NOT NULL,
  base_members integer DEFAULT 0,
  creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view community groups" ON public.community_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create groups" ON public.community_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

-- 6. Group Memberships
CREATE TABLE IF NOT EXISTS public.community_group_members (
  group_id text REFERENCES public.community_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view group members" ON public.community_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.community_group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.community_group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Peer Connections
CREATE TABLE IF NOT EXISTS public.community_connections (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  connected_user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, connected_user_id)
);

ALTER TABLE public.community_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their connections" ON public.community_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add connections" ON public.community_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove connections" ON public.community_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. Direct & Group Chats
CREATE TABLE IF NOT EXISTS public.community_chats (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'direct',
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_chats ENABLE ROW LEVEL SECURITY;

-- 9. Chat Participants
CREATE TABLE IF NOT EXISTS public.community_chat_participants (
  chat_id text REFERENCES public.community_chats(id) ON DELETE CASCADE NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_avatar text,
  user_role text,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE public.community_chat_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view chats they participate in" ON public.community_chat_participants 
  FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

-- 10. Chat Messages
CREATE TABLE IF NOT EXISTS public.community_messages (
  id text PRIMARY KEY,
  chat_id text REFERENCES public.community_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  text text NOT NULL,
  type text DEFAULT 'text',
  attachment jsonb,
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages of their chats" ON public.community_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.community_chat_participants WHERE chat_id = community_messages.chat_id AND user_id = auth.uid()::text)
);
CREATE POLICY "Users can send messages in their chats" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()::text AND
  EXISTS (SELECT 1 FROM public.community_chat_participants WHERE chat_id = community_messages.chat_id AND user_id = auth.uid()::text)
);

