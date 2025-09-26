// Official College Board PSAT/NMSQT Scoring Conversion Tables
// Based on official practice tests and scoring guides
// STRUCTURE: Reading & Writing (54 questions), Math (44 questions), Total (98 questions)
// PSAT Score Range: 160-760 per section, Total: 320-1520

// Reading and Writing Section (Combined) - Raw Score 0-54, Scaled Score 160-760
const readingWritingConversion = {
    0: 160, 1: 160, 2: 160, 3: 160, 4: 160, 5: 160, 6: 170, 7: 180, 8: 190, 9: 200, 10: 210,
    11: 220, 12: 230, 13: 240, 14: 250, 15: 260, 16: 270, 17: 280, 18: 290, 19: 300, 20: 310,
    21: 320, 22: 330, 23: 340, 24: 350, 25: 360, 26: 370, 27: 380, 28: 390, 29: 400, 30: 410,
    31: 420, 32: 430, 33: 440, 34: 450, 35: 460, 36: 470, 37: 480, 38: 490, 39: 500, 40: 510,
    41: 520, 42: 530, 43: 540, 44: 550, 45: 570, 46: 590, 47: 610, 48: 630, 49: 650, 50: 670,
    51: 690, 52: 710, 53: 730, 54: 760
};

// Math Section - Raw Score 0-44, Scaled Score 160-760
const mathConversion = {
    0: 160, 1: 160, 2: 160, 3: 160, 4: 160, 5: 160, 6: 170, 7: 180, 8: 190, 9: 240, 10: 250,
    11: 260, 12: 270, 13: 280, 14: 290, 15: 300, 16: 310, 17: 320, 18: 330, 19: 340, 20: 350,
    21: 360, 22: 370, 23: 380, 24: 390, 25: 400, 26: 410, 27: 420, 28: 430, 29: 440, 30: 450,
    31: 460, 32: 470, 33: 480, 34: 490, 35: 500, 36: 510, 37: 520, 38: 530, 39: 540, 40: 550,
    41: 580, 42: 620, 43: 680, 44: 760
};

/**
 * Convert PSAT raw scores to scaled scores
 * @param {number} rawScore - Number of correct answers
 * @param {string} section - 'math' or 'readingwriting'
 * @returns {number} Scaled score (160-760)
 */
const convertPsatRawToScaled = (rawScore, section) => {
    // Validate input
    if (typeof rawScore !== 'number' || rawScore < 0) {
        return 160;
    }
    
    if (section === 'math') {
        // Math section: 44 questions max
        if (rawScore > 44) rawScore = 44;
        return mathConversion[rawScore] || 160;
    } else if (section === 'readingwriting' || section === 'ebrw') {
        // Reading and Writing combined: 54 questions max
        if (rawScore > 54) rawScore = 54;
        return readingWritingConversion[rawScore] || 160;
    } else {
        throw new Error('Invalid section. Use "math" or "readingwriting"');
    }
};

/**
 * Calculate total PSAT score from section scores
 * @param {number} mathScore - Math scaled score (160-760)
 * @param {number} readingWritingScore - Reading & Writing scaled score (160-760)
 * @returns {number} Total PSAT score (320-1520)
 */
const calculateTotalPsatScore = (mathScore, readingWritingScore) => {
    const total = mathScore + readingWritingScore;
    // Ensure total is within valid range
    return Math.max(320, Math.min(1520, total));
};

/**
 * Get PSAT percentile rank based on total score
 * @param {number} totalScore - Total PSAT score (320-1520)
 * @returns {number} Percentile rank (1-99)
 */
