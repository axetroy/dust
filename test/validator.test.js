import test from "node:test";
import assert from "node:assert";
import { validateRule, validateRules, isDangerousPattern, ValidationError } from "../src/validator.js";
import { parse } from "../src/parser.js";
import { tokenize } from "../src/tokenizer.js";

// Helper to parse rules for tests
function parseRules(input) {
	const tokens = tokenize(input);
	return parse(tokens);
}

test("Validator - isDangerousPattern detects dangerous patterns", () => {
	// Dangerous patterns
	assert.strictEqual(isDangerousPattern("*"), true, "* should be dangerous");
	assert.strictEqual(isDangerousPattern("**"), true, "** should be dangerous");
	assert.strictEqual(isDangerousPattern("*.*"), true, "*.* should be dangerous");
	assert.strictEqual(isDangerousPattern("**/*"), true, "**/* should be dangerous");
	assert.strictEqual(isDangerousPattern("**/*.*"), true, "**/*.* should be dangerous");

	// Safe patterns
	assert.strictEqual(isDangerousPattern("*.log"), false, "*.log should be safe");
	assert.strictEqual(isDangerousPattern("target"), false, "target should be safe");
	assert.strictEqual(isDangerousPattern("node_modules"), false, "node_modules should be safe");
	assert.strictEqual(isDangerousPattern("**/*.tmp"), false, "**/*.tmp should be safe");
	assert.strictEqual(isDangerousPattern("src/**"), false, "src/** should be safe");
});

test("Validator - validateRule accepts delete with condition", () => {
	const rule = {
		action: "delete",
		target: "*",
		condition: {
			type: "predicate",
			left: null,
			right: null,
			predicate: {
				type: "exists",
				location: "here",
				pattern: "Cargo.toml",
				negated: null,
			},
		},
	};

	const result = validateRule(rule);
	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.error, null);
});

test("Validator - validateRule rejects dangerous delete without condition", () => {
	const rule = {
		action: "delete",
		target: "*",
		condition: null,
	};

	const result = validateRule(rule);
	assert.strictEqual(result.valid, false);
	assert.ok(result.error.includes("Dangerous pattern detected"));
	assert.ok(result.error.includes("delete *"));
});

test("Validator - validateRule accepts safe patterns without condition", () => {
	const rule = {
		action: "delete",
		target: "*.log",
		condition: null,
	};

	const result = validateRule(rule);
	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.error, null);
});

test("Validator - validateRule accepts ignore rules", () => {
	const rule = {
		action: "ignore",
		target: "*",
		condition: null,
	};

	const result = validateRule(rule);
	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.error, null);
});

test("Validator - validateRules accepts safe rules", () => {
	const rules = [
		{
			action: "delete",
			target: "*.log",
			condition: null,
		},
		{
			action: "delete",
			target: "target",
			condition: {
				type: "predicate",
				left: null,
				right: null,
				predicate: {
					type: "exists",
					location: "here",
					pattern: "Cargo.toml",
					negated: null,
				},
			},
		},
		{
			action: "ignore",
			target: ".git",
			condition: null,
		},
	];

	const result = validateRules(rules);
	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.errors.length, 0);
});

test("Validator - validateRules rejects dangerous rules", () => {
	const rules = [
		{
			action: "delete",
			target: "*.log",
			condition: null,
		},
		{
			action: "delete",
			target: "*",
			condition: null,
		},
		{
			action: "delete",
			target: "**",
			condition: null,
		},
	];

	const result = validateRules(rules);
	assert.strictEqual(result.valid, false);
	assert.strictEqual(result.errors.length, 2); // Two dangerous rules
	assert.ok(result.errors[0].error.includes("delete *"));
	assert.ok(result.errors[1].error.includes("delete **"));
});

test("Validator - ValidationError contains validation errors", () => {
	const validationErrors = [
		{
			rule: { action: "delete", target: "*", condition: null },
			error: "Dangerous pattern detected: 'delete *' without any condition.",
		},
	];

	const error = new ValidationError("Validation failed", validationErrors);

	assert.strictEqual(error.name, "ValidationError");
	assert.strictEqual(error.message, "Validation failed");
	assert.strictEqual(error.validationErrors.length, 1);
	assert.strictEqual(error.validationErrors[0].error, validationErrors[0].error);
});

test("Validator - Integration with parseRules (safe patterns)", () => {
	const dsl = `
		delete *.log
		delete target when exists Cargo.toml
		delete node_modules when exists package.json
		ignore .git
	`;

	const rules = parseRules(dsl);
	const result = validateRules(rules);

	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.errors.length, 0);
});

test("Validator - Integration with parseRules (dangerous pattern)", () => {
	const dsl = "delete *";

	const rules = parseRules(dsl);
	const result = validateRules(rules);

	assert.strictEqual(result.valid, false);
	assert.strictEqual(result.errors.length, 1);
	assert.ok(result.errors[0].error.includes("Dangerous pattern detected"));
});

test("Validator - Integration with parseRules (dangerous pattern with condition is safe)", () => {
	const dsl = "delete * when exists Cargo.toml";

	const rules = parseRules(dsl);
	const result = validateRules(rules);

	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.errors.length, 0);
});

test("Validator - Multiple dangerous patterns", () => {
	const dsl = `
		delete *
		delete **
		delete *.*
		delete **/*
	`;

	const rules = parseRules(dsl);
	const result = validateRules(rules);

	assert.strictEqual(result.valid, false);
	assert.strictEqual(result.errors.length, 4); // All four are dangerous
});

test("Validator - Mixed safe and dangerous patterns", () => {
	const dsl = `
		delete *.log
		delete *
		delete target when exists Cargo.toml
		delete **
		ignore .git
	`;

	const rules = parseRules(dsl);
	const result = validateRules(rules);

	assert.strictEqual(result.valid, false);
	assert.strictEqual(result.errors.length, 2); // Only the dangerous ones
	assert.ok(result.errors.some((e) => e.error.includes("delete *")));
	assert.ok(result.errors.some((e) => e.error.includes("delete **")));
});
