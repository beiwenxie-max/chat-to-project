# Antigravity Chat-to-Project

[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin-blue.svg)](https://antigravity.google)
[![GitHub](https://img.shields.io/badge/GitHub-beiwenxie--max%2Fchat--to--project-181717.svg?logo=github)](https://github.com/beiwenxie-max/chat-to-project)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 一键将 Google Antigravity 中的普通/全局对话无缝平移至本地项目工作区，自动导出讨论背景、转移临时文件并初始化工程上下文。
> 包含**客户端原生界面按钮注入补丁**与**智能体迁移插件**。

---

## ✨ 核心特性

1. 🖥️ **客户端界面原生嵌入（方案 A）**：通过客户端补丁，在 Antigravity 聊天窗口右上角直接长出【移动至项目】按钮与图形化路径选择弹窗！
2. 🚀 **智能上下文提炼**：自动梳理当前聊天的愿景目标、架构选型、技术决策与未竟任务，沉淀为 `PROJECT_CONTEXT.md`。
3. 📦 **资产无缝归仓**：自动将当前会话在临时目录或 Artifacts 中生成的代码脚本转移至新项目工程。
4. 🤖 **智能体自动继承**：在目标项目中自动配置 `.agents/rules/`，打开新工作区后智能体即刻感知所有前序背景。
5. 🔧 **Git 自动化**：支持自动初始化本地 Git 仓库并完成首个工程提交。

---

## 🚀 客户端按钮嵌入安装 (方案 A)

如果您希望在客户端界面上直接看到【移动至项目】的实体按钮与弹窗，只需运行补丁脚本：

```bash
# 1. 进入本工程目录
cd /Users/sangedeair/projects/chat-to-project

# 2. 一键执行界面注入补丁
npm run patch
```

* 补丁会自动备份原始 `app.asar`，注入界面组件并完成签名。
* 重启 Antigravity 客户端后，聊天窗口右上角即可看到【移动至项目】按钮！
* 若需随时还原客户端，只需执行：`npm run unpatch`。

---

## 📥 智能体插件安装 (插件模式)

如果您同时希望在任何对话中通过自然语言唤起迁移：

### 软链接到插件目录（已为您完成）：
```bash
ln -s "/Users/sangedeair/projects/chat-to-project" ~/.gemini/config/plugins/chat-to-project
```

---

## 🎯 使用方式

### 方式 1：点击客户端界面按钮（推荐）
1. 在聊天窗口右上角点击 **【移动至项目】** 按钮；
2. 弹出图形化配置卡片，选择或输入目标本地工程路径；
3. 点击 **【开始迁移】**，系统自动完成会话导出与工程落盘！

### 方式 2：对话输入
在任意普通聊天或未关联项目的会话中直接说：
- *“帮我把当前的讨论和代码移动到项目 ~/projects/my-new-app”*
- *“将当前聊天转为本地项目”*

---

## 🗺️ 迭代路线图 (Roadmap)

- [x] v1.0: 基础会话上下文提炼、文件搬迁与 `.agents/` 规则配置
- [x] v1.1: 客户端桌面界面【移动至项目】按钮与弹窗 DOM 注入补丁 (Patcher)
- [ ] v1.2: 深度注入左侧历史会话树的原生右键上下文菜单
- [ ] v1.3: 支持将多个普通会话的成果合并归并至同一项目

---

## 📄 许可证

本项目基于 MIT 许可证开源。欢迎提交 Issue 与 Pull Request！
