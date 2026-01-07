import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dedust } from "../src/index.js";
import { createStructure as createStructureHelper } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, ".test-tmp-skip");

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

test("Skip - skip prevents traversal but allows matching", async () => {
	createStructure({
		node_modules: {
			package1: {
				"index.js": "code",
				"package.json": '{"name": "package1"}',
			},
			package2: {
				"index.js": "code",
			},
		},
		src: {
			"app.js": "app code",
		},
		"package.json": '{"name": "test"}',
	});

	// Skip node_modules from traversal, but still allow explicit deletion
	const dsl = `
		skip node_modules
		delete node_modules when exists package.json
		delete **/*.js
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should find:
	// 1. node_modules directory itself (explicit match)
	// 2. src/app.js (found during traversal of src)
	// Should NOT find:
	// - node_modules/package1/index.js (not traversed)
	// - node_modules/package2/index.js (not traversed)

	assert.ok(
		targets.some((t) => t === path.join(testDir, "node_modules")),
		"Should match node_modules directory"
	);
	assert.ok(
		targets.some((t) => t.endsWith(path.join("src", "app.js"))),
		"Should find src/app.js"
	);
	assert.ok(!targets.some((t) => t.includes(path.join("node_modules", "package1", "index.js"))), "Should not traverse into node_modules");
	assert.ok(!targets.some((t) => t.includes(path.join("node_modules", "package2", "index.js"))), "Should not traverse into node_modules");
});

test("Skip - difference between skip and ignore", async () => {
	createStructure({
		node_modules: {
			package1: {
				"index.js": "code",
			},
		},
		".git": {
			config: "git config",
		},
		src: {
			"app.js": "code",
		},
		"package.json": '{"name": "test"}',
	});

	// skip prevents traversal but allows matching
	// ignore prevents both traversal and matching
	const dsl = `
		skip node_modules
		ignore .git
		delete node_modules when exists package.json
		delete .git when exists package.json
		delete **/*.js
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// node_modules should be matched (skip allows matching)
	assert.ok(
		targets.some((t) => t === path.join(testDir, "node_modules")),
		"Skip should allow node_modules to be matched"
	);

	// .git should NOT be matched (ignore prevents matching)
	assert.ok(!targets.some((t) => t.includes(".git")), "Ignore should prevent .git from being matched");

	// src/app.js should be found
	assert.ok(
		targets.some((t) => t.endsWith(path.join("src", "app.js"))),
		"Should find src/app.js"
	);

	// No files inside node_modules or .git should be found
	assert.ok(!targets.some((t) => t.includes(path.join("node_modules", "package1"))), "Should not traverse node_modules");
});

test("Skip - skip with glob pattern", async () => {
	createStructure({
		cache1: {
			"data.txt": "cached",
		},
		cache2: {
			"data.txt": "cached",
		},
		src: {
			"app.js": "code",
		},
	});

	const dsl = `
		skip cache*
		delete cache* when exists src
		delete **/*.txt
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should match cache1 and cache2 directories themselves
	assert.ok(
		targets.some((t) => t === path.join(testDir, "cache1")),
		"Should match cache1 directory"
	);
	assert.ok(
		targets.some((t) => t === path.join(testDir, "cache2")),
		"Should match cache2 directory"
	);

	// Should NOT traverse into cache directories
	assert.ok(!targets.some((t) => t.includes(path.join("cache1", "data.txt"))), "Should not traverse cache1");
	assert.ok(!targets.some((t) => t.includes(path.join("cache2", "data.txt"))), "Should not traverse cache2");
});

