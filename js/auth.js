/* LifeBuddy Authentication & Access Controller (Phase 2 Upgrade)
   - Strict Route & View Protection
   - Create Account: Shows animated Welcome Success Card (does NOT auto-login, does NOT jump to dashboard)
   - "Continue to Sign In": Pre-fills username, focuses empty password field
   - Show/Hide Password Toggle
   - Minimum 8+ characters strength indicator
   - Live confirm-password match validation
   - Display name support (first name used everywhere)
   - Clean, friendly error handling (no field revealing on bad credentials)
*/
import { API } from './api.js';
import { store } from './store.js';

export class AuthController {
  constructor(options = {}) {
    this.onUserChanged = options.onUserChanged || (() => {});
  }

  async init() {
    this.bindEvents();
    this.updateUI();

    // Verify token if logged in
    if (API.isLoggedIn()) {
      try {
        const me = await API.auth.getMe();
        if (me && me.user) {
          API.setAuth(API.getToken(), me.user, API.getRefreshToken());
          store.setUser(me.user);
          if (me.settings) {
            store.updateSettings(me.settings);
          }
        }
      } catch (e) {
        console.warn('Could not verify session with backend, clearing session', e);
        API.auth.logout();
      }
    }
    this.updateUI();
  }

  updateUI() {
    const isLoggedIn = API.isLoggedIn();
    const user = store.getUser() || API.getUser();

    const welcomeGate = document.getElementById('welcome-gate');
    const mainWorkspace = document.getElementById('main-workspace');
    const workspaceHeaderActions = document.getElementById('workspace-header-actions');
    const mainNavBar = document.getElementById('main-nav-bar');
    const authBtnText = document.getElementById('auth-btn-text');

    if (isLoggedIn && user) {
      document.body.classList.remove('unauthenticated');
      if (welcomeGate) welcomeGate.style.display = 'none';
      if (mainWorkspace) mainWorkspace.style.display = 'block';
      if (workspaceHeaderActions) workspaceHeaderActions.style.display = 'flex';
      if (mainNavBar) mainNavBar.style.display = 'flex';
      if (authBtnText) authBtnText.textContent = store.getDisplayName();
    } else {
      // Unauthenticated Welcome State:
      // STRICT ISOLATION: Hide workspace, navigation tabs, and header utility actions!
      document.body.classList.add('unauthenticated');
      if (welcomeGate) welcomeGate.style.display = 'flex';
      if (mainWorkspace) mainWorkspace.style.display = 'none';
      if (workspaceHeaderActions) workspaceHeaderActions.style.display = 'none';
      if (mainNavBar) mainNavBar.style.display = 'none';
    }
  }

