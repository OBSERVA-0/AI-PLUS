// Import API configuration
import { API_BASE_URL } from './config.js';

// Add at the top of the file after the API_BASE_URL declaration
// Application State
let currentUser = null;
let currentTest = null;
let currentPracticeSet = '1';
let testQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let skippedQuestions = new Set(); // Track skipped questions
let testTimer = null;
let testStartTime = null;
let timeLimit = 60 * 60; // 60 minutes default

// Authentication Service
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
            // Call logout endpoint to invalidate session
            await this.makeRequest('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            // Clear local storage
            localStorage.clear();
            // Redirect to login page
            window.location.href = 'login.html';
        }
    }

    static async makeRequest(url, options = {}) {
        try {
            const token = this.getToken();
            const response = await fetch(`${API_BASE_URL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
}

// Questions Service
class QuestionsService {
    static async getQuestions(testType, practiceSet = '1') {
        try {
            const response = await fetch(`${API_BASE_URL}/questions/test?testType=${testType}&practiceSet=${practiceSet}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    static async submitAnswers(testType, answers, timeSpent, practiceSet = '1') {
        try {
            const response = await AuthService.makeRequest('/questions/submit', {
                method: 'POST',
                body: JSON.stringify({
                    testType,
                    practiceSet,
                    answers,
                    timeSpent
                })
            });
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    static async seedQuestions() {
        return await AuthService.makeRequest('/questions/seed', {
            method: 'POST'
        });
    }

    static async getPracticeSets(testType, subject, grade = null) {
        const params = new URLSearchParams({
            testType,
            subject
        });
        
        if (grade) {
            params.append('grade', grade.toString());
        }
        
        return await AuthService.makeRequest(`/questions/practice-sets?${params}`);
    }
    
    static async getPracticeSetQuestions(setId, testType, subject, grade = null) {
        const params = new URLSearchParams({
            testType,
            subject
        });
        
        if (grade) {
            params.append('grade', grade.toString());
        }
        
        return await AuthService.makeRequest(`/questions/practice-set/${setId}?${params}`);
    }

    static async getQuestionsFromJSON(testType) {
        const response = await fetch(`./data/${testType}practice1questions.json`);
        if (!response.ok) {
            throw new Error('Failed to load questions from JSON');
        }
        return await response.json();
    }

    static async validateTestCode(testCode) {
        return await AuthService.makeRequest('/questions/validate-code', {
            method: 'POST',
            body: JSON.stringify({ testCode })
        });
    }
}

// Stats management functions
async function getTestStats() {
    try {
        const response = await AuthService.makeRequest('/user/stats');
        if (response.success) {
            const { stats, testProgress } = response.data;
            return {
                totalTests: stats.totalTests || 0,
                averageScore: stats.averageScore || 0,
                testsByType: {
                    shsat: testProgress.shsat || { testsCompleted: 0, bestScore: 0, averageScore: 0 },
                    sat: testProgress.sat || { testsCompleted: 0, bestScore: 0, averageScore: 0 },
                    state: testProgress.stateTest || { testsCompleted: 0, bestScore: 0, averageScore: 0 }
                }
            };
        }
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
    return null;
}

async function updateTestStats(testType, score, timeSpent, categoryScores = null, shsatScores = null, satScores = null) {
    try {
        console.log('Updating test stats:', { testType, score, timeSpent, categoryScores });
        
        // Send test results to server
        const requestBody = {
            testType,
            score,
            timeSpent,
            categoryScores
        };

        if (shsatScores) {
            requestBody.shsatScores = shsatScores;
        }
        if (satScores) {
            requestBody.satScores = satScores;
        }

        const response = await AuthService.makeRequest('/user/update-stats', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        if (response.success) {
            console.log('Test stats updated successfully:', response.data);
            // Update UI with new stats
            await updateUIStats();
        } else {
            console.error('Failed to update test stats:', response);
        }
    } catch (error) {
        console.error('Failed to update test stats:', error);
        throw error; // Propagate error for handling in endTest
    }
}

async function updateUIStats() {
    try {
        const stats = await getTestStats();
        console.log('Fetched stats for UI update:', stats);
        
        // Update overall stats
        document.getElementById('total-tests').textContent = stats ? stats.totalTests : '0';
        document.getElementById('avg-score').textContent = stats ? `${Math.round(stats.averageScore)}%` : '0%';
        
        // Update individual test stats
        if (stats && stats.testsByType) {
            Object.entries(stats.testsByType).forEach(([testType, typeStats]) => {
                console.log(`Updating UI for ${testType}:`, typeStats);
                const card = document.querySelector(`[data-test="${testType}"]`);
                if (card) {
                    const testCount = card.querySelector('.test-count');
                    const bestScore = card.querySelector('.best-score');
                    
                    if (testCount) {
                        testCount.textContent = typeStats.testsCompleted || '0';
                    }
                    if (bestScore) {
                        bestScore.textContent = (typeStats.testsCompleted && typeStats.bestScore) ? 
                            `${Math.round(typeStats.bestScore)}%` : 'N/A';
                    }
                }
            });
        } else {
            console.log('No stats available, resetting UI to defaults');
            // Reset all stats to default values
            document.querySelectorAll('[data-test]').forEach(card => {
                const testCount = card.querySelector('.test-count');
                const bestScore = card.querySelector('.best-score');
                
                if (testCount) testCount.textContent = '0';
                if (bestScore) bestScore.textContent = 'N/A';
            });
        }
    } catch (error) {
        console.error('Error updating UI stats:', error);
    }
}

// Load user information and display name
function loadUserInfo() {
    try {
        const user = AuthService.getUser();
        if (user) {
            // Display user's first name or full name
            let userName = 'Student'; // Default fallback
            
            if (user.firstName) {
                userName = user.firstName;
            } else if (user.fullName) {
                userName = user.fullName;
            } else if (user.email) {
                userName = user.email.split('@')[0];
            }
            
            // Capitalize first letter
            userName = userName.charAt(0).toUpperCase() + userName.slice(1);
            
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = userName;
            }

            // Show Admin toggle if user is an admin
            if (user.role === 'admin') {
                const adminToggle = document.querySelector('.admin-toggle');
                if (adminToggle) {
                    adminToggle.style.display = 'block';
                }
            }
            
            console.log('✅ User name loaded:', userName);
        } else {
            console.log('❌ No user data found, redirecting to login');
            // If no user data, redirect to login
            AuthService.logout();
        }
    } catch (error) {
        console.error('❌ Error loading user info:', error);
        // Fallback to default if there's an error
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = 'Student';
        }
    }
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async function() {
    await loadUserInfo();
    await updateUIStats();
    setupEventListeners();
});

function setupEventListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async function() {
        try {
            await AuthService.logout();
        } catch (error) {
            console.error('Error during logout:', error);
            // Force logout even if server request fails
            localStorage.clear();
            window.location.href = 'login.html';
        }
    });

    // Test selection buttons
    document.querySelectorAll('.start-test-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const testCard = e.target.closest('.test-card');
            const testType = testCard.dataset.test;
            const practiceSet = e.target.dataset.practiceSet || '1';
            
            if (!button.disabled) {
                showTestCodeModal(testType, practiceSet);
            }
        });
    });

    // Test navigation buttons
    document.getElementById('prev-question').addEventListener('click', previousQuestion);
    document.getElementById('next-question').addEventListener('click', nextQuestion);
    document.getElementById('end-test-btn').addEventListener('click', showEndTestConfirmation);

    // Results buttons
    document.getElementById('retake-test').addEventListener('click', function() {
        showSection('test-selection');
    });

    document.getElementById('back-to-dashboard').addEventListener('click', function() {
        showSection('test-selection');
    });
}

