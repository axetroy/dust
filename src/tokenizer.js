/**
 * @typedef {Object} Token
 * @property {'keyword' | 'identifier' | 'string' | 'whitespace' | 'newline' | 'comment' | 'eof'} type
 * @property {string} value
 * @property {number} line
 * @property {number} column
 */

const KEYWORDS = new Set(["delete", "ignore", "when", "exists", "and", "not", "here", "parent", "parents", "child", "children", "sibling"]);

/**
 * Tokenizer for the dedust DSL
 * Converts raw text into a stream of tokens
 */
export class Tokenizer {
	/**
	 * @param {string} input - The input DSL text to tokenize
	 */
	constructor(input) {
		this.input = input;
		this.pos = 0;
		this.line = 1;
		this.column = 1;
	}

	/**
	 * Get the current character without advancing
	 * @returns {string | null}
	 */
	peek() {
		if (this.pos >= this.input.length) {
			return null;
		}
		return this.input[this.pos];
	}

	/**
	 * Get the current character and advance position
	 * @returns {string | null}
	 */
	advance() {
		if (this.pos >= this.input.length) {
			return null;
		}
		const char = this.input[this.pos];
		this.pos++;
		if (char === "\n") {
			this.line++;
			this.column = 1;
		} else {
			this.column++;
		}
		return char;
	}

	/**
	 * Skip whitespace characters (except newlines)
	 */
	skipWhitespace() {
		while (this.peek() !== null) {
			const char = this.peek();
			if (char === " " || char === "\t" || char === "\r") {
				this.advance();
			} else {
				break;
			}
		}
	}

	/**
	 * Read a comment line starting with #
	 * @returns {Token}
	 */
	readComment() {
		const line = this.line;
		const column = this.column;
		let value = "";

		// Skip the # character
		this.advance();

		// Read until end of line or end of input
		while (this.peek() !== null && this.peek() !== "\n") {
			value += this.advance();
		}

		return {
			type: "comment",
			value: value.trim(),
			line,
			column,
		};
	}

	/**
	 * Read a quoted string (single or double quotes)
	 * @param {string} quoteChar - The quote character (' or ")
	 * @returns {Token}
	 */
	readQuotedString(quoteChar) {
		const line = this.line;
		const column = this.column;
		let value = "";

		// Skip the opening quote
		this.advance();

		while (this.peek() !== null) {
			const char = this.peek();

			// Check for closing quote
			if (char === quoteChar) {
				this.advance(); // Skip closing quote
				break;
			}

			// Handle escape sequences
			if (char === "\\") {
				this.advance(); // Skip backslash
				const nextChar = this.peek();
				if (nextChar !== null) {
					// Support common escape sequences
					switch (nextChar) {
						case "n":
							value += "\n";
							break;
						case "t":
							value += "\t";
							break;
						case "\\":
							value += "\\";
							break;
						case "'":
							value += "'";
							break;
						case '"':
							value += '"';
							break;
						default:
							// For other cases, keep the character as-is
							value += nextChar;
							break;
					}
					this.advance();
				}
			} else {
				value += this.advance();
			}
		}

		return {
			type: "string",
			value,
			line,
			column,
		};
	}

	/**
	 * Read an identifier or keyword
	 * @returns {Token}
	 */
	readIdentifier() {
		const line = this.line;
		const column = this.column;
		let value = "";

		while (this.peek() !== null) {
			const char = this.peek();
			// Identifier can contain letters, numbers, underscore, dot, hyphen, asterisk, slash
			if (/[a-zA-Z0-9_.\-*/]/.test(char)) {
				value += this.advance();
			} else {
				break;
			}
		}

		const type = KEYWORDS.has(value) ? "keyword" : "identifier";

		return {
			type,
			value,
			line,
			column,
		};
	}

	/**
	 * Tokenize the entire input into an array of tokens
	 * @returns {Token[]}
	 */
	tokenize() {
		const tokens = [];

		while (this.pos < this.input.length) {
			this.skipWhitespace();

			const char = this.peek();

			if (char === null) {
				break;
			}

			// Handle newlines
			if (char === "\n") {
				this.advance();
				continue;
			}

			// Handle comments
			if (char === "#") {
				tokens.push(this.readComment());
				continue;
			}

			// Handle quoted strings
			if (char === '"' || char === "'") {
				tokens.push(this.readQuotedString(char));
				continue;
			}

			// Handle identifiers and keywords
			if (/[a-zA-Z0-9_.*/]/.test(char)) {
				tokens.push(this.readIdentifier());
				continue;
			}

			// Unknown character - skip it
			this.advance();
		}

		// Add EOF token
		tokens.push({
			type: "eof",
			value: "",
			line: this.line,
			column: this.column,
		});

		return tokens;
	}
}

/**
 * Tokenize DSL input text
 * @param {string} input - The DSL text to tokenize
 * @returns {Token[]}
 */
export function tokenize(input) {
	const tokenizer = new Tokenizer(input);
	return tokenizer.tokenize();
}
