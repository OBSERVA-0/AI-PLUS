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

    static async getDashboardStats() {
        return this.makeRequest('/admin/dashboard-stats');
    }

    static async deleteTestHistory(userId, testId) {
        return this.makeRequest(`/admin/user/${userId}/test-history/${testId}`, {
            method: 'DELETE'
        });
    }

    static async getStudents(page = 1, search = '', grade = 'all') {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        if (search) {
            params.append('search', search);
        }
        
        if (grade && grade !== 'all') {
            params.append('grade', grade);
        }
        
        return this.makeRequest(`/admin/students?${params}`);
    }

    static async getStudent(id) {
        return this.makeRequest(`/admin/student/${id}`);
    }

    static async getTestCode() {
        return this.makeRequest('/admin/test-code');
    }

    static async generateTestCode() {
        return this.makeRequest('/admin/generate-test-code', {
            method: 'POST'
        });
    }

    static async getUserTestHistory(userId) {
        return this.makeRequest(`/admin/user/${userId}/test-history`);
    }

    static async deleteUser(userId) {
        return this.makeRequest(`/admin/user/${userId}`, {
            method: 'DELETE'
        });
    }

    static async getStudentsByTestScore(testType, practiceSet, page = 1, scoreRange = null, sectionType = null) {
        const params = new URLSearchParams({
            testType,
            practiceSet,
            page: page.toString(),
            limit: '20'
        });
        
        if (scoreRange) {
            params.append('minScore', scoreRange.min);
            if (scoreRange.max) {
                params.append('maxScore', scoreRange.max);
            }
        }
        
        if (sectionType) {
            params.append('sectionType', sectionType);
        }
        
        return this.makeRequest(`/admin/students/test-scores?${params}`);
    }
}

// State management
const state = {
    currentPage: 1,
    totalPages: 1,
    searchQuery: '',
    gradeFilter: 'all',
    sortMode: 'regular', // 'regular' or 'test-score'
    selectedTestType: '',
    selectedPracticeSet: '',
    selectedScoreRange: null,
    students: [],
    loading: false,
    allStudents: [], // Store all students for search
    selectedStudent: null, // Currently selected student for test history
    searchTimeout: null,
    userToDelete: null, // Store user data for deletion confirmation
    testInfo: null // Store current test info when in test-score mode
};

// DOM elements
const elements = {
    totalStudents: document.getElementById('total-students'),
    activeStudents: document.getElementById('active-students'),
    newStudents: document.getElementById('new-students'),
    recentActivity: document.getElementById('recent-activity'),
    searchInput: document.getElementById('search-input'),
    gradeFilter: document.getElementById('grade-filter'),
    sortModeToggle: document.getElementById('sort-mode-toggle'),
    testTypeSelect: document.getElementById('test-type-select'),
    practiceSetSelect: document.getElementById('practice-set-select'),
    scoreRangeSelect: document.getElementById('score-range-select'),
    testScoreControls: document.getElementById('test-score-controls'),
    studentsLoading: document.getElementById('students-loading'),
    studentsError: document.getElementById('students-error'),
    studentsGrid: document.getElementById('students-grid'),
    studentsCount: document.getElementById('students-count'),
    pagination: document.getElementById('pagination'),
    userName: document.getElementById('user-name'),
    logoutBtn: document.getElementById('logout-btn'),
    generateCodeBtn: document.getElementById('generate-code-btn'),
    studentSearch: document.getElementById('student-search'),
    studentSearchResults: document.getElementById('student-search-results'),
    viewTestHistoryBtn: document.getElementById('view-test-history-btn'),
    deleteModal: document.getElementById('delete-modal'),
    deleteUserName: document.getElementById('delete-user-name'),
    deleteUserEmail: document.getElementById('delete-user-email'),
    cancelDelete: document.getElementById('cancel-delete'),
    confirmDelete: document.getElementById('confirm-delete')
};

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function getMasteryLevelText(level) {
    const levels = {
        0: 'No Data',
        1: 'Beginner',
        2: 'Developing',
        3: 'Proficient',
        4: 'Advanced',
        5: 'Expert'
    };
    return levels[level] || 'Unknown';
}

