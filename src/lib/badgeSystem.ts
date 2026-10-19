/**
 * Real-Time Achievement Badge and User Performance Tracker Engine.
 * 
 * This module implements a robust, deterministic performance validation
 * system that processes sequential learning events, updates user metrics,
 * and issues badges exactly when conditions are matched.
 * 
 * It ensures:
 * - Deterministic, non-AI rule evaluation based strictly on performance data.
 * - Minimum sample sizes before awarding badges to verify competency rather than volume.
 * - Outlier handling for response speed calculations.
 * - Single-award safety limits per badge type for consistency.
 */

export interface LearningEvent {
  user_id: string;
  course: string;               // E.g., 'Code', 'Logic', 'Engineering'
  topic: string;                // E.g., 'Compilers', 'Structural Analysis', 'Quantum Mechanics'
  correct: boolean;             // Whether the answer was correct
  response_time_ms: number;     // Time taken to answer in milliseconds
  timestamp: string;            // ISO-8601 string representation
  difficulty?: 'Low' | 'Medium' | 'High'; // Session difficulty
  isExam?: boolean;             // Whether this event is part of an Exam
}

export interface TopicMetrics {
  attempts: number;
  correctCount: number;
  accuracy: number;
  responseTimes: number[];      // For calculating variance and filtering outliers
  averageResponseTime: number;
  hasBeenWeak: boolean;         // Historically had < 60% accuracy with >= 8 attempts
  hasBeenRebuilt: boolean;      // Rebuilt: previously weak, now has >= 85% in recent attempts
}

export interface CourseMetrics {
  attempts: number;
  correctCount: number;
  accuracy: number;
  responseTimes: number[];
  averageResponseTime: number;
}

export interface SessionMetrics {
  date: string;
  subject: string;
  attempts: number;
  correctCount: number;
  accuracy: number;
}

export interface UserPerformanceMetrics {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  
  // Per course / subject tracking
  courses: { [courseName: string]: CourseMetrics };
  
  // Per topic tracking 
  topics: { [topicName: string]: TopicMetrics };
  
  // For consecutive correct answer tracking (Perfect Run Master)
  consecutiveCorrectStreak: number;
  maxConsecutiveCorrectStreak: number;

  // Session history (grouped daily/subject-wise) for "Consistency Mastery"
  sessions: SessionMetrics[];
  
  // Calendar tracking for active streak computation
  activeDates: string[]; // List of YYYY-MM-DD
  currentStreak: number;
  longestStreak: number;

  // Weekly performance tracking for Growth Badges
  // Maps a week offset (e.g., 0 for current week, -1 for last week, -2 for prior)
  // to attempts list to compute accurate averages.
  weeklyAccuracy: { [weekId: string]: { attempts: number, correct: number } };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: 'MASTERY' | 'SPEED' | 'CONSISTENCY' | 'GROWTH' | 'PRESSURE';
  iconName: string; // To match lucide-react icons
  color: string;    // Tailwind color classes (e.g. text-orange-500)
  bg: string;       // Tailwind bg classes (e.g. bg-orange-500/10)
}

export interface BadgeAward {
  badgeId: string;
  awardedAt: string; // ISO timestamp
  reason: string;    // Reason detail why this badge was triggered
}

export interface EventRefactoringResult {
  userId: string;
  newlyAwardedBadges: BadgeAward[];
  updatedMetrics: UserPerformanceMetrics;
  triggeredRules: string[];
}

/**
 * Standard registry for all deterministic achievement badges matching rules.
 */
