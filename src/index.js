import { tokenize, Tokenizer } from "./tokenizer.js";
import { parse, Parser } from "./parser.js";
import { evaluate, executeRules, Evaluator } from "./evaluator.js";
import { validateRules, ValidationError } from "./validator.js";

/**
 * @typedef {import('./parser.js').Rule} Rule
 */

/**
 * @typedef {Object} CleanupOptions
 * @property {string[]} [ignore] - Patterns to ignore during cleanup (supports glob patterns)
 * @property {string[]} [skip] - Patterns to skip during traversal but allow matching (supports glob patterns)
 * @property {boolean} [skipValidation] - Skip safety validation of rules (use with caution)
 */

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
 * @param {CleanupOptions} [options] - Options including ignore and skip patterns
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
		const targets = await evaluate(rules, dir, true, ignorePatterns, skipPatterns);
		targets.forEach((target) => allTargets.add(target));
	}

	return Array.from(allTargets);
}

/**
 * Execute rules and delete matching files/directories
 * @param {string | Rule[]} rulesOrDsl - DSL text or parsed rules
 * @param {string | string[]} baseDirs - Base directory or directories to execute from
 * @param {CleanupOptions} [options] - Options including ignore and skip patterns
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
		const result = await executeRules(rules, dir, ignorePatterns, skipPatterns);
		allDeleted.push(...result.deleted);
		allErrors.push(...result.errors);
	}

	return { deleted: allDeleted, errors: allErrors };
}

/**
 * @callback EventListener
 * @param {any} data - Event data
 * @returns {void}
 */

/**
 * @typedef {Object} EventListeners
 * @property {EventListener} [onFileFound] - Called when a file is found
 * @property {EventListener} [onFileDeleted] - Called when a file is deleted
 * @property {EventListener} [onError] - Called when an error occurs
 * @property {EventListener} [onScanStart] - Called when scanning starts
 * @property {EventListener} [onScanDirectory] - Called when scanning a directory
 * @property {EventListener} [onScanComplete] - Called when scanning completes
 */

/**
 * Evaluate rules with event callbacks
 * @param {string | Rule[]} rulesOrDsl - DSL text or parsed rules
 * @param {string | string[]} baseDirs - Base directory or directories to evaluate from
 * @param {EventListeners} listeners - Event listeners
 * @param {CleanupOptions} [options] - Options including ignore and skip patterns
 * @returns {Promise<string[]>} Array of file paths that would be deleted
 * @example
 * ```js
 * import { findTargetsWithEvents } from 'dedust';
 *
 * // Single directory
 * const targets = await findTargetsWithEvents(dsl, '/path/to/project', {
 *   onFileFound: (data) => console.log('Found:', data.path),
 *   onScanComplete: (data) => console.log('Found', data.filesFound, 'files')
 * });
 *
 * // Multiple directories
 * const targets = await findTargetsWithEvents(dsl, ['/path1', '/path2'], {
 *   onFileFound: (data) => console.log('Found:', data.path)
 * });
 *
 * // With ignore patterns
 * const targets = await findTargetsWithEvents(dsl, '/path/to/project',
 *   {
 *     onFileFound: (data) => console.log('Found:', data.path)
 *   },
 *   { ignore: ['.git'] }
 * );
 *
 * // With skip patterns
 * const targets = await findTargetsWithEvents(dsl, '/path/to/project',
 *   {
 *     onFileFound: (data) => console.log('Found:', data.path)
 *   },
 *   { skip: ['node_modules', 'build*'] }
 * );
 * ```
 */
export async function findTargetsWithEvents(rulesOrDsl, baseDirs, listeners = {}, options = {}) {
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
		const evaluator = new Evaluator(rules, dir, ignorePatterns, skipPatterns);

		// Attach event listeners
		if (listeners.onFileFound) {
			evaluator.on("file:found", listeners.onFileFound);
		}
		if (listeners.onError) {
			evaluator.on("error", listeners.onError);
		}
		if (listeners.onScanStart) {
			evaluator.on("scan:start", listeners.onScanStart);
		}
		if (listeners.onScanDirectory) {
			evaluator.on("scan:directory", listeners.onScanDirectory);
		}
		if (listeners.onScanComplete) {
			evaluator.on("scan:complete", listeners.onScanComplete);
		}

		const targets = await evaluator.evaluate(true);
		targets.forEach((target) => allTargets.add(target));
	}

	return Array.from(allTargets);
}

/**
 * Execute cleanup with event callbacks
 * @param {string | Rule[]} rulesOrDsl - DSL text or parsed rules
 * @param {string | string[]} baseDirs - Base directory or directories to execute from
 * @param {EventListeners} listeners - Event listeners
 * @param {CleanupOptions} [options] - Options including ignore and skip patterns
 * @returns {Promise<{deleted: string[], errors: Array<{path: string, error: Error}>}>}
 * @example
 * ```js
 * import { executeCleanupWithEvents } from 'dedust';
 *
 * // Single directory
 * const result = await executeCleanupWithEvents(dsl, '/path/to/project', {
 *   onFileFound: (data) => console.log('Found:', data.path),
 *   onFileDeleted: (data) => console.log('Deleted:', data.path),
 *   onError: (data) => console.error('Error:', data.error)
 * });
 *
 * // Multiple directories
 * const result = await executeCleanupWithEvents(dsl, ['/path1', '/path2'], {
 *   onFileDeleted: (data) => console.log('Deleted:', data.path)
 * });
 *
 * // With ignore patterns
 * const result = await executeCleanupWithEvents(dsl, '/path/to/project',
 *   {
 *     onFileDeleted: (data) => console.log('Deleted:', data.path)
 *   },
 *   { ignore: ['.git', 'node_modules'] }
 * );
 *
 * // With skip patterns
 * const result = await executeCleanupWithEvents(dsl, '/path/to/project',
 *   {
 *     onFileDeleted: (data) => console.log('Deleted:', data.path)
 *   },
 *   { skip: ['node_modules', 'build*'] }
 * );
 * ```
 */
export async function executeCleanupWithEvents(rulesOrDsl, baseDirs, listeners = {}, options = {}) {
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
		const evaluator = new Evaluator(rules, dir, ignorePatterns, skipPatterns);

		// Attach event listeners
		if (listeners.onFileFound) {
			evaluator.on("file:found", listeners.onFileFound);
		}
		if (listeners.onFileDeleted) {
			evaluator.on("file:deleted", listeners.onFileDeleted);
		}
		if (listeners.onError) {
			evaluator.on("error", listeners.onError);
		}
		if (listeners.onScanStart) {
			evaluator.on("scan:start", listeners.onScanStart);
		}
		if (listeners.onScanDirectory) {
			evaluator.on("scan:directory", listeners.onScanDirectory);
		}
		if (listeners.onScanComplete) {
			evaluator.on("scan:complete", listeners.onScanComplete);
		}

		const targets = await evaluator.evaluate(true);
		const result = await evaluator.execute(targets);

		allDeleted.push(...result.deleted);
		allErrors.push(...result.errors);
	}

	return { deleted: allDeleted, errors: allErrors };
}

// Export everything as default
export default {
	parseRules,
	findTargets,
	executeCleanup,
	findTargetsWithEvents,
	executeCleanupWithEvents,
	tokenize,
	parse,
	evaluate,
	executeRules,
};

// Export classes for advanced usage
export { Tokenizer, Parser, Evaluator };

// Export validation functions and error
export { validateRules, validateRule, isDangerousPattern, ValidationError } from "./validator.js";
