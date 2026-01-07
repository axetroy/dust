English | [中文](./spec_zh-CN.md)

# Dedust Rule Language (DRL) Design Specification

> This document defines **Dedust Rule Language (DRL)**, a **human-oriented, readable, writable, line-based cleanup rule DSL** for describing "under what context conditions, which files or directories should be cleaned".
>
> **DRL** stands for **Dedust Rule Language**. The default configuration file name is **`dedust.rules`**.
>
> The DSL goal: **More powerful than glob, simpler than YAML, safer than scripts**.

---

## 1. Design Goals

- One rule per line, close to natural language
- No JSON / YAML / XML / regular expressions
- Context-aware support (parent / child / sibling / ancestor / descendant)
- Wildcard (glob) support
- Easy to parse (suitable for tokenizer + state machine / CST)
- Clear rule semantics, extensible

---

## 2. Basic Concepts

### 2.1 Rule

A rule describes:

> **When a certain context condition is met, perform an action on certain targets**

Abstract form:

```
<Action> <Target> [when <Condition>]
```

---

### 2.2 Action

The current version defines three core actions:

| Action   | Meaning                                                                     |
| -------- | --------------------------------------------------------------------------- |
| `delete` | Delete matching files or directories                                        |
| `ignore` | Ignore matching files or directories (prevents both traversal and matching) |
| `skip`   | Skip directory traversal but allow matching (performance optimization)      |

The `ignore` action is used to exclude certain files or directories from being processed by delete rules. Ignored directories are not traversed, and ignored paths cannot be matched by any delete rules.

The `skip` action is similar to `ignore` but with a key difference: skipped directories are not traversed (improving performance), but they can still be explicitly matched by delete rules. This is useful for large directories that you want to skip for performance but still allow conditional deletion.

**Comparison:**

- `ignore .git` - Never traverse or match `.git` directory
- `skip node_modules` - Never traverse into `node_modules`, but `delete node_modules when exists package.json` will still match the directory itself

---

### 2.3 Target

Target describes **the files or directories to be processed**, supporting glob:

```
target
*.log
**/*.tmp
node_modules
```

For patterns containing whitespace, use quotes:

```
"My Documents"
"Program Files"
'file with spaces.txt'
```

Rules:

- target is always a **relative path**
- The relative base is determined by the rule's context
- Patterns with whitespace must be enclosed in quotes (single or double)
- Within quoted strings, escape sequences are supported: `\n`, `\t`, `\\`, `\'`, `\"`

---

### 2.4 Skip Rules

Skip rules are used to exclude directories from traversal while still allowing them to be matched by delete rules:

```
skip node_modules
skip .git
skip build
```

**Features:**

- Supports all glob patterns (e.g., `node_modules`, `.cache/**`, `build*`)
- Skipped directories are not recursively traversed (performance optimization)
- Skipped directories themselves can still be matched by delete rules
- Contents of skipped directories cannot be matched by glob patterns like `**/*.js`
- Skip rules do not support conditions (when), keeping the syntax simpler

**Examples:**

```text
# Skip node_modules traversal for performance
skip node_modules

# But still allow explicit deletion of node_modules
delete node_modules when exists package.json

# This won't match files inside node_modules (not traversed)
delete **/*.js

# Skip multiple directories
skip node_modules
skip .git
skip build
```

---

### 2.5 Ignore Rules

Ignore rules are used to exclude certain files or directories from deletion:

```
ignore .git
ignore node_modules
ignore *.keep
```

**Features:**

- Supports all glob patterns (e.g., `*.log`, `.git/**`, `important.*`)
- Ignored directories are not recursively traversed (performance optimization)
- Can be combined with API-level ignore options
- Ignore rules do not support conditions (when), keeping the syntax simpler

**Examples:**

```text
# Ignore version control directories
ignore .git
ignore .svn

# Ignore dependency directories
ignore node_modules/**

# Ignore important files
ignore *.keep
ignore important/**

# Then define deletion rules
delete target when exists Cargo.toml
delete *.log
```

---

## 3. Condition System

Conditions are used to describe **when rules take effect**.

### 3.1 Basic Form

```
when <Predicate>
```

The core predicate is `exists`.

---

### 3.2 exists Predicate

```
exists <pattern>
```

Meaning:

> At a specified location, a matching file or directory exists

Default location: `here` (current directory)

