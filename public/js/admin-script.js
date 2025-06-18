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
}

// State management
const state = {
    currentPage: 1,
    totalPages: 1,
    searchQuery: '',
    gradeFilter: 'all',
    students: [],
    loading: false
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
    logoutBtn: document.getElementById('logout-btn')
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
    const studentCard = event.target.closest('.student-card');
    if (studentCard) {
        const studentId = studentCard.dataset.studentId;
        console.log('Student clicked:', studentId);
        // TODO: Open detailed student view modal or navigate to student detail page
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
    
    // Load initial data
    await Promise.all([
        loadDashboardStats(),
        loadStudents()
    ]);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 