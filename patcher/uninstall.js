#!/usr/bin/env node

/**
 * Antigravity Chat-to-Project 客户端补丁还原卸载器
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

function main() {
  console.log('🔄 开始还原客户端补丁...\n');

  const asarPath = findAppAsar();
  if (!asarPath) {
    console.error('❌ 未能找到目标 app.asar');
    process.exit(1);
  }

  const backupPath = asarPath + '.c2p.bak';
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ 未找到初始备份文件: ${backupPath}`);
    process.exit(1);
  }

  console.log(`📦 正在从备份恢复: ${backupPath} -> ${asarPath}`);
  fs.copyFileSync(backupPath, asarPath);

  if (os.platform() === 'darwin') {
    const appPath = asarPath.substring(0, asarPath.indexOf('.app') + 4);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'ignore' });
      console.log('✅ macOS 重新签名完成');
    } catch (e) {}
  }

  console.log('\n🎉 还原完成！Antigravity 客户端已恢复为打补丁前的状态。');
}

main();
