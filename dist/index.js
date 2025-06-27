"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const generate_1 = require("./commands/generate");
const clean_1 = require("./commands/clean");
const program = new commander_1.Command();
program
    .name("storybook-manager")
    .description("A CLI tool to automatically generate and clean Storybook stories for your React components.");
program
    .command("generate")
    .description("Recursively generate .stories.tsx files for all components in the components/ directory.")
    .action(generate_1.generateStories);
program
    .command("clean")
    .description("Recursively delete all .stories.tsx files from the components/ directory.")
    .action(clean_1.cleanStories);
program.parse(process.argv);
