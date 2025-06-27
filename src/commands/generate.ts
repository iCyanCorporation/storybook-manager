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

    // Get all named exports (excluding types)
    const namedExports = sourceFile.getExportedDeclarations();
    const exportNames: string[] = [];
    namedExports.forEach((declarations, name) => {
      // Only include function, variable, or class exports (not types/interfaces)
      const decl = declarations[0];
      if (
        Node.isFunctionDeclaration(decl) ||
        Node.isVariableDeclaration(decl) ||
        Node.isClassDeclaration(decl)
      ) {
        exportNames.push(name);
      }
    });

    if (exportNames.length === 0) continue;

    let importStatement = `import { ${exportNames.join(
      ", "
    )} } from './${rawComponentName}';`;

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
      .relative("components", componentPath)
      .replace(/\\/g, "/")
      .replace(/\.tsx$/, "");
    const relPathForTitle = relPath.split("/").map(toPascalCase).join("/");
    const relPathForExport = relPath.replace(/\/|-/g, "_");

    let storyFileContent = `
import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
${importStatement}
`;

    exportNames.forEach((exportedComponent, idx) => {
      const defaultArgs = getComponentProps(sourceFile, exportedComponent);
      const decorators = getDecorators(sourceFile);

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
  decorators: ${decorators},
};
`;

      // Only the first meta is exported as default
      if (idx === 0) {
        storyFileContent += `
export default meta_${exportedComponent};
`;
      } else {
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
