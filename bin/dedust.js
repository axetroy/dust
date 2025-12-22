#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { executeCleanupWithEvents, findTargetsWithEvents } from "../dist/esm/index.mjs";

const args = process.argv.slice(2);
const flags = {
	dryRun: false,
	configFile: "dedust.rules",
	help: false,
	version: false,
};

const directories = [];

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
	const arg = args[i];

	if (arg === "--help" || arg === "-h") {
		flags.help = true;
	} else if (arg === "--version" || arg === "-v") {
		flags.version = true;
	} else if (arg === "--dry-run" || arg === "-d") {
		flags.dryRun = true;
	} else if (arg === "--config" || arg === "-c") {
		i++;
		if (i < args.length) {
			flags.configFile = args[i];
		} else {
			console.error("Error: --config requires a file path");
			process.exit(1);
		}
	} else if (!arg.startsWith("-")) {
		directories.push(arg);
	} else {
		console.error(`Unknown option: ${arg}`);
		process.exit(1);
	}
}

// Show help
if (flags.help) {
	console.log(`
dedust - An elegant file cleanup tool

Usage:
  dedust [options] [directories...]

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -d, --dry-run           Preview what would be deleted without actually deleting
  -c, --config <file>     Specify config file (default: dedust.rules)

Examples:
  # Clean current directory using dedust.rules
  dedust

  # Preview what would be deleted
  dedust --dry-run

  # Clean specific directories
  dedust /path/to/project1 /path/to/project2

  # Use custom config file
  dedust --config my-rules.txt

  # Dry run with custom config
  dedust --dry-run --config custom.rules /path/to/project
`);
	process.exit(0);
}

// Show version
if (flags.version) {
	// Read version from package.json
	try {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const packageJsonPath = resolve(__dirname, "../package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
		console.log(packageJson.version);
	} catch (error) {
		console.error("Error reading version:", error.message);
		process.exit(1);
	}
	process.exit(0);
}

// Default to current directory if no directories specified
if (directories.length === 0) {
	directories.push(process.cwd());
}

// Resolve config file path
const configPath = resolve(process.cwd(), flags.configFile);

// Check if config file exists
if (!existsSync(configPath)) {
	console.error(`Error: Config file not found: ${configPath}`);
	console.error(`\nCreate a ${flags.configFile} file or specify a different config with --config`);
	process.exit(1);
}

// Read config file
let rulesText;
try {
	rulesText = readFileSync(configPath, "utf-8");
} catch (error) {
	console.error(`Error reading config file: ${error.message}`);
	process.exit(1);
}

// Run cleanup
(async () => {
	try {
		console.log(`Using config: ${configPath}`);
		console.log(`Scanning directories: ${directories.join(", ")}`);
		console.log(`Mode: ${flags.dryRun ? "DRY RUN (preview only)" : "DELETE"}`);
		console.log("");

		if (flags.dryRun) {
			// Dry run - just find targets
			const targets = await findTargetsWithEvents(rulesText, directories, {
				onScanStart: (data) => {
					console.log(`→ Starting scan with ${data.rulesCount} rules...`);
				},
				onScanDirectory: (data) => {
					process.stdout.write(`\r  Scanning: ${data.directory}...`);
				},
				onFileFound: (data) => {
					console.log(`\n  Found: ${data.path}`);
				},
				onScanComplete: (data) => {
					console.log(`\n✓ Scan complete. Found ${data.filesFound} items to delete.`);
				},
			});

			console.log("\n" + "=".repeat(60));
			console.log("DRY RUN SUMMARY");
			console.log("=".repeat(60));
			console.log(`Total items that would be deleted: ${targets.length}`);

			if (targets.length > 0) {
				console.log("\nTo actually delete these files, run without --dry-run flag.");
			}
		} else {
			// Actually delete
			const result = await executeCleanupWithEvents(rulesText, directories, {
				onScanStart: (data) => {
					console.log(`→ Starting cleanup with ${data.rulesCount} rules...`);
				},
				onScanDirectory: (data) => {
					process.stdout.write(`\r  Scanning: ${data.directory}...`);
				},
				onFileFound: (data) => {
					console.log(`\n  Found: ${data.path}`);
				},
				onFileDeleted: (data) => {
					const type = data.isDirectory ? "directory" : "file";
					console.log(`  ✓ Deleted ${type}: ${data.path}`);
				},
				onError: (data) => {
					console.error(`  ✗ Error deleting ${data.path}: ${data.error.message}`);
				},
				onScanComplete: (data) => {
					console.log(`\n✓ Scan complete. Found ${data.filesFound} items.`);
				},
			});

			console.log("\n" + "=".repeat(60));
			console.log("CLEANUP SUMMARY");
			console.log("=".repeat(60));
			console.log(`Successfully deleted: ${result.deleted.length} items`);
			console.log(`Errors: ${result.errors.length}`);

			if (result.errors.length > 0) {
				console.log("\nErrors encountered:");
				result.errors.forEach((error) => {
					console.log(`  - ${error.path}: ${error.error.message}`);
				});
			}
		}

		process.exit(0);
	} catch (error) {
		console.error("\nFatal error:", error.message);
		if (error.stack) {
			console.error(error.stack);
		}
		process.exit(1);
	}
})();