async function loadUserStats() {
    try {
        const response = await AuthService.makeRequest('/user/stats');
        if (response.success) {
            const stats = response.data.stats;
            const testProgress = response.data.stats.testProgress;
            
            // Update overall stats
            document.getElementById('total-tests').textContent = stats.totalTests;

            // Calculate average score only from tests that have been taken
            let totalScore = 0;
            let testsWithScores = 0;
            
            if (testProgress.shsat.testsCompleted > 0) {
                totalScore += testProgress.shsat.averageScore;
                testsWithScores++;
            }
            if (testProgress.sat.testsCompleted > 0) {
                totalScore += testProgress.sat.averageScore;
                testsWithScores++;
            }
            if (testProgress.stateTest.testsCompleted > 0) {
                totalScore += testProgress.stateTest.averageScore;
                testsWithScores++;
            }

            const overallAverage = testsWithScores > 0 ? Math.round(totalScore / testsWithScores) : 0;
            document.getElementById('avg-score').textContent = `${overallAverage}%`;

            // Update individual test stats
            updateTestCardStats('shsat', testProgress.shsat);
            updateTestCardStats('sat', testProgress.sat);
            updateTestCardStats('state', testProgress.stateTest);
            
            // Also refresh user info in case it was updated
            loadUserInfo();
        }
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
}

function updateTestCardStats(testType, progress) {
    const testCard = document.querySelector(`[data-test="${testType}"]`);
    if (testCard) {
        testCard.querySelector('.test-count').textContent = progress.testsCompleted;
        testCard.querySelector('.best-score').textContent = 
            progress.bestScore > 0 ? progress.bestScore + '%' : 'N/A';
    }
}

async function startTest(testType, practiceSet = '1') {
    if (testType !== 'shsat' && testType !== 'sat') {
        alert('This test is coming soon!');
        return;
    }

    try {
        currentTest = testType;
        currentPracticeSet = practiceSet;
        
        // Show loading state
        showLoadingState('Loading questions...');
        
        // Fetch questions from API
        console.log(`🎯 Fetching questions for ${testType} practice set ${practiceSet}`);
        const response = await QuestionsService.getQuestions(testType, practiceSet);
        
        if (!response.success || !response.data.questions.length) {
            throw new Error('No questions available');
        }
        
        testQuestions = response.data.questions;
        
        // Convert API format to internal format
        testQuestions = testQuestions.map(q => ({
            id: q._id,
            text: q.question_text,
            passage: q.passage,
            options: q.options,
            category: q.category,
            difficulty: q.difficulty,
            timeEstimate: q.time_estimate || 60,
            questionNumber: q.question_number,
            practiceSet: q.practice_set,
            answer_type: q.answer_type
        }));
        
        currentQuestionIndex = 0;
        userAnswers = {};
        skippedQuestions = new Set(); // Reset skipped questions
        testStartTime = new Date();
        
        // Calculate total time based on question estimates
        const totalEstimatedTime = testQuestions.reduce((total, q) => total + (q.timeEstimate || 90), 0);
        timeLimit = Math.max(totalEstimatedTime, 10 * 60); // At least 10 minutes
        
        // Update test info
        const testTitle = testType === 'shsat' 
            ? (practiceSet === 'diagnostic' ? 'SHSAT Diagnostic Test' : `SHSAT Practice Test ${practiceSet}`)
            : `SAT Practice Test ${practiceSet}`;
        document.getElementById('current-test-title').textContent = testTitle;
        document.getElementById('current-section').textContent = 'Practice Test';
        document.getElementById('total-questions').textContent = testQuestions.length;
        
        // Setup question grid
        setupQuestionGrid();
        
        // Load first question
        loadQuestion(0);
        
        // Start timer
        startTimer();
        
        // Hide loading and show test
        hideLoadingState();
        showSection('practice-test');
        
    } catch (error) {
        console.error('❌ Error starting test:', error);
        hideLoadingState();
        alert('Error loading test questions. Please try again later.');
    }
}

function setupQuestionGrid() {
    const grid = document.querySelector('.question-grid');
    grid.innerHTML = '';
    
    // Create dropdown instead of buttons
    const select = document.createElement('select');
    select.className = 'question-dropdown';
    select.addEventListener('change', (e) => {
        const selectedIndex = parseInt(e.target.value);
        if (!isNaN(selectedIndex)) {
            loadQuestion(selectedIndex);
        }
    });
    
    testQuestions.forEach((_, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Question ${index + 1}`;
        select.appendChild(option);
    });
    
    grid.appendChild(select);
}

function loadQuestion(index) {
    // Mark current question as visited (remove from skipped if user returns to answer)
    const previousIndex = currentQuestionIndex;
    const previousQuestion = testQuestions[previousIndex];
    
    // If moving to a new question and the previous one wasn't answered, mark it as skipped
    if (previousQuestion && userAnswers[previousQuestion.id] === undefined && previousIndex !== index) {
        skippedQuestions.add(previousQuestion.id);
    }
    
    currentQuestionIndex = index;
    const question = testQuestions[index];
    
    // Get the question container
    const questionContainer = document.querySelector('.question-container');
    
    // Check if question has a passage for split layout
    if (question.passage) {
        // Switch to split layout
        questionContainer.className = 'question-container split-layout';
        
        // Update question content with split layout
        questionContainer.innerHTML = `
            <div class="passage-side">
                <div class="passage-content">
                    ${renderPassageContent(question.passage)}
                </div>
            </div>
            <div class="question-side">
                <div class="question-header">
                    <span class="question-counter">Question ${index + 1} of ${testQuestions.length}</span>
                    <div class="question-status">
                        ${getQuestionStatus(question.id)}
                    </div>
                </div>
                <div class="question-text" id="question-text">${question.text.replace(/\n/g, '<br>')}</div>
                <div class="question-options" id="question-options">
                    <!-- Answer options will be loaded here -->
                </div>
                <div class="question-actions">
                    <button id="skip-question" class="btn btn-outline skip-btn">Skip Question</button>
                    <button id="clear-answer" class="btn btn-outline clear-btn" style="display: none;">Clear Answer</button>
                </div>
            </div>
        `;
    } else {
        // Use standard layout
        questionContainer.className = 'question-container standard-layout';
        
        // Update question content with standard layout
        questionContainer.innerHTML = `
            <div class="question-content">
                <div class="question-header">
                    <span class="question-counter">Question ${index + 1} of ${testQuestions.length}</span>
                    <div class="question-status">
                        ${getQuestionStatus(question.id)}
                    </div>
                </div>
                <div class="question-text" id="question-text">${question.text.replace(/\n/g, '<br>')}</div>
                <div class="question-options" id="question-options">
                    <!-- Answer options will be loaded here -->
                </div>
                <div class="question-actions">
                    <button id="skip-question" class="btn btn-outline skip-btn">Skip Question</button>
                    <button id="clear-answer" class="btn btn-outline clear-btn" style="display: none;">Clear Answer</button>
                </div>
            </div>
        `;
    }
    
    // Update current question counter in header
    document.getElementById('current-question').textContent = index + 1;
    
    // Populate options or input field based on question type
    const optionsContainer = document.getElementById('question-options');
    let hasSelectedAnswer = false;
    
    // Check if this is a fill-in-the-blank question
    if (question.answer_type === 'fill_in_the_blank') {
        // Create input field for fill-in-the-blank
        const inputDiv = document.createElement('div');
        inputDiv.className = 'fill-blank-container';
        
        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.className = 'fill-blank-input';
        inputField.placeholder = 'Enter your answer here...';
        inputField.id = 'fill-blank-answer';
        
        // Set previous answer if exists
        if (userAnswers[question.id] !== undefined) {
            inputField.value = userAnswers[question.id];
            hasSelectedAnswer = true;
        }
        
        // Add input handler
        inputField.addEventListener('input', function() {
            const answer = this.value.trim();
            
            if (answer) {
                // Save answer and remove from skipped
                userAnswers[question.id] = answer;
                skippedQuestions.delete(question.id);
            } else {
                // Remove answer if input is empty
                delete userAnswers[question.id];
                skippedQuestions.add(question.id);
            }
            
            // Update question grid and UI
            updateQuestionGrid();
            updateQuestionActions();
        });
        
        // Add blur handler to ensure final save
        inputField.addEventListener('blur', function() {
            const answer = this.value.trim();
            if (answer) {
                userAnswers[question.id] = answer;
                skippedQuestions.delete(question.id);
            }
            updateQuestionGrid();
            updateQuestionActions();
        });
        
        inputDiv.appendChild(inputField);
        optionsContainer.appendChild(inputDiv);
        
        // Focus the input field for better UX
        setTimeout(() => inputField.focus(), 100);
        
    } else {
        // Regular multiple choice options
        question.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'answer';
            radio.value = optionIndex;
            radio.id = `option-${optionIndex}`;
            
            // Check if this option was previously selected
            if (userAnswers[question.id] === optionIndex) {
                radio.checked = true;
                optionDiv.classList.add('selected');
                hasSelectedAnswer = true;
            }
            
            const label = document.createElement('label');
            label.htmlFor = `option-${optionIndex}`;
            label.className = 'option-text';
            label.textContent = option;
            
            optionDiv.appendChild(radio);
            optionDiv.appendChild(label);
            
            // Add click handler
            optionDiv.addEventListener('click', function() {
                // Remove previous selection
                optionsContainer.querySelectorAll('.option').forEach(opt => 
                    opt.classList.remove('selected')
                );
                
                // Select this option
                radio.checked = true;
                optionDiv.classList.add('selected');
                
                // Save answer and remove from skipped
                userAnswers[question.id] = optionIndex;
                skippedQuestions.delete(question.id);
                
                // Update question grid and UI
                updateQuestionGrid();
                updateQuestionActions();
                // updateTestSummary();
            });
            
            optionsContainer.appendChild(optionDiv);
        });
    }
    
    // Setup question action buttons
    setupQuestionActions();
    
    // Update question actions based on current state
    updateQuestionActions();
    
    // Update navigation buttons
    document.getElementById('prev-question').disabled = index === 0;
    document.getElementById('next-question').textContent = 
        index === testQuestions.length - 1 ? 'Finish Test' : 'Next';
    
    // Update question grid and summary
    updateQuestionGrid();
    // updateTestSummary();
}

function getQuestionStatus(questionId) {
    if (userAnswers[questionId] !== undefined) {
        return '<span class="status-answered">✓ Answered</span>';
    } else if (skippedQuestions.has(questionId)) {
        return '<span class="status-skipped">⚠ Skipped</span>';
    } else {
        return '<span class="status-unanswered">○ Unanswered</span>';
    }
}

function setupQuestionActions() {
    const skipBtn = document.getElementById('skip-question');
    const clearBtn = document.getElementById('clear-answer');
    
    if (skipBtn) {
        skipBtn.addEventListener('click', skipCurrentQuestion);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCurrentAnswer);
    }
}

function updateQuestionActions() {
    const skipBtn = document.getElementById('skip-question');
    const clearBtn = document.getElementById('clear-answer');
    const question = testQuestions[currentQuestionIndex];
    
    if (userAnswers[question.id] !== undefined) {
        if (skipBtn) skipBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
        if (skipBtn) skipBtn.style.display = 'inline-block';
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

function skipCurrentQuestion() {
    const question = testQuestions[currentQuestionIndex];
    skippedQuestions.add(question.id);
    
    // Remove any existing answer
    delete userAnswers[question.id];
    
    // Clear based on question type
    if (question.answer_type === 'fill_in_the_blank') {
        // Clear fill-in-the-blank input
        const inputField = document.getElementById('fill-blank-answer');
        if (inputField) {
            inputField.value = '';
        }
    } else {
        // Clear selected options for multiple choice
        document.querySelectorAll('.option').forEach(opt => 
            opt.classList.remove('selected')
        );
        document.querySelectorAll('input[name="answer"]').forEach(input => 
            input.checked = false
        );
    }
    
    updateQuestionGrid();
    updateQuestionActions();
    // updateTestSummary();
    
    // Move to next question if not the last one
    if (currentQuestionIndex < testQuestions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    }
}

function clearCurrentAnswer() {
    const question = testQuestions[currentQuestionIndex];
    
    // Remove answer and add to skipped
    delete userAnswers[question.id];
    skippedQuestions.add(question.id);
    
    // Clear based on question type
    if (question.answer_type === 'fill_in_the_blank') {
        // Clear fill-in-the-blank input
        const inputField = document.getElementById('fill-blank-answer');
        if (inputField) {
            inputField.value = '';
        }
    } else {
        // Clear selected options for multiple choice
        document.querySelectorAll('.option').forEach(opt => 
            opt.classList.remove('selected')
        );
        document.querySelectorAll('input[name="answer"]').forEach(input => 
            input.checked = false
        );
    }
    
    updateQuestionGrid();
    updateQuestionActions();
    // updateTestSummary();
}

function updateQuestionGrid() {
    const dropdown = document.querySelector('.question-dropdown');
    if (!dropdown) return;
    
    // Update dropdown value to current question
    dropdown.value = currentQuestionIndex;
    
    // Update option text and class for status (visual cues only, no text indicators)
    dropdown.querySelectorAll('option').forEach((option, index) => {
        const questionId = testQuestions[index].id;
        let statusClass = '';
        
        if (userAnswers[questionId] !== undefined) {
            statusClass = 'answered';
        } else if (skippedQuestions.has(questionId)) {
            statusClass = 'skipped';
        } else {
            statusClass = 'unanswered';
        }
        
        option.textContent = `Question ${index + 1}`;
        option.className = statusClass;
        
        if (index === currentQuestionIndex) {
            option.classList.add('current');
        }
    });
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
    }
}

function nextQuestion() {
    if (currentQuestionIndex < testQuestions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        // Show confirmation modal when finishing test
        showEndTestConfirmation();
    }
}

function startTimer() {
    const timerDisplay = document.getElementById('timer');
    let timeRemaining = timeLimit;
    
    testTimer = setInterval(() => {
        timeRemaining--;
        
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        timerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is low
        if (timeRemaining <= 300) { // 5 minutes
            timerDisplay.style.color = '#dc2626';
        }
        
        if (timeRemaining <= 0) {
            endTest();
        }
    }, 1000);
}

function showEndTestConfirmation() {
    // Get test summary for the confirmation
    const summary = getTestSummary();
    
    // Create custom confirmation modal
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal-overlay';
    modal.innerHTML = `
        <div class="confirmation-modal">
            <div class="modal-header">
                <h3>⚠️ Finish Test Confirmation</h3>
            </div>
            <div class="modal-body">
                <p><strong>Are you sure you want to finish and submit your test?</strong></p>
                <div class="test-summary-confirmation">
                    <div class="summary-row">
                        <span>✅ Answered:</span>
                        <span><strong>${summary.answered} questions</strong></span>
                    </div>
                    <div class="summary-row">
                        <span>⏭️ Skipped:</span>
                        <span><strong>${summary.skipped} questions</strong></span>
                    </div>
                    <div class="summary-row">
                        <span>❓ Unanswered:</span>
                        <span><strong>${summary.unanswered} questions</strong></span>
                    </div>
                    <div class="summary-row total">
                        <span>📝 Total:</span>
                        <span><strong>${summary.total} questions</strong></span>
                    </div>
                </div>
                ${summary.unanswered > 0 || summary.skipped > 0 ? 
                    `<div class="warning-message">
                        <strong>⚠️ Note:</strong> You still have ${summary.unanswered + summary.skipped} unanswered/skipped questions. 
                        You can continue working on them or submit now.
                    </div>` : 
                    `<div class="success-message">
                        <strong>✅ Great job!</strong> You've answered all questions!
                    </div>`
                }
                <p class="final-warning"><strong>Once submitted, you cannot change your answers.</strong></p>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" id="cancel-finish">
                    Continue Test
                </button>
                <button class="btn btn-danger" id="confirm-finish">
                    Submit Test
                </button>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('cancel-finish').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.getElementById('confirm-finish').addEventListener('click', () => {
        document.body.removeChild(modal);
        endTest();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

async function endTest() {
    // Stop timer
    if (testTimer) {
        clearInterval(testTimer);
        testTimer = null;
    }
    
    try {
        showLoadingState('Calculating results...');
        
        const answers = Object.entries(userAnswers).map(([questionId, selectedAnswer]) => ({
            questionId,
            selectedAnswer
        }));
        
        // Calculate time spent in seconds
        const timeSpent = Math.round((new Date() - testStartTime) / 1000);
        
        console.log(`📝 Submitting ${answers.length} answers`);
        
        const response = await QuestionsService.submitAnswers(
            currentTest,
            answers,
            timeSpent,
            currentPracticeSet
        );
        
        if (!response.success) {
            throw new Error('Failed to submit test results');
        }
        
        // Update test statistics
        await updateTestStats(
          currentTest, 
          response.data.results.percentage, 
          timeSpent, 
          response.data.results.categoryScores,
          response.data.results.shsatScores, // Pass SHSAT scores
          response.data.results.satScores // Pass SAT scores
        );
        
        // Display results
        displayResults(response.data);
        
        hideLoadingState();
        showSection('test-results');
        
    } catch (error) {
        console.error('❌ Error submitting test:', error);
        hideLoadingState();
        
        // Fallback: calculate results locally
        const localResults = calculateLocalResults();
        
        // Update test statistics with local results (no scaled scores available)
        const timeSpent = Math.round((new Date() - testStartTime) / 1000);
        await updateTestStats(currentTest, localResults.percentage, timeSpent, localResults.categoryScores);
        
        displayResults({ results: localResults });
        showSection('test-results');
        
        alert('There was an issue saving your results, but your score has been calculated.');
    }
}

function calculateLocalResults() {
    // Fallback calculation if API fails
    let correctCount = 0;
    const categoryScores = {};
    
    testQuestions.forEach(question => {
        const userAnswer = userAnswers[question.id];
        
        // We can't determine correctness without API, so just track attempts
        if (userAnswer !== undefined) {
            if (!categoryScores[question.category]) {
                categoryScores[question.category] = { correct: 0, total: 0 };
            }
            categoryScores[question.category].total++;
        }
    });
    
    const timeTaken = testStartTime ? new Date() - testStartTime : 0;
    
    return {
        correctCount: 0, // Can't calculate without correct answers
        totalQuestions: testQuestions.length,
        percentage: 0,
        timeTaken: Math.round(timeTaken),
        categoryScores
    };
}

function displayResults(resultData) {
    // Ensure we have a results object with the required properties
    const results = resultData.results || resultData;
    const detailedResults = resultData.detailedResults || [];
    
    // Update score display
    const finalScoreElement = document.querySelector('.score-percentage');
    if (finalScoreElement) {
        finalScoreElement.textContent = `${results.percentage}%`;
    }
    
    // Update SHSAT scores if available
    const shsatScoreContainer = document.getElementById('shsat-score-breakdown');
    if (results.shsatScores && shsatScoreContainer) {
      shsatScoreContainer.style.display = 'block';
      document.getElementById('shsat-total-score').textContent = results.shsatScores.totalScaledScore;
      document.getElementById('shsat-math-score').textContent = `Math: ${results.shsatScores.math.scaledScore} (${results.shsatScores.math.percentage}%)`;
      document.getElementById('shsat-english-score').textContent = `ELA: ${results.shsatScores.english.scaledScore} (${results.shsatScores.english.percentage}%)`;
    } else if (shsatScoreContainer) {
      shsatScoreContainer.style.display = 'none';
    }
    
    // Update SAT scores if available
    const satScoreContainer = document.getElementById('sat-score-breakdown');
    if (results.satScores && satScoreContainer) {
      satScoreContainer.style.display = 'block';
      document.getElementById('sat-total-score').textContent = results.satScores.totalScaledScore;
      document.getElementById('sat-math-score').textContent = `Math: ${results.satScores.math.scaledScore} (${results.satScores.math.percentage}%)`;
      document.getElementById('sat-rw-score').textContent = `R&W: ${results.satScores.reading_writing.scaledScore} (${results.satScores.reading_writing.percentage}%)`;
    } else if (satScoreContainer) {
      satScoreContainer.style.display = 'none';
    }
    
    const correctCountElement = document.querySelector('#correct-count');
    if (correctCountElement) {
        correctCountElement.textContent = `${results.correctCount}/${results.totalQuestions}`;
    }
    
    const timeTakenElement = document.querySelector('#time-taken');
    if (timeTakenElement) {
        timeTakenElement.textContent = formatTime(results.timeSpent);
    }
    
    // Update score color based on performance
    const scoreElement = document.querySelector('.score-percentage');
    if (scoreElement) {
        if (results.percentage >= 80) {
            scoreElement.className = 'score-percentage excellent';
        } else if (results.percentage >= 70) {
            scoreElement.className = 'score-percentage good';
        } else if (results.percentage >= 60) {
            scoreElement.className = 'score-percentage average';
        } else {
            scoreElement.className = 'score-percentage needs-improvement';
        }
    }
    
    // Display category breakdown if the element exists
    const topicScores = document.querySelector('#topic-scores');
    if (topicScores && results.categoryScores) {
        displayCategoryBreakdown(results.categoryScores);
    }
    
    // Display detailed review if the element exists
    const detailedReview = document.querySelector('#detailed-review');
    if (detailedReview && detailedResults.length > 0) {
        displayDetailedReview(detailedResults);
    }
}

function displayDetailedReview(detailedResults) {
    const reviewContainer = document.getElementById('detailed-review');
    if (!reviewContainer) return;
    
    reviewContainer.innerHTML = '';
    
    detailedResults.forEach((result, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = `review-item ${result.isCorrect ? 'correct' : 'incorrect'}`;
        
        const statusIcon = result.isCorrect ? '✅' : '❌';
        const statusText = result.isCorrect ? 'Correct' : 'Incorrect';
        
        // Include passage if it exists
        const passageHtml = result.passage ? `
            <div class="review-passage">
                <div class="passage-text">${result.passage.replace(/\n/g, '<br>')}</div>
            </div>
        ` : '';
        
        // Handle different question types for review display
        let answersHtml = '';
        if (result.answer_type === 'fill_in_the_blank') {
            // Display fill-in-the-blank answers
            answersHtml = `
                <div class="review-answers">
                    <p><strong>Your Answer:</strong> <span class="${result.isCorrect ? 'user-correct-answer' : 'user-wrong-answer'}">${result.userAnswer || 'No answer provided'}</span></p>
                    <p><strong>Correct Answer:</strong> <span class="correct-answer">${result.correct_answer || 'Not available'}</span></p>
                </div>
            `;
        } else {
            // Display multiple choice options
            answersHtml = `
                <div class="review-options">
                    ${result.options.map((option, optIndex) => {
                        let className = 'option';
                        if (optIndex === result.correct_answer) {
                            className += ' correct-answer';
                        }
                        if (optIndex === result.userAnswer && !result.isCorrect) {
                            className += ' user-wrong-answer';
                        }
                        if (optIndex === result.userAnswer && result.isCorrect) {
                            className += ' user-correct-answer';
                        }
                        
                        return `<div class="${className}">${String.fromCharCode(65 + optIndex)}. ${option}</div>`;
                    }).join('')}
                </div>
            `;
        }

        reviewItem.innerHTML = `
            <div class="review-header">
                <span class="question-num">Question ${index + 1}</span>
                <span class="status ${result.isCorrect ? 'correct' : 'incorrect'}">
                    ${statusIcon} ${statusText}
                </span>
            </div>
            ${passageHtml}
            <div class="review-question">
                <p><strong>Question:</strong> ${result.question_text}</p>
            </div>
            ${answersHtml}
            ${result.explanation ? `
                <div class="review-explanation">
                    <p><strong>Explanation:</strong> ${result.explanation}</p>
                </div>
            ` : ''}
        `;
        
        reviewContainer.appendChild(reviewItem);
    });
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
    
    // Add fade-in animation
    document.getElementById(sectionId).classList.add('fade-in');
}

// Utility Functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Handle browser navigation
window.addEventListener('beforeunload', function(e) {
    if (testTimer) {
        e.preventDefault();
        e.returnValue = 'You have an active test. Are you sure you want to leave?';
    }
});

// Prevent back button during test
window.addEventListener('popstate', function(e) {
    if (testTimer) {
        e.preventDefault();
        history.pushState(null, null, location.href);
        alert('Please finish your test before navigating away.');
    }
});

// Loading state functions
function showLoadingState(message = 'Loading...') {
    // Remove existing loading if any
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

// Database seeding function
async function seedDatabaseWithQuestions() {
    try {
        showLoadingState('Setting up questions database...');
        
        console.log('🌱 Seeding database with sample questions...');
        const response = await QuestionsService.seedQuestions();
        
        if (response.success) {
            console.log(`✅ Successfully seeded ${response.data.count} questions`);
            alert(`Database seeded with ${response.data.count} sample questions!`);
        } else {
            throw new Error('Failed to seed database');
        }
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        alert('Error setting up questions database. Please try again later.');
    } finally {
        hideLoadingState();
    }
}

function displayCategoryBreakdown(categoryScores) {
    const topicScores = document.getElementById('topic-scores');
    if (!topicScores) return;
    
    topicScores.innerHTML = '';
    
    Object.entries(categoryScores).forEach(([category, scores]) => {
        const percentage = Math.round((scores.correct / scores.total) * 100);
        
        const topicDiv = document.createElement('div');
        topicDiv.className = 'topic-score';
        topicDiv.innerHTML = `
            <span class="topic-name">${category}</span>
            <span class="topic-percentage">${percentage}%</span>
        `;
        topicScores.appendChild(topicDiv);
    });
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to render passage content - supports both text and images
function renderPassageContent(passage) {
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

// Add navigation helper functions
function jumpToNextUnanswered() {
    for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];
        if (userAnswers[question.id] === undefined && !skippedQuestions.has(question.id)) {
            loadQuestion(i);
            return;
        }
    }
    
    // If no unanswered questions, jump to first skipped question
    for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];
        if (skippedQuestions.has(question.id)) {
            loadQuestion(i);
            return;
        }
    }
    
    alert('All questions have been answered or skipped!');
}

function getTestSummary() {
    const answered = Object.keys(userAnswers).length;
    const skipped = skippedQuestions.size;
    const unanswered = testQuestions.length - answered - skipped;
    
    return { answered, skipped, unanswered, total: testQuestions.length };
}

// Add new function to update test summary
function updateTestSummary() {
    const summary = getTestSummary();
    // Update or create summary panel at the top
    /*
    let summaryPanel = document.querySelector('.test-summary');
    if (!summaryPanel) {
        summaryPanel = document.createElement('div');
        summaryPanel.className = 'test-summary';
        
        // Insert after test-header but before question-container
        const testHeader = document.querySelector('.test-header');
        const questionContainer = document.querySelector('.question-container');
        if (testHeader && questionContainer) {
            questionContainer.parentNode.insertBefore(summaryPanel, questionContainer);
        }
    }
    
    summaryPanel.innerHTML = `
        <div class="summary-header">
            <h4>Progress Summary</h4>
        </div>
        <div class="summary-stats">
            <div class="stat-item answered">
                <span class="stat-number">${summary.answered}</span>
                <span class="stat-label">Answered</span>
            </div>
            <div class="stat-item skipped">
                <span class="stat-number">${summary.skipped}</span>
                <span class="stat-label">Skipped</span>
            </div>
            <div class="stat-item unanswered">
                <span class="stat-number">${summary.unanswered}</span>
                <span class="stat-label">Unanswered</span>
            </div>
        </div>
        <div class="summary-actions">
            <button id="jump-to-unanswered" class="btn btn-sm btn-outline" ${summary.unanswered === 0 && summary.skipped === 0 ? 'disabled' : ''}>
                ${summary.unanswered > 0 ? 'Next Unanswered' : summary.skipped > 0 ? 'Next Skipped' : 'All Complete'}
            </button>
            <button id="review-skipped" class="btn btn-sm btn-outline" ${summary.skipped === 0 ? 'disabled' : ''}>
                Review Skipped (${summary.skipped})
            </button>
        </div>
    `;
    */
    
    // Add event listeners for new buttons
    const jumpBtn = document.getElementById('jump-to-unanswered');
    const reviewBtn = document.getElementById('review-skipped');
    
    if (jumpBtn && !jumpBtn.disabled) {
        jumpBtn.addEventListener('click', jumpToNextUnanswered);
    }
    
    if (reviewBtn && !reviewBtn.disabled) {
        reviewBtn.addEventListener('click', jumpToFirstSkipped);
    }
}

// UI components
const testSelectionSection = document.getElementById('test-selection');

function injectTestStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .question-nav-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
        }
        .question-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            justify-content: center;
        }
        .question-number {
            width: 30px;
            height: 30px;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
            position: relative;
        }
        .question-number.answered {
            background-color: #c8e6c9;
            border-color: #4caf50;
        }
        .question-number.answered::before {
            content: '●';
            position: absolute;
            top: -5px;
            right: -5px;
            font-size: 12px;
            color: #4caf50;
        }
        .question-number.current {
            border-color: #2196f3;
            font-weight: bold;
        }
        .progress-summary-panel {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        .progress-summary-panel .summary-stats {
            display: flex;
            justify-content: space-around;
            margin-bottom: 1rem;
        }
        .stat-item {
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            flex-grow: 1;
            margin: 0 5px;
        }
        .stat-item .stat-number {
            font-size: 1.5rem;
            font-weight: bold;
        }
        .stat-item.answered { background-color: #e7f5e7; border: 1px solid #c8e6c9; }
        .stat-item.skipped { background-color: #fffde7; border: 1px solid #fff59d; }
        .stat-item.unanswered { background-color: #f5f5f5; border: 1px solid #e0e0e0; }
        .summary-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
        }
    `;
    document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
    updateUIStats();
    injectTestStyles();
});

function renderQuestionNavigation() {
    const grid = document.querySelector('.question-grid');
    if (!grid) return;
    grid.innerHTML = ''; // Clear existing grid buttons

    const navWrapper = document.createElement('div');
    navWrapper.className = 'question-nav-container';

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-arrow';
    prevBtn.innerHTML = '←';
    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            loadQuestion(currentQuestionIndex - 1);
        }
    });

    // Dropdown
    const select = document.createElement('select');
    select.className = 'question-dropdown';
    select.addEventListener('change', (e) => {
        const selectedIndex = parseInt(e.target.value, 10);
        if (!isNaN(selectedIndex)) {
            loadQuestion(selectedIndex);
        }
    });

    testQuestions.forEach((_, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Question ${index + 1}`;
        select.appendChild(option);
    });

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-arrow';
    nextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < testQuestions.length - 1) {
            loadQuestion(currentQuestionIndex + 1);
        } else {
            showEndTestConfirmation();
        }
    });

    navWrapper.appendChild(prevBtn);
    navWrapper.appendChild(select);
    navWrapper.appendChild(nextBtn);
    grid.appendChild(navWrapper);
}

