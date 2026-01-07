# dedust

English | [中文](./README_zh-CN.md)

[![Badge](https://img.shields.io/badge/link-996.icu-%23FF4D5B.svg?style=flat-square)](https://996.icu/#/en_US)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=14-blue.svg?style=flat-square)
[![npm version](https://badge.fury.io/js/dedust.svg)](https://badge.fury.io/js/dedust)

An elegant file cleanup tool using a simple, human-readable DSL `DRL`.

**Dedust Rule Language (DRL)** - A human-readable DSL for defining cleanup rules. The default configuration file is `dedust.rules`.

See DSL design specifications at [spec.md](./spec.md)

## Features

-   🎯 **Simple DSL** - Human-readable, line-based cleanup rules
-   🔍 **Context-aware** - Support for parent, child, sibling, and ancestor directory conditions
-   🌟 **Glob patterns** - Full support for wildcard patterns (`*.log`, `**/*.tmp`, etc.)
-   🚀 **Fast & Safe** - Dry-run mode by default, explicit deletion when needed
-   📦 **Zero config** - Works out of the box with sensible defaults
-   🔧 **TypeScript** - Full TypeScript type definitions included
-   📦 **Dual module support** - Works with both ESM and CommonJS

## Installation

### As a Library (for programmatic use)

Install `dedust` as a dependency in your project:

```bash
npm install dedust
```

This allows you to import and use `dedust` in your JavaScript/TypeScript code:

```javascript
import { cleanup, parseRules } from "dedust";
// Or use the old API: import { findTargets, executeCleanup } from "dedust";
```

### As a Global CLI Tool

Install `dedust` globally to use it as a command-line tool:

```bash
npm install -g dedust
```

After global installation, you can run `dedust` from anywhere:

```bash
# Preview what would be deleted (default behavior)
dedust

# Actually delete files
dedust --delete

# Preview specific directories
dedust /path/to/project1 /path/to/project2

# Delete with custom config file
dedust --delete --config my-rules.txt
```

**When to use global vs local installation:**

-   **Global installation (`-g`)**: Best for using `dedust` as a command-line tool across multiple projects. The `dedust` command becomes available system-wide.
-   **Local installation**: Best for integrating `dedust` into your project's code or build scripts. The package is only available within that project.

You can also use `npx` to run `dedust` without installing it globally:

```bash
npx dedust
```

## Quick Start

### Using the unified cleanup API (recommended)

```javascript
import { cleanup, parseRules } from "dedust";

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

// Find what would be deleted (dry run) - single directory
const targets = await cleanup(dsl, "/path/to/project");
console.log("Would delete:", targets);

// Or scan multiple directories at once
const targets = await cleanup(dsl, ["/path/to/project1", "/path/to/project2"]);

// Actually delete the files - single directory
const result = await cleanup(dsl, "/path/to/project", { execute: true });
console.log("Deleted:", result.deleted);
console.log("Errors:", result.errors);
```

### Using the legacy API (still supported)

```javascript
import { parseRules, findTargets, executeCleanup } from "dedust";

const dsl = `delete *.log`;

// Find what would be deleted (dry run)
const targets = await findTargets(dsl, "/path/to/project");
console.log("Would delete:", targets);

// Actually delete the files
const result = await executeCleanup(dsl, "/path/to/project");
console.log("Deleted:", result.deleted);
```

## DSL Syntax

### Basic Rule Structure

```
<Action> <Target> [when <Condition>]
```

### Actions

-   `delete` - Delete matching files or directories
-   `ignore` - Ignore matching files or directories (exclude from deletion and matching)
-   `skip` - Skip directory traversal but allow matching (performance optimization)

### Targets

Targets support glob patterns:

-   `target` - Simple directory/file name
-   `*.log` - All files with .log extension
-   `**/*.tmp` - All .tmp files recursively
-   `node_modules` - Specific directory name

### Skip vs Ignore Patterns

**Skip Patterns** - Exclude from traversal but allow matching:

```text
# Skip node_modules traversal (improves performance)
skip node_modules

# But still allow explicit deletion
delete node_modules when exists package.json

# Files inside node_modules won't be found by glob patterns
delete **/*.js  # Won't match node_modules/**/*.js
```

**Key features:**

-   Skip rules prevent directory traversal (performance optimization)
-   Skipped directories can still be matched by explicit delete rules
-   Supports all glob patterns (e.g., `node_modules`, `.cache/**`, `build*`)

**Ignore Patterns** - Exclude from both traversal and matching:

```text
# Ignore version control directories completely
ignore .git
ignore .svn

# Ignore with glob patterns
ignore node_modules/**
ignore *.keep

# Then define your cleanup rules
delete target when exists Cargo.toml
delete *.log
```

**Key features:**

-   Ignore rules prevent directory traversal (performance optimization)
-   Ignored paths cannot be matched by any delete rules
-   Supports all glob patterns (e.g., `*.log`, `.git/**`, `important.*`)
-   Can be combined with API-level ignore options
-   Ignored directories and their contents are skipped entirely

**When to use which:**

-   Use `skip` when you want to avoid traversing large directories but still allow explicit deletion (e.g., `skip node_modules` + `delete node_modules when exists package.json`)
-   Use `ignore` when you never want to delete something under any circumstances (e.g., `ignore .git`)

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
# Ignore version control and dependencies
ignore .git
ignore node_modules
ignore .svn

# Delete target directory when Cargo.toml exists in current directory
delete target when exists Cargo.toml

# Delete target in child crates
delete target when parent exists Cargo.toml

# Delete only if both conditions are met
delete target when exists Cargo.toml and exists src

# Delete unless keep file exists
delete target when exists Cargo.toml and not exists keep.txt

# Delete log files in git repositories (but not .git itself)
ignore .git
delete **/*.log when parents exists .git

# Delete without any condition
delete *.log

# Skip large directories for performance
skip node_modules
skip .git
delete node_modules when exists package.json
delete **/*.log  # Won't traverse into node_modules

# Ignore important files completely
ignore *.keep
ignore important/**
delete *.tmp

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

## Configuration Files

### Using `dedust.rules`

Create a `dedust.rules` file in your project root to define reusable cleanup rules.

See [dedust.rules](./dedust.rules) for a complete example configuration file.

Example configuration:

```text
# dedust.rules - Cleanup configuration for this project

# Skip large directories for performance
skip node_modules
skip .git

# Rust projects
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

# Build artifacts and logs
delete *.log
delete **/*.tmp when parents exists .git
```

Then load and execute the rules:

```javascript
import { readFileSync } from "fs";
import { executeCleanup, findTargets } from "dedust";

// Load rules from dedust.rules
const rules = readFileSync("./dedust.rules", "utf-8");

// Preview what would be deleted
const targets = await findTargets(rules, "/path/to/project");
console.log("Would delete:", targets);

// Execute cleanup
const result = await executeCleanup(rules, "/path/to/project");
console.log("Deleted:", result.deleted.length, "items");
```

**Benefits of using `dedust.rules`:**

-   Centralized cleanup configuration
-   Version controlled rules
-   Easy to share across team members
-   Reusable across multiple projects
-   Self-documenting cleanup strategy

## CLI Usage

If you've installed `dedust` globally (with `npm install -g dedust`), you can use it from the command line.

### Basic Commands

```bash
# Show help
dedust --help

# Show version
dedust --version

# Preview what would be deleted (default behavior)
dedust

# Actually delete files
dedust --delete

# Preview specific directories
dedust /path/to/project

# Delete in multiple directories
dedust --delete /path/to/project1 /path/to/project2 /path/to/project3

# Use a custom config file
dedust --config my-cleanup.rules

# Delete with custom config
dedust --delete --config my-cleanup.rules

# Skip safety validation (use with caution!)
dedust --delete --skip-validation
```

### CLI Options

| Option              | Alias | Description                                                          |
| ------------------- | ----- | -------------------------------------------------------------------- |
| `--help`            | `-h`  | Show help message                                                    |
| `--version`         | `-v`  | Show version number                                                  |
| `--dry-run`         | `-d`  | Preview mode (default - this flag is optional)                       |
| `--delete`          | `-D`  | Actually delete files (requires explicit confirmation)               |
| `--config <file>`   | `-c`  | Specify config file (default: `dedust.rules`)                        |
| `--skip-validation` |       | Skip safety validation (use with caution)                            |

### Example Workflows

```bash
# First, create a dedust.rules file in your project
cat > dedust.rules << 'EOF'
# Skip version control
skip .git

# Rust projects
delete target when exists Cargo.toml

# Node.js projects
delete node_modules when exists package.json
delete dist when exists package.json

# Log files
delete **/*.log
EOF

# Preview what would be deleted (default behavior)
dedust

# If the preview looks good, execute the cleanup
dedust --delete

# Preview with a different config file
dedust --config production.rules

# Delete with a different config file
dedust --delete --config production.rules

# Preview multiple workspaces at once
dedust ~/workspace/project1 ~/workspace/project2 ~/workspace/project3

# Delete in multiple workspaces
dedust --delete ~/workspace/project1 ~/workspace/project2 ~/workspace/project3
```

### Using with npx (no global installation needed)

You can use `npx` to run `dedust` without installing it globally:

```bash
# Preview what would be deleted (default behavior)
npx dedust

# Actually delete files
npx dedust --delete

# Specify a version
npx dedust@latest --version
```

## API Reference

### Core API

**dedust** exposes a simplified API with just 2 main functions:

1. **`cleanup`** - **NEW** Unified function for both dry run and execution
2. **`parseRules`** - Parse DSL text into rules

For backward compatibility, the old API is still available:
- **`findTargets`** - Find targets to delete (dry run)
- **`executeCleanup`** - Execute cleanup and delete files

### `cleanup(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptions): Promise<string[] | ExecutionResult>`

**NEW** Unified cleanup function that can perform both dry run (default) and actual deletion.

```javascript
import { cleanup } from "dedust";

const dsl = `
  delete target when exists Cargo.toml
  delete node_modules when exists package.json
`;

// Dry run (default) - returns array of file paths
const targets = await cleanup(dsl, "/path/to/project");
console.log("Would delete:", targets);

// Execute - returns { deleted, errors }
const result = await cleanup(dsl, "/path/to/project", { execute: true });
console.log("Deleted:", result.deleted);
console.log("Errors:", result.errors);

// Multiple directories
const targets = await cleanup(dsl, ["/path/to/project1", "/path/to/project2"]);

// With options
const result = await cleanup(dsl, "/path/to/project", {
	execute: true,
	ignore: [".git", "*.keep"],
	skip: ["node_modules"],
	onFileDeleted: (data) => console.log("Deleted:", data.path),
});
```

**Options:**

-   `execute?: boolean` - Whether to actually delete files (true) or just list them (false, default)
-   `ignore?: string[]` - Array of patterns to ignore during cleanup
-   `skip?: string[]` - Array of patterns to skip during traversal but allow matching
-   `skipValidation?: boolean` - Skip safety validation
-   Event listeners: `onFileFound`, `onFileDeleted`, `onError`, `onScanStart`, `onScanDirectory`, `onScanComplete`

### `parseRules(input: string): Rule[]`

Parse DSL text into an array of rules.

```javascript
import { parseRules } from "dedust";

const rules = parseRules("delete target when exists Cargo.toml");
console.log(rules);
```

### `findTargets(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptions): Promise<string[]>`

**Legacy API** - Still supported for backward compatibility. Consider using `cleanup()` for new code.

Find all targets that match the rules (dry run - doesn't delete anything).

Supports both single directory and multiple directories.

```javascript
import { findTargets } from "dedust";

// Single directory
const targets = await findTargets("delete *.log", "/path/to/project");
console.log("Would delete:", targets);

// Multiple directories
const targets = await findTargets("delete *.log", ["/path/to/project1", "/path/to/project2", "/path/to/project3"]);
console.log("Would delete:", targets);

// With ignore patterns (API-level)
const targets = await findTargets("delete *", "/path/to/project", {
	ignore: [".git", "node_modules", "*.keep"],
	skipValidation: true, // Required for dangerous patterns
});
console.log("Would delete:", targets);

// With skip patterns (API-level)
const targets = await findTargets("delete **/*.js", "/path/to/project", {
	skip: ["node_modules", ".git", "build*"],
});
console.log("Would delete:", targets);

// With both ignore and skip patterns
const targets = await findTargets("delete **/*", "/path/to/project", {
	ignore: [".git", "*.keep"],
	skip: ["node_modules", "dist"],
	skipValidation: true, // Required for dangerous patterns
});
console.log("Would delete:", targets);
```

**Options:**

-   `ignore?: string[]` - Array of patterns to ignore during cleanup. Supports glob patterns like `*.log`, `.git/**`, `important.*`. Ignored paths cannot be matched or deleted.
-   `skip?: string[]` - Array of patterns to skip during traversal but allow matching. Supports glob patterns like `node_modules`, `.git/**`, `build*`. Skipped directories won't be traversed (improves performance) but can still be matched by explicit delete rules.
-   `skipValidation?: boolean` - Skip safety validation. Use with caution! Allows dangerous patterns like `delete *` without conditions.

### `executeCleanup(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptions): Promise<ExecutionResult>`

**Legacy API** - Still supported for backward compatibility. Consider using `cleanup(..., { execute: true })` for new code.

Execute the rules and actually delete matching files/directories.

Supports both single directory and multiple directories.

```javascript
import { executeCleanup } from "dedust";

// Single directory
const result = await executeCleanup("delete *.log", "/path/to/project");
console.log("Deleted:", result.deleted);
console.log("Errors:", result.errors);

// Multiple directories
const result = await executeCleanup("delete *.log", ["/path/to/workspace1", "/path/to/workspace2"]);
console.log("Deleted:", result.deleted);
console.log("Errors:", result.errors);

// With ignore patterns (API-level)
const result = await executeCleanup("delete *", "/path/to/project", {
	ignore: [".git", "node_modules/**", "*.keep", "important/**"],
	skipValidation: true, // Required for dangerous patterns
});
console.log("Deleted:", result.deleted);

// With skip patterns (API-level)
const result = await executeCleanup("delete **/*.tmp", "/path/to/project", {
	skip: ["node_modules", ".git", "cache*"],
});
console.log("Deleted:", result.deleted);

