import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { findTargets, executeCleanup } from "../src/index.js";
import { ValidationError } from "../src/validator.js";
import { createStructure as createStructureHelper } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, ".test-tmp-security");

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

test("Security - findTargets rejects dangerous pattern without condition", async () => {
	createStructure({
		"file1.txt": "content",
		"file2.log": "log",
		"file3.md": "markdown",
	});

	const dsl = "delete *";

	await assert.rejects(async () => {
		await findTargets(dsl, testDir);
	}, ValidationError);
});

test("Security - executeCleanup rejects dangerous pattern without condition", async () => {
	createStructure({
		"file1.txt": "content",
		"file2.log": "log",
	});

	const dsl = "delete *";

	await assert.rejects(async () => {
		await executeCleanup(dsl, testDir);
	}, ValidationError);
});

test("Security - findTargets accepts dangerous pattern with condition", async () => {
	createStructure({
		"Cargo.toml": "[package]",
		"file1.txt": "content",
		"file2.log": "log",
	});

	const dsl = "delete * when exists Cargo.toml";
	const targets = await findTargets(dsl, testDir);

	// Should find files (validation passes because of condition)
	assert.ok(targets.length > 0);
});

test("Security - executeCleanup accepts dangerous pattern with condition", async () => {
	createStructure({
		"Cargo.toml": "[package]",
		"file1.txt": "content",
		"file2.log": "log",
	});

	const dsl = "delete * when exists Cargo.toml";
	const result = await executeCleanup(dsl, testDir);

	// Should delete files (validation passes because of condition)
	assert.ok(result.deleted.length > 0);
});

test("Security - findTargets accepts safe patterns without condition", async () => {
	createStructure({
		"file1.log": "log1",
		"file2.log": "log2",
		"file3.txt": "text",
	});

	const dsl = "delete *.log";
	const targets = await findTargets(dsl, testDir);

	assert.strictEqual(targets.length, 2);
	assert.ok(targets.every((t) => t.endsWith(".log")));
});

test("Security - skipValidation option bypasses validation", async () => {
	createStructure({
		"file1.txt": "content",
		"file2.log": "log",
	});

	const dsl = "delete *";

	// Should not throw with skipValidation
	const targets = await findTargets(dsl, testDir, { skipValidation: true });

	// Should find all files
	assert.ok(targets.length > 0);
});

test("Security - ValidationError contains helpful message", async () => {
	createStructure({
		"file1.txt": "content",
	});

	const dsl = "delete **";

	try {
		await findTargets(dsl, testDir);
		assert.fail("Should have thrown ValidationError");
	} catch (error) {
		assert.ok(error instanceof ValidationError);
		assert.ok(error.message.includes("Rule validation failed"));
		assert.ok(error.message.includes("Dangerous pattern detected"));
		assert.ok(error.message.includes("delete **"));
		assert.ok(error.validationErrors.length > 0);
	}
});

test("Security - Multiple dangerous patterns reported", async () => {
	createStructure({
		"file1.txt": "content",
	});

	const dsl = `
		delete *
		delete **
		delete *.*
	`;

	try {
		await findTargets(dsl, testDir);
		assert.fail("Should have thrown ValidationError");
	} catch (error) {
		assert.ok(error instanceof ValidationError);
		assert.strictEqual(error.validationErrors.length, 3);
	}
});

test("Security - Mixed safe and dangerous patterns", async () => {
	createStructure({
		"file1.log": "log",
		"file2.txt": "text",
	});

	const dsl = `
		delete *.log
		delete *
		delete target when exists Cargo.toml
	`;

	try {
		await findTargets(dsl, testDir);
		assert.fail("Should have thrown ValidationError");
	} catch (error) {
		assert.ok(error instanceof ValidationError);
		// Only the "delete *" should fail
		assert.strictEqual(error.validationErrors.length, 1);
		assert.ok(error.validationErrors[0].error.includes("delete *"));
	}
});

test("Security - Complex condition makes dangerous pattern safe", async () => {
	createStructure({
		"Cargo.toml": "[package]",
		src: {
			"lib.rs": "code",
		},
		"file1.txt": "content",
	});

	const dsl = "delete * when exists Cargo.toml and exists src";
	const targets = await findTargets(dsl, testDir);

	// Should work fine with conditions and find files
	assert.ok(targets.length > 0, "Should find files when conditions are met");
	assert.ok(
		targets.some((t) => t.includes("file1.txt")),
		"Should find file1.txt"
	);
});

test("Security - Ignore rules are not validated", async () => {
	createStructure({
		"file1.txt": "content",
		".git": {
			config: "git",
		},
	});

	// Ignore rules with * pattern should be fine
	const dsl = `
		ignore *
		ignore .git
		delete *.txt
	`;

	const targets = await findTargets(dsl, testDir);

	// Should work fine - ignore rules are not subject to validation
	assert.strictEqual(targets.length, 0); // All ignored
});

test("Security - executeCleanup with skipValidation actually deletes", async () => {
	createStructure({
		"file1.txt": "content",
		"file2.log": "log",
	});

	const dsl = "delete *";

	// With skipValidation, should actually delete
	const result = await executeCleanup(dsl, testDir, { skipValidation: true });

	assert.ok(result.deleted.length > 0);
	assert.strictEqual(result.errors.length, 0);
});

test("Security - Specific patterns are always safe", async () => {
	createStructure({
		target: { debug: {} },
		node_modules: { package: {} },
		".venv": { lib: {} },
		"app.log": "log",
		"test.tmp": "tmp",
	});

	const dsl = `
		delete target
		delete node_modules
		delete .venv
		delete *.log
		delete **/*.tmp
	`;

	// All of these should be safe
	const targets = await findTargets(dsl, testDir);

	assert.ok(targets.length > 0);
});

test("Security - Pattern **/*.* is dangerous", async () => {
	createStructure({
		"file1.txt": "content",
	});

	const dsl = "delete **/*.*";

	await assert.rejects(async () => {
		await findTargets(dsl, testDir);
	}, ValidationError);
});

test("Security - Pattern **/* is dangerous", async () => {
	createStructure({
		"file1.txt": "content",
	});

	const dsl = "delete **/*";

	await assert.rejects(async () => {
		await findTargets(dsl, testDir);
	}, ValidationError);
});
