import fg from "fast-glob";
import { Project, SourceFile, SyntaxKind, Node } from "ts-morph"; // Added Node import
import path from "path";
import { capitalizeFirstLetter, toPascalCase } from "../utils";

export async function generateStories() {
  console.log("Generating Storybook stories...");

  const componentPaths = await fg("components/**/*.tsx", {
    ignore: ["**/*.stories.tsx"],
  });

  const project = new Project();

  for (const componentPath of componentPaths) {
    const sourceFile = project.addSourceFileAtPath(componentPath);
    const rawComponentName = path.basename(componentPath, ".tsx");
    const componentName = toPascalCase(rawComponentName);
    const storyFilePath = componentPath.replace(".tsx", ".stories.tsx");

    const capitalizedComponentName = componentName; // Already PascalCase
    const namedExports = sourceFile.getExportedDeclarations();
    const exportNames: string[] = [];
    let primaryComponentNameForMeta = capitalizedComponentName;

    // Collect all named exports
    namedExports.forEach((declarations, name) => {
      if (name === "default") {
        const defaultExportDeclaration = declarations[0];
        if (defaultExportDeclaration) {
          // Attempt to get the name if it's a FunctionDeclaration or VariableDeclaration
          if (
            Node.isFunctionDeclaration(defaultExportDeclaration) ||
            Node.isVariableDeclaration(defaultExportDeclaration)
          ) {
            const actualName = defaultExportDeclaration.getName();
            if (actualName) {
              exportNames.push(actualName);
              primaryComponentNameForMeta = actualName; // Use the actual name for meta component
            } else {
              exportNames.push(capitalizedComponentName);
            }
          } else if (Node.isClassDeclaration(defaultExportDeclaration)) {
            const actualName = defaultExportDeclaration.getName();
            if (actualName) {
              exportNames.push(actualName);
              primaryComponentNameForMeta = actualName;
            } else {
              exportNames.push(capitalizedComponentName);
            }
          } else {
            // For other default exports (e.g., expressions), fallback to capitalized component name
            exportNames.push(capitalizedComponentName);
          }
        } else {
          exportNames.push(capitalizedComponentName);
        }
      } else {
        exportNames.push(name);
      }
    });

    // Filter out duplicates and ensure the primary component name is included
    const uniqueExportNames = Array.from(new Set(exportNames));
    const otherExports = uniqueExportNames.filter(
      (exp) => exp !== primaryComponentNameForMeta
    );

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
