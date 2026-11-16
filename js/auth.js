/* LifeBuddy Authentication & Workspace Access Controller */
import { API } from './api.js';

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
          API.setAuth(API.getToken(), me.user);
        }
      } catch (e) {
        console.warn('Could not verify session with backend', e);
      }
    }
    this.updateUI();
  }

  updateUI() {
    const user = API.getUser();
    const isLoggedIn = API.isLoggedIn();

    const welcomeGate = document.getElementById('welcome-gate');
    const mainWorkspace = document.getElementById('main-workspace');
    const workspaceHeaderActions = document.getElementById('workspace-header-actions');
    const mainNavBar = document.getElementById('main-nav-bar');
    const authBtnText = document.getElementById('auth-btn-text');

    if (isLoggedIn) {
      document.body.classList.remove('unauthenticated');
      if (welcomeGate) welcomeGate.style.display = 'none';
      if (mainWorkspace) mainWorkspace.style.display = 'block';
      if (workspaceHeaderActions) workspaceHeaderActions.style.display = 'flex';
      if (mainNavBar) mainNavBar.style.display = 'flex';
      if (authBtnText) authBtnText.textContent = user ? user.username : 'Account';
    } else {
      // Unauthenticated Welcome State:
      // Show ONLY the clean brand in the header and the welcome hero/auth card.
      // Hide workspace, navigation tabs, and header utility actions!
      document.body.classList.add('unauthenticated');
      if (welcomeGate) welcomeGate.style.display = 'flex';
      if (mainWorkspace) mainWorkspace.style.display = 'none';
      if (workspaceHeaderActions) workspaceHeaderActions.style.display = 'none';
      if (mainNavBar) mainNavBar.style.display = 'none';
    }
  }

  bindEvents() {
    // Welcome Gate Form (Sign In / Register)
    const gateForm = document.getElementById('gate-auth-form');
    const gateTabLogin = document.getElementById('gate-tab-login');
    const gateTabRegister = document.getElementById('gate-tab-register');
    const gateEmailGroup = document.getElementById('gate-email-group');
    const gateSubmitBtn = document.getElementById('gate-submit-btn');
    const gateErrorMsg = document.getElementById('gate-error-msg');
    let gateMode = 'login';

    if (gateTabLogin && gateTabRegister) {
      gateTabLogin.addEventListener('click', () => {
        gateMode = 'login';
        gateTabLogin.classList.add('active');
        gateTabRegister.classList.remove('active');
        if (gateEmailGroup) gateEmailGroup.style.display = 'none';
        if (gateSubmitBtn) gateSubmitBtn.textContent = 'Sign In to LifeBuddy →';
      });

      gateTabRegister.addEventListener('click', () => {
        gateMode = 'register';
        gateTabRegister.classList.add('active');
        gateTabLogin.classList.remove('active');
        if (gateEmailGroup) gateEmailGroup.style.display = 'block';
        if (gateSubmitBtn) gateSubmitBtn.textContent = 'Create Free Account →';
      });
    }

    if (gateForm) {
      gateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('gate-username-input')?.value.trim();
        const password = document.getElementById('gate-password-input')?.value;
        const email = document.getElementById('gate-email-input')?.value.trim();

        if (gateErrorMsg) gateErrorMsg.style.display = 'none';
        if (gateSubmitBtn) gateSubmitBtn.disabled = true;

        try {
          if (gateMode === 'login') {
            await API.auth.login(username, password);
          } else {
            if (!email) throw new Error('Please enter an email address');
            await API.auth.register(username, email, password);
          }
          window.location.reload();
        } catch (err) {
          if (gateErrorMsg) {
            gateErrorMsg.textContent = err.message || 'Authentication failed. Please verify credentials.';
            gateErrorMsg.style.display = 'block';
          }
        } finally {
          if (gateSubmitBtn) gateSubmitBtn.disabled = false;
        }
      });
    }

    // 3. Header Auth Modal (Sign Out / Manage Profile)
    const authModalBtn = document.getElementById('auth-modal-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const authLogoutBtn = document.getElementById('auth-logout-btn');

    if (authModalBtn && authModal) {
      authModalBtn.addEventListener('click', () => {
        const user = API.getUser();
        if (user && API.isLoggedIn()) {
          document.getElementById('auth-logged-in-view').style.display = 'block';
          document.getElementById('auth-logged-out-view').style.display = 'none';
          document.getElementById('profile-username').textContent = user.username;
          document.getElementById('profile-email').textContent = user.email || '';
          authModal.classList.add('active');
        }
      });
    }

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
      });
    }

    if (authLogoutBtn) {
      authLogoutBtn.addEventListener('click', () => {
        API.auth.logout();
        authModal.classList.remove('active');
        this.updateUI();
        this.onUserChanged(null);
        window.location.reload();
      });
    }
  }
}
