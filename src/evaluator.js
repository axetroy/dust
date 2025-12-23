import { glob } from "glob";
import path from "node:path";
import fsp from "node:fs/promises";
import { EventEmitter } from "node:events";
import { minimatch } from "minimatch";

/**
 * @typedef {import('./parser.js').Rule} Rule
 * @typedef {import('./parser.js').Condition} Condition
 * @typedef {import('./parser.js').Predicate} Predicate
 * @typedef {import('./parser.js').LocationType} LocationType
 * @typedef {import('./index.js').EvaluationContext} EvaluationContext
 * @typedef {import('./index.js').FileFoundEvent} FileFoundEvent
 * @typedef {import('./index.js').FileDeletedEvent} FileDeletedEvent
 * @typedef {import('./index.js').ErrorEvent} ErrorEvent
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
	// Class-level constant for recursive glob suffix
	static RECURSIVE_SUFFIX = "/**";

	/**
	 * @param {Rule[]} rules
	 * @param {string} baseDir - The base directory to start evaluation from
	 * @param {string[]} ignorePatterns - Patterns to ignore during evaluation
	 * @param {string[]} skipPatterns - Patterns to skip during traversal but allow matching
	 */
	constructor(rules, baseDir, ignorePatterns = [], skipPatterns = []) {
		super();
		this.rules = rules;
		this.baseDir = path.resolve(baseDir);

		// Extract ignore patterns from rules and merge with API ignore patterns
		const dslIgnorePatterns = rules.filter((rule) => rule.action === "ignore").map((rule) => rule.target);

		this.ignorePatterns = [...dslIgnorePatterns, ...ignorePatterns];

		// Extract skip patterns from rules and merge with API skip patterns - these prevent traversal but allow matching
		const dslSkipPatterns = rules.filter((rule) => rule.action === "skip").map((rule) => rule.target);

		this.skipPatterns = [...dslSkipPatterns, ...skipPatterns];

		// Cache compiled minimatch patterns for better performance
		this.ignoreMatchers = this.ignorePatterns.map((pattern) => {
			const hasRecursiveSuffix = pattern.endsWith(Evaluator.RECURSIVE_SUFFIX);
			return {
				pattern,
				matcher: new minimatch.Minimatch(pattern, { dot: true, matchBase: true }),
				// Pre-compile matcher for directory pattern if it has recursive suffix
				dirMatcher: hasRecursiveSuffix
					? new minimatch.Minimatch(pattern.slice(0, -Evaluator.RECURSIVE_SUFFIX.length), { dot: true, matchBase: true })
					: null,
			};
		});

		this.skipMatchers = this.skipPatterns.map((pattern) => {
			const hasRecursiveSuffix = pattern.endsWith(Evaluator.RECURSIVE_SUFFIX);
			return {
				pattern,
				matcher: new minimatch.Minimatch(pattern, { dot: true, matchBase: true }),
				// Pre-compile matcher for directory pattern if it has recursive suffix
				dirMatcher: hasRecursiveSuffix
					? new minimatch.Minimatch(pattern.slice(0, -Evaluator.RECURSIVE_SUFFIX.length), { dot: true, matchBase: true })
					: null,
			};
		});

		// Cache for relative path computations to avoid repeated path.relative calls
		this.relativePathCache = new Map();

		// Cache for shouldIgnore and shouldSkipTraversal results
		this.ignoreCache = new Map();
		this.skipCache = new Map();
	}

	/**
	 * Get relative path with caching for performance
	 * @private
	 * @param {string} filePath - The path to get relative path for
	 * @returns {string}
	 */
	getRelativePath(filePath) {
		if (this.relativePathCache.has(filePath)) {
			return this.relativePathCache.get(filePath);
		}
		const relativePath = path.relative(this.baseDir, filePath);
		this.relativePathCache.set(filePath, relativePath);
		return relativePath;
	}

	/**
	 * Check if any parent directory matches the given matcher
	 * Builds paths incrementally for efficiency
	 * @private
	 * @param {Array<{pattern: string, matcher: minimatch.Minimatch, dirMatcher: minimatch.Minimatch | null}>} matchers
	 * @param {string[]} pathParts - Pre-split path parts
	 * @returns {boolean}
	 */
	checkParentDirectories(matchers, pathParts) {
		for (const { matcher } of matchers) {
			// Build paths incrementally to avoid repeated slice/join operations
			let currentPath = "";
			for (let i = 0; i < pathParts.length; i++) {
				currentPath = i === 0 ? pathParts[0] : currentPath + path.sep + pathParts[i];
				if (matcher.match(currentPath)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Check if a path should be ignored
	 * @param {string} filePath - The path to check
	 * @returns {boolean}
	 */
	shouldIgnore(filePath) {
		// Check cache first
		if (this.ignoreCache.has(filePath)) {
			return this.ignoreCache.get(filePath);
		}

		// Get relative path from baseDir
		const relativePath = this.getRelativePath(filePath);

		// Pre-split path parts once for reuse
		const parts = relativePath.split(path.sep);

		// Check against each ignore pattern using cached matchers
		for (const { pattern: _, matcher, dirMatcher } of this.ignoreMatchers) {
			// If pattern ends with /**, also match the directory itself using cached dirMatcher
			if (dirMatcher && dirMatcher.match(relativePath)) {
				this.ignoreCache.set(filePath, true);
				return true;
			}

			// Match against relative path using cached matcher
			if (matcher.match(relativePath)) {
				this.ignoreCache.set(filePath, true);
				return true;
			}
		}

		// Check if any parent directory matches using helper method
		if (this.checkParentDirectories(this.ignoreMatchers, parts)) {
			this.ignoreCache.set(filePath, true);
			return true;
		}

		this.ignoreCache.set(filePath, false);
		return false;
	}

	/**
	 * Check if a directory should be skipped during traversal
	 * (but can still be matched by rules)
	 * @param {string} dirPath - The directory path to check
	 * @returns {boolean}
	 */
	shouldSkipTraversal(dirPath) {
		// Check cache first
		if (this.skipCache.has(dirPath)) {
			return this.skipCache.get(dirPath);
		}

		// Get relative path from baseDir
		const relativePath = this.getRelativePath(dirPath);

		// Pre-split path parts once for reuse
		const parts = relativePath.split(path.sep);

		// Check against each skip pattern using cached matchers
		for (const { pattern: _, matcher, dirMatcher } of this.skipMatchers) {
			// If pattern ends with /**, also match the directory itself using cached dirMatcher
			if (dirMatcher && dirMatcher.match(relativePath)) {
				this.skipCache.set(dirPath, true);
				return true;
			}

			// Match against relative path using cached matcher
			if (matcher.match(relativePath)) {
				this.skipCache.set(dirPath, true);
				return true;
			}
		}

		// Check if any parent directory matches using helper method
		if (this.checkParentDirectories(this.skipMatchers, parts)) {
			this.skipCache.set(dirPath, true);
			return true;
		}

		this.skipCache.set(dirPath, false);
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
		// Build paths incrementally to avoid repeated path.join operations
		let currentPath = this.baseDir;
		for (let i = 0; i < parts.length - 1; i++) {
			currentPath = path.join(currentPath, parts[i]);
			if (this.shouldSkipTraversal(currentPath)) {
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
		// For simple patterns without glob characters, use direct fs check (much faster)
		if (isSimplePattern(pattern)) {
			try {
				const fullPattern = path.join(dir, pattern);
				await fsp.access(fullPattern);
				return true;
			} catch {
				return false;
			}
		}

		// Use glob for patterns with wildcards
		try {
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
	 * @returns {Promise<string[]>} - Array of directories to check
	 */
	async getLocationDirs(currentDir, location) {
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
					const entries = await fsp.readdir(currentDir, { withFileTypes: true });
					const childDirs = [];
					for (const entry of entries) {
						if (entry.isDirectory()) {
							const fullPath = path.join(currentDir, entry.name);
							// Skip ignored directories
							if (!this.shouldIgnore(fullPath)) {
								childDirs.push(fullPath);
							}
						}
					}
					return childDirs;
				} catch {
					return [];
				}
			}

			case "children": {
				// All descendant directories (recursive)
				const dirs = [];
				const collectDirs = async (dir) => {
					try {
						const entries = await fsp.readdir(dir, { withFileTypes: true });
						for (const entry of entries) {
							if (entry.isDirectory()) {
								const fullPath = path.join(dir, entry.name);
								// Skip ignored and skipped directories for performance
								if (!this.shouldIgnore(fullPath) && !this.shouldSkipTraversal(fullPath)) {
									dirs.push(fullPath);
									await collectDirs(fullPath);
								}
							}
						}
					} catch {
						// Skip directories we can't read
					}
				};
				await collectDirs(currentDir);
				return dirs;
			}

			case "sibling": {
				// Sibling directories (same parent)
				const parentDir = path.dirname(currentDir);
				if (parentDir === currentDir || !parentDir.startsWith(this.baseDir)) {
					return [];
				}
				try {
					const entries = await fsp.readdir(parentDir, { withFileTypes: true });
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
			const dirs = await this.getLocationDirs(currentDir, predicate.location);

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
	 * @returns {Promise<string[]>}
	 */
	async getAllDirectories(dir) {
		const dirs = [dir];
		const collectDirs = async (d) => {
			try {
				const entries = await fsp.readdir(d, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory()) {
						const fullPath = path.join(d, entry.name);
						// Skip ignored directories (both ignore and skip patterns prevent traversal)
						if (this.shouldIgnore(fullPath) || this.shouldSkipTraversal(fullPath)) {
							continue;
						}
						dirs.push(fullPath);
						await collectDirs(fullPath);
					}
				}
			} catch {
				// Skip directories we can't read
			}
		};
		await collectDirs(dir);
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
			if (isSimplePattern(pattern)) {
				const fullPath = path.join(dir, pattern);
				try {
					await fsp.access(fullPath);
					if (!this.shouldIgnore(fullPath) && !this.isInsideSkippedDirectory(fullPath)) {
						targets.push(fullPath);
						this.emit("file:found", { path: fullPath, rule, directory: dir });
					}
				} catch {
					// File doesn't exist, skip
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
		const directories = await this.getAllDirectories(this.baseDir);

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
				try {
					await fsp.access(target);
				} catch {
					continue; // File doesn't exist, skip
				}

				// Check if it's a directory or file
				const stats = await fsp.stat(target);
				const isDirectory = stats.isDirectory();

				if (isDirectory) {
					await fsp.rm(target, { recursive: true, force: true });
				} else {
					await fsp.unlink(target);
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
 * @param {string[]} skipPatterns
 * @returns {Promise<string[]>}
 */
export async function evaluate(rules, baseDir, dryRun = true, ignorePatterns = [], skipPatterns = []) {
	const evaluator = new Evaluator(rules, baseDir, ignorePatterns, skipPatterns);
	return evaluator.evaluate(dryRun);
}

/**
 * Execute deletion of targets
 * @param {Rule[]} rules
 * @param {string} baseDir
 * @param {string[]} ignorePatterns
 * @param {string[]} skipPatterns
 * @returns {Promise<{deleted: string[], errors: Array<{path: string, error: Error}>}>}
 */
export async function executeRules(rules, baseDir, ignorePatterns = [], skipPatterns = []) {
	const evaluator = new Evaluator(rules, baseDir, ignorePatterns, skipPatterns);
	const targets = await evaluator.evaluate(true);
	return evaluator.execute(targets);
}

let SIMPLE_PATTERN_REGEX = /[*?[\]{}]/;

/**
 * Check if a pattern is simple (no glob characters)
 * @param {string} pattern - The pattern to check
 * @returns {boolean}
 */
function isSimplePattern(pattern) {
	// A simple pattern contains no glob characters
	return SIMPLE_PATTERN_REGEX.test(pattern) === false;
}
