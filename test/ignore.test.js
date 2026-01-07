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
const testDir = path.join(__dirname, ".test-tmp-ignore");

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

test("Ignore - simple ignore pattern", async () => {
	createStructure({
		".git": {
			config: "git config",
			HEAD: "ref: refs/heads/main",
		},
		"test.log": "log content",
		"app.log": "app log",
	});

	const dsl = "delete *";
	const result = await dedust(dsl, testDir, { ignore: [".git"], skipValidation: true  });
	const targets = result.targets;

	// Should find .log files but not .git
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("app.log")));
	assert.ok(!targets.some((t) => t.includes(".git")));
});

test("Ignore - ignore with glob pattern", async () => {
	createStructure({
		"file1.log": "log 1",
		"file2.log": "log 2",
		"important.log": "important",
		"readme.txt": "readme",
	});

	const dsl = "delete *.log";
	const result = await dedust(dsl, testDir, { ignore: ["important.*"]  });
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.ok(targets.some((t) => t.endsWith("file1.log")));
	assert.ok(targets.some((t) => t.endsWith("file2.log")));
	assert.ok(!targets.some((t) => t.endsWith("important.log")));
});

test("Ignore - ignore nested directories", async () => {
	createStructure({
		node_modules: {
			package1: {
				"index.js": "code",
			},
			package2: {
				"index.js": "code",
			},
		},
		src: {
			"app.js": "app code",
		},
	});

	const dsl = "delete **/*.js";
	const result = await dedust(dsl, testDir, { ignore: ["node_modules/**"]  });
	const targets = result.targets;

	// Should find src/app.js but not node_modules files
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].endsWith(path.join("src", "app.js")));
});

test("Ignore - multiple ignore patterns", async () => {
	createStructure({
		".git": {
			config: "git config",
		},
		".svn": {
			config: "svn config",
		},
		data: {
			"file.txt": "data",
		},
		"test.log": "log",
	});

	const dsl = "delete *";
	const result = await dedust(dsl, testDir, { ignore: [".git", ".svn"], skipValidation: true  });
	const targets = result.targets;

	// Should find data and test.log but not .git or .svn
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("data")));
	assert.ok(!targets.some((t) => t.includes(".git")));
	assert.ok(!targets.some((t) => t.includes(".svn")));
});

test("Ignore - execute respects ignore patterns", async () => {
	createStructure({
		".git": {
			config: "git config",
		},
		build: {
			"output.js": "compiled",
		},
		"temp.log": "temp",
	});

	const dsl = "delete *";
	const scan = await dedust(dsl, testDir, { ignore: [".git"], skipValidation: true });
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 3);
	assert.strictEqual(result.errors.length, 0);

	// .git should still exist
	assert.ok(fs.existsSync(path.join(testDir, ".git")));
	assert.ok(fs.existsSync(path.join(testDir, ".git", "config")));

	// Other files should be deleted
	assert.ok(!fs.existsSync(path.join(testDir, "build")));
	assert.ok(!fs.existsSync(path.join(testDir, "temp.log")));
});

test("Ignore - ignore with relative path patterns", async () => {
	createStructure({
		project: {
			".git": {
				config: "git config",
			},
			src: {
				"app.js": "code",
			},
			dist: {
				"bundle.js": "compiled",
			},
		},
	});

	const dsl = "delete **/*";
	const projectDir = path.join(testDir, "project");
	const result = await dedust(dsl, projectDir, { ignore: [".git/**", "src/**"], skipValidation: true  });
	const targets = result.targets;

	// Should find dist files but not .git or src
	assert.ok(targets.some((t) => t.includes("dist")));
	assert.ok(!targets.some((t) => t.includes(".git")));
	assert.ok(!targets.some((t) => t.includes(path.join("src", "app.js"))));
});

test("Ignore - ignore pattern with dot files", async () => {
	createStructure({
		".env": "secret",
		".env.local": "local secret",
		".gitignore": "*.log",
		"app.js": "code",
	});

	const dsl = "delete .*";
	const result = await dedust(dsl, testDir, { ignore: [".env*"]  });
	const targets = result.targets;

	// Should find .gitignore but not .env files
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].endsWith(".gitignore"));
});

test("Ignore - no ignore patterns", async () => {
	createStructure({
		"file1.txt": "content 1",
		"file2.txt": "content 2",
	});

	const dsl = "delete *.txt";
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
});

