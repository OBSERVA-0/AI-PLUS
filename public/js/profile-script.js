// Profile Page Script
class AuthService {
    static getToken() {
        return localStorage.getItem('authToken');
    }

    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static async logout() {
        try {
            await this.makeRequest('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }

    static async makeRequest(url, options = {}) {
        const token = this.getToken();
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(`/api${url}`, finalOptions);
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
}

// Scroll Lock Utility for Profile Page
class ScrollLock {
    constructor() {
        this.isLocked = false;
        this.scrollPosition = 0;
        this.init();
    }

    init() {
        // Apply CSS overscroll prevention
        this.applyCSSOverscrollPrevention();
        
        // Prevent overscroll on touch devices
        this.preventOverscroll();
        
        // Handle scroll boundaries
        this.handleScrollBoundaries();
        
        // Prevent elastic scrolling on iOS
        this.preventElasticScrolling();
        
        // Prevent overscroll on all scroll events
        this.preventAllOverscroll();
    }

    applyCSSOverscrollPrevention() {
        // Apply overscroll prevention to document elements
        document.documentElement.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehaviorY = 'none';
        document.documentElement.style.overscrollBehaviorX = 'none';
        
        document.body.style.overscrollBehavior = 'none';
        document.body.style.overscrollBehaviorY = 'none';
        document.body.style.overscrollBehaviorX = 'none';
    }

    preventAllOverscroll() {
        // Prevent overscroll on window scroll
        window.addEventListener('scroll', (e) => {
            if (window.scrollY <= 0) {
                window.scrollTo(0, 0);
            }
            
            const maxScroll = document.body.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll) {
                window.scrollTo(0, maxScroll);
            }
        }, { passive: false });

        // Prevent overscroll on touchmove
        document.addEventListener('touchmove', (e) => {
            const target = e.target;
            const scrollableParent = this.getScrollableParent(target);
            
            if (!scrollableParent || scrollableParent === document.body) {
                // Prevent overscroll on body
                if (window.scrollY <= 0 || window.scrollY >= document.body.scrollHeight - window.innerHeight) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        }, { passive: false });

        // Prevent overscroll on wheel events
        document.addEventListener('wheel', (e) => {
            const target = e.target;
            const scrollableParent = this.getScrollableParent(target);
            
            if (!scrollableParent || scrollableParent === document.body) {
                const delta = e.deltaY;
                
                // Prevent scroll at boundaries
                if ((delta < 0 && window.scrollY <= 0) || 
                    (delta > 0 && window.scrollY >= document.body.scrollHeight - window.innerHeight)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        }, { passive: false });
    }

    preventOverscroll() {
        // Prevent overscroll behavior on the main document
        document.addEventListener('touchmove', (e) => {
            if (this.isAtScrollBoundary(e.target)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });

        // Prevent overscroll on wheel events
        document.addEventListener('wheel', (e) => {
            if (this.isAtScrollBoundary(e.target)) {
                const delta = e.deltaY;
                const element = this.getScrollableParent(e.target);
                
                if (element) {
                    const { scrollTop, scrollHeight, clientHeight } = element;
                    
                    // Prevent scroll at top boundary
                    if (delta < 0 && scrollTop <= 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    
                    // Prevent scroll at bottom boundary
                    if (delta > 0 && scrollTop + clientHeight >= scrollHeight) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                }
            }
        }, { passive: false });
    }

    handleScrollBoundaries() {
        // Handle scroll boundaries for specific elements
        const scrollableElements = document.querySelectorAll('.mastery-grid, .stats-grid, .test-progress-grid');
        
        scrollableElements.forEach(element => {
            element.addEventListener('scroll', (e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.target;
                
                // Add visual feedback at boundaries
                if (scrollTop <= 0) {
                    e.target.classList.add('at-top');
                    e.target.classList.remove('at-bottom');
                } else if (scrollTop + clientHeight >= scrollHeight - 1) {
                    e.target.classList.add('at-bottom');
                    e.target.classList.remove('at-top');
                } else {
                    e.target.classList.remove('at-top', 'at-bottom');
                }
            });
        });
    }

    preventElasticScrolling() {
        // Prevent elastic scrolling on iOS Safari
        let startY = 0;
        let startX = 0;
        
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const element = this.getScrollableParent(e.target);
            
            if (!element || element === document.body) {
                const isScrollingUp = currentY > startY;
                const isScrollingDown = currentY < startY;
                
                // Prevent overscroll at document boundaries
                if ((isScrollingUp && window.scrollY <= 0) || 
                    (isScrollingDown && window.scrollY + window.innerHeight >= document.body.scrollHeight)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        }, { passive: false });
    }

    isAtScrollBoundary(element) {
        const scrollableParent = this.getScrollableParent(element);
        if (!scrollableParent) return false;
        
        const { scrollTop, scrollHeight, clientHeight } = scrollableParent;
        return scrollTop <= 0 || scrollTop + clientHeight >= scrollHeight;
    }

    getScrollableParent(element) {
        if (!element || element === document.body) return null;
        
        const { overflow, overflowY } = window.getComputedStyle(element);
        const isScrollable = overflow === 'auto' || overflow === 'scroll' || 
                           overflowY === 'auto' || overflowY === 'scroll';
        
        if (isScrollable && element.scrollHeight > element.clientHeight) {
            return element;
        }
        
        return this.getScrollableParent(element.parentElement);
    }

    lock() {
        if (this.isLocked) return;
        
        this.scrollPosition = window.pageYOffset;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scrollPosition}px`;
        document.body.style.width = '100%';
        document.body.style.overscrollBehavior = 'none';
        this.isLocked = true;
    }

    unlock() {
        if (!this.isLocked) return;
        
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overscrollBehavior = 'none';
        window.scrollTo(0, this.scrollPosition);
        this.isLocked = false;
    }
}

// Initialize Profile Page
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    await loadUserProfile();
    await loadUserStats();
    await loadMasteryData();
    setupEventListeners();
});

async function checkAuth() {
    const token = AuthService.getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
}

function setupEventListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async function() {
        try {
            await AuthService.logout();
        } catch (error) {
            console.error('Error during logout:', error);
            localStorage.clear();
            window.location.href = 'login.html';
        }
    });

    // Edit profile button (placeholder for future functionality)
    // document.getElementById('edit-profile-btn').addEventListener('click', function() {
    //     alert('Profile editing feature coming soon!');
    // });
}

async function loadUserProfile() {
    try {
        console.log('🔍 Loading user profile...');
        const response = await AuthService.makeRequest('/user/profile');
        
        if (response.success) {
            const user = response.data.user;
            console.log('✅ User profile loaded:', user);
            
            // Update profile information
            document.getElementById('user-name').textContent = user.firstName || 'Student';
            document.getElementById('profile-name').textContent = user.fullName || `${user.firstName} ${user.lastName}`;
            document.getElementById('profile-email').textContent = user.email;
            document.getElementById('profile-grade').textContent = user.grade;
            
            // Update user initials
            const initials = getInitials(user.firstName, user.lastName);
            document.getElementById('user-initials').textContent = initials;
            
            // Format join date
            const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short'
            });
            document.getElementById('profile-join-date').textContent = joinDate;
            
            // Update category averages
            if (user.categoryAverages) {
                document.getElementById('profile-math-avg').textContent = `${user.categoryAverages.math}%`;
                document.getElementById('profile-english-avg').textContent = `${user.categoryAverages.english}%`;
            }

            // Update mastery areas count
            if (user.totalMasteryAreas !== undefined) {
                document.getElementById('mastery-areas-count').textContent = user.totalMasteryAreas;
            }

            // Populate SHSAT Scores section
            const shsatProgress = user.testProgress.shsat;
            if (shsatProgress && shsatProgress.testsCompleted > 0 && shsatProgress.bestScaledScore && shsatProgress.bestScaledScore.total > 0) {
                const shsatSection = document.querySelector('.shsat-scores-section');
                if (shsatSection) shsatSection.style.display = 'block';

                document.getElementById('shsat-latest-total').textContent = shsatProgress.latestScaledScore.total || 0;
                document.getElementById('shsat-latest-math').textContent = `Math: ${shsatProgress.latestScaledScore.math || 0}`;
                document.getElementById('shsat-latest-english').textContent = `ELA: ${shsatProgress.latestScaledScore.english || 0}`;

                document.getElementById('shsat-best-total').textContent = shsatProgress.bestScaledScore.total || 0;
                document.getElementById('shsat-best-math').textContent = `Math: ${shsatProgress.bestScaledScore.math || 0}`;
                document.getElementById('shsat-best-english').textContent = `ELA: ${shsatProgress.bestScaledScore.english || 0}`;
            }

            // Populate SAT Scores section
            const satProgress = user.testProgress.sat;
            if (satProgress && satProgress.testsCompleted > 0 && satProgress.bestScaledScore && satProgress.bestScaledScore.total > 0) {
                const satSection = document.querySelector('.sat-scores-section');
                if (satSection) satSection.style.display = 'block';

                document.getElementById('sat-latest-total').textContent = satProgress.latestScaledScore.total || 0;
                document.getElementById('sat-latest-math').textContent = `Math: ${satProgress.latestScaledScore.math || 0}`;
                document.getElementById('sat-latest-rw').textContent = `R&W: ${satProgress.latestScaledScore.reading_writing || 0}`;

                document.getElementById('sat-best-total').textContent = satProgress.bestScaledScore.total || 0;
                document.getElementById('sat-best-math').textContent = `Math: ${satProgress.bestScaledScore.math || 0}`;
                document.getElementById('sat-best-rw').textContent = `R&W: ${satProgress.bestScaledScore.reading_writing || 0}`;
            }
            
        } else {
            console.error('Failed to load user profile');
        }
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
    }
}

async function loadUserStats() {
    try {
        console.log('📊 Loading user stats...');
        const response = await AuthService.makeRequest('/user/stats');
        
        if (response.success) {
            const stats = response.data.stats;
            const testProgress = response.data.testProgress;
            console.log('✅ User stats loaded:', stats, testProgress);
            
            // Update overall stats
            document.getElementById('profile-total-tests').textContent = stats.totalTests;

            // Format and update study time
            const totalSeconds = stats.totalTimeSpent || 0;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            document.getElementById('profile-study-time').textContent = `${hours}h ${minutes}m`;
            
            // Calculate best score across all tests, preferring scaled scores
            const bestShsat = (testProgress.shsat && testProgress.shsat.bestScaledScore && testProgress.shsat.bestScaledScore.total) || 0;
            const bestSat = (testProgress.sat && testProgress.sat.bestScaledScore && testProgress.sat.bestScaledScore.total) || 0;

            let bestScoreToDisplay = '0%';
            if (bestShsat > 0 || bestSat > 0) {
                bestScoreToDisplay = Math.max(bestShsat, bestSat);
            } else {
                // Fallback to percentage if no scaled scores exist
                const bestPercentage = Math.max(
                    (testProgress.shsat && testProgress.shsat.bestScore) || 0,
                    (testProgress.sat && testProgress.sat.bestScore) || 0,
                    (testProgress.stateTest && testProgress.stateTest.bestScore) || 0
                );
                if (bestPercentage > 0) {
                    bestScoreToDisplay = `${bestPercentage}%`;
                }
            }
            
            document.getElementById('profile-best-score').textContent = bestScoreToDisplay;

        } else {
            console.error('Failed to load user stats');
        }
    } catch (error) {
        console.error('❌ Error loading user stats:', error);
    }
}

async function loadMasteryData() {
    try {
        console.log('🎯 Loading mastery data...');
        const response = await AuthService.makeRequest('/user/mastery');
        console.log('📊 Mastery response:', response);
        
        if (response.success) {
            console.log('✅ Mastery data loaded successfully:', response.data);
            displayMasteryData(response.data.masterySummary);
        } else {
            console.log('⚠️ No mastery data available, showing empty state');
            displayEmptyMasteryState();
        }
    } catch (error) {
        console.error('❌ Failed to load mastery data:', error);
        displayEmptyMasteryState();
    }
}

function displayMasteryData(masterySummary) {
    console.log('🎨 Displaying mastery data:', masterySummary);
    const masteryGrid = document.getElementById('mastery-grid');
    
    if (!masteryGrid) {
        console.error('❌ Mastery grid element not found!');
        return;
    }

    masteryGrid.innerHTML = '';

    if (!masterySummary || Object.keys(masterySummary).length === 0) {
        console.log('📝 No mastery data to display, showing empty state');
        displayEmptyMasteryState();
        return;
    }

    console.log(`📊 Creating ${Object.keys(masterySummary).length} mastery cards`);
    Object.entries(masterySummary).forEach(([category, data]) => {
        console.log(`🏷️ Creating card for category: ${category}`, data);
        const masteryCard = createMasteryCard(category, data);
        masteryGrid.appendChild(masteryCard);
    });
}

function createMasteryCard(category, data) {
    const card = document.createElement('div');
    card.className = 'mastery-card';

    const masteryLevelText = getMasteryLevelText(data.masteryLevel);
    const masteryStars = createMasteryStars(data.masteryLevel);

    card.innerHTML = `
        <div class="mastery-card-header">
            <div class="mastery-category">${formatCategoryName(category)}</div>
            <div class="mastery-level">
                <div class="mastery-stars">${masteryStars}</div>
                <span class="mastery-level-text mastery-level-${data.masteryLevel}">${masteryLevelText}</span>
            </div>
        </div>
        <div class="mastery-stats">
            <div class="mastery-stat">
                <span class="mastery-stat-value">${data.averageScore}%</span>
                <span class="mastery-stat-label">Accuracy</span>
            </div>
            <div class="mastery-stat">
                <span class="mastery-stat-value">${data.totalQuestions}</span>
                <span class="mastery-stat-label">Questions</span>
            </div>
        </div>
        <div class="mastery-progress">
            <div class="mastery-progress-bar">
                <div class="mastery-progress-fill" style="width: ${data.averageScore}%"></div>
            </div>
        </div>
    `;

    return card;
}

function createMasteryStars(level) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= level ? 'filled' : '';
        stars += `<svg class="mastery-star ${filled}" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>`;
    }
    return stars;
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

function formatCategoryName(category) {
    // Convert category names to more readable format
    return category
        .split(/[_\s]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function displayEmptyMasteryState() {
    console.log('🆕 Displaying empty mastery state');
    const masteryGrid = document.getElementById('mastery-grid');
    
    if (!masteryGrid) {
        console.error('❌ Mastery grid element not found for empty state!');
        return;
    }

    masteryGrid.innerHTML = `
        <div class="mastery-empty-state">
            <h3>Start Building Your Mastery Profile</h3>
            <p>Take your first practice test to see your performance across different subject areas and track your progress over time.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <a href="dashboard.html" class="btn btn-primary">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                    </svg>
                    Take Your First Test
                </a>
               
            </div>
        </div>
    `;
    console.log('✅ Empty mastery state displayed');
}

// async function seedSampleMasteryData() {
//     try {
//         console.log('🌱 Seeding sample mastery data...');
//         showLoadingState('Loading sample mastery data...');
        
//         const response = await AuthService.makeRequest('/user/seed-mastery', {
//             method: 'POST'
//         });
        
//         if (response.success) {
//             console.log('✅ Sample data seeded successfully');
//             await loadMasteryData(); // Reload mastery data
//             hideLoadingState();
//         } else {
//             throw new Error('Failed to seed sample data');
//         }
//     } catch (error) {
//         console.error('❌ Error seeding sample data:', error);
//         hideLoadingState();
//         alert('Error loading sample data. Please try again.');
//     }
// }

function getInitials(firstName, lastName) {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last || 'ST';
}

// Loading state functions
function showLoadingState(message = 'Loading...') {
    hideLoadingState();
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-overlay';
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(loadingDiv);
}

function hideLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// Initialize scroll lock for profile page
const scrollLock = new ScrollLock(); 