import { Rule, LocationType } from "./parser.js";
import { EventEmitter } from "node:events";

/**
 * Evaluation context for rules
 */
export interface EvaluationContext {
	/** The base directory for evaluation */
	baseDir: string;
	/** The current directory being evaluated */
	currentDir: string;
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
 * Event emitted when a file is found
 */
export interface FileFoundEvent {
	/** The path of the file found */
	path: string;
	/** The rule that matched this file */
	rule: Rule;
	/** The directory where the file was found */
	directory: string;
}

/**
 * Event emitted when a file is deleted
 */
export interface FileDeletedEvent {
	/** The path of the deleted file */
	path: string;
	/** Whether the deleted item was a directory */
	isDirectory: boolean;
}

/**
 * Event emitted when an error occurs
 */
export interface ErrorEvent {
	/** The path where the error occurred */
	path: string;
	/** The error that occurred */
	error: Error;
	/** The phase where error occurred */
	phase: "evaluation" | "deletion";
}

/**
 * Event emitted when scanning starts
 */
export interface ScanStartEvent {
	/** The base directory being scanned */
	baseDir: string;
	/** Number of rules to evaluate */
	rulesCount: number;
}

/**
 * Event emitted when scanning a directory
 */
export interface ScanDirectoryEvent {
	/** The directory being scanned */
	directory: string;
}

/**
 * Event emitted when scanning completes
 */
export interface ScanCompleteEvent {
	/** The base directory that was scanned */
	baseDir: string;
	/** Number of files found */
	filesFound: number;
	/** List of found files */
	files: string[];
}

/**
 * Evaluator class for DSL rules
 * Extends EventEmitter to support events
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
	 * Create a new evaluator
	 * @param rules - Array of rules to evaluate
	 * @param baseDir - Base directory to start evaluation from
	 * @param ignorePatterns - Patterns to ignore during evaluation
	 * @param skipPatterns - Patterns to skip during traversal but allow matching
	 */
	constructor(rules: Rule[], baseDir: string, ignorePatterns?: string[], skipPatterns?: string[]);

	/**
	 * Check if a path should be ignored
	 * @param filePath - The path to check
	 */
	shouldIgnore(filePath: string): boolean;

	/**
	 * Check if a file or directory exists matching a pattern
	 * @param dir - Directory to check in
	 * @param pattern - Pattern to match
	 */
	exists(dir: string, pattern: string): Promise<boolean>;

	/**
	 * Get directories based on location modifier
	 * @param currentDir - Current directory
	 * @param location - Location modifier
	 */
	getLocationDirs(currentDir: string, location: LocationType): string[];

	/**
	 * Evaluate a predicate
	 * @param predicate - The predicate to evaluate
	 * @param currentDir - Current directory context
	 */
	evaluatePredicate(predicate: import("./parser.js").Predicate, currentDir: string): Promise<boolean>;

	/**
	 * Evaluate a condition
	 * @param condition - The condition to evaluate
	 * @param currentDir - Current directory context
	 */
	evaluateCondition(condition: import("./parser.js").Condition, currentDir: string): Promise<boolean>;

	/**
	 * Get all directories recursively from base
	 * @param dir - Starting directory
	 */
	getAllDirectories(dir: string): string[];

	/**
	 * Find targets matching a rule in a directory
	 * @param rule - The rule to match
	 * @param dir - Directory to search in
	 */
	findTargets(rule: Rule, dir: string): Promise<string[]>;

	/**
	 * Evaluate all rules and collect targets
	 */
	evaluate(): Promise<string[]>;

	/**
	 * Execute deletion of targets
	 * @param targets - Files/directories to delete
	 */
	execute(targets: string[]): Promise<ExecutionResult>;

	// EventEmitter methods
	on(event: "file:found", listener: (data: FileFoundEvent) => void): this;
	on(event: "file:deleted", listener: (data: FileDeletedEvent) => void): this;
	on(event: "error", listener: (data: ErrorEvent) => void): this;
	on(event: "scan:start", listener: (data: ScanStartEvent) => void): this;
	on(event: "scan:directory", listener: (data: ScanDirectoryEvent) => void): this;
	on(event: "scan:complete", listener: (data: ScanCompleteEvent) => void): this;

	emit(event: "file:found", data: FileFoundEvent): boolean;
	emit(event: "file:deleted", data: FileDeletedEvent): boolean;
	emit(event: "error", data: ErrorEvent): boolean;
	emit(event: "scan:start", data: ScanStartEvent): boolean;
	emit(event: "scan:directory", data: ScanDirectoryEvent): boolean;
	emit(event: "scan:complete", data: ScanCompleteEvent): boolean;
}

/**
 * Evaluate rules and find targets
 * @param rules - Array of rules to evaluate
 * @param baseDir - Base directory to evaluate from
 * @param dryRun - If true, don't actually delete files
 * @param ignorePatterns - Patterns to ignore during evaluation
 * @param skipPatterns - Patterns to skip during traversal but allow matching
 */
export function evaluate(
	rules: Rule[],
	baseDir: string,
	dryRun?: boolean,
	ignorePatterns?: string[],
	skipPatterns?: string[]
): Promise<string[]>;
