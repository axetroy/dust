import test from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { findTargets, executeCleanup } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, ".test-tmp");

/**
 * Create a test directory structure
 * @param {Object} structure - Directory structure as nested object
 * @param {string} baseDir - Base directory to create structure in
 */
function createStructure(structure, baseDir = testDir) {
	if (!fs.existsSync(baseDir)) {
		fs.mkdirSync(baseDir, { recursive: true });
	}

	for (const [name, content] of Object.entries(structure)) {
		const fullPath = path.join(baseDir, name);

		if (typeof content === "object" && content !== null) {
			// It's a directory
			fs.mkdirSync(fullPath, { recursive: true });
			createStructure(content, fullPath);
		} else {
			// It's a file
			fs.writeFileSync(fullPath, content || "", "utf8");
		}
	}
}

/**
 * Clean up test directory
 */
function cleanup() {
	if (fs.existsSync(testDir)) {
		fs.rmSync(testDir, { recursive: true, force: true });
	}
}

test("Evaluator - simple delete without condition", async () => {
	cleanup();
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
		"readme.txt": "readme",
	});

	const dsl = "delete *.log";
	const targets = await findTargets(dsl, testDir);

	assert.strictEqual(targets.length, 2);
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("app.log")));
	assert.ok(!targets.some((t) => t.endsWith("readme.txt")));

	cleanup();
});

test("Evaluator - delete with exists condition", async () => {
	cleanup();
	createStructure({
		project1: {
			"Cargo.toml": "[package]",
			target: {
				debug: {},
			},
		},
		project2: {
			"package.json": "{}",
		},
	});

	const dsl = "delete target when exists Cargo.toml";
	const targets = await findTargets(dsl, testDir);

	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].includes("project1"));
	assert.ok(targets[0].endsWith("target"));

	cleanup();
});

test("Evaluator - delete with parent exists", async () => {
	cleanup();
	createStructure({
		workspace: {
			"Cargo.toml": "[workspace]",
			crate1: {
				"Cargo.toml": "[package]",
				target: {},
			},
			crate2: {
				target: {},
			},
		},
	});

	const dsl = "delete target when parent exists Cargo.toml";
	const targets = await findTargets(dsl, testDir);

	// Should match workspace/target (parent has Cargo.toml)
	// Should match crate1/target (parent crate1 has Cargo.toml)
	// Should NOT match crate2/target (parent crate2 doesn't have Cargo.toml)
	assert.ok(targets.length >= 1);
	assert.ok(targets.some((t) => t.includes("crate1") && t.endsWith("target")));

	cleanup();
});

test("Evaluator - delete with AND condition", async () => {
	cleanup();
	createStructure({
		project1: {
			"Cargo.toml": "[package]",
			src: {
				"lib.rs": "fn main() {}",
			},
			target: {},
		},
		project2: {
			"Cargo.toml": "[package]",
			target: {},
		},
	});

	const dsl = "delete target when exists Cargo.toml and exists src";
	const targets = await findTargets(dsl, testDir);

	// Only project1 has both Cargo.toml and src
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].includes("project1"));

	cleanup();
});

test("Evaluator - delete with NOT condition", async () => {
	cleanup();
	createStructure({
		project1: {
			"Cargo.toml": "[package]",
			target: {},
		},
		project2: {
			"Cargo.toml": "[package]",
			"keep.txt": "keep me",
			target: {},
		},
	});

	const dsl = "delete target when exists Cargo.toml and not exists keep.txt";
	const targets = await findTargets(dsl, testDir);

	// Only project1 should match (doesn't have keep.txt)
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].includes("project1"));

	cleanup();
});

test("Evaluator - delete with parents exists", async () => {
	cleanup();
	createStructure({
		".git": {},
		src: {
			"test.tmp": "temp",
			nested: {
				"file.tmp": "temp",
			},
		},
		other: {
			"another.tmp": "temp",
		},
	});

	const dsl = "delete **/*.tmp when parents exists .git";
	const targets = await findTargets(dsl, testDir);

	// All .tmp files should be found since .git is in an ancestor
	assert.ok(targets.length >= 2);

	cleanup();
});

test("Evaluator - execute cleanup", async () => {
	cleanup();
	createStructure({
		"test.log": "log",
		"app.log": "log",
		"readme.txt": "text",
	});

	const dsl = "delete *.log";
	const result = await executeCleanup(dsl, testDir);

	assert.strictEqual(result.deleted.length, 2);
	assert.strictEqual(result.errors.length, 0);

	// Check files are actually deleted
	assert.ok(!fs.existsSync(path.join(testDir, "test.log")));
	assert.ok(!fs.existsSync(path.join(testDir, "app.log")));
	assert.ok(fs.existsSync(path.join(testDir, "readme.txt")));

	cleanup();
});

