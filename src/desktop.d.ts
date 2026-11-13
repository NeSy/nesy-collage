interface Window {
  desktop?: {
    saveProject(project: string): Promise<void>;
  };
}
