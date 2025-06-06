// Translation data for login page
import { API_BASE_URL } from './config.js';

const loginTranslations = {
    en: {
        // Welcome Section
        welcome_title: "Welcome to AI Plus Education",
        welcome_subtitle: "Join thousands of students who have improved their test scores with our comprehensive practice tests.",
        feature_personalized: "Personalized practice tests",
        feature_tracking: "Detailed progress tracking",
        feature_results: "Proven score improvements",
        back_to_home: "← Back to Home",
        
        // Login Form
        login_title: "Sign In",
        login_subtitle: "Welcome back! Please sign in to your account.",
        
        // Signup Form
        signup_title: "Create Account",
        signup_subtitle: "Join AI Plus Education and start improving your test scores today!",
        
        // Form Fields
        form_email: "Email Address",
        form_password: "Password",
        form_confirm_password: "Confirm Password",
        form_firstname: "First Name",
        form_lastname: "Last Name",
        form_grade: "Grade Level",
        
        // Grade Options
        grade_6: "6th Grade",
        grade_7: "7th Grade",
        grade_8: "8th Grade",
        grade_9: "9th Grade",
        grade_10: "10th Grade",
        grade_11: "11th Grade",
        grade_12: "12th Grade",
        
        // Form Options
        remember_me: "Remember me",
        forgot_password: "Forgot password?",
        agree_terms: "I agree to the <a href='#' class='terms-link'>Terms of Service</a> and <a href='#' class='privacy-link'>Privacy Policy</a>",
        
        // Forgot Password
        forgot_password_title: "Reset Password",
        forgot_password_subtitle: "Enter your email address and we'll send you a link to reset your password.",
        reset_password_title: "Set New Password",
        reset_password_subtitle: "Enter your new password below.",
        form_new_password: "New Password",
        
        // Buttons
        btn_sign_in: "Sign In",
        btn_sign_up: "Sign Up",
        btn_create_account: "Create Account",
        btn_send_reset: "Send Reset Link",
        btn_reset_password: "Reset Password",
        btn_back_to_login: "← Back to Sign In",
        
        // Form Switch
        no_account: "Don't have an account?",
        have_account: "Already have an account?",
        
        // Validation Messages
        validation_required: "This field is required.",
        validation_email: "Please enter a valid email address.",
        validation_password_match: "Passwords do not match.",
        validation_password_length: "Password must be at least 8 characters long.",
        validation_terms: "You must agree to the Terms of Service and Privacy Policy.",
        
        // Success Messages
        login_success: "Login successful! Redirecting...",
        signup_success: "Account created successfully! Please sign in.",
        forgot_password_success: "If an account with that email exists, a password reset link has been sent.",
        reset_password_success: "Password reset successfully! Please sign in with your new password.",
        form_processing: "Processing...",
        
        // Error Messages
        network_error: "Network error. Please check your connection and try again.",
        server_error: "Server error. Please try again later.",
        account_locked: "Account is temporarily locked. Please try again later.",
        invalid_credentials: "Invalid email or password.",
        invalid_reset_token: "Invalid or expired reset token. Please request a new password reset.",
        reset_token_expired: "Reset token has expired. Please request a new password reset."
    },
    zh: {
        // Welcome Section
        welcome_title: "欢迎来到AI Plus教育",
        welcome_subtitle: "加入数千名通过我们全面的练习测试提高考试成绩的学生。",
        feature_personalized: "个性化练习测试",
        feature_tracking: "详细进度跟踪",
        feature_results: "证实的成绩提升",
        back_to_home: "← 返回首页",
        
        // Login Form
        login_title: "登录",
        login_subtitle: "欢迎回来！请登录您的账户。",
        
        // Signup Form
        signup_title: "创建账户",
        signup_subtitle: "加入AI Plus教育，今天开始提高您的考试成绩！",
        
        // Form Fields
        form_email: "电子邮件地址",
        form_password: "密码",
        form_confirm_password: "确认密码",
        form_firstname: "名字",
        form_lastname: "姓氏",
        form_grade: "年级水平",
        
        // Grade Options
        grade_6: "6年级",
        grade_7: "7年级",
        grade_8: "8年级",
        grade_9: "9年级",
        grade_10: "10年级",
        grade_11: "11年级",
        grade_12: "12年级",
        
        // Form Options
        remember_me: "记住我",
        forgot_password: "忘记密码？",
        agree_terms: "我同意<a href='#' class='terms-link'>服务条款</a>和<a href='#' class='privacy-link'>隐私政策</a>",
        
        // Forgot Password
        forgot_password_title: "重置密码",
        forgot_password_subtitle: "输入您的电子邮件地址，我们将向您发送重置密码的链接。",
        reset_password_title: "设置新密码",
        reset_password_subtitle: "在下方输入您的新密码。",
        form_new_password: "新密码",
        
        // Buttons
        btn_sign_in: "登录",
        btn_sign_up: "注册",
        btn_create_account: "创建账户",
        btn_send_reset: "发送重置链接",
        btn_reset_password: "重置密码",
        btn_back_to_login: "← 返回登录",
        
        // Form Switch
        no_account: "没有账户？",
        have_account: "已有账户？",
        
        // Validation Messages
        validation_required: "此字段是必需的。",
        validation_email: "请输入有效的电子邮件地址。",
        validation_password_match: "密码不匹配。",
        validation_password_length: "密码必须至少8个字符长。",
        validation_terms: "您必须同意服务条款和隐私政策。",
        
        // Success Messages
        login_success: "登录成功！正在重定向...",
        signup_success: "账户创建成功！请登录。",
        forgot_password_success: "如果该邮箱存在账户，密码重置链接已发送。",
        reset_password_success: "密码重置成功！请使用新密码登录。",
        form_processing: "正在处理...",
        
        // Error Messages
        network_error: "网络错误。请检查您的连接并重试。",
        server_error: "服务器错误。请稍后重试。",
        account_locked: "账户暂时锁定。请稍后重试。",
        invalid_credentials: "无效的邮箱或密码。",
        invalid_reset_token: "无效或过期的重置令牌。请重新请求密码重置。",
        reset_token_expired: "重置令牌已过期。请重新请求密码重置。"
    }
};