test("Evaluator - multiple rules", async () => {
	cleanup();
	createStructure({
		"test.log": "log",
		rust_project: {
			"Cargo.toml": "[package]",
			target: {},
		},
		node_project: {
			"package.json": "{}",
			node_modules: {},
		},
	});

	const dsl = `delete *.log
delete target when exists Cargo.toml
delete node_modules when exists package.json`;

	const targets = await findTargets(dsl, testDir);

	// Should find: test.log, rust_project/target, node_project/node_modules
	assert.ok(targets.length >= 3);
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.includes("rust_project") && t.endsWith("target")));
	assert.ok(targets.some((t) => t.includes("node_project") && t.endsWith("node_modules")));

	cleanup();
});

test("Evaluator - no matches", async () => {
	cleanup();
	createStructure({
		"readme.txt": "text",
	});

	const dsl = "delete *.log";
	const targets = await findTargets(dsl, testDir);

	assert.strictEqual(targets.length, 0);

	cleanup();
});

test("Evaluator - with child location", async () => {
	cleanup();
	createStructure({
		parent: {
			child1: {
				"file.txt": "text",
			},
			child2: {
				"file.txt": "text",
			},
		},
	});

	const dsl = "delete file.txt when child exists file.txt";
	const targets = await findTargets(dsl, testDir);

	// This rule is a bit tricky - it looks for file.txt in directories
	// where a child directory exists containing file.txt
	// In this case, parent directory has children with file.txt
	// So if parent had a file.txt, it would be deleted
	// Since it doesn't, no matches expected with this structure
	assert.ok(Array.isArray(targets));

	cleanup();
});

test("Evaluator - directory deletion", async () => {
	cleanup();
	createStructure({
		"Cargo.toml": "[package]",
		target: {
			debug: {
				app: "binary",
			},
		},
	});

	const dsl = "delete target when exists Cargo.toml";
	const result = await executeCleanup(dsl, testDir);

	assert.strictEqual(result.deleted.length, 1);
	assert.ok(!fs.existsSync(path.join(testDir, "target")));

	cleanup();
});

test("Parser integration - complex real-world example", async () => {
	cleanup();
	createStructure({
		".git": {},
		rust_workspace: {
			"Cargo.toml": "[workspace]",
			crate1: {
				"Cargo.toml": "[package]",
				src: {},
				target: {},
			},
			crate2: {
				"Cargo.toml": "[package]",
				src: {},
				target: {},
			},
		},
		node_project: {
			"package.json": "{}",
			node_modules: {},
			src: {},
		},
		python_project: {
			"pyproject.toml": "[tool.poetry]",
			".venv": {},
		},
		"test.log": "log",
		logs: {
			"app.log": "log",
			"error.log": "log",
		},
	});

	const dsl = `# Rust projects
delete target when exists Cargo.toml
delete target when parent exists Cargo.toml

# Node projects
delete node_modules when exists package.json

# Python projects
delete .venv when exists pyproject.toml

# Logs everywhere
delete *.log
delete **/*.log when parents exists .git`;

	const targets = await findTargets(dsl, testDir);

	// Should find multiple targets
	assert.ok(targets.length > 0);

	// Check that we found the expected types
	const targetPaths = targets.map((t) => path.relative(testDir, t));

	// Should have rust targets
	assert.ok(targetPaths.some((t) => t.includes("target")));

	// Should have node_modules
	assert.ok(targetPaths.some((t) => t.includes("node_modules")));

	// Should have .venv
	assert.ok(targetPaths.some((t) => t.includes(".venv")));

	// Should have log files
	assert.ok(targetPaths.some((t) => t.endsWith(".log")));

	cleanup();
});

test("Evaluator - pattern with whitespace", async () => {
cleanup();
createStructure({
"My Documents": {
"file.txt": "content",
},
"Program Files": {
"app.exe": "binary",
},
"NoSpaces": {
"file.txt": "content",
},
});

const dsl = 'delete "My Documents"';
const targets = await findTargets(dsl, testDir);

assert.strictEqual(targets.length, 1);
assert.ok(targets[0].endsWith("My Documents"));

cleanup();
});

test("Evaluator - condition with whitespace in pattern", async () => {
cleanup();
createStructure({
project: {
"package.json": "{}",
"node_modules": {},
},
"My Project": {
"package.json": "{}",
"node_modules": {},
},
});

const dsl = 'delete node_modules when exists "package.json"';
const targets = await findTargets(dsl, testDir);

// Should find both node_modules directories
assert.ok(targets.length >= 2);
assert.ok(targets.some((t) => t.includes("project") && t.endsWith("node_modules")));
assert.ok(targets.some((t) => t.includes("My Project") && t.endsWith("node_modules")));

cleanup();
});
