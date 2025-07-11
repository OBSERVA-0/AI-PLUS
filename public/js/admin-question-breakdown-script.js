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

    static async getQuestionBreakdown(testType, practiceSet) {
        return this.makeRequest(`/admin/question-analytics/${testType}/${practiceSet}`);
    }
}

class AdminQuestionBreakdownManager {
    constructor() {
        this.testType = null;
        this.practiceSet = null;
        this.testInfo = null;
        this.questions = [];
        this.filteredQuestions = [];
        this.currentView = 'list';
        this.currentFilters = {
            category: 'all',
            sort: 'number',
            difficulty: 'all'
        };
        this.init();
    }

    async init() {
        try {
            // Check authentication and admin role
            if (!this.checkAuth()) return;

            // Get URL parameters
            const urlParams = this.getUrlParameters();
            if (!urlParams.testType || !urlParams.practiceSet) {
                this.showError('Missing test information in URL');
                return;
            }

            this.testType = urlParams.testType;
            this.practiceSet = urlParams.practiceSet;

            // Load breakdown data
            await this.loadBreakdown();
            this.setupEventListeners();
            this.renderQuestions();
        } catch (error) {
            console.error('❌ Failed to initialize question breakdown:', error);
            this.showError(error.message || 'Failed to load breakdown data');
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

    getUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            testType: urlParams.get('testType'),
            practiceSet: decodeURIComponent(urlParams.get('practiceSet') || '')
        };
    }

    async loadBreakdown() {
        try {
            const response = await AdminService.getQuestionBreakdown(this.testType, this.practiceSet);
            if (response.success) {
                this.testInfo = response.data.testInfo;
                this.questions = response.data.questions;
                this.studentAttempts = response.data.studentAttempts;
                this.statistics = response.data.statistics;
                
                this.filteredQuestions = [...this.questions];
                this.displayTestInfo();
                this.populateFilters();
                this.hideLoading();
            } else {
                throw new Error(response.message || 'Failed to load breakdown');
            }
        } catch (error) {
            console.error('❌ Failed to load breakdown:', error);
            this.hideLoading();
            throw error;
        }
    }

    displayTestInfo() {
        const testTypeLabel = this.getTestTypeLabel(this.testInfo.testType);
        const practiceSetLabel = this.getPracticeSetLabel(this.testInfo.practiceSet);
        const badgeClass = `test-type-${this.testInfo.testType}`;
        
        document.getElementById('test-name').textContent = this.testInfo.testName;
        document.getElementById('test-subtitle').textContent = `${testTypeLabel} • ${practiceSetLabel}`;
        
        const badge = document.getElementById('test-type-badge');
        badge.textContent = testTypeLabel;
        badge.className = `test-type-badge ${badgeClass}`;
        
        // Update statistics
        document.getElementById('total-attempts').textContent = this.testInfo.totalAttempts;
        document.getElementById('total-questions').textContent = this.testInfo.totalQuestions;
        document.getElementById('average-accuracy').textContent = `${this.testInfo.averageAccuracy}%`;
        document.getElementById('average-score').textContent = `${this.statistics.averageScore}%`;
        document.getElementById('highest-score').textContent = `${this.statistics.highestScore}%`;
        document.getElementById('lowest-score').textContent = `${this.statistics.lowestScore}%`;
        
        document.getElementById('test-info-card').style.display = 'block';
    }

    populateFilters() {
        const categoryFilter = document.getElementById('category-filter');
        
        // Get unique categories
        const categories = [...new Set(this.questions.map(q => q.category))];
        
        // Clear existing options (except "All")
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        
        // Add category options
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        document.getElementById('controls').style.display = 'block';
    }

