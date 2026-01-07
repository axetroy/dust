import { tokenize, Tokenizer } from "./tokenizer.js";
import { parse, Parser } from "./parser.js";
import { evaluate, Evaluator } from "./evaluator.js";
import { validateRules, ValidationError } from "./validator.js";
import fs from "node:fs";

/**
 * @typedef {import('./parser.js').Rule} Rule
 * @typedef {import('./index.js').DedustOptions} DedustOptions
 */

/**
 * Attach event listeners to an evaluator
 * @private
 * @param {Evaluator} evaluator - The evaluator instance
 * @param {DedustOptions} options - Options containing event listeners
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
 * @param {DedustOptions} options - Options object
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
 */
function parseRules(input) {
	const tokens = tokenize(input);
	return parse(tokens);
}

/**
 * Evaluate rules and find targets to delete (dry run)
 * @param {string | Rule[]} rulesOrDsl - DSL text or parsed rules
 * @param {string | string[]} baseDirs - Base directory or directories to evaluate from
 * @param {DedustOptions} [options] - Options including ignore patterns, skip patterns, and optional event listeners
 * @returns {Promise<string[]>} Array of file paths that would be deleted
 */
async function findTargets(rulesOrDsl, baseDirs, options = {}) {
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
 * Result object returned from dedust function
 */
class DedustResult {
	constructor(rulesOrDsl, baseDirs, options, targets) {
		this.rulesOrDsl = rulesOrDsl;
		this.baseDirs = baseDirs;
		this.options = options;
		this._targets = targets;
	}

	/**
	 * Get the list of files that would be deleted
	 */
	get targets() {
		return [...this._targets];
	}

	/**
	 * Get the list of files that would be deleted (alias)
	 */
	get files() {
		return this.targets;
	}

	/**
	 * Execute the cleanup and actually delete the files
	 * @returns {Promise<{deleted: string[], errors: Array<{path: string, error: Error}>}>}
	 */
	async execute() {
		// Use the pre-scanned targets to avoid re-scanning
		const allDeleted = [];
		const allErrors = [];

		// If listeners are provided, need to use Evaluator to fire events
		if (hasListeners(this.options)) {
			const rules = typeof this.rulesOrDsl === "string" ? parseRules(this.rulesOrDsl) : this.rulesOrDsl;
			const dirs = Array.isArray(this.baseDirs) ? this.baseDirs : [this.baseDirs];
			const ignorePatterns = this.options.ignore || [];
			const skipPatterns = this.options.skip || [];

			// Group targets by directory
			const targetsByDir = new Map();
			for (const target of this._targets) {
				for (const dir of dirs) {
					if (target.startsWith(dir)) {
						if (!targetsByDir.has(dir)) {
							targetsByDir.set(dir, []);
						}
						targetsByDir.get(dir).push(target);
						break;
					}
				}
			}

			// Execute deletion for each directory with events
			for (const dir of dirs) {
				const dirTargets = targetsByDir.get(dir) || [];

				if (dirTargets.length === 0) continue;

				const evaluator = new Evaluator(rules, dir, ignorePatterns, skipPatterns);
				attachEventListeners(evaluator, this.options);

				// Use execute directly with pre-scanned targets (no re-scan)
				const result = await evaluator.execute(dirTargets);
				allDeleted.push(...result.deleted);
				allErrors.push(...result.errors);
			}
		} else {
			// No listeners - just delete files directly
			// Group targets: directories and files
			const directories = [];
			const files = [];

			for (const target of this._targets) {
				try {
					const stat = fs.statSync(target);
					if (stat.isDirectory()) {
						directories.push(target);
					} else {
						files.push(target);
					}
				} catch (error) {
					// File might not exist or be inaccessible
					allErrors.push({ path: target, error });
				}
			}

			// Delete files first
			for (const file of files) {
				try {
					fs.unlinkSync(file);
					allDeleted.push(file);
				} catch (error) {
					allErrors.push({ path: file, error });
				}
			}

			// Then delete directories (might contain some of the files/dirs we already handled)
			for (const dir of directories) {
				try {
					if (fs.existsSync(dir)) {
						fs.rmSync(dir, { recursive: true, force: true });
						allDeleted.push(dir);

						// Also mark child targets as deleted
						for (const target of this._targets) {
							if (target !== dir && target.startsWith(dir + "/") && !allDeleted.includes(target)) {
								allDeleted.push(target);
							}
						}
					}
				} catch (error) {
					allErrors.push({ path: dir, error });
				}
			}
		}

		return { deleted: allDeleted, errors: allErrors };
	}

	/**
	 * Alias for execute()
	 */
	async cleanup() {
		return this.execute();
	}
}

async function dedust(rulesOrDsl, baseDirs, options = {}) {
	// Always do dry run first to get targets
	const targets = await findTargets(rulesOrDsl, baseDirs, options);

	// Return result object
	return new DedustResult(rulesOrDsl, baseDirs, options, targets);
}

// Minimal public API - single dedust function
export default dedust;

// Export classes for advanced usage
export { Tokenizer, Parser, Evaluator };
