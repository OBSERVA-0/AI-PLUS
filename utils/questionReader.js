const fs = require('fs').promises;
const path = require('path');

// In-memory cache for question data to avoid repeated filesystem reads
// Cache structure: { key: { data: questions[], timestamp: Date, hits: number } }
const questionCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache TTL
const MAX_CACHE_SIZE = 50; // Maximum number of cached question sets

/**
 * Get cache key for a specific question set
 */
function getCacheKey(testType, practiceSet, sectionType) {
  return `${testType}_${practiceSet}_${sectionType || 'full'}`;
}

/**
 * Clean expired cache entries and enforce size limit
 */
function cleanCache() {
  const now = Date.now();
  
  // Remove expired entries
  for (const [key, entry] of questionCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      questionCache.delete(key);
    }
  }
  
  // If still over limit, remove least recently used entries
  if (questionCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(questionCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, questionCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => questionCache.delete(key));
  }
}

/**
 * Get questions from cache or load from file
 */
async function readQuestionsFromJSON(testType, practiceSet = '1', sectionType = null) {
  const cacheKey = getCacheKey(testType, practiceSet, sectionType);
  
  // Check cache first
  const cached = questionCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    cached.hits++;
    // Return a copy to prevent mutation
    return JSON.parse(JSON.stringify(cached.data));
  }
  
  // Clean cache periodically (every 10th miss)
  if (Math.random() < 0.1) {
    cleanCache();
  }
  
  // Load from file
  const questions = await loadQuestionsFromFile(testType, practiceSet, sectionType);
  
  // Store in cache
  questionCache.set(cacheKey, {
    data: questions,
    timestamp: Date.now(),
    hits: 0
  });
  
  return questions;
}

/**
 * Internal function to load questions from filesystem
 */
