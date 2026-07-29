/**
 * 数据存储层 — 基于 localStorage 的完整 CRUD
 * 管理：产品、文案、素材 三大数据实体
 */
const Store = {
  KEYS: {
    products: 'ccmgl_products',
    copies: 'ccmgl_copies',
    references: 'ccmgl_references',
    settings: 'ccmgl_settings'
  },

  // ========== 通用方法 ==========
  _read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('读取数据失败:', key, e);
      return fallback;
    }
  },

  _write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      // 触发云同步推送（如果已连接且非云端更新中）
      if (typeof Cloud !== 'undefined' && Cloud._ready && !Cloud._applyingCloud) {
        Cloud.push();
      }
      return true;
    } catch (e) {
      console.error('写入数据失败:', key, e);
      return false;
    }
  },

  _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  _now() {
    return new Date().toISOString();
  },

  // ========== 产品管理 ==========
  getProducts() {
    return this._read(this.KEYS.products);
  },

  getProduct(id) {
    return this.getProducts().find(p => p.id === id);
  },

  saveProduct(product) {
    const products = this.getProducts();
    if (product.id) {
      const idx = products.findIndex(p => p.id === product.id);
      if (idx >= 0) {
        product.updatedAt = this._now();
        products[idx] = { ...products[idx], ...product };
      } else {
        products.push(product);
      }
    } else {
      product.id = this._uid();
      product.createdAt = this._now();
      product.updatedAt = product.createdAt;
      products.push(product);
    }
    this._write(this.KEYS.products, products);
    return product;
  },

  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this._write(this.KEYS.products, products);
    // 同时删除关联的文案
    const copies = this.getCopies().filter(c => c.productId !== id);
    this._write(this.KEYS.copies, copies);
  },

  // ========== 文案库 ==========
  getCopies(filter = {}) {
    let copies = this._read(this.KEYS.copies);
    if (filter.category) copies = copies.filter(c => c.category === filter.category);
    if (filter.framework) copies = copies.filter(c => c.framework === filter.framework);
    if (filter.productId) copies = copies.filter(c => c.productId === filter.productId);
    if (filter.isBestseller !== undefined) copies = copies.filter(c => c.isBestseller === filter.isBestseller);
    if (filter.source) copies = copies.filter(c => c.source === filter.source);
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      copies = copies.filter(c =>
        (c.title || '').toLowerCase().includes(kw) ||
        (c.content || '').toLowerCase().includes(kw)
      );
    }
    return copies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getCopy(id) {
    return this._read(this.KEYS.copies).find(c => c.id === id);
  },

  saveCopy(copy) {
    const copies = this._read(this.KEYS.copies);
    if (copy.id) {
      const idx = copies.findIndex(c => c.id === copy.id);
      if (idx >= 0) {
        copy.updatedAt = this._now();
        copies[idx] = { ...copies[idx], ...copy };
      } else {
        copies.push(copy);
      }
    } else {
      copy.id = this._uid();
      copy.createdAt = this._now();
      copy.updatedAt = copy.createdAt;
      copies.push(copy);
    }
    this._write(this.KEYS.copies, copies);
    return copy;
  },

  deleteCopy(id) {
    const copies = this._read(this.KEYS.copies).filter(c => c.id !== id);
    this._write(this.KEYS.copies, copies);
  },

  toggleBestseller(id) {
    const copies = this._read(this.KEYS.copies);
    const copy = copies.find(c => c.id === id);
    if (copy) {
      copy.isBestseller = !copy.isBestseller;
      copy.updatedAt = this._now();
      this._write(this.KEYS.copies, copies);
    }
    return copy;
  },

  updateCopyScore(id, scores) {
    const copies = this._read(this.KEYS.copies);
    const copy = copies.find(c => c.id === id);
    if (copy) {
      copy.scores = scores;
      copy.bestsellerScore = Object.values(scores).reduce((a, b) => a + b, 0);
      copy.updatedAt = this._now();
      this._write(this.KEYS.copies, copies);
    }
    return copy;
  },

  // ========== 素材管理 ==========
  getReferences(filter = {}) {
    let refs = this._read(this.KEYS.references);
    if (filter.category) refs = refs.filter(r => r.category === filter.category);
    if (filter.framework) refs = refs.filter(r => r.framework === filter.framework);
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      refs = refs.filter(r =>
        (r.title || '').toLowerCase().includes(kw) ||
        (r.content || '').toLowerCase().includes(kw)
      );
    }
    return refs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  saveReference(ref) {
    const refs = this._read(this.KEYS.references);
    if (ref.id) {
      const idx = refs.findIndex(r => r.id === ref.id);
      if (idx >= 0) {
        ref.updatedAt = this._now();
        refs[idx] = { ...refs[idx], ...ref };
      } else {
        refs.push(ref);
      }
    } else {
      ref.id = this._uid();
      ref.createdAt = this._now();
      refs.push(ref);
    }
    this._write(this.KEYS.references, refs);
    return ref;
  },

  deleteReference(id) {
    const refs = this._read(this.KEYS.references).filter(r => r.id !== id);
    this._write(this.KEYS.references, refs);
  },

  // ========== 统计 ==========
  getStats() {
    const products = this.getProducts();
    const copies = this._read(this.KEYS.copies);
    const refs = this._read(this.KEYS.references);
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

    const frameworkDist = {};
    FRAMEWORKS.forEach(f => { frameworkDist[f.id] = 0; });
    copies.forEach(c => {
      if (c.framework && frameworkDist[c.framework] !== undefined) frameworkDist[c.framework]++;
    });

    const bestsellerCount = copies.filter(c => c.isBestseller).length;

    return {
      productCount: products.length,
      copyCount: copies.length,
      refCount: refs.length,
      bestsellerCount,
      categoryCount: categories.length,
      categories,
      frameworkDist,
      recentProducts: products.slice(-5).reverse(),
      recentCopies: copies.slice(-5).reverse()
    };
  },

  // ========== 导入导出 ==========
  exportAll() {
    return {
      version: '2.0',
      exportDate: this._now(),
      products: this.getProducts(),
      copies: this._read(this.KEYS.copies),
      references: this._read(this.KEYS.references)
    };
  },

  importAll(data) {
    if (data.products) this._write(this.KEYS.products, data.products);
    if (data.copies) this._write(this.KEYS.copies, data.copies);
    if (data.references) this._write(this.KEYS.references, data.references);
    return true;
  },

  // ========== 故事线自动识别 ==========
  detectFramework(text) {
    if (!text) return null;
    const scores = {};
    for (const [fwId, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
      scores[fwId] = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    }
    let bestId = null, bestScore = 0;
    for (const [id, score] of Object.entries(scores)) {
      if (score > bestScore) { bestScore = score; bestId = id; }
    }
    return bestScore > 0 ? bestId : null;
  },

  getFrameworkById(id) {
    return FRAMEWORKS.find(f => f.id === id);
  },

  // ========== 设置管理 ==========
  getSetting(key, fallback = '') {
    const settings = this._read(this.KEYS.settings, {});
    return settings[key] !== undefined ? settings[key] : fallback;
  },

  setSetting(key, value) {
    const settings = this._read(this.KEYS.settings, {});
    settings[key] = value;
    this._write(this.KEYS.settings, settings);
  },

  // ========== 生成提示词构建 ==========
  buildGenPrompt(product, framework, refs, instructions) {
    const fw = this.getFrameworkById(framework);
    if (!fw || !product) return '';

    let prompt = `你是一位专业的信息流短视频带货文案写手，请根据以下信息撰写一篇信息流文案。\n\n`;

    // 产品信息
    prompt += `【产品信息】\n`;
    prompt += `- 产品名称：${product.name}\n`;
    if (product.category) prompt += `- 品类：${product.category}\n`;
    if (product.price) prompt += `- 价格：${product.price}\n`;
    if (product.targetAudience) prompt += `- 目标人群：${product.targetAudience}\n`;
    if (product.sellingPoints && product.sellingPoints.length) {
      prompt += `- 核心卖点：${product.sellingPoints.join('、')}\n`;
    }
    if (product.scenes && product.scenes.length) {
      prompt += `- 使用场景：${product.scenes.join('、')}\n`;
    }
    if (product.painPoints && product.painPoints.length) {
      prompt += `- 用户痛点：${product.painPoints.join('、')}\n`;
    }
    if (product.scriptStyle && product.scriptStyle !== '不限') {
      prompt += `- 脚本风格：${product.scriptStyle}\n`;
    }

    // 故事线框架
    prompt += `\n【故事线框架】\n`;
    prompt += `- 框架：${fw.name}\n`;
    prompt += `- 结构：${fw.structure}\n`;
    prompt += `- 说明：${fw.desc}\n`;
    prompt += `- 各步骤引导：\n`;
    fw.steps.forEach((step, i) => {
      prompt += `  ${i + 1}. ${step}：${fw.guide[i]}\n`;
    });

    // 参考素材
    if (refs && refs.length > 0) {
      prompt += `\n【参考素材】\n`;
      prompt += `以下是同类目的爆款文案，请学习其风格和节奏，但不要照搬内容，要写出有新意的文案：\n\n`;
      refs.slice(0, 5).forEach((ref, i) => {
        prompt += `--- 素材${i + 1} ---\n${ref.content}\n\n`;
      });
    }

    // 写作要求
    prompt += `\n【写作要求】\n`;
    prompt += `- 严格按照「${fw.name}」的故事线结构来写，结构为：${fw.structure}\n`;
    prompt += `- 纯文案，不要标注步骤名称（不要写【问题】【发现】等标签）\n`;
    prompt += `- 口语化，像和朋友聊天一样自然\n`;
    prompt += `- 开头前3秒必须抓住注意力\n`;
    prompt += `- 产品植入要自然，不生硬\n`;
    prompt += `- 收口要有明确的行动引导（促单/引导下单）\n`;
    const _wr = { '100': '100字以内', '200': '100-200字', '300': '200-300字', '400': '300-400字', '500': '300-500字' };
    prompt += `- 字数控制在${_wr[product.scriptWords] || '200-400字'}\n`;

    // 额外指令
    if (instructions) {
      prompt += `\n【额外要求】\n${instructions}\n`;
    }

    return prompt;
  },

  // ========== 仿写提示词构建 ==========
  buildImitatePrompt(sourceText, product, instructions) {
    let prompt = `你是一位专业的信息流短视频带货文案写手。下面是一篇爆款文案，请学习它的风格、节奏、结构、话术技巧，然后为我仿写一篇同风格但针对我产品的全新文案。\n\n`;

    // 原文
    prompt += `【爆款原文】\n${sourceText}\n\n`;

    // 产品信息（如果有）
    if (product) {
      prompt += `【我的产品信息】\n`;
      prompt += `- 产品名称：${product.name}\n`;
      if (product.category) prompt += `- 品类：${product.category}\n`;
      if (product.price) prompt += `- 价格：${product.price}\n`;
      if (product.targetAudience) prompt += `- 目标人群：${product.targetAudience}\n`;
      if (product.sellingPoints && product.sellingPoints.length) {
        prompt += `- 核心卖点：${product.sellingPoints.join('、')}\n`;
      }
      if (product.scenes && product.scenes.length) {
        prompt += `- 使用场景：${product.scenes.join('、')}\n`;
      }
      if (product.painPoints && product.painPoints.length) {
        prompt += `- 用户痛点：${product.painPoints.join('、')}\n`;
      }
      if (product.scriptStyle && product.scriptStyle !== '不限') {
        prompt += `- 脚本风格：${product.scriptStyle}\n`;
      }
    }

    // 写作要求
    prompt += `\n【仿写要求】\n`;
    prompt += `- 学习原文的开头钩子手法、节奏感、转折方式、收口促单技巧\n`;
    prompt += `- 保持原文的口语化风格和情绪感染力\n`;
    prompt += `- 但内容必须针对我的产品，不能照搬原文的具体卖点、场景、数据\n`;
    prompt += `- 纯文案，不要标注步骤名称或任何标签\n`;
    const _wr2 = { '100': '100字以内', '200': '100-200字', '300': '200-300字', '400': '300-400字', '500': '300-500字' };
    prompt += `- 字数控制在${_wr2[product ? product.scriptWords : null] || '与原文相近'}\n`;
    prompt += `- 开头前3秒必须抓住注意力\n`;
    prompt += `- 收口要有明确的行动引导（促单/引导下单）\n`;

    // 额外指令
    if (instructions) {
      prompt += `\n【额外要求】\n${instructions}\n`;
    }

    return prompt;
  }
};
