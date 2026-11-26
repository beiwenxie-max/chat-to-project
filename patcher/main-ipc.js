/**
 * Antigravity Chat-to-Project Main Process IPC Handler
 * 运行在 Electron 主进程（无渲染沙箱限制），负责：
 * 1. 调用 Language Server 官方 RPC (ListProjects / ReadProjects) 获取真实项目列表
 * 2. 同步修改 conversations/<id>.db (Protobuf trajectory_metadata_blob)
 * 3. 调用官方 RPC JetboxWriteSummary，实时同步内存、agyhub_summaries_proto.pb 与响应式 UI！
 * 4. 补全 conversation_summaries.db 的标题与预览无损保留
 */

const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

function getActiveLsAuth() {
  let baseUrl = '';
  let csrfToken = '';

  try {
    const authBootstrap = require('./authBootstrap');
    if (typeof authBootstrap.getActiveLsBaseUrl === 'function') {
      baseUrl = authBootstrap.getActiveLsBaseUrl() || '';
    }
    if (typeof authBootstrap.getActiveLsCsrfToken === 'function') {
      csrfToken = authBootstrap.getActiveLsCsrfToken() || '';
    }
  } catch (e) {}

  if (!baseUrl) {
    try {
      const ls = require('./languageServer');
      if (typeof ls.getLsBaseUrl === 'function') baseUrl = ls.getLsBaseUrl() || '';
      if (typeof ls.getLsCsrfToken === 'function') csrfToken = ls.getLsCsrfToken() || '';
    } catch (e) {}
  }

  if (!baseUrl && process.env.ANTIGRAVITY_LS_ADDRESS) {
    baseUrl = `http://${process.env.ANTIGRAVITY_LS_ADDRESS}`;
  }
  if (!csrfToken && process.env.ANTIGRAVITY_CSRF_TOKEN) {
    csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN;
  }

  return { baseUrl, csrfToken };
}

function callLanguageServer(method, bodyObj = {}) {
  return new Promise((resolve, reject) => {
    const { baseUrl, csrfToken } = getActiveLsAuth();
    if (!baseUrl) {
      return reject(new Error('Language Server baseUrl unavailable'));
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(`/exa.language_server_pb.LanguageServerService/${method}`, baseUrl);
    } catch (e) {
      return reject(e);
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const payload = JSON.stringify(bodyObj);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-codeium-csrf-token': csrfToken || ''
      },
      rejectUnauthorized: false,
      timeout: 5000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch (err) {
          reject(new Error(`Invalid JSON from LS ${method}: ${data.substring(0, 120)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout calling LS ${method}`));
    });
    req.write(payload);
    req.end();
  });
}

