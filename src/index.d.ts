import { Rule } from "./parser.js";

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
	/**
	 * Patterns to ignore during cleanup (supports glob patterns)
	 * @example ['.git', 'node_modules', '*.keep', 'important/**']
	 */
	ignore?: string[];
	/**
	 * Patterns to skip during traversal but allow matching (supports glob patterns)
	 * @example ['node_modules', '.git', 'build*']
	 */
	skip?: string[];
	/**
	 * Skip safety validation of rules (use with caution)
	 */
	skipValidation?: boolean;
	/**
	 * Optional event listeners for real-time feedback
	 */
	listeners?: EventListeners;
}

/**
 * Parse DSL text into rules
 * @param input - The DSL text to parse
 * @returns Array of parsed rules
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
export function parseRules(input: string): Rule[];

/**
 * Evaluate rules and find targets to delete (dry run)
 * @param rulesOrDsl - DSL text or parsed rules
 * @param baseDirs - Base directory or directories to evaluate from
 * @param options - Options including ignore patterns, skip patterns, and optional event listeners
 * @returns Array of file paths that would be deleted
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
 *   ignore: ['.git', 'node_modules', '*.keep']
 * });
 *
 * // With skip patterns
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   skip: ['node_modules', 'build*']
 * });
 *
 * // With event listeners (optional)
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   listeners: {
 *     onFileFound: (data) => console.log('Found:', data.path),
 *     onScanComplete: (data) => console.log('Found', data.filesFound, 'files')
 *   }
 * });
 * console.log('Would delete:', targets);
 * ```
 */
export function findTargets(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptions): Promise<string[]>;

/**
 * Result of executing cleanup
 */
export interface ExecutionResult {
	/** Successfully deleted paths */
	deleted: string[];
	/** Errors encountered during deletion */
	errors: Array<{
		path: string;
		error: Error;
	}>;
}

/**
 * Execute rules and delete matching files/directories
 * @param rulesOrDsl - DSL text or parsed rules
 * @param baseDirs - Base directory or directories to execute from
 * @param options - Options including ignore patterns, skip patterns, and optional event listeners
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
 * const result = await executeCleanup(dsl, ['/path1', '/path2']);
 *
 * // With ignore patterns
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   ignore: ['.git', 'node_modules/**', '*.keep']
 * });
 *
 * // With skip patterns
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   skip: ['node_modules', 'build*']
 * });
 *
 * // With event listeners (optional)
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   listeners: {
 *     onFileDeleted: (data) => console.log('Deleted:', data.path),
 *     onError: (data) => console.error('Error:', data.error)
 *   }
 * });
 * console.log('Deleted:', result.deleted);
 * console.log('Errors:', result.errors);
 * ```
 */
export function executeCleanup(
	rulesOrDsl: string | Rule[],
	baseDirs: string | string[],
	options?: CleanupOptions
): Promise<ExecutionResult>;

/**
 * Event listener callback
 */
export type EventListener = (data: any) => void;

/**
 * Event listeners for file operations
 */
export interface EventListeners {
	/** Called when a file is found */
	onFileFound?: (data: import("./evaluator.js").FileFoundEvent) => void;
	/** Called when a file is deleted */
	onFileDeleted?: (data: import("./evaluator.js").FileDeletedEvent) => void;
	/** Called when an error occurs */
	onError?: (data: import("./evaluator.js").ErrorEvent) => void;
	/** Called when scanning starts */
	onScanStart?: (data: import("./evaluator.js").ScanStartEvent) => void;
	/** Called when scanning a directory */
	onScanDirectory?: (data: import("./evaluator.js").ScanDirectoryEvent) => void;
	/** Called when scanning completes */
	onScanComplete?: (data: import("./evaluator.js").ScanCompleteEvent) => void;
}

/**
 * Evaluate rules with event callbacks
 * @deprecated Use `findTargets` with `options.listeners` instead
 * @param rulesOrDsl - DSL text or parsed rules
 * @param baseDirs - Base directory or directories to evaluate from
 * @param listeners - Event listeners
 * @param options - Options including ignore and skip patterns
 * @returns Array of file paths that would be deleted
 * @example
 * ```js
 * import { findTargets } from 'dedust';
 *
 * // Preferred: Use findTargets with listeners in options
 * const targets = await findTargets(dsl, '/path/to/project', {
 *   listeners: {
 *     onFileFound: (data) => console.log('Found:', data.path)
 *   }
 * });
 * ```
 */
export function findTargetsWithEvents(
	rulesOrDsl: string | Rule[],
	baseDirs: string | string[],
	listeners?: EventListeners,
	options?: CleanupOptions
): Promise<string[]>;

/**
 * Execute cleanup with event callbacks
 * @deprecated Use `executeCleanup` with `options.listeners` instead
 * @param rulesOrDsl - DSL text or parsed rules
 * @param baseDirs - Base directory or directories to execute from
 * @param listeners - Event listeners
 * @param options - Options including ignore and skip patterns
 * @example
 * ```js
 * import { executeCleanup } from 'dedust';
 *
 * // Preferred: Use executeCleanup with listeners in options
 * const result = await executeCleanup(dsl, '/path/to/project', {
 *   listeners: {
 *     onFileDeleted: (data) => console.log('Deleted:', data.path)
 *   }
 * });
 * ```
 */
export function executeCleanupWithEvents(
	rulesOrDsl: string | Rule[],
	baseDirs: string | string[],
	listeners?: EventListeners,
	options?: CleanupOptions
): Promise<ExecutionResult>;

/**
 * Default export containing all main functions
 */
declare const _default: {
	parseRules: typeof parseRules;
	findTargets: typeof findTargets;
	executeCleanup: typeof executeCleanup;
	findTargetsWithEvents: typeof findTargetsWithEvents;
	executeCleanupWithEvents: typeof executeCleanupWithEvents;
	tokenize: typeof import("./tokenizer.js").tokenize;
	parse: typeof import("./parser.js").parse;
	evaluate: typeof import("./evaluator.js").evaluate;
	executeRules: typeof import("./evaluator.js").executeRules;
};

export default _default;

// Re-export types
export type { Rule, ActionType, LocationType, Condition, Predicate } from "./parser.js";
export type { Token, TokenType } from "./tokenizer.js";
export type {
	EvaluationContext,
	FileFoundEvent,
	FileDeletedEvent,
	ErrorEvent,
	ScanStartEvent,
	ScanDirectoryEvent,
	ScanCompleteEvent,
} from "./evaluator.js";

// Export classes for advanced usage
export { Tokenizer } from "./tokenizer.js";
export { Parser } from "./parser.js";
export { Evaluator } from "./evaluator.js";
