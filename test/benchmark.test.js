import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { findTargets, executeCleanup, parseRules } from "../src/index.js";
import { createStructure as createStructureHelper } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary test directory
const testDir = path.join(__dirname, ".benchmark-tmp");

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

/**
 * Create a deep directory structure for benchmarking
 * @param {number} depth - How many levels deep
 * @param {number} filesPerLevel - Number of files per directory
 * @param {number} dirsPerLevel - Number of subdirectories per directory
 */
function createDeepStructure(depth, filesPerLevel = 5, dirsPerLevel = 3) {
	function buildLevel(currentDepth, prefix = "") {
		if (currentDepth === 0) return {};

		const level = {};

		// Add files at this level
		for (let i = 0; i < filesPerLevel; i++) {
			level[`${prefix}file${i}.txt`] = `content ${i}`;
			level[`${prefix}file${i}.log`] = `log ${i}`;
		}

		// Add subdirectories
		if (currentDepth > 1) {
			for (let i = 0; i < dirsPerLevel; i++) {
				const dirName = `${prefix}dir${i}`;
				level[dirName] = buildLevel(currentDepth - 1, `${prefix}dir${i}_`);
			}
		}

		return level;
	}

	return buildLevel(depth);
}

/**
 * Measure execution time of an async function
 */
async function measureTime(fn, label) {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	const duration = end - start;
	console.log(`[BENCHMARK] ${label}: ${duration.toFixed(2)}ms`);
	return { result, duration };
}

test("Benchmark - parseRules with various DSL sizes", async () => {
	const smallDSL = "delete *.log";
	const mediumDSL = `
		delete *.log
		delete *.tmp
		delete node_modules when exists package.json
		delete target when exists Cargo.toml
		delete .venv when exists pyproject.toml
	`;
	const largeDSL = `
		# Ignore version control
		ignore .git
		ignore .svn
		skip node_modules
		skip .git

		# Node.js projects
		delete node_modules when exists package.json
		delete .next when exists next.config.js
		delete dist when exists package.json
		delete build when exists package.json

		# Rust projects
		delete target when exists Cargo.toml
		delete target when parent exists Cargo.toml

		# Python projects
		delete .venv when exists pyproject.toml
		delete __pycache__
		delete .pytest_cache
		delete *.pyc

		# Log files
		delete *.log
		delete **/*.tmp
		delete **/*.bak
	`;

	// Benchmark small DSL
	await measureTime(() => {
		for (let i = 0; i < 1000; i++) {
			parseRules(smallDSL);
		}
	}, "parseRules - small DSL (1000 iterations)");

	// Benchmark medium DSL
	await measureTime(() => {
		for (let i = 0; i < 1000; i++) {
			parseRules(mediumDSL);
		}
	}, "parseRules - medium DSL (1000 iterations)");

	// Benchmark large DSL
	await measureTime(() => {
		for (let i = 0; i < 1000; i++) {
			parseRules(largeDSL);
		}
	}, "parseRules - large DSL (1000 iterations)");

	// Test passes as long as it completes without errors
	assert.ok(true, "Benchmark completed successfully");
});

test("Benchmark - findTargets with shallow directory structure", async () => {
	// Create shallow structure: 1 level, 100 files
	const structure = {};
	for (let i = 0; i < 100; i++) {
		structure[`file${i}.txt`] = `content ${i}`;
		structure[`file${i}.log`] = `log ${i}`;
	}
	createStructure(structure);

	const dsl = "delete *.log";

	const { duration } = await measureTime(async () => {
		return await findTargets(dsl, testDir);
	}, "findTargets - shallow structure (100 files)");

	assert.ok(duration < 1000, "Should complete in less than 1 second");
});

test("Benchmark - findTargets with deep directory structure", async () => {
	// Create deep structure: 4 levels, 5 files per level, 3 dirs per level
	createStructure(createDeepStructure(4, 5, 3));

	const dsl = "delete *.log";

	const { duration } = await measureTime(async () => {
		return await findTargets(dsl, testDir);
	}, "findTargets - deep structure (4 levels, 5 files/level, 3 dirs/level)");

	assert.ok(duration < 2000, "Should complete in less than 2 seconds");
});

