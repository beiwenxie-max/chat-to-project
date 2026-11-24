# Antigravity Chat-to-Project 插件

[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin-blue.svg)](https://antigravity.google)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 一键将 Google Antigravity 中的普通/全局对话无缝平移至本地项目工作区，自动导出讨论背景、转移临时文件并初始化工程上下文。

---

## 💡 痛点与背景

很多时候开发者习惯在 Antigravity 的普通/全局会话（无工作区状态）中快速验证想法、探讨架构或讨论代码片段。随着方案逐渐明晰，希望直接在本地正式工程中继续开发。

然而当前平台尚不支持一键将已有会话所属的项目绑定重定向，导致用户需要手动复制粘贴或多次重复描述背景。

**`chat-to-project` 插件正是为了解决这一痛点而生！**

## ✨ 核心特性

- 🚀 **智能上下文提炼**：自动梳理当前聊天的愿景目标、技术选型决策与未竟任务，自动生成 `PROJECT_CONTEXT.md`。
- 📦 **资产无缝归仓**：自动将当前会话在临时目录或 Artifacts 中生成的代码脚本转移至新项目工程。
- 🤖 **智能体无缝继承**：在目标项目中自动配置 `.agents/rules/`，打开新工作区后智能体即刻感知所有前序背景。
- 🔧 **开箱即用**：支持自动初始化本地 Git 仓库并完成首个工程提交。

---

## 📥 安装方法

### 方式一：克隆到 Antigravity 插件目录（推荐）

```bash
git clone https://github.com/beiwenxie-max/chat-to-project.git ~/.gemini/config/plugins/chat-to-project
```

### 方式二：本地软链接

如果您在特定目录开发本插件：
```bash
ln -s "/path/to/chat-to-project" ~/.gemini/config/plugins/chat-to-project
```

安装完成后，无需重启，Antigravity 会自动发现并加载该插件。

---

## 🎯 使用方式

在任意普通聊天或未关联项目的会话中，直接对智能体说：

- *“帮我把当前的讨论和代码移动到项目 ~/projects/my-new-app”*
- *“将当前聊天转为本地项目”*
- *“把刚刚讨论的方案保存为一个工程”*

智能体将自动调用 `chat-to-project` 技能完成全套迁移流程，并引导您在 Antigravity 侧边栏打开该项目。

---

## 🗺️ 未来迭代路线图 (Roadmap)

- [x] v1.0: 基础会话上下文提炼、文件搬迁与 `.agents/` 规则配置
- [ ] v1.1: 增加自动化 CLI 脚本（支持直接解析 `transcript.jsonl` 会话日志）
- [ ] v1.2: 支持将多个普通会话的成果合并归并至同一项目
- [ ] v1.3: 增加桌面端 GUI 快捷右键菜单适配

---

## 📄 开源许可证

本项目基于 [MIT](LICENSE) 许可证开源。欢迎提交 Issue 与 Pull Request！
