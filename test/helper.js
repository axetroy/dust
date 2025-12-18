import path from "node:path";
import fs from "node:fs";

/**
 * Create a test directory structure
 * @param {Object} structure - Directory structure as nested object
 * @param {string} baseDir - Base directory to create structure in
 */
export function createStructure(structure, baseDir) {
	if (!fs.existsSync(baseDir)) {
		fs.mkdirSync(baseDir, { recursive: true });
	}

	for (const [name, content] of Object.entries(structure)) {
		const fullPath = path.join(baseDir, name);

		if (typeof content === "object" && content !== null) {
			// It's a directory
			fs.mkdirSync(fullPath, { recursive: true });
			createStructure(content, fullPath);
		} else {
			// It's a file
			fs.writeFileSync(fullPath, content || "", "utf8");
		}
	}
}
