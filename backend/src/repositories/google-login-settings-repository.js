const DEFAULT_SETTINGS = Object.freeze({
  id: "google-login-settings",
  defaultTenantKey: null,
  rules: [],
  updatedAt: null,
});

function normalizeSettings(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {}),
    rules: Array.isArray(settings?.rules) ? settings.rules : [],
  };
}

export class GoogleLoginSettingsRepository {
  constructor(store) {
    this.store = store;
    this.collection = "google-login-settings";
  }

  async getSettings() {
    const records = await this.store.readCollection(this.collection);
    return normalizeSettings(records[0]);
  }

  async saveSettings(settings) {
    const nextSettings = normalizeSettings(settings);
    await this.store.writeCollection(this.collection, [nextSettings]);
    return nextSettings;
  }
}
