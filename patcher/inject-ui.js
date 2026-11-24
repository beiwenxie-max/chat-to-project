/**
 * Antigravity Chat-to-Project Client UI Injection
 * 在客户端界面动态注入“移动至项目”按钮与交互模态弹窗
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__AGY_CHAT_TO_PROJECT_INJECTED__) return;
  window.__AGY_CHAT_TO_PROJECT_INJECTED__ = true;

  // 依赖安全获取
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

  // 路径展开（处理 ~ 为用户家目录）
  function resolveHomePath(inputPath) {
    if (!inputPath) return '';
    let p = inputPath.trim();
    if (p.startsWith('~')) {
      const home = (os && os.homedir()) || (process && process.env && process.env.HOME) || '';
      p = p.replace(/^~(?=$|\/|\\)/, home);
    }
    return path ? path.resolve(p) : p;
  }

  // 样式注入
  function injectStyles() {
    if (document.getElementById('c2p-injected-styles')) return;
    const style = document.createElement('style');
    style.id = 'c2p-injected-styles';
    style.textContent = `
      .c2p-header-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 500;
        color: #ffffff;
        background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        user-select: none;
        z-index: 999;
      }
      .c2p-header-btn:hover {
        background: linear-gradient(135deg, #1b85ff 0%, #1565c0 100%);
        box-shadow: 0 4px 10px rgba(26, 115, 232, 0.4);
        transform: translateY(-1px);
      }
      .c2p-header-btn:active {
        transform: translateY(0);
      }
      .c2p-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.65);
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
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        width: 500px;
        max-width: 90vw;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
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
        padding: 10px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

  function showToast(msg, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'c2p-toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // 弹出迁移配置模态框
  function openMoveModal() {
    const existing = document.getElementById('c2p-modal-root');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'c2p-modal-root';
    overlay.className = 'c2p-modal-overlay';

    overlay.innerHTML = `
      <div class="c2p-modal-card">
        <div class="c2p-modal-title">
          <span>📁</span>
          <span>移动当前聊天至项目工作区</span>
        </div>
        <div class="c2p-modal-desc">
          将当前未关联项目的会话沉淀为正式工程，自动提取架构决策、迁移讨论代码并初始化智能体规则。
        </div>
        <div class="c2p-form-group">
          <label class="c2p-label">目标本地项目路径：</label>
          <div class="c2p-input-row">
            <input type="text" id="c2p-path-input" class="c2p-input" placeholder="请选择或输入本地项目目录" />
            <button id="c2p-browse-btn" class="c2p-btn-secondary">浏览...</button>
          </div>
        </div>
        <div class="c2p-checkbox-group">
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-context" checked />
            自动生成项目背景文档 (PROJECT_CONTEXT.md)
          </label>
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-rules" checked />
            注入项目级智能体规则 (.agents/rules/)
          </label>
          <label class="c2p-checkbox-label">
            <input type="checkbox" id="c2p-opt-git" checked />
            若目录未初始化 Git 则自动 git init
          </label>
        </div>
        <div class="c2p-modal-actions">
          <button id="c2p-cancel-btn" class="c2p-btn-secondary">取消</button>
          <button id="c2p-submit-btn" class="c2p-btn-primary">开始迁移</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const pathInput = overlay.querySelector('#c2p-path-input');
    const browseBtn = overlay.querySelector('#c2p-browse-btn');
    const cancelBtn = overlay.querySelector('#c2p-cancel-btn');
    const submitBtn = overlay.querySelector('#c2p-submit-btn');

    // 默认填入建议目录
    try {
      const home = (os && os.homedir()) || (process && process.env && process.env.HOME) || '';
      pathInput.value = home ? `${home}/projects/new-project` : '~/projects/new-project';
    } catch (e) {}

    // 点击取消或遮罩层关闭
    cancelBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    // 点击浏览：真实调起系统选择文件夹对话框
    browseBtn.onclick = async () => {
      let chosenPath = null;
      try {
        // 1. 优先调用 Antigravity 原生公开的 dialog.showOpenDialog()
        if (window.dialog && typeof window.dialog.showOpenDialog === 'function') {
          chosenPath = await window.dialog.showOpenDialog();
        }
        // 2. 备用方式：直接通过 ipcRenderer 触发 Antigravity 的 'dialog:open-workspace'
        else if (electron && electron.ipcRenderer) {
          chosenPath = await electron.ipcRenderer.invoke('dialog:open-workspace');
        }
      } catch (err) {
        console.warn('[Chat-to-Project] Electron dialog API call failed, trying HTML5 file picker:', err);
      }

      // 3. 第三重保底：使用浏览器标准 webkitdirectory
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
              // 在 Electron 中，文件的 .path 属性为本地绝对路径
              const dirPath = first.path.substring(0, first.path.lastIndexOf('/'));
              if (dirPath) pathInput.value = dirPath;
            }
          }
          fileInput.remove();
        };

        fileInput.click();
        return;
      }

      if (chosenPath) {
        pathInput.value = chosenPath;
      }
    };

    // 点击开始迁移
    submitBtn.onclick = () => {
      const rawPath = pathInput.value.trim();
      if (!rawPath) {
        alert('请输入或选择目标项目路径！');
        return;
      }
      const targetPath = resolveHomePath(rawPath);
      overlay.remove();

      const optContext = overlay.querySelector('#c2p-opt-context').checked;
      const optRules = overlay.querySelector('#c2p-opt-rules').checked;
      const optGit = overlay.querySelector('#c2p-opt-git').checked;

      executeRealMigration(targetPath, { optContext, optRules, optGit });
    };
  }

  // 真实执行本地文件系统与 Git 初始化
  function executeRealMigration(targetPath, options) {
    showToast(`正在本地创建与配置项目：${targetPath}...`);

    let localSuccess = false;
    try {
      if (fs) {
        // 1. 真实确保目标目录存在
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        // 2. 真实创建 .agents/rules/
        if (options.optRules) {
          const rulesDir = path.join(targetPath, '.agents', 'rules');
          if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
          const ruleFile = path.join(rulesDir, 'project-context.md');
          if (!fs.existsSync(ruleFile)) {
            fs.writeFileSync(ruleFile, `# 项目上下文与背景继承\n\n- 本项目由 Antigravity 普通会话沉淀创建，技术决策详见 PROJECT_CONTEXT.md。\n`, 'utf-8');
          }
        }

        // 3. 真实生成 PROJECT_CONTEXT.md 基础骨架
        if (options.optContext) {
          const contextFile = path.join(targetPath, 'PROJECT_CONTEXT.md');
          if (!fs.existsSync(contextFile)) {
            fs.writeFileSync(contextFile, `# 项目背景与会话继承上下文 (Project Context)\n\n> 本文档由 Antigravity chat-to-project 自动生成。\n\n## 1. 项目愿景\n- 继承自本次对话\n`, 'utf-8');
          }
        }

        // 4. 真实执行 Git 初始化
        if (options.optGit && childProcess) {
          const gitDir = path.join(targetPath, '.git');
          if (!fs.existsSync(gitDir)) {
            try {
              childProcess.execSync('git init', { cwd: targetPath });
            } catch (gitErr) {
              console.warn('[Chat-to-Project] git init warning:', gitErr);
            }
          }
        }

        localSuccess = true;
      }
    } catch (fsErr) {
      console.error('[Chat-to-Project] Local filesystem setup error:', fsErr);
    }

    // 5. 将迁移指令穿透填入当前聊天输入框，让智能体完成会话上下文的全面提炼沉淀
    sendPromptToAgent(`请使用 chat-to-project 技能将当前聊天的完整上下文、架构决策与生成的代码沉淀到本地项目：${targetPath}`);
    showToast(`✅ 项目已在本地创建就绪，智能体正在同步会话上下文！`, 4000);
  }

  // 穿透 React / DOM 输入框填入并提交指令
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

    // 延时触发提交
    setTimeout(() => {
      const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="发送"], button[type="submit"]');
      if (sendBtn) {
        sendBtn.click();
      } else {
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
    }, 200);
  }

  // 挂载按钮到顶部栏
  function tryMountButton() {
    if (document.getElementById('c2p-header-btn')) return;

    injectStyles();

    const btn = document.createElement('button');
    btn.id = 'c2p-header-btn';
    btn.className = 'c2p-header-btn';
    btn.title = '将当前未绑定的会话移动或沉淀至具体项目工作区';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
      <span>移动至项目</span>
    `;
    btn.onclick = (e) => {
      e.stopPropagation();
      openMoveModal();
    };

    const headerCandidates = [
      document.querySelector('header'),
      document.querySelector('[role="banner"]'),
      document.querySelector('.chat-header'),
      document.querySelector('[data-testid="chat-header"]')
    ];

    let mounted = false;
    for (const container of headerCandidates) {
      if (container) {
        container.appendChild(btn);
        mounted = true;
        break;
      }
    }

    if (!mounted) {
      btn.style.position = 'fixed';
      btn.style.top = '12px';
      btn.style.right = '120px';
      btn.style.zIndex = '9999';
      document.body.appendChild(btn);
    }
  }

  // 初始化与 DOM 监听
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
