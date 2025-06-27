"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStories = generateStories;
const fast_glob_1 = __importDefault(require("fast-glob"));
const ts_morph_1 = require("ts-morph");
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
async function generateStories() {
    console.log("Generating Storybook stories...");
    const componentPaths = await (0, fast_glob_1.default)("components/**/*.tsx", {
        ignore: ["**/*.stories.tsx"],
    });
    const project = new ts_morph_1.Project();
    for (const componentPath of componentPaths) {
        const sourceFile = project.addSourceFileAtPath(componentPath);
        const componentName = path_1.default.basename(componentPath, ".tsx");
        const storyFilePath = componentPath.replace(".tsx", ".stories.tsx");
        let storyFileContent = `
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${(0, utils_1.capitalizeFirstLetter)(componentName)}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {
  args: {},
};
`;
        project
            .createSourceFile(storyFilePath, storyFileContent, { overwrite: true })
            .saveSync();
        console.log(`Generated: ${storyFilePath}`);
    }
    console.log("Story generation complete!");
}
