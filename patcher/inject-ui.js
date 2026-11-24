/**
 * Antigravity Chat-to-Project Client UI Injection
 * 在客户端界面动态注入“移动至项目”按钮与交互模态弹窗
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__AGY_CHAT_TO_PROJECT_INJECTED__) return;
  window.__AGY_CHAT_TO_PROJECT_INJECTED__ = true;

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
        background: rgba(0, 0, 0, 0.6);
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
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        width: 480px;
        max-width: 90vw;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
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
      @keyframes c2p-fade-in {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
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
            <input type="text" id="c2p-path-input" class="c2p-input" placeholder="例如：/Users/.../projects/my-app" />
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
      const defaultDir = '~/projects/new-project';
      pathInput.value = defaultDir;
    } catch (e) {}

    // 点击取消或遮罩层关闭
    cancelBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    // 点击浏览：尝试调用 Electron 原生选择目录
    browseBtn.onclick = async () => {
      try {
        const { ipcRenderer } = require('electron');
        const res = await ipcRenderer.invoke('show-open-dialog', {
          properties: ['openDirectory', 'createDirectory'],
          title: '选择目标项目目录'
        });
        if (res && res.filePaths && res.filePaths.length > 0) {
          pathInput.value = res.filePaths[0];
        }
      } catch (err) {
        const manual = prompt('请输入或粘贴目标项目的本地绝对路径：', pathInput.value);
        if (manual) pathInput.value = manual.trim();
      }
    };

    // 点击开始迁移
    submitBtn.onclick = () => {
      const targetPath = pathInput.value.trim();
      if (!targetPath) {
        alert('请输入目标项目路径！');
        return;
      }
      overlay.remove();
      executeMigration(targetPath);
    };
  }

  // 触发迁移：自动向聊天框发送迁移指令
  function executeMigration(targetPath) {
    const promptText = `请使用 chat-to-project 插件将当前聊天的所有讨论内容、生成的代码与架构决策迁移到项目：${targetPath}`;
    
    // 寻找输入框并自动输入发送
    const textarea = document.querySelector('textarea, div[contenteditable="true"]');
    if (textarea) {
      if (textarea.tagName === 'TEXTAREA') {
        textarea.value = promptText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        textarea.innerText = promptText;
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }

      // 模拟点击发送按钮或按回车
      setTimeout(() => {
        const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="发送"], button[type="submit"]');
        if (sendBtn) {
          sendBtn.click();
        } else {
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      }, 100);
    } else {
      alert(`已确认目标路径：${targetPath}。\n请直接在对话框中发送：“将当前会话移动至 ${targetPath}” 即可启动迁移！`);
    }
  }

  // 挂载按钮到顶部栏
  function tryMountButton() {
    if (document.getElementById('c2p-header-btn')) return;

    injectStyles();

    // 寻找合适的挂载位置：优先放在右上角控制区或新建会话旁边
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

    // 尝试寻找顶栏容器
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

    // 若未匹配到特定 header，则挂载在固定右上角（优雅悬浮胶囊形态）
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
