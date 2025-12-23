import { glob } from "glob";
import path from "node:path";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import { minimatch } from "minimatch";

/**
 * @typedef {import('./parser.js').Rule} Rule
 * @typedef {import('./parser.js').Condition} Condition
 * @typedef {import('./parser.js').Predicate} Predicate
 * @typedef {import('./parser.js').LocationType} LocationType
 */

/**
 * @typedef {Object} EvaluationContext
 * @property {string} baseDir - The base directory for evaluation
 * @property {string} currentDir - The current directory being evaluated
 */

/**
 * @typedef {Object} FileFoundEvent
 * @property {string} path - The path of the file found
 * @property {Rule} rule - The rule that matched this file
 * @property {string} directory - The directory where the file was found
 */

/**
 * @typedef {Object} FileDeletedEvent
 * @property {string} path - The path of the deleted file
 * @property {boolean} isDirectory - Whether the deleted item was a directory
 */

/**
 * @typedef {Object} ErrorEvent
 * @property {string} path - The path where the error occurred
 * @property {Error} error - The error that occurred
 * @property {string} phase - The phase where error occurred ('evaluation' or 'deletion')
 */

/**
 * Evaluator for dedust DSL rules
 * Evaluates conditions and executes actions
 * @extends EventEmitter
 *
 * Events:
 * - 'file:found' - Emitted when a file matching a rule is found
 * - 'file:deleted' - Emitted when a file is successfully deleted
 * - 'error' - Emitted when an error occurs during evaluation or deletion
 * - 'scan:start' - Emitted when scanning starts
 * - 'scan:directory' - Emitted when scanning a directory
 * - 'scan:complete' - Emitted when scanning completes
 */
export class Evaluator extends EventEmitter {
	/**
	 * @param {Rule[]} rules
	 * @param {string} baseDir - The base directory to start evaluation from
	 * @param {string[]} ignorePatterns - Patterns to ignore during evaluation
	 */
	constructor(rules, baseDir, ignorePatterns = []) {
		super();
		this.rules = rules;
		this.baseDir = path.resolve(baseDir);

		// Extract ignore patterns from rules and merge with API ignore patterns
		const dslIgnorePatterns = rules.filter((rule) => rule.action === "ignore").map((rule) => rule.target);

		this.ignorePatterns = [...dslIgnorePatterns, ...ignorePatterns];

		// Extract skip patterns from rules - these prevent traversal but allow matching
		this.skipPatterns = rules.filter((rule) => rule.action === "skip").map((rule) => rule.target);
	}

