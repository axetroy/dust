import { Rule } from "./parser.js";

/**
 * Options for dedust operations
 */
export interface DedustOptions {
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
	 * Called when a file is found
	 */
	onFileFound?: (data: import("./evaluator.js").FileFoundEvent) => void;
	/**
	 * Called when a file is deleted
	 */
	onFileDeleted?: (data: import("./evaluator.js").FileDeletedEvent) => void;
	/**
	 * Called when an error occurs
	 */
	onError?: (data: import("./evaluator.js").ErrorEvent) => void;
	/**
	 * Called when scanning starts
	 */
	onScanStart?: (data: import("./evaluator.js").ScanStartEvent) => void;
	/**
	 * Called when scanning a directory
	 */
	onScanDirectory?: (data: import("./evaluator.js").ScanDirectoryEvent) => void;
	/**
	 * Called when scanning completes
	 */
	onScanComplete?: (data: import("./evaluator.js").ScanCompleteEvent) => void;
}

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
 * Result object returned from dedust function
 */
export interface DedustResult {
	/**
	 * Get the list of files that would be deleted
	 */
	readonly targets: string[];
	/**
	 * Get the list of files that would be deleted (alias for targets)
	 */
	readonly files: string[];
	/**
	 * Execute the cleanup and actually delete the files
	 */
	execute(): Promise<ExecutionResult>;
	/**
	 * Alias for execute()
	 */
	cleanup(): Promise<ExecutionResult>;
}

/**
 * Main dedust function - scans files based on rules (always dry mode)
 * @param rulesOrDsl - DSL text or parsed rules
 * @param baseDirs - Base directory or directories to evaluate from
 * @param options - Options including ignore patterns, skip patterns, and optional event listeners
 * @returns DedustResult object with targets and execute method
 */
declare function dedust(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: DedustOptions): Promise<DedustResult>;

/**
 * Default export - the dedust function
 */
export default dedust;

// Re-export essential types only
export type { Rule } from "./parser.js";

// Export classes for advanced usage
export { Tokenizer } from "./tokenizer.js";
export { Parser } from "./parser.js";
export { Evaluator } from "./evaluator.js";
