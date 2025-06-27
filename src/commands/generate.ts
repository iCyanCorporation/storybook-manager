import fg from "fast-glob";
import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  PropertySignature,
  Type,
} from "ts-morph";
import path from "path";
import { capitalizeFirstLetter, toPascalCase } from "../utils";

// Common React HTML attributes to exclude from args
const REACT_HTML_PROPS = [
  "children",
  "className",
  "style",
  "id",
  "tabIndex",
  "role",
  "title",
  "onClick",
  "onChange",
  "onFocus",
  "onBlur",
  "ref",
  "key",
];

function isLocalDeclaration(
  prop: PropertySignature,
  sourceFile: SourceFile
): boolean {
  const declSourceFile = prop.getSourceFile();
  return declSourceFile.getFilePath() === sourceFile.getFilePath();
}

function getComponentProps(
  sourceFile: SourceFile,
  componentName: string
): string {
  let props: PropertySignature[] = [];

  const component =
    sourceFile.getFunction(componentName) ||
    sourceFile.getVariableDeclaration(componentName);

  if (component) {
    const componentType = component.getType();
    const callSignatures = componentType.getCallSignatures();

    if (callSignatures.length > 0) {
      const propsParam = callSignatures[0].getParameters()[0];
      if (propsParam) {
        const propsParamType = propsParam.getTypeAtLocation(component);
        if (propsParamType.isIntersection()) {
          propsParamType.getIntersectionTypes().forEach((t) => {
            props.push(
              ...t
                .getProperties()
                .map((p) => p.getDeclarations()[0] as PropertySignature)
            );
          });
        } else {
          props.push(
            ...propsParamType
              .getProperties()
              .map((p) => p.getDeclarations()[0] as PropertySignature)
          );
        }
      }
    }
  }

  // Fallback for React.forwardRef
  if (props.length === 0) {
    const forwardRef = sourceFile.getVariableDeclaration(componentName);
    if (forwardRef) {
      const initializer = forwardRef.getInitializer();
      if (initializer && Node.isCallExpression(initializer)) {
        const typeArgs = initializer.getTypeArguments();
        if (typeArgs.length > 1) {
          const propsTypeNode = typeArgs[1];
          const propsType = propsTypeNode.getType();
          if (propsType.isIntersection()) {
            propsType.getIntersectionTypes().forEach((t) => {
              props.push(
                ...t
                  .getProperties()
                  .map((p) => p.getDeclarations()[0] as PropertySignature)
              );
            });
          } else {
            props.push(
              ...propsType
                .getProperties()
                .map((p) => p.getDeclarations()[0] as PropertySignature)
            );
          }
        }
      }
    }
  }

  // Filter out React HTML attributes, duplicates, and non-local declarations
  const seen = new Set<string>();
  const args: string[] = [];

  props.forEach((prop) => {
    if (!prop) return;
    const propName = prop.getName();
    if (
      REACT_HTML_PROPS.includes(propName) ||
      seen.has(propName) ||
      !isLocalDeclaration(prop, sourceFile)
    )
      return;
    seen.add(propName);

    const propType = prop.getType();
    const isOptional = prop.hasQuestionToken();

    if (isOptional) return; // Skip optional props

    if (propType.isString()) {
      args.push(`${propName}: "Sample Text"`);
    } else if (propType.isNumber()) {
      args.push(`${propName}: 123`);
    } else if (propType.isBoolean()) {
      args.push(`${propName}: true`);
    } else if (propType.isEnum()) {
      const enumMembers = propType.getUnionTypes();
      if (enumMembers.length > 0) {
        const firstMember = enumMembers[0];
        if (firstMember.isStringLiteral()) {
          args.push(`${propName}: "${firstMember.getLiteralValue()}"`);
        }
      }
    }
  });

  return `{
    ${args.join(",\n    ")}
  }`;
}

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

    const defaultArgs = getComponentProps(
      sourceFile,
      primaryComponentNameForMeta
    );

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
  args: ${defaultArgs},
};
`;

    project
      .createSourceFile(storyFilePath, storyFileContent, { overwrite: true })
      .saveSync();
    console.log(`Generated: ${storyFilePath}`);
  }

  console.log("Story generation complete!");
}
