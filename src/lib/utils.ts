import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Message } from '../types';

/**
 * Utility for merging tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Intelligent AI bookmark title generator.
 */
export function generateAIBookmarkTitle(input: any): string {
  // 1. Determine target content based on message/saved item type
  let content = '';
  
  // Handle Message object
  if (input.explanation?.explanation) {
    content = input.explanation.explanation;
  } else if (input.analysis?.summary) {
    content = input.analysis.summary;
  } else if (input.quiz) {
    content = input.content || '';
  }
  // Handle SavedAIContent object (metadata structure)
  else if (input.metadata?.explanation?.explanation) {
    content = input.metadata.explanation.explanation;
  } else if (input.metadata?.analysis?.summary) {
    content = input.metadata.analysis.summary;
  } else if (input.metadata?.quiz) {
    content = input.content || '';
  }
  // Generic fallback
  else {
    content = input.content || '';
  }

  if (!content || (content.length < 5 && !input.quiz)) return 'AI Insight';

  // 2. Try to find a header/title in the content
  // Look for markdown headers: # Title, ## Title, ### Title, or **Title** at the start
  // We look for titles in the first 300 characters to be efficient
  const contentStart = content.substring(0, 300).trim();
  
  // Try to find a # Header or **Bold Header** at the very beginning
  const headerMatch = contentStart.match(/^(?:#+\s*|\*\*)(.*?)(\*\*|#+)?$/m);
  
  if (headerMatch && headerMatch[1]) {
    let title = headerMatch[1].trim();
    // Clean up any remaining markdown symbols from the title itself
    title = title.replace(/[#*`_~]/g, '').trim();
    
    // Validate length - not too short and not too long for a title
    if (title.length > 3 && title.length < 80) {
      return title;
    }
  }

  // 3. Fallback: Generate from text
  // Remove markdown symbols and common intro patterns first
  const cleanText = content
    .replace(/[#*`_~]/g, '')
    .replace(/\[.*?\]/g, '') // Remove [Links]
    .replace(/Based on your request.*?:/gi, '') // Remove common intro patterns
    .replace(/Sure, let's dive into/gi, '')
    .replace(/I've analyzed your performance/gi, '')
    .trim();

  if (!cleanText || cleanText.length < 5) return 'AI Response';

  // Take the first meaningful sentence or non-empty line
  const candidates = cleanText.split(/[.!?\n]/).map(s => s.trim()).filter(s => s.length > 5);
  
  // Truncate at word or character boundary
  const maxChars = 60;
  const maxWords = 8;
  
  let finalTitle = (candidates[0] || cleanText.slice(0, 80)).replace(/^[:\-,.\s]+/, '').trim();

  // Word count limit
  const words = finalTitle.split(/\s+/);
  if (words.length > maxWords) {
    finalTitle = words.slice(0, maxWords).join(' ') + '...';
  } else if (finalTitle.length > maxChars) {
    // Character limit if words are long
    const truncated = finalTitle.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) {
      finalTitle = truncated.substring(0, lastSpace) + '...';
    } else {
      finalTitle = truncated + '...';
    }
  }

  return finalTitle;
}
