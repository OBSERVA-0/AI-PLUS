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
}

// State management
const state = {
    currentPage: 1,
    totalPages: 1,
    searchQuery: '',
    gradeFilter: 'all',
    students: [],
    loading: false,
    allStudents: [], // Store all students for search
    selectedStudent: null, // Currently selected student for test history
    searchTimeout: null,
    userToDelete: null // Store user data for deletion confirmation
};

// DOM elements
const elements = {
    totalStudents: document.getElementById('total-students'),
    activeStudents: document.getElementById('active-students'),
    newStudents: document.getElementById('new-students'),
    recentActivity: document.getElementById('recent-activity'),
    searchInput: document.getElementById('search-input'),
    gradeFilter: document.getElementById('grade-filter'),
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
    testHistoryModal: document.getElementById('test-history-modal'),
    closeTestHistory: document.getElementById('close-test-history'),
    testHistoryTitle: document.getElementById('test-history-title'),
    testHistoryLoading: document.getElementById('test-history-loading'),
    testHistoryContent: document.getElementById('test-history-content'),
    modalHistoryList: document.getElementById('modal-history-list'),
    modalEmptyState: document.getElementById('modal-empty-state'),
    modalTotalAttempts: document.getElementById('modal-total-attempts'),
    modalAverageScore: document.getElementById('modal-average-score'),
    modalBestScore: document.getElementById('modal-best-score'),
    modalTotalTime: document.getElementById('modal-total-time'),
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
    state.searchQuery = search;
    state.gradeFilter = grade;
    
    // Show loading state
    elements.studentsLoading.style.display = 'block';
    elements.studentsError.style.display = 'none';
    elements.studentsGrid.style.display = 'none';
    elements.pagination.style.display = 'none';
    
    try {
        const response = await AdminService.getStudents(page, search, grade);
        const { students, pagination } = response.data;
        
        state.students = students;
        state.totalPages = pagination.total;
        
        // Update students count
        elements.studentsCount.textContent = `${pagination.count} of ${pagination.totalStudents} students`;
        
        // Render students
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
        
        // Render pagination
        if (pagination.total > 1) {
            elements.pagination.innerHTML = createPagination(pagination.current, pagination.total);
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
        loadStudents(page, state.searchQuery, state.gradeFilter);
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

// Handle generate test code button click
async function handleGenerateCodeClick() {
    if (!confirm('Are you sure you want to generate a new test code? This will invalidate the old one.')) {
        return;
    }

    try {
        const response = await AdminService.generateTestCode();
        if (response.success) {
            alert(`New test code generated: ${response.data.code}`);
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
    elements.studentSearch.addEventListener('input', handleStudentSearch);
    elements.studentSearchResults.addEventListener('click', handleStudentSearchSelect);
    elements.viewTestHistoryBtn.addEventListener('click', handleViewTestHistoryClick);
    elements.closeTestHistory.addEventListener('click', closeTestHistoryModal);
    elements.cancelDelete.addEventListener('click', closeDeleteModal);
    elements.confirmDelete.addEventListener('click', confirmDeleteUser);
    
    // Close modal when clicking outside
    elements.testHistoryModal.addEventListener('click', (e) => {
        if (e.target === elements.testHistoryModal) {
            closeTestHistoryModal();
        }
    });
    
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
        loadAllStudents()
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
async function handleViewTestHistoryClick() {
    if (!state.selectedStudent) return;
    
    // Show modal and loading state
    elements.testHistoryModal.style.display = 'flex';
    elements.testHistoryLoading.style.display = 'block';
    elements.testHistoryContent.style.display = 'none';
    
    try {
        const response = await AdminService.getUserTestHistory(state.selectedStudent.id);
        if (response.success) {
            const { student, testHistory } = response.data;
            
            // Update modal title
            elements.testHistoryTitle.textContent = `Test History - ${student.name}`;
            
            // Display test history
            displayTestHistory(testHistory);
            
            // Hide loading, show content
            elements.testHistoryLoading.style.display = 'none';
            elements.testHistoryContent.style.display = 'block';
        } else {
            throw new Error(response.message || 'Failed to load test history');
        }
    } catch (error) {
        console.error('Failed to load test history:', error);
        elements.testHistoryLoading.style.display = 'none';
        
        // Show error in modal
        elements.modalEmptyState.style.display = 'block';
        elements.modalEmptyState.innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h3>Error Loading Test History</h3>
            <p>${error.message}</p>
        `;
    }
}

// Display test history in modal
function displayTestHistory(testHistory) {
    if (testHistory.length === 0) {
        elements.modalHistoryList.style.display = 'none';
        elements.modalEmptyState.style.display = 'block';
        return;
    }
    
    // Calculate and update stats
    updateTestHistoryStats(testHistory);
    
    // Render history items
    elements.modalHistoryList.innerHTML = testHistory.map(test => createTestHistoryItem(test)).join('');
    elements.modalHistoryList.style.display = 'flex';
    elements.modalEmptyState.style.display = 'none';
}

// Update test history stats
function updateTestHistoryStats(testHistory) {
    const totalAttempts = testHistory.length;
    
    let totalScore = 0;
    let bestScore = 0;
    let totalTime = 0;

    testHistory.forEach(test => {
        totalScore += test.results.percentage;
        bestScore = Math.max(bestScore, test.results.percentage);
        totalTime += test.results.timeSpent;
    });

    const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

    // Update stats display
    elements.modalTotalAttempts.textContent = totalAttempts;
    elements.modalAverageScore.textContent = `${averageScore}%`;
    elements.modalBestScore.textContent = `${bestScore}%`;
    elements.modalTotalTime.textContent = formatTestTime(totalTime);
}

// Create test history item HTML
function createTestHistoryItem(test) {
    const date = new Date(test.completedAt);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const testTypeLabel = getTestTypeLabel(test.testType);
    const performance = getPerformanceBadge(test.results.percentage);
    
    let scoresHtml = '';
    
    // Always show percentage and time
    scoresHtml += `
        <div class="score-item percentage-score">
            <div class="score-value">${test.results.percentage}%</div>
            <div class="score-label">Overall Score</div>
        </div>
        <div class="score-item time-score">
            <div class="score-value">${formatTestTime(test.results.timeSpent)}</div>
            <div class="score-label">Time Taken</div>
        </div>
    `;

    // Add scaled scores if available
    if (test.scaledScores && test.scaledScores.total) {
        // Calculate raw scores from category scores
        let mathRawScore = { correct: 0, total: 0 };
        let englishRawScore = { correct: 0, total: 0 };
        
        if (test.results.categoryScores) {
            // Convert Map to object if needed
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
                    <span style="font-size: 12px; color: #666;">
                        ${test.results.correctCount}/${test.results.totalQuestions} correct
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Helper functions for test history
function getTestTypeLabel(testType) {
    const labels = {
        'shsat': 'SHSAT',
        'sat': 'SAT',
        'state': 'State Test'
    };
    return labels[testType] || testType.toUpperCase();
}

function getPerformanceBadge(percentage) {
    if (percentage >= 80) {
        return { class: 'badge-excellent', text: 'Excellent' };
    } else if (percentage >= 60) {
        return { class: 'badge-good', text: 'Good' };
    } else {
        return { class: 'badge-needs-improvement', text: 'Needs Improvement' };
    }
}

function formatTestTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Close test history modal
function closeTestHistoryModal() {
    elements.testHistoryModal.style.display = 'none';
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 