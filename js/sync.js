/* LifeBuddy Offline-First Sync Engine (IndexedDB + Outbox Queue + LWW) */
import { Storage } from './storage.js';

const DB_NAME = 'lifebuddy_sync_db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';

export class SyncEngine {
  constructor(options = {}) {
    this.statusEl = options.statusEl || document.getElementById('cloud-sync-status');
    this.db = null;
    this.isSyncing = false;
    this.syncInterval = null;
  }

  async init() {
    await this.openDatabase();
    this.bindNetworkListeners();
    this.updateStatusPill();

    // Auto-flush when online
    if (navigator.onLine && Storage.getToken()) {
      await this.flushOutbox();
    }

    // Periodic sync attempt every 30 seconds
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && Storage.getToken()) {
        this.flushOutbox();
      }
    }, 30000);
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
          store.createIndex('client_updated_at', 'client_updated_at', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB unavailable; falling back to memory/local storage mode.', event);
        resolve(null);
      };
    });
  }

  bindNetworkListeners() {
    window.addEventListener('online', () => {
      this.updateStatusPill();
      this.flushOutbox();
    });

    window.addEventListener('offline', () => {
      this.updateStatusPill();
    });
  }

  async queueMutation({ id, entity, action = 'upsert', payload = {} }) {
    if (!id) id = 'mut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const client_updated_at = new Date().toISOString();

    const mutationItem = {
      id,
      entity,
      action,
      payload,
      client_updated_at
    };

    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(OUTBOX_STORE, 'readwrite');
          const store = tx.objectStore(OUTBOX_STORE);
          store.put(mutationItem);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    this.updateStatusPill();

    if (navigator.onLine && Storage.getToken()) {
      this.flushOutbox();
    }
  }

  async getPendingCount() {
    if (!this.db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(OUTBOX_STORE, 'readonly');
        const store = tx.objectStore(OUTBOX_STORE);
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result || 0);
        countReq.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  async getAllPending() {
    if (!this.db) return [];
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(OUTBOX_STORE, 'readonly');
        const store = tx.objectStore(OUTBOX_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async clearPending(ids = []) {
    if (!this.db || ids.length === 0) return;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(OUTBOX_STORE, 'readwrite');
        const store = tx.objectStore(OUTBOX_STORE);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async flushOutbox() {
    if (this.isSyncing) return;
    const token = Storage.getToken();
    if (!token) {
      this.updateStatusPill();
      return;
    }

    const items = await this.getAllPending();
    if (items.length === 0) {
      this.updateStatusPill();
      return;
    }

    this.isSyncing = true;
    this.setStatus('syncing', `Syncing (${items.length})...`);

    try {
      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items })
      });

      if (res.ok) {
        const result = await res.json();
        const idsToRemove = items.map(i => i.id);
        await this.clearPending(idsToRemove);
        this.setStatus('online', '🟢 Synced');
      } else if (res.status === 401) {
        // Token might need refresh or relogin
        this.setStatus('offline', 'Auth Required');
      } else {
        this.setStatus('error', '🔴 Sync Error');
      }
    } catch (err) {
      this.setStatus('offline', `Offline (${items.length} queued)`);
    } finally {
      this.isSyncing = false;
      setTimeout(() => this.updateStatusPill(), 2500);
    }
  }

  async updateStatusPill() {
    const isOnline = navigator.onLine;
    const token = Storage.getToken();
    const count = await this.getPendingCount();

    if (!token) {
      this.setStatus('local', 'Local Mode');
      return;
    }

    if (!isOnline) {
      this.setStatus('offline', count > 0 ? `Offline (${count} queued)` : 'Offline');
      return;
    }

    if (count > 0) {
      this.setStatus('syncing', `Pending (${count})`);
      this.flushOutbox();
    } else {
      this.setStatus('online', '🟢 Synced');
    }
  }

  setStatus(type, label) {
    if (!this.statusEl) {
      this.statusEl = document.getElementById('cloud-sync-status');
    }
    if (!this.statusEl) return;

    this.statusEl.className = 'status-pill';
    let dotClass = 'offline';

    if (type === 'online') {
      this.statusEl.classList.add('status-online');
      dotClass = 'online';
    } else if (type === 'syncing') {
      this.statusEl.classList.add('status-syncing');
      dotClass = 'syncing';
    } else if (type === 'error') {
      this.statusEl.classList.add('status-error');
      dotClass = 'error';
    } else {
      this.statusEl.classList.add('status-offline');
      dotClass = 'offline';
    }

    this.statusEl.innerHTML = `
      <span class="status-dot ${dotClass}"></span> <span>${label}</span>
    `;
  }
}

export const syncEngine = new SyncEngine();