// With both ignore and skip patterns
const result = await executeCleanup("delete **/*", "/path/to/project", {
	ignore: [".git", "*.keep"],
	skip: ["node_modules", "build"],
	skipValidation: true, // Required for dangerous patterns
});
console.log("Deleted:", result.deleted);
```

**Options:**

-   `ignore?: string[]` - Array of patterns to ignore during cleanup. Supports glob patterns like `*.log`, `.git/**`, `important.*`. Ignored paths cannot be matched or deleted.
-   `skip?: string[]` - Array of patterns to skip during traversal but allow matching. Supports glob patterns like `node_modules`, `.git/**`, `build*`. Skipped directories won't be traversed (improves performance) but can still be matched by explicit delete rules.
-   `skipValidation?: boolean` - Skip safety validation. Use with caution! Allows dangerous patterns like `delete *` without conditions.

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

### Event Listeners (Optional)

All main API functions (`findTargets` and `executeCleanup`) support optional event listeners for real-time feedback during cleanup operations. Event listeners are provided directly as options:

```javascript
import { findTargets, executeCleanup } from "dedust";

// Find targets with event listeners
const targets = await findTargets("delete *.log", "/path/to/project", {
	onFileFound: (data) => {
		console.log("Found:", data.path);
	},
	onScanStart: (data) => {
		console.log(`Scanning ${data.rulesCount} rules...`);
	},
	onScanComplete: (data) => {
		console.log(`Scan complete. Found ${data.filesFound} files.`);
	},
});

// Execute cleanup with event listeners
const result = await executeCleanup("delete *.log", "/path/to/project", {
	onFileFound: (data) => {
		console.log("Found:", data.path);
	},
	onFileDeleted: (data) => {
		console.log("Deleted:", data.path, data.isDirectory ? "(directory)" : "(file)");
	},
	onError: (data) => {
		console.error("Error:", data.error.message, "at", data.path);
	},
});

// Combine with other options
const result = await executeCleanup("delete *.log", "/path/to/project", {
	ignore: [".git", "*.keep"],
	skip: ["node_modules"],
	onFileDeleted: (data) => console.log("Deleted:", data.path),
});
```

#### Available Event Listeners

| Event Listener    | Description                         | Data Type            |
| ----------------- | ----------------------------------- | -------------------- |
| `onFileFound`     | Called when a file is found         | `FileFoundEvent`     |
| `onFileDeleted`   | Called when a file is deleted       | `FileDeletedEvent`   |
| `onError`         | Called when an error occurs         | `ErrorEvent`         |
| `onScanStart`     | Called when scanning starts         | `ScanStartEvent`     |
| `onScanDirectory` | Called when scanning each directory | `ScanDirectoryEvent` |
| `onScanComplete`  | Called when scanning completes      | `ScanCompleteEvent`  |

### Multiple Directories

All API functions support scanning multiple directories in a single call. Simply pass an array of directory paths instead of a single string:

```javascript
import { findTargets, executeCleanup } from "dedust";

const dsl = `
  delete target when exists Cargo.toml
  delete node_modules when exists package.json
`;

// Scan multiple directories
const targets = await findTargets(dsl, ["/home/user/workspace/project1", "/home/user/workspace/project2", "/home/user/workspace/project3"]);

// Execute cleanup across multiple directories
const result = await executeCleanup(dsl, ["/var/www/app1", "/var/www/app2"]);

console.log(`Cleaned ${result.deleted.length} files across multiple directories`);
```

**Benefits:**

-   Single DSL execution across multiple projects
-   Consolidated results
-   More efficient than running separately
-   Events are emitted for all directories

## Real-World Examples

### Clean Multiple Project Types

```javascript
const dsl = `
# Ignore version control
ignore .git
ignore .svn
skip node_modules

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

### Combining DSL and API Ignore Patterns

```javascript
// DSL defines project-level ignore rules
const dsl = `
  ignore .git
  ignore node_modules
  delete *
`;

// API provides runtime-specific ignore rules
const result = await executeCleanup(dsl, "/path/to/project", {
	ignore: ["important/**", "*.keep"], // Runtime ignores
});

// Both sets of patterns are merged and applied
// Ignored: .git, node_modules, important/**, *.keep
```

### Combining DSL and API Skip Patterns

```javascript
// DSL defines project-level skip rules for traversal optimization
const dsl = `
  skip node_modules
  skip .git
  delete node_modules when exists package.json
  delete **/*.log
