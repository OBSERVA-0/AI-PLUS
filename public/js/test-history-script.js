import { ApiService } from './config.js';

class TestHistoryManager {
    constructor() {
        this.testHistory = [];
        this.filteredHistory = [];
        this.currentFilter = 'all';
        this.currentSort = 'recent';
        this.init();
    }

    async init() {
        try {
            await this.loadUserData();
            await this.loadTestHistory();
            this.setupEventListeners();
            this.renderHistory();
        } catch (error) {
            console.error('❌ Failed to initialize test history:', error);
            this.showError('Failed to load test history data');
        }
    }

    async loadUserData() {
        try {
            const response = await ApiService.getProfile();
            if (response.success) {
                const user = response.data.user;
                document.getElementById('user-name').textContent = user.firstName;
            }
        } catch (error) {
            console.error('❌ Failed to load user data:', error);
        }
    }

    async loadTestHistory() {
        try {
            const response = await ApiService.getTestHistory();
            if (response.success) {
                this.testHistory = response.data.testHistory || [];
                this.filteredHistory = [...this.testHistory];
                this.updateStats();
                this.hideLoading();
            } else {
                throw new Error(response.message || 'Failed to load test history');
            }
        } catch (error) {
            console.error('❌ Failed to load test history:', error);
            this.hideLoading();
            this.showError('Failed to load test history');
        }
    }

