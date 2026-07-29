/**
 * 品类文案管理生成库 — 核心应用逻辑
 * 六大页面：产品归档 · AI生成 · 爆款仿写 · 文案库 · 爆款学习
 */

// ========== 全局状态 ==========
const App = {
  currentPage: 'products',
  selectedProduct: null,
  selectedFramework: null,
  genInputs: {},
  imitateInputs: {},
  filters: {
    products: { keyword: '', category: '' },
    copies: { keyword: '', category: '', framework: '', bestseller: '', source: '' },
    references: { keyword: '', category: '', framework: '' }
  }
};

// ========== 工具函数 ==========
function $(sel, parent = document) { return parent.querySelector(sel); }
function $$(sel, parent = document) { return [...parent.querySelectorAll(sel)]; }

function toast(msg, type = 'success') {
  const container = $('.toast-container') || (() => {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type] || '✓'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 2500);
}

function modal(html, size = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal ${size}">${html}</div>`;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal(el) {
  const overlay = el?.closest('.modal-overlay');
  if (overlay) overlay.remove();
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getFrameworkTag(fwId) {
  const fw = Store.getFrameworkById(fwId);
  if (!fw) return `<span class="tag tag-gray">未分类</span>`;
  const colorMap = {
    'problem-solve': 'blue', 'cognition-slap': 'red', 'result-reverse': 'green',
    'curiosity-experience': 'purple', 'contrast-conflict': 'teal',
    'scene-immersion': 'pink', 'promotion': 'amber'
  };
  return `<span class="tag tag-${colorMap[fw.id]}">${fw.icon} ${fw.name}</span>`;
}

function getSourceTag(source) {
  const map = {
    'ai': '🤖 AI生成',
    'imitate': '🔄 爆款仿写',
    'manual': '✍️ 手写'
  };
  return `<span class="tag tag-gray">${map[source] || '✍️ 手写'}</span>`;
}

function getScriptStyleTag(style) {
  if (!style || style === '不限') return '';
  const colorMap = {
    '国货': 'red', '达人种草': 'purple', '老板人设': 'blue',
    '家庭视角': 'green', '网感营销': 'amber'
  };
  return `<span class="tag tag-${colorMap[style] || 'gray'}">🎭 ${style}</span>`;
}

function getScriptWordsLabel(val) {
  const map = {
    'auto': '自动匹配', '100': '100字以内', '200': '100-200字',
    '300': '200-300字', '400': '300-400字', '500': '300-500字'
  };
  return map[val] || '自动匹配';
}

function getAllCategories() {
  const products = Store.getProducts();
  const refs = Store.getReferences();
  const cats = new Set();
  products.forEach(p => { if (p.category) cats.add(p.category); });
  refs.forEach(r => { if (r.category) cats.add(r.category); });
  return [...cats].sort();
}

// ========== 初始化 ==========
function init() {
  renderSidebar();
  navigate('products');
  // 初始化云同步（异步，完成后自动更新界面）
  if (typeof Cloud !== 'undefined') {
    Cloud.init();
  }
}

// ========== 侧边栏 ==========
function renderSidebar() {
  const stats = Store.getStats();
  const navItems = [
    { id: 'products', icon: '📦', label: '产品归档', badge: stats.productCount },
    { id: 'generate', icon: '✍️', label: 'AI 生成', badge: null },
    { id: 'imitate', icon: '🔄', label: '爆款仿写', badge: null },
    { id: 'copies', icon: '📋', label: '文案库', badge: stats.copyCount },
    { id: 'references', icon: '📚', label: '爆款学习', badge: stats.refCount }
  ];

  const navHtml = navItems.map(item => `
    <div class="nav-item ${App.currentPage === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
      ${item.badge !== null ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </div>
  `).join('');

  const footerHtml = `
    <div class="stat-row"><span>产品</span><span class="font-bold">${stats.productCount}</span></div>
    <div class="stat-row"><span>文案</span><span class="font-bold">${stats.copyCount}</span></div>
    <div class="stat-row"><span>爆款</span><span class="font-bold">${stats.bestsellerCount}</span></div>
    <div class="stat-row"><span>素材</span><span class="font-bold">${stats.refCount}</span></div>
    <div class="divider" style="margin:8px 0"></div>
    <div class="flex gap-2">
      <button class="btn btn-sm" style="flex:1;font-size:11px" onclick="exportData()">📥 导出</button>
      <button class="btn btn-sm" style="flex:1;font-size:11px" onclick="importData()">📤 导入</button>
    </div>
  `;

  const sidebar = $('.sidebar');
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <h1>📝 品类文案管理生成库</h1>
      <div class="subtitle">信息流编导 · 多品类文案中枢</div>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">${footerHtml}</div>
  `;
}

// ========== 路由 ==========
function navigate(page) {
  App.currentPage = page;
  renderSidebar();
  const titles = {
    products: '产品归档',
    generate: 'AI 生成',
    imitate: '爆款仿写',
    copies: '文案库',
    references: '爆款学习'
  };
  $('.topbar-title').textContent = titles[page] || '';

  const content = $('.content');
  switch (page) {
    case 'products': renderProducts(content); break;
    case 'generate': renderGenerate(content); break;
    case 'imitate': renderImitate(content); break;
    case 'references': renderReferences(content); break;
    case 'copies': renderCopies(content); break;
  }
}

// ==========================================
// PAGE 1: 产品归档
// ==========================================
function renderProducts(el) {
  const products = Store.getProducts();
  const filtered = products.filter(p => {
    if (App.filters.products.category && p.category !== App.filters.products.category) return false;
    if (App.filters.products.keyword) {
      const kw = App.filters.products.keyword.toLowerCase();
      const spText = (p.sellingPoints || []).join(' ').toLowerCase();
      if (!(p.name || '').toLowerCase().includes(kw) && !spText.includes(kw)) return false;
    }
    return true;
  });

  const categories = getAllCategories();

  el.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="搜索产品名称或描述..." value="${App.filters.products.keyword}"
          oninput="App.filters.products.keyword=this.value; renderProducts($('.content'))">
      </div>
      <select class="form-select" style="width:auto" onchange="App.filters.products.category=this.value; renderProducts($('.content'))">
        <option value="">全部品类</option>
        ${categories.map(c => `<option value="${escapeHtml(c)}" ${App.filters.products.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <div style="margin-left:auto">
        <button class="btn btn-primary" onclick="productForm()">+ 添加产品</button>
        <button class="btn" onclick="exportData()">导出</button>
        <button class="btn" onclick="importData()">导入</button>
      </div>
    </div>

    ${filtered.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-text">${products.length === 0 ? '还没有产品，点击「添加产品」开始归档' : '没有匹配的产品'}</div>
        ${products.length === 0 ? `
          <button class="btn btn-primary" onclick="productForm()">+ 添加第一个产品</button>
        ` : ''}
      </div>
    ` : `
      <div class="product-grid">
        ${filtered.map(p => {
          const copyCount = Store.getCopies({ productId: p.id }).length;
          return `
            <div class="product-card" onclick="productDetail('${p.id}')">
              <div class="product-card-body">
                <div class="product-card-name">${escapeHtml(p.name)}</div>
                <div class="product-card-desc">${escapeHtml((p.sellingPoints || []).join('；') || '暂无卖点')}</div>
                <div class="product-card-points">
                  ${p.category ? `<span class="tag tag-blue">${escapeHtml(p.category)}</span>` : ''}
                  ${(p.sellingPoints || []).slice(0, 2).map(sp => `<span class="tag tag-gray">${escapeHtml(sp)}</span>`).join('')}
                </div>
              </div>
              <div class="product-card-footer">
                <span class="product-card-stat">✍️ ${copyCount} 篇文案</span>
                <span class="product-card-stat">${fmtDate(p.createdAt)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function productForm(id = null) {
  const product = id ? Store.getProduct(id) : {};
  const categories = getAllCategories();

  const html = `
    <div class="modal-header">
      <div class="modal-title">${id ? '编辑产品' : '添加产品'}</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">商品信息 <span class="required">*</span></label>
        <input class="form-input" id="pf-name" value="${escapeHtml(product.name || '')}" placeholder="请输入商品名称，如“某品牌粉底液”">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">品类</label>
          <input class="form-input" id="pf-category" list="cat-list" value="${escapeHtml(product.category || '')}" placeholder="如：家清 / 美妆 / 食品">
          <datalist id="cat-list">${categories.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
        </div>
        <div class="form-group">
          <label class="form-label">脚本风格</label>
          <select class="form-select" id="pf-scriptStyle">
            <option value="不限" ${(!product.scriptStyle || product.scriptStyle === '不限') ? 'selected' : ''}>不限</option>
            <option value="国货" ${product.scriptStyle === '国货' ? 'selected' : ''}>国货</option>
            <option value="达人种草" ${product.scriptStyle === '达人种草' ? 'selected' : ''}>达人种草</option>
            <option value="老板人设" ${product.scriptStyle === '老板人设' ? 'selected' : ''}>老板人设</option>
            <option value="家庭视角" ${product.scriptStyle === '家庭视角' ? 'selected' : ''}>家庭视角</option>
            <option value="网感营销" ${product.scriptStyle === '网感营销' ? 'selected' : ''}>网感营销</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">商品卖点 <span class="required">*</span></label>
        <textarea class="form-textarea" id="pf-points" rows="3" placeholder="请输入产品卖点，如“饱和度高；不易脱妆”，多个卖点使用回车或分号分隔">${(product.sellingPoints || []).join('；')}</textarea>
        <div class="form-hint">多个卖点使用回车或分号分隔</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">优惠活动 <span class="text-muted text-sm" style="font-weight:400">（选填）</span></label>
          <input class="form-input" id="pf-price" value="${escapeHtml(product.price || '')}" placeholder="请输入价格 / 优惠活动，如“拍一发三”、“99 元三件”">
        </div>
        <div class="form-group">
          <label class="form-label">脚本字数</label>
          <select class="form-select" id="pf-scriptWords">
            <option value="auto" ${(!product.scriptWords || product.scriptWords === 'auto') ? 'selected' : ''}>自动匹配</option>
            <option value="100" ${product.scriptWords === '100' ? 'selected' : ''}>100字以内</option>
            <option value="200" ${product.scriptWords === '200' ? 'selected' : ''}>100-200字</option>
            <option value="300" ${product.scriptWords === '300' ? 'selected' : ''}>200-300字</option>
            <option value="400" ${product.scriptWords === '400' ? 'selected' : ''}>300-400字</option>
            <option value="500" ${product.scriptWords === '500' ? 'selected' : ''}>300-500字</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">适用人群 <span class="text-muted text-sm" style="font-weight:400">（选填）</span></label>
          <input class="form-input" id="pf-audience" value="${escapeHtml(product.targetAudience || '')}" placeholder="如：宝妈；小姐姐">
        </div>
        <div class="form-group">
          <label class="form-label">用户痛点 <span class="text-muted text-sm" style="font-weight:400">（选填）</span></label>
          <input class="form-input" id="pf-pains" value="${(product.painPoints || []).join('；')}" placeholder="如：没气色；价格昂贵">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">适用场景 <span class="text-muted text-sm" style="font-weight:400">（选填）</span></label>
        <input class="form-input" id="pf-scenes" value="${(product.scenes || []).join('；')}" placeholder="如：约会">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">取消</button>
      ${id ? `<button class="btn btn-danger" onclick="deleteProduct('${id}')">删除</button>` : ''}
      <button class="btn btn-primary" onclick="saveProductForm('${id || ''}', this)">${id ? '保存修改' : '添加产品'}</button>
    </div>
  `;

  modal(html, 'lg');
}

function saveProductForm(id, btn) {
  const overlay = btn.closest('.modal-overlay');
  const name = $('#pf-name', overlay).value.trim();
  const sellingPointsText = $('#pf-points', overlay).value.trim();

  if (!name) { toast('请输入商品名称', 'error'); return; }
  if (!sellingPointsText) { toast('请输入商品卖点', 'error'); return; }

  // 卖点/痛点/场景用回车或分号分隔
  const splitVal = s => s.split(/[；;\n]/).map(x => x.trim()).filter(Boolean);

  const product = {
    id: id || undefined,
    name,
    category: $('#pf-category', overlay).value.trim(),
    scriptStyle: $('#pf-scriptStyle', overlay).value,
    scriptWords: $('#pf-scriptWords', overlay).value,
    sellingPoints: splitVal($('#pf-points', overlay).value),
    price: $('#pf-price', overlay).value.trim(),
    targetAudience: $('#pf-audience', overlay).value.trim(),
    painPoints: splitVal($('#pf-pains', overlay).value),
    scenes: splitVal($('#pf-scenes', overlay).value)
  };

  Store.saveProduct(product);
  closeModal(overlay);
  renderProducts($('.content'));
  renderSidebar();
  toast(id ? '产品已更新' : '产品已添加');
}

function deleteProduct(id) {
  if (!confirm('确定删除该产品？关联的文案也会被删除。')) return;
  Store.deleteProduct(id);
  closeModal(document.querySelector('.modal'));
  renderProducts($('.content'));
  renderSidebar();
  toast('产品已删除', 'warn');
}

function productDetail(id) {
  const p = Store.getProduct(id);
  if (!p) return;
  const copies = Store.getCopies({ productId: id });

  const html = `
    <div class="modal-header">
      <div class="modal-title">📦 ${escapeHtml(p.name)}</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="flex gap-2 flex-wrap mb-4">
        ${p.category ? `<span class="tag tag-blue">${escapeHtml(p.category)}</span>` : ''}
        ${getScriptStyleTag(p.scriptStyle)}
        ${p.price ? `<span class="tag tag-amber">💰 ${escapeHtml(p.price)}</span>` : ''}
        ${p.targetAudience ? `<span class="tag tag-purple">👥 ${escapeHtml(p.targetAudience)}</span>` : ''}
        <span class="tag tag-gray">📝 ${getScriptWordsLabel(p.scriptWords)}</span>
        <span class="tag tag-gray">✍️ ${copies.length} 篇文案</span>
      </div>

      <div class="divider"></div>

      ${p.sellingPoints && p.sellingPoints.length ? `
        <div class="section-title">🎯 商品卖点</div>
        <div class="flex gap-2 flex-wrap mb-4">
          ${p.sellingPoints.map(sp => `<span class="tag tag-blue">${escapeHtml(sp)}</span>`).join('')}
        </div>
      ` : ''}

      ${p.painPoints && p.painPoints.length ? `
        <div class="section-title">😣 用户痛点</div>
        <div class="flex gap-2 flex-wrap mb-4">
          ${p.painPoints.map(pp => `<span class="tag tag-red">${escapeHtml(pp)}</span>`).join('')}
        </div>
      ` : ''}

      ${p.scenes && p.scenes.length ? `
        <div class="section-title">📍 适用场景</div>
        <div class="flex gap-2 flex-wrap mb-4">
          ${p.scenes.map(s => `<span class="tag tag-green">${escapeHtml(s)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="divider"></div>

      <div class="section-title">关联文案 (${copies.length})</div>
      ${copies.length === 0 ? `
        <div class="text-sm text-muted mb-4">暂无关联文案</div>
      ` : `
        <div class="table-wrapper mb-4">
          <table>
            <thead><tr><th>标题</th><th>故事线</th><th>来源</th><th>状态</th><th>时间</th></tr></thead>
            <tbody>
              ${copies.map(c => `
                <tr>
                  <td>${escapeHtml(c.title || '(无标题)')}</td>
                  <td>${getFrameworkTag(c.framework)}</td>
                  <td>${getSourceTag(c.source)}</td>
                  <td>${c.isBestseller ? '<span class="tag tag-bestseller">🔥 爆款</span>' : '<span class="tag tag-gray">普通</span>'}</td>
                  <td class="text-xs">${fmtDate(c.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="closeModal(document.querySelector('.modal')); navigate('generate'); selectProductForGen('${p.id}')">✍️ 为此产品生成文案</button>
        <button class="btn btn-sm" onclick="productForm('${p.id}')">✏️ 编辑</button>
      </div>
    </div>
  `;

  modal(html, 'lg');
}

// ==========================================
// PAGE 2: 文案生成 (DeepSeek API)
// ==========================================
function renderGenerate(el) {
  const products = Store.getProducts();
  const hasApiKey = Store.getSetting('deepseek_api_key', '');
  const _p = App.selectedProduct ? Store.getProduct(App.selectedProduct) : null;
  const _style = App.genInputs.scriptStyle || (_p && _p.scriptStyle) || '不限';
  const _words = App.genInputs.scriptWords || (_p && _p.scriptWords) || 'auto';

  el.innerHTML = `
    ${!hasApiKey ? `
      <div class="card mb-4" style="border-color:var(--amber);background:var(--amber-bg)">
        <div class="flex items-center gap-2">
          <span style="font-size:20px">⚠️</span>
          <div>
            <div class="font-bold" style="color:var(--amber)">尚未配置 DeepSeek API Key</div>
            <div class="text-sm" style="color:var(--gray-600)">点击右上角 ⚙️ 设置按钮配置，或 <a onclick="settingsModal()" style="color:var(--primary);cursor:pointer;text-decoration:underline">点此配置</a></div>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="flex gap-4" style="align-items:flex-start">
      <!-- 左侧主区域 -->
      <div style="flex:1;min-width:0">
        <!-- 1. 选产品 -->
        <div class="section-title">1. 选择产品</div>
        ${products.length === 0 ? `
          <div class="empty-state" style="padding:24px">
            <div class="empty-icon">📦</div>
            <div class="empty-text">还没有产品</div>
            <button class="btn btn-primary" onclick="navigate('products')">去添加产品</button>
          </div>
        ` : `
          <div class="product-selector mb-4">
            ${products.map(p => `
              <div class="selector-card ${App.selectedProduct === p.id ? 'selected' : ''}" onclick="selectProductForGen('${p.id}')">
                <div class="selector-card-name">${escapeHtml(p.name)}</div>
                <div class="selector-card-cat">${escapeHtml(p.category || '未分类')}</div>
              </div>
            `).join('')}
          </div>
        `}

        <!-- 2. 选故事线 -->
        ${App.selectedProduct ? `
          <div class="section-title">2. 选择故事线</div>
          <div class="framework-grid mb-4">
            ${FRAMEWORKS.map(fw => `
              <div class="framework-card ${App.selectedFramework === fw.id ? 'selected' : ''}"
                style="${App.selectedFramework === fw.id ? `border-color:${fw.color};background:${fw.bg}` : ''}"
                onclick="selectFramework('${fw.id}')">
                <div class="framework-card-name" style="color:${fw.color}">${fw.icon} ${fw.name}</div>
                <div class="framework-card-structure">${fw.structure}</div>
                <div class="framework-card-desc">${fw.desc}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- 3. 生成配置 + 结果 -->
        ${App.selectedProduct && App.selectedFramework ? `
          <div class="section-title">3. 生成文案</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">脚本风格</label>
              <select class="form-select" id="gen-scriptStyle" onchange="App.genInputs.scriptStyle=this.value">
                <option value="不限" ${_style === '不限' ? 'selected' : ''}>不限</option>
                <option value="国货" ${_style === '国货' ? 'selected' : ''}>国货</option>
                <option value="达人种草" ${_style === '达人种草' ? 'selected' : ''}>达人种草</option>
                <option value="老板人设" ${_style === '老板人设' ? 'selected' : ''}>老板人设</option>
                <option value="家庭视角" ${_style === '家庭视角' ? 'selected' : ''}>家庭视角</option>
                <option value="网感营销" ${_style === '网感营销' ? 'selected' : ''}>网感营销</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">脚本字数</label>
              <select class="form-select" id="gen-scriptWords" onchange="App.genInputs.scriptWords=this.value">
                <option value="auto" ${_words === 'auto' ? 'selected' : ''}>自动匹配</option>
                <option value="100" ${_words === '100' ? 'selected' : ''}>100字以内</option>
                <option value="200" ${_words === '200' ? 'selected' : ''}>100-200字</option>
                <option value="300" ${_words === '300' ? 'selected' : ''}>200-300字</option>
                <option value="400" ${_words === '400' ? 'selected' : ''}>300-400字</option>
                <option value="500" ${_words === '500' ? 'selected' : ''}>300-500字</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">特殊要求 / 额外指令（可选）</label>
            <textarea class="form-textarea" id="gen-instructions" rows="3" placeholder="例：突出性价比 / 强调限时活动 / 针对宝妈群体优化 / 语气更夸张一些..." oninput="App.genInputs.instructions=this.value">${escapeHtml(App.genInputs.instructions || '')}</textarea>
            <div class="form-hint">系统会自动学习同品类爆款素材的风格，这里可以补充额外要求</div>
          </div>

          <button class="btn btn-primary" id="gen-btn" onclick="generateWithAI()" style="width:100%;justify-content:center;padding:12px;font-size:15px">
            ✨ AI 生成文案
          </button>

          <!-- 生成结果 -->
          <div id="gen-result-area" style="display:none;margin-top:16px">
            <div class="form-group">
              <label class="form-label">文案标题</label>
              <input class="form-input" id="gen-result-title">
            </div>
            <div class="form-group">
              <label class="form-label">文案内容 <span class="tag tag-green">可编辑</span></label>
              <textarea class="form-textarea" id="gen-result-content" rows="14" style="min-height:320px;line-height:1.8"></textarea>
              <div class="form-hint"><span id="word-count">0</span> 字</div>
            </div>
            <div class="flex gap-2">
              <button class="btn" onclick="copyGenResult()">📋 复制</button>
              <button class="btn btn-primary" onclick="saveGenResult()">💾 保存到文案库</button>
              <button class="btn" onclick="generateWithAI()">🔄 重新生成</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 右侧信息栏 -->
      <div style="width:280px;flex-shrink:0">
        ${App.selectedProduct ? `
          <div class="card" style="padding:14px;margin-bottom:16px">
            <div class="section-title" style="margin-bottom:8px">产品信息</div>
            ${renderProductSummary(App.selectedProduct)}
          </div>
        ` : ''}

        ${App.selectedProduct ? (() => {
          const product = Store.getProduct(App.selectedProduct);
          const refs = Store.getReferences({ category: product.category });
          return `
            <div class="card" style="padding:14px;margin-bottom:16px">
              <div class="section-title" style="margin-bottom:8px">📚 参考素材 (${refs.length})</div>
              ${refs.length === 0 ? `
                <div class="text-sm text-muted">该品类暂无参考素材，AI 将基于产品信息直接生成</div>
              ` : `
                <div class="flex gap-2" style="flex-direction:column">
                  ${refs.slice(0, 5).map(r => `
                    <div class="copy-content" style="max-height:80px;font-size:12px;cursor:pointer" onclick="referenceDetail('${r.id}')">
                      ${getFrameworkTag(r.framework)}
                      <div class="mt-2">${escapeHtml(r.content.slice(0, 100))}...</div>
                    </div>
                  `).join('')}
                </div>
                <div class="text-xs text-muted mt-2">💡 AI 会自动学习以上素材风格</div>
              `}
            </div>
          `;
        })() : ''}

        ${App.selectedFramework ? (() => {
          const fw = Store.getFrameworkById(App.selectedFramework);
          return `
            <div class="card" style="padding:14px">
              <div class="section-title" style="margin-bottom:8px">${fw.icon} 故事线引导</div>
              <div class="text-sm mb-2" style="color:${fw.color}">${fw.structure}</div>
              ${fw.steps.map((step, i) => `
                <div class="text-xs mb-2">
                  <span style="font-weight:700;color:${fw.color}">${i + 1}. ${step}</span><br>
                  <span class="text-muted">${fw.guide[i]}</span>
                </div>
              `).join('')}
            </div>
          `;
        })() : ''}
      </div>
    </div>
  `;

  // 恢复已有结果
  if (App.genInputs.generated) {
    const resultArea = $('#gen-result-area');
    if (resultArea) {
      resultArea.style.display = 'block';
      $('#gen-result-title').value = App.genInputs.title || '';
      $('#gen-result-content').value = App.genInputs.generated;
      $('#word-count').textContent = App.genInputs.generated.length;
    }
  }
}

function selectProductForGen(id) {
  App.selectedProduct = id;
  App.selectedFramework = null;
  App.genInputs = {};
  renderGenerate($('.content'));
}

function selectFramework(id) {
  App.selectedFramework = id;
  App.genInputs = {};
  renderGenerate($('.content'));
}

function renderProductSummary(id) {
  const p = Store.getProduct(id);
  if (!p) return '';
  return `
    <div class="card-header">
      <div class="card-title">📦 ${escapeHtml(p.name)}</div>
      <div class="flex gap-2 flex-wrap">
        ${p.category ? `<span class="tag tag-blue">${escapeHtml(p.category)}</span>` : ''}
        ${getScriptStyleTag(p.scriptStyle)}
        ${p.price ? `<span class="tag tag-amber">💰 ${escapeHtml(p.price)}</span>` : ''}
        ${p.targetAudience ? `<span class="tag tag-purple">👥 ${escapeHtml(p.targetAudience)}</span>` : ''}
        <span class="tag tag-gray">📝 ${getScriptWordsLabel(p.scriptWords)}</span>
      </div>
    </div>
    <div class="flex gap-4 flex-wrap">
      ${p.sellingPoints && p.sellingPoints.length ? `
        <div style="flex:1;min-width:160px">
          <div class="text-xs font-bold" style="color:var(--blue);margin-bottom:4px">🎯 卖点</div>
          <div class="flex gap-2 flex-wrap">${p.sellingPoints.map(s => `<span class="tag tag-blue">${escapeHtml(s)}</span>`).join('')}</div>
        </div>
      ` : ''}
      ${p.scenes && p.scenes.length ? `
        <div style="flex:1;min-width:160px">
          <div class="text-xs font-bold" style="color:var(--green);margin-bottom:4px">📍 场景</div>
          <div class="flex gap-2 flex-wrap">${p.scenes.map(s => `<span class="tag tag-green">${escapeHtml(s)}</span>`).join('')}</div>
        </div>
      ` : ''}
      ${p.painPoints && p.painPoints.length ? `
        <div style="flex:1;min-width:160px">
          <div class="text-xs font-bold" style="color:var(--red);margin-bottom:4px">😣 痛点</div>
          <div class="flex gap-2 flex-wrap">${p.painPoints.map(s => `<span class="tag tag-red">${escapeHtml(s)}</span>`).join('')}</div>
        </div>
      ` : ''}
    </div>
  `;
}

// ========== DeepSeek API 调用 ==========
async function generateWithAI() {
  const product = Store.getProduct(App.selectedProduct);
  const fw = Store.getFrameworkById(App.selectedFramework);
  if (!product || !fw) { toast('请先选择产品和故事线', 'error'); return; }

  const apiKey = Store.getSetting('deepseek_api_key', '');
  if (!apiKey) { toast('请先配置 DeepSeek API Key', 'error'); settingsModal(); return; }

  const model = Store.getSetting('deepseek_model', 'deepseek-chat');
  const instructions = $('#gen-instructions')?.value || '';
  const genStyle = $('#gen-scriptStyle')?.value || product.scriptStyle || '不限';
  const genWords = $('#gen-scriptWords')?.value || product.scriptWords || 'auto';
  const productForGen = { ...product, scriptStyle: genStyle, scriptWords: genWords };
  const refs = Store.getReferences({ category: product.category });
  const prompt = Store.buildGenPrompt(productForGen, fw.id, refs, instructions);

  // Loading 状态
  const btn = $('#gen-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ AI 正在生成文案...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是一位专业的信息流短视频带货文案写手，擅长用口语化的方式写出高转化的带货文案。你写的文案纯文案、无标注、自然流畅、抓人眼球。不要输出多余的解释，只输出文案本身。' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0.85,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // 展示结果
    App.genInputs.generated = content;
    App.genInputs.title = `${product.name}-${fw.name}文案`;

    const resultArea = $('#gen-result-area');
    resultArea.style.display = 'block';
    $('#gen-result-title').value = App.genInputs.title;
    $('#gen-result-content').value = content;
    $('#word-count').textContent = content.length;

    // 字数实时统计
    $('#gen-result-content').addEventListener('input', function() {
      $('#word-count').textContent = this.value.length;
    });

    toast('文案生成成功！');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error('DeepSeek API error:', err);
    toast('生成失败：' + err.message, 'error');
    // 降级方案：复制提示词供手动使用
    if (confirm('API 调用失败，是否复制生成的提示词用于手动生成？')) {
      navigator.clipboard.writeText(prompt).then(() => toast('提示词已复制到剪贴板'));
    }
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

function copyGenResult() {
  const content = $('#gen-result-content')?.value;
  if (content) navigator.clipboard.writeText(content).then(() => toast('文案已复制到剪贴板'));
}

function saveGenResult() {
  const fw = Store.getFrameworkById(App.selectedFramework);
  const product = Store.getProduct(App.selectedProduct);
  const title = $('#gen-result-title')?.value.trim();
  const content = $('#gen-result-content')?.value.trim();

  if (!content) { toast('文案内容不能为空', 'error'); return; }

  Store.saveCopy({
    productId: product.id,
    productName: product.name,
    category: product.category,
    framework: fw.id,
    title: title || `${product.name}-${fw.name}`,
    content,
    source: 'ai',
    isBestseller: false
  });

  toast('文案已保存到文案库');
  renderSidebar();
}

// ==========================================
// PAGE 3: 爆款仿写
// ==========================================
function renderImitate(el) {
  const products = Store.getProducts();
  const hasApiKey = Store.getSetting('deepseek_api_key', '');

  el.innerHTML = `
    ${!hasApiKey ? `
      <div class="card mb-4" style="border-color:var(--amber);background:var(--amber-bg)">
        <div class="flex items-center gap-2">
          <span style="font-size:20px">⚠️</span>
          <div>
            <div class="font-bold" style="color:var(--amber)">尚未配置 DeepSeek API Key</div>
            <div class="text-sm" style="color:var(--gray-600)">点击右上角 ⚙️ 设置按钮配置，或 <a onclick="settingsModal()" style="color:var(--primary);cursor:pointer;text-decoration:underline">点此配置</a></div>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="flex gap-4" style="align-items:flex-start">
      <!-- 左侧主区域 -->
      <div style="flex:1;min-width:0">
        <!-- 1. 粘贴爆款原文 -->
        <div class="section-title">1. 粘贴爆款文案</div>
        <div class="form-group">
          <textarea class="form-textarea" id="imit-source" rows="6" placeholder="把你要仿写的爆款文案粘贴在这里，可以是同品类的，也可以是其他品类的。AI 会学习它的风格、节奏、结构、话术技巧，然后针对你的产品重新写一篇。" oninput="App.imitateInputs.source=this.value">${escapeHtml(App.imitateInputs.source || '')}</textarea>
          <div class="form-hint">支持同品类或不同品类的文案。从素材库选也可以：${renderRefsQuickPick()}</div>
        </div>

        <!-- 2. 选择目标产品（可选） -->
        <div class="section-title">2. 选择目标产品 <span class="text-muted text-sm" style="font-weight:400">（可选，不选则只仿风格不限定产品）</span></div>
        ${products.length === 0 ? `
          <div class="text-sm text-muted mb-4">未选产品或无产品，AI 将纯仿风格。如需绑定产品请先到「产品归档」添加。</div>
        ` : `
          <div class="product-selector mb-4">
            ${products.map(p => `
              <div class="selector-card ${App.imitateInputs.productId === p.id ? 'selected' : ''}" onclick="selectProductForImitate('${p.id}')">
                <div class="selector-card-name">${escapeHtml(p.name)}</div>
                <div class="selector-card-cat">${escapeHtml(p.category || '未分类')}</div>
              </div>
            `).join('')}
          </div>
        `}

        <!-- 3. 额外指令 -->
        <div class="section-title">3. 仿写指令 <span class="text-muted text-sm" style="font-weight:400">（可选）</span></div>
        <div class="form-group">
          <textarea class="form-textarea" id="imit-instructions" rows="3" placeholder="例：保持原文的开头钩子手法 / 更口语化一些 / 突出性价比 / 字数压缩到200字以内..." oninput="App.imitateInputs.instructions=this.value">${escapeHtml(App.imitateInputs.instructions || '')}</textarea>
        </div>

        <button class="btn btn-primary" id="imit-btn" onclick="imitateWithAI()" style="width:100%;justify-content:center;padding:12px;font-size:15px">
          🔄 AI 仿写文案
        </button>

        <!-- 仿写结果 -->
        <div id="imit-result-area" style="display:none;margin-top:16px">
          <div class="form-group">
            <label class="form-label">文案标题</label>
            <input class="form-input" id="imit-result-title">
          </div>
          <div class="form-group">
            <label class="form-label">文案内容 <span class="tag tag-green">可编辑</span></label>
            <textarea class="form-textarea" id="imit-result-content" rows="14" style="min-height:320px;line-height:1.8"></textarea>
            <div class="form-hint"><span id="imit-word-count">0</span> 字</div>
          </div>
          <div class="flex gap-2">
            <button class="btn" onclick="copyImitResult()">📋 复制</button>
            <button class="btn btn-primary" onclick="saveImitResult()">💾 保存到文案库</button>
            <button class="btn" onclick="imitateWithAI()">🔄 重新仿写</button>
          </div>
        </div>
      </div>

      <!-- 右侧信息栏 -->
      <div style="width:280px;flex-shrink:0">
        <!-- 原文分析 -->
        <div class="card" style="padding:14px;margin-bottom:16px">
          <div class="section-title" style="margin-bottom:8px">📊 原文分析</div>
          <div id="imit-analysis" class="text-sm text-muted">粘贴原文后自动分析字数和故事线</div>
        </div>

        <!-- 产品信息 -->
        ${App.imitateInputs.productId ? `
          <div class="card" style="padding:14px;margin-bottom:16px">
            <div class="section-title" style="margin-bottom:8px">目标产品</div>
            ${renderProductSummary(App.imitateInputs.productId)}
          </div>
        ` : `
          <div class="card" style="padding:14px;margin-bottom:16px">
            <div class="section-title" style="margin-bottom:8px">💡 使用提示</div>
            <div class="text-xs text-muted" style="line-height:1.6">
              • 粘贴你想仿写的爆款文案<br>
              • 可选同品类或不同品类<br>
              • 选产品后 AI 会将原文风格套用到你的产品上<br>
              • 不选产品则纯仿风格写通用文案<br>
              • AI 学风格不照搬，产出全新内容
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  // 恢复已有结果
  if (App.imitateInputs.generated) {
    const resultArea = $('#imit-result-area');
    if (resultArea) {
      resultArea.style.display = 'block';
      $('#imit-result-title').value = App.imitateInputs.title || '';
      $('#imit-result-content').value = App.imitateInputs.generated;
      $('#imit-word-count').textContent = App.imitateInputs.generated.length;
    }
  }

  // 原文分析
  const sourceTextarea = $('#imit-source');
  function updateAnalysis() {
    const text = sourceTextarea.value.trim();
    const analysis = $('#imit-analysis');
    if (!text) {
      analysis.innerHTML = '<span class="text-muted">粘贴原文后自动分析字数和故事线</span>';
      return;
    }
    const fw = Store.detectFramework(text);
    analysis.innerHTML = `
      <div class="flex gap-2 flex-wrap" style="align-items:center">
        <span><span class="text-muted">字数：</span><span class="font-bold">${text.length}</span></span>
        ${fw ? getFrameworkTag(fw) : '<span class="tag tag-gray">未识别</span>'}
      </div>
    `;
  }
  sourceTextarea.addEventListener('input', updateAnalysis);
  updateAnalysis();
}

function renderRefsQuickPick() {
  const refs = Store.getReferences();
  if (refs.length === 0) return '暂无素材';
  return refs.slice(0, 3).map(r => `<a onclick="pickRefForImitate('${r.id}')" style="color:var(--primary);cursor:pointer;text-decoration:underline">${escapeHtml(r.title || r.content.slice(0,12)+'...')}</a>`).join(' / ');
}

function pickRefForImitate(refId) {
  const ref = Store.getReferences().find(r => r.id === refId);
  if (!ref) return;
  App.imitateInputs.source = ref.content;
  renderImitate($('.content'));
  toast('已填充素材：' + (ref.title || '素材'), 'info');
}

function selectProductForImitate(id) {
  if (App.imitateInputs.productId === id) {
    App.imitateInputs.productId = null;
  } else {
    App.imitateInputs.productId = id;
  }
  renderImitate($('.content'));
}

// ========== 仿写 DeepSeek API 调用 ==========
async function imitateWithAI() {
  const sourceText = $('#imit-source')?.value.trim();
  if (!sourceText) { toast('请先粘贴要仿写的爆款文案', 'error'); return; }
  if (sourceText.length < 20) { toast('原文太短，至少粘贴20字以上文案', 'error'); return; }

  const apiKey = Store.getSetting('deepseek_api_key', '');
  if (!apiKey) { toast('请先配置 DeepSeek API Key', 'error'); settingsModal(); return; }

  const model = Store.getSetting('deepseek_model', 'deepseek-chat');
  const instructions = $('#imit-instructions')?.value || '';
  const product = App.imitateInputs.productId ? Store.getProduct(App.imitateInputs.productId) : null;
  const prompt = Store.buildImitatePrompt(sourceText, product, instructions);

  // Loading 状态
  const btn = $('#imit-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ AI 正在仿写文案...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是一位专业的信息流短视频带货文案写手，擅长学习爆款文案的风格和节奏，写出同风格但针对新产品的全新文案。你写的文案纯文案、无标注、自然流畅、抓人眼球。不要输出多余的解释，只输出文案本身。' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0.85,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // 展示结果
    App.imitateInputs.generated = content;
    App.imitateInputs.title = product ? `${product.name}-仿写文案` : '仿写文案';

    const resultArea = $('#imit-result-area');
    resultArea.style.display = 'block';
    $('#imit-result-title').value = App.imitateInputs.title;
    $('#imit-result-content').value = content;
    $('#imit-word-count').textContent = content.length;

    $('#imit-result-content').addEventListener('input', function() {
      $('#imit-word-count').textContent = this.value.length;
    });

    toast('仿写成功！');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error('DeepSeek API error:', err);
    toast('仿写失败：' + err.message, 'error');
    if (confirm('API 调用失败，是否复制提示词用于手动生成？')) {
      navigator.clipboard.writeText(prompt).then(() => toast('提示词已复制到剪贴板'));
    }
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

function copyImitResult() {
  const content = $('#imit-result-content')?.value;
  if (content) navigator.clipboard.writeText(content).then(() => toast('文案已复制到剪贴板'));
}

function saveImitResult() {
  const title = $('#imit-result-title')?.value.trim();
  const content = $('#imit-result-content')?.value.trim();
  if (!content) { toast('文案内容不能为空', 'error'); return; }

  const sourceText = App.imitateInputs.source || '';
  const product = App.imitateInputs.productId ? Store.getProduct(App.imitateInputs.productId) : null;
  const fw = sourceText ? Store.detectFramework(sourceText) : null;

  Store.saveCopy({
    productId: product ? product.id : '',
    productName: product ? product.name : '',
    category: product ? product.category : '',
    framework: fw || '',
    title: title || '仿写文案',
    content,
    source: 'imitate',
    isBestseller: false
  });

  toast('仿写文案已保存到文案库');
  renderSidebar();
}

// ========== 设置弹窗 ==========
function settingsModal() {
  const apiKey = Store.getSetting('deepseek_api_key', '');
  const model = Store.getSetting('deepseek_model', 'deepseek-chat');
  const lcAppId = Store.getSetting('leancloud_app_id', '');
  const lcAppKey = Store.getSetting('leancloud_app_key', '');
  const syncName = Store.getSetting('cloud_sync_name', '');
  const cloudReady = typeof Cloud !== 'undefined' && Cloud.isReady();

  const html = `
    <div class="modal-header">
      <div class="modal-title">⚙️ 设置</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <!-- DeepSeek API -->
      <div class="section-title">🤖 DeepSeek API</div>
      <div class="form-group">
        <label class="form-label">API Key <span class="required">*</span></label>
        <input type="password" class="form-input" id="set-apikey" value="${escapeHtml(apiKey)}" placeholder="sk-xxxxxxxxxxxxx">
        <div class="form-hint">
          获取方式：登录 <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--primary)">DeepSeek 开放平台</a> → API Keys → 创建
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">模型</label>
        <select class="form-select" id="set-model">
          <option value="deepseek-chat" ${model === 'deepseek-chat' ? 'selected' : ''}>DeepSeek Chat（通用，推荐）</option>
          <option value="deepseek-reasoner" ${model === 'deepseek-reasoner' ? 'selected' : ''}>DeepSeek Reasoner（推理增强）</option>
        </select>
        <div class="form-hint">Chat 模型性价比高、速度快；Reasoner 推理能力强、文案更有逻辑</div>
      </div>

      <div class="divider" style="margin:20px 0"></div>

      <!-- 云端同步 -->
      <div class="section-title">☁️ 云端同步（LeanCloud）</div>
      <div class="card mb-4" style="background:${cloudReady ? 'var(--green-bg,#e8f5e9)' : 'var(--amber-bg,#fff8e1)'};border:1px solid ${cloudReady ? 'var(--green)' : 'var(--amber)'};padding:10px 14px">
        <div class="flex items-center gap-2">
          <span style="font-size:16px">${cloudReady ? '✅' : '⚠️'}</span>
          <div>
            <div class="font-bold" style="color:${cloudReady ? 'var(--green)' : 'var(--amber)'}">${cloudReady ? '云同步已连接' : '云同步未开启'}</div>
            <div class="text-xs" style="color:var(--gray-600)">${cloudReady ? '同步名称：' + escapeHtml(syncName) + ' · 数据自动在设备间同步' : '配置后可在多设备间同步数据'}</div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">同步名称</label>
        <input class="form-input" id="set-syncname" value="${escapeHtml(syncName)}" placeholder="如：我的文案库（多设备用相同名称同步）">
        <div class="form-hint">不同设备输入<b>相同的同步名称</b>即可共享同一份数据</div>
      </div>

      <div class="form-group">
        <label class="form-label">LeanCloud App ID</label>
        <input class="form-input" id="set-lc-appid" value="${escapeHtml(lcAppId)}" placeholder="如：xYz123AbC456...">
        <div class="form-hint">在 LeanCloud 控制台 → 设置 → 应用凭证 中查看</div>
      </div>

      <div class="form-group">
        <label class="form-label">LeanCloud App Key</label>
        <input type="password" class="form-input" id="set-lc-appkey" value="${escapeHtml(lcAppKey)}" placeholder="如：aBcDeFgHiJkLmNoPqRsTuVwXyZ...">
        <div class="form-hint">App ID 和 App Key 成对使用，缺一不可</div>
      </div>

      <div class="card" style="background:var(--gray-50,#f9fafb);border:1px solid var(--gray-200,#e5e7eb);padding:12px 14px;margin-bottom:12px">
        <div class="text-xs" style="line-height:2;color:var(--gray-600)">
          <div class="font-bold mb-1" style="color:var(--gray-700)">📋 LeanCloud 配置步骤（约3分钟）</div>
          <b>1.</b> 打开 <a href="https://console.leancloud.cn" target="_blank" style="color:var(--primary)">LeanCloud 控制台</a>，用手机号注册<br>
          <b>2.</b> 点「创建应用」，名称随意（如"文案库"），选「开发版」（免费）<br>
          <b>3.</b> 进入应用 → 左侧菜单点「设置」→「应用凭证」<br>
          <b>4.</b> 复制 <b>AppID</b> 和 <b>AppKey</b><br>
          <b>5.</b> 粘贴到上方两个输入框，填写同步名称，点「保存设置」
        </div>
      </div>

      <div class="divider" style="margin:20px 0"></div>

      <div class="text-sm" style="line-height:1.7;color:var(--gray-600)">
        <div class="font-bold mb-2" style="color:var(--gray-700)">📌 说明</div>
        • API Key 和 LeanCloud 配置仅存储在本地浏览器<br>
        • 云同步开启后，产品/文案/素材自动在设备间同步<br>
        • API Key 不会同步到其他设备，需各自填写<br>
        • LeanCloud 开发版免费额度充足，个人使用完全够用<br>
        • 如果 API 调用失败（可能是 CORS 限制），可复制提示词手动生成
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">取消</button>
      ${cloudReady ? '<button class="btn" onclick="syncNowBtn(this)">🔄 立即同步</button><button class="btn" style="color:var(--red)" onclick="disconnectCloud(this)">断开云同步</button>' : ''}
      <button class="btn" id="test-btn" onclick="testDeepSeekAPI(this)">🔌 测试API</button>
      <button class="btn btn-primary" onclick="saveSettings(this)">保存设置</button>
    </div>
  `;

  modal(html, 'lg');
}

function syncNowBtn(btn) {
  Cloud.syncNow();
}

function disconnectCloud(btn) {
  if (!confirm('断开云同步后，本设备数据将不再自动同步。已保存的数据不会丢失。确定断开？')) return;
  Cloud.disconnect();
  Store.setSetting('leancloud_app_id', '');
  Store.setSetting('leancloud_app_key', '');
  Store.setSetting('cloud_sync_name', '');
  closeModal(btn.closest('.modal-overlay'));
  toast('云同步已断开', 'warn');
  renderSidebar();
}

async function testDeepSeekAPI(btn) {
  const overlay = btn.closest('.modal-overlay');
  const apiKey = $('#set-apikey', overlay).value.trim();
  const model = $('#set-model', overlay).value;

  if (!apiKey) { toast('请先填写 API Key', 'error'); return; }

  const originalHTML = btn.innerHTML;
  btn.innerHTML = '⏳ 测试中...';
  btn.disabled = true;

  try {
    const t0 = Date.now();
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: '请回复"连接成功"四个字' }
        ],
        stream: false,
        max_tokens: 20,
        temperature: 0
      })
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();

    btn.innerHTML = '✅ 连接成功';
    btn.style.background = 'var(--green)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--green)';
    toast(`连接成功！模型 ${model} 响应 ${elapsed}s，回复：${reply}`);

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.disabled = false;
    }, 4000);

  } catch (err) {
    console.error('DeepSeek API test error:', err);
    let hint = '';
    if (err.message.includes('401') || err.message.includes('403')) {
      hint = 'API Key 无效或已过期';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('load failed')) {
      hint = '网络/CORS 限制，浏览器直连可能被拦截';
    } else if (err.message.includes('429')) {
      hint = '请求频率超限，稍后重试';
    } else if (err.message.includes('503') || err.message.includes('502')) {
      hint = 'DeepSeek 服务繁忙，稍后重试';
    }

    btn.innerHTML = '❌ 连接失败';
    btn.style.background = 'var(--red)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--red)';
    toast(`连接失败：${hint || err.message}${hint ? '（' + err.message + '）' : ''}`, 'error');

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.disabled = false;
    }, 5000);
  }
}

function saveSettings(btn) {
  const overlay = btn.closest('.modal-overlay');
  const apiKey = $('#set-apikey', overlay).value.trim();
  const model = $('#set-model', overlay).value;
  const lcAppId = $('#set-lc-appid', overlay).value.trim();
  const lcAppKey = $('#set-lc-appkey', overlay).value.trim();
  const syncName = $('#set-syncname', overlay).value.trim();

  Store.setSetting('deepseek_api_key', apiKey);
  Store.setSetting('deepseek_model', model);
  Store.setSetting('leancloud_app_id', lcAppId);
  Store.setSetting('leancloud_app_key', lcAppKey);
  Store.setSetting('cloud_sync_name', syncName);

  // 初始化或断开云同步
  if (lcAppId && lcAppKey && syncName) {
    if (typeof Cloud !== 'undefined') {
      Cloud.disconnect();
      Cloud.init();
      if (Cloud.isReady()) {
        toast('云同步已连接！');
      } else {
        toast('云同步连接失败，请检查 LeanCloud 配置', 'error');
      }
    }
  } else {
    if (typeof Cloud !== 'undefined' && Cloud.isReady()) {
      Cloud.disconnect();
      toast('云同步已断开', 'warn');
    }
  }

  closeModal(overlay);
  if (App.currentPage === 'generate') renderGenerate($('.content'));
  renderSidebar();
  toast('设置已保存');
}

// ==========================================
// PAGE 3: 爆款素材库
// ==========================================
function renderReferences(el) {
  const refs = Store.getReferences({
    keyword: App.filters.references.keyword,
    category: App.filters.references.category,
    framework: App.filters.references.framework
  });
  const categories = getAllCategories();

  el.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="搜索素材..." value="${App.filters.references.keyword}"
          oninput="App.filters.references.keyword=this.value; renderReferences($('.content'))">
      </div>
      <select class="form-select" style="width:auto" onchange="App.filters.references.category=this.value; renderReferences($('.content'))">
        <option value="">全部品类</option>
        ${categories.map(c => `<option value="${escapeHtml(c)}" ${App.filters.references.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <select class="form-select" style="width:auto" onchange="App.filters.references.framework=this.value; renderReferences($('.content'))">
        <option value="">全部故事线</option>
        ${FRAMEWORKS.map(f => `<option value="${f.id}" ${App.filters.references.framework === f.id ? 'selected' : ''}>${f.icon} ${f.name}</option>`).join('')}
      </select>
      <button class="btn btn-primary" style="margin-left:auto" onclick="referenceForm()">+ 添加素材</button>
    </div>

    ${refs.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <div class="empty-text">还没有素材，添加爆款文案作为学习参考</div>
        <button class="btn btn-primary" onclick="referenceForm()">+ 添加素材</button>
      </div>
    ` : `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>标题/摘要</th><th>品类</th><th>故事线</th><th>时间</th><th>操作</th></tr></thead>
          <tbody>
            ${refs.map(r => `
              <tr>
                <td style="max-width:400px">
                  <div class="font-bold">${escapeHtml(r.title || '(无标题)')}</div>
                  <div class="text-xs text-muted truncate" style="max-width:380px">${escapeHtml(r.content.slice(0, 80))}...</div>
                </td>
                <td>${r.category ? `<span class="tag tag-blue">${escapeHtml(r.category)}</span>` : '-'}</td>
                <td>${getFrameworkTag(r.framework)}</td>
                <td class="text-xs">${fmtDate(r.createdAt)}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="referenceDetail('${r.id}')">查看</button>
                  <button class="btn btn-ghost btn-sm" onclick="referenceForm('${r.id}')">编辑</button>
                  <button class="btn btn-ghost btn-sm" onclick="deleteReference('${r.id}')">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

function referenceForm(id = null) {
  const ref = id ? Store.getReferences().find(r => r.id === id) : {};
  const categories = getAllCategories();

  const html = `
    <div class="modal-header">
      <div class="modal-title">${id ? '编辑素材' : '添加爆款素材'}</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">品类</label>
          <input class="form-input" id="rf-category" list="cat-list2" value="${escapeHtml(ref.category || '')}" placeholder="例：家清">
          <datalist id="cat-list2">${categories.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
        </div>
        <div class="form-group">
          <label class="form-label">故事线分类</label>
          <select class="form-select" id="rf-framework">
            <option value="">自动识别</option>
            ${FRAMEWORKS.map(f => `<option value="${f.id}" ${ref.framework === f.id ? 'selected' : ''}>${f.icon} ${f.name}</option>`).join('')}
          </select>
          <div class="form-hint" id="rf-detect-hint"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">素材内容 <span class="required">*</span></label>
        <textarea class="form-textarea" id="rf-content" rows="12" placeholder="把爆款文案粘贴在这里，标题会自动生成...">${escapeHtml(ref.content || '')}</textarea>
        <div class="form-hint">💡 标题自动生成 · 系统会自动识别故事线类型</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">取消</button>
      <button class="btn btn-primary" onclick="saveReferenceForm('${id || ''}', this)">${id ? '保存修改' : '添加素材'}</button>
    </div>
  `;

  const overlay = modal(html);
  const contentInput = $('#rf-content', overlay);
  const fwSelect = $('#rf-framework', overlay);
  const detectHint = $('#rf-detect-hint', overlay);

  // 自动识别故事线
  contentInput.addEventListener('input', () => {
    if (fwSelect.value) return; // 手动选了就不覆盖
    const detected = Store.detectFramework(contentInput.value);
    if (detected) {
      const fw = Store.getFrameworkById(detected);
      detectHint.innerHTML = `<span style="color:var(--green)">✓ 检测到：${fw.icon} ${fw.name}</span> <button class="btn btn-ghost btn-sm" onclick="document.getElementById('rf-framework').value='${detected}'">采用</button>`;
    } else {
      detectHint.innerHTML = '<span class="text-muted">未检测到明显故事线特征</span>';
    }
  });

  if (ref.content) contentInput.dispatchEvent(new Event('input'));
}

function saveReferenceForm(id, btn) {
  const overlay = btn.closest('.modal-overlay');
  const content = $('#rf-content', overlay).value.trim();

  if (!content) { toast('请输入素材内容', 'error'); return; }

  let framework = $('#rf-framework', overlay).value;
  if (!framework) framework = Store.detectFramework(content) || '';

  // 自动生成标题
  const fw = framework ? Store.getFrameworkById(framework) : null;
  const firstLine = content.split('\n')[0].trim();
  const snippet = firstLine.length > 15 ? firstLine.slice(0, 15) + '...' : firstLine;
  const title = fw ? `${fw.icon}${fw.name}·${snippet}` : snippet;

  Store.saveReference({
    id: id || undefined,
    title,
    content,
    category: $('#rf-category', overlay).value.trim(),
    framework
  });

  closeModal(overlay);
  renderReferences($('.content'));
  renderSidebar();
  toast(id ? '素材已更新' : '素材已添加');
}

function deleteReference(id) {
  if (!confirm('确定删除该素材？')) return;
  Store.deleteReference(id);
  renderReferences($('.content'));
  renderSidebar();
  toast('素材已删除', 'warn');
}

function referenceDetail(id) {
  const r = Store.getReferences().find(x => x.id === id);
  if (!r) return;

  const html = `
    <div class="modal-header">
      <div class="modal-title">📚 ${escapeHtml(r.title)}</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="flex gap-2 flex-wrap mb-4">
        ${r.category ? `<span class="tag tag-blue">${escapeHtml(r.category)}</span>` : ''}
        ${getFrameworkTag(r.framework)}
        <span class="tag tag-gray">${fmtDate(r.createdAt)}</span>
      </div>
      <div class="copy-content expanded">${escapeHtml(r.content)}</div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">关闭</button>
      <button class="btn btn-primary" onclick="referenceForm('${r.id}')">编辑</button>
    </div>
  `;

  modal(html, 'lg');
}

// ==========================================
// PAGE 4: 文案库
// ==========================================
function renderCopies(el) {
  const copies = Store.getCopies({
    keyword: App.filters.copies.keyword,
    category: App.filters.copies.category,
    framework: App.filters.copies.framework,
    isBestseller: App.filters.copies.bestseller === 'true' ? true : (App.filters.copies.bestseller === 'false' ? false : undefined),
    source: App.filters.copies.source || undefined
  });
  const categories = getAllCategories();

  el.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="搜索文案..." value="${App.filters.copies.keyword}"
          oninput="App.filters.copies.keyword=this.value; renderCopies($('.content'))">
      </div>
      <select class="form-select" style="width:auto" onchange="App.filters.copies.category=this.value; renderCopies($('.content'))">
        <option value="">全部品类</option>
        ${categories.map(c => `<option value="${escapeHtml(c)}" ${App.filters.copies.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <select class="form-select" style="width:auto" onchange="App.filters.copies.framework=this.value; renderCopies($('.content'))">
        <option value="">全部故事线</option>
        ${FRAMEWORKS.map(f => `<option value="${f.id}" ${App.filters.copies.framework === f.id ? 'selected' : ''}>${f.icon} ${f.name}</option>`).join('')}
      </select>
      <select class="form-select" style="width:auto" onchange="App.filters.copies.bestseller=this.value; renderCopies($('.content'))">
        <option value="">全部状态</option>
        <option value="true" ${App.filters.copies.bestseller === 'true' ? 'selected' : ''}>🔥 仅爆款</option>
        <option value="false" ${App.filters.copies.bestseller === 'false' ? 'selected' : ''}>普通文案</option>
      </select>
      <select class="form-select" style="width:auto" onchange="App.filters.copies.source=this.value; renderCopies($('.content'))">
        <option value="">全部来源</option>
        <option value="ai" ${App.filters.copies.source === 'ai' ? 'selected' : ''}>🤖 AI生成</option>
        <option value="imitate" ${App.filters.copies.source === 'imitate' ? 'selected' : ''}>🔄 爆款仿写</option>
        <option value="manual" ${App.filters.copies.source === 'manual' ? 'selected' : ''}>✍️ 手写</option>
      </select>
      <button class="btn btn-primary" style="margin-left:auto" onclick="copyForm()">+ 添加文案</button>
    </div>

    ${copies.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">还没有文案，去生成或手写一篇吧</div>
        <div class="flex gap-2" style="justify-content:center">
          <button class="btn btn-primary" onclick="copyForm()">+ 写一篇文案</button>
          <button class="btn" onclick="navigate('generate')">用 AI 生成</button>
        </div>
      </div>
    ` : `
      <div class="product-grid">
        ${copies.map(c => {
          const fw = Store.getFrameworkById(c.framework);
          return `
            <div class="product-card">
              <div class="product-card-body">
                <div class="flex items-center justify-between mb-2">
                  <div class="product-card-name" style="flex:1">${escapeHtml(c.title || '(无标题)')}</div>
                  ${c.isBestseller ? '<span class="tag tag-bestseller">🔥 爆款</span>' : ''}
                </div>
                <div class="flex gap-2 flex-wrap mb-2">
                  ${getFrameworkTag(c.framework)}
                  ${c.category ? `<span class="tag tag-gray">${escapeHtml(c.category)}</span>` : ''}
                  ${getSourceTag(c.source)}
                </div>
                <div class="copy-content">${escapeHtml(c.content.slice(0, 200))}${c.content.length > 200 ? '...' : ''}</div>
                <div class="text-xs text-muted mt-2">${escapeHtml(c.productName || '')} · ${fmtDate(c.createdAt)}</div>
              </div>
              <div class="product-card-footer">
                <button class="btn btn-ghost btn-sm" onclick="toggleBestseller('${c.id}'); renderCopies($('.content')); renderSidebar()">
                  ${c.isBestseller ? '取消爆款' : '🔥 标记爆款'}
                </button>
                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm" onclick="copyDetail('${c.id}')">查看</button>
                  <button class="btn btn-ghost btn-sm" onclick="copyForm('${c.id}')">编辑</button>
                  <button class="btn btn-ghost btn-sm" onclick="deleteCopy('${c.id}')">删除</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function toggleBestseller(id) {
  Store.toggleBestseller(id);
  toast('爆款状态已更新');
}

function copyForm(id = null) {
  const copy = id ? Store.getCopy(id) : {};
  const products = Store.getProducts();
  const categories = getAllCategories();

  const html = `
    <div class="modal-header">
      <div class="modal-title">${id ? '编辑文案' : '添加文案'}</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">标题 <span class="required">*</span></label>
        <input class="form-input" id="cf-title" value="${escapeHtml(copy.title || '')}" placeholder="文案标题">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">关联产品</label>
          <select class="form-select" id="cf-product">
            <option value="">不关联</option>
            ${products.map(p => `<option value="${p.id}" ${copy.productId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">品类</label>
          <input class="form-input" id="cf-category" list="cat-list3" value="${escapeHtml(copy.category || '')}" placeholder="品类">
          <datalist id="cat-list3">${categories.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">故事线</label>
          <select class="form-select" id="cf-framework">
            <option value="">自动识别</option>
            ${FRAMEWORKS.map(f => `<option value="${f.id}" ${copy.framework === f.id ? 'selected' : ''}>${f.icon} ${f.name}</option>`).join('')}
          </select>
          <div class="form-hint" id="cf-detect-hint"></div>
        </div>
        <div class="form-group">
          <label class="form-label">来源</label>
          <select class="form-select" id="cf-source">
            <option value="manual" ${(!copy.source || copy.source === 'manual') ? 'selected' : ''}>✍️ 手写</option>
            <option value="ai" ${copy.source === 'ai' ? 'selected' : ''}>🤖 AI生成</option>
            <option value="imitate" ${copy.source === 'imitate' ? 'selected' : ''}>🔄 爆款仿写</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">文案内容 <span class="required">*</span></label>
        <textarea class="form-textarea" id="cf-content" rows="10" placeholder="粘贴或撰写文案全文...">${escapeHtml(copy.content || '')}</textarea>
        <div class="form-hint">💡 系统会自动识别故事线类型</div>
      </div>
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" id="cf-bestseller" ${copy.isBestseller ? 'checked' : ''} style="width:auto;margin-right:4px">
          🔥 标记为爆款文案
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">取消</button>
      <button class="btn btn-primary" onclick="saveCopyForm('${id || ''}', this)">${id ? '保存修改' : '添加文案'}</button>
    </div>
  `;

  const overlay = modal(html, 'lg');
  const contentInput = $('#cf-content', overlay);
  const fwSelect = $('#cf-framework', overlay);
  const detectHint = $('#cf-detect-hint', overlay);

  contentInput.addEventListener('input', () => {
    if (fwSelect.value) return;
    const detected = Store.detectFramework(contentInput.value);
    if (detected) {
      const fw = Store.getFrameworkById(detected);
      detectHint.innerHTML = `<span style="color:var(--green)">✓ 检测到：${fw.icon} ${fw.name}</span> <button class="btn btn-ghost btn-sm" onclick="document.getElementById('cf-framework').value='${detected}'">采用</button>`;
    } else {
      detectHint.innerHTML = '<span class="text-muted">未检测到明显故事线</span>';
    }
  });

  if (copy.content) contentInput.dispatchEvent(new Event('input'));

  // 产品联动
  $('#cf-product', overlay).addEventListener('change', function() {
    const p = Store.getProduct(this.value);
    if (p) {
      const catInput = $('#cf-category', overlay);
      if (!catInput.value) catInput.value = p.category || '';
    }
  });
}

function saveCopyForm(id, btn) {
  const overlay = btn.closest('.modal-overlay');
  const title = $('#cf-title', overlay).value.trim();
  const content = $('#cf-content', overlay).value.trim();

  if (!title) { toast('请输入标题', 'error'); return; }
  if (!content) { toast('请输入文案内容', 'error'); return; }

  const productId = $('#cf-product', overlay).value;
  const product = productId ? Store.getProduct(productId) : null;
  let framework = $('#cf-framework', overlay).value;
  if (!framework) framework = Store.detectFramework(content) || '';

  Store.saveCopy({
    id: id || undefined,
    title,
    content,
    productId: productId || null,
    productName: product ? product.name : '',
    category: $('#cf-category', overlay).value.trim() || (product ? product.category : ''),
    framework,
    source: $('#cf-source', overlay).value,
    isBestseller: $('#cf-bestseller', overlay).checked
  });

  closeModal(overlay);
  renderCopies($('.content'));
  renderSidebar();
  toast(id ? '文案已更新' : '文案已添加');
}

function deleteCopy(id) {
  if (!confirm('确定删除该文案？')) return;
  Store.deleteCopy(id);
  renderCopies($('.content'));
  renderSidebar();
  toast('文案已删除', 'warn');
}

function copyDetail(id) {
  const c = Store.getCopy(id);
  if (!c) return;
  const fw = Store.getFrameworkById(c.framework);

  const html = `
    <div class="modal-header">
      <div class="modal-title">${escapeHtml(c.title || '(无标题)')}</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="flex gap-2 flex-wrap mb-4">
        ${getFrameworkTag(c.framework)}
        ${c.category ? `<span class="tag tag-blue">${escapeHtml(c.category)}</span>` : ''}
        ${getSourceTag(c.source)}
        ${c.isBestseller ? '<span class="tag tag-bestseller">🔥 爆款</span>' : ''}
        <span class="tag tag-gray">${fmtDate(c.createdAt)}</span>
      </div>

      ${c.productName ? `<div class="text-sm mb-2"><span class="text-muted">关联产品：</span>${escapeHtml(c.productName)}</div>` : ''}

      <div class="copy-content expanded">${escapeHtml(c.content)}</div>

      <div class="divider"></div>

      <div class="section-title">爆款评分</div>
      ${c.scores ? `
        <div class="flex gap-4 flex-wrap">
          ${BESTSELLER_CRITERIA.map(crit => {
            const score = c.scores[crit.id] || 0;
            return `
              <div style="flex:1;min-width:120px;text-align:center">
                <div class="text-xs font-bold">${crit.name}</div>
                <div style="font-size:20px;font-weight:700;color:${score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'}">${score}</div>
                <div class="text-xs text-muted">/${crit.weight}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="text-center mt-4" style="font-size:28px;font-weight:700;color:var(--primary)">${c.bestsellerScore || 0}<span class="text-sm text-muted"> / 100</span></div>
      ` : `
        <div class="text-sm text-muted">暂无评分，点击下方按钮为文案打分</div>
      `}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">关闭</button>
      <button class="btn" onclick="copyToClipboard('${c.id}')">📋 复制</button>
      <button class="btn" onclick="bestsellerScoring('${c.id}')">📊 打分</button>
      <button class="btn btn-primary" onclick="copyForm('${c.id}')">编辑</button>
    </div>
  `;

  modal(html, 'lg');
}

function copyToClipboard(id) {
  const c = Store.getCopy(id);
  if (c) {
    navigator.clipboard.writeText(c.content).then(() => toast('文案已复制'));
  }
}

function bestsellerScoring(id) {
  const c = Store.getCopy(id);
  if (!c) return;

  const html = `
    <div class="modal-header">
      <div class="modal-title">📊 爆款评分</div>
      <button class="modal-close" onclick="closeModal(this)">✕</button>
    </div>
    <div class="modal-body">
      <div class="text-sm text-muted mb-4">对文案进行五维度评分（0-满分），系统自动计算总分</div>
      ${BESTSELLER_CRITERIA.map(crit => {
        const current = (c.scores && c.scores[crit.id] !== undefined) ? c.scores[crit.id] : crit.weight;
        return `
          <div class="form-group">
            <label class="form-label">${crit.name} <span class="text-muted text-xs">(满分 ${crit.weight})</span></label>
            <div class="text-xs text-muted mb-2">${crit.desc}</div>
            <div class="flex items-center gap-2">
              <input type="range" min="0" max="${crit.weight}" value="${current}" class="flex-1"
                id="score-${crit.id}" oninput="$('#score-val-${crit.id}').textContent=this.value">
              <span id="score-val-${crit.id}" style="width:30px;text-align:center;font-weight:700">${current}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal(this)">取消</button>
      <button class="btn btn-primary" onclick="saveScores('${id}', this)">保存评分</button>
    </div>
  `;

  modal(html);
}

function saveScores(id, btn) {
  const overlay = btn.closest('.modal-overlay');
  const scores = {};
  BESTSELLER_CRITERIA.forEach(crit => {
    scores[crit.id] = parseInt($(`#score-${crit.id}`, overlay).value);
  });
  Store.updateCopyScore(id, scores);
  // 如果总分 >= 80，自动标记为爆款
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total >= 80) {
    const c = Store.getCopy(id);
    if (!c.isBestseller) Store.toggleBestseller(id);
    toast(`评分 ${total}/100，已自动标记为爆款！`);
  } else {
    toast(`评分已保存：${total}/100`);
  }
  closeModal(overlay);
  renderCopies($('.content'));
  renderSidebar();
}

// ==========================================
// 导入导出
// ==========================================
function exportData() {
  const data = Store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `文案库备份_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('数据已导出');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!confirm('导入将覆盖当前所有数据，确定继续？')) return;
        Store.importAll(data);
        renderSidebar();
        navigate(App.currentPage);
        toast('数据导入成功');
      } catch (err) {
        toast('导入失败：文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
