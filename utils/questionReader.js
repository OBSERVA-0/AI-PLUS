const fs = require('fs').promises;
const path = require('path');

async function readQuestionsFromJSON(testType, practiceSet = '1', sectionType = null) {
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
  } else if (testType === 'statetest') {
    // Handle state test files with new folder structure
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
    // For section-specific SHSAT files, don't fall back - just throw error if file doesn't exist
    if (testType === 'shsat' && (sectionType === 'ela' || sectionType === 'math')) {
      console.log(`Section-specific file not found: ${filePath}`);
      throw new Error(`Section-specific file not available for ${testType} practice set ${practiceSet} (${sectionType}).`);
    }
    
    console.error(`Error reading questions file for ${testType} practice set ${practiceSet}:`, error);
    throw new Error(`Failed to load questions for ${testType} practice set ${practiceSet}.`);
  }
}

module.exports = {
  readQuestionsFromJSON
}; 