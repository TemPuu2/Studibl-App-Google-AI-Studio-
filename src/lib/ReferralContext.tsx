import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  getReferralConfig, 
  saveReferralConfig, 
  getReferrals, 
  saveReferral, 
  getPayoutDetails, 
  savePayoutDetails, 
  getPayoutItems, 
  savePayoutItem, 
  getReferralTransactions, 
  saveReferralTransaction, 
  getAuditLogs, 
  saveAuditLog, 
  isRealUserSession 
} from './supabaseService';

/**
 * Interface representing the administrative settings of the referral system,
 * which are fully configurable from the admin interface element.
 */
export interface ReferralConfig {
  commissionPercentage: number;   // E.g. 25 for 25%
  subscriptionPrice: number;       // E.g. 2000 for ₦2,000
  minWithdrawalThreshold: number;  // E.g. 3000 for ₦3,000 minimum
  multiTierEnabled: boolean;      // For future multi-tier support flag
  secondTierPercentage: number;   // 2nd tier commission % (e.g. 5%)
}

/**
 * Status of the referred user.
 * 'clicked' -> User used link but has not registered.
 * 'registered' -> Registered account but not paying.
 * 'subscribed' -> Paid active subscriber.
 * 'renewed' -> Renewed active subscriber.
 * 'inactive' -> Cancelled or expired subscription.
 */
export type ReferralUserStatus = 'clicked' | 'registered' | 'subscribed' | 'renewed' | 'inactive';

/**
 * Details of individual referred user records.
 */
export interface ReferralUser {
  id: string;
  name: string;
  email: string;
  status: ReferralUserStatus;
  dateCreated: string;
  lastUpdated: string;
  clicksCount: number;
  firstTimeCommissionOf: number;
  recurringCommissionOf: number;
  totalPaymentsCompleted: number;
  fraudScore: number;             // Percent gauge for checking duplicate fingerprints
  ipAddress: string;
  isFlagged: boolean;             // Fraud alert flag
}

/**
 * Bank details for earnings withdrawal payouts.
 */
export interface PayoutDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  payoutMethod: 'Bank Transfer' | 'Mobile Money' | 'PayPal';
}

/**
 * Details of payouts requested, approved or completed.
 */
export interface PayoutItem {
  id: string;
  amount: number;
  dateRequested: string;
  dateProcessed?: string;
  method: string;
  status: 'pending' | 'approved' | 'paid' | 'failed';
  reference: string;
}

/**
 * Transaction / Commission distribution history item.
 */
export interface ReferralTransaction {
  id: string;
  referredUserId: string;
  referredUserName: string;
  type: 'tier1_commission' | 'recurring_commission' | 'payout_initiated' | 'payout_completed' | 'payout_rejected';
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'flagged' | 'failed';
  timestamp: string;
  notes: string;
}

/**
 * Audit log for compliance, traceability, and fraud analysis.
 */
export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  category: 'security' | 'financial' | 'user_event';
  severity: 'low' | 'medium' | 'high';
}

/**
 * ReferralContext state container payload structure.
 */
export interface ReferralContextType {
  config: ReferralConfig;
  referrals: ReferralUser[];
  payoutDetails: PayoutDetails;
  payoutHistory: PayoutItem[];
  transactions: ReferralTransaction[];
  auditLogs: AuditLog[];
  referralCode: string;
  referralLink: string;
  
  // Dashboard Metrics
  metrics: {
    totalReferrals: number;
    totalLinkClicks: number;
    totalSignups: number;
    totalSubscribed: number;
    activeSubscribers: number;
    conversionRate: number;
    totalEarned: number;
    recurringEarned: number;
    pendingEarnings: number;
    approvedEarnings: number;
    paidEarnings: number;
    lifetimeRevenueGenerated: number;
    monthlyEarnings: number;
    topPeriod: string;
  };

  // State modification actions
  updateConfig: (newConfig: Partial<ReferralConfig>) => void;
  updatePayoutDetails: (details: PayoutDetails) => void;
  requestPayout: () => boolean;
  simulateReferralEvent: (type: 'click' | 'signup' | 'subscribe' | 'renew' | 'self_referral_fraud') => void;
  clearReferralState: () => void;
  clearToEmptyState: () => void;
  loadDemoData: () => void;
  triggerBatchPayoutCycle: () => void;
}

const ReferralContext = createContext<ReferralContextType | undefined>(undefined);

