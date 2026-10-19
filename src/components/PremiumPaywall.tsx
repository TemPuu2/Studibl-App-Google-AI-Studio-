import React, { useState } from 'react';
import { useSubscription } from '../lib/SubscriptionContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Check, ChevronRight, HelpCircle, AlertCircle, X, Shield, 
  Layers, Brain, FileText, BarChart2, Star, RefreshCw 
} from 'lucide-react';

interface PremiumPaywallProps {
  onClose?: () => void;
}

export default function PremiumPaywall({ onClose }: PremiumPaywallProps) {
  const { 
    hasUsedTrial, 
    activateTrial, 
    initiatePayment, 
    isLoading 
  } = useSubscription();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('monthly_premium');
  const [selectedProvider, setSelectedProvider] = useState<'paystack' | 'flutterwave'>('paystack');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  // Marketing premium package list
  const PLANS = [
    {
      id: 'free_trial',
      name: '1-Day Free Trial',
      price: '₦0',
      period: '24 Hours',
      description: 'Experience unlimited standard AI Tutor operations clean and barrier-free.',
      badge: 'Test Drive',
      disabled: hasUsedTrial,
      priceNum: 0
    },
    {
      id: 'monthly_premium',
      name: 'Monthly Premium',
      price: '₦2,000',
      period: '30 Days',
      description: 'Complete premium academic intelligence, automatic index modeling, and auto-renewals.',
      badge: 'Popular',
      disabled: false,
      priceNum: 2000
    },
    {
      id: 'semester_premium',
      name: 'Semester Premium',
      price: '₦7,000',
      period: '1 Semester (120 Days)',
      description: 'Absolute high-limit access. One single safe payment covering your entire university term.',
      badge: 'Best Value',
      disabled: false,
      priceNum: 7000
    }
  ];

  // Core high-value marketing bullet points
  const PREMIUM_FEATURES = [
    { 
      icon: <Brain className="text-[#CCFF00]" size={18} />, 
      title: 'Unlimited AI Scholar Tutor', 
      desc: 'Deep multi-modal material mining, formula proof models, concept expansion, and quiz generators.' 
    },
    { 
      icon: <Layers className="text-[#CCFF00]" size={18} />, 
      title: 'Complete Course Materials', 
      desc: 'Automatic parsing of dense PDFs, lectures, presentations, and dynamic knowledge graph structures.' 
    },
    { 
      icon: <Star className="text-[#CCFF00]" size={18} />, 
      title: 'GPA Forecasting & Insights', 
      desc: 'Intelligent predictive analysis under the Nigerian 5.00 CGPA standard with weak-topic remediation indexes.' 
    },
    { 
      icon: <BarChart2 className="text-[#CCFF00]" size={18} />, 
      title: 'Unlimited Practice Arena', 
      desc: 'Receive adaptive mock examinations, custom problem sheets, and advanced conceptual review guidance.' 
    }
  ];

  const handleCheckout = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setLocalLoading(true);

    try {
      if (selectedPlanId === 'free_trial') {
        if (hasUsedTrial) {
          setErrorMessage('Prevent Abuse: You have already used your trial quota on this account.');
          setLocalLoading(false);
          return;
        }
        
        const result = await activateTrial();
        if (result.success) {
          setInfoMessage('Success! Your 1-Day Trial has been activated successfully. All premium barriers have been temporarily dismantled.');
          if (onClose) {
            setTimeout(() => onClose(), 2000);
          }
        } else {
          setErrorMessage(result.message);
        }
      } else {
        // Upgrade flow via Bank payment
        const result = await initiatePayment(selectedPlanId, selectedProvider);
        if (result.success && result.checkoutUrl) {
          setInfoMessage('Opening payment portal securely... Please wait.');
          // Redirect user securely to payment checkout or sandbox handler
          window.location.href = result.checkoutUrl;
        } else {
          setErrorMessage(result.error || 'Server error initializing checkout sequence.');
        }
      }
    } catch (err: any) {
      setErrorMessage('Critical communication error. Try reloading page.');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md"
    >
      <div className="flex min-h-screen justify-center items-start md:items-center p-3 sm:p-4 md:p-6 lg:p-8">
        <motion.div 
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-4xl bg-[#12141C] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row my-auto"
        >
        
        {/* CLOSE BUTTON */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}

        {/* LEFT COLUMN: BRAND MARKETING */}
        <div className="w-full md:w-[45%] bg-[#0B0C10] p-5 sm:p-6 lg:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#CCFF00]/10 text-[#CCFF00]">
                <Sparkles size={20} />
              </span>
              <span className="font-extrabold uppercase text-xs tracking-widest text-[#CCFF00]">
                STUDIBL PREMIUM
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight leading-none">
                Elevate Your Academic Potential
              </h2>
              <p className="text-white/60 text-xs">
                Unlock the complete Studibl suite of elite AI educational utilities. Built specifically to secure first-class results.
              </p>
            </div>

            {/* SECTIONS Bulletins List */}
            <div className="space-y-5 pt-2">
              {PREMIUM_FEATURES.map((feat, index) => (
                <div key={index} className="flex gap-3">
                  <div className="shrink-0 p-1.5 bg-white/5 rounded-lg h-9 w-9 flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white leading-normal">{feat.title}</h4>
                    <p className="text-[10px] text-white/45 leading-normal">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 mt-6 md:mt-2">
            <div className="flex items-center gap-2 text-white/40 text-[10px] font-bold">
              <Shield size={12} className="text-[#CCFF00]" />
              Secure Bank Clearance & Data Policies
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PACKAGE CHOOSER & PAYMENT */}
        <div className="w-full md:w-[55%] p-5 sm:p-6 lg:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3">
                1. Select Pricing Plan
              </h3>
              
              <div className="space-y-3">
                {PLANS.map((plan, pIdx) => (
                  <button
                    key={`paywall-plan-${plan.id || pIdx}-${pIdx}`}
                    disabled={plan.disabled}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2.5 cursor-pointer select-none ${
                      plan.disabled 
                        ? 'opacity-40 bg-white/5 border-white/5 cursor-not-allowed' 
                        : selectedPlanId === plan.id
                          ? 'border-[#CCFF00] bg-[#CCFF00]/5 shadow-lg shadow-[#CCFF00]/5'
                          : 'border-white/10 hover:border-white/20 bg-white/5'
                    }`}
                  >
                    {/* Header Row: radio, plan label, badge, and pricing information */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
                      {/* Checkbox state indicator and text labels */}
                      <div className="flex items-center gap-3">
                        {/* Custom radio button design */}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          selectedPlanId === plan.id ? 'border-[#CCFF00]' : 'border-white/30'
                        }`}>
                          {selectedPlanId === plan.id && (
                            <div className="w-2 h-2 rounded-full bg-[#CCFF00]" />
                          )}
                        </div>
                        
                        {/* Title and Badge inline pack to support clean wrapping without absolute positioning overlaps */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-white">
                            {plan.name}
                          </span>
                          {plan.badge && !plan.disabled && (
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest bg-[#CCFF00] text-black shadow-md shrink-0">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pricing block - right aligned on wider screens, inline on mobile */}
                      <div className="pl-7 sm:pl-0 sm:text-right shrink-0">
                        <div className="flex items-baseline gap-1.5 justify-start sm:justify-end">
                          <span className="text-base sm:text-lg font-black text-white">{plan.price}</span>
                          <span className="text-[10px] text-white/50 font-semibold">/ {plan.period}</span>
                        </div>
                      </div>
                    </div>

                    {/* Marketing Description - Indented horizontally to match radio spacing cleanly */}
                    <p className="text-[11px] text-white/45 pl-7 leading-relaxed">
                      {plan.disabled ? 'Already utilized quota on this account.' : plan.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* BILLING CHANNEL SELECTOR */}
            {selectedPlanId !== 'free_trial' && (
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3">
                  2. Gateways Settlement Provider
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    onClick={() => setSelectedProvider('paystack')}
                    className={`p-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer leading-tight ${
                      selectedProvider === 'paystack'
                        ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    Paystack NGN Channel
                  </button>
                  <button
                    onClick={() => setSelectedProvider('flutterwave')}
                    className={`p-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer leading-tight ${
                      selectedProvider === 'flutterwave'
                        ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    Flutterwave NGN Channel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/5 mt-6 space-y-4">
            {/* ALERT BOXES */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-start gap-2"
                >
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {infoMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs flex items-start gap-2"
                >
                  <Check size={14} className="shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleCheckout}
              disabled={isLoading || localLoading}
              className="w-full p-4 rounded-2xl bg-[#CCFF00] hover:bg-[#CCFF00]/95 text-black font-extrabold uppercase text-xs tracking-wider transition-all shadow-xl shadow-[#CCFF00]/10 hover:shadow-[#CCFF00]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {(isLoading || localLoading) ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Procuring Secure Interface...
                </>
              ) : selectedPlanId === 'free_trial' ? (
                'Activate Lifetime Free Trial'
              ) : (
                `Initiate Premium Checkout (${selectedPlanId === 'monthly_premium' ? '₦2,000' : '₦7,000'})`
              )}
            </button>

            <p className="text-[9px] text-white/30 text-center leading-normal">
              By initiating checkout, you accept Studibl Terms and confirm your payment authorization detail. All private transactions processed under end-to-end HTTPS. Unutilized trials expire autonomously.
            </p>
          </div>

        </div>

      </motion.div>
      </div>
    </motion.div>
  );
}
