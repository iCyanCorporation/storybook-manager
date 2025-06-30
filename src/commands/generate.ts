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
  VariableDeclaration,
  FunctionDeclaration,
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

// Regex pattern for component name validation
const COMPONENT_NAME_PATTERN = /^[A-Z][a-zA-Z]*$/;

// Configuration
interface GenerateConfig {
  componentsDir: string;
  storyFileExtension: string;
}

const DEFAULT_CONFIG: GenerateConfig = {
  componentsDir: "components",
  storyFileExtension: ".stories.tsx",
};

function isLocalDeclaration(
  prop: PropertySignature,
  sourceFile: SourceFile
): boolean {
  try {
    const declSourceFile = prop.getSourceFile();
    return declSourceFile.getFilePath() === sourceFile.getFilePath();
  } catch (error) {
    console.warn("Failed to check local declaration:", error);
    return false;
  }
}

function isPropertySignature(node: Node): node is PropertySignature {
  return Node.isPropertySignature(node);
}

function isReactComponent(
  exportedComponent: string,
  componentDecl: VariableDeclaration | FunctionDeclaration | undefined
): boolean {
  if (!componentDecl) return false;

  // Check if it starts with capital letter (React component convention)
  if (!COMPONENT_NAME_PATTERN.test(exportedComponent)) {
    return false;
  }

  // Skip utility functions, variants, and non-component exports
  if (
    exportedComponent.toLowerCase().includes("utils") ||
    exportedComponent.toLowerCase().includes("config") ||
    exportedComponent.toLowerCase().includes("helper") ||
    exportedComponent.toLowerCase().includes("constant") ||
    exportedComponent.startsWith("use") || // hooks
    exportedComponent.endsWith("Context") ||
    exportedComponent.endsWith("Provider")
  ) {
    return false;
  }

  // Skip if it's a utility function like buttonVariants (created by cva)
  const componentText = componentDecl.getText();
  if (
    componentText.includes("cva(") ||
    componentText.includes("cn(") ||
    componentText.includes("clsx(") ||
    componentText.includes("twMerge(") ||
    (componentText.includes("variants") &&
      !componentText.includes("React.") &&
      !componentText.includes("<"))
  ) {
    return false;
  }

  return true;
}

function getComponentProps(
  sourceFile: SourceFile,
  componentName: string
): string {
  let props: PropertySignature[] = [];

  // Try to find the component
  const component =
    sourceFile.getFunction(componentName) ||
    sourceFile.getVariableDeclaration(componentName);

  // Look for interface/type definitions that might be props
  const interfaces = sourceFile.getInterfaces();
  const typeAliases = sourceFile.getTypeAliases();

  // Check for props interface (e.g., ButtonProps, MyComponentProps)
  const propsInterfaceName = `${componentName}Props`;
  const propsInterface = interfaces.find(
    (i) => i.getName() === propsInterfaceName
  );

  if (propsInterface) {
    props.push(...propsInterface.getProperties());
  } else {
    // Try to extract from component type
    if (component) {
      const componentType = component.getType();
      const callSignatures = componentType.getCallSignatures();

      if (callSignatures.length > 0) {
        const propsParam = callSignatures[0].getParameters()[0];
        if (propsParam) {
          const propsParamType = propsParam.getTypeAtLocation(component);
          if (propsParamType.isIntersection()) {
            propsParamType.getIntersectionTypes().forEach((t) => {
              const typeProps = t
                .getProperties()
                .map((p) => p.getDeclarations()[0])
                .filter(
                  (d): d is PropertySignature =>
                    d && Node.isPropertySignature(d)
                );
              props.push(...typeProps);
            });
          } else {
            const typeProps = propsParamType
              .getProperties()
              .map((p) => p.getDeclarations()[0])
              .filter(
                (d): d is PropertySignature => d && Node.isPropertySignature(d)
              );
            props.push(...typeProps);
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
                const typeProps = t
                  .getProperties()
                  .map((p) => p.getDeclarations()[0])
                  .filter(
                    (d): d is PropertySignature =>
                      d && Node.isPropertySignature(d)
                  );
                props.push(...typeProps);
              });
            } else {
              const typeProps = propsType
                .getProperties()
                .map((p) => p.getDeclarations()[0])
                .filter(
                  (d): d is PropertySignature =>
                    d && Node.isPropertySignature(d)
                );
              props.push(...typeProps);
            }
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

    // Include required props and some optional props for better examples
    if (propType.isString()) {
      args.push(`${propName}: "Sample Text"`);
    } else if (propType.isNumber()) {
      args.push(`${propName}: 123`);
    } else if (propType.isBoolean()) {
      args.push(`${propName}: true`);
    } else if (propType.isEnum() || propType.isUnion()) {
      const unionTypes = propType.getUnionTypes();
      if (unionTypes.length > 0) {
        const firstType = unionTypes[0];
        if (firstType.isStringLiteral()) {
          args.push(`${propName}: "${firstType.getLiteralValue()}"`);
        } else if (firstType.isNumberLiteral()) {
          args.push(`${propName}: ${firstType.getLiteralValue()}`);
        }
      }
    } else if (!isOptional) {
      // For unknown required types, provide a placeholder
      args.push(`${propName}: undefined // TODO: Provide appropriate value`);
    }
  });

  if (args.length === 0) {
    return "{}";
  }

  return `{
    ${args.join(",\n    ")}
  }`;
}

function getDecorators(sourceFile: SourceFile): string {
  const sourceText = sourceFile.getFullText();
  let decorators = "";

  if (sourceText.includes("useChart()")) {
    decorators += `
    (Story) => (
      <ChartContainer config={{ desktop: { label: 'Desktop', color: 'hsl(var(--chart-1))' } }}>
        <Story />
      </ChartContainer>
    ),
`;
  }

  if (sourceText.includes("useFormContext()")) {
    decorators += `
    (Story) => {
      const form = useForm();
      return (
        <FormProvider {...form}>
          <Story />
        </FormProvider>
      );
    },
`;
  }

  return decorators.length > 0 ? `[${decorators}]` : "[]";
}

