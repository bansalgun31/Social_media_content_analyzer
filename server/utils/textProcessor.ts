interface TextAnalysis {
  wordCount: number;
  characterCount: number;
  sentenceCount: number;
  paragraphCount: number;
  language?: string;
  readabilityScore?: number;
  containsPII?: boolean;
  topics?: string[];
}

interface ProcessingOptions {
  removeExtraWhitespace?: boolean;
  normalizeUnicode?: boolean;
  detectLanguage?: boolean;
  detectPII?: boolean;
  extractTopics?: boolean;
  maxLength?: number;
}

export function preprocessText(text: string, options: ProcessingOptions = {}): string {
  let processed = text;

  // Remove extra whitespace by default
  if (options.removeExtraWhitespace !== false) {
    processed = processed
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')   // Handle old Mac line endings
      .replace(/\t+/g, ' ')   // Replace tabs with spaces
      .replace(/ {2,}/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines to 2
  }

  // Normalize Unicode characters
  if (options.normalizeUnicode) {
    processed = processed.normalize('NFKC');
  }

  // Truncate if too long
  if (options.maxLength && processed.length > options.maxLength) {
    processed = processed.substring(0, options.maxLength) + '...';
  }

  return processed.trim();
}

export function analyzeText(text: string, options: ProcessingOptions = {}): TextAnalysis {
  const analysis: TextAnalysis = {
    wordCount: 0,
    characterCount: text.length,
    sentenceCount: 0,
    paragraphCount: 0
  };

  // Count words (split on whitespace and filter empty strings)
  const words = text.split(/\s+/).filter(word => word.length > 0);
  analysis.wordCount = words.length;

  // Count sentences (basic heuristic)
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  analysis.sentenceCount = sentences.length;

  // Count paragraphs (separated by double newlines)
  const paragraphs = text.split(/\n\s*\n/).filter(para => para.trim().length > 0);
  analysis.paragraphCount = paragraphs.length;

  // Detect potential language (very basic heuristic)
  if (options.detectLanguage) {
    analysis.language = detectLanguage(text);
  }

  // Calculate basic readability score
  if (analysis.wordCount > 0 && analysis.sentenceCount > 0) {
    const avgWordsPerSentence = analysis.wordCount / analysis.sentenceCount;
    const avgCharsPerWord = text.replace(/\s+/g, '').length / analysis.wordCount;
    
    // Simplified Flesch Reading Ease approximation
    analysis.readabilityScore = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgWordsPerSentence) - (84.6 * (avgCharsPerWord / 4.7))
    ));
  }

  // Basic PII detection
  if (options.detectPII) {
    analysis.containsPII = detectPII(text);
  }

  // Extract basic topics/keywords
  if (options.extractTopics) {
    analysis.topics = extractTopics(text);
  }

  return analysis;
}

function detectLanguage(text: string): string {
  // Very basic language detection based on common words
  const sample = text.toLowerCase().substring(0, 1000);
  
  const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'de', 'con', 'por', 'para', 'que', 'es'];
  const frenchWords = ['le', 'la', 'et', 'ou', 'mais', 'dans', 'de', 'avec', 'par', 'pour', 'que', 'est'];
  
  const englishScore = countMatches(sample, englishWords);
  const spanishScore = countMatches(sample, spanishWords);
  const frenchScore = countMatches(sample, frenchWords);
  
  if (englishScore >= spanishScore && englishScore >= frenchScore) {
    return 'en';
  } else if (spanishScore >= frenchScore) {
    return 'es';
  } else {
    return 'fr';
  }
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function detectPII(text: string): boolean {
  // Basic PII patterns
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, // Phone number
  ];
  
  return piiPatterns.some(pattern => pattern.test(text));
}

function extractTopics(text: string): string[] {
  // Simple keyword extraction based on word frequency
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3); // Only words longer than 3 characters
  
  // Common stop words to ignore
  const stopWords = new Set([
    'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know', 'want',
    'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here',
    'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than',
    'them', 'well', 'were', 'what', 'your', 'about', 'after', 'again',
    'before', 'being', 'between', 'could', 'during', 'each', 'every',
    'first', 'might', 'never', 'other', 'right', 'should', 'these',
    'those', 'through', 'under', 'until', 'where', 'which', 'while'
  ]);
  
  // Count word frequency
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    if (!stopWords.has(word)) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
  });
  
  // Get top keywords
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export function cleanExtractedText(text: string, sourceType: 'pdf' | 'ocr' | 'docx' | 'txt'): string {
  let cleaned = text;
  
  // Source-specific cleaning
  switch (sourceType) {
    case 'pdf':
      // PDFs often have broken line breaks
      cleaned = cleaned
        .replace(/([a-z])\n([a-z])/g, '$1 $2') // Join broken words
        .replace(/\n{2,}/g, '\n\n'); // Normalize paragraph breaks
      break;
      
    case 'ocr':
      // OCR often has character recognition errors
      cleaned = cleaned
        .replace(/[|\\]/g, 'l') // Common OCR errors
        .replace(/0/g, 'O') // Zero to O in appropriate contexts
        .replace(/5/g, 'S') // 5 to S in appropriate contexts
        .replace(/1/g, 'l') // 1 to l in appropriate contexts
        .replace(/rn/g, 'm') // rn to m
        .replace(/\s{2,}/g, ' '); // Multiple spaces to single
      break;
      
    case 'docx':
      // DOCX usually clean, just normalize
      cleaned = cleaned
        .replace(/\u00A0/g, ' ') // Non-breaking space to regular space
        .replace(/\u2013|\u2014/g, '-') // Em/en dashes to hyphen
        .replace(/\u201C|\u201D/g, '"') // Smart quotes to regular quotes
        .replace(/\u2018|\u2019/g, "'"); // Smart apostrophes
      break;
      
    case 'txt':
      // Text files might have encoding issues
      cleaned = cleaned
        .replace(/\uFFFD/g, '?') // Replace replacement characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars
      break;
  }
  
  // Apply general preprocessing
  return preprocessText(cleaned, {
    removeExtraWhitespace: true,
    normalizeUnicode: true,
    maxLength: 100000 // 100KB max
  });
}