test("Benchmark - findTargets with skip patterns", async () => {
	// Create structure with directories to skip
	createStructure({
		node_modules: createDeepStructure(3, 10, 5),
		".git": createDeepStructure(2, 5, 3),
		src: {
			"file1.log": "log1",
			"file2.log": "log2",
			"file3.txt": "txt",
		},
	});

	const dsl = `
		skip node_modules
		skip .git
		delete *.log
	`;

	const { duration } = await measureTime(async () => {
		return await findTargets(dsl, testDir);
	}, "findTargets - with skip patterns (should be faster)");

	assert.ok(duration < 1000, "Should complete in less than 1 second with skip patterns");
});

test("Benchmark - findTargets with conditions", async () => {
	// Create structure with condition files
	createStructure({
		project1: {
			"Cargo.toml": "cargo config",
			target: createDeepStructure(3, 5, 2),
		},
		project2: {
			"package.json": "npm config",
			node_modules: createDeepStructure(3, 5, 2),
		},
		project3: {
			"file.txt": "no condition match",
			data: createDeepStructure(2, 3, 2),
		},
	});

	const dsl = `
		delete target when exists Cargo.toml
		delete node_modules when exists package.json
	`;

	const { duration } = await measureTime(async () => {
		return await findTargets(dsl, testDir);
	}, "findTargets - with conditions");

	assert.ok(duration < 2000, "Should complete in less than 2 seconds");
});

test("Benchmark - executeCleanup with multiple files", async () => {
	// Create structure with many files to delete
	const structure = {};
	for (let i = 0; i < 50; i++) {
		structure[`file${i}.log`] = `log ${i}`;
	}
	createStructure(structure);

	const dsl = "delete *.log";

	const { duration } = await measureTime(async () => {
		return await executeCleanup(dsl, testDir);
	}, "executeCleanup - delete 50 files");

	assert.ok(duration < 2000, "Should complete in less than 2 seconds");
});

test("Benchmark - executeCleanup with nested directories", async () => {
	// Create nested structure
	createStructure({
		dir1: {
			subdir1: {
				"file1.log": "log1",
				"file2.log": "log2",
			},
			subdir2: {
				"file3.log": "log3",
			},
		},
		dir2: {
			"file4.log": "log4",
		},
	});

	const dsl = "delete *.log";

	const { duration } = await measureTime(async () => {
		return await executeCleanup(dsl, testDir);
	}, "executeCleanup - nested directories");

	assert.ok(duration < 2000, "Should complete in less than 2 seconds");
});

test("Benchmark - Pattern matching performance with caching", async () => {
	// Create a large structure to test caching benefits
	createStructure(createDeepStructure(4, 8, 4));

	const dsl = `
		ignore .git
		ignore node_modules
		skip build
		delete *.log
		delete *.tmp
	`;

	// First run - cold cache
	const { duration: firstRun } = await measureTime(async () => {
		return await findTargets(dsl, testDir);
	}, "Pattern matching - first run (cold cache)");

	// Second run - warm cache (same evaluator instance benefits from caching)
	const { duration: secondRun } = await measureTime(async () => {
		return await findTargets(dsl, testDir);
	}, "Pattern matching - second run (warm cache)");

	console.log(`[BENCHMARK] Cache speedup: ${((1 - secondRun / firstRun) * 100).toFixed(1)}%`);

	assert.ok(true, "Caching benchmark completed");
});

test("Benchmark - Glob pattern performance", async () => {
	// Create structure with various file types
	const structure = {};
	for (let i = 0; i < 30; i++) {
		structure[`file${i}.log`] = `log ${i}`;
		structure[`file${i}.txt`] = `text ${i}`;
		structure[`file${i}.tmp`] = `tmp ${i}`;
	}
	createStructure(structure);

	// Simple pattern
	const { duration: simplePattern } = await measureTime(async () => {
		return await findTargets("delete *.log", testDir);
	}, "Glob - simple pattern (*.log)");

	// Multiple patterns
	const { duration: multiPattern } = await measureTime(async () => {
		return await findTargets(
			`
			delete *.log
			delete *.tmp
		`,
			testDir
		);
	}, "Glob - multiple patterns");

	console.log(`[BENCHMARK] Simple pattern: ${simplePattern.toFixed(2)}ms, Multiple patterns: ${multiPattern.toFixed(2)}ms`);

	assert.ok(true, "Glob pattern benchmark completed");
});