function getMasteryLevelClass(level) {
    return `mastery-level-${level}`;
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await AdminService.getDashboardStats();
        const stats = response.data;
        
        elements.totalStudents.textContent = stats.totalStudents;
        elements.activeStudents.textContent = stats.activeStudents;
        elements.newStudents.textContent = stats.studentsThisMonth;
        elements.recentActivity.textContent = stats.recentActivity;
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

// Create student card HTML
function createStudentCard(student) {
    const joinDate = formatDate(student.joinDate);
    const lastLogin = formatDate(student.lastLogin);
    
    const masteryItems = Object.entries(student.masteryLevels || {})
        .filter(([category, data]) => data.totalQuestions > 0)
        .map(([category, data]) => {
            const levelClass = getMasteryLevelClass(data.masteryLevel);
            const levelText = getMasteryLevelText(data.masteryLevel);
            return `
                <div class="mastery-item ${levelClass}" title="${category}: ${levelText} (${data.averageScore}%)">
                    ${category}: ${levelText}
                </div>
            `;
        }).join('');

    return `
        <div class="student-card" data-student-id="${student.id}">
            <div class="student-header">
                <div class="student-info">
                    <h3>${student.name}</h3>
                    <p>${student.email}</p>
                </div>
                <div class="student-badges">
                    <span class="grade-badge">Grade ${student.grade}</span>
                    <span class="student-badge ${student.isActive ? 'active' : 'inactive'}">
                        ${student.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            
            <div class="student-meta">
                <div class="meta-item">
                    <div class="meta-label">Tests</div>
                    <div class="meta-value">${student.testStats.totalTests}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Avg Score</div>
                    <div class="meta-value">${student.testStats.averageScore}%</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Best Score</div>
                    <div class="meta-value">${student.testStats.bestScore}%</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Study Time</div>
                    <div class="meta-value">${formatTime(student.testStats.timeSpent)}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Joined</div>
                    <div class="meta-value">${joinDate}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Last Login</div>
                    <div class="meta-value">${lastLogin}</div>
                </div>
            </div>
            
            ${masteryItems ? `
                <div class="mastery-levels">
                    <h4>Subject Mastery</h4>
                    <div class="mastery-grid">
                        ${masteryItems}
                    </div>
                </div>
            ` : ''}
            
            <div class="student-actions">
                <button class="btn-action btn-view" onclick="window.location.href='profile-view.html?userId=${student.id}'" title="View Profile">
                    👁️ View
                </button>
                <button class="btn-action btn-delete" data-student-id="${student.id}" data-student-name="${student.name}" title="Delete User">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `;
}

// Create test score student card HTML
function createTestScoreCard(student, rank) {
    const testDate = student.latestAttempt ? formatDate(student.latestAttempt.date) : 'N/A';
    const timeSpent = student.latestAttempt ? formatTime(Math.round(student.latestAttempt.timeSpent / 60)) : 'N/A';

    // Format scaled scores breakdown with raw scores
    let scaledScoreDisplay = '';
    if (student.bestScaledScore.math !== undefined && student.bestScaledScore.english !== undefined) {
        // SHSAT format
        const mathRaw = student.bestRawScores ? `<span class="raw-score">(${student.bestRawScores.math.correct}/57)</span>` : '';
        const englishRaw = student.bestRawScores ? `<span class="raw-score">(${student.bestRawScores.english.correct}/57)</span>` : '';
        
        scaledScoreDisplay = `
            <div class="meta-item">
                <div class="meta-label">Math</div>
                <div class="meta-value">${student.bestScaledScore.math} ${mathRaw}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">English</div>
                <div class="meta-value">${student.bestScaledScore.english} ${englishRaw}</div>
            </div>
        `;
    } else if (student.bestScaledScore.reading_writing !== undefined) {
        // SAT format
        const mathRaw = student.bestRawScores ? `<span class="raw-score">(${student.bestRawScores.math.correct}/44)</span>` : '';
        const rwRaw = student.bestRawScores ? `<span class="raw-score">(${student.bestRawScores.english.correct}/54)</span>` : '';
        
        scaledScoreDisplay = `
            <div class="meta-item">
                <div class="meta-label">Math</div>
                <div class="meta-value">${student.bestScaledScore.math} ${mathRaw}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">R&W</div>
                <div class="meta-value">${student.bestScaledScore.reading_writing} ${rwRaw}</div>
            </div>
        `;
    }

    // Rank badge color
    let rankClass = '';
    if (rank === 1) rankClass = 'rank-gold';
    else if (rank === 2) rankClass = 'rank-silver';
    else if (rank === 3) rankClass = 'rank-bronze';
    else if (rank <= 10) rankClass = 'rank-top10';

    return `
        <div class="student-card test-score-card" data-student-id="${student.id}">
            <div class="student-header">
                <div class="student-info">
                    <h3>
                        <span class="rank-badge ${rankClass}">#${rank}</span>
                        ${student.name}
                    </h3>
                    <p>${student.email}</p>
                </div>
                                 <div class="student-badges">
                     <span class="grade-badge">Grade ${student.grade}</span>
                     <span class="score-badge scaled" title="Total Scaled Score">${student.bestScaledTotal}</span>
                 </div>
            </div>
            
                         <div class="student-meta">
                 <div class="meta-item score-highlight">
                     <div class="meta-label">Best Score</div>
                     <div class="meta-value">${student.bestScaledTotal}</div>
                 </div>
                 <div class="meta-item">
                     <div class="meta-label">Percentage</div>
                     <div class="meta-value">${student.bestPercentage}%</div>
                 </div>
                <div class="meta-item">
                    <div class="meta-label">Attempts</div>
                    <div class="meta-value">${student.totalAttempts}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Latest</div>
                    <div class="meta-value">${testDate}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Time Spent</div>
                    <div class="meta-value">${timeSpent}</div>
                </div>
                ${scaledScoreDisplay}
                ${student.latestAttempt ? `
                    <div class="meta-item">
                        <div class="meta-label">Correct</div>
                        <div class="meta-value">${student.latestAttempt.correctCount}/${student.latestAttempt.totalQuestions}</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="student-actions">
                <button class="btn-action btn-view" onclick="window.location.href='profile-view.html?userId=${student.id}'" title="View Profile">
                    👁️ View
                </button>
                <button class="btn-action btn-delete" data-student-id="${student.id}" data-student-name="${student.name}" title="Delete User">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `;
}

// Create pagination HTML
function createPagination(current, total) {
    if (total <= 1) return '';
    
    let html = '';
    
    // Previous button
    html += `
        <button ${current <= 1 ? 'disabled' : ''} data-page="${current - 1}">
            Previous
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, current - 2);
    const endPage = Math.min(total, current + 2);
    
    if (startPage > 1) {
        html += `<button data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button class="${i === current ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }
    
    if (endPage < total) {
        if (endPage < total - 1) {
            html += `<span>...</span>`;
        }
        html += `<button data-page="${total}">${total}</button>`;
    }
    
    // Next button
    html += `
        <button ${current >= total ? 'disabled' : ''} data-page="${current + 1}">
            Next
        </button>
    `;
    
    return html;
}

// Load students
async function loadStudents(page = 1, search = '', grade = 'all') {
    if (state.loading) return;
    
    state.loading = true;
    state.currentPage = page;
    
    // Show loading state
    elements.studentsLoading.style.display = 'block';
    elements.studentsError.style.display = 'none';
    elements.studentsGrid.style.display = 'none';
    elements.pagination.style.display = 'none';
    
    try {
        let response;
        
        if (state.sortMode === 'test-score' && state.selectedTestType && state.selectedPracticeSet) {
            // Load students by test score
            response = await AdminService.getStudentsByTestScore(state.selectedTestType, state.selectedPracticeSet, page, state.selectedScoreRange, state.selectedSectionType);
            
            const { students, pagination, testInfo, summary } = response.data;
            
            state.students = students;
            state.totalPages = pagination.total;
            state.testInfo = testInfo;
            
            // Update students count with test info
            let countText = `${testInfo.testName}: ${summary.totalStudentsWhoTook} students`;
            if (summary.scoreRange) {
                const range = summary.scoreRange;
                countText += ` with scores ${range.min}-${range.max || '∞'}`;
            }
            countText += ` (Avg Score: ${summary.averageScaledScore})`;
            elements.studentsCount.textContent = countText;
            
            // Render test score cards
            if (students.length === 0) {
                elements.studentsGrid.innerHTML = `
                    <div class="loading">
                        No students have taken ${testInfo.testName} yet.
                    </div>
                `;
                // Disable export button if no data
                document.getElementById('export-excel-btn').disabled = true;
            } else {
                elements.studentsGrid.innerHTML = students.map((student, index) => 
                    createTestScoreCard(student, (page - 1) * 20 + index + 1)
                ).join('');
                // Enable export button when data is loaded
                document.getElementById('export-excel-btn').disabled = false;
            }
            
        } else {
            // Load regular students view
            state.searchQuery = search;
            state.gradeFilter = grade;
            
            response = await AdminService.getStudents(page, search, grade);
            const { students, pagination } = response.data;
            
            state.students = students;
            state.totalPages = pagination.total;
            
            // Update students count
            elements.studentsCount.textContent = `${pagination.count} of ${pagination.totalStudents} students`;
            
            // Render regular student cards
            if (students.length === 0) {
                let message = 'No students found';
                if (search && grade !== 'all') {
                    message += ` matching your search in grade ${grade}`;
                } else if (search) {
                    message += ' matching your search';
                } else if (grade !== 'all') {
                    message += ` in grade ${grade}`;
                }
                message += '.';
                
                elements.studentsGrid.innerHTML = `
                    <div class="loading">
                        ${message}
                    </div>
                `;
            } else {
                elements.studentsGrid.innerHTML = students.map(createStudentCard).join('');
            }
        }
        
        // Render pagination
        if (response.data.pagination.total > 1) {
            elements.pagination.innerHTML = createPagination(response.data.pagination.current, response.data.pagination.total);
            elements.pagination.style.display = 'flex';
        }
        
        // Show content
        elements.studentsLoading.style.display = 'none';
        elements.studentsGrid.style.display = 'grid';
        
    } catch (error) {
        console.error('Failed to load students:', error);
        
        // Show error state
        elements.studentsLoading.style.display = 'none';
        elements.studentsError.style.display = 'block';
        elements.studentsError.textContent = error.message || 'Failed to load students. Please try again.';
        
        if (error.message.includes('Authentication') || error.message.includes('Access denied')) {
            // Redirect to login if authentication fails
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
    } finally {
        state.loading = false;
    }
}

// Handle search with debouncing
let searchTimeout;
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchValue = elements.searchInput.value.trim();
        const gradeValue = elements.gradeFilter.value;
        loadStudents(1, searchValue, gradeValue);
    }, 300);
}

// Handle grade filter change
function handleGradeFilter() {
    const searchValue = elements.searchInput.value.trim();
    const gradeValue = elements.gradeFilter.value;
    loadStudents(1, searchValue, gradeValue);
}

// Handle pagination click
function handlePaginationClick(event) {
    if (event.target.tagName === 'BUTTON' && event.target.dataset.page) {
        const page = parseInt(event.target.dataset.page);
        if (state.sortMode === 'test-score') {
            loadStudents(page);
        } else {
            loadStudents(page, state.searchQuery, state.gradeFilter);
        }
    }
}

// Handle sort mode toggle
function handleSortModeChange() {
    const sortMode = elements.sortModeToggle.value;
    state.sortMode = sortMode;
    
    if (sortMode === 'test-score') {
        // Show test score controls, hide regular search/filter
        elements.testScoreControls.style.display = 'flex';
        document.getElementById('regular-search').style.display = 'none';
        document.getElementById('regular-grade').style.display = 'none';
        
        // Reset and populate test type options
        handleTestTypeChange();
    } else {
        // Show regular search/filter, hide test score controls
        elements.testScoreControls.style.display = 'none';
        document.getElementById('regular-search').style.display = 'block';
        document.getElementById('regular-grade').style.display = 'block';
        
        // Reset test score state
        state.selectedTestType = '';
        state.selectedPracticeSet = '';
        state.selectedScoreRange = null;
        
        // Disable export button in regular mode
        document.getElementById('export-excel-btn').disabled = true;
        
        // Load regular students view
        loadStudents(1, state.searchQuery, state.gradeFilter);
    }
}

// Handle test type change
function handleTestTypeChange() {
    const testType = elements.testTypeSelect.value;
    const practiceSetSelect = elements.practiceSetSelect;
    const sectionTypeGroup = document.getElementById('section-type-group');
    const sectionTypeSelect = document.getElementById('section-type-select');
    const loadButton = document.getElementById('load-test-scores');
    
    // Clear practice set options and reset score range
    practiceSetSelect.innerHTML = '<option value="">Select Practice Set</option>';
    practiceSetSelect.disabled = !testType;
    loadButton.disabled = true;
    
    // Show/hide section type selector based on test type
    if (testType === 'shsat') {
        sectionTypeGroup.style.display = 'block';
        sectionTypeSelect.disabled = false;
    } else {
        sectionTypeGroup.style.display = 'none';
        sectionTypeSelect.disabled = true;
        sectionTypeSelect.value = '';
    }
    
    // Reset score range filter
    if (elements.scoreRangeSelect) {
        elements.scoreRangeSelect.value = '';
        state.selectedScoreRange = null;
    }
    
    if (testType === 'shsat') {
        // Add SHSAT practice sets - clean practice set list without section info
        practiceSetSelect.innerHTML += `
            <option value="diagnostic">Diagnostic Test</option>
            <option value="1">Practice Test 1</option>
            <option value="2">Practice Test 2</option>
            <option value="3">Practice Test 3</option>
            <option value="4">Practice Test 4</option>
            <option value="5">Practice Test 5</option>
            <option value="6">Practice Test 6</option>
            <option value="7">Practice Test 7</option>
            <option value="8">Practice Test 8</option>
            <option value="9">Practice Test 9</option>
            <option value="10">Practice Test 10</option>
            <option value="11">Practice Test 11</option>
            <option value="12">Practice Test 12</option>
            <option value="13">Practice Test 13</option>
            <option value="14">Practice Test 14</option>
            <option value="15">Practice Test 15</option>
            <option value="16">Practice Test 16</option>
            <option value="17">Practice Test 17</option>
            <option value="18">Practice Test 18</option>
            <option value="19">Practice Test 19</option>
            <option value="20">Practice Test 20</option>
            <option value="21">Practice Test 21</option>
            <option value="22">Practice Test 22</option>
            <option value="23">Practice Test 23</option>
            <option value="24">Practice Test 24</option>
            <option value="25">Practice Test 25</option>
        `;
        practiceSetSelect.disabled = false;
    } else if (testType === 'sat') {
        // Add SAT practice sets
        practiceSetSelect.innerHTML += `
            <option value="1">Practice Test 1</option>
            <option value="2">Practice Test 2</option>
            <option value="3">Practice Test 3</option>
        `;
        practiceSetSelect.disabled = false;
    } else if (testType === 'psat') {
        // Add PSAT practice sets
        practiceSetSelect.innerHTML += `
            <option value="1">Practice Test 1</option>
            <option value="2">Practice Test 2</option>
            <option value="3">Practice Test 3</option>
            <option value="4">Practice Test 4</option>
            <option value="5">Practice Test 5 (Hard)</option>
        `;
        practiceSetSelect.disabled = false;
    } else if (testType === 'statetest') {
        // Add State Test practice sets
        practiceSetSelect.innerHTML += `
            <option value="1">Practice Test 1</option>
            <option value="2">Practice Test 2</option>
            <option value="3">Practice Test 3</option>
            <option value="4">Practice Test 4</option>
            <option value="5">Practice Test 5</option>
            <option value="6">Practice Test 6</option>
            <option value="7">Practice Test 7</option>
            <option value="8">Practice Test 8</option>
            <option value="9">Practice Test 9</option>
            <option value="10">Practice Test 10</option>
            <option value="11">Practice Test 11</option>
            <option value="12">Practice Test 12</option>
            <option value="13">Practice Test 13</option>
            <option value="14">Practice Test 14</option>
            <option value="15">Practice Test 15</option>
            <option value="16">Practice Test 16</option>
            <option value="17">Practice Test 17</option>
            <option value="18">Practice Test 18</option>
        `;
        practiceSetSelect.disabled = false;
    }
}

// Handle practice set change
function handlePracticeSetChange() {
    const testType = elements.testTypeSelect.value;
    const practiceSet = elements.practiceSetSelect.value;
    const loadButton = document.getElementById('load-test-scores');
    
    loadButton.disabled = !(testType && practiceSet);
}

// Handle section type change
function handleSectionTypeChange() {
    // Auto-reload if test is already selected
    if (state.selectedTestType && state.selectedPracticeSet) {
        loadStudents(1);
    }
}

// Handle score range change
function handleScoreRangeChange() {
    const scoreRangeValue = elements.scoreRangeSelect.value;
    
    if (scoreRangeValue) {
        // Parse range like "400-499" into {min: 400, max: 499}
        const [min, max] = scoreRangeValue.split('-').map(Number);
        state.selectedScoreRange = { min, max };
    } else {
        state.selectedScoreRange = null;
    }
    
    // Auto-reload if test is already selected
    if (state.selectedTestType && state.selectedPracticeSet) {
        loadStudents(1);
    }
}

// Handle load test scores button
function handleLoadTestScores() {
    const testType = elements.testTypeSelect.value;
    const practiceSet = elements.practiceSetSelect.value;
    const sectionTypeSelect = document.getElementById('section-type-select');
    
    if (testType && practiceSet) {
        let sectionType = null;
        
        // Get section type for SHSAT tests
        if (testType === 'shsat' && sectionTypeSelect && sectionTypeSelect.value) {
            sectionType = sectionTypeSelect.value;
        }
        
        state.selectedTestType = testType;
        state.selectedPracticeSet = practiceSet;
        state.selectedSectionType = sectionType;
        loadStudents(1);
    }
}

// Handle export Excel button
async function handleExportExcel() {
    const testType = elements.testTypeSelect.value;
    const practiceSet = elements.practiceSetSelect.value;
    const scoreRange = state.selectedScoreRange;
    const sectionTypeSelect = document.getElementById('section-type-select');
    
    if (!testType || !practiceSet) {
        alert('Please select a test type and practice set first.');
        return;
    }
    
    let sectionType = null;
    
    // Get section type for SHSAT tests
    if (testType === 'shsat' && sectionTypeSelect && sectionTypeSelect.value) {
        sectionType = sectionTypeSelect.value;
    }
    
    try {
        // Disable button and show loading state
        const exportBtn = document.getElementById('export-excel-btn');
        exportBtn.disabled = true;
        exportBtn.innerHTML = '⏳ Generating...';
        
        // Build URL with parameters
        const params = new URLSearchParams({
            testType,
            practiceSet: practiceSet
        });
        
        if (sectionType) {
            params.append('sectionType', sectionType);
        }
        
        if (scoreRange) {
            params.append('minScore', scoreRange.min);
            if (scoreRange.max) {
                params.append('maxScore', scoreRange.max);
            }
        }
        
        // Make request to export endpoint
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/admin/export/test-scores?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to export data');
        }
        
        // Get the blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sectionSuffix = sectionType && sectionType !== 'full' ? `_${sectionType}` : '';
        a.download = `${testType}_practice_${practiceSet}${sectionSuffix}_scores.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✅ Excel file downloaded successfully');
        
    } catch (error) {
        console.error('❌ Error exporting Excel:', error);
        alert('Failed to export data. Please try again.');
    } finally {
        // Re-enable button
        const exportBtn = document.getElementById('export-excel-btn');
        exportBtn.disabled = false;
        exportBtn.innerHTML = '📊 Download as Excel';
    }
}