  bindEvents() {
    const gateForm = document.getElementById('gate-auth-form');
    const gateTabsHeader = document.getElementById('gate-tabs-header');
    const gateTabLogin = document.getElementById('gate-tab-login');
    const gateTabRegister = document.getElementById('gate-tab-register');
    const gateSuccessPanel = document.getElementById('gate-success-panel');
    const gateSuccessName = document.getElementById('gate-success-name');
    const gateContinueSigninBtn = document.getElementById('gate-continue-signin-btn');

    const gateFullnameGroup = document.getElementById('gate-fullname-group');
    const gateFullnameInput = document.getElementById('gate-fullname-input');
    const gateUsernameInput = document.getElementById('gate-username-input');
    const gateEmailGroup = document.getElementById('gate-email-group');
    const gateEmailInput = document.getElementById('gate-email-input');
    const gateProfileRow = document.getElementById('gate-profile-row');
    const gateGoalGroup = document.getElementById('gate-goal-group');
    const gateProfessionSelect = document.getElementById('gate-profession-select');
    const gateAgeSelect = document.getElementById('gate-age-select');
    const gateGoalSelect = document.getElementById('gate-goal-select');

    const gatePasswordInput = document.getElementById('gate-password-input');
    const togglePwdBtn = document.getElementById('toggle-pwd-btn');
    const pwdStrengthContainer = document.getElementById('pwd-strength-container');
    const pwdStrengthBar = document.getElementById('pwd-strength-bar');
    const pwdStrengthText = document.getElementById('pwd-strength-text');

    const gateConfirmGroup = document.getElementById('gate-confirm-group');
    const gateConfirmPasswordInput = document.getElementById('gate-confirm-password-input');
    const toggleConfirmPwdBtn = document.getElementById('toggle-confirm-pwd-btn');
    const confirmPwdHint = document.getElementById('confirm-pwd-hint');

    const gateSubmitBtn = document.getElementById('gate-submit-btn');
    const gateErrorMsg = document.getElementById('gate-error-msg');

    let gateMode = 'login';
    let newlyRegisteredUsername = '';

    // Ensure password inputs are empty on load (no cached dots)
    if (gatePasswordInput) gatePasswordInput.value = '';
    if (gateConfirmPasswordInput) gateConfirmPasswordInput.value = '';

    const setAuthMode = (mode) => {
      gateMode = mode;
      const isRegister = mode === 'register';

      if (gateErrorMsg) gateErrorMsg.style.display = 'none';
      if (gateSuccessPanel) gateSuccessPanel.style.display = 'none';
      if (gateForm) gateForm.style.display = 'block';
      if (gateTabsHeader) gateTabsHeader.style.display = 'grid';

      if (gateTabLogin) gateTabLogin.classList.toggle('active', !isRegister);
      if (gateTabRegister) gateTabRegister.classList.toggle('active', isRegister);

      if (gateFullnameGroup) gateFullnameGroup.style.display = isRegister ? 'block' : 'none';
      if (gateEmailGroup) gateEmailGroup.style.display = isRegister ? 'block' : 'none';
      if (gateProfileRow) gateProfileRow.style.display = isRegister ? 'flex' : 'none';
      if (gateGoalGroup) gateGoalGroup.style.display = isRegister ? 'block' : 'none';
      if (gateConfirmGroup) gateConfirmGroup.style.display = isRegister ? 'block' : 'none';
      if (pwdStrengthContainer) pwdStrengthContainer.style.display = isRegister ? 'block' : 'none';

      if (gatePasswordInput) {
        gatePasswordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
        gatePasswordInput.placeholder = isRegister ? 'Create a secure password (8+ chars)' : 'Enter your password';
      }

      if (gateSubmitBtn) {
        gateSubmitBtn.innerHTML = isRegister
          ? '<span>Create Your Account</span> <span>→</span>'
          : '<span>Sign In to LifeBuddy</span> <span>→</span>';
      }
    };

    if (gateTabLogin && gateTabRegister) {
      gateTabLogin.addEventListener('click', () => setAuthMode('login'));
      gateTabRegister.addEventListener('click', () => setAuthMode('register'));
    }

    // 1. Password Visibility Toggles
    const setupPwdToggle = (btn, input) => {
      if (!btn || !input) return;
      btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        btn.innerHTML = isPassword
          ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>`
          : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
      });
    };

    setupPwdToggle(togglePwdBtn, gatePasswordInput);
    setupPwdToggle(toggleConfirmPwdBtn, gateConfirmPasswordInput);

    // 2. Password Strength Evaluation
    if (gatePasswordInput && pwdStrengthBar && pwdStrengthText) {
      gatePasswordInput.addEventListener('input', () => {
        if (gateMode !== 'register') return;
        const val = gatePasswordInput.value;
        if (!val) {
          pwdStrengthBar.style.width = '0%';
          pwdStrengthText.textContent = 'Minimum 8 characters';
          pwdStrengthText.style.color = 'var(--text-muted)';
          return;
        }

        let score = 0;
        if (val.length >= 8) score++;
        if (val.length >= 12) score++;
        if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        if (val.length < 8) {
          pwdStrengthBar.style.width = '25%';
          pwdStrengthBar.style.background = '#ef4444';
          pwdStrengthText.textContent = `Too short (${val.length}/8 chars)`;
          pwdStrengthText.style.color = '#ef4444';
        } else if (score <= 2) {
          pwdStrengthBar.style.width = '50%';
          pwdStrengthBar.style.background = '#f59e0b';
          pwdStrengthText.textContent = 'Fair strength (add numbers or symbols)';
          pwdStrengthText.style.color = '#f59e0b';
        } else {
          pwdStrengthBar.style.width = '100%';
          pwdStrengthBar.style.background = '#10b981';
          pwdStrengthText.textContent = 'Strong password ✓';
          pwdStrengthText.style.color = '#10b981';
        }
      });
    }

    // 3. Confirm Password Match Check
    if (gateConfirmPasswordInput && confirmPwdHint) {
      const checkMatch = () => {
        if (gateMode !== 'register') return;
        const p1 = gatePasswordInput?.value || '';
        const p2 = gateConfirmPasswordInput.value || '';
        if (!p2) {
          confirmPwdHint.style.display = 'none';
          return;
        }
        confirmPwdHint.style.display = 'block';
        if (p1 === p2) {
          confirmPwdHint.textContent = 'Passwords match ✓';
          confirmPwdHint.style.color = '#10b981';
        } else {
          confirmPwdHint.textContent = 'Passwords do not match';
          confirmPwdHint.style.color = '#ef4444';
        }
      };

      gateConfirmPasswordInput.addEventListener('input', checkMatch);
      if (gatePasswordInput) gatePasswordInput.addEventListener('input', checkMatch);
    }

    // 4. Form Submission
    if (gateForm) {
      gateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = gateUsernameInput?.value.trim() || '';
        const password = gatePasswordInput?.value || '';
        const email = gateEmailInput?.value.trim() || '';
        const fullName = gateFullnameInput?.value.trim() || '';
        const profession = gateProfessionSelect?.value || 'Working Professional';
        const ageGroup = gateAgeSelect?.value || '25-34';
        const focusGoal = gateGoalSelect?.value || 'Deep Work & Productivity';

        if (gateErrorMsg) gateErrorMsg.style.display = 'none';

        if (gateMode === 'register') {
          // Client-side validation
          if (!fullName) {
            showError('Please enter your display name.');
            gateFullnameInput?.focus();
            return;
          }
          if (!username || username.length < 3) {
            showError('Username must be at least 3 characters.');
            gateUsernameInput?.focus();
            return;
          }
          if (!email || !email.includes('@')) {
            showError('Please enter a valid email address.');
            gateEmailInput?.focus();
            return;
          }
          if (password.length < 8) {
            showError('Password must be at least 8 characters long.');
            gatePasswordInput?.focus();
            return;
          }
          if (password !== gateConfirmPasswordInput?.value) {
            showError('Passwords do not match. Please verify your password confirmation.');
            gateConfirmPasswordInput?.focus();
            return;
          }

          if (gateSubmitBtn) gateSubmitBtn.disabled = true;

          try {
            const resp = await API.auth.register(username, email, password, {
              fullName,
              profession,
              ageGroup,
              focusGoal
            });

            // SUCCESS STATE: DO NOT auto-login, DO NOT navigate to dashboard!
            newlyRegisteredUsername = username;
            const firstName = fullName.split(/\s+/)[0] || username;

            if (gateForm) gateForm.style.display = 'none';
            if (gateTabsHeader) gateTabsHeader.style.display = 'none';
            if (gateSuccessName) gateSuccessName.textContent = firstName;
            if (gateSuccessPanel) gateSuccessPanel.style.display = 'block';

            // Clear password fields immediately
            if (gatePasswordInput) gatePasswordInput.value = '';
            if (gateConfirmPasswordInput) gateConfirmPasswordInput.value = '';
          } catch (err) {
            showError(err.message || 'Could not create account. Please try again.');
          } finally {
            if (gateSubmitBtn) gateSubmitBtn.disabled = false;
          }
        } else {
          // SIGN IN FLOW
          if (!username || !password) {
            showError('Please enter both your username and password.');
            return;
          }

          if (gateSubmitBtn) gateSubmitBtn.disabled = true;

          try {
            const data = await API.auth.login(username, password);
            if (data && data.user) {
              store.setUser(data.user);
            }
            await store.syncAll();
            this.updateUI();
            this.onUserChanged(data.user);
            window.location.reload();
          } catch (err) {
            // Friendly ambiguous error to avoid credential harvesting
            showError('Invalid username or password. Please verify your credentials and try again.');
          } finally {
            if (gateSubmitBtn) gateSubmitBtn.disabled = false;
          }
        }
      });
    }

    const showError = (msg) => {
      if (gateErrorMsg) {
        gateErrorMsg.textContent = msg;
        gateErrorMsg.style.display = 'block';
      }
    };

    // 5. "Continue to Sign In" Button from Success Card
    if (gateContinueSigninBtn) {
      gateContinueSigninBtn.addEventListener('click', () => {
        setAuthMode('login');
        if (gateUsernameInput) {
          gateUsernameInput.value = newlyRegisteredUsername;
        }
        if (gatePasswordInput) {
          gatePasswordInput.value = '';
          gatePasswordInput.focus();
        }
      });
    }

    // 6. Header Auth Modal (Sign Out / Close)
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const authLogoutBtn = document.getElementById('auth-logout-btn');

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
      });
    }

    if (authLogoutBtn) {
      authLogoutBtn.addEventListener('click', () => {
        API.auth.logout();
        store.setUser(null);
        if (authModal) authModal.classList.remove('active');
        this.updateUI();
        this.onUserChanged(null);
        window.location.reload();
      });
    }
  }
}
