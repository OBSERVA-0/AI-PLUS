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

    static async getQuestionAnalytics() {
        return this.makeRequest('/admin/question-analytics');
    }
}

class AdminQuestionAnalyticsManager {
    constructor() {
        this.allAnalytics = [];
        this.filteredAnalytics = [];
        this.currentFilters = {
            testType: 'all',
            sort: 'testName',
            minAttempts: 0
        };
        this.init();
    }

    async init() {
        try {
            // Check authentication and admin role
            if (!this.checkAuth()) return;

            // Load analytics data
            await this.loadAnalytics();
            this.setupEventListeners();
            this.renderAnalytics();
        } catch (error) {
            console.error('❌ Failed to initialize question analytics:', error);
            this.showError(error.message || 'Failed to load analytics data');
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

    async loadAnalytics() {
        try {
            const response = await AdminService.getQuestionAnalytics();
            if (response.success) {
                this.allAnalytics = response.data.testAnalytics;
                this.filteredAnalytics = [...this.allAnalytics];
                this.updateSummaryStats(response.data.summary);
                this.populateFilters();
                this.hideLoading();
            } else {
                throw new Error(response.message || 'Failed to load analytics');
            }
        } catch (error) {
            console.error('❌ Failed to load analytics:', error);
            this.hideLoading();
            throw error;
        }
    }

    updateSummaryStats(summary) {
        document.getElementById('total-tests').textContent = summary.totalTests;
        document.getElementById('total-students').textContent = summary.totalStudents;
        document.getElementById('test-types-count').textContent = summary.testTypes.length;
        
        const updatedTime = new Date(summary.generatedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('last-updated').textContent = updatedTime;
        
        document.getElementById('summary-stats').style.display = 'grid';
        
        // Log comprehensive stats for debugging
        console.log('📊 Analytics Summary:', {
            totalTests: summary.totalTests,
            totalStudents: summary.totalStudents,
            totalQuestions: summary.totalQuestions || 'N/A',
            totalAttempts: summary.totalAttempts || 'N/A',
            testTypes: summary.testTypes
        });
    }

    populateFilters() {
        const testTypeFilter = document.getElementById('test-type-filter');
        
        // Get unique test types
        const testTypes = [...new Set(this.allAnalytics.map(test => test.testType))];
        
        // Clear existing options (except "All")
        testTypeFilter.innerHTML = '<option value="all">All Test Types</option>';
        
        // Add test type options
        testTypes.forEach(testType => {
            const option = document.createElement('option');
            option.value = testType;
            option.textContent = this.getTestTypeLabel(testType);
            testTypeFilter.appendChild(option);
        });
        
        document.getElementById('filters').style.display = 'block';
    }

    setupEventListeners() {
        // Filter event listeners
        document.getElementById('test-type-filter').addEventListener('change', (e) => {
            this.currentFilters.testType = e.target.value;
            this.applyFilters();
            this.renderAnalytics();
        });

        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.applySorting();
            this.renderAnalytics();
        });

        document.getElementById('min-attempts-filter').addEventListener('change', (e) => {
            this.currentFilters.minAttempts = parseInt(e.target.value);
            this.applyFilters();
            this.renderAnalytics();
        });

        // Logout functionality
        document.getElementById('logout-btn').addEventListener('click', this.handleLogout);
    }

    applyFilters() {
        this.filteredAnalytics = this.allAnalytics.filter(test => {
            // Test type filter
            if (this.currentFilters.testType !== 'all' && test.testType !== this.currentFilters.testType) {
                return false;
            }
            
            // Minimum attempts filter
            if (test.totalAttempts < this.currentFilters.minAttempts) {
                return false;
            }
            
            return true;
        });
        
        this.applySorting();
    }

    applySorting() {
        this.filteredAnalytics.sort((a, b) => {
            switch (this.currentFilters.sort) {
                case 'testName':
                    return a.testName.localeCompare(b.testName);
                case 'accuracy-low':
                    return a.averageAccuracy - b.averageAccuracy;
                case 'accuracy-high':
                    return b.averageAccuracy - a.averageAccuracy;
                case 'attempts-high':
                    return b.totalAttempts - a.totalAttempts;
                case 'attempts-low':
                    return a.totalAttempts - b.totalAttempts;
                default:
                    return a.testName.localeCompare(b.testName);
            }
        });
    }

    renderAnalytics() {
        const analyticsGrid = document.getElementById('analytics-grid');
        const emptyState = document.getElementById('empty-state');

        if (this.filteredAnalytics.length === 0) {
            analyticsGrid.style.display = 'none';
            emptyState.style.display = 'block';
            
            if (this.allAnalytics.length === 0) {
                emptyState.innerHTML = `
                    <div class="empty-icon">📊</div>
                    <h3>No Test Data Available</h3>
                    <p>No students have taken tests yet, so there's no question analytics to display.</p>
                    <p>Once students start taking tests, their performance data will appear here.</p>
                `;
            } else {
                emptyState.innerHTML = `
                    <div class="empty-icon">🔍</div>
                    <h3>No Tests Match Your Filters</h3>
                    <p>Try adjusting your filters to see more test analytics.</p>
                `;
            }
            return;
        }

        emptyState.style.display = 'none';
        analyticsGrid.style.display = 'grid';
        
        analyticsGrid.innerHTML = this.filteredAnalytics.map(test => this.createTestCard(test)).join('');
    }

    createTestCard(test) {
        const testTypeBadgeClass = `test-type-${test.testType}`;
        const testTypeLabel = this.getTestTypeLabel(test.testType);
        const practiceSetLabel = this.getPracticeSetLabel(test.practiceSet);
        
        // Generate category stats if available
        let categoryStatsHtml = '';
        if (test.categoryStats && Object.keys(test.categoryStats).length > 0) {
            const categoryEntries = Object.entries(test.categoryStats)
                .sort(([a], [b]) => a.localeCompare(b));
            
            categoryStatsHtml = `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                    <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px;">Category Performance</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
                        ${categoryEntries.map(([category, stats]) => `
                            <div style="text-align: center; padding: 6px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e9ecef;">
                                <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">${category}</div>
                                <div style="font-size: 14px; font-weight: 600; color: #333;">${stats.avgAccuracy}%</div>
                                <div style="font-size: 10px; color: #888;">${stats.count} questions</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        const hardestQuestionHtml = test.hardestQuestion ? `
            <div class="difficulty-row hardest">
                <div>
                    <div class="difficulty-label">Hardest Question</div>
                    <div class="difficulty-question">Q${test.hardestQuestion.number} (${this.shortenCategory(test.hardestQuestion.category)})</div>
                </div>
                <div class="difficulty-percentage">${test.hardestQuestion.percentage}%</div>
            </div>
        ` : '<div class="difficulty-row"><div class="difficulty-label">No question data available</div></div>';
        
        const easiestQuestionHtml = test.easiestQuestion ? `
            <div class="difficulty-row easiest">
                <div>
                    <div class="difficulty-label">Easiest Question</div>
                    <div class="difficulty-question">Q${test.easiestQuestion.number} (${this.shortenCategory(test.easiestQuestion.category)})</div>
                </div>
                <div class="difficulty-percentage">${test.easiestQuestion.percentage}%</div>
            </div>
        ` : '';

        return `
            <div class="test-card" onclick="this.viewDetails('${test.testType}', '${test.practiceSet}')">
                <div class="test-card-header">
                    <div>
                        <div class="test-card-title">${test.testName}</div>
                        <div class="test-card-subtitle">${testTypeLabel} • ${practiceSetLabel}</div>
                    </div>
                    <div class="test-type-badge ${testTypeBadgeClass}">
                        ${testTypeLabel}
                    </div>
                </div>
                
                <div class="test-stats">
                    <div class="test-stat">
                        <div class="test-stat-value">${test.totalAttempts}</div>
                        <div class="test-stat-label">Student Attempts</div>
                    </div>
                    <div class="test-stat">
                        <div class="test-stat-value">${test.totalQuestions}</div>
                        <div class="test-stat-label">Total Questions</div>
                    </div>
                    <div class="test-stat">
                        <div class="test-stat-value">${test.averageAccuracy}%</div>
                        <div class="test-stat-label">Average Accuracy</div>
                    </div>
                    <div class="test-stat">
                        <div class="test-stat-value">${this.getAccuracyColor(test.averageAccuracy)}</div>
                        <div class="test-stat-label">Difficulty Level</div>
                    </div>
                </div>
                
                <div class="question-difficulty">
                    ${hardestQuestionHtml}
                    ${easiestQuestionHtml}
                </div>
                
                ${categoryStatsHtml}
                
                <button class="view-details-btn" onclick="event.stopPropagation(); window.location.href='admin-question-breakdown.html?testType=${test.testType}&practiceSet=${encodeURIComponent(test.practiceSet)}'">
                    View Question Breakdown
                </button>
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

    shortenCategory(category) {
        if (!category) return 'Unknown';
        
        // Handle different category formats
        const parts = category.split(':');
        if (parts.length > 1) {
            // For categories like "English: Words in Context" or "Math: Geometry"
            const mainCategory = parts[0];
            const subCategory = parts[parts.length - 1];
            
            // Return just the subcategory for brevity
            return subCategory.length > 15 ? subCategory.substring(0, 15) + '...' : subCategory;
        }
        
        // For simple categories, just return truncated version
        return category.length > 15 ? category.substring(0, 15) + '...' : category;
    }

    getAccuracyColor(percentage) {
        if (percentage >= 80) return '🟢 Easy';
        if (percentage >= 60) return '🟡 Medium';
        if (percentage >= 40) return '🟠 Hard';
        return '🔴 Very Hard';
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
    new AdminQuestionAnalyticsManager();
}); 