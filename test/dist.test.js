import test, { before } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");

before(() => {
	execSync("npm run build", {
		cwd: rootDir,
		stdio: "inherit",
	});
});

test("test esm output", () => {
	const targetDir = path.join(rootDir, "fixtures", "esm");

	execSync("yarn", { cwd: targetDir, stdio: "inherit" });

	const output = execSync("npm run test --no-color", {
		cwd: targetDir,
		stdio: "pipe",
		env: {
			PATH: process.env.PATH,
			NO_COLOR: "1",
		},
	}).toString();

	assert.ok(output.includes("✓ ESM module works correctly"), "Should complete successfully");
});

test("test cjs output", () => {
	const targetDir = path.join(rootDir, "fixtures", "cjs");

	execSync("yarn", { cwd: targetDir, stdio: "inherit" });

	const output = execSync("npm run test --no-color", {
		cwd: targetDir,
		stdio: "pipe",
		env: {
			PATH: process.env.PATH,
			NO_COLOR: "1",
		},
	}).toString();

	assert.ok(output.includes("✓ CJS module works correctly"), "Should complete successfully");
});