`;

// API provides runtime-specific skip rules
const result = await executeCleanup(dsl, "/path/to/project", {
	skip: ["build*", "cache"], // Runtime skip patterns
});

// Both sets of patterns are merged and applied
// Skipped for traversal: node_modules, .git, build*, cache
// But node_modules can still be matched by the explicit delete rule
```

### Skip vs Ignore Patterns

```javascript
// Skip prevents traversal but allows matching (performance optimization)
const dsl = `
  skip node_modules
  delete node_modules when exists package.json
  delete **/*.js  // Won't find files inside node_modules
`;

// Ignore prevents both traversal and matching (complete exclusion)
const dsl2 = `
  ignore .git
  delete .git  // This won't match anything
  delete **/*  // Won't find anything inside .git
`;

// Use skip for large directories you want to occasionally clean
// Use ignore for directories you never want to touch
const result = await executeCleanup(dsl, "/path/to/project", {
	skip: ["node_modules", "build"], // Can be matched if explicitly targeted
	ignore: [".git", "*.keep"], // Never matched under any circumstances
});
```

### Performance Optimization with Skip Patterns

```javascript
// Skip large directories to improve performance
const dsl = `
  skip node_modules
  skip .git
  skip build

  delete **/*.tmp
  delete **/*.log
`;

// Scanning is much faster because skipped directories are not traversed
const targets = await findTargets(dsl, "/large/workspace");

// Equivalent using API skip patterns
const targets2 = await findTargets("delete **/*.tmp delete **/*.log", "/large/workspace", {
	skip: ["node_modules", ".git", "build"],
});
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { parseRules, findTargets, ExecutionResult, Rule } from "dedust";

const dsl: string = "delete *.log";
const rules: Rule[] = parseRules(dsl);
const targets: string[] = await findTargets(rules, "/path");
const result: ExecutionResult = await executeCleanup(rules, "/path");
```