test("Ignore - empty ignore array", async () => {
	createStructure({
		"file1.txt": "content 1",
		"file2.txt": "content 2",
	});

	const dsl = "delete *.txt";
	const result = await dedust(dsl, testDir, { ignore: []  });
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
});

test("Ignore - ignore directory prevents descending", async () => {
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

	const dsl = "delete **/*.txt";
	const result = await dedust(dsl, testDir, { ignore: ["large_dir"]  });
	const targets = result.targets;

	// Should only find file3.txt
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].endsWith(path.join("small_dir", "file3.txt")));
});

test("DSL Ignore - simple ignore in DSL", async () => {
	createStructure({
		".git": {
			config: "git config",
		},
		"test.log": "log content",
		"app.log": "app log",
	});

	const dsl = `
		ignore .git
		delete *
	`;
	const result = await dedust(dsl, testDir, { skipValidation: true  });
	const targets = result.targets;

	// Should find .log files but not .git
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("app.log")));
	assert.ok(!targets.some((t) => t.includes(".git")));
});

test("DSL Ignore - multiple ignore rules in DSL", async () => {
	createStructure({
		".git": {
			config: "git config",
		},
		".svn": {
			config: "svn config",
		},
		data: {
			"file.txt": "data",
		},
		"test.log": "log",
	});

	const dsl = `
		ignore .git
		ignore .svn
		delete *
	`;
	const result = await dedust(dsl, testDir, { skipValidation: true  });
	const targets = result.targets;

	// Should find data and test.log but not .git or .svn
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("data")));
	assert.ok(!targets.some((t) => t.includes(".git")));
	assert.ok(!targets.some((t) => t.includes(".svn")));
});

test("DSL Ignore - ignore with glob patterns", async () => {
	createStructure({
		"important.log": "important",
		"test.log": "test",
		"app.log": "app",
		"readme.txt": "readme",
	});

	const dsl = `
		ignore important.*
		delete *.log
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	assert.strictEqual(targets.length, 2);
	assert.ok(targets.some((t) => t.endsWith("test.log")));
	assert.ok(targets.some((t) => t.endsWith("app.log")));
	assert.ok(!targets.some((t) => t.endsWith("important.log")));
});

test("DSL Ignore - ignore nested directories", async () => {
	createStructure({
		node_modules: {
			package1: {
				"index.js": "code",
			},
		},
		src: {
			"app.js": "code",
		},
	});

	const dsl = `
		ignore node_modules/**
		delete **/*.js
	`;
	const result = await dedust(dsl, testDir);
	const targets = result.targets;

	// Should only find src/app.js
	assert.strictEqual(targets.length, 1);
	assert.ok(targets[0].endsWith(path.join("src", "app.js")));
});

test("DSL Ignore - combined DSL and API ignore", async () => {
	createStructure({
		".git": {
			config: "git config",
		},
		node_modules: {
			package: {
				"index.js": "code",
			},
		},
		src: {
			"app.js": "code",
		},
	});

	const dsl = `
		ignore .git
		delete **/*
	`;
	const result = await dedust(dsl, testDir, { ignore: ["node_modules/**"], skipValidation: true  });
	const targets = result.targets;

	// Should only find src directory and files
	assert.ok(targets.some((t) => t.includes("src")));
	assert.ok(!targets.some((t) => t.includes(".git")));
	assert.ok(!targets.some((t) => t.includes("node_modules")));
});

test("DSL Ignore - execute with DSL ignore", async () => {
	createStructure({
		".git": {
			config: "git config",
		},
		build: {
			"output.js": "compiled",
		},
		"temp.log": "temp",
	});

	const dsl = `
		ignore .git
		delete *
	`;
	const scan = await dedust(dsl, testDir, { skipValidation: true });
	const result = await scan.execute();

	assert.strictEqual(result.deleted.length, 3);
	assert.strictEqual(result.errors.length, 0);

	// .git should still exist
	assert.ok(fs.existsSync(path.join(testDir, ".git")));
	assert.ok(fs.existsSync(path.join(testDir, ".git", "config")));

	// Other files should be deleted
	assert.ok(!fs.existsSync(path.join(testDir, "build")));
	assert.ok(!fs.existsSync(path.join(testDir, "temp.log")));
});