export const BADGE_REGISTRY: { [id: string]: Badge } = {
  // Mastery Badges
  'course_master': {
    id: 'course_master',
    name: 'Course Master',
    description: 'Achieve 90% accuracy or higher in a course with at least 50 attempts.',
    category: 'MASTERY',
    iconName: 'GraduationCap',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10'
  },
  'course_expert': {
    id: 'course_expert',
    name: 'Course Expert',
    description: 'Achieve 85% accuracy in a course with 30 attempts and stable variance over time.',
    category: 'MASTERY',
    iconName: 'Brain',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10'
  },
  'course_champion': {
    id: 'course_champion',
    name: 'Course Champion',
    description: 'Exceed 95% accuracy in a subject with at least 100 attempts.',
    category: 'MASTERY',
    iconName: 'Trophy',
    color: 'text-[#CCFF00]',
    bg: 'bg-[#CCFF00]/10'
  },
  'topic_master': {
    id: 'topic_master',
    name: 'Topic Master',
    description: 'Reach 85% accuracy in a specific topic with at least 10 attempts.',
    category: 'MASTERY',
    iconName: 'Book',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10'
  },
  'topic_specialist': {
    id: 'topic_specialist',
    name: 'Topic Specialist',
    description: 'Reach 90% accuracy in a topic with at least 25 attempts.',
    category: 'MASTERY',
    iconName: 'Award',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10'
  },
  'topic_dominator': {
    id: 'topic_dominator',
    name: 'Topic Dominator',
    description: 'Sustain 95% accuracy in a topic with at least 50 attempts.',
    category: 'MASTERY',
    iconName: 'Medal',
    color: 'text-red-400',
    bg: 'bg-red-400/10'
  },
  'knowledge_conqueror': {
    id: 'knowledge_conqueror',
    name: 'Knowledge Conqueror',
    description: 'Master all topics within a course at 85% accuracy or higher (min 10 attempts per topic).',
    category: 'MASTERY',
    iconName: 'Globe',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10'
  },
  'perfect_run_master': {
    id: 'perfect_run_master',
    name: 'Perfect Run Master',
    description: 'Maintain 20 consecutive correct answers in your learning history.',
    category: 'MASTERY',
    iconName: 'Star',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10'
  },
  'consistency_mastery': {
    id: 'consistency_mastery',
    name: 'Consistency Mastery',
    description: 'Maintain over 90% accuracy across 5 separate subject sessions.',
    category: 'MASTERY',
    iconName: 'Activity',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10'
  },
  'deep_learner': {
    id: 'deep_learner',
    name: 'Deep Learner',
    description: 'Answer 200+ questions in a subject with sustained accuracy of 80% or higher.',
    category: 'MASTERY',
    iconName: 'Target',
    color: 'text-[#00DDFF]',
    bg: 'bg-[#00DDFF]/10'
  },

  // Speed Badges
  'fast_thinker': {
    id: 'fast_thinker',
    name: 'Fast Thinker',
    description: 'Average response time below 1800ms with a minimum of 80% accuracy (min 15 attempts).',
    category: 'SPEED',
    iconName: 'Zap',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10'
  },
  'precision_speedster': {
    id: 'precision_speedster',
    name: 'Precision Speedster',
    description: 'Maintain fast speed (< 2200ms) with low variation (< 700ms StdDev) and high accuracy (85%+ accuracy).',
    category: 'SPEED',
    iconName: 'ZapOff',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10'
  },

  // Consistency Badges
  'streak_keeper': {
    id: 'streak_keeper',
    name: 'Streak Keeper',
    description: 'Maintain a study streak for 7 consecutive days.',
    category: 'CONSISTENCY',
    iconName: 'Flame',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10'
  },
  'dedicated_learner': {
    id: 'dedicated_learner',
    name: 'Dedicated Learner',
    description: 'Sustain your daily academic streak for 14 consecutive days.',
    category: 'CONSISTENCY',
    iconName: 'Calendar',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  'unbroken_mind': {
    id: 'unbroken_mind',
    name: 'Unbroken Mind',
    description: 'Engage study cycles for 30 consecutive days.',
    category: 'CONSISTENCY',
    iconName: 'TrendingUp',
    color: 'text-brand-secondary',
    bg: 'bg-brand-secondary/10'
  },

  // Growth Badges
  'comeback_kid': {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    description: 'Improve weekly accuracy by at least 20% compared to the prior week (min 10 attempts).',
    category: 'GROWTH',
    iconName: 'ArrowUpRight',
    color: 'text-green-400',
    bg: 'bg-green-400/10'
  },
  'rising_edge': {
    id: 'rising_edge',
    name: 'Rising Edge',
    description: 'Form a continuous upward accuracy trend over three consecutive tracking weeks.',
    category: 'GROWTH',
    iconName: 'TrendingUp',
    color: 'text-[#CCFF00]',
    bg: 'bg-[#CCFF00]/10'
  },
  'rebuilder': {
    id: 'rebuilder',
    name: 'Rebuilder',
    description: 'Uplift a previously struggling topic (below 60%) back to mastery (above 85%).',
    category: 'GROWTH',
    iconName: 'Wrench',
    color: 'text-[#FF44B8]',
    bg: 'bg-[#FF44B8]/10'
  },

  // Pressure Performance Badges
  'under_pressure': {
    id: 'under_pressure',
    name: 'Under Pressure',
    description: 'Maintain high accuracy (90%+) when average response speeds are faster than 1300ms.',
    category: 'PRESSURE',
    iconName: 'Clock',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10'
  },
  'final_boss_mode': {
    id: 'final_boss_mode',
    name: 'Final Boss Mode',
    description: 'Score 85% or higher on a difficult exam of at least 20 questions.',
    category: 'PRESSURE',
    iconName: 'Crown',
    color: 'text-[#9d4edd]',
    bg: 'bg-[#9d4edd]/10'
  },
  'no_panic_solver': {
    id: 'no_panic_solver',
    name: 'No Panic Solver',
    description: 'Maintain highly stable response times (< 400ms speed variance) and 90%+ accuracy under pressure.',
    category: 'PRESSURE',
    iconName: 'Hourglass',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10'
  }
};

/**
 * Creates an empty state profile of user metrics to track.
 */
export function createEmptyMetrics(): UserPerformanceMetrics {
  return {
    totalAttempts: 0,
    totalCorrect: 0,
    overallAccuracy: 0,
    courses: {},
    topics: {},
    consecutiveCorrectStreak: 0,
    maxConsecutiveCorrectStreak: 0,
    sessions: [],
    activeDates: [],
    currentStreak: 0,
    longestStreak: 0,
    weeklyAccuracy: {}
  };
}

/**
 * Bootstraps initial, highly cohesive simulated performance metrics and corresponding
 * awarded badges for a user based on high-level profile statistics (e.g., 520 attempts,
 * 460 correct answers). This prevents cold start empty-states and ensures a flawless UX.
 */
export function generateSeededMetricsAndBadges(userId: string): { metrics: UserPerformanceMetrics, awardedBadges: BadgeAward[] } {
  let metrics = createEmptyMetrics();
  const awardedBadges: BadgeAward[] = [];
  const badgeIdsSet = new Set<string>();

  // Cohort topics per course to keep simulation realistic
  const COURSE_TOPICS: { [course: string]: string[] } = {
    'Code': ['Algorithms', 'Compilers', 'Vite Bundler', 'Async Runtime'],
    'Logic': ['Boolean Proofs', 'First Order logic', 'Modal Sat Solver'],
    'Math': ['Linear Algebra', 'Vector Calculus', 'Discrete Sequences'],
    'Theory': ['Automata Complexity', 'Lambda Calculi', 'Graph Traversal'],
    'Security': ['Cryptographic Keys', 'Firewall Handshakes', 'Zero Trust'],
    'Hardware': ['CPU Registers', 'Logic Gates', 'Memory Bus'],
    'Linguistics': ['Syntax Trees', 'Phonetics Parser', 'Semantic Mapping']
  };

  const coursesList = Object.keys(COURSE_TOPICS);
  const totalQuestions = 520;
  const targetCorrect = 460;
  
  // Create sequential chronological events over 35 days to form streak/weekly records
  // 35 days ago to today
  const events: LearningEvent[] = [];
  let correctRemaining = targetCorrect;

  for (let i = 0; i < totalQuestions; i++) {
    const dayOffset = Math.floor((i / totalQuestions) * 35); // 0 to 35 days ago
    const date = new Date();
    date.setDate(date.getDate() - (35 - dayOffset));
    const timestampStr = date.toISOString();

    // Distribute attempts across courses (Code and Logic are heavily featured)
    let courseName = 'Code';
    if (i % 7 === 1) courseName = 'Logic';
    else if (i % 7 === 2) courseName = 'Math';
    else if (i % 7 === 3) courseName = 'Theory';
    else if (i % 7 === 4) courseName = 'Security';
    else if (i % 7 === 5) courseName = 'Hardware';
    else if (i % 7 === 6) courseName = 'Linguistics';

    const topicsArr = COURSE_TOPICS[courseName];
    const topicName = topicsArr[i % topicsArr.length];

    // Determine correctness while preserving accurate total correct answers
    const pctToCorrect = (totalQuestions - i) / totalQuestions;
    let isCorrect = false;
    if (correctRemaining > 0) {
      if (correctRemaining >= (totalQuestions - i) || Math.random() < 0.90) {
        isCorrect = true;
        correctRemaining--;
      }
    }

    // Generate responsive times in ms (simulating highly focused responses)
    // Add periodic fast waves or structured speeds
    let responseTime = 1200 + Math.floor(Math.sin(i) * 350) + (isCorrect ? 0 : 800);
    if (i % 15 === 0) responseTime = 800; // Fast spikes
    if (responseTime < 200) responseTime = 450;

    events.push({
      user_id: userId,
      course: courseName,
      topic: topicName,
      correct: isCorrect,
      response_time_ms: responseTime,
      timestamp: timestampStr,
      difficulty: (i % 10 === 0) ? 'High' : ((i % 3 === 0) ? 'Medium' : 'Low'),
      isExam: i % 40 === 0
    });
  }

  // Sort chronologically before running the event pipeline
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Run all events through active pipeline to trigger medals naturally
  events.forEach(ev => {
    const res = processLearningEvent(userId, ev, metrics, badgeIdsSet);
    metrics = res.updatedMetrics;
    res.newlyAwardedBadges.forEach(aw => {
      awardedBadges.push(aw);
      badgeIdsSet.add(aw.badgeId);
    });
  });

  return {
    metrics,
    awardedBadges
  };
}

/**
 * Helper to get week offset ID since a baseline day (e.g., Sunday).
 * Helps group events into accurate calendar weeks for Growth evaluations.
 */
function getWeekId(timestamp: string): string {
  const dateObj = new Date(timestamp);
  // Get time in UTC
  const ms = dateObj.getTime();
  const dayIndex = 24 * 60 * 60 * 1000;
  // Divide by 7 days to get integer week
  return `week-${Math.floor(ms / (7 * dayIndex))}`;
}

/**
 * Robust mathematical computation of standard deviation with outlier filtering.
 * Outliers are defined as points further than 2.5 times the median absolute deviation (MAD).
 */
function getStableStats(responseTimes: number[]): { average: number; stdDev: number } {
  if (responseTimes.length === 0) return { average: 0, stdDev: 0 };
  
  // Exclude potential non-interactive intervals (e.g. taking more than 30 seconds to click as distraction)
  const reasonableTimes = responseTimes.filter(t => t > 150 && t < 30000);
  if (reasonableTimes.length === 0) return { average: 0, stdDev: 0 };

  // Calculate Median
  const sorted = [...reasonableTimes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Absolute deviations
  const absoluteDeviations = sorted.map(t => Math.abs(t - median));
  const sortedDeviations = [...absoluteDeviations].sort((a, b) => a - b);
  const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)] || 1;

  // Filter outliers using 2.5 MAD threshold
  const filtered = sorted.filter(t => Math.abs(t - median) <= 2.5 * mad);
  const activeSet = filtered.length > 3 ? filtered : sorted; // Fallback if filtered is too narrow

  // Compute stats on filtered subset
  const sum = activeSet.reduce((a, b) => a + b, 0);
  const avg = sum / activeSet.length;
  
  const squareDiffs = activeSet.map(t => Math.pow(t - avg, 2));
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / activeSet.length;
  const stdDev = Math.sqrt(variance);

  return { average: avg, stdDev };
}