## Safety Features

### Built-in Security Validations

**dedust** includes automatic safety validations to prevent accidental mass deletion:

1. **Dangerous Pattern Detection** - Automatically rejects patterns that could delete all files without conditions:

    - `delete *` - Would delete all files in directory
    - `delete **` - Would delete all files recursively
    - `delete *.*` - Would delete all files with extensions
    - `delete **/*` - Would delete all files in subdirectories
    - `delete **/*.*` - Would delete all files with extensions recursively

2. **Safe Patterns** - These patterns are always allowed:

    - Specific patterns like `delete *.log`, `delete target`, `delete node_modules`
    - Dangerous patterns with conditions: `delete * when exists Cargo.toml`
    - All `ignore` rules (not subject to validation)

3. **Validation Bypass** - For advanced users who understand the risks:

    ```javascript
    // API: Use skipValidation option
    await executeCleanup(dsl, baseDir, { skipValidation: true });

    // CLI: Use --skip-validation flag with --delete
    dedust --delete --skip-validation
    ```

4. **Clear Error Messages** - When validation fails, you get helpful suggestions:

    ```
    SECURITY VALIDATION FAILED

    Dangerous pattern detected: 'delete *' without any condition.

    Suggestions:
      • Add a condition (e.g., 'when exists Cargo.toml')
      • Use a more specific pattern (e.g., '*.log' instead of '*')
      • Use 'ignore' rules to protect important files
    ```

