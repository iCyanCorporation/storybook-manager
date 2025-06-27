import fg from "fast-glob";
import fs from "fs/promises";

export async function cleanStories() {
  console.log("Cleaning Storybook stories...");

  const storyPaths = await fg("components/**/*.stories.tsx");

  for (const storyPath of storyPaths) {
    await fs.unlink(storyPath);
    console.log(`Deleted: ${storyPath}`);
  }

  console.log("Story cleanup complete!");
}
