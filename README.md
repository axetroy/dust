[English](./spec.md) | 中文

# dust

A DSL-based garbage file cleanup tool for managing build artifacts, dependencies, and temporary files across projects.

See DSL design specifications at [spec.md](./spec.md)

## Features

-   🎯 **Simple DSL** - Human-readable, line-based cleanup rules
-   🔍 **Context-aware** - Support for parent, child, sibling, and ancestor directory conditions
-   🌟 **Glob patterns** - Full support for wildcard patterns (`*.log`, `**/*.tmp`, etc.)
-   🚀 **Fast & Safe** - Dry-run mode by default, explicit deletion when needed
-   📦 **Zero config** - Works out of the box with sensible defaults
-   🔧 **TypeScript** - Full TypeScript type definitions included

## Installation

```bash
npm install dust
```

## Quick Start

```javascript
import { parseRules, findTargets, executeCleanup } from "dust";

// Define cleanup rules
const dsl = `
  # Rust projects
  delete target when exists Cargo.toml

  # Node projects
  delete node_modules when exists package.json

  # Python projects
  delete .venv when exists pyproject.toml

  # Log files everywhere
  delete *.log
`;

// Find what would be deleted (dry run)
const targets = await findTargets(dsl, "/path/to/project");
console.log("Would delete:", targets);

// Actually delete the files
const result = await executeCleanup(dsl, "/path/to/project");
console.log("Deleted:", result.deleted);
console.log("Errors:", result.errors);
```

## DSL Syntax

### Basic Rule Structure

```
<Action> <Target> [when <Condition>]
```

### Actions

-   `delete` - Delete matching files or directories

### Targets

Targets support glob patterns:

-   `target` - Simple directory/file name
-   `*.log` - All files with .log extension
-   `**/*.tmp` - All .tmp files recursively
-   `node_modules` - Specific directory name

### Conditions

#### Location Modifiers

-   `here` - Current directory (default, can be omitted)
-   `parent` - Parent directory
-   `parents` - Any ancestor directory
-   `child` - Direct child directory
-   `children` - Any descendant directory
-   `sibling` - Sibling directory

#### Predicates

-   `exists <pattern>` - Check if pattern exists
-   `not exists <pattern>` - Check if pattern doesn't exist

#### Logical Operators

-   `and` - Combine multiple conditions

### Examples

```text
# Delete target directory when Cargo.toml exists in current directory
delete target when exists Cargo.toml

# Delete target in child crates
delete target when parent exists Cargo.toml

# Delete only if both conditions are met
delete target when exists Cargo.toml and exists src

# Delete unless keep file exists
delete target when exists Cargo.toml and not exists keep.txt

# Delete log files in git repositories
delete **/*.log when parents exists .git

# Delete without any condition
delete *.log

# Patterns with whitespace (use quotes)
delete "My Documents" when exists "Desktop.ini"
delete "Program Files" when exists "*.dll"
delete 'build output' when exists Makefile
```

### Patterns with Whitespace

For file or directory names containing spaces, enclose the pattern in quotes:

```javascript
// Use double quotes
const dsl = 'delete "My Documents"';

// Or single quotes
const dsl = "delete 'Program Files'";

// Works in conditions too
const dsl = 'delete cache when exists "package.json"';
```

Supported features:

-   Single quotes (`'...'`) or double quotes (`"..."`)
-   Escape sequences: `\n`, `\t`, `\\`, `\'`, `\"`
-   Both targets and condition patterns can be quoted

## API Reference

### `parseRules(input: string): Rule[]`

Parse DSL text into an array of rules.

```javascript
import { parseRules } from "dust";

const rules = parseRules("delete target when exists Cargo.toml");
console.log(rules);
```

### `findTargets(rulesOrDsl: string | Rule[], baseDir: string): Promise<string[]>`

Find all targets that match the rules (dry run - doesn't delete anything).

```javascript
import { findTargets } from "dust";

const targets = await findTargets("delete *.log", "/path/to/project");
console.log("Would delete:", targets);
```

### `executeCleanup(rulesOrDsl: string | Rule[], baseDir: string): Promise<ExecutionResult>`

Execute the rules and actually delete matching files/directories.

```javascript
import { executeCleanup } from "dust";

const result = await executeCleanup("delete *.log", "/path/to/project");
console.log("Deleted:", result.deleted);
console.log("Errors:", result.errors);
```

Returns:

```typescript
{
  deleted: string[],      // Successfully deleted paths
  errors: Array<{         // Errors encountered
    path: string,
    error: Error
  }>
}
```

### Advanced Usage

For advanced use cases, you can access the lower-level APIs:

```javascript
import { Tokenizer, Parser, Evaluator } from "dust";

// Tokenize DSL text
const tokenizer = new Tokenizer("delete target");
const tokens = tokenizer.tokenize();

// Parse tokens into rules
const parser = new Parser(tokens);
const rules = parser.parse();

// Evaluate rules
const evaluator = new Evaluator(rules, "/path/to/project");
const targets = await evaluator.evaluate();
```

## Real-World Examples

### Clean Multiple Project Types

```javascript
const dsl = `
# Rust workspace cleanup
delete target when exists Cargo.toml
delete target when parent exists Cargo.toml

# Node.js projects
delete node_modules when exists package.json
delete .next when exists next.config.js
delete dist when exists package.json

# Python projects
delete .venv when exists pyproject.toml
delete __pycache__
delete .pytest_cache

# Build artifacts
delete *.log
delete **/*.tmp when parents exists .git
`;

const result = await executeCleanup(dsl, process.cwd());
console.log(`Cleaned up ${result.deleted.length} items`);
```

### Selective Cleanup

```javascript
// Only clean Rust projects with source code
const dsl = "delete target when exists Cargo.toml and exists src";

// Don't clean if keep marker exists
const dsl2 = "delete target when exists Cargo.toml and not exists .keep";
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { parseRules, findTargets, ExecutionResult, Rule } from "dust";

const dsl: string = "delete *.log";
const rules: Rule[] = parseRules(dsl);
const targets: string[] = await findTargets(rules, "/path");
const result: ExecutionResult = await executeCleanup(rules, "/path");
```

## Safety Features

1. **Dry run by default** - `findTargets()` lets you preview what will be deleted
2. **No upward traversal** - Rules cannot delete outside the base directory
3. **Explicit paths** - No implicit deletion of system directories
4. **Error handling** - Gracefully handles permission errors and continues

## DSL Design Principles

1. **Declarative** - Rules describe what to clean, not how
2. **Human-readable** - Close to natural language
3. **Context-aware** - Understands directory relationships
4. **Safe by default** - Requires explicit conditions for cleanup
5. **Simple & Clear** - No complex nesting or hidden behavior

## Limitations

-   No OR operator (use multiple rules instead)
-   No regex patterns (use glob patterns)
-   No relative path operators (`../`, `./`) in patterns
-   Actions are limited to `delete` (may be expanded in future)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

SEE LICENSE IN LICENSE

## Credits

Created by [Axetroy](https://github.com/axetroy)
