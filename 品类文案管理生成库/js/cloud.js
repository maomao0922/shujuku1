/**
 * 云同步模块 — 基于 LeanCloud REST API
 * 实现多设备数据自动同步（国内可用，无需翻墙）
 *
 * 工作原理：
 * - 数据存储在 LeanCloud 的 CopyLibrary class 中
 * - 本地写入时自动推送（防抖1秒）
 * - 每30秒轮询云端变化，自动更新本地
 * - 不同步 settings（API Key 等设备级配置仅本地）
 *
 * LeanCloud 配置：
 * - 注册：https://console.leancloud.cn （需手机号）
 * - 创建应用 → 获取 App ID / App Key
 */
const Cloud = {
  _appId: null,
  _appKey: null,
  _syncName: null,
  _objectId: null,
  _ready: false,
  _applyingCloud: false,
  _debounceTimer: null,
  _initialSyncDone: false,
  _pollTimer: null,
  _lastPushTime: 0,

  // ========== 初始化 ==========
  init() {
    const appId = Store.getSetting('leancloud_app_id', '').trim();
    const appKey = Store.getSetting('leancloud_app_key', '').trim();
    const syncName = Store.getSetting('cloud_sync_name', '').trim();

    if (!appId || !appKey || !syncName) {
      this._ready = false;
      this._updateTopbar();
      return false;
    }

    this._appId = appId;
    this._appKey = appKey;
    this._syncName = syncName;
    this._objectId = null;
    this._ready = true;
    this._initialSyncDone = false;

    this._initialSync();
    this._updateTopbar();
    return true;
  },

  // ========== REST API 基础 ==========
  _baseUrl() {
    return `https://${this._appId}.api.lncldapi.com/1.1/classes/CopyLibrary`;
  },

  _headers() {
    return {
      'X-LC-Id': this._appId,
      'X-LC-Key': this._appKey,
      'Content-Type': 'application/json'
    };
  },

  // ========== 初始同步 ==========
  async _initialSync() {
    try {
      const where = JSON.stringify({ syncName: this._syncName });
      const url = `${this._baseUrl()}?where=${encodeURIComponent(where)}&limit=1`;
      const resp = await fetch(url, { headers: this._headers() });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      if (data.results && data.results.length > 0) {
        const doc = data.results[0];
        this._objectId = doc.objectId;
        this._applyCloudData(doc);
        this._initialSyncDone = true;
        this._lastPushTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
        console.log('[Cloud] 已从云端拉取数据');
        this._rerender();
        this._startPolling();
      } else {
        await this._pushNow();
        this._initialSyncDone = true;
        console.log('[Cloud] 本地数据已推送到云端');
        this._startPolling();
      }
    } catch (e) {
      console.error('[Cloud] 初始同步失败:', e);
      let hint = e.message;
      if (e.message.includes('401') || e.message.includes('403')) {
        hint = 'App ID 或 App Key 不正确，请检查';
      } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        hint = '网络连接失败，请检查网络';
      }
      toast('云同步失败：' + hint, 'error');
    }
  },

  // ========== 推送（防抖） ==========
  push() {
    if (!this._ready || this._applyingCloud) return;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._pushNow(), 1000);
  },

  async _pushNow() {
    if (!this._ready) return;
    try {
      const payload = {
        syncName: this._syncName,
        products: Store._read(Store.KEYS.products),
        copies: Store._read(Store.KEYS.copies),
        references: Store._read(Store.KEYS.references),
        updatedAt: new Date().toISOString()
      };

      if (this._objectId) {
        const resp = await fetch(`${this._baseUrl()}/${this._objectId}`, {
          method: 'PUT',
          headers: this._headers(),
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
      } else {
        const resp = await fetch(this._baseUrl(), {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        this._objectId = data.objectId;
      }
      this._lastPushTime = Date.now();
    } catch (e) {
      console.error('[Cloud] 推送失败:', e);
    }
  },

  // ========== 应用云端数据到本地 ==========
  _applyCloudData(data) {
    this._applyingCloud = true;
    if (data.products) Store._write(Store.KEYS.products, data.products);
    if (data.copies) Store._write(Store.KEYS.copies, data.copies);
    if (data.references) Store._write(Store.KEYS.references, data.references);
    this._applyingCloud = false;
  },

  // ========== 轮询同步 ==========
  _startPolling() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => this._poll(), 30000);
  },

  async _poll() {
    if (!this._ready || !this._initialSyncDone || !this._objectId) return;
    try {
      const resp = await fetch(`${this._baseUrl()}/${this._objectId}`, {
        headers: this._headers()
      });
      if (!resp.ok) return;
      const doc = await resp.json();
      const cloudTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
      if (cloudTime > this._lastPushTime) {
        this._applyCloudData(doc);
        this._lastPushTime = cloudTime;
        this._rerender();
        console.log('[Cloud] 轮询检测到云端更新');
      }
    } catch (e) {
      // 轮询失败静默处理
    }
  },

  // ========== 重新渲染 ==========
  _rerender() {
    if (typeof App === 'undefined' || !App.currentPage) return;
    const fns = {
      products: renderProducts,
      generate: renderGenerate,
      imitate: renderImitate,
      copies: renderCopies,
      references: renderReferences
    };
    const fn = fns[App.currentPage];
    if (fn) fn($('.content'));
    renderSidebar();
  },

  // ========== 顶栏状态 ==========
  _updateTopbar() {
    const el = document.getElementById('cloud-status');
    if (!el) return;
    if (this._ready) {
      el.innerHTML = '\u2601\uFE0F \u5DF2\u540C\u6B65';
      el.style.color = 'var(--green)';
      el.title = '\u4E91\u540C\u6B65\u5DF2\u8FDE\u63A5\u00B7' + this._syncName;
    } else {
      el.innerHTML = '\u2601\uFE0F \u672C\u5730';
      el.style.color = 'var(--gray-400)';
      el.title = '\u4E91\u540C\u6B65\u672A\u5F00\u542F';
    }
  },

  // ========== 手动同步 ==========
  async syncNow() {
    if (!this._ready) { toast('\u8BF7\u5148\u914D\u7F6E\u5E76\u8FDE\u63A5\u4E91\u540C\u6B65', 'error'); return false; }
    try {
      if (!this._objectId) {
        await this._pushNow();
        toast('\u2705 \u672C\u5730\u6570\u636E\u5DF2\u4E0A\u4F20');
        return true;
      }
      const resp = await fetch(`${this._baseUrl()}/${this._objectId}`, {
        headers: this._headers()
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const doc = await resp.json();
      this._applyCloudData(doc);
      this._lastPushTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
      this._rerender();
      toast('\u2705 \u6570\u636E\u5DF2\u540C\u6B65');
      return true;
    } catch (e) {
      toast('\u540C\u6B65\u5931\u8D25\uFF1A' + e.message, 'error');
      return false;
    }
  },

  // ========== 断开 ==========
  disconnect() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    this._appId = null;
    this._appKey = null;
    this._syncName = null;
    this._objectId = null;
    this._ready = false;
    this._initialSyncDone = false;
    this._lastPushTime = 0;
    this._updateTopbar();
  },

  // ========== 工具方法 ==========
  isReady() { return this._ready; },
  getSyncName() { return this._syncName; }
};
