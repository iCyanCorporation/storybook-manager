import { Command } from "commander";
import { generateStories } from "./commands/generate";
import { cleanStories } from "./commands/clean";

const program = new Command();

program
  .name("storybook-manager")
  .description(
    "A CLI tool to automatically generate and clean Storybook stories for your React components."
  );

program
  .command("generate")
  .description(
    "Recursively generate .stories.tsx files for all components in the components/ directory."
  )
  .action(generateStories);

program
  .command("clean")
  .description(
    "Recursively delete all .stories.tsx files from the components/ directory."
  )
  .action(cleanStories);

program.parse(process.argv);
