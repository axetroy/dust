import test from "node:test";
import assert from "node:assert";
import { tokenize } from "../src/tokenizer.js";
import { parse } from "../src/parser.js";

test("Parser - simple delete rule", () => {
	const input = "delete target";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules.length, 1);
	assert.strictEqual(rules[0].action, "delete");
	assert.strictEqual(rules[0].target, "target");
	assert.strictEqual(rules[0].condition, null);
});

test("Parser - delete with exists condition", () => {
	const input = "delete target when exists Cargo.toml";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules.length, 1);
	assert.strictEqual(rules[0].action, "delete");
	assert.strictEqual(rules[0].target, "target");
	assert.ok(rules[0].condition);
	assert.strictEqual(rules[0].condition.type, "predicate");
	assert.strictEqual(rules[0].condition.predicate?.type, "exists");
	assert.strictEqual(rules[0].condition.predicate?.pattern, "Cargo.toml");
	assert.strictEqual(rules[0].condition.predicate?.location, "here");
});

test("Parser - with location modifier", () => {
	const input = "delete target when parent exists Cargo.toml";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules[0].condition?.predicate?.location, "parent");
	assert.strictEqual(rules[0].condition?.predicate?.pattern, "Cargo.toml");
});

test("Parser - all location types", () => {
	const locations = ["here", "parent", "parents", "child", "children", "sibling"];

	for (const loc of locations) {
		const input = `delete target when ${loc} exists file.txt`;
		const tokens = tokenize(input);
		const rules = parse(tokens);

		assert.strictEqual(rules[0].condition?.predicate?.location, loc);
	}
});

test("Parser - with AND condition", () => {
	const input = "delete target when exists Cargo.toml and exists src";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules[0].condition?.type, "and");
	assert.ok(rules[0].condition?.left);
	assert.ok(rules[0].condition?.right);
	assert.strictEqual(rules[0].condition?.left?.type, "exists");
	assert.strictEqual(rules[0].condition?.left?.pattern, "Cargo.toml");
	assert.strictEqual(rules[0].condition?.right?.type, "exists");
	assert.strictEqual(rules[0].condition?.right?.pattern, "src");
});

test("Parser - with NOT condition", () => {
	const input = "delete target when not exists keep.txt";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules[0].condition?.predicate?.type, "not");
	assert.strictEqual(rules[0].condition?.predicate?.negated?.type, "exists");
	assert.strictEqual(rules[0].condition?.predicate?.negated?.pattern, "keep.txt");
});

test("Parser - with AND and NOT", () => {
	const input = "delete target when exists Cargo.toml and not exists keep.txt";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules[0].condition?.type, "and");
	assert.strictEqual(rules[0].condition?.left?.type, "exists");
	assert.strictEqual(rules[0].condition?.right?.type, "not");
	assert.strictEqual(rules[0].condition?.right?.negated?.pattern, "keep.txt");
});

test("Parser - with glob patterns", () => {
	const patterns = ["*.log", "**/*.tmp", "node_modules", "target", ".venv"];

	for (const pattern of patterns) {
		const input = `delete ${pattern}`;
		const tokens = tokenize(input);
		const rules = parse(tokens);

		assert.strictEqual(rules[0].target, pattern);
	}
});

test("Parser - multiple rules", () => {
	const input = `delete target when exists Cargo.toml
delete node_modules when exists package.json`;
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules.length, 2);
	assert.strictEqual(rules[0].target, "target");
	assert.strictEqual(rules[1].target, "node_modules");
});

test("Parser - with comments ignored", () => {
	const input = `# Rust projects
delete target when exists Cargo.toml
# Node projects
delete node_modules when exists package.json`;
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules.length, 2);
});

test("Parser - without condition", () => {
	const input = "delete *.log";
	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules[0].condition, null);
	assert.strictEqual(rules[0].target, "*.log");
});

test("Parser - complex example from spec", () => {
	const input = `delete target when exists Cargo.toml
delete target when parent exists Cargo.toml
delete node_modules when exists package.json
delete .venv when exists pyproject.toml
delete *.log
delete **/*.tmp when parents exists .git`;

	const tokens = tokenize(input);
	const rules = parse(tokens);

	assert.strictEqual(rules.length, 6);

	// First rule
	assert.strictEqual(rules[0].target, "target");
	assert.strictEqual(rules[0].condition?.predicate?.location, "here");

	// Second rule
	assert.strictEqual(rules[1].target, "target");
	assert.strictEqual(rules[1].condition?.predicate?.location, "parent");

	// Third rule
	assert.strictEqual(rules[2].target, "node_modules");
	assert.strictEqual(rules[2].condition?.predicate?.pattern, "package.json");

	// Fourth rule
	assert.strictEqual(rules[3].target, ".venv");
	assert.strictEqual(rules[3].condition?.predicate?.pattern, "pyproject.toml");

	// Fifth rule (no condition)
	assert.strictEqual(rules[4].target, "*.log");
	assert.strictEqual(rules[4].condition, null);

	// Sixth rule
	assert.strictEqual(rules[5].target, "**/*.tmp");
	assert.strictEqual(rules[5].condition?.predicate?.location, "parents");
	assert.strictEqual(rules[5].condition?.predicate?.pattern, ".git");
});

test("Parser - error on missing target", () => {
	const input = "delete";
	const tokens = tokenize(input);

	assert.throws(() => {
		parse(tokens);
	}, /Expected target pattern/);
});

test("Parser - error on missing exists", () => {
	const input = "delete target when Cargo.toml";
	const tokens = tokenize(input);

	assert.throws(() => {
		parse(tokens);
	}, /Expected 'exists'/);
});

test("Parser - error on invalid action", () => {
	const input = "create target";
	const tokens = tokenize(input);

	assert.throws(() => {
		parse(tokens);
	}, /Expected 'delete' action/);
});

test("Parser - quoted string as target", () => {
const input = 'delete "My Documents"';
const tokens = tokenize(input);
const rules = parse(tokens);

assert.strictEqual(rules.length, 1);
assert.strictEqual(rules[0].action, "delete");
assert.strictEqual(rules[0].target, "My Documents");
assert.strictEqual(rules[0].condition, null);
});

test("Parser - quoted string in condition", () => {
const input = 'delete target when exists "My File.txt"';
const tokens = tokenize(input);
const rules = parse(tokens);

assert.strictEqual(rules[0].condition?.predicate?.pattern, "My File.txt");
});

test("Parser - both target and pattern quoted", () => {
const input = 'delete "Program Files" when exists "*.dll"';
const tokens = tokenize(input);
const rules = parse(tokens);

assert.strictEqual(rules[0].target, "Program Files");
assert.strictEqual(rules[0].condition?.predicate?.pattern, "*.dll");
});
