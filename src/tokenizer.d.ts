/**
 * Token type enumeration
 */
export type TokenType = "keyword" | "identifier" | "string" | "whitespace" | "newline" | "comment" | "eof";

/**
 * Represents a token in the DSL
 */
export interface Token {
	/** The type of token */
	type: TokenType;
	/** The token value */
	value: string;
	/** Line number where token appears */
	line: number;
	/** Column number where token appears */
	column: number;
}

/**
 * Tokenizer class for parsing DSL text into tokens
 */
export class Tokenizer {
	/**
	 * Create a new tokenizer
	 * @param input - The DSL text to tokenize
	 */
	constructor(input: string);

	/**
	 * Peek at current character without advancing
	 */
	peek(): string | null;

	/**
	 * Get current character and advance position
	 */
	advance(): string | null;

	/**
	 * Skip whitespace characters (except newlines)
	 */
	skipWhitespace(): void;

	/**
	 * Read a comment line starting with #
	 */
	readComment(): Token;

	/**
	 * Read an identifier or keyword
	 */
	readIdentifier(): Token;

	/**
	 * Tokenize the entire input into an array of tokens
	 */
	tokenize(): Token[];
}

/**
 * Tokenize DSL input text
 * @param input - The DSL text to tokenize
 * @returns Array of tokens
 */
export function tokenize(input: string): Token[];
