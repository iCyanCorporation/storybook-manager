"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanStories = cleanStories;
const fast_glob_1 = __importDefault(require("fast-glob"));
const promises_1 = __importDefault(require("fs/promises"));
async function cleanStories() {
    console.log("Cleaning Storybook stories...");
    const storyPaths = await (0, fast_glob_1.default)("components/**/*.stories.tsx");
    for (const storyPath of storyPaths) {
        await promises_1.default.unlink(storyPath);
        console.log(`Deleted: ${storyPath}`);
    }
    console.log("Story cleanup complete!");
}
