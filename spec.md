English | [中文](./spec_CN.md)

# Garbage File Cleanup DSL Design Specification

> This document defines a **human-oriented, readable, writable, line-based cleanup rule DSL** for describing "under what context conditions, which files or directories should be cleaned".
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

The current version defines only one core action:

| Action   | Meaning                              |
| -------- | ------------------------------------ |
| `delete` | Delete matching files or directories |

(Future extensions: `ignore` / `warn` / `dry-run`, etc.)

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

**Note**: `quoted-string` is a string enclosed in single (`'...'`) or double (`"..."`) quotes, supporting escape sequences.

---

## 8. Example Rule File

```text
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

## 9. Design Constraints (Very Important)

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

## 10. Design Principles Summary

1. Rules are **declarative**, not imperative
2. Spatial relationships are expressed with **language**, not path tricks
3. Conditions and targets are strictly separated
4. Prefer defaults to reduce noise
5. Better to be minimal and clear than "can express everything"

---

## 11. Extension Directions (Non-normative)

- `dry-run` / `explain`
- `ignore` / `protect`
- Rule priority
- Rule grouping (profile)

---

**This DSL is suitable for: engineering garbage cleanup, build artifact recovery, unified cleanup strategies for multi-language projects.**
