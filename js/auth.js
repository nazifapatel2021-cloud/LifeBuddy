/* LifeBuddy Authentication & Cloud Sync Controller */
import { API } from './api.js';

export class AuthController {
  constructor(options = {}) {
    this.onUserChanged = options.onUserChanged || (() => {});
  }

  async init() {
    this.bindEvents();
    this.updateUI();
    // Try to verify token if logged in
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
    const syncStatusEl = document.getElementById('cloud-sync-status');
    const authBtn = document.getElementById('auth-modal-btn');
    const authBtnText = document.getElementById('auth-btn-text');

    if (user && API.isLoggedIn()) {
      if (syncStatusEl) {
        syncStatusEl.innerHTML = `<span class="status-dot online"></span> <span>Cloud Synced</span>`;
        syncStatusEl.className = 'status-pill status-online';
      }
      if (authBtnText) {
        authBtnText.textContent = user.username;
      }
    } else {
      if (syncStatusEl) {
        syncStatusEl.innerHTML = `<span class="status-dot offline"></span> <span>Local Mode</span>`;
        syncStatusEl.className = 'status-pill status-offline';
      }
      if (authBtnText) {
        authBtnText.textContent = 'Sign In';
      }
    }
  }

  bindEvents() {
    const authModalBtn = document.getElementById('auth-modal-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const authForm = document.getElementById('auth-form');
    const authToggleTabLogin = document.getElementById('auth-tab-login');
    const authToggleTabRegister = document.getElementById('auth-tab-register');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authEmailGroup = document.getElementById('auth-email-group');
    const authLogoutBtn = document.getElementById('auth-logout-btn');

    let mode = 'login'; // 'login' or 'register'

    if (authModalBtn && authModal) {
      authModalBtn.addEventListener('click', () => {
        const user = API.getUser();
        if (user && API.isLoggedIn()) {
          // Show logged in profile state
          document.getElementById('auth-logged-in-view').style.display = 'block';
          document.getElementById('auth-logged-out-view').style.display = 'none';
          document.getElementById('profile-username').textContent = user.username;
          document.getElementById('profile-email').textContent = user.email || '';
        } else {
          document.getElementById('auth-logged-in-view').style.display = 'none';
          document.getElementById('auth-logged-out-view').style.display = 'block';
        }
        authModal.classList.add('active');
      });
    }

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
      });
    }

    if (authToggleTabLogin && authToggleTabRegister) {
      authToggleTabLogin.addEventListener('click', () => {
        mode = 'login';
        authToggleTabLogin.classList.add('active');
        authToggleTabRegister.classList.remove('active');
        authEmailGroup.style.display = 'none';
        authSubmitBtn.textContent = 'Sign In';
      });

      authToggleTabRegister.addEventListener('click', () => {
        mode = 'register';
        authToggleTabRegister.classList.add('active');
        authToggleTabLogin.classList.remove('active');
        authEmailGroup.style.display = 'block';
        authSubmitBtn.textContent = 'Create Account';
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username-input').value.trim();
        const password = document.getElementById('auth-password-input').value;
        const email = document.getElementById('auth-email-input').value.trim();
        const errorEl = document.getElementById('auth-error-msg');

        if (errorEl) errorEl.style.display = 'none';
        authSubmitBtn.disabled = true;

        try {
          if (mode === 'login') {
            await API.auth.login(username, password);
          } else {
            if (!email) throw new Error('Please provide an email address');
            await API.auth.register(username, email, password);
          }

          authModal.classList.remove('active');
          this.updateUI();
          this.onUserChanged(API.getUser());
          window.location.reload(); // Refresh clean state
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err.message || 'Authentication failed. Please check credentials or start server.';
            errorEl.style.display = 'block';
          }
        } finally {
          authSubmitBtn.disabled = false;
        }
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