// Current language state
let currentLanguage = 'en';

// DOM elements
const languageToggle = document.getElementById('language-toggle');
const languageDropdown = document.getElementById('language-dropdown');
const currentLangSpan = document.getElementById('current-lang');

// Authentication utilities
class AuthService {
    static async makeRequest(url, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
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
                // If validation failed, create a detailed error message
                if (data.errors && Array.isArray(data.errors)) {
                    const errorMessages = data.errors.map(err => err.msg || err.message).join(', ');
                    throw new Error(errorMessages);
                }
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            if (error instanceof TypeError) {
                throw new Error('Network error. Please check your connection.');
            }
            if (error.message.includes('Too many')) {
                throw new Error('Too many attempts. Please wait a few minutes and try again.');
            }
            throw error;
        }
    }

    static async login(email, password) {
        return this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    static async signup(userData) {
        return this.makeRequest('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    static async checkEmailAvailability(email) {
        try {
            return await this.makeRequest(`/auth/check-email/${encodeURIComponent(email)}`);
        } catch (error) {
            return { available: true }; // Assume available if check fails
        }
    }

    static async forgotPassword(email) {
        return this.makeRequest('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    static async resetPassword(token, password, confirmPassword) {
        return this.makeRequest('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password, confirmPassword })
        });
    }

    static setToken(token) {
        localStorage.setItem('authToken', token);
    }

    static getToken() {
        return localStorage.getItem('authToken');
    }

    static removeToken() {
        localStorage.removeItem('authToken');
    }

    static setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static isAuthenticated() {
        return !!this.getToken();
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('preferredLanguage') || 'en';
    changeLanguage(savedLanguage);
    
    // Language dropdown toggle
    languageToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        languageDropdown.classList.toggle('active');
    });
    
    // Language dropdown buttons
    const languageButtons = languageDropdown.querySelectorAll('button[data-lang]');
    languageButtons.forEach(button => {
        button.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            changeLanguage(lang);
        });
    });
    
    // Home link
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
        homeLink.style.cursor = 'pointer';
    }
    
    // Password toggle buttons
    const passwordToggles = document.querySelectorAll('.password-toggle[data-target]');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            togglePassword(targetId);
        });
    });
    
    // Form switch buttons
    const switchToSignupBtn = document.getElementById('switch-to-signup');
    const switchToLoginBtn = document.getElementById('switch-to-login');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginBtn = document.getElementById('back-to-login');
    const backToLoginFromResetBtn = document.getElementById('back-to-login-from-reset');
    
    if (switchToSignupBtn) {
        switchToSignupBtn.addEventListener('click', switchToSignup);
    }
    
    if (switchToLoginBtn) {
        switchToLoginBtn.addEventListener('click', switchToLogin);
    }
    
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            switchToForgotPassword();
        });
    }
    
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', switchToLogin);
    }
    
    if (backToLoginFromResetBtn) {
        backToLoginFromResetBtn.addEventListener('click', switchToLogin);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        languageDropdown.classList.remove('active');
    });
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup real-time email validation
    setupEmailValidation();
    
    // Check if there's a reset token in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
        // Switch to reset password form
        setTimeout(() => {
            switchToResetPassword();
        }, 500);
    }
});

// Language change function
function changeLanguage(lang) {
    currentLanguage = lang;
    setLanguage(lang);
    languageDropdown.classList.remove('active');
    
    // Update language display
    currentLangSpan.textContent = lang.toUpperCase();
    
    // Store preference in localStorage
    localStorage.setItem('preferredLanguage', lang);
}

