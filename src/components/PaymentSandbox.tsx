import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, CreditCard, Lock, RefreshCw, CheckCircle, AlertTriangle, 
  ArrowLeft, Landmark, Zap, Wifi 
} from 'lucide-react';

export default function PaymentSandbox() {
  const [params, setParams] = useState<{
    reference: string;
    amount: string;
    planId: string;
    provider: string;
    email: string;
  } | null>(null);

  const [cardName, setCardName] = useState('STUDIBL STUDENT');
  const [cardNumber, setCardNumber] = useState('5061 1234 5678 9012');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCVV, setCardCVV] = useState('123');

  const [settling, setSettling] = useState(false);
  const [resultState, setResultState] = useState<'idle' | 'success' | 'failed'>('idle');
  const [feedMessage, setFeedMessage] = useState('');

  // Extract URL queries on mount
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const reference = q.get('reference') || '';
    const amount = q.get('amount') || '';
    const planId = q.get('planId') || '';
    const provider = q.get('provider') || 'paystack';
    const email = q.get('email') || '';

    if (reference) {
      setParams({ reference, amount, planId, provider, email });
    }
  }, []);

  const handleSimulateSettlement = async (isSuccess: boolean) => {
    if (!params) return;
    setSettling(true);
    setFeedMessage(isSuccess ? 'Authorizing secure sandbox settlement...' : 'Authorizing payment rejection...');

    try {
      if (isSuccess) {
        // Dispatch verifier request to backend to test DB integrations
        const res = await fetch('/api/subscription/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reference: params.reference,
            paymentProvider: params.provider
          })
        });

        const body = await res.json();
        if (res.ok && body.success) {
          setResultState('success');
          setFeedMessage('Authorization Successful! Studibl Premium has been provisioned and matching badges awarded.');
        } else {
          setResultState('failed');
          setFeedMessage(body.error || 'Server rejected verification code.');
        }
      } else {
        // Simulate local failure
        setResultState('failed');
        setFeedMessage('Transaction aborted by student. No charges have been authorized.');
      }
    } catch (err: any) {
      setResultState('failed');
      setFeedMessage('Server communication error.');
    } finally {
      setSettling(false);
    }
  };

  const handleReturnToApp = () => {
    // Redirect cleanly to home view removing sandbox queries
    window.location.href = '/';
  };

  if (!params) {
    return (
      <div className="min-h-screen bg-[#07080D] flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <AlertTriangle className="mx-auto text-yellow-500" size={32} />
          <h2 className="text-lg font-black text-white">Invalid Checkout Session</h2>
          <button onClick={handleReturnToApp} className="px-4 py-2 bg-white/5 rounded-xl text-xs text-white">Return Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080D] text-white flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
      
      {/* GLOWS */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#CCFF00]/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#12141C] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
      >
        
        {/* TOP CO-BRANDING */}
        <div className="p-5 bg-black/40 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#CCFF00]/10 text-[#CCFF00] rounded-lg">
              <Landmark size={16} />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-[#CCFF00]">
              {params.provider.toUpperCase()} SECURE GATEWAY
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-bold uppercase tracking-widest">
            <Wifi size={12} className="text-green-500" />
            TEST SANDBOX
          </div>
        </div>

        {/* CONTAINER */}
        <div className="p-6 space-y-6">
          
          {/* STATE DISPATCH PANEL */}
          {resultState === 'idle' ? (
            <div className="space-y-6">
              
              {/* BILL DETAILS */}
              <div className="text-center space-y-1 py-2">
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Invoicing Outstanding</span>
                <h1 className="text-3xl font-black text-white m-0">₦{Number(params.amount).toLocaleString()}</h1>
                <p className="text-xs text-white/50">{params.email}</p>
                <div className="inline-block px-2.5 py-0.5 bg-white/5 rounded text-[10px] text-white/40 font-mono mt-2">
                  REF: {params.reference}
                </div>
              </div>

              {/* CARD PREVIEW DESIGN */}
              <div className="p-5 rounded-2xl bg-gradient-to-tr from-brand-primary/10 via-brand-secondary/5 to-white/5 border border-white/15 space-y-6 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] uppercase font-black text-white/30 tracking-widest">Studibl Settlement Card</span>
                  <Landmark size={18} className="text-[#CCFF00]" />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-white/40 font-bold block">Card Number</label>
                  <input 
                    type="text" 
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="bg-transparent border-0 p-0 text-md font-bold font-mono text-white focus:ring-0 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] uppercase text-white/40 font-bold block">Cardholder</label>
                    <input 
                      type="text" 
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      className="bg-transparent border-0 p-0 text-xs font-bold text-white focus:ring-0 w-full uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase text-white/40 font-bold block">Expiry</label>
                      <input 
                        type="text" 
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="bg-transparent border-0 p-0 text-xs font-bold font-mono text-white focus:ring-0 w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase text-white/40 font-bold block">CVV</label>
                      <input 
                        type="password" 
                        value={cardCVV}
                        maxLength={3}
                        onChange={(e) => setCardCVV(e.target.value)}
                        className="bg-transparent border-0 p-0 text-xs font-bold font-mono text-white focus:ring-0 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION CALL TRIGGERS */}
              <div className="space-y-3 Pt-2">
                <button
                  disabled={settling}
                  onClick={() => handleSimulateSettlement(true)}
                  className="w-full py-4 rounded-xl bg-[#CCFF00] hover:bg-[#CCFF00]/95 text-black font-extrabold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#CCFF00]/10 disabled:opacity-40"
                >
                  {settling ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} /> Settling...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} /> Simulate Success Settlement
                    </>
                  )}
                </button>

                <button
                  disabled={settling}
                  onClick={() => handleSimulateSettlement(false)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-red-400 font-bold text-xs uppercase cursor-pointer disabled:opacity-40 text-center block border border-dashed border-red-500/20"
                >
                  Simulate Declined / Cancel Payment
                </button>
              </div>

            </div>
          ) : resultState === 'success' ? (
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="py-6 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 mx-auto flex items-center justify-center shadow-lg shadow-green-500/5">
                <CheckCircle size={32} />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-black text-white tracking-tight">Payment Settled !</h2>
                <p className="text-xs text-white/40 uppercase font-mono tracking-widest">{params.reference}</p>
                <p className="text-xs text-white/60 px-4 pt-2 leading-relaxed">
                  {feedMessage}
                </p>
              </div>

              <button
                onClick={handleReturnToApp}
                className="w-full py-3.5 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider hover:bg-white/90 transition-all cursor-pointer block text-center shadow-xl shadow-white/5"
              >
                Return to Studibl Profile
              </button>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="py-6 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mx-auto flex items-center justify-center shadow-lg shadow-red-500/5">
                <AlertTriangle size={32} />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-black text-white tracking-tight">Payment Declined</h2>
                <p className="text-xs text-white/40 uppercase font-mono tracking-widest">{params.reference}</p>
                <p className="text-xs text-red-400 px-4 pt-2 leading-relaxed">
                  {feedMessage}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setResultState('idle');
                    setFeedMessage('');
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase cursor-pointer"
                >
                  Retry Payment
                </button>
                <button
                  onClick={handleReturnToApp}
                  className="flex-1 py-3.5 rounded-xl bg-white text-black font-bold text-xs uppercase cursor-pointer"
                >
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-black/20 border-t border-white/5 text-center text-[9px] text-white/30 flex items-center justify-center gap-1.5 uppercase font-bold tracking-wider">
          <Lock size={10} className="text-[#CCFF00]" />
          End-to-end sandbox SSL match encryption active
        </div>

      </motion.div>

    </div>
  );
}