    setupEventListeners() {
        // Filter by test type
        document.getElementById('test-type-filter').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.applyFilters();
            this.renderHistory();
        });

        // Sort options
        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.applySorting();
            this.renderHistory();
        });

        // Logout functionality
        document.getElementById('logout-btn').addEventListener('click', this.handleLogout);

        // Modal event listeners
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Close modal button
        const closeBtn = document.getElementById('close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeModal.bind(this));
        }

        // Close modal when clicking outside
        const modal = document.getElementById('question-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    async openQuestionModal(questionNumber, testType, practiceSet) {
        try {
            const modal = document.getElementById('question-modal');
            const modalTitle = document.getElementById('modal-question-title');
            const questionContent = document.getElementById('question-content');

            // Show modal with loading state
            modal.style.display = 'block';
            modalTitle.textContent = `Question ${questionNumber} Review`;
            questionContent.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading question...</p>
                </div>
            `;

            // Fetch question data
            const questionData = await this.fetchQuestionData(testType, practiceSet, questionNumber);
            
            if (questionData) {
                this.displayQuestionInModal(questionData);
            } else {
                questionContent.innerHTML = `
                    <div class="error-state">
                        <p>Sorry, this question could not be loaded.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ Error opening question modal:', error);
            const questionContent = document.getElementById('question-content');
            questionContent.innerHTML = `
                <div class="error-state">
                    <p>Error loading question. Please try again later.</p>
                </div>
            `;
        }
    }

    async fetchQuestionData(testType, practiceSet, questionNumber) {
        try {
            console.log(`🔍 Fetching question ${questionNumber} from ${testType} practice set ${practiceSet}`);
            
            // First get all questions for this test/practice set
            const response = await ApiService.getQuestions(testType, practiceSet);
            
            if (response.success && response.data.questions) {
                // Find the specific question by question number
                const question = response.data.questions.find(q => q.question_number === questionNumber);
                
                if (question) {
                    console.log('✅ Found question:', question);
                    return question;
                } else {
                    console.error(`❌ Question ${questionNumber} not found in response`);
                    return null;
                }
            } else {
                console.error('❌ Failed to fetch questions:', response.message);
                return null;
            }
        } catch (error) {
            console.error('❌ Error fetching question data:', error);
            return null;
        }
    }

    displayQuestionInModal(questionData) {
        const questionContent = document.getElementById('question-content');
        
        let optionsHtml = '';
        if (questionData.answer_type === 'fill_in_the_blank') {
            // No additional content needed for fill-in-the-blank
            optionsHtml = '';
        } else if (questionData.options && questionData.options.length > 0) {
            optionsHtml = `
                <ul class="options-list">
                    ${questionData.options.map((option, index) => {
                        const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
                        return `<li class="option-item">${optionLetter}. ${this.renderPassageContent(option)}</li>`;
                    }).join('')}
                </ul>
            `;
        }

        const passageHtml = questionData.passage ? `
            <div class="passage-content">
                <div class="passage-title">Reading Passage:</div>
                <div class="passage-text">${this.renderPassageContent(questionData.passage)}</div>
            </div>
        ` : '';

        questionContent.innerHTML = `
            <div class="question-display">
                <div class="question-header">
                    <div class="question-meta">
                        <span>Question ${questionData.question_number}</span>
                        <span>Category: ${questionData.category || 'General'}</span>
                        <span>Difficulty: ${questionData.difficulty || 'Medium'}</span>
                    </div>
                </div>
                
                ${passageHtml}
                
                <div class="question-text">
                    ${this.renderPassageContent(questionData.question_text)}
                </div>
                
                ${optionsHtml}
            </div>
        `;
    }

    closeModal() {
        const modal = document.getElementById('question-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }



    // Function to render passage content - supports both text and images
    renderPassageContent(passage) {
        if (!passage) return '';
        
        // Check if passage is an image path
        if (passage.startsWith('image:')) {
            const imagePath = passage.substring(6); // Remove 'image:' prefix
            return `<img src="${imagePath}" alt="Question diagram" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        }
        
        // Check if passage contains mixed content (text + image)
        if (passage.includes('[IMAGE:') && passage.includes(']')) {
            return passage.replace(/\[IMAGE:(.*?)\]/g, (match, imagePath) => {
                return `<img src="${imagePath.trim()}" alt="Question diagram" style="max-width: 100%; height: auto; margin: 1rem 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
            }).replace(/\n/g, '<br>');
        }
        
        // Default text rendering
        return passage.replace(/\n/g, '<br>');
    }

    applyFilters() {
        if (this.currentFilter === 'all') {
            this.filteredHistory = [...this.testHistory];
        } else {
            this.filteredHistory = this.testHistory.filter(test => test.testType === this.currentFilter);
        }
        this.applySorting();
    }

    applySorting() {
        this.filteredHistory.sort((a, b) => {
            switch (this.currentSort) {
                case 'recent':
                    return new Date(b.completedAt) - new Date(a.completedAt);
                case 'oldest':
                    return new Date(a.completedAt) - new Date(b.completedAt);
                case 'highest':
                    return b.results.percentage - a.results.percentage;
                case 'lowest':
                    return a.results.percentage - b.results.percentage;
                default:
                    return new Date(b.completedAt) - new Date(a.completedAt);
            }
        });
    }

    updateStats() {
        const totalAttempts = this.testHistory.length;
        
        let totalScore = 0;
        let bestScore = 0;
        let totalTime = 0;

        this.testHistory.forEach(test => {
            totalScore += test.results.percentage;
            bestScore = Math.max(bestScore, test.results.percentage);
            totalTime += test.results.timeSpent;
        });

        const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

        // Update stats display
        document.getElementById('total-attempts').textContent = totalAttempts;
        document.getElementById('average-score').textContent = `${averageScore}%`;
        document.getElementById('best-score').textContent = `${bestScore}%`;
        document.getElementById('total-time').textContent = this.formatTime(totalTime);
    }

        renderHistory() {
        const historyList = document.getElementById('history-list');
        const emptyState = document.getElementById('empty-state');
        
        if (this.filteredHistory.length === 0) {
            historyList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        historyList.style.display = 'flex';
        
        historyList.innerHTML = this.filteredHistory.map(test => this.createHistoryItem(test)).join('');

        // Add event listeners for question number clicks
        this.setupQuestionClickHandlers();
    }

    setupQuestionClickHandlers() {
        // Use event delegation to handle clicks on question numbers
        const historyList = document.getElementById('history-list');
        if (historyList) {
            // Remove existing listener to prevent duplicates
            historyList.removeEventListener('click', this.handleQuestionClick);
            
            // Add the event listener
            this.handleQuestionClick = (e) => {
                const questionElement = e.target.closest('.question-number.reviewable');
                if (questionElement) {
                    const questionNumber = parseInt(questionElement.dataset.questionNumber);
                    const testType = questionElement.dataset.testType;
                    const practiceSet = questionElement.dataset.practiceSet;
                    
                    console.log(`🔍 Opening modal for question ${questionNumber}`);
                    this.openQuestionModal(questionNumber, testType, practiceSet);
                }
            };
            
            historyList.addEventListener('click', this.handleQuestionClick);
        }
    }

    createHistoryItem(test) {
        const date = new Date(test.completedAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const testTypeLabel = this.getTestTypeLabel(test.testType);
        const performance = this.getPerformanceBadge(test.results.percentage);
        
        let scoresHtml = '';
        
        // Generate question breakdown if detailed results are available
        const questionBreakdownHtml = this.generateQuestionBreakdown(test);
        
        // Always show percentage and time
        scoresHtml += `
            <div class="score-item percentage-score">
                <div class="score-value">${test.results.percentage}%</div>
                <div class="score-label">Overall Score</div>
            </div>
            <div class="score-item time-score">
                <div class="score-value">${this.formatTime(test.results.timeSpent)}</div>
                <div class="score-label">Time Taken</div>
            </div>
        `;

        // Add scaled scores if available
        if (test.scaledScores && test.scaledScores.total) {
            // Calculate raw scores from detailed results using question numbers
            let mathRawScore = { correct: 0, total: 0 };
            let englishRawScore = { correct: 0, total: 0 };
            
            if (test.detailedResults && test.detailedResults.length > 0) {
                test.detailedResults.forEach(result => {
                    if (test.testType === 'shsat') {
                        // SHSAT: Questions 1-57 are ELA, 58-114 are Math
                        if (result.questionNumber <= 57) {
                            englishRawScore.total++;
                            if (result.isCorrect) {
                                englishRawScore.correct++;
                            }
                        } else if (result.questionNumber <= 114) {
                            mathRawScore.total++;
                            if (result.isCorrect) {
                                mathRawScore.correct++;
                            }
                        }
                    } else if (test.testType === 'sat') {
                        // SAT: Questions 1-54 are Reading & Writing, 55-98 are Math
                        if (result.questionNumber <= 54) {
                            englishRawScore.total++;
                            if (result.isCorrect) {
                                englishRawScore.correct++;
                            }
                        } else if (result.questionNumber <= 98) {
                            mathRawScore.total++;
                            if (result.isCorrect) {
                                mathRawScore.correct++;
                            }
                        }
                    }
                });
            } else if (test.results.categoryScores) {
                // Fallback to category scores if detailed results not available
                const categoryScores = test.results.categoryScores instanceof Map 
                    ? Object.fromEntries(test.results.categoryScores) 
                    : test.results.categoryScores;
                
                Object.entries(categoryScores).forEach(([category, scores]) => {
                    const categoryLower = category.toLowerCase();
                    if (categoryLower.includes('math')) {
                        mathRawScore.correct += scores.correct;
                        mathRawScore.total += scores.total;
                    } else if (categoryLower.includes('english') || categoryLower.includes('ela') || categoryLower.includes('reading') || categoryLower.includes('writing')) {
                        englishRawScore.correct += scores.correct;
                        englishRawScore.total += scores.total;
                    }
                });
            }
            
            if (test.testType === 'shsat') {
                scoresHtml += `
                    <div class="score-item shsat-score">
                        <div class="score-value">${test.scaledScores.math || 0}</div>
                        <div class="score-breakdown-raw">${mathRawScore.correct}/${mathRawScore.total}</div>
                        <div class="score-label">Math</div>
                    </div>
                    <div class="score-item shsat-score">
                        <div class="score-value">${test.scaledScores.english || 0}</div>
                        <div class="score-breakdown-raw">${englishRawScore.correct}/${englishRawScore.total}</div>
                        <div class="score-label">ELA</div>
                    </div>
                    <div class="score-item shsat-score">
                        <div class="score-value">${test.scaledScores.total}</div>
                        <div class="score-label">Total</div>
                    </div>
                `;
            } else if (test.testType === 'sat') {
                scoresHtml += `
                    <div class="score-item sat-score">
                        <div class="score-value">${test.scaledScores.math || 0}</div>
                        <div class="score-breakdown-raw">${mathRawScore.correct}/${mathRawScore.total}</div>
                        <div class="score-label">Math</div>
                    </div>
                    <div class="score-item sat-score">
                        <div class="score-value">${test.scaledScores.reading_writing || 0}</div>
                        <div class="score-breakdown-raw">${englishRawScore.correct}/${englishRawScore.total}</div>
                        <div class="score-label">R&W</div>
                    </div>
                    <div class="score-item sat-score">
                        <div class="score-value">${test.scaledScores.total}</div>
                        <div class="score-label">Total</div>
                    </div>
                `;
            }
        }

        return `
            <div class="history-item">
                <div class="history-item-header">
                    <div>
                        <div class="history-item-title">${test.testName}</div>
                        <div class="history-item-date">${formattedDate}</div>
                    </div>
                </div>
                
                <div class="history-scores">
                    ${scoresHtml}
                </div>
                
                <div class="history-item-footer">
                    <div class="performance-indicator">
                        <span>Performance:</span>
                        <span class="performance-badge ${performance.class}">${performance.text}</span>
                    </div>
                    <div>
                        <span style="font-size: 14px; color: #666;">
                            ${test.results.correctCount}/${test.results.totalQuestions} correct
                        </span>
                    </div>
                </div>
                
                ${questionBreakdownHtml}
            </div>
        `;
    }

    getTestTypeLabel(testType) {
        const labels = {
            'shsat': 'SHSAT',
            'sat': 'SAT',
            'state': 'State Test'
        };
        return labels[testType] || testType.toUpperCase();
    }

    getPerformanceBadge(percentage) {
        if (percentage >= 80) {
            return { class: 'badge-excellent', text: 'Excellent' };
        } else if (percentage >= 60) {
            return { class: 'badge-good', text: 'Good' };
        } else {
            return { class: 'badge-needs-improvement', text: 'Needs Improvement' };
        }
    }

    generateQuestionBreakdown(test) {
        console.log('🔍 Generating question breakdown for test:', test.testName);
        console.log('📋 Test detailedResults:', test.detailedResults);
        
        if (!test.detailedResults || test.detailedResults.length === 0) {
            console.log('❌ No detailed results found for test:', test.testName);
            // Return a message for older tests that don't have detailed results
            return `
                <div class="question-breakdown">
                    <div style="text-align: center; padding: 20px; color: #666; font-style: italic;">
                        Question-by-question breakdown not available for this test.
                        <br><small>Take a new test to see the detailed breakdown!</small>
                    </div>
                </div>
            `;
        }

        // Separate questions by subject using question numbers
        const mathQuestions = [];
        const englishQuestions = [];

        test.detailedResults.forEach(result => {
            if (test.testType === 'shsat') {
                // SHSAT: Questions 1-57 are ELA, 58-114 are Math
                if (result.questionNumber <= 57) {
                    englishQuestions.push(result);
                } else if (result.questionNumber <= 114) {
                    mathQuestions.push(result);
                }
            } else if (test.testType === 'sat') {
                // SAT: Questions 1-54 are Reading & Writing, 55-98 are Math
                if (result.questionNumber <= 54) {
                    englishQuestions.push(result);
                } else if (result.questionNumber <= 98) {
                    mathQuestions.push(result);
                }
            }
        });

        // Sort questions by question number
        mathQuestions.sort((a, b) => a.questionNumber - b.questionNumber);
        englishQuestions.sort((a, b) => a.questionNumber - b.questionNumber);

        let breakdownHtml = '<div class="question-breakdown">';

        // English/ELA section
        if (englishQuestions.length > 0) {
            const sectionTitle = test.testType === 'shsat' ? 'ELA (1-57)' : 'R&W (1-54)';
            breakdownHtml += `
                <div class="question-section">
                    <div class="question-section-title">${sectionTitle}</div>
                    <div class="question-grid">
                        ${englishQuestions.map((q) => this.generateQuestionNumber(q.questionNumber, q, test)).join('')}
                    </div>
                </div>
            `;
        }

        // Math section
        if (mathQuestions.length > 0) {
            const sectionTitle = test.testType === 'shsat' ? 'Math (58-114)' : 'Math (55-98)';
            breakdownHtml += `
                <div class="question-section">
                    <div class="question-section-title">${sectionTitle}</div>
                    <div class="question-grid">
                        ${mathQuestions.map((q) => this.generateQuestionNumber(q.questionNumber, q, test)).join('')}
                    </div>
                </div>
            `;
        }

        // Add legend
        breakdownHtml += `
            <div class="question-legend">
                <div class="legend-item">
                    <div class="legend-color question-correct"></div>
                    <span>Correct</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color question-incorrect"></div>
                    <span>Incorrect</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color question-skipped"></div>
                    <span>Skipped</span>
                </div>
            </div>
        `;

        breakdownHtml += '</div>';
        return breakdownHtml;
    }

    generateQuestionNumber(displayNumber, questionResult, testData) {
        let className = 'question-number ';
        
        if (!questionResult.hasAnswer) {
            className += 'question-skipped';
        } else if (questionResult.isCorrect) {
            className += 'question-correct reviewable';
        } else {
            className += 'question-incorrect reviewable';
        }

        const title = `Question ${displayNumber}: ${questionResult.isCorrect ? 'Correct' : questionResult.hasAnswer ? 'Incorrect' : 'Skipped'}`;
        const clickableText = questionResult.hasAnswer ? ' - Click to review' : '';
        
        const dataAttributes = questionResult.hasAnswer ? 
            `data-question-number="${questionResult.questionNumber}" data-test-type="${testData.testType}" data-practice-set="${testData.practiceSet}"` : '';

        return `<div class="${className}" title="${title}${clickableText}" ${dataAttributes}>${displayNumber}</div>`;
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    hideLoading() {
        document.getElementById('loading-state').style.display = 'none';
    }

    showError(message) {
        const emptyState = document.getElementById('empty-state');
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h3>Error Loading Test History</h3>
            <p>${message}</p>
            <button onclick="window.location.reload()" class="btn btn-primary">
                Try Again
            </button>
        `;
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TestHistoryManager();
}); 