// Set language function
function setLanguage(lang) {
    const elements = document.querySelectorAll('[data-translate]');
    
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        if (loginTranslations[lang] && loginTranslations[lang][key]) {
            // Handle elements with HTML content (like terms agreement)
            if (key === 'agree_terms') {
                element.innerHTML = loginTranslations[lang][key];
            } else {
                element.textContent = loginTranslations[lang][key];
            }
        }
    });
    
    // Update grade level options
    updateGradeOptions(lang);
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
}

// Update grade level options
function updateGradeOptions(lang) {
    const gradeSelect = document.getElementById('grade-level');
    const options = gradeSelect.querySelectorAll('option[data-translate]');
    
    options.forEach(option => {
        const key = option.getAttribute('data-translate');
        if (loginTranslations[lang] && loginTranslations[lang][key]) {
            option.textContent = loginTranslations[lang][key];
        }
    });
}

// Get translation helper function
function getTranslation(key) {
    if (loginTranslations[currentLanguage] && loginTranslations[currentLanguage][key]) {
        return loginTranslations[currentLanguage][key];
    }
    if (loginTranslations['en'] && loginTranslations['en'][key]) {
        return loginTranslations['en'][key];
    }
    return key;
}

// Form switching functions
function switchToSignup() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    loginForm.classList.remove('active');
    setTimeout(() => {
        signupForm.classList.add('active');
    }, 200);
}

function switchToLogin() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    
    signupForm.classList.remove('active');
    forgotPasswordForm.classList.remove('active');
    resetPasswordForm.classList.remove('active');
    setTimeout(() => {
        loginForm.classList.add('active');
    }, 200);
}

function switchToForgotPassword() {
    const loginForm = document.getElementById('login-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    
    loginForm.classList.remove('active');
    setTimeout(() => {
        forgotPasswordForm.classList.add('active');
    }, 200);
}

function switchToResetPassword() {
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    
    forgotPasswordForm.classList.remove('active');
    setTimeout(() => {
        resetPasswordForm.classList.add('active');
    }, 200);
}

// Password visibility toggle
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.parentNode.querySelector('.password-toggle');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.innerHTML = '<span class="eye-icon">🙈</span>';
    } else {
        input.type = 'password';
        toggle.innerHTML = '<span class="eye-icon">👁️</span>';
    }
}

// Form validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

