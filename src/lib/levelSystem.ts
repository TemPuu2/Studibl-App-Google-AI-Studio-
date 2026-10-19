/**
 * Student Level Progression System Configuration and Calculations.
 *
 * This module defines the XP requirements, milestone level tags,
 * and helper functions to calculate progression dynamics.
 *
 * Strict Rules for Levels 1 to 10:
 * - Level 1: 0 XP        — Initiate
 * - Level 2: 500 XP      — Starter
 * - Level 3: 1,500 XP    — Learner
 * - Level 4: 3,000 XP    — Builder
 * - Level 5: 7,000 XP    — Competent
 * - Level 6: 15,000 XP   — Skilled
 * - Level 7: 35,000 XP   — Advanced
 * - Level 8: 70,000 XP   — Elite
 * - Level 9: 120,000 XP  — Master
 * - Level 10: 200,000 XP — Grandmaster
 *
 * Progressive Scaling for higher levels (> 10):
 * - Level thresholds scale mathematical based on the increasing gap.
 * - Gap from L9 to L10 is 80,000 XP.
 * - For L11 and beyond, the gap between consecutive levels increases progressively
 *   by +50,000 XP per level.
 *   - Level 11: 200,000 + 100,000 = 300,000 XP
 *   - Level 12: 300,000 + 150,000 = 450,000 XP
 *   - Level 13: 450,000 + 200,000 = 650,000 XP
 *   - etc.
 */

export interface LevelThreshold {
  level: number;
  xpRequired: number; // Cumulative XP needed to reach this level
  title: string;      // The badge/rank title for this milestone
}

// Configurable hardcoded thresholds for the baseline levels (1-10)
export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, xpRequired: 0, title: 'Initiate' },
  { level: 2, xpRequired: 500, title: 'Starter' },
  { level: 3, xpRequired: 1500, title: 'Learner' },
  { level: 4, xpRequired: 3000, title: 'Builder' },
  { level: 5, xpRequired: 7000, title: 'Competent' },
  { level: 6, xpRequired: 15000, title: 'Skilled' },
  { level: 7, xpRequired: 35000, title: 'Advanced' },
  { level: 8, xpRequired: 70000, title: 'Elite' },
  { level: 9, xpRequired: 120000, title: 'Master' },
  { level: 10, xpRequired: 200000, title: 'Grandmaster' },
];

/**
 * Converts a standard integer into Roman numerals used for progressive tiers above Level 10.
 * E.g., 1 -> I, 2 -> II, 3 -> III.
 */
function toRoman(num: number): string {
  const romanMap: { [key: string]: number } = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1,
  };
  let result = '';
  let activeNum = num;
  for (const key in romanMap) {
    while (activeNum >= romanMap[key]) {
      result += key;
      activeNum -= romanMap[key];
    }
  }
  return result || 'I';
}

export interface LevelProgressDetails {
  level: number;
  rankTitle: string;
  totalXP: number;
  currentLevelMinXP: number;      // XP required for current level start
  nextLevelXPRequired: number;     // Total XP required for next level
  xpEarnedInCurrentLevel: number;  // XP accumulated in this level's range
  xpNeededForNextLevel: number;    // Additional XP needed to level up
  xpRangeForLevel: number;         // Total XP gap between current and next level
  progressPercentage: number;      // Percentage of progress toward next level (0-100)
}

/**
 * Calculates current level details based on user's cumulative XP.
 * Designed to cleanly handle any amount of positive accumulated XP.
 * 
 * @param totalXP The total cumulative XP of the user.
 * @returns Comprehensive details about current level, title, ranges, and progressions.
 */
export function calculateLevelFromXP(totalXP: number | any): LevelProgressDetails {
  // Defensively handle non-number, null, or undefined values for totalXP
  let parsedXP = 0;
  if (typeof totalXP === 'number') {
    parsedXP = totalXP;
  } else if (totalXP !== null && totalXP !== undefined) {
    const parsed = parseInt(String(totalXP), 10);
    parsedXP = isNaN(parsed) ? 0 : parsed;
  }
  
  const activeXP = isNaN(parsedXP) ? 0 : Math.max(0, parsedXP);

  // Find the highest hardcoded level milestone the user qualifies for
  let matchedIndex = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (activeXP >= LEVEL_THRESHOLDS[i].xpRequired) {
      matchedIndex = i;
    } else {
      break;
    }
  }

  let finalLevel = LEVEL_THRESHOLDS[matchedIndex].level;
  let finalTitle = LEVEL_THRESHOLDS[matchedIndex].title;
  let currentLevelMinXP = LEVEL_THRESHOLDS[matchedIndex].xpRequired;
  let nextLevelXPRequired = 0;

  // Level is still within the pre-defined 1-10 range
  if (finalLevel < 10) {
    nextLevelXPRequired = LEVEL_THRESHOLDS[matchedIndex + 1].xpRequired;
  } else {
    // Elevate beyond Level 10 progressively:
    // Level 10 starts at 200,000 XP.
    // L10 gap to L11 = 100,000 XP (L11 = 300,000 XP)
    // L11 gap to L12 = 150,000 XP (L12 = 450,000 XP)
    // Each level's gap increases by +50,000 XP
    let currentLvl = 10;
    let accumXP = 200000;
    let currentGap = 100000;

    while (activeXP >= accumXP + currentGap) {
      accumXP += currentGap;
      currentLvl++;
      currentGap += 50000;
    }

    finalLevel = currentLvl;
    currentLevelMinXP = accumXP;
    nextLevelXPRequired = accumXP + currentGap;
    
    // Grandmaster Tier Roman numeral tags (Tier I, II, III, IV, etc.)
    const tier = finalLevel - 9; // Level 10 is Tier I, 11 is Tier II etc.
    finalTitle = `Grandmaster Tier ${toRoman(tier)}`;
  }

  const xpEarnedInCurrentLevel = activeXP - currentLevelMinXP;
  const xpRangeForLevel = nextLevelXPRequired - currentLevelMinXP;
  const xpNeededForNextLevel = Math.max(0, nextLevelXPRequired - activeXP);
  
  // Progress calculations with a safety cap between 0 and 100
  const rawPercentage = xpRangeForLevel > 0 
    ? (xpEarnedInCurrentLevel / xpRangeForLevel) * 100 
    : 100;
  const progressPercentage = Math.max(0, Math.min(100, Math.floor(rawPercentage)));

  return {
    level: finalLevel,
    rankTitle: finalTitle,
    totalXP: activeXP,
    currentLevelMinXP,
    nextLevelXPRequired,
    xpEarnedInCurrentLevel,
    xpNeededForNextLevel,
    xpRangeForLevel,
    progressPercentage,
  };
}
