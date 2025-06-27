import fg from "fast-glob";
import { Project, SourceFile } from "ts-morph";
import path from "path";
import { capitalizeFirstLetter } from "../utils";

export async function generateStories() {
  console.log("Generating Storybook stories...");

  const componentPaths = await fg("components/**/*.tsx", {
    ignore: ["**/*.stories.tsx"],
  });

  const project = new Project();

  for (const componentPath of componentPaths) {
    const sourceFile = project.addSourceFileAtPath(componentPath);
    const componentName = path.basename(componentPath, ".tsx");
    const storyFilePath = componentPath.replace(".tsx", ".stories.tsx");

    let storyFileContent = `
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${capitalizeFirstLetter(componentName)}',
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
