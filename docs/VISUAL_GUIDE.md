# Modpack Translation Feature - Visual Guide

This document provides a visual explanation of the implemented UI elements and how they map to the original feature request.

## Original Mockup Reference

The feature request included a mockup image showing three key areas:
1. **Button 1**: "Download Translated" button
2. **Button 2**: "3+ Languages Supported" indicator
3. **Section 3**: "Translation Team" list with team names

## Implemented UI Elements

### 1. Download Translated Button

**Location**: In the modpack header, next to the regular Install button

**Component**: `StoreProjectHeader.vue`

**Visual Characteristics**:
- Green button with success color (`color="success"`)
- Outlined style (not filled)
- Translate icon on the left
- Text: "Download Translated"
- Only visible when `project.translations.length > 0`

**Code Snippet**:
```vue
<v-btn
  v-if="project.translations && project.translations.length > 0"
  color="success"
  outlined
  :loading="installing"
  @click="$emit('install-translated')"
>
  <v-icon left class="material-icons-outlined">
    translate
  </v-icon>
  {{ t('modpack.downloadTranslated') }}
</v-btn>
```

**Placement**:
```
┌─────────────────────────────────────────┐
│  [Icon]                                  │
│  Modpack Title                           │
│  Description                             │
│  [Category] [Category] [3+ Languages]   │
│                                          │
│  [Download Translated] [Install] [Play] │
└─────────────────────────────────────────┘
```

---

### 2. Languages Supported Chip

**Location**: Below the description, alongside category chips

**Component**: `StoreProjectHeader.vue`

**Visual Characteristics**:
- Small chip with success color
- Outlined style
- Translate icon on the left
- Text: "3+ Languages Supported" (count is dynamic)
- Only visible when translations exist

**Code Snippet**:
```vue
<v-chip
  v-if="project.translations && project.translations.length > 0"
  small
  color="success"
  outlined
>
  <v-icon left small>
    translate
  </v-icon>
  {{ t('modpack.languagesSupported', { count: project.translations.length }) }}
</v-chip>
```

**Placement**:
```
┌─────────────────────────────────────────┐
│  Modpack Title                           │
│  Description text here...                │
│                                          │
│  [Reconnaissance] [Magic] [Technology]   │
│  [3+ Languages Supported]                │
└─────────────────────────────────────────┘
```

---

### 3. Translation Team Section

**Location**: In the left sidebar, between Project Members and Tags

**Component**: `StoreProjectTranslations.vue`

**Visual Characteristics**:
- Section header: "Translation Team"
- List of translation teams with:
  - Team name (clickable)
  - Team URL (as subtitle)
  - Language chip (outlined, small)
- Grid layout (3 columns on larger screens)
- Empty state message when no translations available

**Code Snippet**:
```vue
<div>
  <v-subheader>
    {{ t('modpack.translationTeam') }}
  </v-subheader>
  <v-list color="transparent" class="xl:(flex-col flex) grid grid-cols-3">
    <v-list-item
      v-for="trans of translations"
      :key="trans.id"
      @click="onClick(trans)"
    >
      <v-list-item-content>
        <v-list-item-title v-text="trans.name" />
        <v-list-item-subtitle v-text="trans.url" />
      </v-list-item-content>
      <v-list-item-action>
        <v-chip small outlined>
          {{ trans.language }}
        </v-chip>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</div>
```

**Placement**:
```
┌──────────────────────────────────────┐
│  ┌────────────────────────────────┐  │
│  │ External Links                 │  │
│  │ • Issues                       │  │
│  │ • Source                       │  │
│  ├────────────────────────────────┤  │
│  │ Project Members                │  │
│  │ • Author 1                     │  │
│  │ • Author 2                     │  │
│  ├────────────────────────────────┤  │
│  │ Translation Team               │  │
│  │ • minecraft-inside.ru [RU]     │  │
│  │ • Team X              [CN]     │  │
│  │ • Gamer Y             [ES]     │  │
│  ├────────────────────────────────┤  │
│  │ Tags                           │  │
│  │ [Tag1] [Tag2]                  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## Data Flow

### Translation Data Structure

```typescript
interface TranslationTeam {
  id: string        // Unique ID: "minecraft-inside-ru"
  name: string      // Display name: "minecraft-inside.ru"
  url: string       // Website: "https://minecraft-inside.ru/..."
  language: string  // Language: "Russian" or "ru"
}
```

### How Data Flows Through Components

```
StoreProjectCurseforge.vue (or Modrinth/FTB)
  ↓ Creates project object with translations array
  ↓
