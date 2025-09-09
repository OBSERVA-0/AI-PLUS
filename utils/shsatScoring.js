// SHSAT Scoring Table - Based on official NYC DOE methodology
// Each section (ELA and Math) is scored separately out of ~350 points
// Total maximum score is ~700 (350 + 350)
// Raw scores are based on 57 questions per section, but only 47 count (10 are field questions)

// Per-section scoring table (0-57 raw score -> scaled score per section)
// Based on official prep materials and established conversion patterns
const shsatSectionScoringTable = {
    0: 0, 1: 16, 2: 26, 3: 37, 4: 51, 5: 65, 6: 74, 7: 83, 8: 90, 9: 98,
    10: 105, 11: 130, 12: 134, 13: 141, 14: 146, 15: 152, 16: 158, 17: 163, 18: 168, 19: 172,
    20: 177, 21: 181, 22: 186, 23: 190, 24: 194, 25: 201, 26: 204, 27: 208, 28: 211, 29: 215,
    30: 218, 31: 222, 32: 226, 33: 229, 34: 233, 35: 236, 36: 240, 37: 243, 38: 247, 39: 250,
    40: 254, 41: 257, 42: 261, 43: 266, 44: 266, 45: 270, 46: 274, 47: 279, 48: 285, 49: 291,
    50: 297, 51: 306, 52: 315, 53: 323, 54: 333, 55: 344, 56: 355, 57: 365
};

/**
 * Convert raw score to scaled score for a single SHSAT section
 * @param {number} rawScore - Raw score (0-57)
 * @returns {number} Scaled score for the section (0-365)
 */
const convertRawToScaledSection = (rawScore) => {
    if (rawScore < 0) return 0;
    if (rawScore > 57) return 365;
    return shsatSectionScoringTable[rawScore] || 0;
};

/**
 * Calculate SHSAT scores for both sections or single section
 * @param {number} mathRawScore - Raw math score (0-57)
 * @param {number} elaRawScore - Raw ELA score (0-57)
 * @param {string} sectionType - Optional section type ('ela', 'math', or null for full test)
 * @returns {Object} Object containing section scores and total
 */
const calculateShsatScores = (mathRawScore, elaRawScore, sectionType = null) => {
    const mathScaledScore = convertRawToScaledSection(mathRawScore);
    const elaScaledScore = convertRawToScaledSection(elaRawScore);
    
    // For section-specific tests, only calculate the relevant section
    if (sectionType === 'ela') {
        return {
            english: {
                rawScore: elaRawScore,
                scaledScore: elaScaledScore
            },
            totalRawScore: elaRawScore,
            totalScaledScore: elaScaledScore,
            sectionType: 'ela'
        };
    }
    
    if (sectionType === 'math') {
        return {
            math: {
                rawScore: mathRawScore,
                scaledScore: mathScaledScore
            },
            totalRawScore: mathRawScore,
            totalScaledScore: mathScaledScore,
            sectionType: 'math'
        };
    }
    
    // Full test - both sections
    const totalScaledScore = mathScaledScore + elaScaledScore;
    
    return {
        math: {
            rawScore: mathRawScore,
            scaledScore: mathScaledScore
        },
        english: {
            rawScore: elaRawScore,
            scaledScore: elaScaledScore
        },
        totalRawScore: mathRawScore + elaRawScore,
        totalScaledScore: totalScaledScore,
        sectionType: 'full'
    };
};

/**
 * Legacy function for backward compatibility
 * Converts total raw score (0-114) to total scaled score
 * This assumes equal performance on both sections
 * @param {number} totalRawScore - Total raw score (0-114)
 * @returns {number} Total scaled score
 */
const convertRawToScaled = (totalRawScore) => {
    if (totalRawScore < 0) return 0;
    if (totalRawScore > 114) return 730;
    
    // Split the raw score evenly between sections for legacy compatibility
    const mathRaw = Math.floor(totalRawScore / 2);
    const elaRaw = Math.ceil(totalRawScore / 2);
    
    const mathScaled = convertRawToScaledSection(mathRaw);
    const elaScaled = convertRawToScaledSection(elaRaw);
    
    return mathScaled + elaScaled;
};

module.exports = {
    convertRawToScaled,
    convertRawToScaledSection,
    calculateShsatScores
};