async function loadQuestionsFromFile(testType, practiceSet = '1', sectionType = null) {
  let filePath;
  
  if (testType === 'shsat' && practiceSet === 'diagnostic') {
    // Handle diagnostic test with section filtering
    if (sectionType === 'ela') {
      filePath = path.join(__dirname, '..', 'data', 'SHSAT', 'shsatdiagnosticelaquestions.json');
    } else if (sectionType === 'math') {
      filePath = path.join(__dirname, '..', 'data', 'SHSAT', 'shsatdiagnosticmathquestions.json');
    } else {
      filePath = path.join(__dirname, '..', 'data', 'SHSAT', 'shsatdiagnosticquestions.json');
    }
  } else if (testType === 'shsat') {
    // Handle practice tests with section filtering
    if (sectionType === 'ela') {
      filePath = path.join(__dirname, '..', 'data', 'SHSAT', `shsatpractice${practiceSet}elaquestions.json`);
    } else if (sectionType === 'math') {
      filePath = path.join(__dirname, '..', 'data', 'SHSAT', `shsatpractice${practiceSet}mathquestions.json`);
    } else {
      filePath = path.join(__dirname, '..', 'data', 'SHSAT', `shsatpractice${practiceSet}questions.json`);
    }
  } else if (testType === 'sat') {
    filePath = path.join(__dirname, '..', 'data', 'SAT', `satpractice${practiceSet}questions.json`);
  } else if (testType === 'psat') {
    filePath = path.join(__dirname, '..', 'data', 'PSAT', `psatpractice${practiceSet}questions.json`);
  } else if (testType === 'statetest') {
    // Handle state test files with grade/subject awareness
    // sectionType format: g{grade}{subject} (e.g., g6math, g7ela)
    if (sectionType && sectionType.startsWith('g')) {
      const grade = sectionType.charAt(1);
      const subject = sectionType.substring(2);
      const baseDir = path.join(__dirname, '..', 'data', 'State-Test', `Grade-${grade}`);
      
      const candidates = [
        // New naming convention to avoid practice set conflicts: practiceXgradeY
        path.join(baseDir, `statetestpractice${practiceSet}grade${grade}questions.json`),
        path.join(baseDir, `statetestpractice${practiceSet}grade${grade}questions.json.json`), // Handle double .json
        path.join(baseDir, `statetespractice${practiceSet}grade${grade}questions.json`), // Handle typo
        path.join(baseDir, `statetespractice${practiceSet}grade${grade}questions.json.json`), // Handle typo + double .json
        // Subject-specific files with new naming
        path.join(baseDir, `statetestpractice${practiceSet}grade${grade}${subject}questions.json`),
        path.join(baseDir, `statetespractice${practiceSet}grade${grade}${subject}questions.json`),
        // Original naming patterns (fallback)
        path.join(baseDir, `statetestpractice${practiceSet}questionsg${grade}${subject ? subject : ''}.json`),
        path.join(baseDir, `statetespractice${practiceSet}questionsg${grade}${subject ? subject : ''}.json`),
        path.join(baseDir, `statetestpractice${practiceSet}questionsg${grade}.json`),
        path.join(baseDir, `statetespractice${practiceSet}questionsg${grade}.json`)
      ];

      for (const candidate of candidates) {
        try {
          const data = await fs.readFile(candidate, 'utf8');
          return JSON.parse(data);
        } catch (e) {
          // Try next candidate
        }
      }
      console.error(`Error reading questions file for statetest grade ${grade} practice set ${practiceSet}: tried ${candidates.join(', ')}`);
      throw new Error(`Failed to load questions for ${testType} grade ${grade} practice set ${practiceSet}.`);
    }
    
    // Fallback: Handle state test files without specific grade/subject info (legacy)
    const baseDir = path.join(__dirname, '..', 'data', 'State-Test', 'Grade-7');
    const candidates = [
      path.join(baseDir, `statetestpractice${practiceSet}questionsg7.json`),
      path.join(baseDir, `statetestpractice${practiceSet}questions.json`),
      path.join(baseDir, `statetestpractice${practiceSet}questionsg8.json`)
    ];

    for (const candidate of candidates) {
      try {
        const data = await fs.readFile(candidate, 'utf8');
        return JSON.parse(data);
      } catch (e) {
        // Try next candidate
      }
    }
    console.error(`Error reading questions file for statetest practice set ${practiceSet}: tried ${candidates.join(', ')}`);
    throw new Error(`Failed to load questions for ${testType} practice set ${practiceSet}.`);
  } else {
    // Fallback for other test types - assume they follow the new folder structure
    filePath = path.join(__dirname, '..', 'data', testType.toUpperCase(), `${testType}practice${practiceSet}questions.json`);
  }

  try {
    const data = await fs.readFile(filePath, 'utf8');
    let questions = JSON.parse(data);
    return questions;
  } catch (error) {
    // For section-specific SHSAT files, fall back to full test and filter by section
    if (testType === 'shsat' && (sectionType === 'ela' || sectionType === 'math')) {
      console.log(`Section-specific file not found: ${filePath}, falling back to full test with filtering`);
      try {
        // Try to load the full test file
        const fullFilePath = path.join(__dirname, '..', 'data', 'SHSAT', `shsatpractice${practiceSet}questions.json`);
        const fullData = await fs.readFile(fullFilePath, 'utf8');
        let allQuestions = JSON.parse(fullData);
        
        // Filter questions by section based on question numbers or categories
        let filteredQuestions;
        if (sectionType === 'ela') {
          // ELA questions are typically 1-57 or have reading/revising categories
          filteredQuestions = allQuestions.filter(q => 
            q.question_number <= 57 || 
            (q.category && (q.category.toLowerCase().includes('reading') || q.category.toLowerCase().includes('revising')))
          );
        } else if (sectionType === 'math') {
          // Math questions are typically 58-114 or have math categories
          filteredQuestions = allQuestions.filter(q => 
            q.question_number > 57 || 
            (q.category && q.category.toLowerCase().includes('math'))
          );
        }
        
        console.log(`Filtered ${filteredQuestions.length} ${sectionType} questions from ${allQuestions.length} total questions`);
        return filteredQuestions;
      } catch (fallbackError) {
        console.error(`Fallback also failed for ${testType} practice set ${practiceSet}:`, fallbackError);
        throw new Error(`No questions available for ${testType} practice set ${practiceSet} (${sectionType}).`);
      }
    }
    
    console.error(`Error reading questions file for ${testType} practice set ${practiceSet}:`, error);
    throw new Error(`Failed to load questions for ${testType} practice set ${practiceSet}.`);
  }
}

/**
 * Clear the question cache (useful for admin operations or testing)
 */
function clearQuestionCache() {
  questionCache.clear();
  console.log('📚 Question cache cleared');
}

/**
 * Get cache statistics for monitoring
 */
function getCacheStats() {
  let totalHits = 0;
  for (const entry of questionCache.values()) {
    totalHits += entry.hits;
  }
  return {
    size: questionCache.size,
    totalHits,
    maxSize: MAX_CACHE_SIZE,
    ttlMinutes: CACHE_TTL_MS / 60000
  };
}

module.exports = {
  readQuestionsFromJSON,
  clearQuestionCache,
  getCacheStats
}; 