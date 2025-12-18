# dedust

A DSL-based garbage file cleanup tool for managing build artifacts, dependencies, and temporary files across projects.

**Dedust Rule Language (DRL)** - A human-readable DSL for defining cleanup rules. The default configuration file is `dedust.rules`.

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
npm install dedust
```

## Quick Start

```javascript
import { parseRules, findTargets, executeCleanup } from "dedust";

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
const targets = await findTargets(dsl, "/path/to/project");
console.log("Would delete:", targets);

// Or scan multiple directories at once
const targets = await findTargets(dsl, ["/path/to/project1", "/path/to/project2"]);

// Actually delete the files - single directory
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

## Configuration Files

### Using `dedust.rules`

Create a `dedust.rules` file in your project root to define reusable cleanup rules. 

See [dedust.rules](./dedust.rules) for a complete example configuration file.

Example configuration:

```text
# dedust.rules - Cleanup configuration for this project

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

## API Reference

### `parseRules(input: string): Rule[]`

Parse DSL text into an array of rules.

```javascript
import { parseRules } from "dedust";

const rules = parseRules("delete target when exists Cargo.toml");
console.log(rules);
```

### `findTargets(rulesOrDsl: string | Rule[], baseDirs: string | string[]): Promise<string[]>`

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
```

### `executeCleanup(rulesOrDsl: string | Rule[], baseDirs: string | string[]): Promise<ExecutionResult>`

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

### Event-Based API

For real-time feedback during cleanup operations, use the event-based functions:

#### `findTargetsWithEvents(rulesOrDsl, baseDir, listeners): Promise<string[]>`

Find targets with event callbacks for real-time feedback.

```javascript
import { findTargetsWithEvents } from "dedust";

const targets = await findTargetsWithEvents("delete *.log", "/path/to/project", {
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
```

#### `executeCleanupWithEvents(rulesOrDsl, baseDir, listeners): Promise<ExecutionResult>`

Execute cleanup with event callbacks.

```javascript
import { executeCleanupWithEvents } from "dedust";

const result = await executeCleanupWithEvents("delete *.log", "/path/to/project", {
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

### Advanced Usage

For advanced use cases, you can access the lower-level APIs:

```javascript
import { Tokenizer, Parser, Evaluator } from "dedust";

// Tokenize DSL text
const tokenizer = new Tokenizer("delete target");
const tokens = tokenizer.tokenize();

// Parse tokens into rules
const parser = new Parser(tokens);
const rules = parser.parse();

// Evaluate rules with direct event handling
const evaluator = new Evaluator(rules, "/path/to/project");

// Attach event listeners
evaluator.on("file:found", (data) => {
	console.log("Found:", data.path);
});

evaluator.on("file:deleted", (data) => {
	console.log("Deleted:", data.path);
});

evaluator.on("error", (data) => {
	console.error("Error:", data.error.message);
});

// Execute
const targets = await evaluator.evaluate();
const result = await evaluator.execute(targets);
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
import { parseRules, findTargets, ExecutionResult, Rule } from "dedust";

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