	/**
	 * Check if a path should be ignored
	 * @param {string} filePath - The path to check
	 * @returns {boolean}
	 */
	shouldIgnore(filePath) {
		// Get relative path from baseDir
		const relativePath = path.relative(this.baseDir, filePath);

		// Check against each ignore pattern
		for (const pattern of this.ignorePatterns) {
			// If pattern ends with /**, also match the directory itself
			const RECURSIVE_SUFFIX = "/**";
			if (pattern.endsWith(RECURSIVE_SUFFIX)) {
				const dirPattern = pattern.slice(0, -RECURSIVE_SUFFIX.length);
				if (minimatch(relativePath, dirPattern, { dot: true, matchBase: true })) {
					return true;
				}
			}

			// Match against relative path
			if (minimatch(relativePath, pattern, { dot: true, matchBase: true })) {
				return true;
			}

			// Also check if any parent directory matches
			// Early termination: stop checking once we find a match
			const parts = relativePath.split(path.sep);
			for (let i = 0; i < parts.length; i++) {
				const partial = parts.slice(0, i + 1).join(path.sep);
				if (minimatch(partial, pattern, { dot: true, matchBase: true })) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if a directory should be skipped during traversal
	 * (but can still be matched by rules)
	 * @param {string} dirPath - The directory path to check
	 * @returns {boolean}
	 */
	shouldSkipTraversal(dirPath) {
		// Get relative path from baseDir
		const relativePath = path.relative(this.baseDir, dirPath);

		// Check against each skip pattern
		for (const pattern of this.skipPatterns) {
			// If pattern ends with /**, also match the directory itself
			const RECURSIVE_SUFFIX = "/**";
			if (pattern.endsWith(RECURSIVE_SUFFIX)) {
				const dirPattern = pattern.slice(0, -RECURSIVE_SUFFIX.length);
				if (minimatch(relativePath, dirPattern, { dot: true, matchBase: true })) {
					return true;
				}
			}

			// Match against relative path
			if (minimatch(relativePath, pattern, { dot: true, matchBase: true })) {
				return true;
			}

			// Also check if any parent directory matches
			// Early termination: stop checking once we find a match
			const parts = relativePath.split(path.sep);
			for (let i = 0; i < parts.length; i++) {
				const partial = parts.slice(0, i + 1).join(path.sep);
				if (minimatch(partial, pattern, { dot: true, matchBase: true })) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Check if a path is inside a skipped directory (but not the skipped directory itself)
	 * @param {string} filePath - The path to check
	 * @returns {boolean}
	 */
	isInsideSkippedDirectory(filePath) {
		// Get relative path from baseDir
		const relativePath = path.relative(this.baseDir, filePath);
		const parts = relativePath.split(path.sep);

		// Check each parent directory (but not the path itself)
		for (let i = 0; i < parts.length - 1; i++) {
			const partial = path.join(this.baseDir, parts.slice(0, i + 1).join(path.sep));
			if (this.shouldSkipTraversal(partial)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if a file or directory exists
	 * @param {string} dir - The directory to check in
	 * @param {string} pattern - The pattern to match
	 * @returns {Promise<boolean>}
	 */
	async exists(dir, pattern) {
		try {
			const fullPattern = path.join(dir, pattern);

			// For simple patterns without glob characters, use direct fs check
			if (!/[*?[\]{}]/.test(pattern)) {
				return fs.existsSync(fullPattern);
			}

			// Use glob for patterns with wildcards
			const matches = await glob(pattern, {
				cwd: dir,
				nodir: false,
				dot: true,
			});
			return matches.length > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Get the directory based on location modifier
	 * @param {string} currentDir - Current directory
	 * @param {LocationType} location - Location modifier
	 * @returns {string[]} - Array of directories to check
	 */
	getLocationDirs(currentDir, location) {
		switch (location) {
			case "here":
				return [currentDir];

			case "parent": {
				const parentDir = path.dirname(currentDir);
				// Don't go above the base directory
				if (parentDir === currentDir || !parentDir.startsWith(this.baseDir)) {
					return [];
				}
				return [parentDir];
			}

			case "parents": {
				const dirs = [];
				let dir = path.dirname(currentDir);
				while (dir !== currentDir && dir.startsWith(this.baseDir)) {
					dirs.push(dir);
					currentDir = dir;
					dir = path.dirname(dir);
				}
				return dirs;
			}

			case "child": {
				// Direct child directories
				try {
					const entries = fs.readdirSync(currentDir, { withFileTypes: true });
					return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(currentDir, entry.name));
				} catch {
					return [];
				}
			}

			case "children": {
				// All descendant directories (recursive)
				const dirs = [];
				const collectDirs = (dir) => {
					try {
						const entries = fs.readdirSync(dir, { withFileTypes: true });
						for (const entry of entries) {
							if (entry.isDirectory()) {
								const fullPath = path.join(dir, entry.name);
								dirs.push(fullPath);
								collectDirs(fullPath);
							}
						}
					} catch {
						// Skip directories we can't read
					}
				};
				collectDirs(currentDir);
				return dirs;
			}

			case "sibling": {
				// Sibling directories (same parent)
				const parentDir = path.dirname(currentDir);
				if (parentDir === currentDir || !parentDir.startsWith(this.baseDir)) {
					return [];
				}
				try {
					const entries = fs.readdirSync(parentDir, { withFileTypes: true });
					return entries
						.filter((entry) => entry.isDirectory())
						.map((entry) => path.join(parentDir, entry.name))
						.filter((dir) => dir !== currentDir);
				} catch {
					return [];
				}
			}

			default:
				return [currentDir];
		}
	}

	/**
	 * Evaluate a predicate
	 * @param {Predicate} predicate
	 * @param {string} currentDir
	 * @returns {Promise<boolean>}
	 */
	async evaluatePredicate(predicate, currentDir) {
		if (predicate.type === "not") {
			if (!predicate.negated) {
				return false;
			}
			return !(await this.evaluatePredicate(predicate.negated, currentDir));
		}

		if (predicate.type === "exists") {
			const dirs = this.getLocationDirs(currentDir, predicate.location);

			// For exists, check if pattern exists in any of the location directories
			for (const dir of dirs) {
				if (await this.exists(dir, predicate.pattern || "")) {
					return true;
				}
			}
			return false;
		}

		return false;
	}

	/**
	 * Evaluate a condition
	 * @param {Condition} condition
	 * @param {string} currentDir
	 * @returns {Promise<boolean>}
	 */
	async evaluateCondition(condition, currentDir) {
		if (condition.type === "predicate") {
			if (!condition.predicate) {
				return true;
			}
			return this.evaluatePredicate(condition.predicate, currentDir);
		}

		if (condition.type === "and") {
			// Evaluate both sides of AND
			if (!condition.left || !condition.right) {
				return false;
			}

			// Left side is always a Predicate
			const leftResult = await this.evaluatePredicate(condition.left, currentDir);
			if (!leftResult) {
				return false;
			}

			// Right side can be either a Predicate or a nested Condition (for chained ANDs)
			// Check if it's a Condition by looking at its structure
			if (condition.right.type === "and" || condition.right.type === "predicate") {
				// It's a nested Condition
				return this.evaluateCondition(/** @type {Condition} */ (/** @type {unknown} */ (condition.right)), currentDir);
			} else {
				// It's a Predicate
				return this.evaluatePredicate(condition.right, currentDir);
			}
		}

		return false;
	}

	/**
	 * Find all directories recursively
	 * @param {string} dir
	 * @returns {string[]}
	 */
	getAllDirectories(dir) {
		const dirs = [dir];
		const collectDirs = (d) => {
			try {
				const entries = fs.readdirSync(d, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory()) {
						const fullPath = path.join(d, entry.name);
						// Skip ignored directories (both ignore and skip patterns prevent traversal)
						if (this.shouldIgnore(fullPath) || this.shouldSkipTraversal(fullPath)) {
							continue;
						}
						dirs.push(fullPath);
						collectDirs(fullPath);
					}
				}
			} catch {
				// Skip directories we can't read
			}
		};
		collectDirs(dir);
		return dirs;
	}

	/**
	 * Find targets matching a rule in a directory
	 * @param {Rule} rule
	 * @param {string} dir
	 * @returns {Promise<string[]>}
	 */
	async findTargets(rule, dir) {
		const targets = [];

		// Check if condition is met
		if (rule.condition) {
			const conditionMet = await this.evaluateCondition(rule.condition, dir);
			if (!conditionMet) {
				return targets;
			}
		}

		// Find matching targets
		try {
			const pattern = rule.target;

			// For simple patterns without glob, check directly
			if (!/[*?[\]{}]/.test(pattern)) {
				const fullPath = path.join(dir, pattern);
				if (fs.existsSync(fullPath) && !this.shouldIgnore(fullPath)) {
					// Skip paths inside skipped directories (but skipped directories themselves are allowed)
					if (!this.isInsideSkippedDirectory(fullPath)) {
						targets.push(fullPath);
						this.emit("file:found", { path: fullPath, rule, directory: dir });
					}
				}
				return targets;
			}

			// Use glob for patterns
			const matches = await glob(pattern, {
				cwd: dir,
				absolute: true,
				nodir: false,
				dot: true,
			});
			for (const match of matches) {
				// Skip ignored paths
				if (this.shouldIgnore(match)) {
					continue;
				}
				// Skip paths inside skipped directories (but skipped directories themselves are allowed)
				if (this.isInsideSkippedDirectory(match)) {
					continue;
				}
				targets.push(match);
				this.emit("file:found", { path: match, rule, directory: dir });
			}
		} catch (error) {
			// Pattern matching failed, emit error event
			this.emit("error", {
				path: dir,
				error: /** @type {Error} */ (error),
				phase: "evaluation",
			});
		}

		return targets;
	}

	/**
	 * Evaluate all rules and collect targets to delete
	 * @param {boolean} dryRun - If true, don't actually delete files
	 * @returns {Promise<string[]>} - Array of file paths to delete
	 */
	async evaluate(dryRun = true) {
		const allTargets = new Set();

		this.emit("scan:start", { baseDir: this.baseDir, rulesCount: this.rules.length });

		// Get all directories to evaluate
		const directories = this.getAllDirectories(this.baseDir);

		// For each directory, check all rules
		for (const dir of directories) {
			this.emit("scan:directory", { directory: dir });

			for (const rule of this.rules) {
				if (rule.action === "delete") {
					const targets = await this.findTargets(rule, dir);
					for (const target of targets) {
						allTargets.add(target);
					}
				}
			}
		}

		const targetsList = Array.from(allTargets);
		this.emit("scan:complete", {
			baseDir: this.baseDir,
			filesFound: targetsList.length,
			files: targetsList,
		});

		return targetsList;
	}

	/**
	 * Execute the deletion of targets
	 * @param {string[]} targets - Files/directories to delete
	 * @returns {Promise<{deleted: string[], errors: Array<{path: string, error: Error}>}>}
	 */
	async execute(targets) {
		const deleted = [];
		const errors = [];

		// Sort targets by depth (deepest first) to avoid deleting parent before child
		const sortedTargets = targets.slice().sort((a, b) => {
			const depthA = a.split(path.sep).length;
			const depthB = b.split(path.sep).length;
			return depthB - depthA; // Deeper paths first
		});

		for (const target of sortedTargets) {
			try {
				// Check if file/directory still exists (may have been deleted with parent)
				if (!fs.existsSync(target)) {
					continue;
				}

				// Check if it's a directory or file
				const stats = fs.statSync(target);
				const isDirectory = stats.isDirectory();

				if (isDirectory) {
					fs.rmSync(target, { recursive: true, force: true });
				} else {
					fs.unlinkSync(target);
				}

				deleted.push(target);
				this.emit("file:deleted", { path: target, isDirectory });
			} catch (error) {
				const err = { path: target, error: /** @type {Error} */ (error) };
				errors.push(err);
				this.emit("error", {
					path: target,
					error: /** @type {Error} */ (error),
					phase: "deletion",
				});
			}
		}

		return { deleted, errors };
	}
}

/**
 * Evaluate rules and find targets
 * @param {Rule[]} rules
 * @param {string} baseDir
 * @param {boolean} dryRun
 * @param {string[]} ignorePatterns
 * @returns {Promise<string[]>}
 */
export async function evaluate(rules, baseDir, dryRun = true, ignorePatterns = []) {
	const evaluator = new Evaluator(rules, baseDir, ignorePatterns);
	return evaluator.evaluate(dryRun);
}

/**
 * Execute deletion of targets
 * @param {Rule[]} rules
 * @param {string} baseDir
 * @param {string[]} ignorePatterns
 * @returns {Promise<{deleted: string[], errors: Array<{path: string, error: Error}>}>}
 */
export async function executeRules(rules, baseDir, ignorePatterns = []) {
	const evaluator = new Evaluator(rules, baseDir, ignorePatterns);
	const targets = await evaluator.evaluate(true);
	return evaluator.execute(targets);
}