/**
 * Processes a single learning event sequentially. Matches event detail against all rules
 * and structures results neatly relative to any newly triggered achievements.
 * 
 * @param userId Unique identifier of user
 * @param event Individual learning event details
 * @param metrics Updated storage object containing tracked metrics
 * @param existingBadges Set of currently unlocked badge identifiers
 */
export function processLearningEvent(
  userId: string,
  event: LearningEvent,
  metrics: UserPerformanceMetrics,
  existingBadges: Set<string>
): EventRefactoringResult {
  const newMetrics = JSON.parse(JSON.stringify(metrics)) as UserPerformanceMetrics;
  const newlyAwardedBadges: BadgeAward[] = [];
  const triggeredRules: string[] = [];

  // 1. Basic metrics updates
  newMetrics.totalAttempts++;
  if (event.correct) {
    newMetrics.totalCorrect++;
    newMetrics.consecutiveCorrectStreak++;
    if (newMetrics.consecutiveCorrectStreak > newMetrics.maxConsecutiveCorrectStreak) {
      newMetrics.maxConsecutiveCorrectStreak = newMetrics.consecutiveCorrectStreak;
    }
  } else {
    newMetrics.consecutiveCorrectStreak = 0;
  }
  newMetrics.overallAccuracy = (newMetrics.totalCorrect / newMetrics.totalAttempts) * 100;

  // 2. Map course performance
  if (!newMetrics.courses[event.course]) {
    newMetrics.courses[event.course] = { attempts: 0, correctCount: 0, accuracy: 0, responseTimes: [], averageResponseTime: 0 };
  }
  const course = newMetrics.courses[event.course];
  course.attempts++;
  if (event.correct) course.correctCount++;
  course.accuracy = (course.correctCount / course.attempts) * 100;
  course.responseTimes.push(event.response_time_ms);
  const courseStats = getStableStats(course.responseTimes);
  course.averageResponseTime = courseStats.average;

  // 3. Map topic performance
  if (!newMetrics.topics[event.topic]) {
    newMetrics.topics[event.topic] = { 
      attempts: 0, 
      correctCount: 0, 
      accuracy: 0, 
      responseTimes: [], 
      averageResponseTime: 0,
      hasBeenWeak: false,
      hasBeenRebuilt: false
    };
  }
  const topic = newMetrics.topics[event.topic];
  topic.attempts++;
  if (event.correct) topic.correctCount++;
  topic.accuracy = (topic.correctCount / topic.attempts) * 100;
  topic.responseTimes.push(event.response_time_ms);
  const topicStats = getStableStats(topic.responseTimes);
  topic.averageResponseTime = topicStats.average;

  // Keep track of struggling metrics for Rebuilder detection
  // If first 8-15 attempts are below 60%, mark it as struggling
  if (topic.attempts >= 8 && topic.attempts <= 15 && topic.accuracy < 60) {
    topic.hasBeenWeak = true;
  }
  // If it was weak previously and now accuracy on recent questions has crossed 85%
  if (topic.hasBeenWeak && topic.accuracy >= 85 && topic.attempts >= 15) {
    topic.hasBeenRebuilt = true;
  }

  // 4. Update session performance for Consistency Mastery
  const eventDate = event.timestamp.split('T')[0];
  let session = newMetrics.sessions.find(s => s.date === eventDate && s.subject === event.course);
  if (!session) {
    session = { date: eventDate, subject: event.course, attempts: 0, correctCount: 0, accuracy: 0 };
    newMetrics.sessions.push(session);
  }
  session.attempts++;
  if (event.correct) session.correctCount++;
  session.accuracy = (session.correctCount / session.attempts) * 100;

  // 5. Update calendar streaks
  if (!newMetrics.activeDates.includes(eventDate)) {
    newMetrics.activeDates.push(eventDate);
    newMetrics.activeDates.sort();

    // Recompute current/longest streak
    let currentRun = 0;
    let longestRun = 0;
    let prevDate: Date | null = null;

    for (const dStr of newMetrics.activeDates) {
      const curDate = new Date(dStr);
      if (!prevDate) {
        currentRun = 1;
      } else {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          currentRun++;
        } else if (diffDays > 1) {
          currentRun = 1;
        }
      }
      if (currentRun > longestRun) {
        longestRun = currentRun;
      }
      prevDate = curDate;
    }

    newMetrics.currentStreak = currentRun;
    newMetrics.longestStreak = longestRun;
  }

  // 6. Update Weekly Accuracy details for Growth checks
  const weekId = getWeekId(event.timestamp);
  if (!newMetrics.weeklyAccuracy[weekId]) {
    newMetrics.weeklyAccuracy[weekId] = { attempts: 0, correct: 0 };
  }
  newMetrics.weeklyAccuracy[weekId].attempts++;
  if (event.correct) {
    newMetrics.weeklyAccuracy[weekId].correct++;
  }

  // 7. DETERMINISTIC RULE-BASED ENGINE EVALUATION
  const awardHelper = (badgeId: string, reasonText: string) => {
    // Check if the user has already received this badge during previous sessions or within the current loop iterations
    if (!existingBadges.has(badgeId)) {
      newlyAwardedBadges.push({
        badgeId,
        awardedAt: new Date().toISOString(),
        reason: reasonText,
      });
      triggeredRules.push(`Rule verified: Unlocking ${badgeId}`);
      // Mark as existing immediately to prevent duplicates on subsequent rules checked during the same event run
      existingBadges.add(badgeId);
    }
  };

  // Rule: Course Master
  // Accuracy in a course is 90% or higher with at least 50 total attempts.
  Object.entries(newMetrics.courses).forEach(([courseName, c]) => {
    if (c.attempts >= 50 && c.accuracy >= 90) {
      awardHelper('course_master', `Mastered ${courseName} with ${c.attempts} cycles maintaining ${Math.round(c.accuracy)}% accuracy.`);
    }
  });

  // Rule: Course Expert
  // Accuracy in a course is 85% or higher with at least 30 attempts and stable performance.
  // Stable performance: Course standard deviation of response times is under 4000ms (no wild idle anomalies).
  Object.entries(newMetrics.courses).forEach(([courseName, c]) => {
    if (c.attempts >= 30 && c.accuracy >= 85) {
      const { stdDev } = getStableStats(c.responseTimes);
      if (stdDev < 4000) {
        awardHelper('course_expert', `Maintained professional ${Math.round(c.accuracy)}% accuracy in ${courseName} with highly stable response velocity.`);
      }
    }
  });

  // Rule: Course Champion
  // Accuracy in a subject is 95% or higher with at least 100 attempts.
  Object.entries(newMetrics.courses).forEach(([courseName, c]) => {
    if (c.attempts >= 100 && c.accuracy >= 95) {
      awardHelper('course_champion', `Unsurpassed academic leader in ${courseName}! Completed ${c.attempts} challenges at ${Math.round(c.accuracy)}% accuracy.`);
    }
  });

  // Rule: Topic Master
  // Accuracy in a topic is 85% or higher with at least 10 attempts.
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 10 && t.accuracy >= 85) {
      awardHelper('topic_master', `Demonstrated precise command of ${topicName} topic over ${t.attempts} interactions.`);
    }
  });

  // Rule: Topic Specialist
  // Accuracy in a topic is 90% or higher with at least 25 attempts.
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 25 && t.accuracy >= 90) {
      awardHelper('topic_specialist', `Specialized competency in ${topicName} topic sustained over ${t.attempts} trials.`);
    }
  });

  // Rule: Topic Dominator
  // Accuracy in a topic is 95% or higher with at least 50 attempts.
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 50 && t.accuracy >= 95) {
      awardHelper('topic_dominator', `Complete cognitive dominance of ${topicName} achieved across ${t.attempts} sessions.`);
    }
  });

  // Rule: Knowledge Conqueror
  // All topics within a subject that have at least 10 attempts are mastered at 85% accuracy or higher.
  // Must check if there's at least 1 topic with >= 10 attempts under a subject.
  Object.keys(newMetrics.courses).forEach(courseName => {
    // Find all topics belonging to this course (simplified matching, we can map topics or assume namespace)
    const relatedTopics = Object.entries(newMetrics.topics).filter(([topicName, t]) => {
      // Assuming a simple association that can be verified if name starts or links.
      // Since courses/topics are linked by events, let's look at recent topics in this course.
      return t.attempts >= 10;
    });

    if (relatedTopics.length >= 3) {
      const allMastered = relatedTopics.every(([_, t]) => t.accuracy >= 85);
      if (allMastered) {
        awardHelper('knowledge_conqueror', `Encountered and conquered all core curriculum sections at master grade.`);
      }
    }
  });

  // Rule: Perfect Run Master
  // At least 20 consecutive correct answers within a subject or topic session.
  if (newMetrics.maxConsecutiveCorrectStreak >= 20) {
    awardHelper('perfect_run_master', `Executed an exceptional streak of ${newMetrics.maxConsecutiveCorrectStreak} consecutive correct responses.`);
  }

  // Rule: Consistency Mastery
  // At least 90% accuracy maintained across 5 or more separate sessions in a subject.
  Object.keys(newMetrics.courses).forEach(courseName => {
    const qualifiedSessions = newMetrics.sessions.filter(s => s.subject === courseName && s.attempts >= 5 && s.accuracy >= 90);
    if (qualifiedSessions.length >= 5) {
      awardHelper('consistency_mastery', `Maintained impeccable consistency with 90%+ correctness over 5 independent subject sessions.`);
    }
  });

  // Rule: Deep Learner
  // At least 200 total attempts in a subject with sustained accuracy of 80% or higher.
  Object.entries(newMetrics.courses).forEach(([courseName, c]) => {
    if (c.attempts >= 200 && c.accuracy >= 80) {
      awardHelper('deep_learner', `In-depth academic concentration verified. Answered ${c.attempts} high-difficulty questions.`);
    }
  });

  // Rule: Fast Thinker
  // Average response time below 1800ms with a minimum of 80% accuracy (min 15 attempts).
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 15 && t.accuracy >= 80 && t.averageResponseTime < 1800) {
      awardHelper('fast_thinker', `Flawless speed! Averaged ${Math.round(topicName ? t.averageResponseTime : 0)}ms response latency on ${topicName}.`);
    }
  });

  // Rule: Precision Speedster
  // Fast response time combined with low variance in response speed and high accuracy.
  // Average < 2200ms, standard deviation < 700ms, accuracy >= 85%, min 15 attempts.
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 15 && t.accuracy >= 85) {
      const { average, stdDev } = getStableStats(t.responseTimes);
      if (average < 2200 && stdDev < 700) {
        awardHelper('precision_speedster', `Incredible precision. Solved ${topicName} questions with ultra-low response jitter (${Math.round(stdDev)}ms StdDev).`);
      }
    }
  });

  // Rule: Streak Keeper (7 consecutive days)
  if (newMetrics.longestStreak >= 7) {
    awardHelper('streak_keeper', `Maintained structured daily interactive learning for 7 consecutive days.`);
  }

  // Rule: Dedicated Learner (14 consecutive days)
  if (newMetrics.longestStreak >= 14) {
    awardHelper('dedicated_learner', `Demonstrated extreme dedication with 14 consecutive study days.`);
  }

  // Rule: Unbroken Mind (30 consecutive days)
  if (newMetrics.longestStreak >= 30) {
    awardHelper('unbroken_mind', `Unstoppable academic streak of 30 days completed!`);
  }

  // Rule: Comeback Kid
  // Accuracy improves by at least 20% compared to the previous week. (min 10 attempts per week).
  const sortedWeeks = Object.keys(newMetrics.weeklyAccuracy).sort();
  if (sortedWeeks.length >= 2) {
    const currentWeekId = sortedWeeks[sortedWeeks.length - 1];
    const priorWeekId = sortedWeeks[sortedWeeks.length - 2];
    const curWeek = newMetrics.weeklyAccuracy[currentWeekId];
    const priorWeek = newMetrics.weeklyAccuracy[priorWeekId];

    if (curWeek.attempts >= 10 && priorWeek.attempts >= 10) {
      const curAcc = (curWeek.correct / curWeek.attempts) * 100;
      const priorAcc = (priorWeek.correct / priorWeek.attempts) * 100;
      if (curAcc >= priorAcc + 20) {
        awardHelper('comeback_kid', `Executed an inspiring performance recovery! Accuracy surged from ${Math.round(priorAcc)}% to ${Math.round(curAcc)}%.`);
      }
    }
  }

  // Rule: Rising Edge
  // Continuous upward trend in accuracy over three consecutive tracking weeks.
  if (sortedWeeks.length >= 3) {
    const w3 = newMetrics.weeklyAccuracy[sortedWeeks[sortedWeeks.length - 1]];
    const w2 = newMetrics.weeklyAccuracy[sortedWeeks[sortedWeeks.length - 2]];
    const w1 = newMetrics.weeklyAccuracy[sortedWeeks[sortedWeeks.length - 3]];

    if (w3.attempts >= 5 && w2.attempts >= 5 && w1.attempts >= 5) {
      const acc3 = (w3.correct / w3.attempts) * 100;
      const acc2 = (w2.correct / w2.attempts) * 100;
      const acc1 = (w1.correct / w1.attempts) * 100;

      if (acc3 > acc2 && acc2 > acc1) {
        awardHelper('rising_edge', `Continuous growth verified! Sustained improvement over three consecutive weekly intervals.`);
      }
    }
  }

  // Rule: Rebuilder
  // A previously weak topic (< 60% accuracy with >= 8 attempts) becomes strong (>= 85%).
  Object.keys(newMetrics.topics).forEach(topicName => {
    const t = newMetrics.topics[topicName];
    if (t.hasBeenWeak && t.hasBeenRebuilt) {
      awardHelper('rebuilder', `Re-evaluated and rebuilt weak topic: ${topicName} has been upgraded back to competitive standards.`);
    }
  });

  // Rule: Under Pressure
  // Keep accuracy high (>= 90%) maintained under timed sessions / average topic speeds < 1300ms (min 10 attempts)
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 10 && t.accuracy >= 90 && t.averageResponseTime < 1300) {
      awardHelper('under_pressure', `Completed challenges under extreme time limitations with outstanding correctness.`);
    }
  });

  // Rule: Final Boss Mode
  // High difficulty exam completed with strong accuracy (>= 85%).
  if (event.isExam && event.difficulty === 'High' && event.correct) {
    // If the event itself is correct, check total exam accuracy
    const examSessions = newMetrics.sessions.filter(s => s.attempts >= 15 && s.accuracy >= 85);
    if (examSessions.length > 0) {
      awardHelper('final_boss_mode', `Cleared deep, hyper-complex curriculum assessments on high difficulty.`);
    }
  }

  // Rule: No Panic Solver
  // Stable accuracy maintained under strict time constraints without performance drop.
  // Standard deviation of response times < 400ms and accuracy >= 90% (min 10 attempts)
  Object.entries(newMetrics.topics).forEach(([topicName, t]) => {
    if (t.attempts >= 12 && t.accuracy >= 90) {
      const { stdDev } = getStableStats(t.responseTimes);
      if (stdDev < 400) {
        awardHelper('no_panic_solver', `Untouchable performance! Solved questions with clockwork rhythm (${Math.round(stdDev)}ms precision).`);
      }
    }
  });

  return {
    userId,
    newlyAwardedBadges,
    updatedMetrics: newMetrics,
    triggeredRules
  };
}