---

## 4. Location Modifiers

Location modifiers are used to describe **the spatial relationship of exists**.

### 4.1 Syntax

```
<location> exists <pattern>
```

---

### 4.2 Supported Modifiers

| Modifier   | Meaning                            |
| ---------- | ---------------------------------- |
| `here`     | Current directory (default, can be omitted) |
| `parent`   | Parent directory                   |
| `parents`  | Any ancestor directory             |
| `child`    | Direct child directory             |
| `children` | Any descendant directory           |
| `sibling`  | Sibling directory                  |

---

### 4.3 Examples

```text
delete target when exists Cargo.toml
delete target when parent exists Cargo.toml
delete dist when children exists package.json
delete *.log when parents exists .git
```

### 4.4 Patterns with Whitespace

For file or directory names containing spaces, use quotes:

```text
delete "My Documents" when exists "package.json"
delete "Program Files" when exists "config.txt"
delete 'build output' when exists Makefile
```

Quotes support:
- Single quotes (`'...'`) or double quotes (`"..."`)
- Escape sequences: `\n` (newline), `\t` (tab), `\\` (backslash), `\'`, `\"`
- Both targets and patterns in conditions can be quoted

---

## 5. Logical Combination

### 5.1 AND

```
when <cond1> and <cond2>
```

Example:

```text
delete target when exists Cargo.toml and exists src
```

---

### 5.2 NOT

```
not <predicate>
```

Example:

```text
delete target when exists Cargo.toml and not exists keep.txt
```

> The current version does not support `or` to keep semantics and implementation simple.

---

## 6. Execution Model (Semantic Explanation)

The DSL's implicit execution model is:

```
for each directory D (recursive):
  if condition holds at D:
    apply action to targets relative to D
```

Explanation:

- Rules execute with **directory as anchor**
- After condition is satisfied, targets are derived from that directory

---

## 7. Complete Syntax (EBNF)

```
Rule        ::= Action Target [ "when" Condition ]
Action      ::= "delete" | "ignore" | "skip"
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

**Note**: `quoted-string` is a string enclosed in single (`'...'`) or double (`"..."`) quotes, supporting escape sequences.

---

## 8. Example Rule File

```text
# Skip large directories for performance
skip node_modules
skip .git

# Ignore version control subdirectories completely
ignore .svn

# Rust
delete target when exists Cargo.toml

# Rust workspace sub-crate
delete target when parent exists Cargo.toml

# Node
delete node_modules when exists package.json

# Python
delete .venv when exists pyproject.toml

# Logs
delete *.log
delete **/*.tmp when parents exists .git

# Patterns with whitespace
delete "My Documents" when exists "Desktop.ini"
delete "Program Files" when exists "*.dll"
delete 'build output' when exists Makefile
```

---

## 9. Configuration File

### 9.1 Default Configuration File

The default configuration file name for DRL is **`dedust.rules`**.

This file can be placed in:
- The root of your project
- Any directory where you want to define cleanup rules
- Loaded programmatically via the API

### 9.2 File Format

The configuration file uses plain text with the `.rules` extension and contains DRL rules following the syntax defined in this specification:

```text
# This is a dedust.rules configuration file

# Rust projects
delete target when exists Cargo.toml

# Node.js projects
delete node_modules when exists package.json
delete dist when exists package.json

# Python projects
delete .venv when exists pyproject.toml
delete __pycache__

# Clean log files in git repositories
delete **/*.log when parents exists .git
```

---

## 10. Design Constraints (Very Important)

The following syntax is **explicitly forbidden**:

❌ Using `../` or `./`

```text
delete ../target
```

❌ Expressing logical relationships in paths

```text
delete **/Cargo.toml/../target
```

❌ Nested conditions

```text
when exists A when exists B
```

❌ Using regular expressions

---

## 11. Design Principles Summary

1. Rules are **declarative**, not imperative
2. Spatial relationships are expressed with **language**, not path tricks
3. Conditions and targets are strictly separated
4. Prefer defaults to reduce noise
5. Better to be minimal and clear than "can express everything"

---

## 12. Extension Directions (Non-normative)

- `dry-run` / `explain`
- `ignore` / `protect`
- Rule priority
- Rule grouping (profile)

---

**This DSL is suitable for: engineering garbage cleanup, build artifact recovery, unified cleanup strategies for multi-language projects.**
