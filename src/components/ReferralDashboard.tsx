import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Share2, Copy, Check, Users, ShieldAlert, Award, Banknote, Ban, 
  TrendingUp, BarChart2, AlertCircle, Edit2, Settings, Landmark, History, 
  Play, CheckCircle, RefreshCw, Mail, HelpCircle, Server, Activity, ArrowUpRight,
  Circle, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useReferrals, ReferralUser, ReferralUserStatus, PayoutItem, ReferralTransaction } from '../lib/ReferralContext';
import { cn } from '../lib/utils';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';

/**
 * Renders the full-screen Referral Program dashboard, replacement for the "Invite Study Group" utility.
 * Implements full-scale metrics, referral links management, bank details editing, transaction ledgers,
 * real-time sandbox simulate utilities, and full security audit logging.
 */
export default function ReferralDashboard({ onBack }: { onBack: () => void }) {
  const {
    config,
    referrals,
    payoutDetails,
    payoutHistory,
    transactions,
    auditLogs,
    referralCode,
    referralLink,
    metrics,
    updateConfig,
    updatePayoutDetails,
    requestPayout,
    simulateReferralEvent,
    clearReferralState,
    clearToEmptyState,
    loadDemoData,
    triggerBatchPayoutCycle
  } = useReferrals();

  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'transactions' | 'payouts' | 'audit'>('overview');
  const [copied, setCopied] = useState(false);
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  
  // Bank Form States
  const [isEditingPayout, setIsEditingPayout] = useState(false);
  const [bankNameForm, setBankNameForm] = useState(payoutDetails.bankName);
  const [accountNumberForm, setAccountNumberForm] = useState(payoutDetails.accountNumber);
  const [accountNameForm, setAccountNameForm] = useState(payoutDetails.accountName);
  const [payoutMethodForm, setPayoutMethodForm] = useState(payoutDetails.payoutMethod);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Admin Variables Forms States
  const [commissionPctForm, setCommissionPctForm] = useState(config.commissionPercentage);
  const [subPriceForm, setSubPriceForm] = useState(config.subscriptionPrice);
  const [minThresholdForm, setMinThresholdForm] = useState(config.minWithdrawalThreshold);
  const [multiTierEnabled, setMultiTierEnabled] = useState(config.multiTierEnabled);
  const [secondTierForm, setSecondTierForm] = useState(config.secondTierPercentage);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState(false);

  // Cashout success alert state
  const [cashoutAlert, setCashoutAlert] = useState<{ show: boolean; success: boolean; message: string }>({ show: false, success: false, message: '' });

  /**
   * Copies the link to the user clipboard and flips state to show positive feedback.
   */
  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Persists bank details updates back onto the global state manager.
   */
  const handleSavePayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankNameForm || !accountNumberForm || !accountNameForm) return;
    updatePayoutDetails({
      bankName: bankNameForm,
      accountNumber: accountNumberForm,
      accountName: accountNameForm,
      payoutMethod: payoutMethodForm
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsEditingPayout(false);
    }, 1500);
  };

  /**
   * Persists back-end configurable rules onto the active context state.
   */
  const handleSaveAdminConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      commissionPercentage: Number(commissionPctForm),
      subscriptionPrice: Number(subPriceForm),
      minWithdrawalThreshold: Number(minThresholdForm),
      multiTierEnabled,
      secondTierPercentage: Number(secondTierForm)
    });
    setAdminSaveSuccess(true);
    setTimeout(() => setAdminSaveSuccess(false), 1500);
  };

  /**
   * Handles user cashout trigger action.
   */
  const handleCashout = () => {
    const success = requestPayout();
    if (success) {
      setCashoutAlert({
        show: true,
        success: true,
        message: 'Withdrawal requested successfully! Approved earnings are now in pending status.'
      });
    } else {
      setCashoutAlert({
        show: true,
        success: false,
        message: `Payout request denied. You must reach the minimum threshold of ₦${config.minWithdrawalThreshold.toLocaleString()} to withdraw.`
      });
    }
    setTimeout(() => setCashoutAlert(prev => ({ ...prev, show: false })), 5000);
  };

  /**
   * Prepares mock data for chart visuals based on referral records.
   */
  const chartData = useMemo(() => {
    // Generate simple timelines for Recharts area visualizations
    if (referrals.length === 0) {
      return [
        { name: 'Start', referrals: 0, earnings: 0 },
        { name: 'Milestone 1', referrals: 1, earnings: 500 },
        { name: 'Milestone 2', referrals: 3, earnings: 1500 },
        { name: 'Milestone 3', referrals: 6, earnings: 3000 },
        { name: 'Milestone 4', referrals: 10, earnings: 5000 }
      ];
    }
    return [
      { name: 'W1', referrals: 1, earnings: 500 },
      { name: 'W2', referrals: 2, earnings: 1000 },
      { name: 'W3', referrals: 2, earnings: 1000 },
      { name: 'W4', referrals: referrals.length, earnings: metrics.totalEarned }
    ];
  }, [referrals.length, metrics.totalEarned]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Header back navigation strip */}
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} id="btn-referrals-back" className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Affiliate Hub</h2>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">Programmatic Revenue Share System</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowAdminConsole(!showAdminConsole)}
          id="btn-toggle-admin-sandbox"
          className={cn(
            "p-2 px-3.5 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all",
            showAdminConsole 
              ? "bg-[#CCFF00] border-[#CCFF00] text-black" 
              : "bg-white/5 border-white/10 text-white/60 hover:text-white"
          )}
        >
          <Settings size={12} className={showAdminConsole ? "animate-spin" : ""} />
          Sandbox Control Panel
        </button>
      </header>

      {/* Admin variables & test simulator panel */}
      <AnimatePresence>
        {showAdminConsole && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card bg-[#CCFF00]/5 border-[#CCFF00]/20 rounded-[32px] p-6 space-y-6 mb-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-[#CCFF00]" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/80">Affiliate Administration & Test Simulator</h3>
                </div>
                <div className="text-[8px] font-mono bg-[#CCFF00]/10 text-[#CCFF00] px-2 py-1 rounded">ADMIN_MODE</div>
              </div>

              {/* Grid split for Simulator and settings editor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Live Rules and Variables Configuration */}
                <form onSubmit={handleSaveAdminConfig} className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Adjust Program Rules</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Commission rate %</label>
                      <input 
                        type="number" 
                        value={commissionPctForm} 
                        onChange={(e) => setCommissionPctForm(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#CCFF00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Monthly Plan Fee (₦)</label>
                      <input 
                        type="number" 
                        value={subPriceForm} 
                        onChange={(e) => setSubPriceForm(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#CCFF00] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Min Cashout Payout (₦)</label>
                      <input 
                        type="number" 
                        value={minThresholdForm} 
                        onChange={(e) => setMinThresholdForm(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#CCFF00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Multi-tier Structure</label>
                      <div className="flex items-center mt-2.5">
                        <input 
                          type="checkbox" 
                          checked={multiTierEnabled} 
                          onChange={(e) => setMultiTierEnabled(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-[10px] font-bold text-white/60">Enable Tier-2 (5%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button 
                      type="submit" 
                      className="bg-[#CCFF00] hover:bg-[#b5e000] text-black font-black uppercase tracking-widest text-[9px] px-4 py-2.5 rounded-xl transition-all"
                    >
                      Update Platform Settings
                    </button>
                    {adminSaveSuccess && (
                      <span className="text-[10px] font-bold text-[#CCFF00] flex items-center gap-1">
                        <CheckCircle size={12} /> Persisted successfully!
                      </span>
                    )}
                  </div>
                </form>

                {/* 2. Scenario simulation trigger sandbox */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-white/5 md:pl-6 pt-4 md:pt-0">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Scenario Interactive Sandbox</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                    Since the app runs in pre-production mode, run these actions below to mock real-time user conversions, renewals, and fraud safeguards:
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => simulateReferralEvent('click')}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] text-left p-2 rounded-xl flex items-center gap-2"
                    >
                      <Play size={10} className="text-[#CCFF00]" /> Unique click
                    </button>
                    <button 
                      onClick={() => simulateReferralEvent('signup')}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] text-left p-2 rounded-xl flex items-center gap-2"
                    >
                      <Play size={10} className="text-[#CCFF00]" /> Complete Sign-up
                    </button>
                    <button 
                      onClick={() => simulateReferralEvent('subscribe')}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] text-left p-2 rounded-xl flex items-center gap-2"
                    >
                      <Play size={10} className="text-[#CCFF00]" /> Paid Subscription (25%)
                    </button>
                    <button 
                      onClick={() => simulateReferralEvent('renew')}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-[10px] text-left p-2 rounded-xl flex items-center gap-2"
                    >
                      <Play size={10} className="text-[#CCFF00]" /> Monthly Renewal (₦500)
                    </button>
                    <button 
                      onClick={() => simulateReferralEvent('self_referral_fraud')}
                      className="col-span-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-[10px] text-left p-2 rounded-xl flex items-center gap-2"
                    >
                      <ShieldAlert size={12} className="text-red-400" /> Simulate Self-Referral Leak (Trigger block)
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1.5 justify-between">
                    <button 
                      type="button"
                      onClick={triggerBatchPayoutCycle}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-black uppercase tracking-widest text-[9px] px-3 py-2 rounded-lg transition-all"
                    >
                      Disburse Pending Payouts
                    </button>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={clearToEmptyState}
                        id="btn-admin-clear-to-empty"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-black uppercase tracking-widest text-[8px] px-2.5 py-2 rounded-lg transition-all"
                      >
                        Reset to True Empty State
                      </button>
                      <button 
                        type="button"
                        onClick={loadDemoData}
                        id="btn-admin-load-demo"
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 font-black uppercase tracking-widest text-[8px] px-2.5 py-2 rounded-lg transition-all"
                      >
                        Load Seeded Demo Data
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Referral Link & code Quick-action panel */}
      <section className="glass-card bg-opacity-40 p-6 rounded-[32px] border-none bg-white/[0.03] space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-white/50 mb-1">Share & Earn Commissions</h3>
          <p className="text-xs text-white/30 font-medium">
            Earn <strong>{config.commissionPercentage}% recurring commission</strong> (₦{Math.round(config.subscriptionPrice * (config.commissionPercentage / 100))} per cycle) on active paying users you introduce to Studibl Pro. No limits.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-black/30 border border-white/5 p-3 rounded-2xl flex justify-between items-center">
            <div className="truncate pr-2">
              <p className="text-[8px] font-black uppercase text-white/20 tracking-wider">Referral Link</p>
              <p className="text-xs font-bold text-white/80 select-all truncate">{referralLink}</p>
            </div>
            <button 
              onClick={handleCopyLink} 
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                copied ? "bg-[#CCFF00] text-black" : "bg-white/5 hover:bg-white/10 text-white/60"
              )}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          <div className="bg-black/30 border border-white/5 p-3 px-6 rounded-2xl flex items-center justify-between sm:w-48">
            <div>
              <p className="text-[8px] font-black uppercase text-white/20 tracking-wider">Your Code</p>
              <p className="text-lg font-black tracking-widest text-white">{referralCode}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
              <Award size={14} />
            </div>
          </div>
        </div>
      </section>

      {/* Cashout trigger feedback banners */}
      <AnimatePresence>
        {cashoutAlert.show && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-center gap-3 border",
              cashoutAlert.success 
                ? "bg-[#CCFF00]/10 border-[#CCFF00]/20 text-white" 
                : "bg-red-500/10 border-red-500/20 text-red-400"
            )}
          >
            <AlertCircle size={18} />
            <span className="text-xs font-bold">{cashoutAlert.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main financials and overview highlights grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="glass-card p-5 space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Total Referral Earnings</span>
            <p className="text-2xl font-black text-[#CCFF00] mt-1">₦{metrics.totalEarned.toLocaleString()}</p>
          </div>
          <span className="text-[8px] text-white/20 uppercase font-mono tracking-tight flex items-center gap-1">
            <TrendingUp size={10} className="text-[#CCFF00]" /> ₦{metrics.recurringEarned.toLocaleString()} recurring incl.
          </span>
        </div>

        <div className="glass-card p-5 space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Approved Cashout</span>
            <p className="text-2xl font-black text-white mt-1">₦{metrics.approvedEarnings.toLocaleString()}</p>
          </div>
          <button 
            onClick={handleCashout}
            id="btn-withdraw-referral-earnings"
            className="w-full py-1.5 rounded-lg bg-[#CCFF00] hover:bg-[#b5e000] text-black text-[9px] font-black uppercase tracking-widest transition-all text-center"
          >
            Cashout Earnings
          </button>
        </div>

        <div className="glass-card p-5 space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Pending In Review</span>
            <p className="text-2xl font-black text-white/60 mt-1">₦{metrics.pendingEarnings.toLocaleString()}</p>
          </div>
          <span className="text-[8px] text-white/20 uppercase font-mono tracking-tight block">
            Paid-out: ₦{metrics.paidEarnings.toLocaleString()}
          </span>
        </div>

        <div className="glass-card p-5 space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30 font-mono">Conversion Rate</span>
            <p className="text-2xl font-black text-[#CCFF00] mt-1">{metrics.conversionRate}%</p>
          </div>
          <span className="text-[8px] text-white/20 uppercase font-mono tracking-tight block">
            {metrics.activeSubscribers}/{metrics.totalSignups} Active paying
          </span>
        </div>

      </div>

      {/* Secondary Dashboard sections tab switcher */}
      <div className="flex border-b border-white/5 overflow-x-auto scrollbar-none gap-2">
        <TabButton title="Core Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <TabButton title="Referred Users" active={activeTab === 'referrals'} onClick={() => setActiveTab('referrals')} count={referrals.length} />
        <TabButton title="Earning Receipts" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} count={transactions.length} />
        <TabButton title="Payout Settings" active={activeTab === 'payouts'} onClick={() => setActiveTab('payouts')} />
        <TabButton title="Audit Guard logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} count={auditLogs.length} />
      </div>

      {/* Active screen content panel */}
      <div className="min-h-[220px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Launchpad Quest Card for Onboarding (Only shown when 0 referrals) */}
            {referrals.length === 0 && (
              <div className="glass-card bg-[#CCFF00]/5 border-[#CCFF00]/10 rounded-[32px] p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Award size={16} className="text-[#CCFF00] animate-pulse shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#CCFF00]">Your Referral Launchpad Quest</h4>
                    </div>
                    <p className="text-xs text-white/60 font-semibold">Complete these simple milestones to unlock your programmatic recurring 25% revenue share.</p>
                  </div>
                  <div className="shrink-0">
                    <button 
                      type="button"
                      onClick={() => setShowFaq(!showFaq)}
                      id="btn-learn-how-it-works"
                      className="text-[9px] bg-white/5 border border-white/10 text-white hover:text-[#CCFF00] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <HelpCircle size={11} />
                      {showFaq ? "Hide Program FAQ" : "Learn How It Works"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <QuestStep 
                    step={1}
                    title="Copy and Share Link"
                    description="Spread your unique invite link with university friends, student forums, or peer groups."
                    isCompleted={metrics.totalLinkClicks > 0 || copied}
                  />
                  <QuestStep 
                    step={2}
                    title="Get First Click Traffic"
                    description="A friend clicks your link to visit Studibl. Recorded automatically underneath clicks count."
                    isCompleted={metrics.totalLinkClicks > 0}
                  />
                  <QuestStep 
                    step={3}
                    title="Friend Sign-Up"
                    description="Your referred learner signs up on the portal. This logs them in your network pipeline."
                    isCompleted={metrics.totalSignups > 0}
                  />
                  <QuestStep 
                    step={4}
                    title="Earn ₦500 Commission"
                    description="Referred user upgrades to Studibl Pro (₦2,000). You earn ₦500 instantly, recurring monthly!"
                    isCompleted={metrics.totalSubscribed > 0}
                  />
                </div>
              </div>
            )}

            {/* FAQ Accordion sliding drawer section */}
            <AnimatePresence>
              {showFaq && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass-card bg-zinc-950/40 border border-white/5 rounded-[32px] p-6 space-y-6">
                    <div className="border-b border-white/5 pb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#CCFF00] flex items-center gap-1.5">
                        <HelpCircle size={14} /> Full Guide: How the Affiliate & Referral System Works
                      </h4>
                      <p className="text-[10px] text-white/40 font-medium mt-0.5">Program rules, transparency ledger guidelines, commission models, and anti-fraud safeguards</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h5 className="font-extrabold text-white/90">💸 What is my earning potential?</h5>
                          <p className="text-white/40 leading-relaxed font-semibold font-sans">
                            You receive a flat 25% commission on every single subscription fee paid by users referred via your link or code. With Studibl Pro priced at ₦2,000/month, you obtain ₦500 per successful payment.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h5 className="font-extrabold text-white/90">🔄 Are commissions recurring?</h5>
                          <p className="text-white/40 leading-relaxed font-semibold font-sans">
                            Yes! For every consecutive month your referred user stays active and completes their renewal subscription (₦2,000), you earn another ₦500. This builds compound passive revenue.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h5 className="font-extrabold text-white/90">💳 How do I request a withdrawal payout?</h5>
                          <p className="text-white/40 leading-relaxed font-semibold font-sans">
                            Once your approved earnings crosses the minimum threshold of ₦3,000, head to the Payout Settings tab to register your cashout destination and hit "Cashout Earnings". We disburse payouts securely inside 24 hours.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 border-t md:border-t-0 md:border-l border-white/5 md:pl-6 pt-4 md:pt-0">
                        <div className="space-y-1">
                          <h5 className="font-extrabold text-white/90 flex items-center gap-1">🔒 Anti-Fraud Safeguards</h5>
                          <p className="text-white/40 leading-relaxed font-semibold font-sans">
                            To prevent affiliate commission abuse, our backend analyzes device browser fingerprints, IP subnet similarities, and cookies in real-time. Self-referrals, duplicated register accounts, and fraudulent signup loops are flagged automatically, and commissions are blocked.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h5 className="font-extrabold text-white/90">🎯 Best practices to refer more friends</h5>
                          <p className="text-white/40 leading-relaxed font-semibold font-sans">
                            Share your link in WhatsApp class threads, university study groups (UNILAG, ABU, UI, FUTA, and more), or on physical flyers or Twitter. Highlight student benefits like real-time study streaks, gamified flashcards, and exam preparation guides on Studibl.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Funnel visualization logs */}
              <div className="glass-card p-6 rounded-[32px] md:col-span-2 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 flex justify-between">
                  <span>Referred Conversion Funnel Pipeline</span>
                  <span className="text-[#CCFF00]">June 2026 update</span>
                </h4>
                
                <div className="space-y-3.5">
                  <FunnelRow label="Total Referral Clicks" current={metrics.totalLinkClicks} max={metrics.totalLinkClicks || 10} color="bg-white/10 text-white/70" />
                  <FunnelRow label="Successful Sign-ups" current={metrics.totalSignups} max={metrics.totalLinkClicks || 10} color="bg-[#CCFF00]/10 text-white/80" />
                  <FunnelRow label="Paying Pro Subscribers" current={metrics.totalSubscribed} max={metrics.totalLinkClicks || 10} color="bg-brand-primary text-black" />
                  <FunnelRow label="Retained Renewals" current={metrics.activeSubscribers} max={metrics.totalLinkClicks || 10} color="bg-[#CCFF00] text-black" />
                </div>
              </div>

              {/* Conversion and Lifetime volume overview */}
              <div className="glass-card p-6 rounded-[32px] flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 block">Affiliate Metrics Recap</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40 font-bold">Monthly Earnings</span>
                      <span className="font-extrabold text-[#CCFF00]">₦{metrics.monthlyEarnings}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40 font-bold">Top Period</span>
                      <span className="font-extrabold text-white">{metrics.topPeriod}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40 font-bold">Platform Rev Volume</span>
                      <span className="font-extrabold text-white">₦{metrics.lifetimeRevenueGenerated}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 mb-[-4px]">
                  <p className="text-[8px] text-zinc-500 font-extrabold uppercase mb-1 flex items-center gap-1 leading-none">
                    <AlertCircle size={10} className="text-[#CCFF00]" /> Cashout Rules
                  </p>
                  <p className="text-[9px] text-white/30 font-medium leading-relaxed">
                    Withdrawal requests process in 24 hours. Minimal limit is ₦{config.minWithdrawalThreshold.toLocaleString()}. Multi-accounts check prevents self-referral leaks.
                  </p>
                </div>
              </div>
            </div>

            {/* Performance timeline projection / actual chart */}
            <div className="glass-card p-6 rounded-[32px] space-y-4 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  {referrals.length === 0 ? "Target Earning Projection model" : "Affiliate Volume Performance History"}
                </h4>
                {referrals.length === 0 && (
                  <span className="text-[8px] font-mono bg-[#CCFF00]/10 text-[#CCFF00] px-2 py-0.5 rounded uppercase font-bold">
                    AWAITING TRAFFIC
                  </span>
                )}
              </div>
              
              <div className="h-28 w-full relative">
                {referrals.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[1px] rounded-2xl z-10">
                    <p className="text-[9px] text-white bg-black/60 px-3 py-1.5 rounded-full border border-white/5 shadow-xl text-center font-semibold">
                      Your referred user data is empty. Below shows the target compounding progression!
                    </p>
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorEarn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CCFF00" stopOpacity={referrals.length === 0 ? 0.05 : 0.2}/>
                        <stop offset="95%" stopColor="#CCFF00" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: '12px' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: '10px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="earnings" 
                      stroke="#CCFF00" 
                      strokeWidth={2} 
                      strokeDasharray={referrals.length === 0 ? "4 4" : undefined}
                      fillOpacity={1} 
                      fill="url(#colorEarn)" 
                      name={referrals.length === 0 ? "Target Earnings (₦)" : "Earnings (₦)"} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Referred list tab */}
        {activeTab === 'referrals' && (
          <div className="glass-card !p-0 rounded-[32px] overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/[0.01]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Active Recipient Network Pipeline</h4>
            </div>
            
            <div className="divide-y divide-white/5">
              {referrals.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/30 mb-2">
                    <Users size={24} />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h5 className="text-sm font-black text-white/80">Your Affiliate Network is Empty</h5>
                    <p className="text-xs text-white/30 font-semibold leading-relaxed">
                      No referred student has registered or clicked your invite link yet. Share your link to build your cohort study group and earn recurring commissions!
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2 w-full justify-center">
                    <button 
                      type="button"
                      onClick={handleCopyLink}
                      className="text-[9px] bg-[#CCFF00] hover:bg-[#b5e000] text-black font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 justify-center"
                    >
                      <Copy size={11} /> Copy Invitation Link
                    </button>
                    <a 
                      href={`https://wa.me/?text=${encodeURIComponent(`Hey! Check out Studibl Pro for keeping your study streak tracker active and preparing for exams! Register via my affiliate link to join my cohort group: ${referralLink}`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[9px] bg-[#25D366]/20 border border-[#25D366]/30 text-white hover:bg-[#25D366]/30 font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 justify-center"
                    >
                      <Share2 size={11} /> Share on WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                referrals.map((user, uIdx) => (
                  <div key={`ref-user-${user.id || uIdx}-${uIdx}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                        user.status === 'subscribed' || user.status === 'renewed' 
                          ? "bg-[#CCFF00]/10 text-[#CCFF00]" 
                          : "bg-white/5 text-white/40"
                      )}>
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white/80">{user.name}</span>
                          {user.isFlagged && (
                            <span className="text-[8px] font-mono bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded leading-none">FLAGGED_RISK</span>
                          )}
                        </div>
                        <span className="text-xs text-white/30 font-medium block">{user.email}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-right">
                      <div>
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest block">Event status</span>
                        <StatusBadge status={user.status} />
                      </div>
                      
                      <div className="sm:text-right min-w-[80px]">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest block">IP Matches</span>
                        <span className="text-[10px] font-mono text-white/50">{user.ipAddress}</span>
                      </div>

                      <div className="sm:text-right min-w-[100px]">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest block">Earning Share</span>
                        <span className="font-black text-white">₦{(user.firstTimeCommissionOf + user.recurringCommissionOf).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Transactions / Earnings receipts logs */}
        {activeTab === 'transactions' && (
          <div className="glass-card !p-0 rounded-[32px] overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/[0.01]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Financial Share Allotment receipts</h4>
            </div>

            <div className="divide-y divide-white/5">
              {transactions.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-2">
                    <Activity size={20} />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h5 className="text-sm font-black text-white/80">No Commission Receipts Recorded</h5>
                    <p className="text-xs text-white/30 font-semibold leading-relaxed">
                      Earnings receipts appear here instantly when your referred friends complete payments and subscribe to Studibl Pro (₦2,000).
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-mono bg-[#CCFF00]/5 text-[#CCFF00] border border-[#CCFF00]/10 px-3 py-1.5 rounded-full font-bold">
                      ₦500 PER PAYMENT COMMISSION UNLOCKED
                    </span>
                  </div>
                </div>
              ) : (
                transactions.map((tx, tIdx) => (
                  <div key={`ref-tx-${tx.id || tIdx}-${tIdx}`} className="p-4 flex justify-between items-center gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        tx.status === 'flagged' ? "bg-red-500/10 text-red-400" : "bg-[#CCFF00]/10 text-[#CCFF00]"
                      )}>
                        ₦
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-white/80">{tx.referredUserName}</span>
                          <span className="text-[9px] bg-white/5 text-zinc-400 font-bold uppercase tracking-tight px-1.5 py-0.5 rounded leading-none">
                            {tx.type === 'tier1_commission' ? 'Tier 1' : 'Recurring renewal'}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/30 block mt-0.5">{tx.notes} • {tx.timestamp}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-white">₦{tx.amount}</p>
                      <span className={cn(
                        "text-[8px] font-bold uppercase tracking-widest",
                        tx.status === 'paid' && "text-[#CCFF00]",
                        tx.status === 'approved' && "text-blue-400",
                        tx.status === 'pending' && "text-orange-400",
                        tx.status === 'flagged' && "text-red-400"
                      )}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Payout Bank and History settings panel */}
        {activeTab === 'payouts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Payout Bank edit billing controls */}
            <div className="glass-card p-6 rounded-[32px] space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Settlement Destination Info</h4>
                {!isEditingPayout && (
                  <button 
                    onClick={() => setIsEditingPayout(true)}
                    id="btn-edit-payout"
                    className="text-[10px] text-[#CCFF00] font-black uppercase tracking-widest flex items-center gap-1"
                  >
                    <Edit2 size={10} /> Edit
                  </button>
                )}
              </div>

              {isEditingPayout ? (
                <form onSubmit={handleSavePayout} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Payment Method</label>
                    <select 
                      value={payoutMethodForm} 
                      onChange={(e) => setPayoutMethodForm(e.target.value as any)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      <option value="Bank Transfer">Bank Transfer (Nigeria / NGN)</option>
                      <option value="Mobile Money">Mobile Money (M-Pesa / MTN)</option>
                      <option value="PayPal">PayPal Business (USD)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Bank Name / Network Provider</label>
                    <input 
                      type="text" 
                      value={bankNameForm} 
                      onChange={(e) => setBankNameForm(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#CCFF00]"
                      placeholder="e.g. Access Bank Nigeria"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Account Number / Email Address</label>
                      <input 
                        type="text" 
                        value={accountNumberForm} 
                        onChange={(e) => setAccountNumberForm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white font-mono outline-none focus:border-[#CCFF00]"
                        placeholder="e.g. 0123456789"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Account Owner Full Name</label>
                      <input 
                        type="text" 
                        value={accountNameForm} 
                        onChange={(e) => setAccountNameForm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#CCFF00]"
                        placeholder="e.g. Alex Simmons"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button 
                      type="submit" 
                      className="bg-[#CCFF00] hover:bg-[#b5e000] text-black font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl transition-all"
                    >
                      Save Secure Details
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setIsEditingPayout(false)}
                      className="bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-black/30 border border-white/5 rounded-2xl flex items-center gap-3">
                    <Landmark size={24} className="text-[#CCFF00] shrink-0" />
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-[#CCFF00] tracking-wider leading-none">{payoutDetails.payoutMethod}</p>
                      <h4 className="text-sm font-bold mt-1 text-white">{payoutDetails.bankName}</h4>
                      <p className="text-xs text-white/50 font-mono mt-0.5">{payoutDetails.accountNumber}</p>
                      <p className="text-[10px] text-white/30 uppercase font-bold mt-1">Holder: {payoutDetails.accountName}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-[#CCFF00]/5 border border-[#CCFF00]/10 rounded-2xl flex gap-3">
                    <AlertCircle size={14} className="text-[#CCFF00] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-white/60 leading-relaxed font-semibold">
                      Please guarantee your payout details are accurate. Erroneous account logs result in transfer termination. Transactions are logged under audit compliance pipelines.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Cashout historical batch updates ledger */}
            <div className="glass-card p-6 rounded-[32px] space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 flex justify-between">
                <span>Withdrawal Cashouts History</span>
                <span className="text-[#CCFF00]">{payoutHistory.length} ledger logs</span>
              </h4>

              <div className="space-y-3 max-h-[320px] overflow-y-auto scrollbar-hide">
                {payoutHistory.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 animate-in fade-in duration-300">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                      <CreditCard size={16} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-white/70 font-bold">No Cashouts Initiated</p>
                      <p className="text-[10px] text-white/30 font-semibold max-w-[200px] leading-normal mx-auto">
                        Once your balance reaches ₦{config.minWithdrawalThreshold.toLocaleString()}, submit a withdrawal and it gets posted here.
                      </p>
                    </div>
                  </div>
                ) : (
                  payoutHistory.map((pay, pIdx) => (
                    <div key={`ref-pay-${pay.id || pIdx}-${pIdx}`} className="p-3 bg-black/20 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <span className="font-extrabold text-white">₦{pay.amount}</span>
                        <p className="text-[9px] text-zinc-500 font-bold block">{pay.reference} • {pay.dateRequested}</p>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest",
                        pay.status === 'paid' && "text-[#CCFF00]",
                        pay.status === 'pending' && "text-orange-400"
                      )}>
                        {pay.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* Audit compliance tracking logs */}
        {activeTab === 'audit' && (
          <div className="glass-card !p-0 rounded-[32px] overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                System Audit Trail Compliance logs
              </h4>
              <span className="text-[8px] font-mono text-zinc-500">SECURE_TUNNEL_RSA_2048</span>
            </div>

            <div className="divide-y divide-white/5 max-h-[350px] overflow-y-auto scrollbar-hide text-xs">
              {auditLogs.map((log, lIdx) => (
                <div key={`ref-log-${log.id || lIdx}-${lIdx}`} className="p-4 flex items-start gap-3">
                  <Activity size={12} className={cn(
                    "mt-0.5 shrink-0",
                    log.severity === 'high' && "text-red-400",
                    log.severity === 'medium' && "text-orange-400",
                    log.severity === 'low' && "text-brand-secondary"
                  )} />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-white/70">{log.action}</span>
                      <span className={cn(
                        "text-[8px] font-mono px-1.5 rounded uppercase leading-none font-bold",
                        log.category === 'security' && "bg-red-500/10 text-red-400",
                        log.category === 'financial' && "bg-green-500/10 text-green-400",
                        log.category === 'user_event' && "bg-blue-500/10 text-blue-400"
                      )}>
                        {log.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/50 font-bold mt-1 leading-relaxed">{log.details}</p>
                    <span className="text-[8px] text-zinc-600 font-mono mt-0.5 block">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tab controller element styled for high accuracy dark sleek layouts.
 */
function TabButton({ title, active, onClick, count }: { title: string, active: boolean, onClick: () => void, count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "py-3.5 px-3.5 text-[10px] font-black uppercase tracking-widest text-white shrink-0 outline-none select-none border-b-2 transition-all flex items-center gap-1.5",
        active ? "border-[#CCFF00] text-white" : "border-transparent text-white/40 hover:text-white/60"
      )}
    >
      {title}
      {count !== undefined && (
        <span className={cn(
          "text-[8px] px-1.5 py-0.5 rounded-full font-sans font-bold",
          active ? "bg-[#CCFF00] text-black" : "bg-white/5 text-white/40"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Status design tags wrapping user timeline logs.
 */
function StatusBadge({ status }: { status: ReferralUserStatus }) {
  return (
    <span className={cn(
      "text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full",
      status === 'clicked' && "bg-white/5 text-white/40",
      status === 'registered' && "bg-blue-500/10 text-blue-400",
      status === 'subscribed' && "bg-green-500/10 text-green-400",
      status === 'renewed' && "bg-[#CCFF00]/10 text-[#CCFF00]",
      status === 'inactive' && "bg-red-500/10 text-red-400"
    )}>
      {status === 'registered' ? 'Signed up' : status}
    </span>
  );
}

/**
 * Funnel conversion row visualizing the marketing pipeline drop-offs.
 */
function FunnelRow({ label, current, max, color }: { label: string, current: number, max: number, color: string }) {
  const percent = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-white/40 font-bold uppercase">{label}</span>
        <span className="font-extrabold text-white/80">{current.toLocaleString()} users</span>
      </div>
      
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}

/**
 * Interactive checklist milestone indicator showing visual complete state for onboarding.
 */
function QuestStep({ step, title, description, isCompleted }: { step: number; title: string; description: string; isCompleted: boolean }) {
  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full min-h-[140px]",
      isCompleted 
        ? "bg-[#CCFF00]/10 border-[#CCFF00]/20 text-white" 
        : "bg-white/[0.01] border-white/5 text-white/50"
    )}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[9px] font-mono uppercase font-black tracking-widest px-1.5 py-0.5 rounded",
            isCompleted ? "bg-[#CCFF00] text-black" : "bg-white/10 text-white/40"
          )}>
            STEP 0{step}
          </span>
          {isCompleted ? (
            <CheckCircle size={14} className="text-[#CCFF00] shrink-0" />
          ) : (
            <Circle size={14} className="text-white/25 shrink-0" />
          )}
        </div>
        <h5 className="text-[11px] font-black uppercase tracking-wider text-white/95">{title}</h5>
        <p className="text-[10px] leading-relaxed font-semibold text-white/40">{description}</p>
      </div>
    </div>
  );
}
