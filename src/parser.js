/**
 * @typedef {import("./parser.js").Rule} Rule
 * @typedef {import("./parser.js").Condition} Condition
 * @typedef {import("./parser.js").Predicate} Predicate
 * @typedef {import("./tokenizer.js").Token} Token
 * @typedef {import("./parser.js").ActionType} ActionType
 * @typedef {import("./parser.js").LocationType} LocationType
 */

/**
 * Parser for the dedust DSL
 * Converts tokens into an Abstract Syntax Tree (AST)
 */
export class Parser {
	/**
	 * @param {Token[]} tokens
	 */
	constructor(tokens) {
		this.tokens = tokens.filter((t) => t.type !== "comment");
		this.pos = 0;
	}

	/**
	 * Get current token without advancing
	 * @returns {Token}
	 */
	peek() {
		return this.tokens[this.pos];
	}

	/**
	 * Get current token and advance
	 * @returns {Token}
	 */
	advance() {
		return this.tokens[this.pos++];
	}

	/**
	 * Check if current token matches expected value
	 * @param {string} value
	 * @returns {boolean}
	 */
	match(value) {
		return this.peek()?.value === value;
	}

	/**
	 * Consume a token with expected value or throw error
	 * @param {string} value
	 * @returns {Token}
	 */
	expect(value) {
		const token = this.peek();
		if (token?.value !== value) {
			throw new Error(`Expected '${value}' but got '${token?.value}' at line ${token?.line}, column ${token?.column}`);
		}
		return this.advance();
	}

	/**
	 * Parse a location modifier
	 * @returns {LocationType}
	 */
	parseLocation() {
		const token = this.peek();
		if (token?.type === "keyword" && ["here", "parent", "parents", "child", "children", "sibling"].includes(token.value)) {
			this.advance();
			return /** @type {LocationType} */ (token.value);
		}
		// Default location is 'here'
		return "here";
	}

	/**
	 * Parse a predicate (exists or not)
	 * @returns {Predicate}
	 */
	parsePredicate() {
		// Check for 'not'
		if (this.match("not")) {
			this.advance();
			const negated = this.parsePredicate();
			return {
				type: "not",
				location: "here",
				pattern: null,
				negated,
			};
		}

		// Parse location modifier (optional)
		const location = this.parseLocation();

		// Expect 'exists'
		this.expect("exists");

		// Parse pattern
		const patternToken = this.peek();
		if (patternToken?.type !== "identifier" && patternToken?.type !== "string") {
			throw new Error(`Expected pattern after 'exists' at line ${patternToken?.line}, column ${patternToken?.column}`);
		}
		const pattern = this.advance().value;

		return {
			type: "exists",
			location,
			pattern,
			negated: null,
		};
	}

	/**
	 * Parse a condition (predicate with optional 'and' chains)
	 * @returns {Condition}
	 */
	parseCondition() {
		const predicates = [this.parsePredicate()];

		// Collect all 'and' chained predicates
		while (this.match("and")) {
			this.advance();
			predicates.push(this.parsePredicate());
		}

		// Single predicate
		if (predicates.length === 1) {
			return {
				type: "predicate",
				left: null,
				right: null,
				predicate: predicates[0],
			};
		}

		// Multiple predicates - chain them with 'and'
		// Build from right to left: (a AND (b AND c))
		let condition = {
			type: "and",
			left: predicates[predicates.length - 2],
			right: predicates[predicates.length - 1],
			predicate: null,
		};

		for (let i = predicates.length - 3; i >= 0; i--) {
			condition = {
				type: "and",
				left: predicates[i],
				right: /** @type {Predicate} */ (/** @type {unknown} */ (condition)),
				predicate: null,
			};
		}

		return condition;
	}

	/**
	 * Parse a single rule
	 * @returns {Rule | null}
	 */
	parseRule() {
		const token = this.peek();

		// Skip EOF
		if (token?.type === "eof") {
			return null;
		}

		// Parse action ('delete', 'ignore', or 'skip')
		if (!this.match("delete") && !this.match("ignore") && !this.match("skip")) {
			throw new Error(`Expected 'delete', 'ignore', or 'skip' action at line ${token?.line}, column ${token?.column}`);
		}
		const actionToken = this.advance();
		const action = /** @type {ActionType} */ (actionToken.value);

		// Parse target
		const targetToken = this.peek();
		if (targetToken?.type !== "identifier" && targetToken?.type !== "string") {
			throw new Error(`Expected target pattern at line ${targetToken?.line}, column ${targetToken?.column}`);
		}
		const target = this.advance().value;

		// Parse optional condition (only delete rules support conditions)
		// Note: skip and ignore actions do not support conditions
		let condition = null;
		if (action === "delete" && this.match("when")) {
			this.advance();
			condition = this.parseCondition();
		}

		return {
			action,
			target,
			condition,
		};
	}

	/**
	 * Parse all rules from tokens
	 * @returns {Rule[]}
	 */
	parse() {
		const rules = [];

		while (this.peek()?.type !== "eof") {
			const rule = this.parseRule();
			if (rule) {
				rules.push(rule);
			}
		}

		return rules;
	}
}

/**
 * Parse DSL tokens into rules
 * @param {Token[]} tokens
 * @returns {Rule[]}
 */
export function parse(tokens) {
	const parser = new Parser(tokens);
	return parser.parse();
}
