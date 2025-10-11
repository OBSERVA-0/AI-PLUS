import { API_BASE_URL } from './config.js';

// Admin service for API calls
class AdminService {
    static async makeRequest(url, options = {}) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                },
                ...options
            });

            let data;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    data = { message: text };
                }
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                throw new Error('Invalid response from server');
            }
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                }
                if (response.status === 401) {
                    throw new Error('Authentication required');
                }
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            if (error instanceof TypeError) {
                throw new Error('Network error. Please check your connection.');
            }
            throw error;
        }
    }

    static async getUserTestHistory(userId) {
        return this.makeRequest(`/admin/user/${userId}/test-history`);
    }

    static async getStudent(userId) {
        return this.makeRequest(`/admin/student/${userId}`);
    }

    static async deleteTestHistory(userId, testId) {
        return this.makeRequest(`/admin/user/${userId}/test-history/${testId}`, {
            method: 'DELETE'
        });
    }
}

class AdminTestHistoryManager {
    constructor() {
        this.studentId = null;
        this.student = null;
        this.testHistory = [];
        this.filteredHistory = [];
        this.currentFilter = 'all';
        this.currentSort = 'recent';
        this.init();
    }

    async init() {
        try {
            // Check authentication and admin role
            if (!this.checkAuth()) return;

            // Get student ID from URL parameters
            this.studentId = this.getStudentIdFromUrl();
            if (!this.studentId) {
                this.showError('No student ID provided');
                return;
            }

            // Load student data and test history
            await this.loadStudentData();
            await this.loadTestHistory();
            this.setupEventListeners();
            this.renderHistory();
        } catch (error) {
            console.error('❌ Failed to initialize admin test history:', error);
            this.showError(error.message || 'Failed to load test history data');
        }
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            window.location.href = 'login.html';
            return false;
        }
        
        try {
            const userData = JSON.parse(user);
            if (userData.role !== 'admin') {
                alert('Access denied. Admin privileges required.');
                window.location.href = 'dashboard.html';
                return false;
            }
            
            // Update user name in header
            document.getElementById('user-name').textContent = userData.firstName || 'Admin';
            return true;
        } catch (error) {
            console.error('Error parsing user data:', error);
            window.location.href = 'login.html';
            return false;
        }
    }

    getStudentIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('studentId');
    }

    async loadStudentData() {
        try {
            const response = await AdminService.getStudent(this.studentId);
            if (response.success) {
                this.student = response.data.student;
                this.displayStudentInfo();
            } else {
                throw new Error(response.message || 'Failed to load student data');
            }
        } catch (error) {
            console.error('❌ Failed to load student data:', error);
            throw error;
        }
    }

    displayStudentInfo() {
        if (!this.student) return;

        document.getElementById('student-name').textContent = this.student.name;
        document.getElementById('student-email').textContent = this.student.email;
        document.getElementById('student-grade').textContent = `Grade ${this.student.grade}`;
        document.getElementById('student-join-date').textContent = this.formatDate(this.student.joinDate);
        document.getElementById('student-last-login').textContent = this.formatDate(this.student.lastLogin);
        
        document.getElementById('student-info-card').style.display = 'block';
    }

    async loadTestHistory() {
        try {
            const response = await AdminService.getUserTestHistory(this.studentId);
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
            throw error;
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
    }

    async deleteTest(testId, testName) {
        if (!confirm(`Are you sure you want to delete "${testName}" from this student's test history?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const response = await AdminService.deleteTestHistory(this.studentId, testId);
            
            if (response.success) {
                // Show success message
                alert(`Test "${testName}" has been successfully deleted from the student's history.`);
                
                // Remove the test from local data
                this.testHistory = this.testHistory.filter(test => test._id !== testId);
                this.filteredHistory = this.filteredHistory.filter(test => test._id !== testId);
                
                // Update stats and re-render
                this.updateStats();
                this.renderHistory();
            } else {
                throw new Error(response.message || 'Failed to delete test');
            }
        } catch (error) {
            console.error('❌ Failed to delete test:', error);
            alert(`Failed to delete test: ${error.message}`);
        }
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

        this.testHistory.forEach(test => {
            totalScore += test.results.percentage;
            bestScore = Math.max(bestScore, test.results.percentage);
        });

        const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

        // Update stats display
        document.getElementById('total-attempts').textContent = totalAttempts;
        document.getElementById('average-score').textContent = `${averageScore}%`;
        document.getElementById('best-score').textContent = `${bestScore}%`;
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
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 14px; color: #666;">
                            ${test.results.correctCount}/${test.results.totalQuestions} correct
                        </span>
                        <button 
                            class="delete-test-btn" 
                            onclick="window.adminTestHistoryManager.deleteTest('${test._id}', '${test.testName.replace(/'/g, "\\'")}')"
                            title="Delete this test from student's history"
                            style="
                                background: #fee2e2; 
                                color: #dc2626; 
                                border: 1px solid #fecaca; 
                                padding: 4px 8px; 
                                border-radius: 4px; 
                                font-size: 12px; 
                                cursor: pointer; 
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.background='#fecaca'; this.style.borderColor='#f87171';"
                            onmouseout="this.style.background='#fee2e2'; this.style.borderColor='#fecaca';"
                        >
                            🗑️ Delete
                        </button>
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
                        <br><small>Newer tests will show detailed question analysis.</small>
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
                        ${englishQuestions.map((q) => this.generateQuestionNumber(q.questionNumber, q)).join('')}
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
                        ${mathQuestions.map((q) => this.generateQuestionNumber(q.questionNumber, q)).join('')}
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

    generateQuestionNumber(displayNumber, questionResult) {
        let className = 'question-number ';
        
        if (!questionResult.hasAnswer) {
            className += 'question-skipped';
        } else if (questionResult.isCorrect) {
            className += 'question-correct';
        } else {
            className += 'question-incorrect';
        }

        return `<div class="${className}" title="Question ${displayNumber}: ${questionResult.isCorrect ? 'Correct' : questionResult.hasAnswer ? 'Incorrect' : 'Skipped'}">${displayNumber}</div>`;
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

    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    hideLoading() {
        document.getElementById('loading-state').style.display = 'none';
    }

    showError(message) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('error-state').style.display = 'block';
        document.getElementById('error-message').textContent = message;
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminTestHistoryManager = new AdminTestHistoryManager();
}); 