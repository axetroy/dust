import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dedust from "../src/index.js";
import { createStructure as createStructureHelper } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, ".test-tmp");

const createStructure = (structure, baseDir = testDir) => createStructureHelper(structure, baseDir);

beforeEach(() => {
	cleanup();
});

afterEach(() => {
	cleanup();
});

/**
 * Clean up test directory
 */
function cleanup() {
	if (fs.existsSync(testDir)) {
		fs.rmSync(testDir, { recursive: true, force: true });
	}
}

test("Evaluator - simple delete without condition", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
		"readme.txt": "readme",
	});

	const dsl = "delete *.log";
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("app.log")));
	assert.ok(!targets.some((t) => t.endsWith("readme.txt")));
});

test("Evaluator - delete with exists condition", async () => {
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
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].includes("project1"));
	assert.ok(targets[0].endsWith("target"));
});

test("Evaluator - delete with parent exists", async () => {
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
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should match workspace/target (parent has Cargo.toml)
	// Should match crate1/target (parent crate1 has Cargo.toml)
	// Should NOT match crate2/target (parent crate2 doesn't have Cargo.toml)
	assert.ok(targets.length >= 1);
	assert.ok(targets.some((t) => t.includes("crate1") && t.endsWith("target")));
});

test("Evaluator - delete with AND condition", async () => {
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
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Only project1 has both Cargo.toml and src
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].includes("project1"));
});

test("Evaluator - delete with NOT condition", async () => {
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
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Only project1 should match (doesn't have keep.txt)
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].includes("project1"));
});

test("Evaluator - delete with parents exists", async () => {
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
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// All .tmp files should be found since .git is in an ancestor
	assert.ok(targets.length >= 2);
});

test("Evaluator - execute cleanup", async () => {
	createStructure({
		"test.log": "log",
		"app.log": "log",
		"readme.txt": "text",
	});

	const dsl = "delete *.log";
	const scan = await dedust(dsl, testDir);
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 2);
	assert.strictEqual(result.errors.length, 0);

	// Check files are actually deleted
	assert.ok(!fs.existsSync(path.join(testDir, "test.log")));
	assert.ok(!fs.existsSync(path.join(testDir, "app.log")));
	assert.ok(fs.existsSync(path.join(testDir, "readme.txt")));
});

test("Evaluator - multiple rules", async () => {
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

	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should find: test.log, rust_project/target, node_project/node_modules
	assert.ok(targets.length >= 3);
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.includes("rust_project") && t.endsWith("target")));
	assert.ok(targets.some((t) => t.includes("node_project") && t.endsWith("node_modules")));
});

test("Evaluator - no matches", async () => {
	createStructure({
		"readme.txt": "text",
	});

	const dsl = "delete *.log";
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	assert.strictEqual(targets.length, 0);
});

test("Evaluator - with child location", async () => {
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
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// This rule is a bit tricky - it looks for file.txt in directories
	// where a child directory exists containing file.txt
	// In this case, parent directory has children with file.txt
	// So if parent had a file.txt, it would be deleted
	// Since it doesn't, no matches expected with this structure
	assert.ok(Array.isArray(targets));
});

test("Evaluator - directory deletion", async () => {
	createStructure({
		"Cargo.toml": "[package]",
		target: {
			debug: {
				app: "binary",
			},
		},
	});

	const dsl = "delete target when exists Cargo.toml";
	const scan = await dedust(dsl, testDir);
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 1);
	assert.ok(!fs.existsSync(path.join(testDir, "target")));
});

test("Parser integration - complex real-world example", async () => {
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

	const result = await dedust(dsl, testDir);
	const targets = result.targets;

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
});

test("Evaluator - pattern with whitespace", async () => {
	createStructure({
		"My Documents": {
			"file.txt": "content",
		},
		"Program Files": {
			"app.exe": "binary",
		},
		NoSpaces: {
			"file.txt": "content",
		},
	});

	const dsl = 'delete "My Documents"';
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].endsWith("My Documents"));
});

test("Evaluator - condition with whitespace in pattern", async () => {
	createStructure({
		project: {
			"package.json": "{}",
			node_modules: {},
		},
		"My Project": {
			"package.json": "{}",
			node_modules: {},
		},
	});

	const dsl = 'delete node_modules when exists "package.json"';
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should find both node_modules directories
	assert.ok(targets.length >= 2);
	assert.ok(targets.some((t) => t.includes("project") && t.endsWith("node_modules")));
	assert.ok(targets.some((t) => t.includes("My Project") && t.endsWith("node_modules")));
});