export async function generateStories(config: Partial<GenerateConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  console.log("Generating Storybook stories...");

  const componentPaths = await fg(`${finalConfig.componentsDir}/**/*.tsx`, {
    ignore: ["**/*.stories.tsx"],
  });

  const project = new Project();
  const processedFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const componentPath of componentPaths) {
    try {
      const sourceFile = project.addSourceFileAtPath(componentPath);
      const rawComponentName = path.basename(componentPath, ".tsx");
      const componentName = toPascalCase(rawComponentName);
      const storyFilePath = componentPath.replace(
        ".tsx",
        finalConfig.storyFileExtension
      );

      // Get all exports (both named and default)
      const namedExports = sourceFile.getExportedDeclarations();
      const exportNames: string[] = [];
      let hasDefaultExport = false;
      let defaultExportName = "";
      const existingStoryNames = new Set<string>();

      namedExports.forEach((declarations, name) => {
        // Only include function, variable, or class exports (not types/interfaces)
        const decl = declarations[0];
        if (
          Node.isFunctionDeclaration(decl) ||
          Node.isVariableDeclaration(decl) ||
          Node.isClassDeclaration(decl)
        ) {
          if (name === "default") {
            hasDefaultExport = true;
            // Try to get the actual name of the default export
            if (Node.isVariableDeclaration(decl)) {
              defaultExportName = decl.getName();
            } else if (Node.isFunctionDeclaration(decl)) {
              defaultExportName = decl.getName() || componentName;
            } else {
              defaultExportName = componentName;
            }
          } else {
            exportNames.push(name);
          }
        }
      });

      // If no exports found, skip this file
      if (exportNames.length === 0 && !hasDefaultExport) {
        console.log(`Skipping ${componentPath}: No valid exports found`);
        continue;
      }

      // Build import statement
      let importStatement = "";
      if (hasDefaultExport && exportNames.length > 0) {
        importStatement = `import ${defaultExportName}, { ${exportNames.join(
          ", "
        )} } from './${rawComponentName}';`;
      } else if (hasDefaultExport) {
        importStatement = `import ${defaultExportName} from './${rawComponentName}';`;
      } else {
        importStatement = `import { ${exportNames.join(
          ", "
        )} } from './${rawComponentName}';`;
      }

      // Add imports for decorators if needed
      if (sourceFile.getFullText().includes("useChart()")) {
        if (!exportNames.includes("ChartContainer")) {
          importStatement += `\nimport { ChartContainer } from './chart';`;
        }
      }
      if (sourceFile.getFullText().includes("useFormContext()")) {
        importStatement += `\nimport { useForm, FormProvider } from 'react-hook-form';`;
      }

      // Use the relative path from components/ as part of the title and story export name
      const relPath = path
        .relative(finalConfig.componentsDir, componentPath)
        .replace(/\\/g, "/")
        .replace(/\.tsx$/, "");
      const relPathForTitle = relPath.split("/").map(toPascalCase).join("/");

      let storyFileContent = `
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
${importStatement}
`;

      // Determine the main component for the story
      const mainExport = hasDefaultExport ? defaultExportName : exportNames[0];
      const defaultArgs = getComponentProps(sourceFile, mainExport);
      const decorators = getDecorators(sourceFile);

      // Prefix the title with the relative path and component name to ensure uniqueness
      const storyTitle = `Components/${relPathForTitle}/${mainExport}`;

      storyFileContent += `
const meta = {
  title: '${storyTitle}',
  component: ${mainExport},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
  decorators: ${decorators},
} satisfies Meta<typeof ${mainExport}>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: ${defaultArgs},
};
`;

      existingStoryNames.add("Primary");

      // Create stories for additional exported components, avoiding naming conflicts
      const additionalExports = hasDefaultExport
        ? exportNames
        : exportNames.slice(1);

      for (const exportedComponent of additionalExports) {
        // Skip if this would create a duplicate story name
        if (exportedComponent === mainExport) continue;

        // Check if this export is actually a React component by examining its declaration
        const componentDecl =
          sourceFile.getVariableDeclaration(exportedComponent) ||
          sourceFile.getFunction(exportedComponent);

        if (!isReactComponent(exportedComponent, componentDecl)) {
          continue;
        }

        const componentArgs = getComponentProps(sourceFile, exportedComponent);

        // Create a unique story name to avoid conflicts with imported component names
        let storyName = `${exportedComponent}Story`;
        let counter = 1;
        while (existingStoryNames.has(storyName)) {
          storyName = `${exportedComponent}Story${counter}`;
          counter++;
        }
        existingStoryNames.add(storyName);

        storyFileContent += `
export const ${storyName}: Story = {
  args: ${componentArgs},
};
`;
      }

      project
        .createSourceFile(storyFilePath, storyFileContent, { overwrite: true })
        .saveSync();

      processedFiles.push(componentPath);
      console.log(`Generated: ${storyFilePath}`);

      // Clean up memory by removing the source file from the project
      project.removeSourceFile(sourceFile);
    } catch (error) {
      failedFiles.push(componentPath);
      console.warn(
        `Failed to process ${componentPath}:`,
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }
  }

  // Summary
  console.log(`\nStory generation complete!`);
  console.log(`✅ Successfully processed: ${processedFiles.length} files`);
  if (failedFiles.length > 0) {
    console.log(`❌ Failed to process: ${failedFiles.length} files`);
    console.log(`Failed files:`, failedFiles);
  }
}
