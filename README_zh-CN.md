# dedust

[English](./README.md) | 中文

[![Badge](https://img.shields.io/badge/link-996.icu-%23FF4D5B.svg?style=flat-square)](https://996.icu/#/en_US)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=14-blue.svg?style=flat-square)
[![npm version](https://badge.fury.io/js/dedust.svg)](https://badge.fury.io/js/dedust)

一款优雅的文件清理工具，使用简单易读的 DSL `DRL`。

**Dedust 规则语言 (DRL)** - 一种用于定义清理规则的人类可读 DSL。默认配置文件名为 `dedust.rules`。

查看 DSL 设计规范：[spec_zh-CN.md](./spec_zh-CN.md)

## 特性

-   🎯 **简单的 DSL** - 人类可读的、基于行的清理规则
-   🔍 **上下文感知** - 支持父级、子级、同级和祖先目录条件
-   🌟 **Glob 模式** - 完全支持通配符模式（`*.log`、`**/*.tmp` 等）
-   🚀 **快速安全** - 默认干运行模式，需要时显式删除
-   📦 **零配置** - 开箱即用，具有合理的默认值
-   🔧 **TypeScript** - 包含完整的 TypeScript 类型定义
-   📦 **双模块支持** - 同时支持 ESM 和 CommonJS

## 安装

### 作为库使用（用于编程）

在项目中安装 `dedust` 作为依赖项：

```bash
npm install dedust
```

这允许你在 JavaScript/TypeScript 代码中导入和使用 `dedust`：

```javascript
import { parseRules, findTargets, executeCleanup } from "dedust";
```

### 作为全局 CLI 工具

全局安装 `dedust` 以将其用作命令行工具：

```bash
npm install -g dedust
```

全局安装后，你可以在任何地方运行 `dedust`：

```bash
# 预览将被删除的内容（默认行为）
dedust

# 实际删除文件
dedust --delete

# 预览特定目录
dedust /path/to/project1 /path/to/project2

# 使用自定义配置文件删除
dedust --delete --config my-rules.txt
```

**何时使用全局安装与本地安装：**

-   **全局安装（`-g`）**：最适合将 `dedust` 用作跨多个项目的命令行工具。`dedust` 命令在系统范围内可用。
-   **本地安装**：最适合将 `dedust` 集成到项目代码或构建脚本中。该包仅在该项目中可用。

你还可以使用 `npx` 运行 `dedust`，无需全局安装：

```bash
npx dedust
```

## 快速开始

```javascript
import { parseRules, findTargets, executeCleanup } from "dedust";

// 定义清理规则
const dsl = `
  # Rust 项目
  delete target when exists Cargo.toml

  # Node 项目
  delete node_modules when exists package.json

  # Python 项目
  delete .venv when exists pyproject.toml

  # 所有日志文件
  delete *.log
`;

// 查找将被删除的内容（干运行）- 单个目录
const targets = await findTargets(dsl, "/path/to/project");
console.log("将删除:", targets);

// 或一次扫描多个目录
const targets = await findTargets(dsl, ["/path/to/project1", "/path/to/project2"]);

// 实际删除文件 - 单个目录
const result = await executeCleanup(dsl, "/path/to/project");
console.log("已删除:", result.deleted);
console.log("错误:", result.errors);
```

## DSL 语法

### 基本规则结构

```
<Action> <Target> [when <Condition>]
```

### 动作

-   `delete` - 删除匹配的文件或目录
-   `ignore` - 忽略匹配的文件或目录（从删除和匹配中排除）
-   `skip` - 跳过目录遍历但允许匹配（性能优化）

### 目标

目标支持 glob 模式：

-   `target` - 简单的目录/文件名
-   `*.log` - 所有扩展名为 .log 的文件
-   `**/*.tmp` - 递归所有 .tmp 文件
-   `node_modules` - 特定目录名

### Skip 与 Ignore 模式

**Skip 模式** - 从遍历中排除但允许匹配：

```text
# 跳过 node_modules 遍历（提高性能）
skip node_modules

# 但仍允许显式删除
delete node_modules when exists package.json

# node_modules 内的文件不会被 glob 模式找到
delete **/*.js  # 不会匹配 node_modules/**/*.js
```

**主要特性：**

-   Skip 规则防止目录遍历（性能优化）
-   跳过的目录仍然可以被显式删除规则匹配
-   支持所有 glob 模式（例如，`node_modules`、`.cache/**`、`build*`）

**Ignore 模式** - 从遍历和匹配中都排除：

```text
# 完全忽略版本控制目录
ignore .git
ignore .svn

# 使用 glob 模式忽略
ignore node_modules/**
ignore *.keep

# 然后定义清理规则
delete target when exists Cargo.toml
delete *.log
```

**主要特性：**

-   Ignore 规则防止目录遍历（性能优化）
-   被忽略的路径不能被任何删除规则匹配
-   支持所有 glob 模式（例如，`*.log`、`.git/**`、`important.*`）
-   可以与 API 级别的忽略选项结合
-   被忽略的目录及其内容完全跳过

**何时使用哪个：**

-   使用 `skip` 当你想避免遍历大目录但仍允许显式删除时（例如，`skip node_modules` + `delete node_modules when exists package.json`）
-   使用 `ignore` 当你在任何情况下都不想删除某些内容时（例如，`ignore .git`）

### 条件

#### 位置修饰词

-   `here` - 当前目录（默认，可以省略）
-   `parent` - 父目录
-   `parents` - 任何祖先目录
-   `child` - 直接子目录
-   `children` - 任何后代目录
-   `sibling` - 同级目录

#### 谓词

-   `exists <pattern>` - 检查模式是否存在
-   `not exists <pattern>` - 检查模式是否不存在

#### 逻辑运算符

-   `and` - 组合多个条件

### 示例

```text
# 忽略版本控制和依赖项
ignore .git
ignore node_modules
ignore .svn

# 当当前目录存在 Cargo.toml 时删除 target 目录
delete target when exists Cargo.toml

# 删除子 crate 中的 target
delete target when parent exists Cargo.toml

# 仅在两个条件都满足时删除
delete target when exists Cargo.toml and exists src

# 除非存在 keep 文件，否则删除 target
delete target when exists Cargo.toml and not exists keep.txt

# 在 git 仓库中删除日志文件（但不删除 .git 本身）
ignore .git
delete **/*.log when parents exists .git

# 无条件删除
delete *.log

# 为性能跳过大目录
skip node_modules
skip .git
delete node_modules when exists package.json
delete **/*.log  # 不会遍历到 node_modules

# 完全忽略重要文件
ignore *.keep
ignore important/**
delete *.tmp

# 包含空格的模式（使用引号）
delete "My Documents" when exists "Desktop.ini"
delete "Program Files" when exists "*.dll"
delete 'build output' when exists Makefile
```

### 包含空格的模式

对于包含空格的文件或目录名，将模式用引号括起来：

```javascript
// 使用双引号
const dsl = 'delete "My Documents"';

// 或单引号
const dsl = "delete 'Program Files'";

// 在条件中也适用
const dsl = 'delete cache when exists "package.json"';
```

支持的功能：

-   单引号（`'...'`）或双引号（`"..."`）
-   转义序列：`\n`、`\t`、`\\`、`\'`、`\"`
-   目标和条件模式都可以使用引号

## 配置文件

### 使用 `dedust.rules`

在项目根目录创建一个 `dedust.rules` 文件来定义可重用的清理规则。

查看完整的示例配置文件：[dedust.rules](./dedust.rules)

示例配置：

```text
# dedust.rules - 此项目的清理配置

# 为性能跳过大目录
skip node_modules
skip .git

# Rust 项目
delete target when exists Cargo.toml
delete target when parent exists Cargo.toml

# Node.js 项目
delete node_modules when exists package.json
delete .next when exists next.config.js
delete dist when exists package.json

# Python 项目
delete .venv when exists pyproject.toml
delete __pycache__
delete .pytest_cache

# 构建产物和日志
delete *.log
delete **/*.tmp when parents exists .git
```

然后加载并执行规则：

```javascript
import { readFileSync } from "fs";
import { executeCleanup, findTargets } from "dedust";

// 从 dedust.rules 加载规则
const rules = readFileSync("./dedust.rules", "utf-8");

// 预览将被删除的内容
const targets = await findTargets(rules, "/path/to/project");
console.log("将删除:", targets);

// 执行清理
const result = await executeCleanup(rules, "/path/to/project");
console.log("已删除:", result.deleted.length, "项");
```

**使用 `dedust.rules` 的好处：**

-   集中式清理配置
-   版本控制的规则
-   易于在团队成员之间共享
-   可在多个项目中重用
-   自我记录的清理策略

## CLI 使用

如果你已全局安装 `dedust`（使用 `npm install -g dedust`），可以从命令行使用它。

### 基本命令

```bash
# 显示帮助
dedust --help

# 显示版本
dedust --version

# 预览将被删除的内容（默认行为）
dedust

# 实际删除文件
dedust --delete

# 预览特定目录
dedust /path/to/project

# 在多个目录中删除
dedust --delete /path/to/project1 /path/to/project2 /path/to/project3

# 使用自定义配置文件
dedust --config my-cleanup.rules

# 使用自定义配置删除
dedust --delete --config my-cleanup.rules

# 跳过安全验证（谨慎使用！）
dedust --delete --skip-validation
```

### CLI 选项

| 选项                | 别名  | 描述                                         |
| ------------------- | ----- | -------------------------------------------- |
| `--help`            | `-h`  | 显示帮助信息                                 |
| `--version`         | `-v`  | 显示版本号                                   |
| `--dry-run`         | `-d`  | 预览模式（默认 - 此标志是可选的）            |
| `--delete`          | `-D`  | 实际删除文件（需要显式确认）                 |
| `--config <file>`   | `-c`  | 指定配置文件（默认：`dedust.rules`）         |
| `--skip-validation` |       | 跳过安全验证（谨慎使用）                     |

### 示例工作流

```bash
# 首先，在项目中创建 dedust.rules 文件
cat > dedust.rules << 'EOF'
# 跳过版本控制
skip .git

# Rust 项目
delete target when exists Cargo.toml

# Node.js 项目
delete node_modules when exists package.json
delete dist when exists package.json

# 日志文件
delete **/*.log
EOF

# 预览将被删除的内容（默认行为）
dedust

# 如果预览看起来不错，执行清理
dedust --delete

# 使用不同的配置文件预览
dedust --config production.rules

# 使用不同的配置文件删除
dedust --delete --config production.rules

# 一次预览多个工作区
dedust ~/workspace/project1 ~/workspace/project2 ~/workspace/project3

# 在多个工作区中删除
dedust --delete ~/workspace/project1 ~/workspace/project2 ~/workspace/project3
```

### 使用 npx（无需全局安装）

你可以使用 `npx` 运行 `dedust`，无需全局安装：

```bash
# 预览将被删除的内容（默认行为）
npx dedust

# 实际删除文件
npx dedust --delete

# 指定版本
npx dedust@latest --version
```

## API 参考

### 安全验证函数

#### `validateRules(rules: Rule[]): {valid: boolean, errors: Array<{rule: Rule, error: string}>}`

验证规则数组是否存在危险模式。

```javascript
import { parseRules, validateRules } from "dedust";

const rules = parseRules("delete *");
const validation = validateRules(rules);

if (!validation.valid) {
	console.error("验证失败:");
	validation.errors.forEach((e) => console.error(e.error));
}
```

#### `validateRule(rule: Rule): {valid: boolean, error: string | null}`

验证单个规则。

```javascript
import { validateRule } from "dedust";

const rule = { action: "delete", target: "*", condition: null };
const result = validateRule(rule);

if (!result.valid) {
	console.error(result.error);
}
```

#### `isDangerousPattern(pattern: string): boolean`

检查模式是否被认为是危险的。

```javascript
import { isDangerousPattern } from "dedust";

console.log(isDangerousPattern("*")); // true
console.log(isDangerousPattern("**")); // true
console.log(isDangerousPattern("*.log")); // false
console.log(isDangerousPattern("target")); // false
```

### `parseRules(input: string): Rule[]`

将 DSL 文本解析为规则数组。

```javascript
import { parseRules } from "dedust";

const rules = parseRules("delete target when exists Cargo.toml");
console.log(rules);
```

### `findTargets(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptions): Promise<string[]>`

查找匹配规则的所有目标（干运行 - 不删除任何内容）。

支持单个目录和多个目录。

```javascript
import { findTargets } from "dedust";

// 单个目录
const targets = await findTargets("delete *.log", "/path/to/project");
console.log("将删除:", targets);

// 多个目录
const targets = await findTargets("delete *.log", ["/path/to/project1", "/path/to/project2", "/path/to/project3"]);
console.log("将删除:", targets);

// 使用忽略模式（API 级别）
const targets = await findTargets("delete *", "/path/to/project", {
	ignore: [".git", "node_modules", "*.keep"],
	skipValidation: true, // 危险模式需要
});
console.log("将删除:", targets);

// 使用跳过模式（API 级别）
const targets = await findTargets("delete **/*.js", "/path/to/project", {
	skip: ["node_modules", ".git", "build*"],
});
console.log("将删除:", targets);

// 同时使用忽略和跳过模式
const targets = await findTargets("delete **/*", "/path/to/project", {
	ignore: [".git", "*.keep"],
	skip: ["node_modules", "dist"],
	skipValidation: true, // 危险模式需要
});
console.log("将删除:", targets);
```

**选项：**

-   `ignore?: string[]` - 清理期间要忽略的模式数组。支持像 `*.log`、`.git/**`、`important.*` 这样的 glob 模式。被忽略的路径不能被匹配或删除。
-   `skip?: string[]` - 遍历期间要跳过但允许匹配的模式数组。支持像 `node_modules`、`.git/**`、`build*` 这样的 glob 模式。跳过的目录不会被遍历（提高性能），但仍然可以被显式删除规则匹配。
-   `skipValidation?: boolean` - 跳过安全验证。谨慎使用！允许没有条件的危险模式，如 `delete *`。

### `executeCleanup(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptions): Promise<ExecutionResult>`

执行规则并实际删除匹配的文件/目录。

支持单个目录和多个目录。

```javascript
import { executeCleanup } from "dedust";

// 单个目录
const result = await executeCleanup("delete *.log", "/path/to/project");
console.log("已删除:", result.deleted);
console.log("错误:", result.errors);

// 多个目录
const result = await executeCleanup("delete *.log", ["/path/to/workspace1", "/path/to/workspace2"]);
console.log("已删除:", result.deleted);
console.log("错误:", result.errors);

// 使用忽略模式（API 级别）
const result = await executeCleanup("delete *", "/path/to/project", {
	ignore: [".git", "node_modules/**", "*.keep", "important/**"],
	skipValidation: true, // 危险模式需要
});
console.log("已删除:", result.deleted);

// 使用跳过模式（API 级别）
const result = await executeCleanup("delete **/*.tmp", "/path/to/project", {
	skip: ["node_modules", ".git", "cache*"],
});
console.log("已删除:", result.deleted);

// 同时使用忽略和跳过模式
const result = await executeCleanup("delete **/*", "/path/to/project", {
	ignore: [".git", "*.keep"],
	skip: ["node_modules", "build"],
	skipValidation: true, // 危险模式需要
});
console.log("已删除:", result.deleted);
```

**选项：**

-   `ignore?: string[]` - 清理期间要忽略的模式数组。支持像 `*.log`、`.git/**`、`important.*` 这样的 glob 模式。被忽略的路径不能被匹配或删除。
-   `skip?: string[]` - 遍历期间要跳过但允许匹配的模式数组。支持像 `node_modules`、`.git/**`、`build*` 这样的 glob 模式。跳过的目录不会被遍历（提高性能），但仍然可以被显式删除规则匹配。
-   `skipValidation?: boolean` - 跳过安全验证。谨慎使用！允许没有条件的危险模式，如 `delete *`。

返回：

```typescript
{
  deleted: string[],      // 成功删除的路径
  errors: Array<{         // 遇到的错误
    path: string,
    error: Error
  }>
}
```

### 事件监听器（可选）

所有主要 API 函数（`findTargets` 和 `executeCleanup`）都支持可选的事件监听器，用于清理操作期间的实时反馈。事件监听器直接作为选项提供：

```javascript
import { findTargets, executeCleanup } from "dedust";

// 使用事件监听器查找目标
const targets = await findTargets("delete *.log", "/path/to/project", {
	onFileFound: (data) => {
		console.log("找到:", data.path);
	},
	onScanStart: (data) => {
		console.log(`扫描 ${data.rulesCount} 条规则...`);
	},
	onScanComplete: (data) => {
		console.log(`扫描完成。找到 ${data.filesFound} 个文件。`);
	},
});

// 使用事件监听器执行清理
const result = await executeCleanup("delete *.log", "/path/to/project", {
	onFileFound: (data) => {
		console.log("找到:", data.path);
	},
	onFileDeleted: (data) => {
		console.log("已删除:", data.path, data.isDirectory ? "(目录)" : "(文件)");
	},
	onError: (data) => {
		console.error("错误:", data.error.message, "在", data.path);
	},
});

// 与其他选项结合
const result = await executeCleanup("delete *.log", "/path/to/project", {
	ignore: [".git", "*.keep"],
	skip: ["node_modules"],
	onFileDeleted: (data) => console.log("已删除:", data.path),
});
```

#### 可用的事件监听器

| 事件监听器        | 描述                     | 数据类型             |
| ----------------- | ------------------------ | -------------------- |
| `onFileFound`     | 找到文件时调用           | `FileFoundEvent`     |
| `onFileDeleted`   | 删除文件时调用           | `FileDeletedEvent`   |
| `onError`         | 发生错误时调用           | `ErrorEvent`         |
| `onScanStart`     | 开始扫描时调用           | `ScanStartEvent`     |
| `onScanDirectory` | 扫描每个目录时调用       | `ScanDirectoryEvent` |
| `onScanComplete`  | 扫描完成时调用           | `ScanCompleteEvent`  |

### 多个目录

所有 API 函数都支持在单次调用中扫描多个目录。只需传递目录路径数组而不是单个字符串：

```javascript
import { findTargets, executeCleanup } from "dedust";

const dsl = `
  delete target when exists Cargo.toml
  delete node_modules when exists package.json
`;

// 扫描多个目录
const targets = await findTargets(dsl, ["/home/user/workspace/project1", "/home/user/workspace/project2", "/home/user/workspace/project3"]);

// 跨多个目录执行清理
const result = await executeCleanup(dsl, ["/var/www/app1", "/var/www/app2"]);

console.log(`跨多个目录清理了 ${result.deleted.length} 个文件`);
```

**好处：**

-   跨多个项目的单个 DSL 执行
-   合并结果
-   比单独运行更高效
-   为所有目录发出事件

### 高级用法

对于高级用例，你可以访问低级 API：

```javascript
import { Tokenizer, Parser, Evaluator } from "dedust";

// 标记化 DSL 文本
const tokenizer = new Tokenizer("delete target");
const tokens = tokenizer.tokenize();

// 将标记解析为规则
const parser = new Parser(tokens);
const rules = parser.parse();

// 使用直接事件处理评估规则
const evaluator = new Evaluator(rules, "/path/to/project");

// 附加事件监听器
evaluator.on("file:found", (data) => {
	console.log("找到:", data.path);
});

evaluator.on("file:deleted", (data) => {
	console.log("已删除:", data.path);
});

evaluator.on("error", (data) => {
	console.error("错误:", data.error.message);
});

// 执行
const targets = await evaluator.evaluate();
const result = await evaluator.execute(targets);
```

## 实际示例

### 清理多种项目类型

```javascript
const dsl = `
# 忽略版本控制
ignore .git
ignore .svn
skip node_modules

# Rust 工作区清理
delete target when exists Cargo.toml
delete target when parent exists Cargo.toml

# Node.js 项目
delete node_modules when exists package.json
delete .next when exists next.config.js
delete dist when exists package.json

# Python 项目
delete .venv when exists pyproject.toml
delete __pycache__
delete .pytest_cache

# 构建产物
delete *.log
delete **/*.tmp when parents exists .git
`;

const result = await executeCleanup(dsl, process.cwd());
console.log(`清理了 ${result.deleted.length} 项`);
```

### 选择性清理

```javascript
// 仅清理带有源代码的 Rust 项目
const dsl = "delete target when exists Cargo.toml and exists src";

// 如果存在 keep 标记则不清理
const dsl2 = "delete target when exists Cargo.toml and not exists .keep";
```

### 结合 DSL 和 API 忽略模式

```javascript
// DSL 定义项目级忽略规则
const dsl = `
  ignore .git
  ignore node_modules
  delete *
`;

// API 提供运行时特定的忽略规则
const result = await executeCleanup(dsl, "/path/to/project", {
	ignore: ["important/**", "*.keep"], // 运行时忽略
});

// 两组模式被合并和应用
// 被忽略：.git、node_modules、important/**、*.keep
```

### 结合 DSL 和 API 跳过模式

```javascript
// DSL 定义项目级跳过规则以优化遍历
const dsl = `
  skip node_modules
  skip .git
  delete node_modules when exists package.json
  delete **/*.log
`;

// API 提供运行时特定的跳过规则
const result = await executeCleanup(dsl, "/path/to/project", {
	skip: ["build*", "cache"], // 运行时跳过模式
});

// 两组模式被合并和应用
// 跳过遍历：node_modules、.git、build*、cache
// 但 node_modules 仍然可以被显式删除规则匹配
```

### Skip 与 Ignore 模式

```javascript
// Skip 防止遍历但允许匹配（性能优化）
const dsl = `
  skip node_modules
  delete node_modules when exists package.json
  delete **/*.js  // 不会在 node_modules 内找到文件
`;

// Ignore 防止遍历和匹配（完全排除）
const dsl2 = `
  ignore .git
  delete .git  // 这不会匹配任何内容
  delete **/*  // 不会在 .git 内找到任何内容
`;

// 对于偶尔想清理的大目录使用 skip
// 对于永远不想触及的目录使用 ignore
const result = await executeCleanup(dsl, "/path/to/project", {
	skip: ["node_modules", "build"], // 如果显式针对，可以被匹配
	ignore: [".git", "*.keep"], // 在任何情况下都不会被匹配
});
```

### 使用 Skip 模式进行性能优化

```javascript
// 跳过大目录以提高性能
const dsl = `
  skip node_modules
  skip .git
  skip build

  delete **/*.tmp
  delete **/*.log
`;

// 扫描速度更快，因为跳过的目录不被遍历
const targets = await findTargets(dsl, "/large/workspace");

// 使用 API 跳过模式的等效方法
const targets2 = await findTargets("delete **/*.tmp delete **/*.log", "/large/workspace", {
	skip: ["node_modules", ".git", "build"],
});
```

## TypeScript 支持

包含完整的 TypeScript 定义：

```typescript
import { parseRules, findTargets, ExecutionResult, Rule } from "dedust";

const dsl: string = "delete *.log";
const rules: Rule[] = parseRules(dsl);
const targets: string[] = await findTargets(rules, "/path");
const result: ExecutionResult = await executeCleanup(rules, "/path");
```

## 安全功能

### 内置安全验证

**dedust** 包含自动安全验证以防止意外大规模删除：

1. **危险模式检测** - 自动拒绝可能在没有条件的情况下删除所有文件的模式：

    - `delete *` - 会删除目录中的所有文件
    - `delete **` - 会递归删除所有文件
    - `delete *.*` - 会删除所有带扩展名的文件
    - `delete **/*` - 会删除子目录中的所有文件
    - `delete **/*.*` - 会递归删除所有带扩展名的文件

2. **安全模式** - 这些模式始终允许：

    - 特定模式，如 `delete *.log`、`delete target`、`delete node_modules`
    - 带条件的危险模式：`delete * when exists Cargo.toml`
    - 所有 `ignore` 规则（不受验证约束）

3. **验证绕过** - 对于了解风险的高级用户：

    ```javascript
    // API：使用 skipValidation 选项
    await executeCleanup(dsl, baseDir, { skipValidation: true });

    // CLI：使用 --skip-validation 标志与 --delete
    dedust --delete --skip-validation
    ```

4. **清晰的错误消息** - 当验证失败时，你会得到有用的建议：

    ```
    安全验证失败

    检测到危险模式：'delete *' 没有任何条件。

    建议：
      • 添加条件（例如，'when exists Cargo.toml'）
      • 使用更具体的模式（例如，'*.log' 而不是 '*'）
      • 使用 'ignore' 规则保护重要文件
    ```

### 其他安全功能

1. **默认干运行** - `findTargets()` 让你预览将被删除的内容
2. **无向上遍历** - 规则不能删除基本目录外的内容
3. **显式路径** - 不隐式删除系统目录
4. **错误处理** - 优雅地处理权限错误并继续

### 安全最佳实践

1. **始终对广泛模式使用条件：**

    ```text
    # 好：仅在 Rust 项目中删除
    delete target when exists Cargo.toml

    # 不好：会删除所有地方的所有 'target' 目录
    delete target
    ```

2. **使用忽略规则保护重要文件：**

    ```text
    # 保护版本控制和配置
    ignore .git
    ignore .env
    ignore *.keep

    # 然后使用更广泛的清理规则
    delete *.tmp
    ```

3. **删除前预览：**

    ```bash
    # 预览将被删除的内容（默认行为）
    dedust

    # 如果结果看起来正确，则执行
    dedust --delete
    ```

4. **尽可能使用特定模式：**

    ```text
    # 好：针对你想清理的内容
    delete *.log
    delete **/*.tmp
    delete node_modules when exists package.json

    # 避免：没有条件太宽泛
    delete *
    delete **/*
    ```

## Dedust 规则语言 (DRL) 设计原则

**Dedust 规则语言 (DRL)** 遵循以下核心设计原则：

1. **声明式** - 规则描述清理什么，而不是如何清理
2. **人类可读** - 接近自然语言
3. **上下文感知** - 理解目录关系
4. **默认安全** - 清理需要显式条件
5. **简单清晰** - 没有复杂的嵌套或隐藏行为

**DRL** 旨在：**比 glob 更强大，比 YAML 更简单，比脚本更安全**。

有关详细规范，请参阅 [spec_zh-CN.md](./spec_zh-CN.md)。

## 限制

-   没有 OR 运算符（改用多个规则）
-   没有正则表达式模式（使用 glob 模式）
-   模式中没有相对路径运算符（`../`、`./`）
-   动作仅限于 `delete`（将来可能扩展）

## 贡献

欢迎贡献！请随时提交拉取请求。

## 许可证

SEE LICENSE IN LICENSE

## 致谢

由 [Axetroy](https://github.com/axetroy) 创建