test("Skip - skip deep directory with recursive suffix", async () => {
	createStructure({
		large_dir: {
			subdir1: {
				"file1.txt": "content",
			},
			subdir2: {
				"file2.txt": "content",
			},
		},
		small_dir: {
			"file3.txt": "content",
		},
	});

	const dsl = `
		skip large_dir/**
		delete large_dir
		delete **/*.txt
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should match large_dir itself
	assert.ok(
		targets.some((t) => t === path.join(testDir, "large_dir")),
		"Should match large_dir"
	);

	// Should match file3.txt
	assert.ok(
		targets.some((t) => t.endsWith(path.join("small_dir", "file3.txt"))),
		"Should find file3.txt"
	);

	// Should NOT traverse into large_dir
	assert.ok(!targets.some((t) => t.includes(path.join("large_dir", "subdir1"))), "Should not traverse large_dir");
});

test("Skip - executeCleanup with skip", async () => {
	createStructure({
		node_modules: {
			package1: {
				"index.js": "code",
			},
		},
		src: {
			"app.js": "code",
		},
		"package.json": '{"name": "test"}',
	});

	const dsl = `
		skip node_modules
		delete node_modules when exists package.json
	`;
	const scan = await dedust(dsl, testDir);
	const result = await scan.execute();

	assert.strictEqual(result.errors.length, 0, "Should have no errors");
	assert.strictEqual(result.deleted.length, 1, "Should delete 1 item");

	// node_modules should be deleted
	assert.ok(!fs.existsSync(path.join(testDir, "node_modules")), "node_modules should be deleted");

	// src should still exist
	assert.ok(fs.existsSync(path.join(testDir, "src")), "src should still exist");
	assert.ok(fs.existsSync(path.join(testDir, "src", "app.js")), "src/app.js should still exist");
});

test("Skip - multiple skip patterns", async () => {
	createStructure({
		node_modules: {
			"index.js": "code",
		},
		".git": {
			config: "config",
		},
		build: {
			"output.js": "compiled",
		},
		src: {
			"app.js": "code",
		},
	});

	const dsl = `
		skip node_modules
		skip .git
		delete node_modules
		delete .git
		delete build
		delete **/*.js
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should match node_modules, .git, and build directories
	assert.ok(
		targets.some((t) => t === path.join(testDir, "node_modules")),
		"Should match node_modules"
	);
	assert.ok(
		targets.some((t) => t === path.join(testDir, ".git")),
		"Should match .git"
	);
	assert.ok(
		targets.some((t) => t === path.join(testDir, "build")),
		"Should match build"
	);

	// Should find src/app.js
	assert.ok(
		targets.some((t) => t.endsWith(path.join("src", "app.js"))),
		"Should find src/app.js"
	);

	// Should NOT traverse into node_modules or .git (but build is not skipped)
	assert.ok(!targets.some((t) => t.includes(path.join("node_modules", "index.js"))), "Should not traverse node_modules");
	assert.ok(!targets.some((t) => t.includes(path.join(".git", "config"))), "Should not traverse .git");
	assert.ok(
		targets.some((t) => t.includes(path.join("build", "output.js"))),
		"Should traverse build (not skipped)"
	);
});

test("Skip - combined with ignore", async () => {
	createStructure({
		node_modules: {
			"index.js": "code",
		},
		".git": {
			config: "config",
		},
		cache: {
			"data.txt": "cached",
		},
		src: {
			"app.js": "code",
		},
	});

	const dsl = `
		skip node_modules
		ignore .git
		delete node_modules
		delete .git
		delete cache
		delete **/*
	`;
	const targets = await dedust(dsl, testDir, {
		skipValidation: true,
	});

	// node_modules should be matched (skip allows it)
	assert.ok(
		targets.some((t) => t === path.join(testDir, "node_modules")),
		"Skip should allow node_modules to match"
	);

	// .git should NOT be matched (ignore prevents it)
	assert.ok(!targets.some((t) => t.includes(".git")), "Ignore should prevent .git from matching");

	// cache should be matched and traversed
	assert.ok(
		targets.some((t) => t === path.join(testDir, "cache")),
		"Should match cache"
	);

	// src should be matched and traversed
	assert.ok(
		targets.some((t) => t.includes("src")),
		"Should match src"
	);
});

test("Skip - no skip patterns", async () => {
	createStructure({
		node_modules: {
			"index.js": "code",
		},
		src: {
			"app.js": "code",
		},
	});

	const dsl = `
		delete **/*.js
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Without skip, should traverse and find all .js files
	assert.ok(
		targets.some((t) => t.endsWith(path.join("node_modules", "index.js"))),
		"Should traverse node_modules without skip"
	);
	assert.ok(
		targets.some((t) => t.endsWith(path.join("src", "app.js"))),
		"Should find src/app.js"
	);
});