    setupEventListeners() {
        // Filter event listeners
        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.currentFilters.category = e.target.value;
            this.applyFilters();
            this.renderQuestions();
        });

        document.getElementById('sort-questions').addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.applySorting();
            this.renderQuestions();
        });

        document.getElementById('difficulty-filter').addEventListener('change', (e) => {
            this.currentFilters.difficulty = e.target.value;
            this.applyFilters();
            this.renderQuestions();
        });

        // View toggle
        document.getElementById('list-view-btn').addEventListener('click', () => {
            this.setView('list');
        });

        document.getElementById('grid-view-btn').addEventListener('click', () => {
            this.setView('grid');
        });

        // Logout functionality
        document.getElementById('logout-btn').addEventListener('click', this.handleLogout);
    }

    applyFilters() {
        this.filteredQuestions = this.questions.filter(question => {
            // Category filter
            if (this.currentFilters.category !== 'all' && question.category !== this.currentFilters.category) {
                return false;
            }
            
            // Difficulty filter
            if (this.currentFilters.difficulty !== 'all') {
                const percentage = question.percentage;
                if (this.currentFilters.difficulty === 'easy' && percentage < 80) return false;
                if (this.currentFilters.difficulty === 'medium' && (percentage < 50 || percentage >= 80)) return false;
                if (this.currentFilters.difficulty === 'hard' && percentage >= 50) return false;
            }
            
            return true;
        });
        
        this.applySorting();
        this.updateSummaryText();
    }

    applySorting() {
        this.filteredQuestions.sort((a, b) => {
            switch (this.currentFilters.sort) {
                case 'number':
                    return a.questionNumber - b.questionNumber;
                case 'accuracy-low':
                    return a.percentage - b.percentage;
                case 'accuracy-high':
                    return b.percentage - a.percentage;
                case 'attempts':
                    return b.totalAttempts - a.totalAttempts;
                default:
                    return a.questionNumber - b.questionNumber;
            }
        });
    }

    updateSummaryText() {
        const total = this.questions.length;
        const filtered = this.filteredQuestions.length;
        
        let text = '';
        if (filtered === total) {
            text = `Showing all ${total} questions`;
        } else {
            text = `Showing ${filtered} of ${total} questions`;
        }
        
        document.getElementById('questions-summary').textContent = text;
    }

    setView(view) {
        this.currentView = view;
        
        // Update button states
        document.getElementById('list-view-btn').classList.toggle('active', view === 'list');
        document.getElementById('grid-view-btn').classList.toggle('active', view === 'grid');
        
        // Show/hide appropriate view
        document.getElementById('questions-list').style.display = view === 'list' ? 'flex' : 'none';
        document.getElementById('questions-grid').style.display = view === 'grid' ? 'grid' : 'none';
        
        this.renderQuestions();
    }

    renderQuestions() {
        document.getElementById('questions-section').style.display = 'block';
        
        if (this.currentView === 'list') {
            this.renderListView();
        } else {
            this.renderGridView();
        }
        
        this.updateSummaryText();
    }

    renderListView() {
        const questionsList = document.getElementById('questions-list');
        
        if (this.filteredQuestions.length === 0) {
            questionsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>No questions match your filters</h3>
                    <p>Try adjusting your filter settings.</p>
                </div>
            `;
            return;
        }
        
        questionsList.innerHTML = this.filteredQuestions.map(question => this.createQuestionListItem(question)).join('');
    }

    renderGridView() {
        const questionsGrid = document.getElementById('questions-grid');
        
        if (this.filteredQuestions.length === 0) {
            questionsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <h3>No questions match your filters</h3>
                    <p>Try adjusting your filter settings.</p>
                </div>
            `;
            return;
        }
        
        questionsGrid.innerHTML = this.filteredQuestions.map(question => this.createQuestionGridItem(question)).join('');
    }

    createQuestionListItem(question) {
        const percentageClass = this.getPercentageClass(question.percentage);
        const difficultyIcon = this.getDifficultyIcon(question.percentage);
        
        return `
            <div class="question-item">
                <div class="question-info">
                    <div class="question-number">${question.questionNumber}</div>
                    <div class="question-category">${question.category}</div>
                    ${difficultyIcon}
                </div>
                <div class="question-stats">
                    <div class="question-percentage ${percentageClass}">
                        ${question.percentage}%
                    </div>
                    <div class="question-breakdown-stats">
                        ${question.correctAnswers}/${question.totalAttempts} correct
                        <br>
                        ${question.skippedAnswers} skipped
                    </div>
                </div>
            </div>
        `;
    }

    createQuestionGridItem(question) {
        const percentageClass = this.getPercentageClass(question.percentage);
        const categoryClass = this.getCategoryClass(question.category);
        
        return `
            <div class="question-grid-item" title="Question ${question.questionNumber}: ${question.percentage}% correct (${question.correctAnswers}/${question.totalAttempts})">
                <div class="grid-question-category ${categoryClass}"></div>
                <div class="grid-question-number">${question.questionNumber}</div>
                <div class="grid-question-percentage ${percentageClass}">${question.percentage}%</div>
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

    getPracticeSetLabel(practiceSet) {
        if (practiceSet === 'Diagnostic_Test') {
            return 'Diagnostic';
        }
        if (!isNaN(practiceSet)) {
            return `Practice ${practiceSet}`;
        }
        return practiceSet;
    }

    getPercentageClass(percentage) {
        if (percentage >= 80) return 'percentage-excellent';
        if (percentage >= 60) return 'percentage-good';
        if (percentage >= 40) return 'percentage-average';
        return 'percentage-poor';
    }

    getDifficultyIcon(percentage) {
        let difficultyClass, difficultyText;
        
        if (percentage >= 80) {
            difficultyClass = 'difficulty-easy';
            difficultyText = 'E';
        } else if (percentage >= 50) {
            difficultyClass = 'difficulty-medium';
            difficultyText = 'M';
        } else {
            difficultyClass = 'difficulty-hard';
            difficultyText = 'H';
        }
        
        return `<div class="difficulty-indicator ${difficultyClass}" title="Difficulty: ${difficultyText === 'E' ? 'Easy' : difficultyText === 'M' ? 'Medium' : 'Hard'}">${difficultyText}</div>`;
    }

    getCategoryClass(category) {
        const categoryLower = category.toLowerCase();
        if (categoryLower.includes('math')) {
            return 'category-math';
        } else if (categoryLower.includes('english') || categoryLower.includes('ela') || categoryLower.includes('reading') || categoryLower.includes('writing')) {
            return 'category-english';
        }
        return 'category-math'; // default
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
    new AdminQuestionBreakdownManager();
}); 