/* Theme Manager */
import { Storage } from './storage.js';

export class ThemeManager {
  constructor() {
    this.currentTheme = Storage.getSettings().theme || 'nordic';
    this.applyTheme(this.currentTheme);
  }

  applyTheme(themeName) {
    const validThemes = ['sage', 'lavender', 'nordic', 'sunset', 'midnight'];
    if (!validThemes.includes(themeName)) themeName = 'nordic';

    document.documentElement.setAttribute('data-theme', themeName);
    this.currentTheme = themeName;

    // Update settings in storage
    const settings = Storage.getSettings();
    settings.theme = themeName;
    Storage.saveSettings(settings);

    // Update active swatch state in DOM
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
      if (swatch.dataset.theme === themeName) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });
  }
}
