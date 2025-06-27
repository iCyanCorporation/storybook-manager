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
        // Get all named exports (excluding types)
        const namedExports = sourceFile.getExportedDeclarations();
        const exportNames = [];
        namedExports.forEach((declarations, name) => {
            // Only include function, variable, or class exports (not types/interfaces)
            const decl = declarations[0];
            if (ts_morph_1.Node.isFunctionDeclaration(decl) ||
                ts_morph_1.Node.isVariableDeclaration(decl) ||
                ts_morph_1.Node.isClassDeclaration(decl)) {
                exportNames.push(name);
            }
        });
        if (exportNames.length === 0)
            continue;
        let importStatement = `import { ${exportNames.join(", ")} } from './${rawComponentName}';`;
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
        exportNames.forEach((exportedComponent, idx) => {
            const defaultArgs = getComponentProps(sourceFile, exportedComponent);
            // Prefix the title with the relative path and component name to ensure uniqueness
            const storyTitle = `Components/${relPathForTitle}/${exportedComponent}`;
            storyFileContent += `
const meta_${exportedComponent}: Meta<typeof ${exportedComponent}> = {
  title: '${storyTitle}',
  component: ${exportedComponent},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
};
`;
            // Only the first meta is exported as default
            if (idx === 0) {
                storyFileContent += `
export default meta_${exportedComponent};
`;
            }
            else {
                storyFileContent += `
export { meta_${exportedComponent} };
`;
            }
            // Prefix the story export name with the relative path and component name
            const storyExportName = `Default_${relPathForExport}_${exportedComponent}`;
            storyFileContent += `
type Story_${exportedComponent} = StoryObj<typeof ${exportedComponent}>;

export const ${storyExportName}: Story_${exportedComponent} = {
  args: ${defaultArgs},
};
`;
        });
        project
            .createSourceFile(storyFilePath, storyFileContent, { overwrite: true })
            .saveSync();
        console.log(`Generated: ${storyFilePath}`);
    }
    console.log("Story generation complete!");
}
