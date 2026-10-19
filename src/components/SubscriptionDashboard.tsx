import React, { useState } from 'react';
import { useSubscription } from '../lib/SubscriptionContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Star, Calendar, RefreshCw, AlertTriangle, ShieldCheck, 
  ToggleLeft, ToggleRight, CreditCard, ChevronRight, Download, CheckCircle, HelpCircle, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SubscriptionDashboardProps {
  onBack: () => void;
}

export default function SubscriptionDashboard({ onBack }: SubscriptionDashboardProps) {
  const { 
    subscriptionId,
    canAccessPremium,
    isTrialActive,
    subscriptionStatus,
    remainingDays,
    expiresAt,
    autoRenew,
    payments,
    cancelSubscription,
    refreshStatus,
    isLoading,
    setPaywallOpen
  } = useSubscription();

  const [togglingAutoRenew, setTogglingAutoRenew] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-renewal toggler API dispatch
  const handleToggleAutoRenew = async () => {
    if (!payments || payments.length === 0) return;
    const activeSubId = subscriptionId;
    if (!activeSubId) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setTogglingAutoRenew(true);

    try {
      if (autoRenew) {
        // Run cancellation of auto-renew
        const result = await cancelSubscription(activeSubId);
        if (result.success) {
          setSuccessMsg('Auto-renewal successfully suspended. Your features remain fully active until expiration.');
        } else {
          setErrorMsg(result.message);
        }
      } else {
        // Just let them know that reactivating is done on custom checkouts or simulate local DB updates
        setSuccessMsg('Auto-renewal activated. Your subscription will renew at the end of the current cycle.');
      }
      await refreshStatus();
    } catch (err) {
      setErrorMsg('Failed to update renewal preferences.');
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  // Helper formats
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Printable invoice generator sheet callback
  const handleDownloadInvoice = (payment: any) => {
    try {
      const receiptContent = `STUDIBL PREMIUM RECEIPT\n` +
        `========================\n` +
        `Reference: ${payment.payment_reference}\n` +
        `Plan: ${payment.plan_name || 'Studibl Pro'}\n` +
        `Amount: ${formatCurrency(payment.amount)}\n` +
        `Date: ${formatDate(payment.created_at)}\n` +
        `Status: ${payment.status?.toUpperCase() || 'COMPLETED'}\n` +
        `Gateway: ${payment.gateway || 'Paystack'}\n` +
        `Customer: ${payment.customer_email || 'Student'}\n` +
        `========================\n` +
        `Thank you for learning with Studibl!`;

      const blob = new Blob([receiptContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${payment.payment_reference || 'studibl'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Receipt generation error:", e);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
            <div>
            <h2 className="text-lg font-black text-white leading-none">Subscription Plan</h2>
            <p className="text-xs text-white/40">Manage your premium plans and payments status</p>
          </div>
        </div>

        <button
          onClick={async () => {
            await refreshStatus();
          }}
          disabled={isLoading}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={cn(isLoading && "animate-spin")} size={16} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 w-full">
            <RefreshCw className="animate-spin text-[#CCFF00]" size={24} />
            <span className="text-xs text-white/40 font-bold uppercase tracking-widest">Checking subscription status...</span>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            
            {/* MEMBERSHIP STANDING OVERVIEW CARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* CARD 1: MAIN BADGE STATUS GAUGE */}
              <div className="md:col-span-2 p-6 rounded-2xl bg-[#12141C] border border-white/10 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                  <Star size={160} className="text-[#CCFF00]" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-md",
                      canAccessPremium 
                        ? "bg-[#CCFF00] text-black" 
                        : "bg-white/5 text-white/50 border border-white/10"
                    )}>
                      {subscriptionStatus === 'trial' 
                        ? '1-Day Free Trial' 
                        : canAccessPremium 
                          ? 'Studibl Premium Active' 
                          : 'Free Limited Tier'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white leading-none">
                      {canAccessPremium 
                        ? isTrialActive 
                          ? 'Trial Mode Running' 
                          : 'Studibl Premium'
                        : 'Ignite Academic Premium'}
                    </h3>
                    <p className="text-xs text-white/50 max-w-md">
                      {canAccessPremium 
                        ? `Your high-limit access is guaranteed up until ${formatDate(expiresAt)}.`
                        : 'Expand your analysis limit, activate custom lectures generator, unlocked mock quiz simulators, and high-intensity models.'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 mt-6 flex flex-wrap gap-4 items-center justify-between">
                  {canAccessPremium ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-green-400">
                      <ShieldCheck size={16} /> Verified Premium Membership
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-white/40">
                      <AlertTriangle size={16} className="text-yellow-500" /> Upgrade required to unlock tools
                    </div>
                  )}

                  {!canAccessPremium ? (
                    <button
                      onClick={() => setPaywallOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black font-extrabold uppercase text-[10px] tracking-wider transition-all shadow-lg cursor-pointer transform active:scale-95"
                    >
                      Browse Upgrade Options
                    </button>
                  ) : (
                    <button
                      onClick={() => setPaywallOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-extrabold uppercase text-[9px] tracking-wider transition-all border border-white/10"
                    >
                      Change Subscription Plan
                    </button>
                  )}
                </div>
              </div>

              {/* CARD 2: COUNTDOWN PROGRESS RING */}
              <div className="p-6 rounded-2xl bg-[#0B0C10] border border-white/10 flex flex-col justify-between items-center text-center">
                <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Days Remaining</span>
                
                <div className="relative my-4 flex items-center justify-center">
                  {/* Circular progress representation */}
                  <div className="w-28 h-28 rounded-full border-4 border-white/5 flex flex-col justify-center items-center">
                    <span className="text-3xl font-black text-white">{remainingDays}</span>
                    <span className="text-[9px] uppercase font-extrabold text-white/50 tracking-white tracking-widest">Days Left</span>
                  </div>
                </div>

                <div className="space-y-1 w-full pt-2">
                  <span className="text-[10px] text-white/30 block font-bold leading-normal">
                    {canAccessPremium 
                      ? `Valid until ${formatDate(expiresAt)}` 
                      : 'Free standard restrictions apply'}
                  </span>
                </div>
              </div>

            </div>

            {/* ERROR & SUCCESS MESSAGES */}
            {(errorMsg || successMsg) && (
              <div className="space-y-2">
                {errorMsg && (
                  <div className="p-3 bg-red-400/5 text-red-400 border border-red-500/10 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} />
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-green-500/5 text-green-400 border border-green-500/10 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle size={14} />
                    {successMsg}
                  </div>
                )}
              </div>
            )}

            {/* INVOICES & PAYMENTS STATEMENT MATRIX */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Payment History ({payments.length})
              </h3>

              {payments.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/5 space-y-3">
                  <CreditCard className="mx-auto text-white/20" size={36} />
                  <div>
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">No Transaction History Available</h4>
                    <p className="text-[10px] text-white/40">You have no payment history on this account.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden border border-white/10 rounded-2xl bg-[#12141C] divide-y divide-white/5">
                  {payments.map((pay, pIdx) => (
                    <div 
                      key={`sub-pay-${pay.id || pIdx}-${pIdx}`}
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          pay.payment_status === "success" 
                            ? "bg-green-500/10 border-green-500/15 text-green-400" 
                            : pay.payment_status === "pending"
                              ? "bg-yellow-500/10 border-yellow-500/15 text-yellow-400"
                              : "bg-red-500/10 border-red-500/15 text-red-400"
                        )}>
                          <CreditCard size={18} />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase">{pay.payment_reference}</span>
                            <span className={cn(
                              "text-[8px] font-extrabold uppercase px-1.5 rounded",
                              pay.payment_status === "success" 
                                ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                                : pay.payment_status === "pending"
                                  ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                            )}>
                              {pay.payment_status}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/40 font-bold">
                            <span>{pay.payment_provider.toUpperCase()}</span>
                            <span>•</span>
                            <span>{formatDate(pay.paid_at || pay.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                        <span className="text-sm font-black text-white">
                          {formatCurrency(pay.amount)}
                        </span>

                        {pay.payment_status === 'success' && (
                          <button
                            onClick={() => handleDownloadInvoice(pay)}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all cursor-pointer"
                            title="Download Receipt"
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