const REFS_STORAGE_KEY = 'studibl_referral_data_v1';

const INITIAL_CONFIG: ReferralConfig = {
  commissionPercentage: 25,
  subscriptionPrice: 2000,
  minWithdrawalThreshold: 3000,
  multiTierEnabled: false,
  secondTierPercentage: 5
};

const INITIAL_PAYOUT: PayoutDetails = {
  bankName: 'Access Bank Nigeria',
  accountNumber: '0123456789',
  accountName: 'Alex Simmons',
  payoutMethod: 'Bank Transfer'
};

// Seed initial referrals to populate the dashboard interactively
const DEFAULT_REFERRALS: ReferralUser[] = [
  {
    id: 'ref-1',
    name: 'Chidi Okafor',
    email: 'chidi.okafor@unilag.edu.ng',
    status: 'renewed',
    dateCreated: '2026-05-15',
    lastUpdated: '2026-06-05',
    clicksCount: 3,
    firstTimeCommissionOf: 500,
    recurringCommissionOf: 500,
    totalPaymentsCompleted: 2,
    fraudScore: 8,
    ipAddress: '102.89.34.120',
    isFlagged: false
  },
  {
    id: 'ref-2',
    name: 'Aisha Bello',
    email: 'aisha.b@abu.edu.ng',
    status: 'subscribed',
    dateCreated: '2026-05-20',
    lastUpdated: '2026-05-20',
    clicksCount: 1,
    firstTimeCommissionOf: 500,
    recurringCommissionOf: 0,
    totalPaymentsCompleted: 1,
    fraudScore: 12,
    ipAddress: '197.210.8.54',
    isFlagged: false
  },
  {
    id: 'ref-3',
    name: 'Tunde Adebayo',
    email: 'tunde.adebayo@futa.edu.ng',
    status: 'registered',
    dateCreated: '2026-06-01',
    lastUpdated: '2026-06-01',
    clicksCount: 2,
    firstTimeCommissionOf: 0,
    recurringCommissionOf: 0,
    totalPaymentsCompleted: 0,
    fraudScore: 15,
    ipAddress: '102.91.44.22',
    isFlagged: false
  },
  {
    id: 'ref-4',
    name: 'Efe Johnson',
    email: 'efe.j@ui.edu.ng',
    status: 'clicked',
    dateCreated: '2026-06-08',
    lastUpdated: '2026-06-08',
    clicksCount: 1,
    firstTimeCommissionOf: 0,
    recurringCommissionOf: 0,
    totalPaymentsCompleted: 0,
    fraudScore: 5,
    ipAddress: '102.88.2.110',
    isFlagged: false
  }
];

const DEFAULT_TRANSACTIONS: ReferralTransaction[] = [
  {
    id: 'tx-1',
    referredUserId: 'ref-1',
    referredUserName: 'Chidi Okafor',
    type: 'tier1_commission',
    amount: 500,
    status: 'paid',
    timestamp: '2026-05-15 14:32',
    notes: 'Access Fee 25% allocation generated'
  },
  {
    id: 'tx-2',
    referredUserId: 'ref-1',
    referredUserName: 'Chidi Okafor',
    type: 'recurring_commission',
    amount: 500,
    status: 'paid',
    timestamp: '2026-06-05 09:12',
    notes: 'Monthly renewal subscription payment'
  },
  {
    id: 'tx-3',
    referredUserId: 'ref-2',
    referredUserName: 'Aisha Bello',
    type: 'tier1_commission',
    amount: 500,
    status: 'approved',
    timestamp: '2026-05-20 18:04',
    notes: 'Access Fee 25% allocation generated'
  }
];

const DEFAULT_PAYOUT_HISTORY: PayoutItem[] = [
  {
    id: 'pay-1',
    amount: 1000,
    dateRequested: '2026-06-06',
    dateProcessed: '2026-06-07',
    method: 'Bank Transfer',
    status: 'paid',
    reference: 'REF-PAY-723948'
  }
];

const DEFAULT_AUDIT: AuditLog[] = [
  {
    id: 'aud-1',
    timestamp: '2026-06-09 01:22:15',
    action: 'SYSTEM_BOOT',
    details: 'Referral tracking engine initialised with client configurations.',
    category: 'security',
    severity: 'low'
  },
  {
    id: 'aud-2',
    timestamp: '2026-06-09 01:25:32',
    action: 'REVENUE_SHARE_EARNING',
    details: 'Chidi Okafor renewal validated. Recurring commission of ₦500 disbursed.',
    category: 'financial',
    severity: 'low'
  }
];

