import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  User, Book, Award, Bell, Shield, LogOut, Brain, ChevronRight,
  WifiOff, ArrowLeft, Mail, Lock, Phone, Save,
  AlertTriangle, GraduationCap, Medal, Star, TrendingUp, Calendar,
  Target, Zap, Activity, Check, AlertCircle, Database, Globe, Eye, EyeOff, Camera,
  Users, Sun, Moon, Contrast
} from 'lucide-react';
import { BADGE_REGISTRY, Badge } from '../lib/badgeSystem';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useOffline } from '../lib/useOffline';
import { useStreak } from '../lib/StreakContext';
import { useStats } from '../lib/StatsContext';
import { calculateLevelFromXP } from '../lib/levelSystem';
import { supabase } from '../supabaseClient';
import { isRealUserSession } from '../lib/supabaseService';
import ReferralDashboard from './ReferralDashboard';
import { useAcademicIntelligence } from '../lib/AcademicIntelligenceContext';
import PredictiveAcademicDashboard from './PredictiveAcademicDashboard';
import { useSubscription } from '../lib/SubscriptionContext';
import SubscriptionDashboard from './SubscriptionDashboard';
import { useTheme } from '../lib/ThemeContext';



/**
 * Utility function to strip occurrences of "Department of" and "Faculty of" ignoring case.
 */
function cleanDepartmentOrFaculty(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .replace(/(Department of|Faculty of)\s*/gi, '')
    .trim();
}

/**
 * Define the possible sub-views within the authenticated profile screen
 */
type ProfileView = 'main' | 'edit-profile' | 'notifications' | 'security' | 'enrolled' | 'certificates' | 'privacy' | 'about' | 'referrals-dashboard' | 'academic-intelligence' | 'billing' | 'display-theme';

/**
 * Main authenticated User Profile component.
 * Refactored to be 100% database-driven using live Supabase data.
 * Features an initials-based avatar, real-time syncing, and clear English copywriting.
 */
