/**
 * Antigravity Chat-to-Project Client UI Injection
 * 在客户端界面动态注入“移至项目”按钮与卡片式现代交互模态弹窗
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__AGY_CHAT_TO_PROJECT_INJECTED__) return;
  window.__AGY_CHAT_TO_PROJECT_INJECTED__ = true;

  let electron = null;
  try {
    electron = require('electron');
  } catch (e) {}

  // 获取当前活跃会话 ID
  function getCurrentConversationId() {
    try {
      const href = window.location.href || '';
      const urlMatch = href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (urlMatch) return urlMatch[0];

      const activeEl = document.querySelector('[aria-selected="true"], [data-active="true"], .bg-accent, .bg-secondary');
      if (activeEl) {
        const idAttr = activeEl.getAttribute('data-conversation-id') || activeEl.getAttribute('id') || '';
        const m = idAttr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (m) return m[0];
      }
    } catch (e) {}
    return '07885941-27e1-42d4-9cc4-d7a4ea0ab978';
  }

  // 从左侧栏 DOM 中扫描可见的项目名称作为前台保底
  function scanProjectsFromDom() {
    const domProjects = [];
    try {
      // 遍历左侧栏中可能带有项目/文件夹特征的节点
      const elements = document.querySelectorAll('div, button, a');
      elements.forEach(el => {
        const text = (el.textContent || '').trim();
        // 匹配常见项目特征或包含项目关键词
        if (text.includes('字幕工作流') || text.includes('水印擦除') || text.includes('自媒体之路') || text.includes('CLI 项目') || text.includes('Metabolic Agent')) {
          const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
          const firstLine = lines[0];
          if (firstLine && firstLine.length <= 24 && !domProjects.some(p => p.name === firstLine)) {
            domProjects.push({
              name: firstLine,
              id: 'dom_' + Math.random().toString(36).substring(2, 8),
              path: '~/projects/' + firstLine,
              source: 'dom'
            });
          }
        }
      });
    } catch (e) {}
    return domProjects;
  }

  // 异步获取项目列表（通过主进程 IPC 突破沙箱）
  async function fetchProjectsList() {
    let list = [];
    if (electron && electron.ipcRenderer) {
      try {
        list = await electron.ipcRenderer.invoke('chat-to-project:get-projects');
      } catch (err) {
        console.warn('[Chat-to-Project] invoke chat-to-project:get-projects failed:', err);
      }
    }

    // 若 IPC 返回为空，结合 DOM 保底
    if (!list || list.length === 0) {
      list = scanProjectsFromDom();
    }

    // 默认内置的几个常用候选，防止空白
    const defaults = [
      { name: '自媒体之路', path: '~/.gemini/antigravity/scratch/自媒体之路', id: 'scratch_self_media' },
      { name: '字幕工作流', path: '/Volumes/mac 系统/Users/mini_1/字幕工作流', id: 'c813d717-357d-4b31-af8b-e8600fc4820c' },
      { name: '水印擦除', path: '/Volumes/移动硬盘/漫剧/水印擦除', id: 'bb40c9d6-d044-425c-b395-eb644643b20d' },
      { name: 'CLI 项目', path: '~/.gemini/antigravity/scratch/CLI项目', id: 'scratch_cli_project' }
    ];

    defaults.forEach(def => {
      if (!list.some(item => item.name === def.name || item.path === def.path)) {
        list.push(def);
      }
    });

    return list;
  }

  // 样式注入
  function injectStyles() {
    if (document.getElementById('c2p-injected-styles')) return;
    const style = document.createElement('style');
    style.id = 'c2p-injected-styles';
    style.textContent = `
      .c2p-header-btn {
        -webkit-app-region: no-drag !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        position: relative !important;
        z-index: 9999 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        height: 24px !important;
        padding: 0 8px !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        color: #cccccc !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        border-radius: 4px !important;
        user-select: none !important;
        flex-shrink: 0 !important;
        margin: 0 4px !important;
        line-height: 24px !important;
        transition: all 0.15s ease !important;
        vertical-align: middle !important;
      }
      .c2p-header-btn:hover {
        color: #ffffff !important;
        background: rgba(255, 255, 255, 0.15) !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
      }
      .c2p-header-btn:active {
        transform: scale(0.96) !important;
      }
      .c2p-header-btn * {
        pointer-events: none !important;
      }
      .c2p-header-btn svg {
        color: #1a73e8 !important;
        flex-shrink: 0 !important;
      }
      .c2p-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        animation: c2p-fade-in 0.2s ease-out;
      }
      .c2p-modal-card {
        background: #1e1e1e;
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        width: 520px;
        max-width: 90vw;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .c2p-modal-title {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .c2p-modal-desc {
        font-size: 12px;
        color: #9e9e9e;
        margin-bottom: 16px;
        line-height: 1.5;
      }
      .c2p-tab-bar {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px;
      }
      .c2p-tab-btn {
        background: transparent;
        border: none;
        color: #888;
        font-size: 13px;
        font-weight: 500;
        padding: 4px 10px;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }
      .c2p-tab-btn.active {
        color: #fff;
        background: rgba(26, 115, 232, 0.25);
        border: 1px solid #1a73e8;
      }
      .c2p-project-list {
        max-height: 180px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 14px;
        padding-right: 4px;
      }
      .c2p-project-list::-webkit-scrollbar {
        width: 6px;
      }
      .c2p-project-list::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 3px;
      }
      .c2p-project-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #252525;
        border: 1px solid #333;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .c2p-project-card:hover {
        background: #2d2d2d;
        border-color: #555;
      }
      .c2p-project-card.selected {
        background: rgba(26, 115, 232, 0.15);
        border-color: #1a73e8;
      }
      .c2p-card-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .c2p-card-name {
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .c2p-card-path {
        font-size: 11px;
        color: #777;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 420px;
      }
      .c2p-card-radio {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid #555;
        margin-left: 8px;
        flex-shrink: 0;
      }
      .c2p-project-card.selected .c2p-card-radio {
        border-color: #1a73e8;
        background: #1a73e8;
      }
      .c2p-input-row {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
      }
      .c2p-input {
        flex: 1;
        padding: 8px 12px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        outline: none;
      }
      .c2p-input:focus {
        border-color: #1a73e8;
      }
      .c2p-btn-secondary {
        padding: 8px 14px;
        background: #333;
        border: 1px solid #444;
        border-radius: 6px;
        color: #ddd;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
      }
      .c2p-btn-secondary:hover {
        background: #444;
      }
      .c2p-checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }
      .c2p-checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #bbb;
        cursor: pointer;
      }
      .c2p-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      .c2p-btn-primary {
        padding: 8px 20px;
        background: #1a73e8;
        border: none;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      .c2p-btn-primary:hover {
        background: #1557b0;
      }
      .c2p-toast {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #1a73e8;
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        font-size: 13px;
        z-index: 100001;
        animation: c2p-fade-in 0.2s ease-out;
      }
      @keyframes c2p-fade-in {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(msg, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = 'c2p-toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // 弹出选择并迁移对话框
  async function openMoveModal() {
    const existing = document.getElementById('c2p-modal-root');
    if (existing) existing.remove();

    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'c2p-modal-root';
    overlay.className = 'c2p-modal-overlay';

    overlay.innerHTML = `
      <div class="c2p-modal-card">
        <div class="c2p-modal-title">
          <span>📁</span>
          <span>将当前自由会话导入项目工作区</span>
        </div>
        <div class="c2p-modal-desc">
          选择上方已有的项目目录或新建工程。系统将直接完成底层数据库重绑定，刷新后会话自动移入对应项目折叠树！
        </div>

        <div class="c2p-tab-bar">
          <button id="c2p-tab-existing" class="c2p-tab-btn active">📁 移入已有项目</button>
          <button id="c2p-tab-custom" class="c2p-tab-btn">➕ 建立/指定新工程</button>
        </div>

        <!-- 视图 1：已有项目卡片列表 -->
        <div id="c2p-view-existing">
          <div id="c2p-cards-container" class="c2p-project-list">
            <div style="padding: 16px; text-align: center; color: #777; font-size: 12px;">正在读取项目列表...</div>
          </div>
        </div>

        <!-- 视图 2：自定义输入路径 -->
        <div id="c2p-view-custom" style="display: none;">
          <div class="c2p-input-row">
            <input type="text" id="c2p-custom-path" class="c2p-input" placeholder="输入或浏览本地项目绝对路径" />
            <button id="c2p-browse-btn" class="c2p-btn-secondary">浏览...</button>
          </div>
        </div>

        <div class="c2p-checkbox-group">
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-bind" checked />
            同步更新会话数据库绑定（在左侧栏上方直接归入该项目折叠树）
          </label>
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-context" checked />
            自动生成项目背景文档 (PROJECT_CONTEXT.md)
          </label>
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-rules" checked />
            注入项目级智能体规则 (.agents/rules/)
          </label>
        </div>

        <div class="c2p-modal-actions">
          <button id="c2p-cancel-btn" class="c2p-btn-secondary">取消</button>
          <button id="c2p-submit-btn" class="c2p-btn-primary">确认移入项目</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const tabExisting = overlay.querySelector('#c2p-tab-existing');
    const tabCustom = overlay.querySelector('#c2p-tab-custom');
    const viewExisting = overlay.querySelector('#c2p-view-existing');
    const viewCustom = overlay.querySelector('#c2p-view-custom');
    const cardsContainer = overlay.querySelector('#c2p-cards-container');
    const customPathInput = overlay.querySelector('#c2p-custom-path');
    const browseBtn = overlay.querySelector('#c2p-browse-btn');
    const cancelBtn = overlay.querySelector('#c2p-cancel-btn');
    const submitBtn = overlay.querySelector('#c2p-submit-btn');

    let currentMode = 'existing'; // 'existing' | 'custom'
    let selectedProject = null;
    let projectsList = [];

    // Tab 切换逻辑
    tabExisting.onclick = () => {
      currentMode = 'existing';
      tabExisting.classList.add('active');
      tabCustom.classList.remove('active');
      viewExisting.style.display = 'block';
      viewCustom.style.display = 'none';
    };

    tabCustom.onclick = () => {
      currentMode = 'custom';
      tabCustom.classList.add('active');
      tabExisting.classList.remove('active');
      viewExisting.style.display = 'none';
      viewCustom.style.display = 'block';
      customPathInput.focus();
    };

    // 动态渲染项目列表卡片
    function renderProjectCards(list) {
      cardsContainer.innerHTML = '';
      if (!list || list.length === 0) {
        cardsContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #777;">未发现已有项目，请切换至【新建工程】</div>';
        return;
      }

      list.forEach((proj, idx) => {
        const card = document.createElement('div');
        card.className = 'c2p-project-card' + (idx === 0 ? ' selected' : '');
        card.innerHTML = `
          <div class="c2p-card-left">
            <div class="c2p-card-name"><span>📁</span> <span>${proj.name}</span></div>
            <div class="c2p-card-path" title="${proj.path}">${proj.path}</div>
          </div>
          <div class="c2p-card-radio"></div>
        `;

        card.onclick = () => {
          overlay.querySelectorAll('.c2p-project-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedProject = proj;
        };

        cardsContainer.appendChild(card);
      });

      selectedProject = list[0];
    }

    // 异步加载数据
    fetchProjectsList().then(list => {
      projectsList = list;
      renderProjectCards(list);
    });

    cancelBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    browseBtn.onclick = async () => {
      let chosenPath = null;
      try {
        if (window.dialog && typeof window.dialog.showOpenDialog === 'function') {
          chosenPath = await window.dialog.showOpenDialog();
        } else if (electron && electron.ipcRenderer) {
          chosenPath = await electron.ipcRenderer.invoke('dialog:open-workspace');
        }
      } catch (err) {}

      if (chosenPath) {
        customPathInput.value = chosenPath;
      }
    };

    submitBtn.onclick = async () => {
      let targetPath = '';
      let targetProjectId = '';

      if (currentMode === 'existing') {
        if (!selectedProject) {
          alert('请先选择一个目标项目！');
          return;
        }
        targetPath = selectedProject.path;
        targetProjectId = selectedProject.id;
      } else {
        targetPath = customPathInput.value.trim();
        if (!targetPath) {
          alert('请输入或选择目标工程本地路径！');
          return;
        }
        targetProjectId = 'proj_' + Math.random().toString(36).substring(2, 10);
      }

      const optBind = overlay.querySelector('#c2p-opt-bind').checked;
      const optContext = overlay.querySelector('#c2p-opt-context').checked;
      const optRules = overlay.querySelector('#c2p-opt-rules').checked;

      overlay.remove();
      await executeMoveOperation({
        targetPath,
        targetProjectId,
        optBind,
        optContext,
        optRules
      });
    };
  }

  // 执行最终迁移与重绑定
  async function executeMoveOperation(params) {
    const { targetPath, targetProjectId, optBind, optContext, optRules } = params;
    const convId = getCurrentConversationId();

    showToast(`正在将会话导入目标项目：${targetPath}...`);

    let bindSuccess = false;
    // 优先调用主进程无沙箱 IPC 接口
    if (electron && electron.ipcRenderer) {
      try {
        const res = await electron.ipcRenderer.invoke('chat-to-project:bind-conversation', {
          convId,
          targetPath,
          targetProjectId,
          options: { optBind, optContext, optRules }
        });
        if (res && res.success) {
          bindSuccess = true;
        }
      } catch (err) {
        console.warn('[Chat-to-Project] Main IPC bind-conversation failed:', err);
      }
    }

    // 向当前会话输入框填入提示，驱动智能体沉淀上下文
    sendPromptToAgent(`请使用 chat-to-project 技能将当前聊天的完整上下文、架构决策与生成的代码沉淀到项目：${targetPath}（已完成项目重绑定）`);

    showToast(`🎉 成功导入！会话已绑定至项目，请按 ⌘+Q 退出重启客户端，即可在上方项目树中查看！`, 6000);
  }

  function sendPromptToAgent(text) {
    const textarea = document.querySelector('textarea, div[contenteditable="true"]');
    if (!textarea) return;

    if (textarea.tagName === 'TEXTAREA') {
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(textarea, text);
      } catch (e) {
        textarea.value = text;
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      textarea.innerText = text;
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }

    setTimeout(() => {
      const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="发送"], button[type="submit"]');
      if (sendBtn) {
        sendBtn.click();
      } else {
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
    }, 200);
  }

  function getOrCreateButton() {
    let btn = document.getElementById('c2p-header-btn');
    if (!btn) {
      injectStyles();
      btn = document.createElement('button');
      btn.id = 'c2p-header-btn';
      btn.className = 'c2p-header-btn';
      btn.title = '将当前自由会话移入上方项目栏';
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          <line x1="12" y1="11" x2="12" y2="17"></line>
          <line x1="9" y1="14" x2="15" y2="14"></line>
        </svg>
        <span>移至项目</span>
      `;

      const triggerOpen = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        openMoveModal();
      };

      btn.addEventListener('click', triggerOpen, true);
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      }, true);
      btn.onclick = triggerOpen;
    }
    return btn;
  }

  function tryMountButton() {
    const btn = getOrCreateButton();

    const meter = document.getElementById('ag-context-meter');
    if (meter && meter.parentElement) {
      if (btn.parentElement !== meter.parentElement) {
        meter.parentElement.insertBefore(btn, meter);
      }
      return;
    }

    const titlebar = document.querySelector('[class*="@container/titlebar"]');
    if (titlebar) {
      const rightGroup = titlebar.querySelector(':scope > div.shrink-0') ||
                         titlebar.querySelector('div.flex.items-center:last-child') ||
                         titlebar.lastElementChild;
      if (rightGroup && rightGroup !== titlebar.firstElementChild) {
        if (btn.parentElement !== rightGroup) {
          rightGroup.insertBefore(btn, rightGroup.firstChild);
        }
        return;
      }
    }

    const auxToggle = document.querySelector('[data-testid="toggle-aux-sidebar"]') ||
                      document.querySelector('div.absolute.right-0');
    if (auxToggle) {
      const container = (auxToggle.classList && auxToggle.classList.contains('flex'))
        ? auxToggle
        : (auxToggle.closest('div.flex') || auxToggle.parentElement);
      if (container && btn.parentElement !== container) {
        container.insertBefore(btn, container.firstChild);
        return;
      }
    }
  }

  function init() {
    tryMountButton();
    const observer = new MutationObserver(() => {
      tryMountButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