function showFormMessage(form, message, type) {
    // Remove existing message
    const existingMessage = form.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `form-message form-message-${type}`;
    messageDiv.textContent = message;
    
    // Insert before submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    form.insertBefore(messageDiv, submitBtn);
    
    // Auto-remove after 5 seconds for error messages
    if (type === 'error') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Setup email validation
function setupEmailValidation() {
    const signupEmail = document.getElementById('signup-email');
    
    if (signupEmail) {
        let emailCheckTimeout;
        
        signupEmail.addEventListener('input', function() {
            clearTimeout(emailCheckTimeout);
            const email = this.value.trim();
            
            if (email && validateEmail(email)) {
                emailCheckTimeout = setTimeout(async () => {
                    try {
                        const result = await AuthService.checkEmailAvailability(email);
                        if (!result.available) {
                            this.style.borderColor = '#ef4444';
                            // Show a subtle indicator that email is taken
                            let indicator = this.parentNode.querySelector('.email-indicator');
                            if (!indicator) {
                                indicator = document.createElement('small');
                                indicator.className = 'email-indicator';
                                indicator.style.color = '#ef4444';
                                indicator.style.fontSize = '0.75rem';
                                this.parentNode.appendChild(indicator);
                            }
                            indicator.textContent = 'Email is already taken';
                        } else {
                            this.style.borderColor = '#10b981';
                            const indicator = this.parentNode.querySelector('.email-indicator');
                            if (indicator) {
                                indicator.remove();
                            }
                        }
                    } catch (error) {
                        // Silently fail email check
                        console.log('Email check failed:', error);
                    }
                }, 500);
            }
        });
    }
}

// Setup form handlers
function setupFormHandlers() {
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        // Validation
        if (!email || !password) {
            showFormMessage(this, getTranslation('validation_required'), 'error');
            return;
        }
        
        if (!validateEmail(email)) {
            showFormMessage(this, getTranslation('validation_email'), 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = getTranslation('form_processing');
        
        try {
            const response = await AuthService.login(email, password);
            
            // Store authentication data
            AuthService.setToken(response.data.token);
            AuthService.setUser(response.data.user);
            
            // Show success message
            showFormMessage(this, getTranslation('login_success'), 'success');
            
            // Redirect to dashboard or home page
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = getTranslation('server_error');
            
            if (error.message.includes('locked')) {
                errorMessage = getTranslation('account_locked');
            } else if (error.message.includes('Invalid') || error.message.includes('password')) {
                errorMessage = getTranslation('invalid_credentials');
            } else if (error.name === 'TypeError' || error.message.includes('fetch')) {
                errorMessage = getTranslation('network_error');
            }
            
            showFormMessage(this, errorMessage, 'error');
            
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
    
    // Signup form handler
    const signupForm = document.getElementById('signupForm');
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('signup-firstname').value.trim();
        const lastName = document.getElementById('signup-lastname').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const grade = document.getElementById('grade-level').value;
        const termsAgreed = document.getElementById('terms-agreement').checked;
        
        // Validation
        if (!firstName || !lastName || !email || !password || !confirmPassword || !grade) {
            showFormMessage(this, getTranslation('validation_required'), 'error');
            return;
        }
        
        if (!validateEmail(email)) {
            showFormMessage(this, getTranslation('validation_email'), 'error');
            return;
        }
        
        if (!validatePassword(password)) {
            showFormMessage(this, getTranslation('validation_password_length'), 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showFormMessage(this, getTranslation('validation_password_match'), 'error');
            return;
        }
        
        if (!termsAgreed) {
            showFormMessage(this, getTranslation('validation_terms'), 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = getTranslation('form_processing');
        
        try {
            const userData = {
                firstName,
                lastName,
                email,
                password,
                confirmPassword,
                grade
            };
            
            console.log('📝 Sending signup data:', userData);
            
            const response = await AuthService.signup(userData);
            
            // Store authentication data
            AuthService.setToken(response.data.token);
            AuthService.setUser(response.data.user);
            
            // Show success message
            showFormMessage(this, getTranslation('signup_success'), 'success');
            
            // Redirect to dashboard directly
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } catch (error) {
            console.error('Signup error:', error);
            
            let errorMessage = getTranslation('server_error');
            
            if (error.message.includes('exists') || error.message.includes('already')) {
                errorMessage = 'An account with this email already exists';
            } else if (error.name === 'TypeError' || error.message.includes('fetch')) {
                errorMessage = getTranslation('network_error');
            }
            
            showFormMessage(this, errorMessage, 'error');
            
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
    
    // Forgot Password form handler
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value.trim();
        
        // Validation
        if (!email) {
            showFormMessage(this, getTranslation('validation_required'), 'error');
            return;
        }
        
        if (!validateEmail(email)) {
            showFormMessage(this, getTranslation('validation_email'), 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = getTranslation('form_processing');
        
        try {
            await AuthService.forgotPassword(email);
            
            // Show success message
            showFormMessage(this, getTranslation('forgot_password_success'), 'success');
            
            // Reset form and switch back to login after delay
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                this.reset();
                switchToLogin();
            }, 3000);
            
        } catch (error) {
            console.error('Forgot password error:', error);
            
            let errorMessage = getTranslation('server_error');
            
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                errorMessage = getTranslation('network_error');
            }
            
            showFormMessage(this, errorMessage, 'error');
            
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
    
    // Reset Password form handler
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    resetPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;
        
        // Get token from URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
            showFormMessage(this, getTranslation('invalid_reset_token'), 'error');
            return;
        }
        
        // Validation
        if (!password || !confirmPassword) {
            showFormMessage(this, getTranslation('validation_required'), 'error');
            return;
        }
        
        if (!validatePassword(password)) {
            showFormMessage(this, getTranslation('validation_password_length'), 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showFormMessage(this, getTranslation('validation_password_match'), 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = getTranslation('form_processing');
        
        try {
            await AuthService.resetPassword(token, password, confirmPassword);
            
            // Show success message
            showFormMessage(this, getTranslation('reset_password_success'), 'success');
            
            // Clear URL parameters and switch to login
            setTimeout(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                this.reset();
                switchToLogin();
            }, 2000);
            
        } catch (error) {
            console.error('Reset password error:', error);
            
            let errorMessage = getTranslation('server_error');
            
            if (error.message.includes('expired') || error.message.includes('invalid')) {
                errorMessage = getTranslation('invalid_reset_token');
            } else if (error.name === 'TypeError' || error.message.includes('fetch')) {
                errorMessage = getTranslation('network_error');
            }
            
            showFormMessage(this, errorMessage, 'error');
            
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Real-time password confirmation validation
document.addEventListener('DOMContentLoaded', function() {
    const confirmPassword = document.getElementById('confirm-password');
    const password = document.getElementById('signup-password');
    
    if (confirmPassword && password) {
        confirmPassword.addEventListener('input', function() {
            if (this.value && password.value && this.value !== password.value) {
                this.style.borderColor = '#ef4444';
            } else {
                this.style.borderColor = '#e5e7eb';
            }
        });
    }
}); 