// Handle student card click (for future detailed view)
function handleStudentClick(event) {
    // Check if delete button was clicked
    if (event.target.classList.contains('btn-delete') || event.target.closest('.btn-delete')) {
        event.stopPropagation();
        const deleteBtn = event.target.classList.contains('btn-delete') ? event.target : event.target.closest('.btn-delete');
        const studentId = deleteBtn.dataset.studentId;
        const studentName = deleteBtn.dataset.studentName;
        
        // Find the full student data
        const student = state.students.find(s => s.id === studentId);
        if (student) {
            showDeleteConfirmation(student);
        }
        return;
    }
    
    // Regular student card click (view profile)
    const studentCard = event.target.closest('.student-card');
    if (studentCard && !event.target.closest('.student-actions')) {
        const studentId = studentCard.dataset.studentId;
        window.location.href = `profile-view.html?userId=${studentId}`;
    }
}

// Show delete confirmation modal
function showDeleteConfirmation(student) {
    state.userToDelete = student;
    elements.deleteUserName.textContent = student.name;
    elements.deleteUserEmail.textContent = student.email;
    elements.deleteModal.style.display = 'flex';
}

// Close delete confirmation modal
function closeDeleteModal() {
    elements.deleteModal.style.display = 'none';
    state.userToDelete = null;
}

