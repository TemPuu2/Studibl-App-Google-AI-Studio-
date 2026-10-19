import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { isRealUserSession } from './supabaseService';
import type { SubscriptionPlan, PaymentReceipt, SubscriptionContextType } from '../types';

// Create context matching structure defined in types.ts
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Hook to easily consume billing status inside components
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

/**
 * Provider that manages active subscriptions, payment sessions, and gates.
 * Seamlessly interfaces with Paystack, Flutterwave, and sandbox overrides.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  
  // Define local core states
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [canAccessPremium, setCanAccessPremium] = useState<boolean>(false);
  const [isTrialActive, setIsTrialActive] = useState<boolean>(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('free');
  const [remainingDays, setRemainingDays] = useState<number>(0);
  const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState<boolean>(false);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaywallOpen, setPaywallOpen] = useState<boolean>(false);

  // Retrieve authorization header helper
  const getAuthHeader = () => {
    if (!session?.access_token) return {};
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  };

  /**
   * Refetches latest subscription details and invoice logs from server-side
   */
  const refreshStatus = async () => {
    if (!user) {
      setSubscriptionId(null);
      setCanAccessPremium(false);
      setIsTrialActive(false);
      setHasActiveSubscription(false);
      setSubscriptionStatus('free');
      setRemainingDays(0);
      setHasUsedTrial(false);
      setCurrentPlan(null);
      setExpiresAt(null);
      setAutoRenew(false);
      setPayments([]);
      setIsLoading(false);
      return;
    }

    // For sandbox/guest users, apply immediate full-featured access without server roundtrip
    if (!isRealUserSession(user.id) || session?.access_token === 'sandbox-token') {
      setSubscriptionId('sub_sandbox_lifetime');
      setCanAccessPremium(true);
      setIsTrialActive(true);
      setHasActiveSubscription(true);
      setSubscriptionStatus('active');
      setRemainingDays(30);
      setHasUsedTrial(true);
      setCurrentPlan({
        id: 'pro',
        name: 'Studibl Pro (Sandbox)',
        description: 'Full sandbox access for testing',
        price: 0,
        duration_days: 30,
        plan_type: 'monthly',
        active: true
      });
      setPayments([]);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch main active subscription standings
      const response = await fetch('/api/subscription/status', {
        headers: getAuthHeader()
      });

      if (response.ok) {
        const body = await response.json();
        if (body.success) {
          setSubscriptionId(body.subscriptionId);
          setCanAccessPremium(body.canAccessPremium);
          setIsTrialActive(body.isTrialActive);
          setHasActiveSubscription(body.hasActiveSubscription);
          setSubscriptionStatus(body.subscriptionStatus);
          setRemainingDays(body.remainingDays);
          setHasUsedTrial(body.hasUsedTrial);
          setCurrentPlan(body.currentPlan);
          setExpiresAt(body.expiresAt);
          setAutoRenew(body.autoRenew);
        }
      } else {
        // Fallback for fresh installation prior to DB setup
        console.warn('[SubscriptionContext] API status returned non-200. Applying safe fallback state.');
        setCanAccessPremium(true); // Allow testing in fallback mode out of the box
        setSubscriptionStatus('active');
      }

      // 2. Fetch invoicing records
      const paymentsResponse = await fetch('/api/subscription/payments', {
        headers: getAuthHeader()
      });

      if (paymentsResponse.ok) {
        const pBody = await paymentsResponse.json();
        if (pBody.success) {
          setPayments(pBody.payments || []);
        }
      }

    } catch (err) {
      console.warn('[SubscriptionContext] Subscription sync offline or network unreachable. Applying offline fallback state:', err);
      setCanAccessPremium(true);
      setSubscriptionStatus('active');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Triggers lifetime free-trial activation
   */
  const activateTrial = async (): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/subscription/activate-trial', {
        method: 'POST',
        headers: getAuthHeader()
      });

      const body = await res.json();
      if (res.ok && body.success) {
        await refreshStatus();
        return { success: true, message: body.message };
      } else {
        return { success: false, message: body.error || 'Failed to activate free trial.' };
      }
    } catch (err: any) {
      console.error('Trial activation failed on context:', err);
      return { success: false, message: 'Server communication error while starting trial.' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initializes transaction gateways
   */
  const initiatePayment = async (
    planId: string,
    provider: 'paystack' | 'flutterwave'
  ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
    try {
      setIsLoading(true);
      const hostOrigin = window.location.origin;
      const res = await fetch('/api/subscription/initiate-payment', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({
          planId,
          paymentProvider: provider,
          originUrl: hostOrigin
        })
      });

      const body = await res.json();
      if (res.ok && body.success) {
        return { success: true, checkoutUrl: body.checkoutUrl };
      } else {
        return { success: false, error: body.error || 'Failed to initialize payment gateway.' };
      }
    } catch (err: any) {
      console.error('Payment initiation failure on context:', err);
      return { success: false, error: 'A communication error interrupted connection to the bank.' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verifies payment reference on returning to site
   */
  const verifyPayment = async (
    reference: string,
    provider: 'paystack' | 'flutterwave'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/subscription/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference, paymentProvider: provider })
      });

      const body = await res.json();
      if (res.ok && body.success) {
        await refreshStatus();
        return { success: true, message: body.message };
      } else {
        return { success: false, message: body.error || 'Unable to confirm receipt with settlement bank.' };
      }
    } catch (err: any) {
      console.error('Payment verification failed on context:', err);
      return { success: false, message: 'A communication error stopped verification actions.' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Suspends auto-renew for user plan
   */
  const cancelSubscription = async (subscriptionId: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ subscriptionId })
      });

      const body = await res.json();
      if (res.ok && body.success) {
        await refreshStatus();
        return { success: true, message: body.message };
      } else {
        return { success: false, message: body.error || 'Deactivation failed.' };
      }
    } catch (err: any) {
      console.error('Cancellation failed:', err);
      return { success: false, message: 'Server communication error.' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state with active user presence
  useEffect(() => {
    if (user) {
      refreshStatus();
    } else {
      setIsLoading(false);
    }
  }, [user, session]);

  // Handle auto-verification from gateway redirects (?payment_verify=true)
  useEffect(() => {
    const checkRedirectVerify = async () => {
      const params = new URLSearchParams(window.location.search);
      const verify = params.get('payment_verify');
      const reference = params.get('reference');
      const provider = params.get('provider') as any;

      if (verify === 'true' && reference) {
        console.log('[Verification Loop] Checking redirect reference:', reference, provider);
        const result = await verifyPayment(reference, provider || 'paystack');
        
        // Remove verification parameters from url cleanly to prevent replay attacks on page refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        if (result.success) {
          console.log(`[Subscription Verification Success]: ${result.message}`);
          await refreshStatus();
        } else {
          console.warn(`[Subscription Verification Issue]: ${result.message}`);
        }
      }
    };

    if (user) {
      checkRedirectVerify();
    }
  }, [user]);

  // Aggregate values
  const value: SubscriptionContextType = {
    subscriptionId,
    canAccessPremium,
    isTrialActive,
    hasActiveSubscription,
    subscriptionStatus,
    remainingDays,
    hasUsedTrial,
    currentPlan,
    expiresAt,
    autoRenew,
    payments,
    isLoading,
    isPaywallOpen,
    setPaywallOpen,
    activateTrial,
    initiatePayment,
    verifyPayment,
    cancelSubscription,
    refreshStatus
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
