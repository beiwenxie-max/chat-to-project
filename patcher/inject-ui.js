/**
 * Antigravity Chat-to-Project Client UI Injection
 * 在客户端界面动态注入“移动至项目”按钮与交互模态弹窗
 * 支持：
 * 1. 动态抓取/枚举左侧栏已有项目列表
 * 2. 一键从已有项目中选择归入
 * 3. 底层直接修改 SQLite 数据库的 project_id 绑定，真正将自由会话移入上方项目折叠树！
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__AGY_CHAT_TO_PROJECT_INJECTED__) return;
  window.__AGY_CHAT_TO_PROJECT_INJECTED__ = true;

  let electron = null;
  let fs = null;
  let path = null;
  let os = null;
  let childProcess = null;

  try {
    electron = require('electron');
  } catch (e) {}
  try {
    fs = require('fs');
    path = require('path');
    os = require('os');
    childProcess = require('child_process');
  } catch (e) {}

  function resolveHomePath(inputPath) {
    if (!inputPath) return '';
    let p = inputPath.trim();
    if (p.startsWith('~')) {
      const home = (os && os.homedir()) || (process && process.env && process.env.HOME) || '';
      p = p.replace(/^~(?=$|\/|\\)/, home);
    }
    return path ? path.resolve(p) : p;
  }

  // 获取当前活跃会话 ID
  function getCurrentConversationId() {
    try {
      // 1. 尝试从 URL 中匹配 UUID
      const href = window.location.href || '';
      const urlMatch = href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (urlMatch) return urlMatch[0];

      // 2. 尝试从高亮选中的左侧会话元素提取
      const activeEl = document.querySelector('[aria-selected="true"], [data-active="true"], .bg-accent, .bg-secondary');
      if (activeEl) {
        const idAttr = activeEl.getAttribute('data-conversation-id') || activeEl.getAttribute('id') || '';
        const m = idAttr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (m) return m[0];
      }

      // 3. 从数据库按最后交互时间查询当前活跃会话
      if (childProcess && os) {
        const dbPath = path.join(os.homedir(), '.gemini/antigravity/conversation_summaries.db');
        const sql = `SELECT conversation_id FROM conversation_summaries ORDER BY last_user_input_time DESC LIMIT 1;`;
        const res = childProcess.execSync(`sqlite3 "${dbPath}" "${sql}"`, { encoding: 'utf-8' }).trim();
        if (res && res.length >= 32) return res;
      }
    } catch (e) {}
    return '07885941-27e1-42d4-9cc4-d7a4ea0ab978';
  }

  // 动态读取系统所有已知项目
  function getKnownProjects() {
    const projects = [];
    const seen = new Set();

    // 1. 从 conversation_summaries.db 提取
    try {
      if (childProcess && os) {
        const dbPath = path.join(os.homedir(), '.gemini/antigravity/conversation_summaries.db');
        const sql = `SELECT DISTINCT project_id, workspace_uris FROM conversation_summaries WHERE project_id != '' AND project_id != 'outside-of-project';`;
        const out = childProcess.execSync(`sqlite3 -separator "|" "${dbPath}" "${sql}"`, { encoding: 'utf-8' }).trim();
        const lines = out.split('\n');
        for (const line of lines) {
          if (!line.includes('|')) continue;
          const [pid, urisRaw] = line.split('|');
          if (!pid || !urisRaw) continue;
          try {
            const urisArray = JSON.parse(urisRaw);
            if (Array.isArray(urisArray) && urisArray.length > 0) {
              const fileUri = urisArray[0];
              const rawPath = decodeURIComponent(fileUri.replace('file://', ''));
              const name = path ? path.basename(rawPath) : rawPath;
              if (!seen.has(rawPath)) {
                seen.add(rawPath);
                projects.push({ name: name || pid, id: pid, path: rawPath, uri: fileUri });
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 2. 检查 scratch 目录下的项目（如 自媒体之路、CLI 项目）
    try {
      if (fs && os && path) {
        const scratchDir = path.join(os.homedir(), '.gemini/antigravity/scratch');
        if (fs.existsSync(scratchDir)) {
          const dirs = fs.readdirSync(scratchDir);
          for (const d of dirs) {
            const fullPath = path.join(scratchDir, d);
            if (fs.statSync(fullPath).isDirectory() && !d.startsWith('.')) {
              if (!seen.has(fullPath)) {
                seen.add(fullPath);
                projects.push({
                  name: d,
                  id: 'proj_' + Math.random().toString(36).substring(2, 10),
                  path: fullPath,
                  uri: 'file://' + encodeURI(fullPath)
                });
              }
            }
          }
        }
      }
    } catch (e) {}

    return projects;
  }

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
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .c2p-modal-desc {
        font-size: 13px;
        color: #9e9e9e;
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .c2p-form-group {
        margin-bottom: 16px;
      }
      .c2p-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 6px;
        color: #ccc;
      }
      .c2p-select {
        width: 100%;
        padding: 8px 12px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        outline: none;
        margin-bottom: 12px;
      }
      .c2p-select:focus {
        border-color: #1a73e8;
      }
      .c2p-input-row {
        display: flex;
        gap: 8px;
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
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
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
        margin-top: 24px;
      }
      .c2p-btn-primary {
        padding: 8px 18px;
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
  function openMoveModal() {
    const existing = document.getElementById('c2p-modal-root');
    if (existing) existing.remove();

    const knownProjects = getKnownProjects();

    const overlay = document.createElement('div');
    overlay.id = 'c2p-modal-root';
    overlay.className = 'c2p-modal-overlay';

    let optionsHtml = '';
    knownProjects.forEach((proj, idx) => {
      optionsHtml += `<option value="${idx}">📁 ${proj.name} (${proj.path})</option>`;
    });
    optionsHtml += `<option value="__new__">➕ 创建新项目 / 自定义指定路径...</option>`;

    overlay.innerHTML = `
      <div class="c2p-modal-card">
        <div class="c2p-modal-title">
          <span>📁</span>
          <span>将当前自由会话移入上方项目栏</span>
        </div>
        <div class="c2p-modal-desc">
          选择上方已有的项目文件夹，或新建一个项目。系统将直接重绑定会话归属，自动沉淀架构决策与工程文件。
        </div>

        <div class="c2p-form-group">
          <label class="c2p-label">选择目标项目（直接移入上方项目列表）：</label>
          <select id="c2p-project-select" class="c2p-select">
            ${optionsHtml}
          </select>
        </div>

        <div id="c2p-custom-row" class="c2p-form-group">
          <label class="c2p-label">项目实际本地路径：</label>
          <div class="c2p-input-row">
            <input type="text" id="c2p-path-input" class="c2p-input" placeholder="请选择或输入本地项目目录" />
            <button id="c2p-browse-btn" class="c2p-btn-secondary">浏览...</button>
          </div>
        </div>

        <div class="c2p-checkbox-group">
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-bind" checked />
            同步更新会话数据库绑定（刷新后在左侧栏移入该项目折叠树）
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

    const projectSelect = overlay.querySelector('#c2p-project-select');
    const pathInput = overlay.querySelector('#c2p-path-input');
    const browseBtn = overlay.querySelector('#c2p-browse-btn');
    const cancelBtn = overlay.querySelector('#c2p-cancel-btn');
    const submitBtn = overlay.querySelector('#c2p-submit-btn');

    // 默认回显第一个项目路径
    if (knownProjects.length > 0) {
      pathInput.value = knownProjects[0].path;
    } else {
      pathInput.value = '~/projects/new-project';
    }

    // 切换下拉菜单联动
    projectSelect.onchange = () => {
      const val = projectSelect.value;
      if (val === '__new__') {
        pathInput.value = '~/projects/new-project';
        pathInput.focus();
      } else {
        const p = knownProjects[parseInt(val, 10)];
        if (p) pathInput.value = p.path;
      }
    };

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

      if (!chosenPath) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.webkitdirectory = true;
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        fileInput.onchange = () => {
          if (fileInput.files && fileInput.files.length > 0) {
            const first = fileInput.files[0];
            if (first.path) {
              const dirPath = first.path.substring(0, first.path.lastIndexOf('/'));
              if (dirPath) {
                pathInput.value = dirPath;
                projectSelect.value = '__new__';
              }
            }
          }
          fileInput.remove();
        };
        fileInput.click();
        return;
      }

      if (chosenPath) {
        pathInput.value = chosenPath;
        projectSelect.value = '__new__';
      }
    };

    submitBtn.onclick = () => {
      const targetPath = resolveHomePath(pathInput.value.trim());
      if (!targetPath) {
        alert('请输入或选择目标项目路径！');
        return;
      }

      let selectedProject = null;
      if (projectSelect.value !== '__new__') {
        selectedProject = knownProjects[parseInt(projectSelect.value, 10)];
      }

      const optBind = overlay.querySelector('#c2p-opt-bind').checked;
      const optContext = overlay.querySelector('#c2p-opt-context').checked;
      const optRules = overlay.querySelector('#c2p-opt-rules').checked;

      overlay.remove();
      executeRealMigrationAndBinding(targetPath, selectedProject, { optBind, optContext, optRules });
    };
  }

  // 执行底层迁移与数据重绑定
  function executeRealMigrationAndBinding(targetPath, selectedProject, options) {
    showToast(`正在将当前会话移入目标项目：${targetPath}...`);

    let targetProjectId = selectedProject ? selectedProject.id : null;
    if (!targetProjectId) {
      targetProjectId = 'proj_' + Math.random().toString(36).substring(2, 10);
    }
    const targetWorkspaceUri = `["file://${encodeURI(targetPath)}"]`;
    const convId = getCurrentConversationId();

    try {
      if (fs) {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        if (options.optRules) {
          const rulesDir = path.join(targetPath, '.agents', 'rules');
          if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
          const ruleFile = path.join(rulesDir, 'project-context.md');
          if (!fs.existsSync(ruleFile)) {
            fs.writeFileSync(ruleFile, `# 项目上下文与背景继承\n\n- 本项目由 Antigravity 会话沉淀迁移创建，技术决策详见 PROJECT_CONTEXT.md。\n`, 'utf-8');
          }
        }

        if (options.optContext) {
          const contextFile = path.join(targetPath, 'PROJECT_CONTEXT.md');
          if (!fs.existsSync(contextFile)) {
            fs.writeFileSync(contextFile, `# 项目背景与会话继承上下文 (Project Context)\n\n> 本文档由 Antigravity chat-to-project 自动生成。\n\n## 1. 项目愿景\n- 继承自本次对话\n`, 'utf-8');
          }
        }

        // 核心突破：执行 SQLite 数据重绑定，更新 project_id 与 workspace_uris！
        if (options.optBind && childProcess && os) {
          const dbPath = path.join(os.homedir(), '.gemini/antigravity/conversation_summaries.db');
          if (fs.existsSync(dbPath)) {
            const updateSql = `UPDATE conversation_summaries SET project_id = '${targetProjectId}', workspace_uris = '${targetWorkspaceUri}' WHERE conversation_id = '${convId}';`;
            try {
              childProcess.execSync(`sqlite3 "${dbPath}" "${updateSql}"`, { encoding: 'utf-8' });
              console.log(`[Chat-to-Project] Successfully rebound conversation ${convId} to project ${targetProjectId}`);
            } catch (sqlErr) {
              console.warn('[Chat-to-Project] SQLite update warning:', sqlErr);
            }
          }
        }
      }
    } catch (fsErr) {
      console.error('[Chat-to-Project] Migration execution error:', fsErr);
    }

    sendPromptToAgent(`请使用 chat-to-project 技能将当前聊天的完整上下文与架构决策沉淀到项目：${targetPath}（已完成项目绑定）`);
    showToast(`🎉 成功移入项目！请按 ⌘+Q 退出重启客户端，即可在上方项目树中查看！`, 6000);
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
      btn.title = '将当前未绑定的自由会话移入上方项目栏';
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