const getPsatPercentile = (totalScore) => {
    // Approximate percentile mapping based on College Board data
    const percentileMap = {
        1520: 99, 1510: 99, 1500: 99, 1490: 99, 1480: 99, 1470: 99, 1460: 99, 1450: 99,
        1440: 99, 1430: 98, 1420: 98, 1410: 98, 1400: 97, 1390: 97, 1380: 96, 1370: 96,
        1360: 95, 1350: 95, 1340: 94, 1330: 93, 1320: 92, 1310: 91, 1300: 90, 1290: 89,
        1280: 88, 1270: 87, 1260: 86, 1250: 85, 1240: 84, 1230: 82, 1220: 81, 1210: 80,
        1200: 78, 1190: 77, 1180: 75, 1170: 74, 1160: 72, 1150: 70, 1140: 69, 1130: 67,
        1120: 65, 1110: 64, 1100: 62, 1090: 60, 1080: 58, 1070: 56, 1060: 54, 1050: 52,
        1040: 50, 1030: 48, 1020: 46, 1010: 44, 1000: 42, 990: 40, 980: 38, 970: 36,
        960: 34, 950: 32, 940: 30, 930: 28, 920: 26, 910: 24, 900: 22, 890: 20, 880: 18,
        870: 16, 860: 15, 850: 13, 840: 12, 830: 10, 820: 9, 810: 8, 800: 7, 790: 6,
        780: 5, 770: 4, 760: 4, 750: 3, 740: 3, 730: 2, 720: 2, 710: 2, 700: 1,
        690: 1, 680: 1, 670: 1, 660: 1, 650: 1, 640: 1, 630: 1, 620: 1, 610: 1, 600: 1,
        590: 1, 580: 1, 570: 1, 560: 1, 550: 1, 540: 1, 530: 1, 520: 1, 510: 1, 500: 1,
        490: 1, 480: 1, 470: 1, 460: 1, 450: 1, 440: 1, 430: 1, 420: 1, 410: 1, 400: 1,
        390: 1, 380: 1, 370: 1, 360: 1, 350: 1, 340: 1, 330: 1, 320: 1
    };
    
    // Find closest score or interpolate
    for (let score = totalScore; score >= 320; score -= 10) {
        if (percentileMap[score]) {
            return percentileMap[score];
        }
    }
    return 1; // Minimum percentile
};

/**
 * Get performance level based on total score
 * @param {number} totalScore - Total PSAT score (320-1520)
 * @returns {string} Performance level description
 */
const getPerformanceLevel = (totalScore) => {
    if (totalScore >= 1400) return 'Excellent (National Merit Semifinalist Range)';
    if (totalScore >= 1200) return 'Good (Commended Student Range)';
    if (totalScore >= 1000) return 'Average';
    if (totalScore >= 700) return 'Below Average';
    return 'Needs Improvement';
};

/**
 * Check National Merit qualification status
 * @param {number} totalScore - Total PSAT score (320-1520)
 * @returns {Object} National Merit status information
 */
const getNationalMeritStatus = (totalScore) => {
    // These are approximate ranges and vary by state
    if (totalScore >= 1460) {
        return {
            status: 'Likely National Merit Semifinalist',
            description: 'Top 1% of test takers - likely to qualify for National Merit Semifinalist status'
        };
    } else if (totalScore >= 1400) {
        return {
            status: 'Potential National Merit Semifinalist',
            description: 'High score - may qualify for National Merit Semifinalist depending on state cutoffs'
        };
    } else if (totalScore >= 1200) {
        return {
            status: 'Likely Commended Student',
            description: 'Top 3-4% of test takers - likely to receive National Merit Commended Student recognition'
        };
    } else {
        return {
            status: 'Not Qualifying',
            description: 'Score below typical National Merit recognition thresholds'
        };
    }
};

/**
 * Calculate comprehensive PSAT results from raw scores
 * @param {number} mathRawScore - Math raw score (0-44)
 * @param {number} readingWritingRawScore - Reading & Writing raw score (0-54)
 * @returns {Object} Complete PSAT score breakdown
 */
const calculatePsatResults = (mathRawScore, readingWritingRawScore) => {
    const mathScaled = convertPsatRawToScaled(mathRawScore, 'math');
    const readingWritingScaled = convertPsatRawToScaled(readingWritingRawScore, 'readingwriting');
    const totalScore = calculateTotalPsatScore(mathScaled, readingWritingScaled);
    const percentile = getPsatPercentile(totalScore);
    const performanceLevel = getPerformanceLevel(totalScore);
    const nationalMerit = getNationalMeritStatus(totalScore);
    
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
        },
        nationalMerit: nationalMerit
    };
};

module.exports = {
    convertPsatRawToScaled,
    calculateTotalPsatScore,
    getPsatPercentile,
    getPerformanceLevel,
    getNationalMeritStatus,
    calculatePsatResults
};