function updateQuestionNavigation() {
    const prevBtn = document.querySelector('.question-nav-container .nav-arrow:first-child');
    const nextBtn = document.querySelector('.question-nav-container .nav-arrow:last-child');
    const dropdown = document.querySelector('.question-dropdown');

    if (!prevBtn || !nextBtn || !dropdown) return;

    // Update buttons state
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.innerHTML = currentQuestionIndex === testQuestions.length - 1 ? '✓' : '→';
    
    // Update dropdown
    dropdown.value = currentQuestionIndex;

    // Update option styles
    dropdown.querySelectorAll('option').forEach((option, index) => {
        option.className = ''; // Reset classes
        const questionId = testQuestions[index].id;
        
        if (userAnswers[questionId] !== undefined) {
            option.classList.add('answered');
        } else if (skippedQuestions.has(questionId)) {
            option.classList.add('skipped');
        } else {
            option.classList.add('unanswered');
        }
    });
}

function updateSummaryPanel() {
    const summary = getTestSummary();
    /*
    // Update or create summary panel in navigation
    let summaryPanel = document.querySelector('.test-summary');
    if (!summaryPanel) {
        summaryPanel = document.createElement('div');
        summaryPanel.className = 'test-summary';
        
        const navigationSection = document.querySelector('.test-navigation');
        if (navigationSection) {
            navigationSection.appendChild(summaryPanel);
        }
    }
    
    summaryPanel.innerHTML = `
        <div class="summary-header">
            <h4>Progress Summary</h4>
        </div>
        <div class="summary-stats">
            <div class="stat-item answered">
                <span class="stat-number">${summary.answered}</span>
                <span class="stat-label">Answered</span>
            </div>
            <div class="stat-item skipped">
                <span class="stat-number">${summary.skipped}</span>
                <span class="stat-label">Skipped</span>
            </div>
            <div class="stat-item unanswered">
                <span class="stat-number">${summary.unanswered}</span>
                <span class="stat-label">Unanswered</span>
            </div>
        </div>
        <div class="summary-actions">
            <button id="jump-to-unanswered" class="btn btn-sm btn-outline" ${summary.unanswered === 0 && summary.skipped === 0 ? 'disabled' : ''}>
                ${summary.unanswered > 0 ? 'Next Unanswered' : summary.skipped > 0 ? 'Next Skipped' : 'All Complete'}
            </button>
            <button id="review-skipped" class="btn btn-sm btn-outline" ${summary.skipped === 0 ? 'disabled' : ''}>
                Review Skipped (${summary.skipped})
            </button>
        </div>
    `;
    */
    // Add event listeners for new buttons
    const jumpBtn = document.getElementById('jump-to-unanswered');
    const reviewBtn = document.getElementById('review-skipped');
    
    if (jumpBtn && !jumpBtn.disabled) {
        jumpBtn.addEventListener('click', jumpToNextUnanswered);
    }
    
    if (reviewBtn && !reviewBtn.disabled) {
        reviewBtn.addEventListener('click', jumpToFirstSkipped);
    }
}

// Scroll Lock Utility
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
        let isScrolling = false;
        
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
        const scrollableElements = document.querySelectorAll('.passage-side, .question-container, .detailed-review');
        
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

// Initialize scroll lock
const scrollLock = new ScrollLock();

function showTestCodeModal(testType, practiceSet) {
    const modal = document.getElementById('test-code-modal');
    const closeButton = modal.querySelector('.close-button');
    const submitButton = modal.querySelector('#submit-test-code');
    const codeInput = modal.querySelector('#test-code-input');
    const errorMessage = modal.querySelector('#test-code-error');

    modal.style.display = 'flex';
    errorMessage.style.display = 'none';
    codeInput.value = '';

    const clickEventHandler = async () => {
        const testCode = codeInput.value;
        if (testCode.length !== 3) {
            errorMessage.textContent = 'Please enter a 3-digit code.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            const response = await QuestionsService.validateTestCode(testCode);
            if (response.success) {
                modal.style.display = 'none';
                startTest(testType, practiceSet);
            } else {
                errorMessage.textContent = response.message || 'Invalid code.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            errorMessage.textContent = 'Error validating code. Please try again.';
            errorMessage.style.display = 'block';
        }
    };

    submitButton.onclick = clickEventHandler;
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}