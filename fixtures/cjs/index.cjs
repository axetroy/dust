const dust = require("dust");
const { parseRules, findTargets } = require("dust");

console.log("Default export:", dust);
console.log("Has parseRules:", typeof dust.parseRules === "function");
console.log("Has findTargets:", typeof dust.findTargets === "function");
console.log("Has executeCleanup:", typeof dust.executeCleanup === "function");

// Test basic parsing
const dsl = "delete target when exists Cargo.toml";
const rules = parseRules(dsl);
console.log("Parsed rules:", JSON.stringify(rules, null, 2));

console.log("\n✓ CJS module works correctly");
