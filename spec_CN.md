# Dedust 规则语言 (DRL) 设计规范

> 本文定义了 **Dedust 规则语言（Dedust Rule Language，简称 DRL）**，一种 **面向人类、可读可写、行式的清理规则 DSL**，用于描述"在什么上下文条件下，应清理哪些文件或目录"。
>
> **DRL** 是 **Dedust Rule Language** 的缩写。默认配置文件名为 **`dedust.rules`**。
>
> 该 DSL 目标是：**比 glob 强、比 YAML 简单、比脚本安全**。

---

## 1. 设计目标

- 一行一条规则，接近自然语言
- 不使用 JSON / YAML / XML / 正则表达式
- 支持上下文感知（父级 / 子级 / 同级 / 祖先 / 后代）
- 支持通配符（glob）
- 易于解析（适合 tokenizer + 状态机 / CST）
- 规则语义清晰、可扩展

---

## 2. 基本概念

### 2.1 规则（Rule）

一条规则描述：

> **在某个上下文条件成立时，对某些目标执行一个动作**

抽象形式为：

```
<Action> <Target> [when <Condition>]
```

---

### 2.2 执行动作（Action）

当前版本仅定义一个核心动作：

| 动作     | 含义                 |
| -------- | -------------------- |
| `delete` | 删除匹配的文件或目录 |

（未来可扩展：`ignore` / `warn` / `dry-run` 等）

---

### 2.3 目标（Target）

目标描述 **要被处理的文件或目录**，支持 glob：

```
target
*.log
**/*.tmp
node_modules
```

对于包含空格的模式，使用引号：

```
"My Documents"
"Program Files"
'file with spaces.txt'
```

规则：

- target 永远是 **相对路径**
- 相对基准由规则的上下文决定
- 包含空格的模式必须用引号（单引号或双引号）括起来
- 在引号字符串中，支持转义序列：`\n`、`\t`、`\\`、`\'`、`\"`

---

## 3. 条件系统（Condition）

条件用于描述 **规则何时生效**。

### 3.1 基本形式

```
when <Predicate>
```

其中最核心的谓词是 `exists`。

---

### 3.2 exists 谓词

```
exists <pattern>
```

含义：

> 在指定位置，存在匹配的文件或目录

默认位置：`here`（当前目录）

---

## 4. 位置修饰词（Location Modifiers）

位置修饰词用于描述 **exists 的空间关系**。

### 4.1 语法

```
<location> exists <pattern>
```

---

### 4.2 支持的修饰词

| 修饰词     | 含义                     |
| ---------- | ------------------------ |
| `here`     | 当前目录（默认，可省略） |
| `parent`   | 父目录                   |
| `parents`  | 任意祖先目录             |
| `child`    | 直接子目录               |
| `children` | 任意后代目录             |
| `sibling`  | 同级目录                 |

---

### 4.3 示例

```text
delete target when exists Cargo.toml
delete target when parent exists Cargo.toml
delete dist when children exists package.json
delete *.log when parents exists .git
```

### 4.4 包含空格的模式

对于包含空格的文件或目录名，使用引号：

```text
delete "My Documents" when exists "package.json"
delete "Program Files" when exists "config.txt"
delete 'build output' when exists Makefile
```

引号支持：
- 单引号（`'...'`）或双引号（`"..."`）
- 转义序列：`\n`（换行）、`\t`（制表符）、`\\`（反斜杠）、`\'`、`\"`
- 目标和条件中的模式都可以使用引号

---

## 5. 逻辑组合

### 5.1 AND

```
when <cond1> and <cond2>
```

示例：

```text
delete target when exists Cargo.toml and exists src
```

---

### 5.2 NOT

```
not <predicate>
```

示例：

```text
delete target when exists Cargo.toml and not exists keep.txt
```

> 当前版本不支持 `or`，以保持语义和实现简单。

---

## 6. 作用模型（语义说明）

DSL 的隐式执行模型为：

```
for each directory D (recursive):
  if condition holds at D:
    apply action to targets relative to D
```

说明：

- 规则以 **目录为锚点（Anchor）** 执行
- 条件成立后，目标从该目录派生

---

## 7. 完整语法（EBNF）

```
Rule        ::= Action Target [ "when" Condition ]
Action      ::= "delete"
Target      ::= PathPattern
Condition   ::= Predicate ( "and" Predicate )*
Predicate   ::= [ Location ] "exists" PathPattern
              | "not" Predicate
Location    ::= "here"
              | "parent"
              | "parents"
              | "child"
              | "children"
              | "sibling"
PathPattern ::= glob-pattern | quoted-string
```

**注意**：`quoted-string` 是用单引号（`'...'`）或双引号（`"..."`）括起来的字符串，支持转义序列。

---

## 8. 示例规则文件

```text
# Rust
delete target when exists Cargo.toml

# Rust workspace 子 crate
delete target when parent exists Cargo.toml

# Node
delete node_modules when exists package.json

# Python
delete .venv when exists pyproject.toml

# Logs
delete *.log
delete **/*.tmp when parents exists .git

# 包含空格的模式
delete "My Documents" when exists "Desktop.ini"
delete "Program Files" when exists "*.dll"
delete 'build output' when exists Makefile
```

---

## 9. 配置文件

### 9.1 默认配置文件

DRL 的默认配置文件名为 **`dedust.rules`**。

该文件可以放置在：
- 项目的根目录
- 任何需要定义清理规则的目录
- 通过 API 以编程方式加载

### 9.2 文件格式

配置文件使用纯文本格式，扩展名为 `.rules`，包含遵循本规范定义的语法的 DRL 规则：

```text
# 这是一个 dedust.rules 配置文件

# Rust 项目
delete target when exists Cargo.toml

# Node.js 项目
delete node_modules when exists package.json
delete dist when exists package.json

# Python 项目
delete .venv when exists pyproject.toml
delete __pycache__

# 清理 git 仓库中的日志文件
delete **/*.log when parents exists .git
```

### 9.3 使用方法

`dedust.rules` 中的规则可以使用 dedust API 加载和执行：

```javascript
import { readFileSync } from 'fs';
import { executeCleanup } from 'dedust';

// 从 dedust.rules 文件加载规则
const rules = readFileSync('./dedust.rules', 'utf-8');

// 执行清理
const result = await executeCleanup(rules, process.cwd());
```

---

## 10. 设计约束（非常重要）

以下写法 **明确禁止**：

❌ 使用 `../` 或 `./`

```text
delete ../target
```

❌ 在路径中表达逻辑关系

```text
delete **/Cargo.toml/../target
```

❌ 条件嵌套

```text
when exists A when exists B
```

❌ 使用正则表达式

---

## 11. 设计原则总结

1. 规则是 **声明式** 的，而不是命令式
2. 空间关系用 **语言** 表达，而不是路径技巧
3. 条件与目标严格分离
4. 默认值优先，减少噪音
5. 宁可少而清晰，不追求“什么都能写”

---

## 12. 扩展方向（非规范内容）

- `dry-run` / `explain`
- `ignore` / `protect`
- 规则优先级
- 规则分组（profile）

---

**本 DSL 适用于：工程垃圾清理、构建产物回收、多语言项目统一清理策略。**
