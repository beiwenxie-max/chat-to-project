/**
 * Antigravity Chat-to-Project Main Process IPC Handler
 * 运行在 Electron 主进程（无 Chromium/Seatbelt 沙箱限制），
 * 负责可靠读写本地 SQLite 数据库与文件系统。
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function registerMainIpc() {
  if (global.__AGY_CHAT_TO_PROJECT_MAIN_REGISTERED__) return;
  global.__AGY_CHAT_TO_PROJECT_MAIN_REGISTERED__ = true;

  console.log('[Chat-to-Project] Registering main process IPC handlers...');

  // 1. 获取所有已知项目（主进程直接无沙箱读取）
  ipcMain.handle('chat-to-project:get-projects', async () => {
    const projects = [];
    const seenPaths = new Set();
    const homedir = os.homedir();

    // 1.1 从 conversation_summaries.db 查询已有归属项目
    const dbPath = path.join(homedir, '.gemini/antigravity/conversation_summaries.db');
    if (fs.existsSync(dbPath)) {
      try {
        const sql = 'SELECT DISTINCT project_id, workspace_uris FROM conversation_summaries WHERE project_id != "" AND project_id != "outside-of-project";';
        const stdout = execFileSync('/usr/bin/sqlite3', ['-separator', '|', dbPath, sql], { encoding: 'utf-8' });
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (!line.includes('|')) continue;
          const [pid, urisRaw] = line.split('|');
          if (!pid || !urisRaw) continue;
          try {
            const urisArray = JSON.parse(urisRaw);
            if (Array.isArray(urisArray) && urisArray.length > 0) {
              const fileUri = urisArray[0];
              const rawPath = decodeURIComponent(fileUri.replace(/^file:\/\//, ''));
              if (rawPath && !seenPaths.has(rawPath)) {
                seenPaths.add(rawPath);
                projects.push({
                  name: path.basename(rawPath) || pid,
                  id: pid,
                  path: rawPath,
                  uri: fileUri
                });
              }
            }
          } catch (jsonErr) {}
        }
      } catch (dbErr) {
        console.warn('[Chat-to-Project] Main IPC query db error:', dbErr.message);
      }
    }

    // 1.2 从 scratch 目录提取可能尚未建会话的项目（例如 自媒体之路、CLI 项目）
    const scratchDir = path.join(homedir, '.gemini/antigravity/scratch');
    if (fs.existsSync(scratchDir)) {
      try {
        const entries = fs.readdirSync(scratchDir);
        for (const d of entries) {
          if (d.startsWith('.')) continue;
          const fullPath = path.join(scratchDir, d);
          if (fs.statSync(fullPath).isDirectory() && !seenPaths.has(fullPath)) {
            seenPaths.add(fullPath);
            projects.push({
              name: d,
              id: 'scratch_' + Buffer.from(d).toString('hex').substring(0, 12),
              path: fullPath,
              uri: 'file://' + encodeURI(fullPath)
            });
          }
        }
      } catch (scratchErr) {
        console.warn('[Chat-to-Project] Main IPC read scratch error:', scratchErr.message);
      }
    }

    return projects;
  });

  // 2. 执行真正的会话项目重绑定与本地文件落盘
  ipcMain.handle('chat-to-project:bind-conversation', async (event, payload) => {
    const { convId, targetPath, targetProjectId, options = {} } = payload;
    if (!targetPath) throw new Error('缺少目标项目路径');

    const homedir = os.homedir();
    const resolvedPath = targetPath.startsWith('~')
      ? targetPath.replace(/^~(?=$|\/|\\)/, homedir)
      : path.resolve(targetPath);

    // 2.1 确保本地项目目录真实存在
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    // 2.2 自动生成 PROJECT_CONTEXT.md
    if (options.optContext !== false) {
      const contextFile = path.join(resolvedPath, 'PROJECT_CONTEXT.md');
      if (!fs.existsSync(contextFile)) {
        fs.writeFileSync(
          contextFile,
          `# 项目背景与会话继承上下文 (Project Context)\n\n` +
          `> 本文档由 Antigravity chat-to-project 插件自动生成并沉淀。\n\n` +
          `## 1. 项目愿景与目标\n- 继承自前序普通会话讨论。\n\n` +
          `## 2. 架构决策与选型\n- 详见历史会话记录。\n`,
          'utf-8'
        );
      }
    }

    // 2.3 注入 .agents/rules/
    if (options.optRules !== false) {
      const rulesDir = path.join(resolvedPath, '.agents', 'rules');
      if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
      const ruleFile = path.join(rulesDir, 'project-context.md');
      if (!fs.existsSync(ruleFile)) {
        fs.writeFileSync(
          ruleFile,
          `# 项目上下文与背景继承\n\n- 本项目由 Antigravity 会话沉淀迁移创建，技术决策详见 PROJECT_CONTEXT.md。\n`,
          'utf-8'
        );
      }
    }

    // 2.4 初始化 Git
    if (options.optGit) {
      const gitDir = path.join(resolvedPath, '.git');
      if (!fs.existsSync(gitDir)) {
        try {
          execFileSync('git', ['init'], { cwd: resolvedPath });
        } catch (gitErr) {}
      }
    }

    // 2.5 核心：修改 SQLite 数据库绑定关系
    const finalProjectId = targetProjectId || ('proj_' + Date.now().toString(36));
    const targetWorkspaceUri = JSON.stringify([`file://${encodeURI(resolvedPath)}`]);
    const dbPath = path.join(homedir, '.gemini/antigravity/conversation_summaries.db');

    let dbUpdated = false;
    if (convId && fs.existsSync(dbPath)) {
      try {
        const updateSql = `UPDATE conversation_summaries SET project_id = '${finalProjectId}', workspace_uris = '${targetWorkspaceUri.replace(/'/g, "''")}' WHERE conversation_id = '${convId}';`;
        execFileSync('/usr/bin/sqlite3', [dbPath, updateSql], { encoding: 'utf-8' });
        dbUpdated = true;
        console.log(`[Chat-to-Project] Successfully rebound conversation ${convId} to project ${finalProjectId}`);
      } catch (sqlErr) {
        console.error('[Chat-to-Project] SQLite update error:', sqlErr.message);
      }
    }

    return {
      success: true,
      convId,
      projectId: finalProjectId,
      workspacePath: resolvedPath,
      dbUpdated
    };
  });
}

module.exports = { registerMainIpc };