// Confirm user deletion
async function confirmDeleteUser() {
    if (!state.userToDelete) return;
    
    // Disable the delete button to prevent double-clicking
    elements.confirmDelete.disabled = true;
    elements.confirmDelete.textContent = 'Deleting...';
    
    try {
        const response = await AdminService.deleteUser(state.userToDelete.id);
        
        if (response.success) {
            // Close modal
            closeDeleteModal();
            
            // Show success message
            alert(`✅ ${response.message}`);
            
            // Reload students list and stats
            await Promise.all([
                loadDashboardStats(),
                loadStudents(),
                loadAllStudents()
            ]);
            
            console.log(`✅ Successfully deleted user: ${state.userToDelete.name}`);
        } else {
            throw new Error(response.message || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Failed to delete user:', error);
        alert(`❌ Error: ${error.message}`);
    } finally {
        // Re-enable the delete button
        elements.confirmDelete.disabled = false;
        elements.confirmDelete.textContent = 'Delete User';
    }
}

// Load current test code
async function loadCurrentTestCode() {
    const codeElement = document.getElementById('current-test-code');
    const loadingElement = document.getElementById('test-code-loading');
    const errorElement = document.getElementById('test-code-error');
    
    try {
        // Show loading state
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        codeElement.textContent = '---';
        
        const response = await AdminService.getTestCode();
        if (response.success) {
            codeElement.textContent = response.data.code;
            loadingElement.style.display = 'none';
        } else {
            throw new Error(response.message || 'Failed to load test code');
        }
    } catch (error) {
        console.error('Failed to load test code:', error);
        loadingElement.style.display = 'none';
        errorElement.style.display = 'block';
        errorElement.textContent = error.message;
    }
}

// Handle copy test code button click
async function handleCopyCodeClick() {
    const codeElement = document.getElementById('current-test-code');
    const copyBtn = document.getElementById('copy-code-btn');
    const code = codeElement.textContent;
    
    if (code === '---') {
        alert('No test code to copy');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(code);
        
        // Visual feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        copyBtn.style.background = '#d1fae5';
        copyBtn.style.color = '#065f46';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
            copyBtn.style.color = '';
        }, 2000);
    } catch (error) {
        console.error('Failed to copy code:', error);
        alert('Failed to copy code to clipboard');
    }
}

