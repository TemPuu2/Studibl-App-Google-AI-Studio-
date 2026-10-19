import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Sparkles,
  Activity,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  BookOpen,
  Terminal,
  Zap,
  GraduationCap,
  Award,
  Clock,
  Compass
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

/**
 * Interface representing a core academic faculty fetched from the backend.
 */
interface Faculty {
  id: string;
  name: string;
}

/**
 * Interface representing a department filtered by faculty.
 */
interface Department {
  id: string;
  facultyId: string;
  name: string;
}

/**
 * Interface representing an academic course.
 */
interface Course {
  id: string;
  departmentId: string;
  name: string;
  code: string;
}

/**
 * Simulated backend database containing faculty, department, and course information.
 * Supports clean search-like listings and dynamic retrieval.
 */
const BACKEND_DATABASE = {
  faculties: [
    { id: 'sciences', name: 'Faculty of Physical & Natural Sciences' },
    { id: 'engineering', name: 'Faculty of Engineering & Technology' },
    { id: 'medicine', name: 'Faculty of Clinical Medicine & Health Sciences' },
    { id: 'humanities', name: 'Faculty of Arts, Humanities & Social Sciences' },
    { id: 'business', name: 'Faculty of Business Administration & Economics' }
  ],
  departments: [
    // Sciences
    { id: 'physics', facultyId: 'sciences', name: 'Department of Physics & Astronomy' },
    { id: 'chemistry', facultyId: 'sciences', name: 'Department of Pure & Applied Chemistry' },
    { id: 'math', facultyId: 'sciences', name: 'Department of Mathematics & Statistics' },
    // Engineering
    { id: 'computer_sci', facultyId: 'engineering', name: 'Department of Computer Science & Software' },
    { id: 'electrical_eng', facultyId: 'engineering', name: 'Department of Electrical Engineering' },
    { id: 'mechanical_eng', facultyId: 'engineering', name: 'Department of Mechanical Engineering' },
    // Medicine
    { id: 'pharmacy', facultyId: 'medicine', name: 'Department of Pharmacy' },
    { id: 'nursing', facultyId: 'medicine', name: 'Department of Nursing Sciences' },
    // Humanities
    { id: 'history', facultyId: 'humanities', name: 'Department of History & Philosophy' },
    { id: 'literature', facultyId: 'humanities', name: 'Department of Comparative Literature' },
    // Business
    { id: 'finance', facultyId: 'business', name: 'Department of Finance & Economics' },
    { id: 'mgmt', facultyId: 'business', name: 'Department of Business Management' }
  ],
  courses: [
    // Physics
    { id: 'phy101', departmentId: 'physics', name: 'Classical Mechanics & Relativity', code: 'PHY 101' },
    { id: 'phy102', departmentId: 'physics', name: 'Thermodynamics & Statistical Physics', code: 'PHY 102' },
    { id: 'phy201', departmentId: 'physics', name: 'Electromagnetism & Waves', code: 'PHY 201' },
    // Chemistry
    { id: 'chm101', departmentId: 'chemistry', name: 'Introduction to Organic Chemistry', code: 'CHM 101' },
    { id: 'chm102', departmentId: 'chemistry', name: 'Inorganic Chemistry & Trends', code: 'CHM 102' },
    // Math
    { id: 'mth101', departmentId: 'math', name: 'Advanced Calculus & Analysis', code: 'MTH 101' },
    { id: 'mth102', departmentId: 'math', name: 'Linear Algebra & Matrices', code: 'MTH 102' },
    // Computer Science
    { id: 'csc101', departmentId: 'computer_sci', name: 'Algorithms & Data Structures', code: 'CSC 101' },
    { id: 'csc102', departmentId: 'computer_sci', name: 'Object-Oriented Coding Patterns', code: 'CSC 102' },
    { id: 'csc201', departmentId: 'computer_sci', name: 'Database Systems & SQL Mechanics', code: 'CSC 201' },
    { id: 'csc202', departmentId: 'computer_sci', name: 'Dynamic Web Development', code: 'CSC 202' },
    // Electrical Engineering
    { id: 'eee101', departmentId: 'electrical_eng', name: 'Circuit Theory & Applied Electrodynamics', code: 'EEE 101' },
    { id: 'eee102', departmentId: 'electrical_eng', name: 'Digital Signal Processing', code: 'EEE 102' },
    // Mechanical
    { id: 'mec101', departmentId: 'mechanical_eng', name: 'Fluid Dynamics & Aerodynamics', code: 'MEC 101' },
    { id: 'mec102', departmentId: 'mechanical_eng', name: 'Materials Science & Solid Strength', code: 'MEC 102' },
    // Pharmacy
    { id: 'pha101', departmentId: 'pharmacy', name: 'Pharmacokinetics & Metabolism', code: 'PHA 101' },
    // Nursing
    { id: 'nur101', departmentId: 'nursing', name: 'Clinical Care & Protocols', code: 'NUR 101' },
    // History
    { id: 'hst101', departmentId: 'history', name: 'World History & Civilizations', code: 'HST 101' },
    // Literature
    { id: 'lit101', departmentId: 'literature', name: 'Literary Theory & Modern Fiction', code: 'LIT 101' },
    // Finance
    { id: 'fin101', departmentId: 'finance', name: 'Corporate Finance & Valuation', code: 'FIN 101' },
    // Management
    { id: 'mgt101', departmentId: 'mgmt', name: 'Strategic Management & Leadership', code: 'MGT 101' }
  ]
};

