import { tokenize, Tokenizer } from "./tokenizer.js";
import { parse, Parser } from "./parser.js";
import { evaluate, executeRules, Evaluator } from "./evaluator.js";
import { validateRules, ValidationError } from "./validator.js";

/**
 * @typedef {import('./parser.js').Rule} Rule
 * @typedef {import('./index.js').CleanupOptions} CleanupOptions
 */

/**
 * Attach event listeners to an evaluator
 * @private
 * @param {Evaluator} evaluator - The evaluator instance
 * @param {CleanupOptions} options - Options containing event listeners
 */
function attachEventListeners(evaluator, options) {
	if (options.onFileFound) {
		evaluator.on("file:found", options.onFileFound);
	}
	if (options.onFileDeleted) {
		evaluator.on("file:deleted", options.onFileDeleted);
	}
	if (options.onError) {
		evaluator.on("error", options.onError);
	}
	if (options.onScanStart) {
		evaluator.on("scan:start", options.onScanStart);
	}
	if (options.onScanDirectory) {
		evaluator.on("scan:directory", options.onScanDirectory);
	}
	if (options.onScanComplete) {
		evaluator.on("scan:complete", options.onScanComplete);
	}
}

/**
 * Check if options has any event handlers
 * @private
 * @param {CleanupOptions} options - Options object
 * @returns {boolean} True if any listeners are defined
 */
function hasListeners(options) {
	return (
		options &&
		(options.onFileFound ||
			options.onFileDeleted ||
			options.onError ||
			options.onScanStart ||
			options.onScanDirectory ||
			options.onScanComplete)
	);
}

/**
 * Parse DSL text into rules
 * @param {string} input - The DSL text to parse
 * @returns {Rule[]} Array of parsed rules
 * @example
 * ```js
 * import { parseRules } from 'dedust';
 *
 * const dsl = `
 *   delete target when exists Cargo.toml
 *   delete node_modules when exists package.json
 * `;
 *
 * const rules = parseRules(dsl);
 * console.log(rules);
 * ```
 */
export function parseRules(input) {
	const tokens = tokenize(input);
	return parse(tokens);
}

/**
 * Evaluate rules and find targets to delete (dry run)
 * @param {string | Rule[]} rulesOrDsl - DSL text or parsed rules
 * @param {string | string[]} baseDirs - Base directory or directories to evaluate from
 * @param {CleanupOptions} [options] - Options including ignore patterns, skip patterns, and optional event listeners
 * @returns {Promise<string[]>} Array of file paths that would be deleted
 * @example
 * ```js
 * import { findTargets } from 'dedust';
 *
 * const dsl = `delete *.log`;
 *
 * // Single directory
 * const targets = await findTargets(dsl, '/path/to/project');
 *
 * // Multiple directories
 * const targets = await findTargets(dsl, ['/path/to/project1', '/path/to/project2']);
 *
 * // With ignore patterns
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   ignore: ['.git', 'node_modules']
 * });
 *
 * // With skip patterns
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   skip: ['node_modules', 'build']
 * });
 *
 * // With event listeners (optional)
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   onFileFound: (data) => console.log('Found:', data.path),
 *   onScanComplete: (data) => console.log('Found', data.filesFound, 'files')
 * });
 *
 * // With both ignore and skip patterns
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   ignore: ['.git', '*.keep'],
 *   skip: ['node_modules', 'build*']
 * });
 * console.log('Would delete:', targets);
 * ```
 */
