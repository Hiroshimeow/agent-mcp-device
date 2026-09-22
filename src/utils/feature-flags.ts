class FeatureFlagManager {
  private flags: Record<string, any> = {};

  async initialize(): Promise<void> {}

  get(flagName: string, defaultValue: any = false): any {
    return this.flags[flagName] !== undefined ? this.flags[flagName] : defaultValue;
  }

  getAll(): Record<string, any> {
    return { ...this.flags };
  }

  async refresh(): Promise<boolean> {
    return true;
  }

  wasLoadedFromCache(): boolean {
    return false;
  }

  async waitForFreshFlags(): Promise<void> {}

  destroy(): void {}
}

export const featureFlagManager = new FeatureFlagManager();
