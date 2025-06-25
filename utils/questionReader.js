const fs = require('fs').promises;
const path = require('path');

async function readQuestionsFromJSON(testType, practiceSet = '1') {
  try {
    const filePath = path.join(__dirname, '..', 'data', `${testType}practice${practiceSet}questions.json`);
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