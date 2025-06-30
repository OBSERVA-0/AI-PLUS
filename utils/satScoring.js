// Official College Board Digital SAT Scoring Conversion Tables
// Based on official practice tests and scoring guides
// CORRECT STRUCTURE: Reading & Writing (54 questions), Math (44 questions), Total (98 questions)

// Reading and Writing Section (Combined) - Raw Score 0-54, Scaled Score 200-800
const readingWritingConversion = {
    0: 200, 1: 200, 2: 200, 3: 200, 4: 200, 5: 200, 6: 210, 7: 230, 8: 250, 9: 270, 10: 280,
    11: 290, 12: 310, 13: 320, 14: 330, 15: 340, 16: 360, 17: 375, 18: 375, 19: 385, 20: 395,
    21: 405, 22: 410, 23: 420, 24: 430, 25: 430, 26: 440, 27: 450, 28: 460, 29: 470, 30: 480,
    31: 490, 32: 500, 33: 500, 34: 510, 35: 520, 36: 530, 37: 540, 38: 550, 39: 555, 40: 565,
    41: 575, 42: 585, 43: 605, 44: 615, 45: 625, 46: 635, 47: 640, 48: 650, 49: 655, 50: 665,
    51: 680, 52: 690, 53: 720, 54: 800
};

// Math Section - Raw Score 0-44, Scaled Score 200-800
const mathConversion = {
    0: 200, 1: 200, 2: 200, 3: 200, 4: 200, 5: 200, 6: 210, 7: 225, 8: 245, 9: 305, 10: 315,
    11: 320, 12: 330, 13: 340, 14: 350, 15: 360, 16: 360, 17: 370, 18: 370, 19: 380, 20: 390,
    21: 400, 22: 400, 23: 410, 24: 420, 25: 430, 26: 440, 27: 450, 28: 465, 29: 485, 30: 490,
    31: 500, 32: 510, 33: 520, 34: 540, 35: 550, 36: 560, 37: 570, 38: 580, 39: 590, 40: 600,
    41: 615, 42: 645, 43: 710, 44: 800
};

/**
 * Convert Digital SAT raw scores to scaled scores
 * @param {number} rawScore - Number of correct answers
 * @param {string} section - 'math' or 'readingwriting'
 * @returns {number} Scaled score (200-800)
 */
const convertSatRawToScaled = (rawScore, section) => {
    // Validate input
    if (typeof rawScore !== 'number' || rawScore < 0) {
        return 200;
    }
    
    if (section === 'math') {
        // Math section: 44 questions max
        if (rawScore > 44) rawScore = 44;
        return mathConversion[rawScore] || 200;
    } else if (section === 'readingwriting' || section === 'ebrw') {
        // Reading and Writing combined: 54 questions max
        if (rawScore > 54) rawScore = 54;
        return readingWritingConversion[rawScore] || 200;
    } else {
        throw new Error('Invalid section. Use "math" or "readingwriting"');
    }
};

/**
 * Calculate total SAT score from section scores
 * @param {number} mathScore - Math scaled score (200-800)
 * @param {number} readingWritingScore - Reading & Writing scaled score (200-800)
 * @returns {number} Total SAT score (400-1600)
 */
const calculateTotalSatScore = (mathScore, readingWritingScore) => {
    const total = mathScore + readingWritingScore;
    // Ensure total is within valid range
    return Math.max(400, Math.min(1600, total));
};

/**
 * Get SAT percentile rank based on total score
 * @param {number} totalScore - Total SAT score (400-1600)
 * @returns {number} Percentile rank (1-99)
 */
const getSatPercentile = (totalScore) => {
    // Approximate percentile mapping based on College Board data
    const percentileMap = {
        1600: 99, 1590: 99, 1580: 99, 1570: 99, 1560: 99, 1550: 99, 1540: 99, 1530: 99,
        1520: 99, 1510: 99, 1500: 99, 1490: 99, 1480: 99, 1470: 98, 1460: 98, 1450: 98,
        1440: 98, 1430: 97, 1420: 97, 1410: 97, 1400: 96, 1390: 96, 1380: 95, 1370: 95,
        1360: 95, 1350: 94, 1340: 94, 1330: 93, 1320: 92, 1310: 92, 1300: 92, 1290: 91,
        1280: 90, 1270: 89, 1260: 89, 1250: 87, 1240: 87, 1230: 86, 1220: 85, 1210: 84,
        1200: 83, 1190: 81, 1180: 81, 1170: 79, 1160: 77, 1150: 77, 1140: 75, 1130: 74,
        1120: 72, 1110: 71, 1100: 69, 1090: 68, 1080: 66, 1070: 65, 1060: 63, 1050: 62,
        1040: 60, 1030: 59, 1020: 56, 1010: 55, 1000: 53, 990: 52, 980: 49, 970: 48,
        960: 46, 950: 44, 940: 42, 930: 41, 920: 38, 910: 37, 900: 35, 890: 34, 880: 31,
        870: 30, 860: 28, 850: 27, 840: 25, 830: 23, 820: 22, 810: 20, 800: 19, 790: 17,
        780: 16, 770: 14, 760: 14, 750: 12, 740: 11, 730: 10, 720: 10, 710: 8, 700: 8,
        690: 7, 680: 6, 670: 6, 660: 5, 650: 5, 640: 4, 630: 4, 620: 3, 610: 3, 600: 3,
        590: 2, 580: 2, 570: 2, 560: 2, 550: 1, 540: 1, 530: 1, 520: 1, 510: 1, 500: 1,
        490: 1, 480: 1, 470: 1, 460: 1, 450: 1, 440: 1, 430: 1, 420: 1, 410: 1, 400: 1
    };
    
    // Find closest score or interpolate
    for (let score = totalScore; score >= 400; score -= 10) {
        if (percentileMap[score]) {
            return percentileMap[score];
        }
    }
    return 1; // Minimum percentile
};

/**
 * Get performance level based on total score
 * @param {number} totalScore - Total SAT score (400-1600)
 * @returns {string} Performance level description
 */
const getPerformanceLevel = (totalScore) => {
    if (totalScore >= 1400) return 'Excellent';
    if (totalScore >= 1200) return 'Good';
    if (totalScore >= 1000) return 'Average';
    if (totalScore >= 800) return 'Below Average';
    return 'Needs Improvement';
};

/**
 * Calculate comprehensive SAT results from raw scores
 * @param {number} mathRawScore - Math raw score (0-44)
 * @param {number} readingWritingRawScore - Reading & Writing raw score (0-54)
 * @returns {Object} Complete SAT score breakdown
 */
const calculateSatResults = (mathRawScore, readingWritingRawScore) => {
    const mathScaled = convertSatRawToScaled(mathRawScore, 'math');
    const readingWritingScaled = convertSatRawToScaled(readingWritingRawScore, 'readingwriting');
    const totalScore = calculateTotalSatScore(mathScaled, readingWritingScaled);
    const percentile = getSatPercentile(totalScore);
    const performanceLevel = getPerformanceLevel(totalScore);
    
    return {
        math: {
            rawScore: mathRawScore,
            scaledScore: mathScaled,
            maxRaw: 44
        },
        readingWriting: {
            rawScore: readingWritingRawScore,
            scaledScore: readingWritingScaled,
            maxRaw: 54
        },
        total: {
            score: totalScore,
            percentile: percentile,
            performanceLevel: performanceLevel
        }
    };
};

module.exports = {
    convertSatRawToScaled,
    calculateTotalSatScore,
    getSatPercentile,
    getPerformanceLevel,
    calculateSatResults
};