// Handle generate test code button click
async function handleGenerateCodeClick() {
    if (!confirm('Are you sure you want to generate a new test code? This will invalidate the old one.')) {
        return;
    }

    try {
        const response = await AdminService.generateTestCode();
        if (response.success) {
            alert(`New test code generated: ${response.data.code}`);
            // Refresh the current test code display
            await loadCurrentTestCode();
        } else {
            throw new Error(response.message || 'Failed to generate code');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Check authentication and admin role
function checkAuth() {
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
        elements.userName.textContent = userData.firstName || 'Admin';
        return true;
    } catch (error) {
        console.error('Error parsing user data:', error);
        window.location.href = 'login.html';
        return false;
    }
}

// Initialize the admin dashboard
async function init() {
    if (!checkAuth()) return;
    
    // Set up event listeners
    elements.searchInput.addEventListener('input', handleSearch);
    elements.gradeFilter.addEventListener('change', handleGradeFilter);
    elements.pagination.addEventListener('click', handlePaginationClick);
    elements.studentsGrid.addEventListener('click', handleStudentClick);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.generateCodeBtn.addEventListener('click', handleGenerateCodeClick);
    document.getElementById('copy-code-btn').addEventListener('click', handleCopyCodeClick);
    elements.studentSearch.addEventListener('input', handleStudentSearch);
    elements.studentSearchResults.addEventListener('click', handleStudentSearchSelect);
    elements.viewTestHistoryBtn.addEventListener('click', handleViewTestHistoryClick);
    elements.cancelDelete.addEventListener('click', closeDeleteModal);
    elements.confirmDelete.addEventListener('click', confirmDeleteUser);
    
    // Test score sorting event listeners
    if (elements.sortModeToggle) {
        elements.sortModeToggle.addEventListener('change', handleSortModeChange);
    }
    if (elements.testTypeSelect) {
        elements.testTypeSelect.addEventListener('change', handleTestTypeChange);
    }
    if (elements.practiceSetSelect) {
        elements.practiceSetSelect.addEventListener('change', handlePracticeSetChange);
    }
    if (elements.scoreRangeSelect) {
        elements.scoreRangeSelect.addEventListener('change', handleScoreRangeChange);
    }
    const sectionTypeSelect = document.getElementById('section-type-select');
    if (sectionTypeSelect) {
        sectionTypeSelect.addEventListener('change', handleSectionTypeChange);
    }
    const loadTestScoresBtn = document.getElementById('load-test-scores');
    if (loadTestScoresBtn) {
        loadTestScoresBtn.addEventListener('click', handleLoadTestScores);
    }
    const exportExcelBtn = document.getElementById('export-excel-btn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', handleExportExcel);
    }
    
    // Close delete modal when clicking outside
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) {
            closeDeleteModal();
        }
    });
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.studentSearch.contains(e.target) && !elements.studentSearchResults.contains(e.target)) {
            elements.studentSearchResults.style.display = 'none';
        }
    });
    
    // Load initial data
    await Promise.all([
        loadDashboardStats(),
        loadStudents(),
        loadAllStudents(),
        loadCurrentTestCode()
    ]);
}