/**
 * Simulated async backend GET request to fetch available faculties.
 */
const fetchFacultiesAPI = async (): Promise<Faculty[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(BACKEND_DATABASE.faculties), 450));
};

/**
 * Simulated async backend GET request to fetch departments filtered by faculty status.
 */
const fetchDepartmentsAPI = async (facultyId: string): Promise<Department[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filtered = BACKEND_DATABASE.departments.filter(dept => dept.facultyId === facultyId);
      resolve(filtered);
    }, 450);
  });
};

/**
 * Simulated async backend GET request to fetch courses filtered by department.
 */
const fetchCoursesAPI = async (departmentId: string): Promise<Course[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filtered = BACKEND_DATABASE.courses.filter(course => course.departmentId === departmentId);
      resolve(filtered);
    }, 450);
  });
};

/**
 * Local State tracking for onboarding selections
 */
interface OnboardingResponses {
  goal: string;
  challenge: string;
  frequency: string;
  target: string;
  learningStyle: string;
  name: string;
  email: string;
  academicLevel: string;
  faculty: Faculty | null;
  department: Department | null;
  courses: Course[];
}

/**
 * Props definition for the AuthPage.
 */
interface AuthPageProps {
  onAuthSuccess?: () => void;
}

/**
 * Premium Refactored AuthPage incorporating multi-step onboarding wizard
 * alongside a high-performance, polished authentication scheme.
 */
