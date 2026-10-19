/**
 * @file xpCalculator.ts
 * @description Centralized, deterministic XP reward calculation engine.
 * Ensures identical inputs always produce identical XP results without any randomness.
 */

export interface XPBreakdown {
  correctXP: number;     // XP earned from correct answers (+5 per correct)
  incorrectXP: number;   // XP earned from incorrect/participation answers (+1 per incorrect)
  completionXP: number;  // Base completion bonus (+20 if completed/total > 0)
  isPerfect: boolean;    // Flag indicating if user got 100% correct
  perfectXP: number;     // Extra perfect score bonus (+15 if accuracy is 100%)
  isExam: boolean;       // Flag indicating if mission is an exam
  examXP: number;        // Extra exam completion bonus (+100 if exam)
  totalXP: number;       // Combined deterministic XP value
}

/**
 * Calculates a fully deterministic study XP reward based on question performance,
 * mission type, and correctness accuracy, adhering strictly to course syllabus rules.
 * 
 * @param score The number of correct questions answered.
 * @param total The total number of questions in this mission.
 * @param isExamOrType Whether this was an exam. Can be boolean or mission type string ('Exam').
 * @returns The comprehensive, fully deterministic XP breakdown structure.
 */
export function calculateXP(score: number, total: number, isExamOrType?: boolean | string): XPBreakdown {
  // Ensure we don't end up with negative values or bad data inputs
  const safeTotal = Math.max(0, total);
  const safeScore = Math.max(0, Math.min(score, safeTotal));
  const incorrectCount = Math.max(0, safeTotal - safeScore);

  // 1. Calculate base performance-based XP
  const correctXP = safeScore * 5;      // Correct answer = +5 XP
  const incorrectXP = incorrectCount * 1; // Incorrect answer = +1 XP (participation reward)

  // 2. Base completion bonus
  // Completion of any mission with at least 1 question earns +20 XP
  const completionXP = safeTotal > 0 ? 20 : 0;

  // 3. Perfect score extra bonus
  // Earns a flat +15 XP bonus if score equals the total, and there is at least 1 question
  const isPerfect = safeTotal > 0 && safeScore === safeTotal;
  const perfectXP = isPerfect ? 15 : 0;

  // 4. Exam completion bonus
  // Flat +100 XP if mission classification is "Exam"
  const isExam = isExamOrType === true || isExamOrType === 'Exam';
  const examXP = isExam ? 100 : 0;

  // 5. Total calculation logic: Combined sum of all elements
  const totalXP = correctXP + incorrectXP + completionXP + perfectXP + examXP;

  return {
    correctXP,
    incorrectXP,
    completionXP,
    isPerfect,
    perfectXP,
    isExam,
    examXP,
    totalXP,
  };
}