// Load all students for search functionality
async function loadAllStudents() {
    try {
        let allStudents = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            const response = await AdminService.getStudents(page, '', 'all');
            if (response.success) {
                allStudents = allStudents.concat(response.data.students);
                hasMore = page < response.data.pagination.total;
                page++;
            } else {
                hasMore = false;
            }
        }
        
        state.allStudents = allStudents;
        console.log(`✅ Loaded ${allStudents.length} students for search`);
    } catch (error) {
        console.error('Failed to load all students:', error);
        state.allStudents = [];
    }
}

// Handle student search input
function handleStudentSearch() {
    clearTimeout(state.searchTimeout);
    
    const query = elements.studentSearch.value.trim().toLowerCase();
    
    if (query.length === 0) {
        elements.studentSearchResults.style.display = 'none';
        state.selectedStudent = null;
        elements.viewTestHistoryBtn.disabled = true;
        return;
    }
    
    state.searchTimeout = setTimeout(() => {
        performStudentSearch(query);
    }, 300);
}

// Perform student search
function performStudentSearch(query) {
    const filteredStudents = state.allStudents.filter(student => {
        const nameMatch = student.name.toLowerCase().includes(query);
        const emailMatch = student.email.toLowerCase().includes(query);
        const gradeMatch = student.grade.toString().includes(query);
        return nameMatch || emailMatch || gradeMatch;
    });
    
    displaySearchResults(filteredStudents, query);
}