### Other Safety Features

1. **Dry run by default** - `findTargets()` lets you preview what will be deleted
2. **No upward traversal** - Rules cannot delete outside the base directory
3. **Explicit paths** - No implicit deletion of system directories
4. **Error handling** - Gracefully handles permission errors and continues

### Security Best Practices

1. **Always use conditions for broad patterns:**

    ```text
    # Good: Only delete in Rust projects
    delete target when exists Cargo.toml

    # Bad: Would delete all 'target' directories everywhere
    delete target
    ```

2. **Use ignore rules to protect important files:**

    ```text
    # Protect version control and configuration
    ignore .git
    ignore .env
    ignore *.keep

    # Then use broader cleanup rules
    delete *.tmp
    ```

3. **Preview before deleting:**

    ```bash
    # Preview what would be deleted (default behavior)
    dedust

    # Then execute if results look correct
    dedust --delete
    ```

4. **Use specific patterns when possible:**

    ```text
    # Good: Specific to what you want to clean
    delete *.log
    delete **/*.tmp
    delete node_modules when exists package.json

    # Avoid: Too broad without conditions
    delete *
    delete **/*
    ```

## Dedust Rule Language (DRL) Design Principles

The **Dedust Rule Language (DRL)** follows these core design principles:

1. **Declarative** - Rules describe what to clean, not how
2. **Human-readable** - Close to natural language
3. **Context-aware** - Understands directory relationships
4. **Safe by default** - Requires explicit conditions for cleanup
5. **Simple & Clear** - No complex nesting or hidden behavior

**DRL** is designed to be: **More powerful than glob, simpler than YAML, safer than scripts**.

For detailed specifications, see [spec.md](./spec.md).

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