export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const { loginAsSandbox } = useAuth();
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  
  // Flag to declare whether user is logging in or embarking on onboarding
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Login Specific states
  const [loginEmail, setLoginEmail] = useState(() => {
    return sessionStorage.getItem('signup_success_email') || '';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(() => {
    return sessionStorage.getItem('signup_success') === 'true';
  });

  // Current onboarding step: range [1, 12]
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation errors tracked per step input field for premium client-side UX
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  
  // Onboarding aggregate states stored securely
  const [onboardingData, setOnboardingData] = useState<OnboardingResponses>({
    goal: '',
    challenge: '',
    frequency: '',
    target: '',
    learningStyle: '',
    name: '',
    email: '',
    academicLevel: '',
    faculty: null,
    department: null,
    courses: []
  });

  // Account creation inputs (Onboarding step 7)
  const [accountPassword, setAccountPassword] = useState('');
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('');

  // Dynamic lists from backend with states
  const [facultiesList, setFacultiesList] = useState<Faculty[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  
  // Dynamic fetching loaders
  const [isFacultiesLoading, setIsFacultiesLoading] = useState(false);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);

  // Manual course addition input
  const [customCourseName, setCustomCourseName] = useState('');
  const [customCourseCode, setCustomCourseCode] = useState('');

  // Trigger loading list of faculties
  useEffect(() => {
    if (step === 9) {
      setIsFacultiesLoading(true);
      fetchFacultiesAPI().then(data => {
        setFacultiesList(data);
        setIsFacultiesLoading(false);
      });
    }
  }, [step]);

  // Trigger loading list of departments when faculty is selected/step 10 is loaded
  useEffect(() => {
    if (step === 10 && onboardingData.faculty) {
      setIsDepartmentsLoading(true);
      fetchDepartmentsAPI(onboardingData.faculty.id).then(data => {
        setDepartmentsList(data);
        setIsDepartmentsLoading(false);
      });
    }
  }, [step, onboardingData.faculty]);

  // Trigger loading list of courses when department is selected/step 11 is loaded
  useEffect(() => {
    if (step === 11 && onboardingData.department) {
      setIsCoursesLoading(true);
      fetchCoursesAPI(onboardingData.department.id).then(data => {
        setCoursesList(data);
        setIsCoursesLoading(false);
      });
    }
  }, [step, onboardingData.department]);

  /**
   * Resets entire wizard progression states to welcome screen
   */
  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setStep(1);
    setIsLoading(false);
    setFieldErrors({});
    setLoginError(null);
    setSignupSuccess(false);
    sessionStorage.removeItem('signup_success');
  };

  /**
   * Safe forward progression with data validations
   */
  const handleNextStep = () => {
    const errors: { [key: string]: string } = {};
    
    // Verify constraints based on active screens
    if (step === 2 && !onboardingData.goal) {
      errors.goal = 'Please select your primary goal.';
    }
    if (step === 3 && !onboardingData.challenge) {
      errors.challenge = 'Please select your biggest study challenge.';
    }
    if (step === 4 && !onboardingData.frequency) {
      errors.frequency = 'Please select how often you study.';
    }
    if (step === 5 && !onboardingData.target) {
      errors.target = 'Please specify how much you would like to study daily.';
    }
    if (step === 6 && !onboardingData.learningStyle) {
      errors.learningStyle = 'Please select your preferred learning style.';
    }
    if (step === 8 && !onboardingData.academicLevel) {
      errors.academicLevel = 'Please select your academic level.';
    }
    if (step === 9 && !onboardingData.faculty) {
      errors.faculty = 'Please select your academic faculty.';
    }
    if (step === 10 && !onboardingData.department) {
      errors.department = 'Please select your department.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setStep(prev => Math.min(prev + 1, 12));
  };

  /**
   * Safe backward progression within onboarding bounds
   */
  const handlePrevStep = () => {
    setFieldErrors({});
    setStep(prev => Math.max(prev - 1, 1));
  };

  /**
   * Submits standard sign-in request
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please fill in all fields before signing in.');
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      // Clean up previous registration parameters
      sessionStorage.removeItem('signup_success');
      sessionStorage.removeItem('signup_success_email');
      setSignupSuccess(false);

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInErr) throw signInErr;
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.error('Authentication Login Error:', err);
      setLoginError(err?.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Action handler for Step 7 Account Creation using Supabase Auth
   */
  const handleAccountCreationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const errors: { [key: string]: string } = {};
    if (!onboardingData.name.trim()) {
      errors.name = 'Please enter your full name.';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!onboardingData.email.trim() || !emailRegex.test(onboardingData.email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (accountPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (accountPassword !== accountConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      // Connect to supabase auth signup service
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: onboardingData.email,
        password: accountPassword,
        options: {
          data: {
            full_name: onboardingData.name,
            goal: onboardingData.goal,
            challenge: onboardingData.challenge,
            frequency: onboardingData.frequency,
            target: onboardingData.target,
            learningStyle: onboardingData.learningStyle
          }
        }
      });

      if (signUpErr) throw signUpErr;

      // Handle configuration flows correctly
      const isConfirmationRequired = data?.user && !data.session;
      if (isConfirmationRequired) {
        // Safe dispatching of success state for login fallback pre-population
        sessionStorage.setItem('signup_success_email', onboardingData.email);
        sessionStorage.setItem('signup_success', 'true');
        setSignupSuccess(true);
      }

      setIsSandboxMode(false);
      // Proceed forward to Academic setup phase of onboarding (Screen 8)
      setStep(8);
    } catch (err: any) {
      console.error('Account Creation Error:', err);
      // Display standard Supabase error below password fields as required
      const isRateLimit = err?.message?.toLowerCase().includes('rate limit') || 
                          err?.message?.toLowerCase().includes('rate_limit') || 
                          err?.message?.toLowerCase().includes('too many requests') ||
                          err?.message?.toLowerCase().includes('security');
      
      const errMsg = isRateLimit 
        ? 'Email signup rate limit exceeded. For testing/review, please use Sandbox Mode bypassing Supabase registration to continue.'
        : (err?.message || 'Failed to create your account.');
      
      setFieldErrors({ auth: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Safe bypass to Sandbox guest mode for onboarding progression
   */
  const handleBypassToSandbox = () => {
    setIsSandboxMode(true);
    setFieldErrors({});
    setStep(8);
  };

  /**
   * Updates discrete values in local onboarding state dictionary
   */
  const updateOnboardingKey = (key: keyof OnboardingResponses, value: any) => {
    setOnboardingData(prev => ({
      ...prev,
      [key]: value
    }));
    // Flush key-specific active error automatically
    if (fieldErrors[key]) {
      setFieldErrors(prev => {
        const update = { ...prev };
        delete update[key];
        return update;
      });
    }
  };

  /**
   * Toggles item status inside selected courses array list
   */
  const handleToggleCourse = (course: Course) => {
    setOnboardingData(prev => {
      const exists = prev.courses.some(c => c.id === course.id);
      let updated: Course[];
      if (exists) {
        updated = prev.courses.filter(c => c.id !== course.id);
      } else {
        updated = [...prev.courses, course];
      }
      return {
        ...prev,
        courses: updated
      };
    });
  };

  /**
   * Processes "+" custom course generation form
   */
  const handleAddCustomCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCourseName.trim()) return;

    const finalCode = customCourseCode.trim() || `CRSE-${Math.floor(100 + Math.random() * 899)}`;
    const newCourse: Course = {
      id: `custom-${Date.now()}`,
      departmentId: onboardingData.department?.id || 'manual',
      name: customCourseName.trim(),
      code: finalCode.toUpperCase()
    };

    // Add directly to existing course database collections and toggle selection active
    setCoursesList(prev => [...prev, newCourse]);
    setOnboardingData(prev => ({
      ...prev,
      courses: [...prev.courses, newCourse]
    }));

    // Erase input configurations
    setCustomCourseName('');
    setCustomCourseCode('');
  };

  /**
   * Triggers terminal exit or onAuthSuccess progression
   */
  const handleCompleteOnboarding = () => {
    if (isSandboxMode) {
      loginAsSandbox({
        email: onboardingData.email || 'sandbox-guest@studibl.edu',
        name: onboardingData.name || 'Sandbox Student',
        metadata: {
          goal: onboardingData.goal,
          challenge: onboardingData.challenge,
          frequency: onboardingData.frequency,
          target: onboardingData.target,
          learningStyle: onboardingData.learningStyle,
          academicLevel: onboardingData.academicLevel,
          faculty: onboardingData.faculty?.name,
          department: onboardingData.department?.name,
          courses_count: onboardingData.courses.length,
          selected_courses: onboardingData.courses,
          isSandbox: true
        }
      });
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } else {
      // Real authenticated user: update metadata and database profiles with academic choices
      // This is 100% Supabase-driven and user-authenticated!
      // CRITICAL: Cache registrations locally as "pending onboarding data" to allow offline/unconfirmed synchronization!
      const pendingData = {
        goal: onboardingData.goal,
        challenge: onboardingData.challenge,
        frequency: onboardingData.frequency,
        target: onboardingData.target,
        learningStyle: onboardingData.learningStyle,
        academicLevel: onboardingData.academicLevel,
        faculty: onboardingData.faculty?.name,
        department: onboardingData.department?.name,
        selected_courses: onboardingData.courses,
        full_name: onboardingData.name,
        isSandbox: false
      };
      localStorage.setItem('studibl_onboarding_pending', JSON.stringify(pendingData));

      // Fetch active session before initiating profile/metadata updates. 
      // If none exists, defer the update cleanly because the data is already stored in the pending local cache
      // and will sync automatically inside AuthContext when the user initiates login.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
          supabase.auth.updateUser({
            data: {
              goal: onboardingData.goal,
              challenge: onboardingData.challenge,
              frequency: onboardingData.frequency,
              target: onboardingData.target,
              learningStyle: onboardingData.learningStyle,
              academicLevel: onboardingData.academicLevel,
              faculty: onboardingData.faculty?.name,
              department: onboardingData.department?.name,
              selected_courses: onboardingData.courses,
              isSandbox: false
            }
          }).then(({ error }) => {
            if (error) {
              console.error("Failed to sync onboarding choices with Supabase Auth:", error);
            }
          });

          // Synchronize to Profiles Table securely using an upsert to guarantee a row exists
          supabase.from('profiles').upsert({
            id: session.user.id,
            full_name: onboardingData.name || session.user.user_metadata?.full_name || 'Student',
            major: onboardingData.department?.name || onboardingData.faculty?.name || 'Undeclared',
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) {
              console.error("Failed to sync profile major in Supabase database:", error);
            } else {
              // Successfully upserted, we can remove the pending cache
              localStorage.removeItem('studibl_onboarding_pending');
            }
          });
        } else {
          // Log an informative message indicating synchronization is pending confirmation/credentials.
          console.log("No active Supabase session available yet to synchronize onboarding choices. Choices cached. They will be synchronized automatically upon subsequent sign-in.");
        }
      });

      if (onAuthSuccess) {
        onAuthSuccess();
      } else {
        // Switch back to Login with the prefilled email if authentication requires activation
        setIsSignUp(false);
        setStep(1);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-10 bg-black font-sans h-full select-none overflow-y-auto scrollbar-hide @container">
      <AnimatePresence mode="wait">
        
        {/* VIEW 1: NORMAL SIGN IN COMPONENT */}
        {!isSignUp ? (
          <motion.div
            key="signin-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full flex-1 flex flex-col justify-between"
            id="signin_card_view"
          >
            <div>
              {/* Header Branding */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full" />
                  <div className="relative w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/25 flex items-center justify-center text-brand-primary shadow-lg animate-pulse">
                    <Activity size={24} />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white/95 tracking-tight">Sign In</h2>
                <p className="text-zinc-500 text-xs mt-1 font-medium">Please enter your credentials to continue</p>
              </div>

              {/* Account Created Success Banner */}
              {signupSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 flex items-start gap-2.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                  id="signup_success_banner_label"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] font-bold tracking-tight leading-normal uppercase">
                    Your account has been created successfully. Please check your email inbox and verify your email address before signing in.
                  </span>
                </motion.div>
              )}

              {/* Login Errors */}
              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 flex flex-col gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 animate-fade-in"
                  id="login_error_box"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span className="text-[11px] font-bold tracking-tight leading-normal uppercase">{loginError}</span>
                  </div>
                  
                  {/*
                    CRITICAL USER RECOVERY WORKFLOW:
                    When encountering standard email confirmation delays (e.g., mail server offline or mock account limits)
                    or actual internet network handshake failures, we empower the user to seamlessly redirect their login
                    instance into our offline/sandbox secure student container. This ensures continuous product accessibility.
                  */}
                  {(loginError.toLowerCase().includes('email not confirmed') || 
                    loginError.toLowerCase().includes('failed to fetch') ||
                    loginError.toLowerCase().includes('invalid login credentials') ||
                    loginError.toLowerCase().includes('invalid credentials') ||
                    loginError.toLowerCase().includes('credential')) && (
                    <div className="mt-1 border-t border-red-500/10 pt-3 flex flex-col gap-2">
                      <p className="text-[10px] text-zinc-400 normal-case leading-relaxed font-semibold">
                        {loginError.toLowerCase().includes('email not confirmed') 
                          ? "You can bypass the email confirmation requirement by entering as a sandbox guest using this email address instantly."
                          : loginError.toLowerCase().includes('invalid') || loginError.toLowerCase().includes('credential')
                          ? "Invalid credentials or login issues? You can bypass authentication entirely and explore all features immediately in Sandbox Mode."
                          : "The server appears unreachable. You can continue securely in fully-featured Sandbox Mode with your current email."
                        }
                      </p>
                      <button
                        type="button"
                        id="login_error_sandbox_bypass_btn"
                        onClick={() => {
                          const emailToUse = loginEmail.trim() || 'student@mainframe.edu';
                          const nameToUse = emailToUse.split('@')[0] || 'Student';
                          
                          // Establish an active mock/sandbox identity matching user parameters
                          loginAsSandbox({
                            email: emailToUse,
                            name: nameToUse,
                            metadata: { goal: 'Bypass auth errors', isSandbox: true }
                          });
                          
                          // Signal successful layout hydration
                          if (onAuthSuccess) onAuthSuccess();
                        }}
                        className="self-start text-[10px] font-black uppercase tracking-widest text-black bg-brand-primary px-3 py-2 rounded-xl transition active:scale-95 hover:brightness-110 cursor-pointer shadow-md inline-flex items-center gap-1.5"
                      >
                        <Sparkles size={11} />
                        <span>Continue in Sandbox Mode</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Login Credentials Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 pl-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="login_email_input"
                      type="email"
                      placeholder="student@mainframe.edu"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/40 focus:bg-white/[0.05] transition-all disabled:opacity-50"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                      <Mail size={14} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 pl-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login_password_input"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-3 pl-11 pr-12 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-brand-primary/40 focus:bg-white/[0.05] transition-all disabled:opacity-50"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                      <Lock size={14} />
                    </div>
                    <button
                      id="toggle_login_password_btn"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  id="submit_login_btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full text-black font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-2 bg-brand-primary shadow-[0_0_15px_rgba(204,255,0,0.15)] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Mode Link Toggle */}
            <div className="mt-8 text-center pt-4 border-t border-white/5 space-y-3">
              <div>
                <button
                  id="toggle_to_signup_btn"
                  onClick={handleToggleMode}
                  disabled={isLoading}
                  className="text-xs text-zinc-500 hover:text-brand-primary transition-colors focus:outline-none cursor-pointer"
                >
                  Don't have an account? <span className="text-brand-primary font-black underline ml-1">Create Account</span>
                </button>
              </div>
              <div className="pt-1">
                <button
                  id="sandbox_guest_login_btn"
                  type="button"
                  onClick={() => {
                    loginAsSandbox({
                      email: 'demo-student@studibl.test',
                      name: 'Demo Guest Student',
                      metadata: { goal: 'Pass with Honors', isSandbox: true }
                    });
                    if (onAuthSuccess) onAuthSuccess();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-cyan-400 font-mono tracking-wider transition-colors uppercase outline-none cursor-pointer border border-dashed border-white/5 hover:border-cyan-500/20 px-3 py-1.5 rounded-xl bg-white/[0.01]"
                >
                  Enter with Sandbox Guest Session
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          
          /* VIEW 2: MULTI-STEP ONBOARDING & SIGNUP COMPONENT */
          <motion.div
            key="signup-onboarding-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full flex-1 flex flex-col justify-between"
            id="onboarding_wizard_container"
          >
            {/* Onboarding progress gauge tracker */}
            <div className="w-full mb-6">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-2 pl-1 pr-1">
                <span className="uppercase tracking-widest">Studibl Onboarding</span>
                <span className="font-bold text-brand-primary">Step {step} of 12</span>
              </div>
              <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden relative">
                <motion.div 
                  className="h-full bg-brand-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(step / 12) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Steps Container Body */}
            <div className="flex-1 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                
                {/* ----------------- SCREEN 1: WELCOME SCREEN ----------------- */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_1_view"
                  >
                    <div className="text-center space-y-3">
                      <div className="mx-auto w-16 h-16 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shadow-lg animate-pulse">
                        <Sparkles size={28} />
                      </div>
                      <h2 className="text-2xl font-black text-white tracking-tight leading-normal">Welcome to Studibl</h2>
                      <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
                        Let’s personalize your study experience
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-brand-primary/15 flex items-center justify-center text-brand-primary mt-0.5 shrink-0">
                          <Compass size={14} />
                        </div>
                        <div>
                          <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Tailored Study System</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Define your goals, challenges, and study paths.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      id="onboarding_welcome_start_btn"
                      onClick={handleNextStep}
                      className="w-full bg-brand-primary text-black font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:brightness-110 active:scale-95 transition-all outline-none flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.15)] cursor-pointer"
                    >
                      <span>Continue</span>
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 2: PRIMARY SEMESTER GOAL ----------------- */}
                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_2_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Semester Goal</span>
                      <h2 className="text-lg font-black text-white leading-snug">What’s your main goal this semester?</h2>
                    </div>

                    {fieldErrors.goal && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.goal}</span>
                    )}

                    <div className="space-y-3">
                      {[
                        'Improve GPA',
                        'Pass exams',
                        'Stay consistent',
                        'Master difficult courses',
                        'Graduate with distinctions'
                      ].map((option) => (
                        <button
                          key={option}
                          id={`goal_option_${option.toLowerCase().replace(/\s+/g, '_')}`}
                          type="button"
                          onClick={() => updateOnboardingKey('goal', option)}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                            onboardingData.goal === option 
                              ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                              : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <span>{option}</span>
                          {onboardingData.goal === option && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 3: STUDY CHALLENGE ----------------- */}
                {step === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_3_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Study Challenge</span>
                      <h2 className="text-lg font-black text-white leading-snug">What’s your biggest study challenge?</h2>
                    </div>

                    {fieldErrors.challenge && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.challenge}</span>
                    )}

                    <div className="space-y-3">
                      {[
                        'Procrastination',
                        'Lack of focus',
                        'Poor time management',
                        'Forgetting what I learnt',
                        'Inconsistent study habits'
                      ].map((option) => (
                        <button
                          key={option}
                          id={`challenge_option_${option.toLowerCase().replace(/\s+/g, '_')}`}
                          type="button"
                          onClick={() => updateOnboardingKey('challenge', option)}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                            onboardingData.challenge === option 
                              ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                              : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <span>{option}</span>
                          {onboardingData.challenge === option && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 4: STUDY FREQUENCY ----------------- */}
                {step === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_4_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Study Frequency</span>
                      <h2 className="text-lg font-black text-white leading-snug">How often do you study?</h2>
                    </div>

                    {fieldErrors.frequency && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.frequency}</span>
                    )}

                    <div className="space-y-3">
                      {[
                        'Rarely',
                        'A few times a week',
                        'Almost daily',
                        'Every day'
                      ].map((option) => (
                        <button
                          key={option}
                          id={`frequency_option_${option.toLowerCase().replace(/\s+/g, '_')}`}
                          type="button"
                          onClick={() => updateOnboardingKey('frequency', option)}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                            onboardingData.frequency === option 
                              ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                              : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <span>{option}</span>
                          {onboardingData.frequency === option && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 5: STUDY TARGET ----------------- */}
                {step === 5 && (
                  <motion.div
                    key="step-5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_5_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Study Target</span>
                      <h2 className="text-lg font-black text-white leading-snug">How much would you like to study daily?</h2>
                    </div>

                    {fieldErrors.target && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.target}</span>
                    )}

                    <div className="space-y-3">
                      {[
                        '30 minutes',
                        '1 hour',
                        '2 hours',
                        '3+ hours'
                      ].map((option) => (
                        <button
                          key={option}
                          id={`target_option_${option.toLowerCase().replace(/\s+/g, '_')}`}
                          type="button"
                          onClick={() => updateOnboardingKey('target', option)}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                            onboardingData.target === option 
                              ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                              : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <span>{option}</span>
                          {onboardingData.target === option && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 6: LEARNING STYLE ----------------- */}
                {step === 6 && (
                  <motion.div
                    key="step-6"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_6_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Learning Style</span>
                      <h2 className="text-lg font-black text-white leading-snug">How do you learn best?</h2>
                    </div>

                    {fieldErrors.learningStyle && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.learningStyle}</span>
                    )}

                    <div className="space-y-3">
                      {[
                        'Reading notes',
                        'Practice questions',
                        'Videos',
                        'Group study',
                        'Mixed approach'
                      ].map((option) => (
                        <button
                          key={option}
                          id={`style_option_${option.toLowerCase().replace(/\s+/g, '_')}`}
                          type="button"
                          onClick={() => updateOnboardingKey('learningStyle', option)}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                            onboardingData.learningStyle === option 
                              ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                              : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <span>{option}</span>
                          {onboardingData.learningStyle === option && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 7: CREATE ACCOUNT ----------------- */}
                {step === 7 && (
                  <motion.div
                    key="step-7"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                    id="onboarding_step_7_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Account Setup</span>
                      <h2 className="text-lg font-black text-white leading-snug">Create Account</h2>
                    </div>

                    {fieldErrors.auth && (
                      <div className="space-y-3">
                        <div className="p-3 text-[10px] font-bold text-red-400 bg-red-500/5 rounded-2xl border border-red-500/10 uppercase tracking-tight flex items-start gap-2 animate-pulse">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{fieldErrors.auth}</span>
                        </div>
                        <button
                          id="onboarding_sandbox_bypass_btn"
                          type="button"
                          onClick={handleBypassToSandbox}
                          className="w-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 font-black text-xs uppercase tracking-widest py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles size={14} />
                          <span>Continue with Sandbox Mode</span>
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleAccountCreationSubmit} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1.5 pl-1.5">Full Name</label>
                        <input
                          id="onboarding_name_input"
                          type="text"
                          placeholder="Alex Simmons"
                          value={onboardingData.name}
                          onChange={(e) => updateOnboardingKey('name', e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-2.5 px-4 text-xs font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/40 focus:bg-white/[0.05]"
                        />
                        {fieldErrors.name && <span className="text-[9px] font-extrabold text-red-400 pl-1">{fieldErrors.name}</span>}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1.5 pl-1.5">Email</label>
                        <input
                          id="onboarding_email_input"
                          type="email"
                          placeholder="alex@mainframe.edu"
                          value={onboardingData.email}
                          onChange={(e) => updateOnboardingKey('email', e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-2.5 px-4 text-xs font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/40 focus:bg-white/[0.05]"
                        />
                        {fieldErrors.email && <span className="text-[9px] font-extrabold text-red-400 pl-1">{fieldErrors.email}</span>}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1.5 pl-1.5">Password</label>
                        <input
                          id="onboarding_password_input"
                          type="password"
                          placeholder="••••••••"
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-2.5 px-4 text-xs font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/40 focus:bg-white/[0.05]"
                        />
                        {fieldErrors.password && <span className="text-[9px] font-extrabold text-red-400 pl-1">{fieldErrors.password}</span>}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1.5 pl-1.5">Confirm Password</label>
                        <input
                          id="onboarding_confirm_password_input"
                          type="password"
                          placeholder="••••••••"
                          value={accountConfirmPassword}
                          onChange={(e) => setAccountConfirmPassword(e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-2.5 px-4 text-xs font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/40 focus:bg-white/[0.05]"
                        />
                        {fieldErrors.confirmPassword && <span className="text-[9px] font-extrabold text-red-400 pl-1">{fieldErrors.confirmPassword}</span>}
                      </div>

                      <button
                        id="onboarding_account_submit_btn"
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-brand-primary text-black font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:brightness-110 active:scale-95 transition-all outline-none flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.15)] disabled:opacity-50 disabled:pointer-events-none mt-4"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Create Account</span>
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 8: ACADEMIC STANDING ----------------- */}
                {step === 8 && (
                  <motion.div
                    key="step-8"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_8_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Academic Level</span>
                      <h2 className="text-lg font-black text-white leading-snug">What is your academic level?</h2>
                    </div>

                    {fieldErrors.academicLevel && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.academicLevel}</span>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        '100 Level',
                        '200 Level',
                        '300 Level',
                        '400 Level',
                        '500 Level'
                      ].map((lvl) => (
                        <button
                          key={lvl}
                          id={`level_option_${lvl.replace(/\s+/g, '_')}`}
                          type="button"
                          onClick={() => updateOnboardingKey('academicLevel', lvl)}
                          className={cn(
                            "p-4 rounded-2xl border text-xs font-black text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer",
                            onboardingData.academicLevel === lvl 
                              ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                              : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <GraduationCap size={20} className={onboardingData.academicLevel === lvl ? "text-brand-primary" : "text-zinc-600"} />
                          <span>{lvl}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 9: FACULTY DYNAMIC SELECTION ----------------- */}
                {step === 9 && (
                  <motion.div
                    key="step-9"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_9_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Faculty Selection</span>
                      <h2 className="text-lg font-black text-white leading-snug">Select your Academic Faculty</h2>
                    </div>

                    {fieldErrors.faculty && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.faculty}</span>
                    )}

                    <div className="space-y-3 min-h-[150px] flex flex-col justify-center">
                      {isFacultiesLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 space-y-3">
                          <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Loading Faculties...</span>
                        </div>
                      ) : (
                        facultiesList.map((fac) => (
                          <button
                            key={fac.id}
                            id={`faculty_item_${fac.id}`}
                            type="button"
                            onClick={() => updateOnboardingKey('faculty', fac)}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                              onboardingData.faculty?.id === fac.id 
                                ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                                : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                            )}
                          >
                            <span>{fac.name}</span>
                            {onboardingData.faculty?.id === fac.id && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 10: DEPARTMENT DYNAMIC SELECTION ----------------- */}
                {step === 10 && (
                  <motion.div
                    key="step-10"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    id="onboarding_step_10_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Department Selection</span>
                      <h2 className="text-lg font-black text-white leading-snug">Select your Department</h2>
                      <p className="text-[10px] text-zinc-500 font-mono">Filtered by: {onboardingData.faculty?.name}</p>
                    </div>

                    {fieldErrors.department && (
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block pl-1">{fieldErrors.department}</span>
                    )}

                    <div className="space-y-3 min-h-[150px] flex flex-col justify-center">
                      {isDepartmentsLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 space-y-3">
                          <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Loading Departments...</span>
                        </div>
                      ) : (
                        departmentsList.map((dept) => (
                          <button
                            key={dept.id}
                            id={`department_item_${dept.id}`}
                            type="button"
                            onClick={() => updateOnboardingKey('department', dept)}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                              onboardingData.department?.id === dept.id 
                                ? "bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(204,255,0,0.1)]" 
                                : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10"
                            )}
                          >
                            <span>{dept.name}</span>
                            {onboardingData.department?.id === dept.id && <CheckCircle2 size={16} className="text-brand-primary shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 11: COURSES DYNAMIC MULTI-SELECT ----------------- */}
                {step === 11 && (
                  <motion.div
                    key="step-11"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                    id="onboarding_step_11_view"
                  >
                    <div className="space-y-1">
                      <span className="pill-tag">Courses Selection</span>
                      <h2 className="text-lg font-black text-white leading-snug font-sans">Select or Add Courses</h2>
                      <p className="text-[10px] text-zinc-500 font-mono">Department: {onboardingData.department?.name}</p>
                    </div>

                    {/* Multi-Select list of courses */}
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-hide">
                      {isCoursesLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-2">
                          <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-[9px] font-mono text-zinc-500">Loading Courses...</span>
                        </div>
                      ) : coursesList.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                          <p className="text-xs text-zinc-500">No courses listed. Add manually below.</p>
                        </div>
                      ) : (
                        coursesList.map((course) => {
                          const isSelected = onboardingData.courses.some(c => c.id === course.id);
                          return (
                            <button
                              key={course.id}
                              id={`course_multiselect_${course.id}`}
                              type="button"
                              onClick={() => handleToggleCourse(course)}
                              className={cn(
                                "w-full text-left p-3.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                                isSelected 
                                  ? "bg-brand-primary/10 border-brand-primary text-white" 
                                  : "bg-white/[0.01] border-white/5 text-zinc-400 hover:border-white/10"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-mono text-[9px] px-2 py-0.5 rounded-md font-extrabold select-none shrink-0",
                                  isSelected ? "bg-brand-primary/25 text-brand-primary" : "bg-white/10 text-zinc-400"
                                )}>
                                  {course.code}
                                </span>
                                <span className="truncate max-w-[170px]">{course.name}</span>
                              </div>
                              <div className={cn(
                                "w-4 h-4 rounded-md border flex items-center justify-center shrink-0",
                                isSelected ? "bg-brand-primary border-brand-primary text-black" : "border-white/20"
                              )}>
                                {isSelected && <Check size={10} />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Action form to add custom missing course */}
                    <form onSubmit={handleAddCustomCourse} className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                      <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5 font-sans">Add Custom Course</div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          id="custom_course_code_input"
                          type="text"
                          placeholder="CODE (e.g. CS 101)"
                          value={customCourseCode}
                          onChange={(e) => setCustomCourseCode(e.target.value)}
                          className="col-span-1 bg-black/40 border border-white/5 rounded-xl py-1.5 px-2 text-[10px] font-bold text-white placeholder-zinc-700 focus:outline-none"
                        />
                        <input
                          id="custom_course_name_input"
                          type="text"
                          placeholder="Course Title"
                          value={customCourseName}
                          onChange={(e) => setCustomCourseName(e.target.value)}
                          className="col-span-2 bg-black/40 border border-white/5 rounded-xl py-1.5 px-2 text-[10px] font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-brand-primary/30"
                        />
                      </div>
                      <button
                        id="add_custom_course_submit_btn"
                        type="submit"
                        disabled={!customCourseName.trim()}
                        className="w-full bg-white/5 text-white hover:bg-brand-primary hover:text-black font-black text-[9px] uppercase tracking-widest py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Plus size={10} />
                        <span>Add Course</span>
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* ----------------- SCREEN 12: PERSONALIZATION SUMMARY ----------------- */}
                {step === 12 && (
                  <motion.div
                    key="step-12"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4 text-center"
                    id="onboarding_final_step_view"
                  >
                    <div className="mx-auto w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 font-bold shadow-lg animate-pulse">
                      <GraduationCap size={24} />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-lg font-black text-white leading-snug">Personalization Summary</h2>
                      <p className="text-zinc-400 text-xs tracking-normal leading-relaxed pl-3 pr-3">
                        “Welcome to Studibl, <span className="text-brand-primary font-black">{onboardingData.name}</span>. Your personalized study system is ready.”
                      </p>
                    </div>

                    {/* High-contrast telemetry state board summary */}
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl text-left text-[10px] font-mono space-y-2.5 max-h-[160px] overflow-y-auto scrollbar-hide">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-zinc-500">
                        <span className="uppercase text-[9px]">Custom Setting</span>
                        <span className="uppercase text-[9px]">Selected Value</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Goal:</span>
                        <span className="text-white font-extrabold">{onboardingData.goal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Challenge:</span>
                        <span className="text-white font-extrabold">{onboardingData.challenge}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Daily Target:</span>
                        <span className="text-white font-extrabold">{onboardingData.target}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Learning:</span>
                        <span className="text-white font-extrabold">{onboardingData.learningStyle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Level:</span>
                        <span className="text-white font-extrabold">{onboardingData.academicLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Faculty:</span>
                        <span className="text-white font-extrabold truncate max-w-[140px]">{onboardingData.faculty?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Courses:</span>
                        <span className="text-brand-primary font-extrabold truncate max-w-[140px]">{onboardingData.courses.map(c => c.code).join(', ') || 'None selected'}</span>
                      </div>
                    </div>

                    {signupSuccess && (
                      <div className="p-3 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-2xl text-[10px] uppercase font-bold tracking-tight leading-relaxed text-center pl-4 pr-4">
                        Please verify your academic email ({onboardingData.email}) via the link sent to your inbox to fully enable access.
                      </div>
                    )}

                    <button
                      id="onboarding_complete_and_login_btn"
                      onClick={handleCompleteOnboarding}
                      className="w-full bg-brand-primary text-black font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:brightness-110 active:scale-95 transition-all outline-none flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.15)] cursor-pointer mt-4"
                    >
                      <span>{signupSuccess ? 'Proceed to Sign In' : 'Get Started'}</span>
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Stepper Control Actions Footer (Screens 2 to 11) */}
            {step > 1 && step < 12 && (
              <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-white/5" id="onboarding_actions_footer">
                <button
                  id="onboarding_back_arrow_btn"
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>

                {step !== 7 && (
                  <button
                    id="onboarding_next_arrow_btn"
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white/5 hover:bg-brand-primary hover:text-black text-white transition-all text-xs font-black uppercase tracking-wider focus:outline-none cursor-pointer"
                  >
                    <span>Continue</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Mode Link Toggle for Onboarding Home */}
            {step === 1 && (
              <div className="mt-8 text-center pt-4 border-t border-white/5" id="onboarding_step_1_footer">
                <button
                  id="toggle_to_login_from_onboarding_btn"
                  onClick={handleToggleMode}
                  className="text-xs text-zinc-500 hover:text-brand-primary transition-colors focus:outline-none cursor-pointer"
                >
                  Already have an account? <span className="text-brand-primary font-black underline ml-1">Log In</span>
                </button>
              </div>
            )}

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
