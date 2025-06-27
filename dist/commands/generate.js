"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStories = generateStories;
const fast_glob_1 = __importDefault(require("fast-glob"));
const ts_morph_1 = require("ts-morph"); // Added Node import
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
        const rawComponentName = path_1.default.basename(componentPath, ".tsx");
        const componentName = (0, utils_1.toPascalCase)(rawComponentName);
        const storyFilePath = componentPath.replace(".tsx", ".stories.tsx");
        const capitalizedComponentName = componentName; // Already PascalCase
        const namedExports = sourceFile.getExportedDeclarations();
        const exportNames = [];
        let primaryComponentNameForMeta = capitalizedComponentName;
        // Collect all named exports
        namedExports.forEach((declarations, name) => {
            if (name === "default") {
                const defaultExportDeclaration = declarations[0];
                if (defaultExportDeclaration) {
                    // Attempt to get the name if it's a FunctionDeclaration or VariableDeclaration
                    if (ts_morph_1.Node.isFunctionDeclaration(defaultExportDeclaration) ||
                        ts_morph_1.Node.isVariableDeclaration(defaultExportDeclaration)) {
                        const actualName = defaultExportDeclaration.getName();
                        if (actualName) {
                            exportNames.push(actualName);
                            primaryComponentNameForMeta = actualName; // Use the actual name for meta component
                        }
                        else {
                            exportNames.push(capitalizedComponentName);
                        }
                    }
                    else if (ts_morph_1.Node.isClassDeclaration(defaultExportDeclaration)) {
                        const actualName = defaultExportDeclaration.getName();
                        if (actualName) {
                            exportNames.push(actualName);
                            primaryComponentNameForMeta = actualName;
                        }
                        else {
                            exportNames.push(capitalizedComponentName);
                        }
                    }
                    else {
                        // For other default exports (e.g., expressions), fallback to capitalized component name
                        exportNames.push(capitalizedComponentName);
                    }
                }
                else {
                    exportNames.push(capitalizedComponentName);
                }
            }
            else {
                exportNames.push(name);
            }
        });
        // Filter out duplicates and ensure the primary component name is included
        const uniqueExportNames = Array.from(new Set(exportNames));
        const otherExports = uniqueExportNames.filter((exp) => exp !== primaryComponentNameForMeta);
        let importStatement = `import { ${primaryComponentNameForMeta}`;
        if (otherExports.length > 0) {
            importStatement += `, ${otherExports.join(", ")}`;
        }
        importStatement += ` } from './${rawComponentName}';`;
        let storyFileContent = `
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
${importStatement}

const meta: Meta<typeof ${primaryComponentNameForMeta}> = {
  title: 'Components/${capitalizedComponentName}',
  component: ${primaryComponentNameForMeta},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ${primaryComponentNameForMeta}>;

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
