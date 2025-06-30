interface GenerateConfig {
    componentsDir: string;
    storyFileExtension: string;
}
export declare function generateStories(config?: Partial<GenerateConfig>): Promise<void>;
export {};
