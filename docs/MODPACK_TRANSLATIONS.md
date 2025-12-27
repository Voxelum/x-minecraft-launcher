# Modpack Translation Support

This document describes the modpack translation feature that allows users to install community-made translations for Minecraft modpacks.

## Overview

The translation feature adds the following UI elements:
1. A "Download Translated" button to install modpacks with translations
2. A chip showing the number of supported languages (e.g., "3+ Languages Supported")
3. A "Translation Team" section displaying translation teams and their websites

## Architecture

### Data Model

Translation data is represented by the `TranslationTeam` interface:

```typescript
interface TranslationTeam {
  id: string        // Unique identifier for the translation team
  name: string      // Name of the translation team (e.g., "minecraft-inside.ru", "Team X")
  url: string       // Website URL where translations can be downloaded
  language: string  // Language code or name (e.g., "ru", "zh-CN", "Russian")
}
```

### UI Components

1. **StoreProjectTranslations.vue**: Displays the list of translation teams in the project details sidebar
2. **StoreProjectHeader.vue**: Shows the "Download Translated" button and language count chip
3. **StoreProject.vue**: Main container that orchestrates the display

### Integration Points

Translation data is added to the `StoreProject` interface via the optional `translations` array:

```typescript
interface StoreProject {
  // ... other fields
  translations?: Array<TranslationTeam>
}
```

Currently, the `translations` array is initialized as empty in:
- `StoreProjectCurseforge.vue`
- `StoreProjectModrinth.vue`
- `StoreProjectFeedTheBeast.vue`

## Adding Translation Data

To add translation data for a modpack, you'll need to populate the `translations` array in the respective view component. This can be done through:

1. **Backend API**: Create a service that returns translation metadata for modpacks
2. **Community Database**: Maintain a database of community translations mapped to project IDs
3. **Project Metadata**: Store translation information in the modpack metadata files

### Example Implementation

```typescript
// In StoreProjectCurseforge.vue or similar
const project = computed(() => {
  const p = proj.value
  if (!p) return undefined
  
  // Fetch or define translations for this project
  const translations: TranslationTeam[] = [
    {
      id: 'minecraft-inside-ru',
      name: 'minecraft-inside.ru',
      url: 'https://minecraft-inside.ru/translations/stoneblock-4',
      language: 'Russian'
    },
    {
      id: 'team-x',
      name: 'Team X',
      url: 'https://example.com/team-x-translations',
      language: 'Chinese'
    }
  ]
  
  const result: IStoreProject = {
    // ... other fields
    translations: translations,
  }
  return result
})
```

## Installation Flow

When a user clicks the "Download Translated" button, the `onInstallTranslated` handler is called. The current implementation is a placeholder:

```typescript
const onInstallTranslated = () => {
  // TODO: Implement translation selection dialog
  // 1. Show a dialog to select translation team/language
  // 2. Download the translated resource pack/language files
  // 3. Install the modpack with the translations
  console.log('Install translated modpack requested')
}
```

To fully implement this feature:

1. Create a translation selection dialog component
2. Implement download logic for translation files
3. Integrate translation files with the modpack installation process
4. Store translation preferences in instance metadata

## Localization

Translation strings are defined in the locale files (e.g., `locales/en.yaml`):

```yaml
modpack:
  translationTeam: Translation Team
  noTranslationsAvailable: No translations available
  languagesSupported: '{count}+ Languages Supported'
  downloadTranslated: Download Translated
```

Add corresponding translations to other locale files as needed.

## Future Enhancements

1. **Translation Selection Dialog**: Allow users to choose specific translation teams
2. **Automatic Translation Detection**: Detect user's language preference and suggest translations
3. **Translation Rating System**: Let users rate and review translations
4. **In-Launcher Translation Management**: Allow users to manage installed translations
5. **Translation Update Notifications**: Notify users when translations are updated
6. **Backend Integration**: Create a backend service to manage translation metadata
