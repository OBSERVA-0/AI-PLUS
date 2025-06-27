const fs = require('fs').promises;
const path = require('path');

async function readQuestionsFromJSON(testType, practiceSet = '1') {
  let filePath;
  if (testType === 'shsat' && practiceSet === 'diagnostic') {
    filePath = path.join(__dirname, '..', 'data', 'shsatdiagnosticquestions.json');
  } else if (testType === 'shsat') {
    filePath = path.join(__dirname, '..', 'data', `shsatpractice${practiceSet}questions.json`);
  } else if (testType === 'sat') {
    filePath = path.join(__dirname, '..', 'data', `satpractice${practiceSet}questions.json`);
  } else {
    // Fallback for state tests or other types
    filePath = path.join(__dirname, '..', 'data', `${testType}practice${practiceSet}questions.json`);
  }

  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading questions file for ${testType} practice set ${practiceSet}:`, error);
    throw new Error(`Failed to load questions for ${testType} practice set ${practiceSet}.`);
  }
}

module.exports = {
  readQuestionsFromJSON
}; 