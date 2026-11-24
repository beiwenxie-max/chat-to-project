---
name: chat-to-project
description: 将当前普通聊天（全局/未关联项目会话）一键固化并迁移至本地项目工作区。当用户提出“将当前聊天移动到项目”、“转为项目”、“把方案导出到项目”、“将对话保存为工程”时使用。自动生成项目上下文、迁移生成的文件并配置智能体继承规则。
---

# Chat to Project (会话转项目工作区)

本技能用于解决用户在全局/普通会话中头脑风暴或探讨技术方案后，无法直接将当前聊天环境无缝迁移到正式项目的问题。

通过执行标准化的上下文继承协议，本技能将当前聊天的所有技术决策、代码成果、架构设计与未竟待办，完整导出并固化至目标项目工作区中。

## 触发场景
当用户表达如下意图时触发：
- “将当前聊天移动/转到项目”
- “把现在的讨论建立成一个项目”
- “把这些代码和方案保存到某个工程里”
- “将这个会话固化为本地工作区”

---

## 执行标准作业流程 (SOP)

### 第一步：确认或创建目标项目路径
1. 若用户在指令中已指定路径（如 `/Users/.../my-app`），直接使用该路径。
2. 若用户未指定具体路径：
   - 优先建议在用户的项目常用目录或默认工作区创建子目录（例如 `~/projects/<project-name>`）。
   - 向用户快速确认项目名称与目录路径。
3. 创建目标目录：
   ```bash
   mkdir -p "<TARGET_PROJECT_PATH>"
   ```

### 第二步：提取会话上下文与生成沉淀文档
在 `<TARGET_PROJECT_PATH>/PROJECT_CONTEXT.md` 写入当前会话的完整上下文摘要，格式如下：

```markdown
# 项目背景与会话继承上下文 (Project Context)

> 本文档由 Antigravity `chat-to-project` 插件自动生成。记录了从前序普通会话中继承的核心技术决策、业务逻辑与待办事项。

## 1. 项目愿景与目标 (Vision & Goals)
- [核心业务目标/解决的痛点]

## 2. 关键架构与技术选型 (Architecture & Tech Stack)
- [语言、框架、主要依赖库及选型理由]

## 3. 已确立的核心逻辑与规范 (Decisions & Standards)
- [在会话中已经敲定的数据模型、接口格式、业务流程]

## 4. 下一步待办事项清单 (Action Items)
- [ ] [未完成的具体任务 1]
- [ ] [未完成的具体任务 2]
```

### 第三步：配置项目级智能体继承规则 (Auto-Inherit Rules)
在目标项目中创建 `.agents/rules/project-context.md`，使之后在 Antigravity 中打开该项目时，新会话的智能体能自动继承所有前序背景：

```markdown
# 项目上下文与背景继承

- **历史背景**：本项目由 Antigravity 普通会话沉淀创建，完整技术脉络详见 `PROJECT_CONTEXT.md`。
- **行为准则**：在执行新任务前，请优先参考 `PROJECT_CONTEXT.md` 中已确立的架构决策与技术选型，避免推翻既有结论。
```

### 第四步：迁移所有临时资产 (Artifacts & Scratch Files)
1. 检查当前会话生成的所有代码、脚本或临时产物（包括 `<appDataDir>/brain/<conversation-id>/scratch/` 与 artifacts 目录）。
2. 将有效产物复制或移动至目标项目合适位置（例如 `src/`, `scripts/`, `docs/`）。

### 第五步：项目初始化与 Git 提交通知
1. 检查目标项目是否已为 Git 仓库：
   ```bash
   if [ ! -d "<TARGET_PROJECT_PATH>/.git" ]; then
     cd "<TARGET_PROJECT_PATH>"
     git init
     git add .
     git commit -m "chore: initial commit from Antigravity conversation migration"
   fi
   ```
2. 向用户返回操作完成报告，并附带以下行动指引：
   - 目标项目路径链接：`[打开目标目录](file://<TARGET_PROJECT_PATH>)`
   - **指引用户在 Antigravity 界面左侧切换工作区**：
     > “请在 Antigravity 界面左侧点击 **Projects** -> **Open Project** 打开 `<TARGET_PROJECT_PATH>`。打开后创建新会话，智能体将自动读取 `.agents/rules/` 和 `PROJECT_CONTEXT.md`，完美承接本次会话的所有内容！”
