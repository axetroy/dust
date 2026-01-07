import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dedust } from "../src/index.js";
import { createStructure } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temporary test directories
const testDir1 = path.join(__dirname, ".test-multi-dir1");
const testDir2 = path.join(__dirname, ".test-multi-dir2");
const testDir3 = path.join(__dirname, ".test-multi-dir3");

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
	for (const dir of [testDir1, testDir2, testDir3]) {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
}

test("Multiple directories - scan with array", async () => {
	createStructure(
		{
			"test.log": "log1",
			"app.log": "log1",
		},
		testDir1
	);

	createStructure(
		{
			"test.log": "log2",
			"error.log": "log2",
		},
		testDir2
	);

	const dsl = "delete *.log";
	const result = await dedust(dsl, [testDir1, testDir2]);
	const targets = result.targets;

	assert.strictEqual(targets.length, 4);
	assert.ok(targets.some((t) => t.includes("test-multi-dir1") && t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.includes("test-multi-dir1") && t.endsWith("app.log")));
	assert.ok(targets.some((t) => t.includes("test-multi-dir2") && t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.includes("test-multi-dir2") && t.endsWith("error.log")));
});

test("Multiple directories - scan with single string (backward compatible)", async () => {
	createStructure(
		{
			"test.log": "log",
		},
		testDir1
	);

	const dsl = "delete *.log";
	const result = await dedust(dsl, testDir1, );
	const targets = result.targets;

	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].endsWith("test.log"));
});

test("Multiple directories - execute with array", async () => {
	createStructure(
		{
			"test.log": "log1",
		},
		testDir1
	);

	createStructure(
		{
			"test.log": "log2",
		},
		testDir2
	);

	const dsl = "delete *.log";
	const scan = await dedust(dsl, [testDir1, testDir2], );
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 2);
	assert.strictEqual(result.errors.length, 0);
	assert.ok(!fs.existsSync(path.join(testDir1, "test.log")));
	assert.ok(!fs.existsSync(path.join(testDir2, "test.log")));
});

test("Multiple directories - with conditions", async () => {
	createStructure(
		{
			"Cargo.toml": "[package]",
			target: {},
		},
		testDir1
	);

	createStructure(
		{
			"package.json": "{}",
			node_modules: {},
		},
		testDir2
	);

	createStructure(
		{
			"Cargo.toml": "[package]",
			target: {},
		},
		testDir3
	);

	const dsl = "delete target when exists Cargo.toml";
	const result = await dedust(dsl, [testDir1, testDir2, testDir3]);
	const targets = result.targets;

	// Should find target in dir1 and dir3, but not dir2
	assert.strictEqual(targets.length, 2);
	assert.ok(targets.some((t) => t.includes("test-multi-dir1") && t.endsWith("target")));
	assert.ok(targets.some((t) => t.includes("test-multi-dir3") && t.endsWith("target")));
	assert.ok(!targets.some((t) => t.includes("test-multi-dir2")));
});

test("Multiple directories - scan with events", async () => {
	createStructure(
		{
			"test.log": "log1",
		},
		testDir1
	);

	createStructure(
		{
			"test.log": "log2",
		},
		testDir2
	);

	const filesFound = [];
	let scanStartCount = 0;
	let scanCompleteCount = 0;

	const dsl = "delete *.log";
	const result = await dedust(dsl, [testDir1, testDir2], {
		onFileFound: (data) => {
			filesFound.push(data.path);
		},
		onScanStart: () => {
			scanStartCount++;
		},
		onScanComplete: () => {
			scanCompleteCount++;
		},
	});
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.strictEqual(filesFound.length, 2);
	assert.strictEqual(scanStartCount, 2); // Once per directory
	assert.strictEqual(scanCompleteCount, 2); // Once per directory
});

test("Multiple directories - execute with events", async () => {
	createStructure(
		{
			"test.log": "log1",
		},
		testDir1
	);

	createStructure(
		{
			"test.log": "log2",
		},
		testDir2
	);

	const filesDeleted = [];

	const dsl = "delete *.log";
	const scan = await dedust(dsl, [testDir1, testDir2], {
				onFileDeleted: (data) => {
			filesDeleted.push(data.path);
		},
	});
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 2);
	assert.strictEqual(filesDeleted.length, 2);
	assert.ok(!fs.existsSync(path.join(testDir1, "test.log")));
	assert.ok(!fs.existsSync(path.join(testDir2, "test.log")));
});

test("Multiple directories - empty array", async () => {
	const dsl = "delete *.log";
	const result = await dedust(dsl, [], );
	const targets = result.targets;

	assert.strictEqual(targets.length, 0);
});

test("Multiple directories - three directories", async () => {
	createStructure(
		{
			"file1.log": "log",
		},
		testDir1
	);

	createStructure(
		{
			"file2.log": "log",
		},
		testDir2
	);

	createStructure(
		{
			"file3.log": "log",
		},
		testDir3
	);

	const dsl = "delete *.log";
	const result = await dedust(dsl, [testDir1, testDir2, testDir3]);
	const targets = result.targets;

	assert.strictEqual(targets.length, 3);
});