export async function findTargets(rulesOrDsl, baseDirs, options = {}) {
	const rules = typeof rulesOrDsl === "string" ? parseRules(rulesOrDsl) : rulesOrDsl;
	const dirs = Array.isArray(baseDirs) ? baseDirs : [baseDirs];
	const ignorePatterns = options.ignore || [];
	const skipPatterns = options.skip || [];

	// Validate rules for safety unless explicitly skipped
	if (!options.skipValidation) {
		const validation = validateRules(rules);
		if (!validation.valid) {
			const errorMessages = validation.errors.map((e) => e.error).join("\n");
			throw new ValidationError(`Rule validation failed:\n${errorMessages}`, validation.errors);
		}
	}

	const allTargets = new Set();
	for (const dir of dirs) {
		// If listeners are provided, use event-based evaluation
		if (hasListeners(options)) {
			const evaluator = new Evaluator(rules, dir, ignorePatterns, skipPatterns);

			// Attach event listeners using helper function
			attachEventListeners(evaluator, options);

			const targets = await evaluator.evaluate(true);
			targets.forEach((target) => allTargets.add(target));
		} else {
			// Use direct evaluation without events for better performance
			const targets = await evaluate(rules, dir, true, ignorePatterns, skipPatterns);
			targets.forEach((target) => allTargets.add(target));
		}
	}

	return Array.from(allTargets);
}

/**
 * Execute rules and delete matching files/directories
 * @param {string | Rule[]} rulesOrDsl - DSL text or parsed rules
 * @param {string | string[]} baseDirs - Base directory or directories to execute from
 * @param {CleanupOptions} [options] - Options including ignore patterns, skip patterns, and optional event listeners
 * @returns {Promise<{deleted: string[], errors: Array<{path: string, error: Error}>}>}
 * @example
 * ```js
 * import { executeCleanup } from 'dedust';
 *
 * const dsl = `
 *   delete target when exists Cargo.toml
 *   delete node_modules when exists package.json
 * `;
 *
 * // Single directory
 * const result = await executeCleanup(dsl, '/path/to/project');
 *
 * // Multiple directories
 * const result = await executeCleanup(dsl, ['/path/to/project1', '/path/to/project2']);
 *
 * // With ignore patterns
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   ignore: ['.git', '*.keep', 'important/**']
 * });
 *
 * // With skip patterns
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   skip: ['node_modules', '.git', 'build*']
 * });
 *
 * // With event listeners (optional)
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   onFileDeleted: (data) => console.log('Deleted:', data.path),
 *   onError: (data) => console.error('Error:', data.error)
 * });
 *
 * // With both ignore and skip patterns
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   ignore: ['.git', '*.keep'],
 *   skip: ['node_modules', 'build']
 * });
 * console.log('Deleted:', result.deleted);
 * console.log('Errors:', result.errors);
 * ```
 */
export async function executeCleanup(rulesOrDsl, baseDirs, options = {}) {
	const rules = typeof rulesOrDsl === "string" ? parseRules(rulesOrDsl) : rulesOrDsl;
	const dirs = Array.isArray(baseDirs) ? baseDirs : [baseDirs];
	const ignorePatterns = options.ignore || [];
	const skipPatterns = options.skip || [];

	// Validate rules for safety unless explicitly skipped
	if (!options.skipValidation) {
		const validation = validateRules(rules);
		if (!validation.valid) {
			const errorMessages = validation.errors.map((e) => e.error).join("\n");
			throw new ValidationError(`Rule validation failed:\n${errorMessages}`, validation.errors);
		}
	}

	const allDeleted = [];
	const allErrors = [];

	for (const dir of dirs) {
		// If listeners are provided, use event-based execution
		if (hasListeners(options)) {
			const evaluator = new Evaluator(rules, dir, ignorePatterns, skipPatterns);

			// Attach event listeners using helper function
			attachEventListeners(evaluator, options);

			const targets = await evaluator.evaluate(true);
			const result = await evaluator.execute(targets);

			allDeleted.push(...result.deleted);
			allErrors.push(...result.errors);
		} else {
			// Use direct execution without events for better performance
			const result = await executeRules(rules, dir, ignorePatterns, skipPatterns);
			allDeleted.push(...result.deleted);
			allErrors.push(...result.errors);
		}
	}

	return { deleted: allDeleted, errors: allErrors };
}

/**
 * @callback EventListener
 * @param {any} data - Event data
 * @returns {void}
 */

// Export only the core API
export default {
	parseRules,
	findTargets,
	executeCleanup,
};
