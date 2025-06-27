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
function isLocalDeclaration(prop, sourceFile) {
    const declSourceFile = prop.getSourceFile();
    return declSourceFile.getFilePath() === sourceFile.getFilePath();
}
function getComponentProps(sourceFile, componentName) {
    let props = [];
    const component = sourceFile.getFunction(componentName) ||
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
                        props.push(...t
                            .getProperties()
                            .map((p) => p.getDeclarations()[0]));
                    });
                }
                else {
                    props.push(...propsParamType
                        .getProperties()
                        .map((p) => p.getDeclarations()[0]));
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
                            props.push(...t
                                .getProperties()
                                .map((p) => p.getDeclarations()[0]));
                        });
                    }
                    else {
                        props.push(...propsType
                            .getProperties()
                            .map((p) => p.getDeclarations()[0]));
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
        if (isOptional)
            return; // Skip optional props
        if (propType.isString()) {
            args.push(`${propName}: "Sample Text"`);
        }
        else if (propType.isNumber()) {
            args.push(`${propName}: 123`);
        }
        else if (propType.isBoolean()) {
            args.push(`${propName}: true`);
        }
        else if (propType.isEnum()) {
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
        const defaultArgs = getComponentProps(sourceFile, primaryComponentNameForMeta);
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