function extractProjectLocation(proj) {
  let uri = '';
  let localPath = '';
  try {
    const resources = proj?.projectResources?.resources || [];
    for (const r of resources) {
      if (r.gitFolder?.folderUri) {
        uri = r.gitFolder.folderUri;
        break;
      }
      if (r.folder?.folderUri) {
        uri = r.folder.folderUri;
        break;
      }
      if (r.workspaceFolder?.folderUri) {
        uri = r.workspaceFolder.folderUri;
        break;
      }
    }
    if (uri) {
      localPath = decodeURIComponent(uri.replace(/^file:\/\//, ''));
    }
  } catch (e) {}
  return { uri, localPath };
}

function updateTrajectoryMetadataBlob(convDbPath, newProjectId) {
  if (!fs.existsSync(convDbPath)) return false;

  const hexOut = execFileSync('/usr/bin/sqlite3', [
    convDbPath,
    'SELECT hex(data) FROM trajectory_metadata_blob WHERE id = "main";'
  ], { encoding: 'utf-8' }).trim();

  if (!hexOut) return false;
  const buf = Buffer.from(hexOut, 'hex');
  const newIdBuf = Buffer.from(newProjectId, 'utf-8');

  const outsidePattern = Buffer.from('920112' + Buffer.from('outside-of-project').toString('hex'), 'hex');
  let newBuf = null;

  const exactIdx = buf.indexOf(outsidePattern);
  if (exactIdx !== -1) {
    newBuf = Buffer.concat([
      buf.subarray(0, exactIdx),
      Buffer.from([0x92, 0x01, newIdBuf.length]),
      newIdBuf,
      buf.subarray(exactIdx + outsidePattern.length)
    ]);
  } else {
    const tag = Buffer.from([0x92, 0x01]);
    let searchPos = buf.lastIndexOf(tag);
    if (searchPos !== -1 && searchPos + 2 < buf.length) {
      const oldLen = buf[searchPos + 2];
      if (oldLen > 0 && oldLen < 128 && searchPos + 3 + oldLen <= buf.length) {
        const candidateStr = buf.subarray(searchPos + 3, searchPos + 3 + oldLen).toString('utf-8');
        if (/^[a-zA-Z0-9_-]+$/.test(candidateStr)) {
          newBuf = Buffer.concat([
            buf.subarray(0, searchPos),
            Buffer.from([0x92, 0x01, newIdBuf.length]),
            newIdBuf,
            buf.subarray(searchPos + 3 + oldLen)
          ]);
        }
      }
    }
  }

  if (!newBuf) {
    newBuf = Buffer.concat([
      buf,
      Buffer.from([0x92, 0x01, newIdBuf.length]),
      newIdBuf
    ]);
  }

  const newHex = newBuf.toString('hex').toUpperCase();
  execFileSync('/usr/bin/sqlite3', [
    convDbPath,
    `UPDATE trajectory_metadata_blob SET data = X'${newHex}' WHERE id = 'main';`
  ], { encoding: 'utf-8' });

  return true;
}

// 格式化 SQLite datetime 为 RFC3339 (供 Protobuf Timestamp 使用)
function toRfc3339(dtStr) {
  if (!dtStr) return new Date().toISOString();
  try {
    return new Date(dtStr).toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

function registerMainIpc() {
  if (global.__AGY_CHAT_TO_PROJECT_MAIN_REGISTERED__) return;
  global.__AGY_CHAT_TO_PROJECT_MAIN_REGISTERED__ = true;

  console.log('[Chat-to-Project] Registering main process IPC handlers...');

  ipcMain.handle('chat-to-project:get-projects', async () => {
    const projects = [];
    const seenIds = new Set();
    const homedir = os.homedir();

    try {
      const listRes = await callLanguageServer('ListProjects', {});
      const ids = (listRes?.projectIds || []).filter(id => id && id !== 'outside-of-project');
      if (ids.length > 0) {
        const readRes = await callLanguageServer('ReadProjects', { ids });
        const rawProjects = readRes?.projects || [];
        for (const proj of rawProjects) {
          if (proj.sidecar) continue;
          const { uri, localPath } = extractProjectLocation(proj);
          seenIds.add(proj.id);
          projects.push({
            id: proj.id,
            name: proj.name || (localPath ? path.basename(localPath) : proj.id),
            path: localPath || path.join(homedir, proj.name || proj.id),
            uri: uri || `file://${encodeURI(path.join(homedir, proj.name || proj.id))}`
          });
        }
      }
    } catch (rpcErr) {
      console.warn('[Chat-to-Project] Official LS RPC get-projects fallback:', rpcErr.message);
    }

    const dbPath = path.join(homedir, '.gemini/antigravity/conversation_summaries.db');
    if (fs.existsSync(dbPath)) {
      try {
        const sql = 'SELECT DISTINCT project_id, workspace_uris FROM conversation_summaries WHERE project_id != "" AND project_id != "outside-of-project";';
        const stdout = execFileSync('/usr/bin/sqlite3', ['-separator', '|', dbPath, sql], { encoding: 'utf-8' });
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (!line.includes('|')) continue;
          const [pid, urisRaw] = line.split('|');
          if (!pid || !urisRaw || seenIds.has(pid)) continue;
          try {
            const urisArray = JSON.parse(urisRaw);
            if (Array.isArray(urisArray) && urisArray.length > 0) {
              const fileUri = urisArray[0];
              const rawPath = decodeURIComponent(fileUri.replace(/^file:\/\//, ''));
              seenIds.add(pid);
              projects.push({
                id: pid,
                name: path.basename(rawPath) || pid,
                path: rawPath,
                uri: fileUri
              });
            }
          } catch (jsonErr) {}
        }
      } catch (dbErr) {}
    }

    return projects;
  });

  ipcMain.handle('chat-to-project:get-active-conv-id', async () => {
    const dbPath = path.join(os.homedir(), '.gemini/antigravity/conversation_summaries.db');
    if (fs.existsSync(dbPath)) {
      try {
        const sql = `SELECT conversation_id FROM conversation_summaries WHERE project_id = 'outside-of-project' ORDER BY last_modified_time DESC LIMIT 1;`;
        const out = execFileSync('/usr/bin/sqlite3', [dbPath, sql], { encoding: 'utf-8' }).trim();
        if (out) return out;
      } catch (e) {}
    }
    return '';
  });

  ipcMain.handle('chat-to-project:bind-conversation', async (event, payload) => {
    const { convId, targetPath, targetProjectId, targetUri, options = {} } = payload;
    if (!targetPath) throw new Error('缺少目标项目路径');
    if (!convId) throw new Error('未能识别当前会话 ID');

    const homedir = os.homedir();
    const resolvedPath = targetPath.startsWith('~')
      ? targetPath.replace(/^~(?=$|\/|\\)/, homedir)
      : path.resolve(targetPath);

    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    if (options.optContext !== false) {
      const contextFile = path.join(resolvedPath, 'PROJECT_CONTEXT.md');
      if (!fs.existsSync(contextFile)) {
        fs.writeFileSync(
          contextFile,
          `# 项目背景与会话继承上下文 (Project Context)\n\n` +
          `> 本文档由 Antigravity chat-to-project 插件自动生成并沉淀。\n\n` +
          `## 1. 项目愿景与目标\n- 继承自前序普通会话 (${convId})。\n`,
          'utf-8'
        );
      }
    }

    if (options.optRules !== false) {
      const rulesDir = path.join(resolvedPath, '.agents', 'rules');
      if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
      const ruleFile = path.join(rulesDir, 'project-context.md');
      if (!fs.existsSync(ruleFile)) {
        fs.writeFileSync(
          ruleFile,
          `# 项目上下文与背景继承\n\n- 本项目已承接会话 \`${convId}\` 的上下文，详见 \`PROJECT_CONTEXT.md\`。\n`,
          'utf-8'
        );
      }
    }

    const finalProjectId = targetProjectId || ('proj_' + Date.now().toString(36));
    const finalUri = targetUri || `file://${encodeURI(resolvedPath)}`;
    const targetWorkspaceUriJson = JSON.stringify([finalUri]);

    let summaryUpdated = false;
    let blobUpdated = false;
    let jetboxUpdated = false;

    if (options.optBind !== false) {
      const summaryDbPath = path.join(homedir, '.gemini/antigravity/conversation_summaries.db');

      // 1. 先备份读取原有标题与元数据
      let origTitle = '';
      let origPreview = '';
      let origStepCount = 1;
      let origLastMod = '';
      let origLastInput = '';
      let origLastInputIdx = 0;

      if (fs.existsSync(summaryDbPath)) {
        try {
          const rowOut = execFileSync('/usr/bin/sqlite3', [
            '-separator', '\x1F',
            summaryDbPath,
            `SELECT title, preview, step_count, last_modified_time, last_user_input_time, last_user_input_step_index FROM conversation_summaries WHERE conversation_id = '${convId}';`
          ], { encoding: 'utf-8' }).trim();
          if (rowOut) {
            const parts = rowOut.split('\x1F');
            origTitle = parts[0] || '';
            origPreview = parts[1] || '';
            origStepCount = parseInt(parts[2], 10) || 1;
            origLastMod = parts[3] || '';
            origLastInput = parts[4] || '';
            origLastInputIdx = parseInt(parts[5], 10) || 0;
          }
        } catch (e) {}
      }

      // 2. 更新源头：conversations/<convId>.db 的 trajectory_metadata_blob
      const convDbPath = path.join(homedir, '.gemini/antigravity/conversations', `${convId}.db`);
      try {
        blobUpdated = updateTrajectoryMetadataBlob(convDbPath, finalProjectId);
      } catch (blobErr) {
        console.error('[Chat-to-Project] Blob update error:', blobErr.message);
      }

      // 3. 获取现有 TrajectorySummary 对象并调用官方 JetboxWriteSummary RPC（同步内存 + agyhub_summaries_proto.pb + 响应式 UI）
      try {
        let summaryObj = null;
        try {
          const allRes = await callLanguageServer('GetAllCascadeTrajectories', {});
          if (allRes?.trajectorySummaries?.[convId]) {
            summaryObj = allRes.trajectorySummaries[convId];
          }
        } catch (e) {}

        if (!summaryObj) {
          let trajId = '';
          try {
            const trajRes = await callLanguageServer('GetCascadeTrajectory', { cascadeId: convId });
            trajId = trajRes?.trajectory?.trajectoryId || '';
          } catch (e) {}

          summaryObj = {
            summary: origTitle || 'Migrated Conversation',
            stepCount: origStepCount,
            lastModifiedTime: toRfc3339(origLastMod),
            trajectoryId: trajId,
            status: 'CASCADE_RUN_STATUS_IDLE',
            createdTime: toRfc3339(origLastMod),
            lastUserInputTime: toRfc3339(origLastInput),
            lastUserInputStepIndex: origLastInputIdx,
            annotations: {
              title: origTitle || 'Migrated Conversation'
            },
            trajectoryType: 'CORTEX_TRAJECTORY_TYPE_CASCADE'
          };
        }

        summaryObj.trajectoryMetadata = summaryObj.trajectoryMetadata || {};
        summaryObj.trajectoryMetadata.rootConversationId = convId;
        summaryObj.trajectoryMetadata.projectId = finalProjectId;
        summaryObj.trajectoryMetadata.workspaceUris = [finalUri];
        summaryObj.trajectoryMetadata.workspaces = [{ workspaceFolderAbsoluteUri: finalUri }];

        await callLanguageServer('JetboxWriteSummary', {
          cascadeId: convId,
          summary: summaryObj
        });
        jetboxUpdated = true;
      } catch (rpcErr) {
        console.warn('[Chat-to-Project] JetboxWriteSummary warning:', rpcErr.message);
      }

      // 4. 确保 conversation_summaries.db 更新完整并保留原有 title 和 preview
      if (fs.existsSync(summaryDbPath)) {
        try {
          const safeTitle = origTitle.replace(/'/g, "''");
          const safePreview = origPreview.replace(/'/g, "''");
          const updateSql = `UPDATE conversation_summaries SET project_id = '${finalProjectId}', workspace_uris = '${targetWorkspaceUriJson.replace(/'/g, "''")}'${origTitle ? `, title = '${safeTitle}'` : ''}${origPreview ? `, preview = '${safePreview}'` : ''} WHERE conversation_id = '${convId}';`;
          execFileSync('/usr/bin/sqlite3', [summaryDbPath, updateSql], { encoding: 'utf-8' });
          summaryUpdated = true;
        } catch (sqlErr) {
          console.error('[Chat-to-Project] Summary SQLite update error:', sqlErr.message);
        }
      }
    }

    return {
      success: true,
      convId,
      projectId: finalProjectId,
      workspacePath: resolvedPath,
      summaryUpdated,
      blobUpdated,
      jetboxUpdated
    };
  });

  ipcMain.handle('chat-to-project:relaunch-app', async () => {
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 300);
    return { ok: true };
  });
}

module.exports = { registerMainIpc };
