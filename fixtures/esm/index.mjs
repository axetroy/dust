import dedust from "dedust";
import { parseRules, findTargets } from "dedust";

console.log("Default export:", dedust);
console.log("Has parseRules:", typeof dedust.parseRules === "function");
console.log("Has findTargets:", typeof dedust.findTargets === "function");
console.log("Has executeCleanup:", typeof dedust.executeCleanup === "function");

// Test basic parsing
const dsl = "delete target when exists Cargo.toml";
const rules = parseRules(dsl);
console.log("Parsed rules:", JSON.stringify(rules, null, 2));

console.log("\n✓ ESM module works correctly");
