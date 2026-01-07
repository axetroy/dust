import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dedust from "../src/index.js";
import { parse } from "../src/parser.js";
import { tokenize } from "../src/tokenizer.js";

// Helper to parse rules
function parseRules(input) {
	const tokens = tokenize(input);
	return parse(tokens);
}
import { Evaluator } from "../src/evaluator.js";
import { createStructure as createStructureHelper } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, ".test-events-tmp");

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

test("Events - file:found event", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
		"readme.txt": "readme",
	});

	const filesFound = [];
	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		onFileFound: (data) => {
			filesFound.push(data.path);
		},
	});
	await scan.execute();

	assert.strictEqual(filesFound.length, 2);
	assert.ok(filesFound.some((f) => f.endsWith("test.log")));
	assert.ok(filesFound.some((f) => f.endsWith("app.log")));
});

test("Events - scan:start and scan:complete", async () => {
	createStructure({
		"test.log": "log content",
	});

	let scanStarted = false;
	let scanCompleted = false;
	let filesFoundCount = 0;

	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		onScanStart: (data) => {
			scanStarted = true;
			assert.strictEqual(data.baseDir, testDir);
			assert.strictEqual(data.rulesCount, 1);
		},
		onScanComplete: (data) => {
			scanCompleted = true;
			assert.strictEqual(data.baseDir, testDir);
			filesFoundCount = data.filesFound;
		},
	});
	await scan.execute();

	assert.strictEqual(scanStarted, true);
	assert.strictEqual(scanCompleted, true);
	assert.strictEqual(filesFoundCount, 1);
});

test("Events - scan:directory", async () => {
	createStructure({
		dir1: {
			"test.log": "log",
		},
		dir2: {
			"app.log": "log",
		},
	});

	const directoriesScanned = [];
	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		onScanDirectory: (data) => {
			directoriesScanned.push(data.directory);
		},
	});
	await scan.execute();

	// Should scan testDir, dir1, and dir2
	assert.ok(directoriesScanned.length >= 3);
	assert.ok(directoriesScanned.includes(testDir));
});

test("Events - file:deleted event", async () => {
	createStructure({
		"test.log": "log content",
		"app.log": "app log",
	});

	const filesDeleted = [];
	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		onFileDeleted: (data) => {
			filesDeleted.push(data.path);
			assert.strictEqual(typeof data.isDirectory, "boolean");
		},
	});
	await scan.execute();

	assert.strictEqual(filesDeleted.length, 2);
	assert.ok(filesDeleted.some((f) => f.endsWith("test.log")));
	assert.ok(filesDeleted.some((f) => f.endsWith("app.log")));
});

test("Events - error event during deletion", async () => {
	createStructure({
		"test.log": "log content",
	});

	const errors = [];
	const dsl = "delete *.log";

	// Make file read-only to cause deletion error (on Unix systems)
	const _logFile = path.join(testDir, "test.log");
	if (process.platform !== "win32") {
		fs.chmodSync(testDir, 0o444); // Make directory read-only
	}

	const scan = await dedust(dsl, testDir, { 		onError: (data) => {
			errors.push(data);
			assert.strictEqual(data.phase, "deletion");
			assert.ok(data.error instanceof Error);
		},
	});
	await scan.execute();

	// Restore permissions and cleanup
	if (process.platform !== "win32") {
		fs.chmodSync(testDir, 0o755);
	}
});

test("Events - Evaluator direct usage with events", async () => {
	createStructure({
		"test.log": "log",
		"app.log": "log",
	});

	const dsl = "delete *.log";
	const rules = parseRules(dsl);
	const evaluator = new Evaluator(rules, testDir);

	const filesFound = [];
	const filesDeleted = [];

	evaluator.on("file:found", (data) => {
		filesFound.push(data.path);
	});

	evaluator.on("file:deleted", (data) => {
		filesDeleted.push(data.path);
	});

	const targets = await evaluator.evaluate(true);
	await evaluator.execute(targets);

	assert.strictEqual(filesFound.length, 2);
	assert.strictEqual(filesDeleted.length, 2);
});

test("Events - all event types", async () => {
	createStructure({
		"test.log": "log",
	});

	const events = {
		scanStart: false,
		scanDirectory: false,
		scanComplete: false,
		fileFound: false,
		fileDeleted: false,
	};

	const dsl = "delete *.log";

	const scan = await dedust(dsl, testDir, { 		onScanStart: () => {
			events.scanStart = true;
		},
		onScanDirectory: () => {
			events.scanDirectory = true;
		},
		onScanComplete: () => {
			events.scanComplete = true;
		},
		onFileFound: () => {
			events.fileFound = true;
		},
		onFileDeleted: () => {
			events.fileDeleted = true;
		},
	});
	await scan.execute();

	assert.strictEqual(events.scanStart, true, "scan:start event should fire");
	assert.strictEqual(events.scanDirectory, true, "scan:directory event should fire");
	assert.strictEqual(events.scanComplete, true, "scan:complete event should fire");
	assert.strictEqual(events.fileFound, true, "file:found event should fire");
	assert.strictEqual(events.fileDeleted, true, "file:deleted event should fire");
});
