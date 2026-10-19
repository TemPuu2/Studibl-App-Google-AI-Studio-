export enum UserIntentMode {
  SOCIAL = 'Social',
  DIRECTIONAL = 'Directional',
  DEEP = 'Deep',
  CONFUSED = 'Confused',
  SHORTCUT = 'Shortcut-seeking'
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachedFiles?: AttachedFile[];
  explanation?: {
    explanation: string;
    intent?: UserIntentMode;
    suggestedFollowUp?: string;
  };
  quiz?: QuizQuestion[];
  analysis?: {
    summary: string;
    studyPlan: string;
  };
  feedback?: {
    rating: number;
    comment?: string;
  };
}

export interface AttachedFile {
  id: string;
  name: string;
  file?: File;
  content?: string;
  isPinned?: boolean;
  path?: string;
  url?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
  attachedFiles?: AttachedFile[];
  lastUpdate: number;
  draftInput?: string;
  scrollPosition?: number;
}

export interface Mission {
  id: string;
  title: string;
  duration: string;
  status: 'completed' | 'current' | 'pending';
  type?: 'lecture' | 'quiz' | 'exam' | 'review' | 'ai-breakdown' | 'video' | 'voice' | 'reading';
  courseId?: string;
  topic?: string;
  updatedAt: number;
    metadata?: {
      lectureId?: string;
      quizId?: string;
      sessionId?: string;
      lastPosition?: number;
      lastQuestionIndex?: number;
      activeTab?: string;
      pdfPage?: number;
      writtenAnswers?: Record<string, string>;
      quizAnswers?: Record<string, number>;
      fillBlankAnswers?: Record<string, string[]>;
      [key: string]: any;
    };
}

export interface StudyPlan {
  id: string;
  title: string;
  missions: Mission[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'success' | 'alert' | 'info';
  read: boolean;
}

export interface StudyGoal {
  id: string;
  title: string;
  targetDate: string;
  progress: number;
  completed: boolean;
}

export interface SavedAIContent {
  id: string;
  messageId: string;
  title: string;
  content: string;
  type: 'explanation' | 'analysis' | 'quiz' | 'general';
  timestamp: string;
  sessionTitle?: string;
  metadata?: any;
}

// ====================================================================
// SUBSCRIPTION & BILLING SCHEMAS
// ====================================================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  plan_type: 'trial' | 'monthly' | 'semester';
  active: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  payment_reference?: string;
  created_at: string;
  subscription_plans?: SubscriptionPlan;
}

export interface PaymentReceipt {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  payment_provider: 'system' | 'paystack' | 'flutterwave';
  payment_reference: string;
  payment_status: 'pending' | 'success' | 'failed' | 'refunded';
  paid_at?: string;
  created_at: string;
  user_subscriptions?: {
    plan_id: string;
    status: string;
  };
}

export interface SubscriptionContextType {
  subscriptionId: string | null;
  canAccessPremium: boolean;
  isTrialActive: boolean;
  hasActiveSubscription: boolean;
  subscriptionStatus: string;
  remainingDays: number;
  hasUsedTrial: boolean;
  currentPlan: SubscriptionPlan | null;
  expiresAt: string | null;
  autoRenew: boolean;
  payments: PaymentReceipt[];
  isLoading: boolean;
  isPaywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
  activateTrial: () => Promise<{ success: boolean; message: string }>;
  initiatePayment: (planId: string, provider: 'paystack' | 'flutterwave') => Promise<{ success: boolean; checkoutUrl?: string; error?: string }>;
  verifyPayment: (reference: string, provider: 'paystack' | 'flutterwave') => Promise<{ success: boolean; message: string }>;
  cancelSubscription: (subscriptionId: string) => Promise<{ success: boolean; message: string }>;
  refreshStatus: () => Promise<void>;
}

