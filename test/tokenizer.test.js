import test from "node:test";
import assert from "node:assert";
import { tokenize, Tokenizer } from "../src/tokenizer.js";

test("Tokenizer - simple delete rule", () => {
	const input = "delete target";
	const tokens = tokenize(input);

	assert.strictEqual(tokens.length, 3); // delete, target, eof
	assert.deepStrictEqual(tokens[0], {
		type: "keyword",
		value: "delete",
		line: 1,
		column: 1,
	});
	assert.deepStrictEqual(tokens[1], {
		type: "identifier",
		value: "target",
		line: 1,
		column: 8,
	});
	assert.strictEqual(tokens[2].type, "eof");
});

test("Tokenizer - delete with condition", () => {
	const input = "delete target when exists Cargo.toml";
	const tokens = tokenize(input);

	assert.strictEqual(tokens.length, 6); // delete, target, when, exists, Cargo.toml, eof

	const values = tokens.map((t) => t.value);
	assert.deepStrictEqual(values, ["delete", "target", "when", "exists", "Cargo.toml", ""]);
});

test("Tokenizer - with glob patterns", () => {
	const input = "delete *.log";
	const tokens = tokenize(input);

	assert.strictEqual(tokens[1].value, "*.log");
	assert.strictEqual(tokens[1].type, "identifier");
});

test("Tokenizer - with double star glob", () => {
	const input = "delete **/*.tmp";
	const tokens = tokenize(input);

	assert.strictEqual(tokens[1].value, "**/*.tmp");
});

test("Tokenizer - with location modifier", () => {
	const input = "delete target when parent exists Cargo.toml";
	const tokens = tokenize(input);

	const values = tokens.slice(0, -1).map((t) => t.value);
	assert.deepStrictEqual(values, ["delete", "target", "when", "parent", "exists", "Cargo.toml"]);
});

test("Tokenizer - with AND condition", () => {
	const input = "delete target when exists Cargo.toml and exists src";
	const tokens = tokenize(input);

	const values = tokens.slice(0, -1).map((t) => t.value);
	assert.deepStrictEqual(values, ["delete", "target", "when", "exists", "Cargo.toml", "and", "exists", "src"]);
});

test("Tokenizer - with NOT condition", () => {
	const input = "delete target when exists Cargo.toml and not exists keep.txt";
	const tokens = tokenize(input);

	const values = tokens.slice(0, -1).map((t) => t.value);
	assert.deepStrictEqual(values, ["delete", "target", "when", "exists", "Cargo.toml", "and", "not", "exists", "keep.txt"]);
});

test("Tokenizer - with comments", () => {
	const input = "# This is a comment\ndelete target";
	const tokens = tokenize(input);

	assert.strictEqual(tokens[0].type, "comment");
	assert.strictEqual(tokens[0].value, "This is a comment");
	assert.strictEqual(tokens[1].value, "delete");
});

test("Tokenizer - multiple rules", () => {
	const input = `delete target
delete node_modules`;
	const tokens = tokenize(input);

	const keywords = tokens.filter((t) => t.type === "keyword");
	assert.strictEqual(keywords.length, 2);
	assert.strictEqual(keywords[0].value, "delete");
	assert.strictEqual(keywords[1].value, "delete");
});

test("Tokenizer - all location types", () => {
	const locations = ["here", "parent", "parents", "child", "children", "sibling"];

	for (const loc of locations) {
		const input = `delete target when ${loc} exists file.txt`;
		const tokens = tokenize(input);
		const locToken = tokens.find((t) => t.value === loc);

		assert.ok(locToken, `Location '${loc}' should be tokenized`);
		assert.strictEqual(locToken.type, "keyword");
	}
});

test("Tokenizer - empty input", () => {
	const input = "";
	const tokens = tokenize(input);

	assert.strictEqual(tokens.length, 1);
	assert.strictEqual(tokens[0].type, "eof");
});

test("Tokenizer - whitespace handling", () => {
	const input = "  delete   target  ";
	const tokens = tokenize(input);

	assert.strictEqual(tokens.length, 3); // delete, target, eof
	assert.strictEqual(tokens[0].value, "delete");
	assert.strictEqual(tokens[1].value, "target");
});

test("Tokenizer - line and column tracking", () => {
	const input = "delete target\ndelete files";
	const tokens = tokenize(input);

	// First delete
	assert.strictEqual(tokens[0].line, 1);
	assert.strictEqual(tokens[0].column, 1);

	// Second delete
	assert.strictEqual(tokens[2].line, 2);
	assert.strictEqual(tokens[2].column, 1);
});

test("Tokenizer - quoted string with double quotes", () => {
const input = 'delete "My Documents"';
const tokens = tokenize(input);

assert.strictEqual(tokens.length, 3); // delete, "My Documents", eof
assert.strictEqual(tokens[0].value, "delete");
assert.strictEqual(tokens[1].type, "string");
assert.strictEqual(tokens[1].value, "My Documents");
});

test("Tokenizer - quoted string with single quotes", () => {
const input = "delete 'Program Files'";
const tokens = tokenize(input);

assert.strictEqual(tokens.length, 3); // delete, 'Program Files', eof
assert.strictEqual(tokens[0].value, "delete");
assert.strictEqual(tokens[1].type, "string");
assert.strictEqual(tokens[1].value, "Program Files");
});

test("Tokenizer - quoted string with escape sequences", () => {
const input = 'delete "file\\twith\\ttabs"';
const tokens = tokenize(input);

assert.strictEqual(tokens[1].type, "string");
assert.strictEqual(tokens[1].value, "file\twith\ttabs");
});

test("Tokenizer - quoted string with escaped quotes", () => {
const input = 'delete "file\\"with\\"quotes"';
const tokens = tokenize(input);

assert.strictEqual(tokens[1].type, "string");
assert.strictEqual(tokens[1].value, 'file"with"quotes');
});

test("Tokenizer - condition with quoted pattern", () => {
const input = 'delete target when exists "package.json"';
const tokens = tokenize(input);

const values = tokens.slice(0, -1).map((t) => t.value);
assert.deepStrictEqual(values, ["delete", "target", "when", "exists", "package.json"]);
assert.strictEqual(tokens[4].type, "string");
});

test("Tokenizer - quoted pattern with glob", () => {
const input = 'delete "*.log files"';
const tokens = tokenize(input);

assert.strictEqual(tokens[1].type, "string");
assert.strictEqual(tokens[1].value, "*.log files");
});