export default function Profile() {
  const isOffline = useOffline();
  const { theme, setTheme, toggleTheme, isLight } = useTheme();
  const { user, signOut, refreshUser } = useAuth();
  const { canAccessPremium } = useSubscription();
  const { currentClassification = 'Second Class' } = useAcademicIntelligence() || {};
  const { streak = 0 } = useStreak() || {};
  const { 
    awardedBadges: statsContextBadges,
    totalXP: statsContextXP,
    level: statsContextLevel,
    rankTitle: statsContextRankTitle,
    overallAccuracy: statsContextAccuracy
  } = useStats() || {};

  // State verification: log whenever totalXP synchronizes into Profile component
  useEffect(() => {
    console.log(`[Profile:XP] State verified: Provider totalXP synchronized in Profile = ${statsContextXP ?? 0} (Lvl ${statsContextLevel ?? 1} ${statsContextRankTitle ?? 'Student'})`);
  }, [statsContextXP, statsContextLevel, statsContextRankTitle]);

  // Check if session belongs to an authenticated DB user
  const isRealUser = useMemo(() => !!(user && isRealUserSession(user.id)), [user]);

  // DB stats & profile states
  const [profile, setProfile] = useState<any>(() => {
    let initialProfile: any = null;
    if (user) {
      initialProfile = {
        full_name: user?.user_metadata?.full_name || '',
        avatar_url: null,
        contact_number: user?.user_metadata?.contact_number || '',
        major: user?.user_metadata?.major || ''
      };
    }
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('studibl_avatar_cache');
        if (cached) {
          if (!initialProfile) initialProfile = {};
          initialProfile.avatar_url = cached;
        }
      } catch (e) {}
    }
    return initialProfile;
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);

  // Bottom-sheet and closeup viewer states
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  // Synchronize dynamic badges and courses state without falling back to any static course lists
  useEffect(() => {
    if (!isRealUser && user) {
      if (statsContextBadges) {
        setBadges(statsContextBadges);
      }
      const onboardingCourses = (user?.user_metadata?.selected_courses || [])
        .filter((c: any) => {
          if (typeof c === 'string') return c !== 'My Uploads';
          if (c && typeof c === 'object') return (c.name !== 'My Uploads' && c.code !== 'My Uploads' && c.id !== 'My Uploads');
          return true;
        });
      setCourses(onboardingCourses);
    }
  }, [user, isRealUser, statsContextBadges]);
  const [notifications, setNotifications] = useState<any>({
    studyReminders: true,
    courseProgress: true,
    missionUpdates: true,
    newDeviceLogin: true,
    accountActivity: true,
    hapticFeedback: true
  });
  
  const [loading, setLoading] = useState(false); // Render layout immediately
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ProfileView>('main');

  // References and states for direct profile picture upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Trigger scroll to top whenever changing inner nested views
  useEffect(() => {
    const container = document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeView]);

  /**
   * Securely uploads selected user images to Supabase Storage inside the isolated app-files bucket folder.
   * Utilizes a cache-busting timestamp query parameter to ensure immediate UI synchronization across the app.
   */
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      setUploadingAvatar(true);
      setErrorStatus(null);
      playHapticFeedback();

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `${user!.id}/avatar-${Date.now()}.${fileExt}`;

      // Delete old avatar from storage first if it was a relative private path
      const oldAvatarPath = user?.user_metadata?.avatar_url;
      if (oldAvatarPath && !oldAvatarPath.startsWith('http') && !oldAvatarPath.startsWith('data:')) {
        try {
          await supabase.storage.from('app-files').remove([oldAvatarPath]);
        } catch (delErr) {
          console.warn("Could not remove old private avatar from Storage:", delErr);
        }
      }

      // Upload file to Supabase storage 'app-files' bucket under auth.uid() folder
      const { error: uploadError } = await supabase.storage
        .from('app-files')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Upsert backend user profile row with raw storage file path
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: user!.id,
          avatar_url: filePath,
          updated_at: new Date().toISOString()
        });
      
      if (profileErr) throw profileErr;

      // Sync auth user metadata with the raw storage path
      await supabase.auth.updateUser({
        data: { avatar_url: filePath }
      });

      // Synchronize other screens in real time
      await refreshUser();

      // Reload primary profile data to update layout
      await fetchAllProfileData(user!.id);
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      setErrorStatus(err.message || 'Avatar file upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  /**
   * Loads all statistics, profiles, selected courses, and badge achievements 
   * directly from Supabase DB tables in a unified, verified pipeline.
   */
  const fetchAllProfileData = async (userId: string) => {
    setErrorStatus(null);
    try {
      // 1. Query primary academic 'profiles' record
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profileErr) throw profileErr;
      
      if (profileRow) {
        // Resolve private relative avatar_url using signed URL
        if (profileRow.avatar_url && !profileRow.avatar_url.startsWith('http') && !profileRow.avatar_url.startsWith('data:')) {
          try {
            const { data: signedData, error: signErr } = await supabase.storage
               .from('app-files')
              .createSignedUrl(profileRow.avatar_url, 60 * 60 * 24); // 24 hours of signature
            if (!signErr && signedData?.signedUrl) {
              profileRow.avatar_url = signedData.signedUrl;
              try {
                localStorage.setItem('studibl_avatar_cache', signedData.signedUrl);
              } catch (e) {}
            }
          } catch (signErr) {
            console.error("Failed to sign avatar path:", signErr);
          }
        } else if (profileRow.avatar_url) {
          try {
            localStorage.setItem('studibl_avatar_cache', profileRow.avatar_url);
          } catch (e) {}
        }
        setProfile(profileRow);
      } else {
        // Check if metadata avatar can be used
        const localCached = typeof window !== 'undefined' ? localStorage.getItem('studibl_avatar_cache') : null;
        if (localCached) {
          setProfile({ avatar_url: localCached });
        } else {
          setProfile(null);
        }
      }

      // 2. Fetch earned badges from awarded_badges table
      const { data: badgesData, error: badgesErr } = await supabase
        .from('awarded_badges')
        .select('*')
        .eq('user_id', userId);
      if (badgesErr) throw badgesErr;

      // Extract dynamic records with no dummy/placeholder badge data fallbacks
      const mappedBadges = (badgesData || []).map(award => {
        const reg = BADGE_REGISTRY[award.badge_id];
        if (!reg) return null;
        return {
          ...reg,
          awardedAt: award.awarded_at,
          reason: award.reason || 'Requirement met.'
        };
      }).filter(Boolean);
      setBadges(mappedBadges);

      // 3. Resolve active enrolled courses from user onboarding selection
      const onboardingCourses = (user?.user_metadata?.selected_courses || [])
        .filter((c: any) => {
          if (typeof c === 'string') return c !== 'My Uploads';
          if (c && typeof c === 'object') return (c.name !== 'My Uploads' && c.code !== 'My Uploads' && c.id !== 'My Uploads');
          return true;
        });

      if (onboardingCourses.length > 0) {
        setCourses(onboardingCourses);
      } else {
        const { data: dbCoursesRes, error: coursesErr } = await supabase
          .from('recent_courses')
          .select('course_name')
          .eq('user_id', userId);
        
        if (!coursesErr && dbCoursesRes && dbCoursesRes.length > 0) {
          const filteredDbCourses = dbCoursesRes
            .map(item => item.course_name)
            .filter(name => name !== 'My Uploads');
          setCourses(filteredDbCourses);
        } else {
          setCourses([]);
        }
      }

      // 4. Load experience metrics
      const { data: statsRow, error: statsErr } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!statsErr && statsRow) {
        setDbStats(statsRow);
      }

      // 5. Query saved notification states
      if (user?.user_metadata?.notifications) {
        setNotifications({
          studyReminders: user.user_metadata.notifications.studyReminders !== false,
          courseProgress: user.user_metadata.notifications.courseProgress !== false,
          missionUpdates: user.user_metadata.notifications.missionUpdates !== false,
          newDeviceLogin: user.user_metadata.notifications.newDeviceLogin !== false,
          accountActivity: user.user_metadata.notifications.accountActivity !== false,
          hapticFeedback: user.user_metadata.notifications.hapticFeedback !== false,
        });
      }
    } catch (e: any) {
      console.error('Error synchronising profile data tables:', e);
      setErrorStatus(e.message || 'Unable to retrieve your profile details.');
    }
  };

  // Mount/load tracker 
  useEffect(() => {
    if (isRealUser && user) {
      fetchAllProfileData(user.id);
    }
  }, [user, isRealUser]);

  // Handle case where user does not have any active session
  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-transparent text-center space-y-6 font-sans">
        <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl relative group">
          <Shield className="text-[#CCFF00]" size={48} />
          <div className="absolute inset-0 bg-[#CCFF00]/10 blur-xl rounded-full opacity-10" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Login Required</h3>
          <p className="text-xs text-white/40 leading-relaxed font-semibold">
            Please log in with an authorized student account to customize and sync your statistics.
          </p>
        </div>
      </div>
    );
  }

  // Display diagnostic load errors if table query failed
  if (errorStatus && !profile && isRealUser) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 font-sans">
        <AlertCircle size={40} className="text-red-400" />
        <div className="space-y-1">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Synchronization Error</h3>
          <p className="text-xs text-white/40 max-w-xs">{errorStatus}</p>
        </div>
        <button 
          onClick={() => user && fetchAllProfileData(user.id)}
          className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Resolve user values strictly from Supabase profile queries & auth metadata without static fallback defaults
  const nameLabel = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Student';
  const rawDepartmentLabel = profile?.major || user?.user_metadata?.major || user?.user_metadata?.department || null;
  const rawFacultyLabel = profile?.faculty || user?.user_metadata?.faculty || null;
  const departmentLabel = rawDepartmentLabel ? cleanDepartmentOrFaculty(rawDepartmentLabel) : null;
  const facultyLabel = rawFacultyLabel ? cleanDepartmentOrFaculty(rawFacultyLabel) : null;

  // Level calculations from dynamic database XP
  const totalXP = statsContextXP ?? 0;
  const levelDetails = calculateLevelFromXP(totalXP);
  const level = levelDetails.level;
  const rankTitle = levelDetails.rankTitle || 'Student';

  // Overall accuracy based on live stats or local session performance
  const overallAccuracy = statsContextAccuracy ?? 0;

  /**
   * Generates display initials representing full name.
   * "Michael Jackson" -> MJ   "Michael" -> M
   */
  const getInitials = (fullNameStr: string) => {
    const name = fullNameStr || 'Student';
    const cleanName = name.includes('@') ? name.split('@')[0] : name;
    const clean = cleanName.trim();
    const parts = clean.split(/[\s._+-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return clean.substring(0, 1).toUpperCase();
  };

  /**
   * Play dynamic haptic vibration if enabled
   */
  const playHapticFeedback = () => {
    if (notifications.hapticFeedback && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(12);
      } catch (e) {
        // Suppress errors during sandboxed runs
      }
    }
  };

  const handleLinkClick = (view: ProfileView) => {
    playHapticFeedback();
    setActiveView(view);
  };

  const renderView = () => {
    switch (activeView) {
      case 'billing':
        return (
          <SubscriptionDashboard 
            onBack={() => handleLinkClick('main')}
          />
        );
      case 'edit-profile':
        return (
          <EditProfile 
            onBack={() => handleLinkClick('main')} 
            user={user} 
            profile={profile} 
            facultyLabel={facultyLabel}
            onProfileUpdated={async () => {
              await refreshUser();
              if (user) fetchAllProfileData(user.id);
            }} 
            playHaptic={playHapticFeedback}
            onUploadClick={() => setIsAvatarMenuOpen(true)}
            uploadingAvatar={uploadingAvatar}
          />
        );
      case 'notifications':
        return (
          <NotificationSettings 
            onBack={() => handleLinkClick('main')} 
            user={user}
            savedNotifications={notifications}
            playHaptic={playHapticFeedback}
          />
        );
      case 'security':
        return (
          <SecuritySettings 
            onBack={() => handleLinkClick('main')} 
            user={user} 
            playHaptic={playHapticFeedback}
            signOut={() => signOut()}
          />
        );
      case 'enrolled':
        return <EnrolledCourses onBack={() => handleLinkClick('main')} courses={courses} />;
      case 'certificates':
        return <CertificatesAndBadges onBack={() => handleLinkClick('main')} earnedBadges={badges} />;
      case 'privacy':
        return <PrivacyPolicy onBack={() => handleLinkClick('main')} />;
      case 'about':
        return <AboutStudibl onBack={() => handleLinkClick('main')} />;
      case 'referrals-dashboard':
        return <ReferralDashboard onBack={() => handleLinkClick('main')} />;
      case 'academic-intelligence':
        return <PredictiveAcademicDashboard onBack={() => handleLinkClick('main')} />;
      case 'display-theme':
        return <DisplayThemeSettings onBack={() => handleLinkClick('main')} playHaptic={playHapticFeedback} />;
      default:
        return (
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* Header Initials Avatar Section */}
            <div className="flex flex-col items-center">
              <div 
                className="relative mb-4 cursor-pointer group" 
                onClick={() => setIsAvatarMenuOpen(true)}
              >
                <div className="absolute inset-0 bg-brand-primary/20 blur-2xl rounded-full scale-110 animate-pulse" />
                
                <div className="relative w-28 h-28 rounded-full border-4 border-brand-primary flex items-center justify-center bg-black overflow-hidden shadow-xl">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="Profile Avatar" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-brand-primary text-black font-extrabold text-3xl select-none">
                      {getInitials(nameLabel)}
                    </div>
                  )}

                  {/* High Quality Camera Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white animate-bounce" size={24} />
                  </div>
                </div>

                {/* Sub-absolute upload pen edit emblem in corner */}
                <div className="absolute bottom-1 right-1 p-2 bg-brand-primary text-black rounded-full border-2 border-black shadow-lg transition-transform group-hover:scale-110">
                  <Camera size={14} />
                </div>
              </div>

              {/* Hidden HTML input for device file picker/gallery selection */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload}
                accept="image/*" 
                className="hidden" 
              />

              {/* Hidden HTML input with user capture flag for instant camera triggering */}
              <input 
                type="file" 
                ref={takePhotoInputRef} 
                onChange={handleAvatarUpload}
                accept="image/*" 
                capture="user"
                className="hidden" 
              />
              
              {uploadingAvatar && (
                <div className="text-[10px] text-brand-primary font-mono tracking-widest uppercase animate-pulse mb-2">
                  Uploading Image...
                </div>
              )}

              <h1 className="text-2xl font-bold text-white text-center mt-2">{nameLabel}</h1>
              
              <p className="text-sm text-white/45 mb-6 text-center">
                {rankTitle}
                {departmentLabel && " • "}
                {departmentLabel ? (
                  <span className="text-white/80 font-semibold">{departmentLabel}</span>
                ) : (
                  <span className="text-zinc-500 italic">No academic details</span>
                )}
              </p>
              
              {/* Level progress */}
              <div className="w-full max-w-xs mb-8">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">Level {level}</span>
                    <span className="text-[10px] font-bold text-white/20">{totalXP.toLocaleString()} XP</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-primary transition-all duration-500" 
                      style={{ width: `${levelDetails.progressPercentage}%` }}
                    />
                 </div>
              </div>

              {/* Dynamic stats direct from Supabase */}
              <div className="grid grid-cols-3 gap-6 w-full max-w-xs mb-10">
                <StatMini label="Courses" value={courses.length.toString()} />
                <StatMini label="Accuracy" value={`${Math.round(overallAccuracy)}%`} />
                <StatMini label="Streak" value={streak.toString()} />
              </div>

               {/* Personal Badges unlocked inside database */}
               <div className="w-full">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4 px-4 flex items-center justify-between">
                     <span>Earned Badges</span>
                     <span className="text-[9px] font-mono text-brand-primary lowercase font-normal">{badges.length} unlocked</span>
                  </h3>
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4">
                     {badges.length === 0 ? (
                        <div className="text-center py-6 px-4 w-full border border-dashed border-white/5 bg-white/[0.01] rounded-2xl">
                           <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-1">No Achievements Yet</p>
                           <p className="text-[9px] text-white/30 max-w-xs mx-auto text-center font-medium leading-relaxed">
                             Complete quizzes and lessons to unlock your first achievement badge!
                           </p>
                        </div>
                     ) : (
                        badges.map((badge, bIdx) => (
                            <div 
                              key={`profile-badge-${badge.id || bIdx}-${bIdx}`} 
                             className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer" 
                             onClick={() => handleLinkClick('certificates')}
                           >
                              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border border-white/5 shadow-xl transition-all group-hover:scale-110", badge.bg)}>
                                 <BadgeIcon iconName={badge.iconName} size={22} className={badge.color} />
                              </div>
                              <span className="text-[9px] font-bold text-white/60 whitespace-nowrap tracking-tight group-hover:text-white transition-colors">{badge.name}</span>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>

            {/* Guest Sandbox Callout Banner for quick register/sign up for authentication */}
            {!isRealUser && (
              <div id="sandbox-guest-banner" className="p-5 rounded-2xl bg-brand-primary/5 border border-brand-primary/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#CCFF00]">Guest Sandbox Mode</h4>
                  <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                    You are in guest mode. Log out to register or sign up for a persistent student account.
                  </p>
                </div>
                <button
                  id="btn-sandbox-signup"
                  onClick={async () => {
                    playHapticFeedback();
                    await signOut();
                    window.location.reload();
                  }}
                  className="shrink-0 px-4 py-2 bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg active:scale-95"
                >
                  Sign Up Now
                </button>
              </div>
            )}

            {/* Link Navigation Controls */}
            <div className="space-y-6">
              <div className={cn("space-y-6", isOffline && "opacity-50")}>
                <Section title="Account Settings">
                  <MenuLink icon={<User size={18} className="text-brand-primary" />} title="Personal Information" detail="Verified" onClick={() => handleLinkClick('edit-profile')} disabled={isOffline} />
                  <MenuLink icon={<Brain size={18} className="text-brand-primary" />} title="Academic Intelligence" detail={currentClassification} onClick={() => handleLinkClick('academic-intelligence')} disabled={isOffline} />
                  <MenuLink icon={<Book size={18} className="text-brand-primary" />} title="Enrolled Courses" detail={`${courses.length} active`} onClick={() => handleLinkClick('enrolled')} disabled={isOffline} />
                  <MenuLink icon={<Award size={18} className="text-brand-primary" />} title="Earned Badges" detail={`${badges.length} earned`} onClick={() => handleLinkClick('certificates')} disabled={isOffline} />
                  <MenuLink icon={<Users size={18} className="text-brand-primary" />} title="Referral Program" detail="Earn commissions" onClick={() => handleLinkClick('referrals-dashboard')} disabled={isOffline} />
                  <MenuLink icon={<Star size={18} className="text-brand-primary" />} title="Subscription" detail={canAccessPremium ? "Premium Active" : "Upgrade Status"} onClick={() => handleLinkClick('billing')} disabled={isOffline} />
                </Section>

                {/* Theme & Display Mode Switcher */}
                <Section title="Appearance & Display">
                  <div className="p-4 space-y-4 font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                          theme === 'light' 
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" 
                            : "bg-white/5 text-brand-primary border border-white/10"
                        )}>
                          {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                        </div>
                        <div>
                          <span className={cn("text-sm font-bold block", theme === 'light' ? "text-slate-900" : "text-white/90")}>
                            Theme Mode
                          </span>
                          <span className={cn("text-[11px] block font-medium", theme === 'light' ? "text-slate-500" : "text-white/40")}>
                            {theme === 'light' ? 'High-Contrast Light Mode' : 'Cyber Dark Mode'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Interactive toggle pill */}
                      <button
                        id="btn-quick-theme-toggle"
                        onClick={() => {
                          playHapticFeedback();
                          toggleTheme();
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 shadow-sm border cursor-pointer",
                          theme === 'light'
                            ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700"
                            : "bg-brand-primary text-black border-brand-primary/40 hover:brightness-110"
                        )}
                        title="Toggle Dark/Light Mode"
                      >
                        {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />}
                        <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
                      </button>
                    </div>

                    {/* Segmented Dual Theme Option Cards */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* Dark Theme Button */}
                      <button
                        id="btn-select-dark-theme"
                        onClick={() => {
                          playHapticFeedback();
                          setTheme('dark');
                        }}
                        className={cn(
                          "p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[92px] group active:scale-[0.98] cursor-pointer",
                          theme === 'dark'
                            ? "bg-white/[0.08] border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.15)] ring-1 ring-[#CCFF00]/40"
                            : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04] opacity-70"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-black border border-white/20 flex items-center justify-center text-brand-primary">
                              <Moon size={13} />
                            </div>
                            <span className="text-xs font-black text-white">Dark</span>
                          </div>
                          {theme === 'dark' && (
                            <span className="w-4 h-4 rounded-full bg-[#CCFF00] text-black flex items-center justify-center">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/50 leading-tight font-medium">
                          Deep neon blacks. Low eye strain in dark rooms.
                        </p>
                      </button>

                      {/* High-Contrast Light Mode Button */}
                      <button
                        id="btn-select-light-theme"
                        onClick={() => {
                          playHapticFeedback();
                          setTheme('light');
                        }}
                        className={cn(
                          "p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[92px] group active:scale-[0.98] cursor-pointer",
                          theme === 'light'
                            ? "bg-emerald-50 border-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/40"
                            : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04] opacity-70"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                              <Sun size={13} />
                            </div>
                            <span className={cn("text-xs font-black", theme === 'light' ? "text-slate-900" : "text-white")}>
                              Light
                            </span>
                          </div>
                          {theme === 'light' && (
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className={cn("text-[10px] leading-tight font-medium", theme === 'light' ? "text-slate-600" : "text-white/50")}>
                          High contrast. Maximum sunlight & daylight clarity.
                        </p>
                      </button>
                    </div>

                    {/* Subtext explaining environmental benefit */}
                    <div className={cn(
                      "p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors",
                      theme === 'light'
                        ? "bg-slate-50 border-slate-200 text-slate-700"
                        : "bg-white/[0.02] border-white/5 text-white/40"
                    )}>
                      <Contrast size={13} className={theme === 'light' ? "text-emerald-600 shrink-0" : "text-brand-primary shrink-0"} />
                      <span className="text-[10.5px] leading-snug font-medium">
                        {theme === 'light'
                          ? "High-contrast light mode provides maximum clarity in direct sunlight and bright lecture rooms."
                          : "Cyber dark mode optimizes battery life and reduces glare during late study hours."}
                      </span>
                    </div>
                  </div>
                </Section>

                <Section title="System Preferences">
                  <MenuLink 
                    icon={theme === 'light' ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-brand-primary" />} 
                    title="Display & Contrast" 
                    detail={theme === 'light' ? "High-Contrast Light" : "Dark Mode"} 
                    onClick={() => handleLinkClick('display-theme')} 
                    disabled={isOffline} 
                  />
                  <MenuLink icon={<Bell size={18} className="text-brand-primary" />} title="Notifications & Haptics" onClick={() => handleLinkClick('notifications')} disabled={isOffline} />
                  <MenuLink icon={<Shield size={18} className="text-brand-primary" />} title="Privacy Policy" onClick={() => handleLinkClick('privacy')} disabled={isOffline} />
                  <MenuLink icon={<Lock size={18} className="text-brand-primary" />} title="Update Password" onClick={() => handleLinkClick('security')} disabled={isOffline} />
                  <MenuLink icon={<Globe size={18} className="text-brand-primary" />} title="About Studibl" onClick={() => handleLinkClick('about')} disabled={isOffline} />
                </Section>
              </div>

              {/* Instant Redundant Log Out component is active regardless of any device offline network parameters */}
              <Section>
                <button 
                  id="btn-profile-logout"
                  onClick={async () => {
                    playHapticFeedback();
                    await signOut();
                    window.location.reload();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-500/5 text-red-400 border border-red-500/10 hover:bg-red-500/10 transition-all font-bold text-sm cursor-pointer text-left"
                >
                  <span className="flex items-center gap-3">
                    <LogOut size={18} /> Log Out
                  </span>
                  <ChevronRight size={16} />
                </button>
              </Section>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full px-6 pt-3 pb-6 overflow-y-auto scrollbar-hide">
      {isOffline && (
        <div className="mb-8 flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400">
          <WifiOff size={20} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Limited Access</p>
            <p className="text-[9px] opacity-60 font-medium leading-tight">Some profile updates are unavailable offline.</p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>

      <div className="text-center mt-12 opacity-20 pb-10 select-none">
        <p className="text-[10px] font-mono font-bold tracking-widest">STUDIBL OS v3.4.2-STABLE</p>
      </div>

      {/* 100% Mobile-Compliant Reusable Bottom Sheet for Avatar Actions */}
      <AnimatePresence>
        {isAvatarMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
            {/* Dark background backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAvatarMenuOpen(false)}
              className="absolute inset-0 cursor-pointer"
            />
            
            {/* Animating sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-[#0D0D12] border-t border-white/10 rounded-t-[32px] p-6 pb-28 sm:pb-12 space-y-6 z-10 font-sans shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
              
              <div className="space-y-1 text-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">Profile Photo</h3>
                <p className="text-[10px] text-white/40 font-semibold leading-relaxed">Update or view your digital student identity card.</p>
              </div>

              <div className="space-y-3 pt-2">
                {/* Take Photo */}
                <button 
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    // Open front facing digital camera directly
                    takePhotoInputRef.current?.click();
                  }}
                  className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all text-left flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-wider text-white">Take Photo</span>
                    <span className="text-[9px] text-white/40 font-semibold mt-0.5">Use device camera</span>
                  </div>
                  <Camera size={18} className="text-brand-primary group-hover:scale-110 transition-transform" />
                </button>

                {/* Upload Photo */}
                <button 
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    // Open file uploader/gallery
                    fileInputRef.current?.click();
                  }}
                  className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all text-left flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-wider text-white">Upload Photo</span>
                    <span className="text-[9px] text-white/40 font-semibold mt-0.5">Select image from gallery</span>
                  </div>
                  <span className="text-brand-primary font-mono text-[9px] uppercase tracking-widest bg-brand-primary/10 px-2 py-1 rounded-md border border-brand-primary/20">
                    Gallery
                  </span>
                </button>

                {/* View Current Picture */}
                <button 
                  disabled={!profile?.avatar_url}
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    setIsImageViewerOpen(true);
                  }}
                  className={cn(
                    "w-full p-4 rounded-2xl bg-white/[0.03] border border-white/5 transition-all text-left flex items-center justify-between group active:scale-[0.99]",
                    profile?.avatar_url ? "hover:bg-white/5 cursor-pointer" : "opacity-30 cursor-not-allowed"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-wider text-white">View Profile Picture</span>
                    <span className="text-[9px] text-white/40 font-semibold mt-0.5">View full scale avatar closeup</span>
                  </div>
                  <span className="text-brand-primary font-mono text-[9px] uppercase tracking-widest bg-brand-primary/10 px-2 py-1 rounded-md border border-brand-primary/20">
                    Closeup
                  </span>
                </button>
              </div>

              <button 
                onClick={() => setIsAvatarMenuOpen(false)}
                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/75 text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Avatar Closeup Viewer */}
      <AnimatePresence>
        {isImageViewerOpen && profile?.avatar_url && (
          <div 
            onClick={() => setIsImageViewerOpen(false)}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 cursor-pointer"
          >
            {/* Header controls inside full screen card */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsImageViewerOpen(false);
                }}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-white/80 transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 capitalize">
                CLOSEUP PREVIEW
              </span>
              <div className="w-10 h-10" /> {/* Spacer */}
            </div>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-md w-full aspect-square bg-neutral-950 rounded-[40px] overflow-hidden border border-white/5 shadow-2xl flex items-center justify-center"
            >
              <img 
                src={profile.avatar_url} 
                alt="Profile closeup View" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            <span className="text-[9px] font-mono tracking-wider font-extrabold text-white/30 uppercase mt-8 select-none">
              TAP ANYWHERE TO CLOSE
            </span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatMini({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title?: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4 font-sans">
      {title && <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">{title}</h3>}
      <div className="glass-card !p-0 border-none bg-white/[0.03] rounded-[32px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function MenuLink({ icon, title, detail, disabled, onClick }: { icon: React.ReactNode, title: string, detail?: string, disabled?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={cn(
        "p-4 flex items-center justify-between transition-all border-b border-dark-border last:border-none group font-sans select-none",
        disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40 transition-colors",
          !disabled && "group-hover:text-brand-primary"
        )}>
          {icon}
        </div>
        <span className="text-sm font-bold text-white/80">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-[10px] font-mono text-brand-primary tracking-normal font-medium">{detail}</span>}
        <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-all" />
      </div>
    </div>
  );
}

export function BadgeIcon({ iconName, size = 16, className }: { iconName: string, size?: number, className?: string }) {
  switch (iconName) {
    case 'GraduationCap': return <GraduationCap size={size} className={className} />;
    case 'Brain': return <Brain size={size} className={className} />;
    case 'Book': return <Book size={size} className={className} />;
    case 'Award': return <Award size={size} className={className} />;
    case 'Medal': return <Medal size={size} className={className} />;
    case 'Star': return <Star size={size} className={className} />;
    case 'Activity': return <Activity size={size} className={className} />;
    case 'Target': return <Target size={size} className={className} />;
    case 'Zap': return <Zap size={size} className={className} />;
    case 'Flame': return <Activity size={size} className={className} />;
    case 'Calendar': return <Calendar size={size} className={className} />;
    case 'TrendingUp': return <TrendingUp size={size} className={className} />;
    default: return <Award size={size} className={className} />;
  }
}

// ==========================================================
// SUB-VIEWS AND SUB-SCREENS
// ==========================================================

interface EditProfileProps {
  onBack: () => void;
  user: any;
  profile: any;
  facultyLabel: string;
  onProfileUpdated: () => void;
  playHaptic: () => void;
  onUploadClick: () => void;
  uploadingAvatar: boolean;
}

/**
 * Personal Information Screen with manual, secure "Save Changes" button trigger.
 * Faculty, Department, and Email are securely read-only fields.
 * Labels have high contrast text-zinc-100 and bold weight.
 */
function EditProfile({ 
  onBack, 
  user, 
  profile, 
  facultyLabel: initialFacultyLabel, 
  onProfileUpdated, 
  playHaptic,
  onUploadClick,
  uploadingAvatar
}: EditProfileProps) {
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.contact_number || '');
  const [department, setDepartment] = useState(profile?.major || user?.user_metadata?.major || user?.user_metadata?.department || '');
  const [faculty, setFaculty] = useState(profile?.faculty || user?.user_metadata?.faculty || '');

  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const emailValue = user?.email || 'unresolved-credential-source';

  // Synchronously update input fields when primary Supabase async queries complete
  React.useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.contact_number) setPhoneNumber(profile.contact_number);
      if (profile.major) setDepartment(profile.major);
      if (profile.faculty) setFaculty(profile.faculty);
    }
  }, [profile]);

  // Helper inside edit view to render initials if avatar not yet configured
  const getInitials = (fullNameStr: string) => {
    const name = fullNameStr || 'Student';
    const cleanName = name.includes('@') ? name.split('@')[0] : name;
    const clean = cleanName.trim();
    const parts = clean.split(/[\s._+-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return clean.substring(0, 1).toUpperCase();
  };

  /**
   * Save changes manually securely on click
   */
  const handleSave = async () => {
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);
    playHaptic();

    try {
      // 1. Update user auth metadata with new full_name and contact details
      const { error: authError } = await supabase.auth.updateUser({
        data: { 
          full_name: fullName,
        }
      });
      if (authError) throw authError;

      // 2. Upsert DB Profiles Table row with the modified entries
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          contact_number: phoneNumber,
          updated_at: new Date().toISOString()
        });
      if (dbError) throw dbError;

      setSuccessText('Profile changes saved successfully.');
      onProfileUpdated();
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to update academic profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tight">Personal Information</h2>
      </header>

      {/* Dynamic Initials Frame with Upload Action */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative cursor-pointer group" onClick={onUploadClick}>
          <div className="absolute inset-0 bg-[#CCFF00]/10 blur-xl rounded-full scale-110" />
          <div className="relative w-24 h-24 rounded-full border-4 border-brand-primary flex items-center justify-center bg-black overflow-hidden shadow-md font-extrabold text-2xl text-white">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Avatar" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand-primary text-black font-extrabold text-2xl select-none">
                {getInitials(fullName)}
              </div>
            )}
            
            {/* Edit overlay */}
            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="text-white animate-pulse" size={20} />
            </div>
          </div>
          <div className="absolute bottom-0 right-0 p-1.5 bg-brand-primary text-black rounded-full border border-black shadow">
            <Camera size={12} />
          </div>
        </div>
        {uploadingAvatar && (
          <span className="text-[9px] text-brand-primary font-mono tracking-widest uppercase animate-pulse mt-2 block">
            Uploading...
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div>
          {/* Label Contrast & Visibility Boost */}
          <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block mb-2">
            Full Name
          </label>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/45 group-focus-within:text-brand-primary transition-colors">
              <User size={16} />
            </div>
            <input 
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white focus:outline-none focus:border-brand-primary/30 focus:bg-white/[0.05] transition-all"
            />
          </div>
        </div>

        {/* Read-Only Email input */}
        <div className="space-y-2 opacity-60">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block mb-2">
            Email
          </label>
          <div className="relative bg-white/[0.01] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white/70 select-none">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/50">
              <Mail size={16} />
            </div>
            {emailValue}
          </div>
        </div>

        {/* Read-Only Department field */}
        <div className="space-y-2 opacity-60">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block mb-2">
            Department
          </label>
          <div className="relative bg-white/[0.01] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white/70 select-none">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/50">
              <Book size={16} />
            </div>
            {cleanDepartmentOrFaculty(department) || 'None'}
          </div>
        </div>

        {/* Read-Only Faculty field */}
        <div className="space-y-2 opacity-60">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block mb-2">
            Faculty
          </label>
          <div className="relative bg-white/[0.01] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white/70 select-none">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/50">
              <GraduationCap size={16} />
            </div>
            {cleanDepartmentOrFaculty(faculty) || 'None'}
          </div>
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block mb-2">
            Phone Number
          </label>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/45 group-focus-within:text-brand-primary transition-colors">
              <Phone size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Enter your phone number"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white focus:outline-none focus:border-brand-primary/30 focus:bg-white/[0.05] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Manual save changes button replaces old real-time message */}
      <button 
        id="btn-save-profile"
        disabled={saving}
        onClick={handleSave}
        className={cn(
          "w-full py-4 mt-8 rounded-2xl bg-brand-primary text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99]",
          saving ? "opacity-50 cursor-not-allowed animate-pulse" : "hover:scale-[1.01] cursor-pointer"
        )}
      >
        <Save size={16} className={cn(saving && "animate-spin")} />
        {saving ? 'Saving Changes...' : 'Save Changes'}
      </button>

      {errorText && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-semibold leading-relaxed">
          {errorText}
        </div>
      )}

      {successText && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-semibold leading-relaxed">
          {successText}
        </div>
      )}
    </div>
  );
}

interface NotificationSettingsProps {
  onBack: () => void;
  user: any;
  savedNotifications: any;
  playHaptic: () => void;
}

/**
 * Functional Notification Settings with functional haptics toggle
 */
function NotificationSettings({ onBack, user, savedNotifications, playHaptic }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<any>({
    studyReminders: savedNotifications.studyReminders !== false,
    courseProgress: savedNotifications.courseProgress !== false,
    missionUpdates: savedNotifications.missionUpdates !== false,
    newDeviceLogin: savedNotifications.newDeviceLogin !== false,
    accountActivity: savedNotifications.accountActivity !== false,
    hapticFeedback: savedNotifications.hapticFeedback !== false,
  });

  const [saving, setSaving] = useState(false);

  const handleToggleStateChange = async (key: string, activeStatus: boolean) => {
    const updated = { ...settings, [key]: activeStatus };
    setSettings(updated);

    // Play micro tactile feedback vibration on toggle as instructed
    if (key === 'hapticFeedback' ? activeStatus : settings.hapticFeedback) {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(12);
        } catch (e) {}
      }
    }

    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: {
          notifications: updated
        }
      });
    } catch (e) {
      console.error('Error synchronising preferences:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 font-sans">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <h2 className="text-lg font-black uppercase tracking-tight">Notification Settings</h2>
        </div>
        {saving && (
          <span className="text-[8px] font-mono font-black text-brand-primary uppercase tracking-wider animate-pulse">
            Syncing...
          </span>
        )}
      </header>

      <Section title="Alert Preferences">
        <ToggleItem 
          title="Study Reminders" 
          description="Receive friendly prompts to maintain daily learning cycles." 
          active={settings.studyReminders} 
          onChange={(val) => handleToggleStateChange('studyReminders', val)}
        />
        <ToggleItem 
          title="Course Progress" 
          description="Get notified about syllabus milestones and weekly statistics." 
          active={settings.courseProgress} 
          onChange={(val) => handleToggleStateChange('courseProgress', val)}
        />
        <ToggleItem 
          title="Mission Updates" 
          description="Receive challenges when new daily quizzes go live." 
          active={settings.missionUpdates}
          onChange={(val) => handleToggleStateChange('missionUpdates', val)}
        />
      </Section>

      <Section title="Account Security">
        <ToggleItem 
          title="Login Notifications" 
          description="Get an email alert when logging in from new devices." 
          active={settings.newDeviceLogin} 
          onChange={(val) => handleToggleStateChange('newDeviceLogin', val)}
        />
        <ToggleItem 
          title="Account Activity" 
          description="Receive warnings during critical privacy and password settings changes." 
          active={settings.accountActivity} 
          onChange={(val) => handleToggleStateChange('accountActivity', val)}
        />
      </Section>

      <Section title="Tactile Feedbacks">
        <ToggleItem 
          title="Haptic Feedback" 
          description="Trigger micro sensory vibrations on buttons and navigation toggles." 
          active={settings.hapticFeedback} 
          onChange={(val) => handleToggleStateChange('hapticFeedback', val)}
        />
      </Section>
    </div>
  );
}

function ToggleItem({ title, description, active, onChange }: { title: string, description: string, active?: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="p-4 flex items-center justify-between border-b border-dark-border last:border-none font-sans">
      <div className="flex-1 pr-4">
        <h4 className="text-sm font-bold text-white/80 mb-0.5">{title}</h4>
        <p className="text-[10px] text-white/30 font-medium leading-relaxed">{description}</p>
      </div>
      <button 
        type="button"
        onClick={() => onChange(!active)}
        className={cn(
          "w-12 h-6 rounded-full p-1 transition-all duration-300 relative cursor-pointer",
          active ? "bg-brand-primary" : "bg-white/10"
        )}
      >
        <motion.div 
          animate={{ x: active ? 24 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-4 h-4 bg-white rounded-full shadow-sm animate-none" 
        />
      </button>
    </div>
  );
}

/**
 * Functional password change screen with show/hide eye toggle options
 */
function SecuritySettings({ onBack, user, playHaptic, signOut }: { onBack: () => void; user: any; playHaptic: () => void; signOut: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    playHaptic();

    if (!oldPassword) {
      setErrorMsg('Old password is required to verify identity.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must contain 6 or more characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setIsUpdating(true);
    try {
      // 1. Secure validation: Verify old password before updating
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: oldPassword
      });
      if (verifyError) {
        throw new Error('Old password verification failed. Incorrect password.');
      }

      // 2. Perform safe updateUser with the verified credentials
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;

      setSuccessMsg('Your security password has been updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Could not update password.');
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Triggers the beautiful overlay confirmation modal to prevent accidental account deletion.
   */
  const handleDeactivateProtocol = () => {
    setConfirmText('');
    setDeleteErrorMessage(null);
    setShowDeleteModal(true);
    playHaptic();
  };

  /**
   * Authenticates action via typed input and requests server-side account wipeout.
   */
  const executeAccountDeletion = async () => {
    if (confirmText !== 'DELETE') {
      setDeleteErrorMessage("Please type 'DELETE' to confirm Account Deletion.");
      return;
    }

    setDeactivating(true);
    setDeleteErrorMessage(null);
    playHaptic();

    try {
      // Get the current user auth token key JWT
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      const token = activeSession?.access_token;

      if (!token) {
        throw new Error("Unable to authenticate: No active authorization credentials found.");
      }

      // Execute server-side administrative deactivation workflow
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const responseData = await response.json();
      if (!response.ok || responseData.error) {
        throw new Error(responseData.error || "The server-side deactivation sequence was denied.");
      }

      // Complete client cache purge sequences
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('studibl_')) {
          localStorage.removeItem(key);
        }
      }
      localStorage.removeItem('studibl_sandbox_user');

      // Sign out auth clients and reload paths
      await supabase.auth.signOut();
      await signOut();
      window.location.reload();

    } catch (err: any) {
      console.error('Cascade account deletion failure:', err);
      setDeleteErrorMessage(err.message || 'Deletion error occurred. Please try again.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-10 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tight">Update Password</h2>
      </header>

      <form onSubmit={handleUpdatePassword} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-100 ml-4 block mb-2">Update Password</h3>
          
          <div className="space-y-4 bg-white/[0.01] border border-white/5 p-6 rounded-[32px]">
            
            {/* Old Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-1 block mb-2">Old Password</label>
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-brand-primary/30 focus:bg-white/[0.05] transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-1 block mb-2">New Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 pr-12 text-sm font-bold text-white/80 focus:outline-none focus:border-brand-primary/30 focus:bg-white/[0.05] transition-all"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-1 block mb-2">Confirm New Password</label>
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-sm font-bold text-white/80 focus:outline-none focus:border-brand-primary/30 focus:bg-white/[0.05] transition-all"
                required
              />
            </div>

            {errorMsg && <p className="text-xs font-bold uppercase tracking-wider text-red-500 pl-1">{errorMsg}</p>}
            {successMsg && <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 pl-1">{successMsg}</p>}

            <button 
              type="submit" 
              disabled={isUpdating}
              className="w-full py-4 rounded-2xl bg-brand-primary text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-30 cursor-pointer"
            >
              {isUpdating ? 'Synchronizing password...' : 'Update Password'}
            </button>
          </div>
        </div>
      </form>

      <Section title="Account Integrity Settings">
        <div className="p-5 text-sm space-y-3 font-medium bg-white/[0.01]">
          <div className="flex justify-between items-center text-xs">
            <span className="text-white/40">Registered Email</span>
            <span className="text-white/80 font-mono font-bold">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-white/40">Security Status</span>
            <span className="text-brand-primary font-mono text-[10px] uppercase font-bold">Securely Connected</span>
          </div>
        </div>
      </Section>

      {/* Danger Zone Account deletion workflow */}
      <div className="p-6 rounded-[32px] bg-red-500/5 border border-red-500/10 mt-10">
        <h4 className="text-red-400 font-extrabold uppercase tracking-wide text-xs mb-2 flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h4>
        <p className="text-[11px] text-white/40 mb-6 font-semibold leading-relaxed">
          Permanent deactivation of your student accounts. This will completely delete your student profile, performance histories, active streak scores, and processed textbooks.
        </p>
        <button 
          onClick={handleDeactivateProtocol}
          disabled={deactivating}
          className="w-full py-4 rounded-2xl bg-red-950/20 text-red-400 font-black uppercase tracking-widest text-[9px] hover:bg-red-500/10 transition-colors border border-red-500/20 cursor-pointer text-center"
        >
          {deactivating ? 'Deleting account...' : 'Delete Account'}
        </button>
      </div>

      {/* Beautiful Deletion Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass-card max-w-sm w-full p-6 bg-[#0E0E12] border border-red-500/20 rounded-[32px] shadow-2xl relative space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-500 animate-pulse">
                  <AlertTriangle size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black uppercase tracking-widest text-white">Permanently Delete Account?</h3>
                  <p className="text-[11px] text-white/40 leading-relaxed font-semibold">
                    This will permanently delete your Studibl student profile, earned badges, completed quizzes, and uploaded documents. This process is 100% irreversible.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-red-400 ml-1 block">
                    Type "DELETE" to confirm
                  </label>
                  <input
                    type="text"
                    placeholder="Type DELETE"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl py-3 px-4 text-center font-mono text-xs font-bold text-white uppercase focus:outline-none focus:border-red-500/30 tracking-widest"
                  />
                </div>

                {deleteErrorMessage && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 text-center">
                    {deleteErrorMessage}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setConfirmText('');
                      setDeleteErrorMessage(null);
                    }}
                    className="flex-1 py-3.5 bg-white/5 border border-white/5 text-white/60 font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeAccountDeletion}
                    disabled={deactivating || confirmText !== 'DELETE'}
                    className="flex-1 py-3.5 bg-red-500 text-black font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-red-600 transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer text-center shadow-lg shadow-red-500/15"
                  >
                    {deactivating ? 'Deleting...' : 'Delete Me'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-10 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tight">Privacy Policy</h2>
      </header>

      <div className="glass-card bg-white/[0.01] border border-white/5 p-6 rounded-[32px] space-y-6 text-sm leading-relaxed text-white/80">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Effective Date: June 12, 2026</p>
          <h3 className="text-lg font-black italic tracking-tight text-white">Studibl Privacy Charter</h3>
        </div>

        <p>
          At Studibl, we are committed to protecting the privacy, integrity, and security of your academic records, lecture materials, and study statistics. This Privacy Charter outlines how your data is handled.
        </p>

        <div className="space-y-3">
          <h4 className="font-extrabold uppercase text-xs tracking-wider text-brand-primary">1. Data Storage & Architecture</h4>
          <p className="text-xs text-white/60 leading-relaxed">
            All uploaded document files, transcripts, and study streaks are synced securely with our Supabase database. We do not sell, trade, or distribute your content, quiz results, or statistics to third-party model developers.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-extrabold uppercase text-xs tracking-wider text-brand-primary">2. Local Workspace Isolation</h4>
          <p className="text-xs text-white/60 leading-relaxed">
            For standard user files, offline libraries, and dynamic session caches, we leverage local contexts backed by standard cloud triggers. Once you log in, your local statistics are pushed directly to your centralized cloud database profile.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-extrabold uppercase text-xs tracking-wider text-brand-primary">3. AI Insights & Tutoring</h4>
          <p className="text-xs text-white/60 leading-relaxed">
            To provide tutoring and mock examinations, we utilize server-side generative artificial intelligence via Google Gemini. Data transmitted is exclusively scoped to the respective lecture files and user-selected subjects, preventing external leakage of identity details.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-extrabold uppercase text-xs tracking-wider text-brand-primary">4. Information Sovereignty</h4>
          <p className="text-xs text-white/60 leading-relaxed">
            At any time, you can delete or export study assets. You can initiate an account deletion in the Security tab to permanently delete all data files.
          </p>
        </div>

        <div className="pt-4 border-t border-white/5 flex gap-2 items-center justify-between text-[10px] font-mono text-white/30">
          <span>PROTOCOL: TLS_1.3_AES_256_GCM</span>
          <span>COMPLIANCE STATUS: ACTIVE</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Clean Enrolled Courses screen displaying user selected courses
 */
function EnrolledCourses({ onBack, courses }: { onBack: () => void; courses: any[] }) {
  // Normalize courses to render beautiful cards regardless of array element types
  const normalizedCourses = useMemo(() => {
    return courses.map((c: any) => {
      if (typeof c === 'string') {
        const parts = c.trim().split(/\s+/);
        // If it starts with MECH, CIVL, GEN etc.
        const code = parts.length > 1 ? parts[0] + ' ' + parts[1] : parts[0] || 'COURSE';
        return {
          id: c,
          code: code.toUpperCase(),
          name: c
        };
      }
      return {
        id: c.id || c.code || c.name || Math.random().toString(),
        code: (c.code || c.name || 'COURSE').toUpperCase(),
        name: c.name || c.code || 'Unlabeled course'
      };
    });
  }, [courses]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-10 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tight">Enrolled Courses</h2>
      </header>

      <div className="space-y-4">
        {normalizedCourses.length > 0 ? (
          normalizedCourses.map((course: any, cIdx: number) => (
            <div key={`enrolled-course-${course.id || course.code || cIdx}-${cIdx}`} className="glass-card hover:border-brand-primary/20 transition-all p-5 bg-white/[0.02] border border-white/5 rounded-3xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-sm">{course.name}</h3>
                  <p className="text-[10px] text-brand-primary font-mono tracking-widest mt-1 uppercase">{course.code}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-xl">
                  <Book size={16} className="text-brand-primary" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border border-dashed border-white/5 rounded-[32px] bg-white/[0.01]">
            <div className="p-4 bg-white/5 rounded-3xl text-white/10">
              <Book size={40} />
            </div>
            <p className="text-xs font-bold text-white/20 uppercase tracking-widest leading-none mb-1">No enrolled courses found.</p>
            <p className="text-[10px] text-white/40 max-w-[200px] leading-relaxed">Choose subjects in settings to start studying.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Personal badges unlocked by user in active database sessions
 */
function CertificatesAndBadges({ onBack, earnedBadges }: { onBack: () => void; earnedBadges: Badge[] }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-10 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tight">Earned Badges</h2>
      </header>

      {earnedBadges.length === 0 ? (
        <div className="text-center py-20 px-6 border border-dashed border-white/5 rounded-[32px] bg-white/[0.01] space-y-4">
          <div className="p-4 bg-white/5 rounded-3xl text-white/10 w-fit mx-auto">
            <Award size={40} />
          </div>
          <p className="text-xs font-bold text-white/20 uppercase tracking-widest leading-none mb-1">No Badges Earned Yet</p>
          <p className="text-[10px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Complete quizzes and lessons to unlock your first achievement badge!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {earnedBadges.map((badge, bIdx) => (
            <div
              key={`earned-badge-${badge.id || bIdx}-${bIdx}`}
              className="glass-card flex flex-col p-5 group transition-all relative overflow-hidden border border-emerald-500/15 bg-gradient-to-tr from-emerald-500/[0.01]"
            >
              <div className="absolute top-2 right-2">
                <span className="flex items-center gap-1 text-[7px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Check size={8} /> Verified
                </span>
              </div>

              <div className="flex items-start gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg shrink-0", badge.bg)}>
                  <BadgeIcon iconName={badge.iconName} size={20} className={badge.color} />
                </div>

                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-tight text-white">
                    {badge.name}
                  </h4>
                  <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                    {badge.description}
                  </p>
                  {(badge as any).reason && (
                    <p className="text-[8px] font-mono text-emerald-400/80 font-semibold lowercase pt-0.5">
                      Earned: {(badge as any).reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Comprehensive descriptive About section for Studibl, directly populated with the provided PDF content.
 */
function AboutStudibl({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-10 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tight">About Studibl</h2>
      </header>

      {/* Simple, clean article-style layout with no card containers, borders, or gradient panels */}
      <div className="space-y-8 text-left max-w-2xl mx-auto">
        <div className="flex items-center gap-4 pb-6 border-b border-white/5">
          <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shadow-2xl shrink-0">
            <GraduationCap size={32} />
          </div>
        </div>

        {/* 100% Genuine content source of truth from About Info PDF */}
        <div className="space-y-6 text-sm text-white/80 leading-relaxed font-semibold">
          <div className="space-y-3">
            <h4 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Our Purpose</h4>
            <p>
              Most students don’t fail because they lack intelligence. They fail because they lack feedback.
            </p>
            <p>
              They study hard, but they study blind—no system showing what’s weak, what’s improving, or what will actually show up in their grades.
            </p>
            <p className="font-bold text-white">
              Studibl exists to change one outcome above everything else: to improve your academic performance and raise your grades through intelligent, structured feedback.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-3">
            <h4 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-1">What Studibl is</h4>
            <p>
              Studibl is an academic intelligence system that transforms studying into a measurable performance loop:
            </p>
            <div className="py-2.5 flex items-center justify-center gap-3 text-xs font-black text-brand-primary bg-black/40 rounded-xl border border-white/5 font-mono select-none">
              <span>learn</span>
              <span>→</span>
              <span>test</span>
              <span>→</span>
              <span>analyze</span>
              <span>→</span>
              <span>improve</span>
              <span>→</span>
              <span>predict</span>
            </div>
            <p>
              It doesn’t just help you study. It helps you perform better in real exams, assignments, and assessments.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-4">
            <h4 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Built for results, not activity</h4>
            <blockquote className="border-l-2 border-brand-primary pl-4 py-1 italic text-white/90 font-medium">
              “Will this actually improve your grade?”
            </blockquote>
            <p>
              Studibl is designed around that single question, and every feature is built to answer it with a yes:
            </p>
            <ul className="space-y-2.5 text-xs text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-brand-primary font-bold">✓</span>
                <span>AI-powered tutoring that targets your weak areas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-primary font-bold">✓</span>
                <span>Exam simulations that train you under real pressure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-primary font-bold">✓</span>
                <span>Daily quizzes and missions that turn revision into consistent progress</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-primary font-bold">✓</span>
                <span>Smart analytics that reveal exactly where marks are being lost</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-primary font-bold">✓</span>
                <span>Predictive insights that estimate your academic performance before exams arrive</span>
              </li>
            </ul>
            <p className="text-xs text-white/40 italic font-mono uppercase tracking-[0.1em] text-center pt-2">
              No random studying. No wasted effort. No guesswork.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-3">
            <h4 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-1">The core shift Studibl creates</h4>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="p-3 bg-white/5 rounded-xl text-center">
                <span className="text-white/40 block text-[9px] uppercase font-mono mb-1">From</span>
                <span className="text-white">Reading & Effort</span>
              </div>
              <div className="p-3 bg-brand-primary/[0.04] border border-brand-primary/10 rounded-xl text-center">
                <span className="text-brand-primary block text-[9px] uppercase font-mono mb-1">To</span>
                <span className="text-[#CCFF00]">Retention & Growth</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl text-center">
                <span className="text-white/40 block text-[9px] uppercase font-mono mb-1">From</span>
                <span className="text-white">Confusion & Uncertainty</span>
              </div>
              <div className="p-3 bg-brand-primary/[0.04] border border-brand-primary/10 rounded-xl text-center">
                <span className="text-brand-primary block text-[9px] uppercase font-mono mb-1">To</span>
                <span className="text-[#CCFF00]">Clarity & Performance</span>
              </div>
            </div>
            <p className="pt-2">
              Studibl turns studying into something you can track, understand, and improve continuously.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-3">
            <h4 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-1">The truth behind it</h4>
            <p>
              Most students don’t need more information. They need a system that tells them what to fix before it affects their grades. Studibl does exactly that.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-3 bg-brand-primary/[0.02] p-4 rounded-2xl border border-brand-primary/10">
            <h4 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Final Statement</h4>
            <p className="font-bold text-white">
              Studibl is built for one outcome: better grades, stronger performance, and predictable academic success.
            </p>
            <p className="text-xs text-[#CCFF00] font-bold">
              Not just studying harder. Studying smarter—with results you can see.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Component providing dedicated display and contrast customization settings.
 * Enables switching between standard dark cyber theme and high-contrast light mode,
 * with real-time preview of readability metrics, contrast ratios, and daylight legibility.
 */
function DisplayThemeSettings({
  onBack,
  playHaptic,
}: {
  onBack: () => void;
  playHaptic: () => void;
}) {
  const { theme, setTheme, isLight } = useTheme();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Navigation header with back button */}
      <div className="flex items-center gap-4">
        <button
          id="btn-back-display-theme"
          onClick={() => {
            playHaptic();
            onBack();
          }}
          className="p-2.5 rounded-xl hover:bg-white/5 active:scale-95 transition-all text-white/70 cursor-pointer"
          aria-label="Back to Profile"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-white">Display & Contrast</h2>
          <p className="text-[11px] text-white/40 font-medium">Readability & ambient lighting preferences</p>
        </div>
      </div>

      {/* Primary Switcher Cards */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block">
          Select Visual Theme
        </label>
        
        <div className="grid grid-cols-1 gap-3">
          {/* High-Contrast Light Mode Option */}
          <div
            id="subview-option-theme-light"
            onClick={() => {
              playHaptic();
              setTheme('light');
            }}
            className={cn(
              "p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden",
              theme === 'light'
                ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
                  <Sun size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={cn("text-sm font-black", theme === 'light' ? "text-slate-900" : "text-white")}>
                      High-Contrast Light
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                      Daylight Ready
                    </span>
                  </div>
                  <p className={cn("text-xs mt-0.5 font-medium leading-relaxed", theme === 'light' ? "text-slate-600" : "text-white/40")}>
                    Crisp dark text on high-luminance canvas. Specially calibrated to prevent glare under bright lighting, campus libraries, and outdoor sun.
                  </p>
                </div>
              </div>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-1",
                theme === 'light' ? "bg-emerald-600 border-emerald-600 text-white" : "border-white/20"
              )}>
                {theme === 'light' && <Check size={14} strokeWidth={3} />}
              </div>
            </div>
          </div>

          {/* Cyber Dark Mode Option */}
          <div
            id="subview-option-theme-dark"
            onClick={() => {
              playHaptic();
              setTheme('dark');
            }}
            className={cn(
              "p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden",
              theme === 'dark'
                ? "bg-white/[0.08] border-[#CCFF00] shadow-[0_0_20px_rgba(204,255,0,0.15)] ring-1 ring-[#CCFF00]/40"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black border border-white/20 flex items-center justify-center text-brand-primary shrink-0">
                  <Moon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white">
                      Cyber Dark (Default)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
                      Night Focus
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5 font-medium leading-relaxed">
                    Deep pitch-black canvas with neon lime accents. Reduces eye fatigue in low-light settings and extends battery life on OLED displays.
                  </p>
                </div>
              </div>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-1",
                theme === 'dark' ? "bg-[#CCFF00] border-[#CCFF00] text-black" : "border-white/20"
              )}>
                {theme === 'dark' && <Check size={14} strokeWidth={3} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Readability Preview Card */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase tracking-widest text-zinc-100 ml-4 block">
          Live Reading Contrast Demonstration
        </label>
        
        <div className={cn(
          "p-5 rounded-3xl border transition-all",
          theme === 'light'
            ? "bg-slate-50 border-slate-200 shadow-sm"
            : "bg-white/[0.03] border-white/5"
        )}>
          <div className="flex items-center justify-between mb-3">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
              theme === 'light' ? "bg-emerald-100 text-emerald-800" : "bg-brand-primary/15 text-brand-primary"
            )}>
              PHY201: Thermodynamics
            </span>
            <span className={cn("text-xs font-mono font-bold", theme === 'light' ? "text-slate-500" : "text-white/40")}>
              {theme === 'light' ? 'WCAG AAA (12.8:1)' : 'WCAG AAA (16.1:1)'}
            </span>
          </div>

          <h3 className={cn("text-base font-extrabold mb-1.5", theme === 'light' ? "text-slate-900" : "text-white")}>
            Carnot Engine Efficiency & Entropy
          </h3>
          <p className={cn("text-xs leading-relaxed font-medium mb-3", theme === 'light' ? "text-slate-700" : "text-white/60")}>
            In an ideal Carnot cycle, net entropy production is zero. Any reversible thermodynamic engine operating between two temperatures cannot exceed this boundary.
          </p>

          <div className="flex items-center gap-2">
            <div className={cn(
              "px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5",
              theme === 'light' ? "bg-emerald-600 text-white" : "bg-[#CCFF00] text-black"
            )}>
              Practice 10 Questions
            </div>
            <div className={cn(
              "px-3 py-1.5 rounded-xl text-[11px] font-bold border",
              theme === 'light' ? "border-slate-300 text-slate-700 bg-white" : "border-white/10 text-white/70"
            )}>
              Mastery: 84%
            </div>
          </div>
        </div>
      </div>

      {/* Environmental reading note */}
      <div className={cn(
        "p-4 rounded-2xl border flex items-start gap-3",
        theme === 'light'
          ? "bg-amber-50/70 border-amber-200 text-amber-900"
          : "bg-white/[0.02] border-white/5 text-white/50"
      )}>
        <Sun size={18} className={theme === 'light' ? "text-amber-600 shrink-0 mt-0.5" : "text-brand-primary shrink-0 mt-0.5"} />
        <div className="text-xs leading-relaxed">
          <span className={cn("font-bold block mb-0.5", theme === 'light' ? "text-amber-950" : "text-white/80")}>
            Environmental Lighting Recommendation
          </span>
          Switch to <strong className={theme === 'light' ? "text-amber-950" : "text-white"}>Light Mode</strong> during daytime lectures, outdoor sessions, or brightly lit library floors to reduce ocular accommodation fatigue.
        </div>
      </div>
    </div>
  );
}
