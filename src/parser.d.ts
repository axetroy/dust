import { Token } from "./tokenizer.js";

/**
 * Action types supported by the DSL
 */
export type ActionType = "delete" | "ignore" | "skip";

/**
 * Location modifiers for condition predicates
 */
export type LocationType = "here" | "parent" | "parents" | "child" | "children" | "sibling";

/**
 * Represents a DSL rule
 */
export interface Rule {
	/** The action to perform */
	action: ActionType;
	/** The target pattern (glob) */
	target: string;
	/** Optional condition for the rule */
	condition: Condition | null;
}

/**
 * Represents a condition in a rule
 */
export interface Condition {
	/** Condition type */
	type: "and" | "predicate";
	/** Left predicate for 'and' conditions */
	left: Predicate | null;
	/** Right predicate for 'and' conditions */
	right: Predicate | null;
	/** Single predicate for 'predicate' type */
	predicate: Predicate | null;
}

/**
 * Represents a predicate (exists or not)
 */
export interface Predicate {
	/** Predicate type */
	type: "exists" | "not";
	/** Location modifier for 'exists' */
	location: LocationType;
	/** Pattern for 'exists' */
	pattern: string | null;
	/** Negated predicate for 'not' */
	negated: Predicate | null;
}

/**
 * Parser class for converting tokens into an AST
 */
export class Parser {
	/**
	 * Create a new parser
	 * @param tokens - Array of tokens to parse
	 */
	constructor(tokens: Token[]);

	/**
	 * Get current token without advancing
	 */
	peek(): Token;

	/**
	 * Get current token and advance
	 */
	advance(): Token;

	/**
	 * Check if current token matches expected value
	 */
	match(value: string): boolean;

	/**
	 * Consume a token with expected value or throw error
	 */
	expect(value: string): Token;

	/**
	 * Parse a location modifier
	 */
	parseLocation(): LocationType;

	/**
	 * Parse a predicate (exists or not)
	 */
	parsePredicate(): Predicate;

	/**
	 * Parse a condition (predicate with optional 'and' chains)
	 */
	parseCondition(): Condition;

	/**
	 * Parse a single rule
	 */
	parseRule(): Rule | null;

	/**
	 * Parse all rules from tokens
	 */
	parse(): Rule[];
}

/**
 * Parse DSL tokens into rules
 * @param tokens - Array of tokens
 * @returns Array of parsed rules
 */
export function parse(tokens: Token[]): Rule[];
