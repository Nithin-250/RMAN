// Global variables
let currentUser = null;
let currentTransaction = null;

// API Base URL - Update this to match your backend
const API_BASE_URL = 'http://localhost:8000';

// DOM Elements
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const smsModal = document.getElementById('smsModal');
const dashboard = document.getElementById('dashboard');
const home = document.getElementById('home');
const features = document.getElementById('features');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }

    // Set up form event listeners
    setupEventListeners();
});

// Set up all event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Signup form
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    
    // Transaction form
    document.getElementById('transactionForm').addEventListener('submit', handleTransaction);
    
    // SMS verification form
    document.getElementById('smsForm').addEventListener('submit', handleSMSVerification);
    
    // Modal close events
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Authentication Functions
async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const loginData = {
        account: formData.get('account'),
        password: formData.get('password')
    };

    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            currentUser = result.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            closeModal('loginModal');
            showDashboard();
            showNotification('Login successful!', 'success');
        } else {
            showNotification(result.message || 'Invalid credentials', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const signupData = {
        name: formData.get('name'),
        account: formData.get('account'),
        phone: formData.get('phone'),
        password: formData.get('password'),
        pin: formData.get('pin')
    };

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(signupData.pin)) {
        showNotification('Security PIN must be exactly 4 digits', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(signupData)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('Account created successfully! Please login.', 'success');
            closeModal('signupModal');
            showLogin();
        } else {
            showNotification(result.message || 'Signup failed', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showNotification('Signup failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Transaction Functions
async function handleTransaction(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showNotification('Please login first', 'error');
        return;
    }

    const formData = new FormData(event.target);
    
    // Convert datetime-local to the required format
    const timestampValue = formData.get('timestamp');
    const formattedTimestamp = new Date(timestampValue).toISOString().slice(0, 19).replace('T', ' ');
    
    const transactionData = {
        transaction_id: formData.get('transaction_id'),
        timestamp: formattedTimestamp,
        amount: parseFloat(formData.get('amount')),
        location: formData.get('location'),
        card_type: formData.get('card_type'),
        currency: formData.get('currency'),
        recipient_account: formData.get('recipient_account')
    };

    // Store current transaction for potential SMS verification
    currentTransaction = transactionData;

    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/check_fraud`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.account}` // Simple auth header
            },
            body: JSON.stringify(transactionData)
        });

        const result = await response.json();
        
        if (response.ok) {
            displayTransactionResult(result, transactionData);
            
            // If fraud detected, show SMS verification
            if (result.fraud) {
                setTimeout(() => {
                    showSMSVerification();
                }, 1000);
            } else {
                showNotification('Transaction processed successfully!', 'success');
            }
        } else {
            showNotification('Transaction processing failed', 'error');
        }
    } catch (error) {
        console.error('Transaction error:', error);
        showNotification('Transaction failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// SMS Verification Functions
async function handleSMSVerification(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const enteredPin = formData.get('pin');

    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/verify_pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.account}`
            },
            body: JSON.stringify({
                account: currentUser.account,
                pin: enteredPin,
                transaction: currentTransaction
            })
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            closeModal('smsModal');
            showNotification('PIN verified! Transaction approved.', 'success');
            
            // Update transaction result to show approved
            updateTransactionStatus('approved');
        } else {
            showNotification(result.message || 'Invalid PIN. Transaction blocked.', 'error');
            
            // If PIN is wrong, blacklist the recipient account
            if (!result.success) {
                updateTransactionStatus('blocked');
            }
        }
    } catch (error) {
        console.error('PIN verification error:', error);
        showNotification('Verification failed. Transaction blocked.', 'error');
        updateTransactionStatus('blocked');
    } finally {
        showLoading(false);
    }
}

function cancelTransaction() {
    closeModal('smsModal');
    updateTransactionStatus('cancelled');
    showNotification('Transaction cancelled by user', 'warning');
}

// UI Functions
function showLogin() {
    closeModal('signupModal');
    loginModal.style.display = 'block';
}

function showSignup() {
    closeModal('loginModal');
    signupModal.style.display = 'block';
}

function showSMSVerification() {
    smsModal.style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showDashboard() {
    // Hide home and features sections
    home.style.display = 'none';
    features.style.display = 'none';
    
    // Show dashboard
    dashboard.classList.remove('hidden');
    
    // Update user welcome message
    document.getElementById('userWelcome').textContent = `Welcome, ${currentUser.name || currentUser.account}`;
    
    // Update navigation buttons
    const authButtons = document.querySelector('.auth-buttons');
    authButtons.innerHTML = `
        <span style="color: white; margin-right: 1rem;">Welcome, ${currentUser.name || 'User'}</span>
        <button class="btn btn-outline" onclick="logout()">Logout</button>
    `;
}

function logout() {
    currentUser = null;
    currentTransaction = null;
    localStorage.removeItem('currentUser');
    
    // Show home sections
    home.style.display = 'block';
    features.style.display = 'block';
    
    // Hide dashboard
    dashboard.classList.add('hidden');
    
    // Reset navigation
    const authButtons = document.querySelector('.auth-buttons');
    authButtons.innerHTML = `
        <button class="btn btn-outline" onclick="showLogin()">Login</button>
        <button class="btn btn-primary" onclick="showSignup()">Sign Up</button>
    `;
    
    // Clear forms
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionResult').classList.add('hidden');
    
    showNotification('Logged out successfully', 'success');
}

function displayTransactionResult(result, transactionData) {
    const resultDiv = document.getElementById('transactionResult');
    const fraudStatus = resultDiv.querySelector('.fraud-status');
    const fraudReasons = resultDiv.querySelector('.fraud-reasons');
    const resultActions = resultDiv.querySelector('.result-actions');
    
    // Update fraud status
    const icon = fraudStatus.querySelector('.result-icon');
    const statusText = fraudStatus.querySelector('.status-text');
    
    if (result.fraud) {
        icon.className = 'result-icon fas fa-exclamation-triangle status-fraud';
        statusText.textContent = 'FRAUD DETECTED';
        statusText.className = 'status-text status-fraud';
    } else {
        icon.className = 'result-icon fas fa-check-circle status-safe';
        statusText.textContent = 'TRANSACTION SAFE';
        statusText.className = 'status-text status-safe';
    }
    
    // Update fraud reasons
    if (result.reasons && result.reasons.length > 0) {
        fraudReasons.innerHTML = `
            <h4>Analysis Details:</h4>
            <ul>
                ${result.reasons.map(reason => `<li><i class="fas fa-exclamation-circle"></i> ${reason}</li>`).join('')}
            </ul>
        `;
    } else {
        fraudReasons.innerHTML = `
            <h4>Analysis Details:</h4>
            <p style="color: var(--success-color);"><i class="fas fa-check-circle"></i> No suspicious activity detected</p>
        `;
    }
    
    // Update actions
    if (result.fraud) {
        resultActions.innerHTML = `
            <div class="alert" style="background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <p style="color: var(--danger-color); margin: 0;">
                    <i class="fas fa-shield-alt"></i> 
                    This transaction requires additional verification for your security.
                </p>
            </div>
        `;
    } else {
        resultActions.innerHTML = `
            <div class="alert" style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1rem; border-radius: 8px;">
                <p style="color: var(--success-color); margin: 0;">
                    <i class="fas fa-check-circle"></i> 
                    Transaction approved and processed successfully.
                </p>
            </div>
        `;
    }
    
    resultDiv.classList.remove('hidden');
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function updateTransactionStatus(status) {
    const resultActions = document.querySelector('.result-actions');
    
    switch(status) {
        case 'approved':
            resultActions.innerHTML = `
                <div class="alert" style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1rem; border-radius: 8px;">
                    <p style="color: var(--success-color); margin: 0;">
                        <i class="fas fa-check-circle"></i> 
                        PIN verified successfully! Transaction approved and processed.
                    </p>
                </div>
            `;
            break;
        case 'blocked':
            resultActions.innerHTML = `
                <div class="alert" style="background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: 8px;">
                    <p style="color: var(--danger-color); margin: 0;">
                        <i class="fas fa-ban"></i> 
                        Transaction blocked due to security concerns. Recipient account has been blacklisted.
                    </p>
                </div>
            `;
            break;
        case 'cancelled':
            resultActions.innerHTML = `
                <div class="alert" style="background: #fffbeb; border: 1px solid #fed7aa; padding: 1rem; border-radius: 8px;">
                    <p style="color: var(--warning-color); margin: 0;">
                        <i class="fas fa-times-circle"></i> 
                        Transaction cancelled by user.
                    </p>
                </div>
            `;
            break;
    }
}

// Utility Functions
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay') || createLoadingOverlay();
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid var(--primary-color); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
            <p>Processing...</p>
        </div>
    `;
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(overlay);
    return overlay;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 4000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.style.background = colors[type] || colors.info;
    notification.textContent = message;
    
    // Add slide-in animation
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Mobile menu toggle
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Smooth scrolling for navigation links
document.addEventListener('click', function(e) {
    if (e.target.matches('.nav-link[href^="#"]')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Auto-fill current timestamp for transaction form
document.addEventListener('DOMContentLoaded', function() {
    const timestampInput = document.getElementById('timestamp');
    if (timestampInput) {
        // Set current date and time as default
        const now = new Date();
        const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        timestampInput.value = localISOTime;
    }
});