import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findTargets, executeCleanup, findTargetsWithEvents, executeCleanupWithEvents } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temporary test directories
const testDir1 = path.join(__dirname, '.test-multi-dir1');
const testDir2 = path.join(__dirname, '.test-multi-dir2');
const testDir3 = path.join(__dirname, '.test-multi-dir3');

/**
 * Create a test directory structure
 * @param {Object} structure - Directory structure as nested object
 * @param {string} baseDir - Base directory to create structure in
 */
function createStructure(structure, baseDir) {
if (!fs.existsSync(baseDir)) {
fs.mkdirSync(baseDir, { recursive: true });
}

for (const [name, content] of Object.entries(structure)) {
const fullPath = path.join(baseDir, name);

if (typeof content === 'object' && content !== null) {
// It's a directory
fs.mkdirSync(fullPath, { recursive: true });
createStructure(content, fullPath);
} else {
// It's a file
fs.writeFileSync(fullPath, content || '', 'utf8');
}
}
}

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

test('Multiple directories - findTargets with array', async () => {
cleanup();
createStructure({
'test.log': 'log1',
'app.log': 'log1',
}, testDir1);

createStructure({
'test.log': 'log2',
'error.log': 'log2',
}, testDir2);

const dsl = 'delete *.log';
const targets = await findTargets(dsl, [testDir1, testDir2]);

assert.strictEqual(targets.length, 4);
assert.ok(targets.some((t) => t.includes('test-multi-dir1') && t.endsWith('test.log')));
assert.ok(targets.some((t) => t.includes('test-multi-dir1') && t.endsWith('app.log')));
assert.ok(targets.some((t) => t.includes('test-multi-dir2') && t.endsWith('test.log')));
assert.ok(targets.some((t) => t.includes('test-multi-dir2') && t.endsWith('error.log')));

cleanup();
});

test('Multiple directories - findTargets with single string (backward compatible)', async () => {
cleanup();
createStructure({
'test.log': 'log',
}, testDir1);

const dsl = 'delete *.log';
const targets = await findTargets(dsl, testDir1);

assert.strictEqual(targets.length, 1);
assert.ok(targets[0].endsWith('test.log'));

cleanup();
});

test('Multiple directories - executeCleanup with array', async () => {
cleanup();
createStructure({
'test.log': 'log1',
}, testDir1);

createStructure({
'test.log': 'log2',
}, testDir2);

const dsl = 'delete *.log';
const result = await executeCleanup(dsl, [testDir1, testDir2]);

assert.strictEqual(result.deleted.length, 2);
assert.strictEqual(result.errors.length, 0);
assert.ok(!fs.existsSync(path.join(testDir1, 'test.log')));
assert.ok(!fs.existsSync(path.join(testDir2, 'test.log')));

cleanup();
});

test('Multiple directories - with conditions', async () => {
cleanup();
createStructure({
'Cargo.toml': '[package]',
target: {},
}, testDir1);

createStructure({
'package.json': '{}',
node_modules: {},
}, testDir2);

createStructure({
'Cargo.toml': '[package]',
target: {},
}, testDir3);

const dsl = 'delete target when exists Cargo.toml';
const targets = await findTargets(dsl, [testDir1, testDir2, testDir3]);

// Should find target in dir1 and dir3, but not dir2
assert.strictEqual(targets.length, 2);
assert.ok(targets.some((t) => t.includes('test-multi-dir1') && t.endsWith('target')));
assert.ok(targets.some((t) => t.includes('test-multi-dir3') && t.endsWith('target')));
assert.ok(!targets.some((t) => t.includes('test-multi-dir2')));

cleanup();
});

test('Multiple directories - findTargetsWithEvents', async () => {
cleanup();
createStructure({
'test.log': 'log1',
}, testDir1);

createStructure({
'test.log': 'log2',
}, testDir2);

const filesFound = [];
let scanStartCount = 0;
let scanCompleteCount = 0;

const dsl = 'delete *.log';
const targets = await findTargetsWithEvents(dsl, [testDir1, testDir2], {
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

assert.strictEqual(targets.length, 2);
assert.strictEqual(filesFound.length, 2);
assert.strictEqual(scanStartCount, 2); // Once per directory
assert.strictEqual(scanCompleteCount, 2); // Once per directory

cleanup();
});

test('Multiple directories - executeCleanupWithEvents', async () => {
cleanup();
createStructure({
'test.log': 'log1',
}, testDir1);

createStructure({
'test.log': 'log2',
}, testDir2);

const filesDeleted = [];

const dsl = 'delete *.log';
const result = await executeCleanupWithEvents(dsl, [testDir1, testDir2], {
onFileDeleted: (data) => {
filesDeleted.push(data.path);
},
});

assert.strictEqual(result.deleted.length, 2);
assert.strictEqual(filesDeleted.length, 2);
assert.ok(!fs.existsSync(path.join(testDir1, 'test.log')));
assert.ok(!fs.existsSync(path.join(testDir2, 'test.log')));

cleanup();
});

test('Multiple directories - empty array', async () => {
const dsl = 'delete *.log';
const targets = await findTargets(dsl, []);

assert.strictEqual(targets.length, 0);
});

test('Multiple directories - three directories', async () => {
cleanup();
createStructure({
'file1.log': 'log',
}, testDir1);

createStructure({
'file2.log': 'log',
}, testDir2);

createStructure({
'file3.log': 'log',
}, testDir3);

const dsl = 'delete *.log';
const targets = await findTargets(dsl, [testDir1, testDir2, testDir3]);

assert.strictEqual(targets.length, 3);

cleanup();
});