StoreProject.vue (Main container)
  ↓ Passes to header and sidebar
  ├→ StoreProjectHeader.vue
  │    ↓ Shows button and chip if translations exist
  │    ↓ Emits 'install-translated' event
  │
  └→ StoreProjectTranslations.vue
       ↓ Displays translation teams list
       ↓ Opens URLs on click
```

### Event Flow

```
User clicks "Download Translated"
  ↓
StoreProjectHeader emits 'install-translated'
  ↓
StoreProject forwards to parent view
  ↓
StoreProjectCurseforge.onInstallTranslated()
  ↓
[Future] Translation selection dialog
  ↓
[Future] Download and install translations
```

---

## Conditional Rendering Logic

All translation UI elements follow this pattern:

```vue
v-if="project.translations && project.translations.length > 0"
```

This ensures:
- ✅ No UI changes when translations array is empty
- ✅ Backward compatibility with existing modpacks
- ✅ Clean UI without translation clutter when not applicable
- ✅ Graceful degradation

---

## Responsive Design

### Desktop (xl breakpoint and above)
- Translation team list: Single column (flex-col)
- All elements visible

### Tablet/Mobile
- Translation team list: 3-column grid
- Button text may wrap on very small screens
- Standard responsive behavior inherited from Vuetify

---

## Color Scheme

| Element | Color | Reasoning |
|---------|-------|-----------|
| Download Translated Button | Success (Green) | Indicates positive action, matches "add translation" concept |
| Languages Chip | Success Outlined | Matches button, subtle indicator |
| Translate Icon | Inherit | Uses Material Icons "translate" |
| Translation List Items | Transparent | Matches existing StoreProjectMembers style |

---

## Internationalization

All text is internationalized. Current English keys:

```yaml
modpack:
  translationTeam: Translation Team
  noTranslationsAvailable: No translations available
  languagesSupported: '{count}+ Languages Supported'
  downloadTranslated: Download Translated
```

To add translations to other languages, add these keys to:
- `locales/ru.yaml`
- `locales/zh-CN.yaml`
- `locales/es-ES.yaml`
- etc.

---

## Example Usage

To populate translations for a modpack:

```typescript
// In StoreProjectCurseforge.vue (line ~114)
const result: IStoreProject = reactive({
  // ... other properties ...
  translations: [
    {
      id: 'minecraft-inside-ru-ftb-stoneblock4',
      name: 'minecraft-inside.ru',
      url: 'https://minecraft-inside.ru/mods/79155-ftb-stoneblock-4.html',
      language: 'Russian'
    },
    {
      id: 'team-x-stoneblock4',
      name: 'Team X',
      url: 'https://example.com/stoneblock4-translations',
      language: 'Chinese'
    },
    {
      id: 'gamer-y-stoneblock4',
      name: 'Gamer Y',
      url: 'https://example.com/gamer-y',
      language: 'Spanish'
    }
  ]
})
```

---

## Testing Checklist

To verify the implementation:

- [ ] Navigate to a CurseForge modpack page
- [ ] Add translation data to the project object
- [ ] Verify "Download Translated" button appears
- [ ] Verify language count chip shows correct number
- [ ] Verify translation team section appears in sidebar
- [ ] Click on translation team items to verify URLs open
- [ ] Verify empty state message when translations array is empty
- [ ] Test on different screen sizes (desktop, tablet, mobile)
- [ ] Verify button click triggers console log (placeholder)
- [ ] Repeat for Modrinth and FTB modpack pages

---

## Future Enhancements

When implementing the full feature:

1. **Backend Service**
   - Create API endpoint for translation metadata
   - Store community translation mappings
   - Validate translation URLs

2. **Selection Dialog**
   - Replace placeholder handler with actual dialog
   - Allow users to choose which translation to install
   - Show preview of translation contents

3. **Installation Flow**
   - Download translation files (resource packs, lang files)
   - Integrate with existing modpack installation
   - Store translation preferences

4. **Management**
   - Track installed translations
   - Update notifications
   - Uninstall/switch translations

---

## Conclusion

This implementation provides all the UI infrastructure needed for the modpack translation feature. The design:
- ✅ Matches the original mockup
- ✅ Follows existing code patterns
- ✅ Maintains backward compatibility
- ✅ Provides clear extension points
- ✅ Includes comprehensive documentation

The next phase involves creating the backend infrastructure and implementing the actual translation download/installation logic.
