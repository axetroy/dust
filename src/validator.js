/**
 * @typedef {import('./parser.js').Rule} Rule
 */

/**
 * Dangerous patterns that can cause unintended mass deletion
 * These patterns are considered unsafe when used without conditions
 */
const DANGEROUS_PATTERNS = [
	"*", // All files in current directory
	"**", // All files recursively
	"*.*", // All files with extensions
	"**/*", // All files in all subdirectories
];

/**
 * Check if a pattern is potentially dangerous
 * A pattern is dangerous if it matches too broadly without any conditions
 * @param {string} pattern - The glob pattern to check
 * @returns {boolean}
 */
export function isDangerousPattern(pattern) {
	// Check exact matches with known dangerous patterns
	if (DANGEROUS_PATTERNS.includes(pattern)) {
		return true;
	}

	// Check for patterns that are variations of dangerous patterns
	// e.g., "**/*.*" which is also very broad
	if (pattern === "**/*.*") {
		return true;
	}

	return false;
}

/**
 * Validate a single rule for safety
 * @param {Rule} rule - The rule to validate
 * @returns {{valid: boolean, error: string | null}}
 */
export function validateRule(rule) {
	// Only validate delete rules
	if (rule.action !== "delete") {
		return { valid: true, error: null };
	}

	// Check if the pattern is dangerous
	if (isDangerousPattern(rule.target)) {
		// If there's a condition, it's safer
		if (rule.condition) {
			return { valid: true, error: null };
		}

		// Dangerous pattern without condition
		return {
			valid: false,
			error: `Dangerous pattern detected: 'delete ${rule.target}' without any condition. This would delete all files. Please add a condition (e.g., 'when exists <file>') or use a more specific pattern.`,
		};
	}

	return { valid: true, error: null };
}

/**
 * Validate all rules for safety
 * @param {Rule[]} rules - Array of rules to validate
 * @returns {{valid: boolean, errors: Array<{rule: Rule, error: string}>}}
 */
export function validateRules(rules) {
	const errors = [];

	for (const rule of rules) {
		const result = validateRule(rule);
		if (!result.valid) {
			errors.push({
				rule,
				error: result.error || "Unknown validation error",
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
	/**
	 * @param {string} message
	 * @param {Array<{rule: Rule, error: string}>} validationErrors
	 */
	constructor(message, validationErrors) {
		super(message);
		this.name = "ValidationError";
		this.validationErrors = validationErrors;
	}
}
