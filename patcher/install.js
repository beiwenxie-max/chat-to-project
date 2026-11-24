#!/usr/bin/env node

/**
 * Antigravity Chat-to-Project 客户端补丁安装器
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INJECT_SCRIPT_PATH = path.join(__dirname, 'inject-ui.js');

function findAppAsar() {
  const platform = os.platform();
  const candidates = [];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Antigravity.app/Contents/Resources/app.asar',
      path.join(os.homedir(), 'Applications/Antigravity.app/Contents/Resources/app.asar')
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    candidates.push(
      path.join(localAppData, 'Programs', 'antigravity', 'resources', 'app.asar'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'antigravity', 'resources', 'app.asar')
    );
  } else {
    candidates.push(
      '/opt/Antigravity/resources/app.asar',
      '/usr/lib/antigravity/resources/app.asar'
    );
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function runCommand(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
  } catch (err) {
    throw new Error(`执行命令失败 [${cmd}]: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 开始安装 Chat-to-Project 客户端界面补丁...\n');

  const asarPath = findAppAsar();
  if (!asarPath) {
    console.error('❌ 未能自动定位到 Antigravity 的 app.asar 路径。请确认客户端已安装。');
    process.exit(1);
  }
  console.log(`📦 发现目标程序: ${asarPath}`);

  // 1. 安全备份
  const backupPath = asarPath + '.c2p.bak';
  if (!fs.existsSync(backupPath)) {
    console.log(`🛡️ 创建安全备份: ${backupPath}`);
    fs.copyFileSync(asarPath, backupPath);
  } else {
    console.log(`ℹ️ 已存在初始备份，跳过覆盖`);
  }

  const tempExtractDir = path.join(os.tmpdir(), 'agy-c2p-extract-' + Date.now());
  const tempPackAsar = path.join(os.tmpdir(), 'agy-c2p-packed-' + Date.now() + '.asar');

  try {
    // 2. 解包
    console.log('📂 正在解包 app.asar...');
    runCommand(`npx -y @electron/asar@3.2.14 extract "${asarPath}" "${tempExtractDir}"`);

    // 3. 寻找 preload.js 并注入 UI 脚本
    const preloadPath = path.join(tempExtractDir, 'dist', 'preload.js');
    if (!fs.existsSync(preloadPath)) {
      throw new Error(`未找到 preload.js 文件: ${preloadPath}`);
    }

    console.log('💉 正在注入客户端前端按钮与交互模态框脚本...');
    const injectContent = fs.readFileSync(INJECT_SCRIPT_PATH, 'utf-8');
    let preloadContent = fs.readFileSync(preloadPath, 'utf-8');

    // 清除可能存在的旧注入
    const flagStart = '// --- Chat-to-Project UI Injection Start ---';
    const flagEnd = '// --- Chat-to-Project UI Injection End ---';
    if (preloadContent.includes(flagStart)) {
      const regex = new RegExp(`${flagStart}[\\s\\S]*?${flagEnd}`, 'g');
      preloadContent = preloadContent.replace(regex, '');
    }

    const wrappedInjection = `\n${flagStart}\n${injectContent}\n${flagEnd}\n`;
    preloadContent += wrappedInjection;
    fs.writeFileSync(preloadPath, preloadContent, 'utf-8');

    // 4. 重新打包
    console.log('📦 正在重新打包 app.asar...');
    // 检查是否有 unpacked 目录
    const unpackedDir = asarPath + '.unpacked';
    let unpackArgs = '';
    if (fs.existsSync(unpackedDir)) {
      unpackArgs = '--unpack "**/*.node"';
    }
    runCommand(`npx -y @electron/asar@3.2.14 pack "${tempExtractDir}" "${tempPackAsar}" ${unpackArgs}`);

    // 5. 替换新 asar
    fs.copyFileSync(tempPackAsar, asarPath);
    console.log('✅ app.asar 替换成功！');

    // 6. macOS 重新签名
    if (os.platform() === 'darwin') {
      console.log('🔏 正在执行 macOS 深度重新签名...');
      const appPath = asarPath.substring(0, asarPath.indexOf('.app') + 4);
      try {
        runCommand(`codesign --force --deep --sign - "${appPath}"`);
        console.log('✅ 签名成功！');
      } catch (signErr) {
        console.warn('⚠️ 重新签名出现提示（通常不影响运行）:', signErr.message);
      }
    }

    console.log('\n🎉 补丁安装成功！');
    console.log('👉 请完全退出并重新启动 Antigravity 客户端。');
    console.log('👉 启动后，在聊天窗口右上角即可看到全新的【移动至项目】按钮！\n');

  } finally {
    // 清理临时目录
    try {
      if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
      if (fs.existsSync(tempPackAsar)) fs.rmSync(tempPackAsar, { force: true });
    } catch (e) {}
  }
}

main().catch(err => {
  console.error('\n❌ 安装过程发生异常:', err.message);
  process.exit(1);
});
