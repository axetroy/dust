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
const testDir = path.join(__dirname, ".test-unified-api-tmp");

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

test("Unified API - scan without listeners", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
		"readme.txt": "readme",
	});

	const dsl = "delete *.log";
	const result = await dedust(dsl, testDir, );
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("app.log")));
});

test("Unified API - scan with listeners in options", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
		"readme.txt": "readme",
	});

	const filesFound = [];
	let scanCompleted = false;
	const dsl = "delete *.log";

	const result = await dedust(dsl, testDir, {
		onFileFound: (data) => {
			filesFound.push(data.path);
		},
		onScanComplete: (data) => {
			scanCompleted = true;
			assert.strictEqual(data.filesFound, 2);
		},
	});
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.strictEqual(filesFound.length, 2);
	assert.strictEqual(scanCompleted, true);
	assert.ok(filesFound.some((f) => f.endsWith("test.log")));
	assert.ok(filesFound.some((f) => f.endsWith("app.log")));
});

test("Unified API - execute without listeners", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
	});

	const dsl = "delete *.log";
	const scan = await dedust(dsl, testDir, );
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 2);
	assert.strictEqual(result.errors.length, 0);
	assert.ok(!fs.existsSync(path.join(testDir, "test.log")));
	assert.ok(!fs.existsSync(path.join(testDir, "app.log")));
});

test("Unified API - execute with listeners in options", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
	});

	const filesDeleted = [];
	let scanStarted = false;
	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		onScanStart: () => {
			scanStarted = true;
		},
		onFileDeleted: (data) => {
			filesDeleted.push(data.path);
			assert.strictEqual(typeof data.isDirectory, "boolean");
		},
	});
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 2);
	assert.strictEqual(filesDeleted.length, 2);
	assert.strictEqual(scanStarted, true);
	assert.ok(filesDeleted.some((f) => f.endsWith("test.log")));
	assert.ok(filesDeleted.some((f) => f.endsWith("app.log")));
});

test("Unified API - scan with listeners and ignore patterns", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
		"important.log": "important",
	});

	const filesFound = [];
	const dsl = "delete *.log";

	const result = await dedust(dsl, testDir, {
		ignore: ["important.log"],
		onFileFound: (data) => {
			filesFound.push(data.path);
		},
	});
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.strictEqual(filesFound.length, 2);
	assert.ok(!filesFound.some((f) => f.endsWith("important.log")));
	assert.ok(!targets.some((t) => t.endsWith("important.log")));
});

test("Unified API - execute with listeners and skip patterns", async () => {
	createStructure({
		"test.log": "log",
		dir1: {
			"app.log": "log",
		},
		node_modules: {
			"lib.log": "log",
		},
	});

	const directoriesScanned = [];
	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		skip: ["node_modules"],
		onScanDirectory: (data) => {
			directoriesScanned.push(data.directory);
		},
	});
	const result = await scan.execute();

	// Should delete test.log and dir1/app.log but not node_modules/lib.log
	assert.strictEqual(result.deleted.length, 2);
	// Should not scan into node_modules
	assert.ok(!directoriesScanned.some((d) => d.includes("node_modules")));
});

test("Unified API - scan with all options combined", async () => {
	createStructure({
		"test.log": "log",
		"important.log": "keep",
		build: {
			"cache.log": "log",
		},
	});

	const filesFound = [];
	let scanStarted = false;
	const dsl = "delete *.log";

	const result = await dedust(dsl, testDir, {
		ignore: ["important.log"],
		skip: ["build"],
		onScanStart: () => {
			scanStarted = true;
		},
		onFileFound: (data) => {
			filesFound.push(data.path);
		},
	});
	const targets = result.targets;

	assert.strictEqual(targets.length, 1);
	assert.strictEqual(filesFound.length, 1);
	assert.strictEqual(scanStarted, true);
	assert.ok(targets[0].endsWith("test.log"));
});

test("Unified API - execute with multiple directories and listeners", async () => {
	const testDir1 = path.join(testDir, "project1");
	const testDir2 = path.join(testDir, "project2");

	createStructure(
		{
			"test.log": "log",
		},
		testDir1
	);

	createStructure(
		{
			"app.log": "log",
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
	assert.ok(filesDeleted.some((f) => f.includes("project1") && f.endsWith("test.log")));
	assert.ok(filesDeleted.some((f) => f.includes("project2") && f.endsWith("app.log")));
});