// Display search results
function displaySearchResults(students, query) {
    if (students.length === 0) {
        elements.studentSearchResults.innerHTML = `
            <div class="student-search-empty">
                No students found matching "${query}"
            </div>
        `;
        elements.studentSearchResults.style.display = 'block';
        return;
    }
    
    const resultsHtml = students.slice(0, 10).map(student => `
        <div class="student-search-item" data-student-id="${student.id}">
            <div class="student-search-name">${highlightMatch(student.name, query)}</div>
            <div class="student-search-details">
                ${highlightMatch(student.email, query)} • Grade ${student.grade}
            </div>
        </div>
    `).join('');
    
    elements.studentSearchResults.innerHTML = resultsHtml;
    elements.studentSearchResults.style.display = 'block';
}

// Highlight matching text in search results
function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

// Handle student search result selection
function handleStudentSearchSelect(event) {
    const searchItem = event.target.closest('.student-search-item');
    if (!searchItem) return;
    
    const studentId = searchItem.dataset.studentId;
    const student = state.allStudents.find(s => s.id === studentId);
    
    if (student) {
        // Update UI
        elements.studentSearch.value = student.name;
        elements.studentSearchResults.style.display = 'none';
        
        // Update state
        state.selectedStudent = student;
        elements.viewTestHistoryBtn.disabled = false;
        
        // Visual feedback
        document.querySelectorAll('.student-search-item').forEach(item => {
            item.classList.remove('selected');
        });
        searchItem.classList.add('selected');
    }
}

// Handle view test history button click
function handleViewTestHistoryClick() {
    if (!state.selectedStudent) return;
    
    // Navigate to the admin test history page with student ID parameter
    window.location.href = `admin-test-history.html?studentId=${state.selectedStudent.id}`;
}



// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 