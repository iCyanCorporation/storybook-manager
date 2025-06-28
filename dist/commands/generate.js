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
// ... (unchanged utility functions)
function isLocalDeclaration(prop, sourceFile) {
    const declSourceFile = prop.getSourceFile();
    return declSourceFile.getFilePath() === sourceFile.getFilePath();
}
function getComponentProps(sourceFile, componentName) {
    let props = [];
    // Try to find the component
    const component = sourceFile.getFunction(componentName) ||
        sourceFile.getVariableDeclaration(componentName);
    // Look for interface/type definitions that might be props
    const interfaces = sourceFile.getInterfaces();
    const typeAliases = sourceFile.getTypeAliases();
    // Check for props interface (e.g., ButtonProps, MyComponentProps)
    const propsInterfaceName = `${componentName}Props`;
    const propsInterface = interfaces.find((i) => i.getName() === propsInterfaceName);
    if (propsInterface) {
        props.push(...propsInterface.getProperties());
    }
    else {
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
                                .filter((d) => d && ts_morph_1.Node.isPropertySignature(d));
                            props.push(...typeProps);
                        });
                    }
                    else {
                        const typeProps = propsParamType
                            .getProperties()
                            .map((p) => p.getDeclarations()[0])
                            .filter((d) => d && ts_morph_1.Node.isPropertySignature(d));
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
                if (initializer && ts_morph_1.Node.isCallExpression(initializer)) {
                    const typeArgs = initializer.getTypeArguments();
                    if (typeArgs.length > 1) {
                        const propsTypeNode = typeArgs[1];
                        const propsType = propsTypeNode.getType();
                        if (propsType.isIntersection()) {
                            propsType.getIntersectionTypes().forEach((t) => {
                                const typeProps = t
                                    .getProperties()
                                    .map((p) => p.getDeclarations()[0])
                                    .filter((d) => d && ts_morph_1.Node.isPropertySignature(d));
                                props.push(...typeProps);
                            });
                        }
                        else {
                            const typeProps = propsType
                                .getProperties()
                                .map((p) => p.getDeclarations()[0])
                                .filter((d) => d && ts_morph_1.Node.isPropertySignature(d));
                            props.push(...typeProps);
                        }
                    }
                }
            }
        }
    }
    // Filter out React HTML attributes, duplicates, and non-local declarations
    const seen = new Set();
    const args = [];
    props.forEach((prop) => {
        if (!prop)
            return;
        const propName = prop.getName();
        if (REACT_HTML_PROPS.includes(propName) ||
            seen.has(propName) ||
            !isLocalDeclaration(prop, sourceFile))
            return;
        seen.add(propName);
        const propType = prop.getType();
        const isOptional = prop.hasQuestionToken();
        // Include required props and some optional props for better examples
        if (propType.isString()) {
            args.push(`${propName}: "Sample Text"`);
        }
        else if (propType.isNumber()) {
            args.push(`${propName}: 123`);
        }
        else if (propType.isBoolean()) {
            args.push(`${propName}: true`);
        }
        else if (propType.isEnum() || propType.isUnion()) {
            const unionTypes = propType.getUnionTypes();
            if (unionTypes.length > 0) {
                const firstType = unionTypes[0];
                if (firstType.isStringLiteral()) {
                    args.push(`${propName}: "${firstType.getLiteralValue()}"`);
                }
                else if (firstType.isNumberLiteral()) {
                    args.push(`${propName}: ${firstType.getLiteralValue()}`);
                }
            }
        }
        else if (!isOptional) {
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
function getDecorators(sourceFile) {
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
        // Get all exports (both named and default)
        const namedExports = sourceFile.getExportedDeclarations();
        const exportNames = [];
        let hasDefaultExport = false;
        let defaultExportName = "";
        namedExports.forEach((declarations, name) => {
            // Only include function, variable, or class exports (not types/interfaces)
            const decl = declarations[0];
            if (ts_morph_1.Node.isFunctionDeclaration(decl) ||
                ts_morph_1.Node.isVariableDeclaration(decl) ||
                ts_morph_1.Node.isClassDeclaration(decl)) {
                if (name === "default") {
                    hasDefaultExport = true;
                    // Try to get the actual name of the default export
                    if (ts_morph_1.Node.isVariableDeclaration(decl)) {
                        defaultExportName = decl.getName();
                    }
                    else if (ts_morph_1.Node.isFunctionDeclaration(decl)) {
                        defaultExportName = decl.getName() || componentName;
                    }
                    else {
                        defaultExportName = componentName;
                    }
                }
                else {
                    exportNames.push(name);
                }
            }
        });
        // If no exports found, skip this file
        if (exportNames.length === 0 && !hasDefaultExport)
            continue;
        // Build import statement
        let importStatement = "";
        if (hasDefaultExport && exportNames.length > 0) {
            importStatement = `import ${defaultExportName}, { ${exportNames.join(", ")} } from './${rawComponentName}';`;
        }
        else if (hasDefaultExport) {
            importStatement = `import ${defaultExportName} from './${rawComponentName}';`;
        }
        else {
            importStatement = `import { ${exportNames.join(", ")} } from './${rawComponentName}';`;
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
        const relPath = path_1.default
            .relative("components", componentPath)
            .replace(/\\/g, "/")
            .replace(/\.tsx$/, "");
        const relPathForTitle = relPath.split("/").map(utils_1.toPascalCase).join("/");
        const relPathForExport = relPath.replace(/\/|-/g, "_");
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
        // Create stories for additional exported components, avoiding naming conflicts
        const additionalExports = hasDefaultExport
            ? exportNames
            : exportNames.slice(1);
        for (const exportedComponent of additionalExports) {
            // Skip if this would create a duplicate story name
            if (exportedComponent === mainExport)
                continue;
            // Skip utility functions, variants, and non-component exports
            if (exportedComponent.toLowerCase().includes("utils") ||
                exportedComponent.toLowerCase().includes("config") ||
                exportedComponent.toLowerCase().includes("helper") ||
                exportedComponent.toLowerCase().includes("constant") ||
                exportedComponent.startsWith("use") || // hooks
                exportedComponent.endsWith("Context") ||
                exportedComponent.endsWith("Provider") ||
                !exportedComponent.match(/^[A-Z]/) // Only components that start with capital letter
            ) {
                continue;
            }
            // Check if this export is actually a React component by examining its declaration
            const componentDecl = sourceFile.getVariableDeclaration(exportedComponent) ||
                sourceFile.getFunction(exportedComponent);
            if (!componentDecl)
                continue;
            // Skip if it's a utility function like buttonVariants (created by cva)
            const componentText = componentDecl.getText();
            if (componentText.includes("cva(") ||
                componentText.includes("cn(") ||
                componentText.includes("clsx(") ||
                componentText.includes("twMerge(") ||
                (componentText.includes("variants") &&
                    !componentText.includes("React.") &&
                    !componentText.includes("<"))) {
                continue;
            }
            // Very inclusive detection for React components
            // If it starts with capital letter and doesn't contain obvious utility patterns, include it
            const looksLikeComponent = exportedComponent.match(/^[A-Z][a-zA-Z]*$/);
            // Include it if it looks like a component name
            if (!looksLikeComponent) {
                continue;
            }
            const args = getComponentProps(sourceFile, exportedComponent);
            // Create a unique story name to avoid conflicts with imported component names
            const storyName = `${exportedComponent}Story`;
            storyFileContent += `
export const ${storyName}: Story = {
  args: ${args},
};
`;
        }
        project
            .createSourceFile(storyFilePath, storyFileContent, { overwrite: true })
            .saveSync();
        console.log(`Generated: ${storyFilePath}`);
    }
    console.log("Story generation complete!");
}