/**
 * Referral System State Provider wrapper. Encapsulates all referral dynamics, clicks,
 * commissions, payouts, and automated security fraud monitors.
 */
export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() || {};
  // Configured referral identifier
  const referralCode = 'ALEX500';
  const referralLink = `https://studibl.com/join?ref=${referralCode}`;

  const isRealUser = user && isRealUserSession(user.id);

  // Intelligently initialize settings and user lists depending on session authenticity to maintain empty state correctness
  const [config, setConfig] = useState<ReferralConfig>(INITIAL_CONFIG);
  const [referrals, setReferrals] = useState<ReferralUser[]>(() => isRealUser ? [] : DEFAULT_REFERRALS);
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails>(() => isRealUser ? {
    bankName: '',
    accountNumber: '',
    accountName: '',
    payoutMethod: 'Bank Transfer'
  } : INITIAL_PAYOUT);
  const [payoutHistory, setPayoutHistory] = useState<PayoutItem[]>(() => isRealUser ? [] : DEFAULT_PAYOUT_HISTORY);
  const [transactions, setTransactions] = useState<ReferralTransaction[]>(() => isRealUser ? [] : DEFAULT_TRANSACTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => isRealUser ? [] : DEFAULT_AUDIT);

  // Additional defensive synchronization hook to reset to empty on dynamic state transitions
  useEffect(() => {
    if (user && isRealUserSession(user.id)) {
      setReferrals(prev => prev === DEFAULT_REFERRALS ? [] : prev);
      setPayoutHistory(prev => prev === DEFAULT_PAYOUT_HISTORY ? [] : prev);
      setTransactions(prev => prev === DEFAULT_TRANSACTIONS ? [] : prev);
      setAuditLogs(prev => prev === DEFAULT_AUDIT ? [] : prev);
    }
  }, [user]);

  // Pull all referral system tables from Supabase on authenticating
  useEffect(() => {
    if (user && isRealUserSession(user.id)) {
      const loadReferralData = async () => {
        try {
          const dbConfig = await getReferralConfig(user.id);
          const dbReferrals = await getReferrals(user.id);
          const dbPayoutDetails = await getPayoutDetails(user.id);
          const dbPayoutHistory = await getPayoutItems(user.id);
          const dbTx = await getReferralTransactions(user.id);
          const dbAudit = await getAuditLogs(user.id);

          if (dbConfig) {
            setConfig({
              commissionPercentage: dbConfig.commission_percentage,
              subscriptionPrice: dbConfig.subscription_price,
              minWithdrawalThreshold: dbConfig.min_withdrawal_threshold,
              multiTierEnabled: dbConfig.multi_tier_enabled,
              secondTierPercentage: dbConfig.second_tier_percentage
            });
          }

          if (dbReferrals && dbReferrals.length > 0) {
            setReferrals(dbReferrals.map((r: any) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              status: r.status,
              dateCreated: r.date_created,
              lastUpdated: r.last_updated,
              clicksCount: r.clicks_count,
              firstTimeCommissionOf: r.first_time_commission_of,
              recurringCommissionOf: r.recurring_commission_of,
              totalPaymentsCompleted: r.total_payments_completed,
              fraudScore: r.fraud_score,
              ipAddress: r.ip_address,
              isFlagged: r.is_flagged
            })));
          } else {
            // Overwrite with empty array to avoid leaking default mock referrals
            setReferrals([]);
          }

          if (dbPayoutDetails) {
            setPayoutDetails({
              bankName: dbPayoutDetails.bank_name,
              accountNumber: dbPayoutDetails.account_number,
              accountName: dbPayoutDetails.account_name,
              payoutMethod: dbPayoutDetails.payout_method
            });
          } else {
            // Overwrite with blank payout details if none are configured yet on Supabase
            setPayoutDetails({
              bankName: '',
              accountNumber: '',
              accountName: '',
              payoutMethod: 'Bank Transfer'
            });
          }

          if (dbPayoutHistory && dbPayoutHistory.length > 0) {
            setPayoutHistory(dbPayoutHistory.map((h: any) => ({
              id: h.id,
              amount: h.amount,
              dateRequested: h.date_requested,
              dateProcessed: h.date_processed,
              method: h.method,
              status: h.status,
              reference: h.reference
            })));
          } else {
            // Overwrite with empty array to avoid leaking default mock payout history
            setPayoutHistory([]);
          }

          if (dbTx && dbTx.length > 0) {
            setTransactions(dbTx.map((t: any) => ({
              id: t.id,
              referredUserId: t.referred_user_id,
              referredUserName: t.referred_user_name,
              type: t.type,
              amount: t.amount,
              status: t.status,
              timestamp: t.timestamp,
              notes: t.notes
            })));
          } else {
            // Overwrite with empty array to avoid leaking default mock transactions
            setTransactions([]);
          }

          if (dbAudit && dbAudit.length > 0) {
            setAuditLogs(dbAudit.map((a: any) => ({
              id: a.id,
              timestamp: a.timestamp,
              action: a.action,
              details: a.details,
              category: a.category,
              severity: a.severity
            })));
          } else {
            // Overwrite with empty array to avoid leaking default mock audit logs
            setAuditLogs([]);
          }
        } catch (e) {
          console.error("Error loading referral statistics from Supabase:", e);
        }
      };
      loadReferralData();
    }
  }, [user]);

  // Synchronise state from LocalStorage on mount to preserve adjustments (non-auth)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(REFS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!user || !isRealUserSession(user.id)) {
          if (parsed.config) setConfig(parsed.config);
          if (parsed.referrals) setReferrals(parsed.referrals);
          if (parsed.payoutDetails) setPayoutDetails(parsed.payoutDetails);
          if (parsed.payoutHistory) setPayoutHistory(parsed.payoutHistory);
          if (parsed.transactions) setTransactions(parsed.transactions);
          if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
        }
      }
    } catch (e) {
      console.error("Failed to load referral registry details:", e);
    }
  }, [user]);

  // Save changes to localStorage on any state modification
  const persist = useCallback((
    cfg: ReferralConfig,
    refs: ReferralUser[],
    pd: PayoutDetails,
    payH: PayoutItem[],
    txs: ReferralTransaction[],
    auds: AuditLog[]
  ) => {
    try {
      localStorage.setItem(REFS_STORAGE_KEY, JSON.stringify({
        config: cfg,
        referrals: refs,
        payoutDetails: pd,
        payoutHistory: payH,
        transactions: txs,
        auditLogs: auds
      }));

      // In addition to local storage, persist seamlessly to Supabase
      if (user && isRealUserSession(user.id)) {
        const syncToSupabase = async () => {
          try {
            await saveReferralConfig(user.id, cfg);
            await savePayoutDetails(user.id, pd);

            for (const r of refs) {
              await saveReferral(user.id, r);
            }
            for (const pay of payH) {
              await savePayoutItem(user.id, pay);
            }
            for (const tx of txs) {
              await saveReferralTransaction(user.id, tx);
            }
            for (const aud of auds) {
              await saveAuditLog(user.id, aud);
            }
          } catch (e) {
            console.error("Error synchronizing referral state to Supabase:", e);
          }
        };
        syncToSupabase();
      }
    } catch (e) {
      console.error("LocalStorage write crash in referral persistence:", e);
    }
  }, [user]);

  // Set updates for configuration
  const updateConfig = useCallback((newConfig: Partial<ReferralConfig>) => {
    setConfig(prev => {
      const merged = { ...prev, ...newConfig };
      persist(merged, referrals, payoutDetails, payoutHistory, transactions, auditLogs);
      return merged;
    });
  }, [referrals, payoutDetails, payoutHistory, transactions, auditLogs, persist]);

  // Set updates for payout bank info
  const updatePayoutDetails = useCallback((details: PayoutDetails) => {
    setPayoutDetails(prev => {
      persist(config, referrals, details, payoutHistory, transactions, auditLogs);
      return details;
    });
  }, [config, referrals, payoutHistory, transactions, auditLogs, persist]);

  // Clean reset function
  const clearReferralState = useCallback(() => {
    setConfig(INITIAL_CONFIG);
    setReferrals(DEFAULT_REFERRALS);
    setPayoutDetails(INITIAL_PAYOUT);
    setPayoutHistory(DEFAULT_PAYOUT_HISTORY);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAuditLogs([
      {
        id: 'aud-reset-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        action: 'STATE_RESET',
        details: 'Referral tracking history reset to initial seeds.',
        category: 'security',
        severity: 'medium'
      }
    ]);
    localStorage.removeItem(REFS_STORAGE_KEY);
  }, []);

  // Set all states to true empty state
  const clearToEmptyState = useCallback(() => {
    setConfig(INITIAL_CONFIG);
    setReferrals([]);
    setPayoutDetails(INITIAL_PAYOUT);
    setPayoutHistory([]);
    setTransactions([]);
    setAuditLogs([
      {
        id: 'aud-empty-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        action: 'AFFILIATE_EMPTY_STATE',
        details: 'Referral database cleared to empty state. Onboarding tutorials and zero-data states active.',
        category: 'security',
        severity: 'medium'
      }
    ]);
    try {
      localStorage.setItem(REFS_STORAGE_KEY, JSON.stringify({
        config: INITIAL_CONFIG,
        referrals: [],
        payoutDetails: INITIAL_PAYOUT,
        payoutHistory: [],
        transactions: [],
        auditLogs: [
          {
            id: 'aud-empty-init-' + Date.now(),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            action: 'AFFILIATE_EMPTY_STATE',
            details: 'Referral database cleared to empty state. Onboarding tutorials and zero-data states active.',
            category: 'security',
            severity: 'medium'
          }
        ]
      }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Preload standard demo seeds
  const loadDemoData = useCallback(() => {
    setConfig(INITIAL_CONFIG);
    setReferrals(DEFAULT_REFERRALS);
    setPayoutDetails(INITIAL_PAYOUT);
    setPayoutHistory(DEFAULT_PAYOUT_HISTORY);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAuditLogs(DEFAULT_AUDIT);
    try {
      localStorage.setItem(REFS_STORAGE_KEY, JSON.stringify({
        config: INITIAL_CONFIG,
        referrals: DEFAULT_REFERRALS,
        payoutDetails: INITIAL_PAYOUT,
        payoutHistory: DEFAULT_PAYOUT_HISTORY,
        transactions: DEFAULT_TRANSACTIONS,
        auditLogs: DEFAULT_AUDIT
      }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Request a fresh payout based on available approved earnings
  const requestPayout = useCallback((): boolean => {
    // Determine approved unpaid and unpended balance
    const approvedAmount = transactions
      .filter(t => t.status === 'approved')
      .reduce((sum, current) => sum + current.amount, 0);

    if (approvedAmount < config.minWithdrawalThreshold) {
      // Record a failure audit event
      const failAudit: AuditLog = {
        id: `aud-err-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        action: 'PAYOUT_DENIED',
        details: `Payout request of ₦${approvedAmount} blocked. Minimum threshold of ₦${config.minWithdrawalThreshold} not met.`,
        category: 'financial',
        severity: 'medium'
      };
      setAuditLogs(prev => {
        const next = [failAudit, ...prev];
        persist(config, referrals, payoutDetails, payoutHistory, transactions, next);
        return next;
      });
      return false;
    }

    // Set matching transactions to pending
    const updatedTransactions = transactions.map(t => {
      if (t.status === 'approved') {
        return { ...t, status: 'pending' as const };
      }
      return t;
    });

    const newPayout: PayoutItem = {
      id: `pay-${Date.now()}`,
      amount: approvedAmount,
      dateRequested: new Date().toISOString().split('T')[0],
      method: payoutDetails.payoutMethod,
      status: 'pending',
      reference: `STDB-RF-${Math.floor(100000 + Math.random() * 900000)}`
    };

    const newAudit: AuditLog = {
      id: `aud-req-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action: 'PAYOUT_INITIATED',
      details: `Successful payout request generated for ₦${approvedAmount} to ${payoutDetails.bankName}.`,
      category: 'financial',
      severity: 'low'
    };

    setPayoutHistory(prev => {
      const nextPayouts = [newPayout, ...prev];
      setTransactions(updatedTransactions);
      setAuditLogs(prevAudit => {
        const nextAudit = [newAudit, ...prevAudit];
        persist(config, referrals, payoutDetails, nextPayouts, updatedTransactions, nextAudit);
        return nextAudit;
      });
      return nextPayouts;
    });

    return true;
  }, [config.minWithdrawalThreshold, transactions, payoutDetails, referrals, payoutHistory, persist]);

  // Admin simulation action: pushes processed logs inside the virtual state context
  const triggerBatchPayoutCycle = useCallback(() => {
    // Sets all pending payouts to PAID, and corresponding pending transactions to paid
    const updatedTxs = transactions.map(t => {
      if (t.status === 'pending') {
        return { ...t, status: 'paid' as const };
      }
      return t;
    });

    const updatedPayouts = payoutHistory.map(p => {
      if (p.status === 'pending') {
        return { 
          ...p, 
          status: 'paid' as const,
          dateProcessed: new Date().toISOString().split('T')[0]
        };
      }
      return p;
    });

    const audit: AuditLog = {
      id: `aud-batch-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action: 'PAYOUT_BATCH_DISBURSED',
      details: 'Admin batch executed. All pending affiliate commission withdrawals transferred to financial gateways.',
      category: 'financial',
      severity: 'high'
    };

    setTransactions(updatedTxs);
    setPayoutHistory(updatedPayouts);
    setAuditLogs(prev => {
      const nextAudit = [audit, ...prev];
      persist(config, referrals, payoutDetails, updatedPayouts, updatedTxs, nextAudit);
      return nextAudit;
    });
  }, [transactions, payoutHistory, referrals, config, payoutDetails, persist]);

  // Simulates instant referral transitions: clicks -> signups -> payments -> fraud triggers
  const simulateReferralEvent = useCallback((type: 'click' | 'signup' | 'subscribe' | 'renew' | 'self_referral_fraud') => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const idSuffix = Date.now().toString().slice(-4);
    
    setReferrals(prevRefs => {
      let nextRefs = [...prevRefs];
      let nextTxs = [...transactions];
      let nextAudits = [...auditLogs];

      if (type === 'click') {
        // Find existing clicked user or create a new clicked visitor
        const mockName = `Guest Visitor #${idSuffix}`;
        const newClicked: ReferralUser = {
          id: `vis-${Date.now()}`,
          name: mockName,
          email: 'anonymous@studibl.com',
          status: 'clicked',
          dateCreated: new Date().toISOString().split('T')[0],
          lastUpdated: new Date().toISOString().split('T')[0],
          clicksCount: 1,
          firstTimeCommissionOf: 0,
          recurringCommissionOf: 0,
          totalPaymentsCompleted: 0,
          fraudScore: Math.floor(2 + Math.random() * 8),
          ipAddress: `197.210.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          isFlagged: false
        };
        nextRefs = [newClicked, ...nextRefs];
        nextAudits = [
          {
            id: `aud-clk-${Date.now()}`,
            timestamp: timestampStr,
            action: 'VISITOR_REFERRED_CLICK',
            details: `Unique in-bound link click tracked. Assigned temporary virtual cookie tracker.`,
            category: 'user_event',
            severity: 'low'
          },
          ...nextAudits
        ];
      }

      else if (type === 'signup') {
        // Transition a clicked visitor to registered status
        const clickIndex = nextRefs.findIndex(r => r.status === 'clicked');
        if (clickIndex !== -1) {
          const user = nextRefs[clickIndex];
          const updatedUser: ReferralUser = {
            ...user,
            status: 'registered',
            name: `Learner ${idSuffix}`,
            email: `learner_${idSuffix}@nigeriauniv.edu.ng`,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          nextRefs[clickIndex] = updatedUser;
          nextAudits = [
            {
              id: `aud-reg-${Date.now()}`,
              timestamp: timestampStr,
              action: 'REFEREE_SIGNUP',
              details: `Contact verification created. Account ${updatedUser.name} registered successfully.`,
              category: 'user_event',
              severity: 'low'
            },
            ...nextAudits
          ];
        } else {
          // Fallback: Create immediate registered user
          const newUser: ReferralUser = {
            id: `ref-${Date.now()}`,
            name: `Femi Alao ${idSuffix}`,
            email: `femi.alao.${idSuffix}@unilag.edu.ng`,
            status: 'registered',
            dateCreated: new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString().split('T')[0],
            clicksCount: 2,
            firstTimeCommissionOf: 0,
            recurringCommissionOf: 0,
            totalPaymentsCompleted: 0,
            fraudScore: Math.floor(5 + Math.random() * 10),
            ipAddress: '102.89.20.14',
            isFlagged: false
          };
          nextRefs = [newUser, ...nextRefs];
          nextAudits = [
            {
              id: `aud-reg-fallback-${Date.now()}`,
              timestamp: timestampStr,
              action: 'REFEREE_SIGNUP',
              details: `Account ${newUser.name} registered directly via invite link.`,
              category: 'user_event',
              severity: 'low'
            },
            ...nextAudits
          ];
        }
      }

      else if (type === 'subscribe') {
        // Transition a registered user to paid subscriber
        const regIndex = nextRefs.findIndex(r => r.status === 'registered');
        if (regIndex !== -1) {
          const user = nextRefs[regIndex];
          const calculatedCommission = Math.round(config.subscriptionPrice * (config.commissionPercentage / 100));
          
          const updatedUser: ReferralUser = {
            ...user,
            status: 'subscribed',
            totalPaymentsCompleted: 1,
            firstTimeCommissionOf: calculatedCommission,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          nextRefs[regIndex] = updatedUser;

          const newTx: ReferralTransaction = {
            id: `tx-new-${Date.now()}`,
            referredUserId: user.id,
            referredUserName: user.name,
            type: 'tier1_commission',
            amount: calculatedCommission,
            status: 'approved',
            timestamp: timestampStr,
            notes: `First plan purchase. Subscription fee of ₦${config.subscriptionPrice} verified.`
          };
          nextTxs = [newTx, ...nextTxs];

          nextAudits = [
            {
              id: `aud-sub-${Date.now()}`,
              timestamp: timestampStr,
              action: 'PAYMENT_COMPLETED',
              details: `Learner ${user.name} became an active subscriber. Partner commission of ₦${calculatedCommission} created.`,
              category: 'financial',
              severity: 'low'
            },
            ...nextAudits
          ];
        } else {
          // Warning in logs if no registered user found to subscribe
          nextAudits = [
            {
              id: `aud-warn-${Date.now()}`,
              timestamp: timestampStr,
              action: 'TRIGGER_IGNORED',
              details: `Subscribe simulation requested but no non-subscribed user was registered. Please create a sign-up first.`,
              category: 'user_event',
              severity: 'medium'
            },
            ...nextAudits
          ];
        }
      }

      else if (type === 'renew') {
        // Add renewal/recurring transaction to an already subscribed user
        const subIndex = nextRefs.findIndex(r => r.status === 'subscribed' || r.status === 'renewed');
        if (subIndex !== -1) {
          const user = nextRefs[subIndex];
          const calculatedRenewalComm = Math.round(config.subscriptionPrice * (config.commissionPercentage / 100));

          const updatedUser: ReferralUser = {
            ...user,
            status: 'renewed',
            totalPaymentsCompleted: user.totalPaymentsCompleted + 1,
            recurringCommissionOf: user.recurringCommissionOf + calculatedRenewalComm,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          nextRefs[subIndex] = updatedUser;

          const newTx: ReferralTransaction = {
            id: `tx-rec-${Date.now()}`,
            referredUserId: user.id,
            referredUserName: user.name,
            type: 'recurring_commission',
            amount: calculatedRenewalComm,
            status: 'approved',
            timestamp: timestampStr,
            notes: `Renewal cycle #${updatedUser.totalPaymentsCompleted} access verified.`
          };
          nextTxs = [newTx, ...nextTxs];

          nextAudits = [
            {
              id: `aud-renew-${Date.now()}`,
              timestamp: timestampStr,
              action: 'PLAN_RENEWAL',
              details: `Subscriber ${user.name} successfully renewed. Disbursed recurring reward of ₦${calculatedRenewalComm}.`,
              category: 'financial',
              severity: 'low'
            },
            ...nextAudits
          ];
        } else {
          nextAudits = [
            {
              id: `aud-warn-ren-${Date.now()}`,
              timestamp: timestampStr,
              action: 'TRIGGER_IGNORED',
              details: `Renew simulation requested but no subscribed user exists. Please sign-up and subscribe first.`,
              category: 'user_event',
              severity: 'medium'
            },
            ...nextAudits
          ];
        }
      }

      else if (type === 'self_referral_fraud') {
        // Simulates a duplicate device match fraud block
        const mockName = `Abuse Case Profile #${idSuffix}`;
        const fraudUser: ReferralUser = {
          id: `fraud-${Date.now()}`,
          name: mockName,
          email: `cheat_${idSuffix}@gmail.com`,
          status: 'registered',
          dateCreated: new Date().toISOString().split('T')[0],
          lastUpdated: new Date().toISOString().split('T')[0],
          clicksCount: 1,
          firstTimeCommissionOf: 0,
          recurringCommissionOf: 0,
          totalPaymentsCompleted: 1, // Attempted payment
          fraudScore: 98, // Triggered fingerprinter block
          ipAddress: '127.0.0.1', // Same IP spoofed loopback
          isFlagged: true
        };
        nextRefs = [fraudUser, ...nextRefs];

        const blockedTx: ReferralTransaction = {
          id: `tx-fraud-${Date.now()}`,
          referredUserId: fraudUser.id,
          referredUserName: fraudUser.name,
          type: 'tier1_commission',
          amount: 500,
          status: 'flagged',
          timestamp: timestampStr,
          notes: 'BLOCKED: Multi-accounting pattern matching triggered.'
        };
        nextTxs = [blockedTx, ...nextTxs];

        nextAudits = [
          {
            id: `aud-frd-${Date.now()}`,
            timestamp: timestampStr,
            action: 'FRAUD_ENGAGE_BLOCK',
            details: `Device fingerprints verified self-referral attempt for ${mockName}. Access locked.`,
            category: 'security',
            severity: 'high'
          },
          ...nextAudits
        ];
      }

      setTransactions(nextTxs);
      setAuditLogs(nextAudits);
      persist(config, nextRefs, payoutDetails, payoutHistory, nextTxs, nextAudits);
      return nextRefs;
    });
  }, [config, transactions, auditLogs, payoutDetails, payoutHistory, persist]);

  // Compute metrics in real-time
  const calculatedMetrics = useMemo(() => {
    // Basic sums
    const totalLinkClicks = referrals.reduce((sum, r) => sum + r.clicksCount, 0);
    const totalSignups = referrals.filter(r => r.status !== 'clicked').length;
    const totalSubscribed = referrals.filter(r => r.totalPaymentsCompleted > 0 && !r.isFlagged).length;
    const activeSubscribers = referrals.filter(r => (r.status === 'subscribed' || r.status === 'renewed') && !r.isFlagged).length;
    
    // Percent formula division with safety guards
    const conversionRate = totalSignups > 0 
      ? Math.round((totalSubscribed / totalSignups) * 100) 
      : 0;

    const totalEarned = transactions
      .filter(t => t.status !== 'flagged' && t.status !== 'failed' && (t.type === 'tier1_commission' || t.type === 'recurring_commission'))
      .reduce((sum, current) => sum + current.amount, 0);

    const recurringEarned = transactions
      .filter(t => t.status !== 'flagged' && t.status !== 'failed' && t.type === 'recurring_commission')
      .reduce((sum, current) => sum + current.amount, 0);

    const pendingEarnings = transactions
      .filter(t => t.status === 'pending')
      .reduce((sum, current) => sum + current.amount, 0);

    const approvedEarnings = transactions
      .filter(t => t.status === 'approved')
      .reduce((sum, current) => sum + current.amount, 0);

    const paidEarnings = transactions
      .filter(t => t.status === 'paid')
      .reduce((sum, current) => sum + current.amount, 0);

    // Platform revenue generated
    const lifetimeRevenueGenerated = referrals
      .filter(r => !r.isFlagged)
      .reduce((sum, curr) => sum + (curr.totalPaymentsCompleted * config.subscriptionPrice), 0);

    // Current month filter (June 2026 for simulation)
    const monthlyEarnings = transactions
      .filter(t => t.timestamp.startsWith('2026-06') && t.status !== 'flagged' && t.status !== 'failed')
      .reduce((sum, curr) => sum + curr.amount, 0);

    const topPeriod = 'June 2026';

    return {
      totalReferrals: referrals.length,
      totalLinkClicks,
      totalSignups,
      totalSubscribed,
      activeSubscribers,
      conversionRate,
      totalEarned,
      recurringEarned,
      pendingEarnings,
      approvedEarnings,
      paidEarnings,
      lifetimeRevenueGenerated,
      monthlyEarnings,
      topPeriod
    };
  }, [referrals, transactions, config.subscriptionPrice]);

  return (
    <ReferralContext.Provider
      value={{
        config,
        referrals,
        payoutDetails,
        payoutHistory,
        transactions,
        auditLogs,
        referralCode,
        referralLink,
        metrics: calculatedMetrics,
        updateConfig,
        updatePayoutDetails,
        requestPayout,
        simulateReferralEvent,
        clearReferralState,
        clearToEmptyState,
        loadDemoData,
        triggerBatchPayoutCycle
      }}
    >
      {children}
    </ReferralContext.Provider>
  );
}

/**
 * Access hook for reading the single, central referral state.
 */
export function useReferrals() {
  const context = useContext(ReferralContext);
  if (context === undefined) {
    throw new Error('useReferrals must be used within a ReferralProvider');
  }
  return context;
}
