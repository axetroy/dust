import { Rule } from "./parser.js";

/**
 * Options for cleanup operations (extends to include execute flag)
 */
export interface CleanupOptionsWithExecute extends CleanupOptions {
	/**
	 * Whether to actually delete files (true) or just list them (false, default)
	 */
	execute?: boolean;
}

/**
 * Unified cleanup function - finds or deletes files based on rules
 * @param rulesOrDsl - DSL text or parsed rules
 * @param baseDirs - Base directory or directories to evaluate from
 * @param options - Options including execute flag, ignore patterns, skip patterns, and optional event listeners
 * @returns Array of file paths (dry run) or execution result (when execute: true)
 * @example
 * ```js
 * import dedust from 'dedust';
 * // or
 * import { dedust } from 'dedust';
 *
 * const dsl = `
 *   delete target when exists Cargo.toml
 *   delete node_modules when exists package.json
 * `;
 *
 * // Dry run - find targets without deleting (default)
 * const targets = await dedust(dsl, '/path/to/project');
 * console.log('Would delete:', targets);
 *
 * // Execute - actually delete files
 * const result = await dedust(dsl, '/path/to/project', { execute: true });
 * console.log('Deleted:', result.deleted);
 * ```
 */
export function dedust(rulesOrDsl: string | Rule[], baseDirs: string | string[], options?: CleanupOptionsWithExecute): Promise<string[]>;
export function dedust(rulesOrDsl: string | Rule[], baseDirs: string | string[], options: CleanupOptionsWithExecute & { execute: true }): Promise<ExecutionResult>;

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
