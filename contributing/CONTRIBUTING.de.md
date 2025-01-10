### Tech-Stack & Hintergrundinformationen

Hier ist ein Überblick über die Toolchain & Laufzeitumgebung des Projekts.

Für das gesamte Projekt verwenden wir:

- [Node.js >=18.17.0](https://nodejs.org/). Die Basisumgebung der Kernbibliotheken.
- [Electron 27](https://electron.atom.io). Die eigentliche Laufzeitumgebung des Launchers.
- [pnpm](https://pnpm.io/). Verwendet für die Paketverwaltung im Monorepo.
- [TypeScript](https://www.typescriptlang.org/). Das gesamte Projekt verwendet so viel TypeScript wie möglich.

Für den Hauptprozess (Electron) nutzen wir:

- [esbuild](https://esbuild.github.io/). Wir verwenden esbuild, um unser Hauptprozess-TypeScript zu kompilieren.

Für den Renderer, die das komplette Frontend ist:

- [Vue](https://vuejs.org). Um Benutzeroberflächen zu erstellen.
- [Vite](https://vitejs.dev/). Wird als unser Build-System verwendet.
- [Vuetify](https://vuetifyjs.com/). Wird als Komponentenbibliothek verwendet.
- [Windi CSS](https://windicss.org/). Wird für unsere CSS-Tools verwendet.
- [Vue Composition API](https://github.com/vuejs/composition-api). Die Brücke der Composition API für Vue 2. Sobald Vuetify auf Vue 3 aktualisiert wird, wird Vue aktualisiert und dies entfernt.

### Projektstruktur

![Diagramm](/assets/diagram.svg)

- xmcl
  - Das verknüpfte Git-Repo [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) ist ein Git-Submodul des Projekts.
  - Implementiert die Kern-Minecraft-Installations- und Startlogik und stellt sie als Bibliothek zur Verfügung.
- xmcl-electron-app
  - Verwendet Electron zur Implementierung der Laufzeitumgebung.
  - Hängt direkt von xmcl-runtime ab.
  - Hängt implizit von xmcl-keystone-ui ab (vorübergehend, wird vielleicht später entfernt?)
- xmcl-keystone-ui
  - Das Haupt-Standard-UI des Launchers.
  - 100% browserkompatibel. Keine Electron-API involviert.
- xmcl-runtime
  - Die Kernimplementierung der Launcher-Architektur. Hängt nur von Node.js ab und erfordert keine Electron-Laufzeitumgebung.
- xmcl-runtime-api
  - Der gemeinsam genutzte Code & die API der XMCL-Laufzeitumgebung. Er kann für Renderer-Apps (Browserseitig) verwendet werden.

### Konzept/Struktur

Der Launcher besteht aus "Server/Client" oder "Main/Renderer". Sie kommunizieren miteinander über Electrons [ipcMain](https://electronjs.org/docs/api/ipc-main) und [ipcRenderer](https://electronjs.org/docs/api/ipc-renderer).

Main ist das "Backend" des Launchers. Es verwaltet die Fenster und alle dauerhaften Daten und Zustände der App. Es verwaltet den Zustand mit [Vuex](https://vuex.vuejs.org/). Sobald der Zustand/die Daten durch einen [Vuex-Commit](https://vuex.vuejs.org/guide/mutations.html) geändert wurden, sendet Main eine ipc-Nachricht mit den [Mutations-Informationen](https://vuex.vuejs.org/guide/mutations.html) an alle Renderer. Gleichzeitig wird die Speicheraktion des geänderten Moduls ausgelöst, um die Änderungem auf der Festplatte zu sichern.

Der Renderer ist ein Browser-Prozess, der mit Main kommuniziert. Er unterhält eine Kopie des Stores, welche entweder vollständig oder nur teilweise vorliegt. Benutzereingaben lösen eine [Aktion](https://vuex.vuejs.org/guide/actions.html) oder einen [Commit](https://vuex.vuejs.org/guide/mutations.html) aus, welche mit Main synchronisiert werden. Dabei sind keine zusätzlichen Schritte des Entwicklers erforderlich. Lokale Commits und Aktionen werden automatisch an Main gesendet. Der Renderer kann durch den Entwickler wie eine normale Vue-Anwendung behandelt werden.

### Empfohlene Vorgehensweise zum Codeverständnis

Wenn du an einer spezifischen Seitenlogik interessiert bist, sehe dir gerne `xmcl-keystone-ui/src/windows/main/views` an. Die `.vue`-Dateien in diesem Ordner sind die Hauptkomponenten, die der Launcher verwendet. Das Präfix der Datei entspricht der Domäne der UI.

Hier einige Beispiele:

1. `AppSideBar.vue` ist die Seitenleistenkomponente, und `AppSideBarInstanceItem.vue` ist die Komponente, die in `AppSideBar.vue` verwendet wird. Sie repräsentiert eine Instanz.
2. `Curseforge.vue` ist die CurseForge-Seitenkomponente, und `CurseforgeCategories.vue` ist die Kategorieauswahl, die auf der `Curseforge.vue`-Seite verwendet wird.

Wenn du an der Kernlogik interessiert sind, kannst du dir `xmcl-runtime/services/` ansehen. Jede Datei dort repräsentiert einen Dienst für einen spezifischen Aspekt der Launcher-Logik. Währenddessen solltest du auch auf die entsprechenden Dateien unter `xmcl-runtime-api/services/` achten, die die Schnittstellen der tatsächlichen Dienste definieren.

Einige Beispiele:

1. `xmcl-runtime/services/InstanceService.ts` enthält die API-Implementierung zum Hinzufügen/Entfernen/Aktualisieren von Instanzen. `xmcl-runtime-api/services/InstanceService.ts` enthält die Schnittstelle des `InstanceService`.
2. `xmcl-runtime/services/InstanceVersionService.ts` enthält die API-Implementierung zur Überprüfung des Gesundheitszustands der Instanzversion. Sie bestimmt, welche Version die Instanz verwenden wird und ob diese installiert werden sollte.
3. `xmcl-runtime/services/InstallService.ts` enthält die API-Implementierung zur Installation von Minecraft/Forge/Fabric usw.
3. `xmcl-runtime/services/LaunchService.ts` enthält die API-Implementierung zum Starten einer Instanz.

## Mitwirken

Es wird stark empfohlen, VSCode zum Öffnen des Projekts zu verwenden.

### Erste Schritte

#### Klonen

Klone das Projekt mit der Submodul-Flag `--recurse-submodules`.

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

Solltest du vergessen haben, die Flag `--recurse-submodules` zu verwenden, musst du das Git-Submodul manuell initialisieren und aktualisieren.

```bash
git submodule init
git submodule update
```

#### Installation

Installiere das das Projekt mit [pnpm](https://pnpm.io):

```
pnpm install
```

<details>
  <summary> Lösung für die langsame Installtion von Abhängigkeiten in China </summary>

  Öffne das Git Bash und füge vor `pnpm i` das hier: `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"` hinzu. Verwende den inländischen npm- und Electron-Mirror, der von Alibaba bereitgestellt wird.

  Der eingegebene Befehl sollte also so aussehen:

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>

#### Umgebungsvariablen setzen

Du solltest `CURSEFORGE_API_KEY` festlegen, indem du eine `.env`-Datei unter `xmcl-electron-app` erstellst. Diese `.env`-Datei wird der `.gitignore`-Datei hinzugefügt.

**GEBE DEINEN CURSEFORGE API-SCHLÜSSEL NIEMALS WEITER!**

#### Launcher starten

Nun kannst du den Launcher starten.

#### Für VSCode

Öffne das `Run and Debug`-Menü, und verwende das Profil `Electron: Main (launch)`, um Electron zu starten. (Hotkey F5)

#### Ohne VSCode

Öffne ein Terminal:

```bash
# Starten Sie einen Dev-Server für die UI
npm run dev:renderer
```

Nun öffnen ein weiteres Terminal:

``` bash
# Starten Sie die Überwachung des Hauptprozesscodes
npm run dev:main
```

#### Code "Hot" Change

Du hast eine Codeänderung gemacht und möchtest die Änderung in der laufenden Launcher-Instanz aktualisieren.

##### Für den Browserprozess

Vite bietet Hot Reload, daher sollte es sich automatisch aktualisieren. Wenn etwas schief geht, kannst du einfach den Browser mit `Strg+R` neu laden.

##### Für den Hauptprozess

Solltest du VSCode verwenden um den Launcher zu starten, kannst du nach der Codeänderung den Reload-Knopf im VSCode-Debugger nutzen.

Wenn du nicht VSCode zum Starten verwendest, sollte sich Electron automatisch schließen und neu laden.

### Einen Fehler im Launcher-Kern gefunden?

Der Launcher-Kern befindet sich in einem [separaten Projekt](https://github.com/voxelum/minecraft-launcher-core-node), das in TypeScript geschrieben wurde.

Bitte öffne dort eine Issue, wenn du ein Problem findest.

#### Empfohlene Vorgehensweise bei Vuex-Interaktionen

- Erstelle eine neue Datei für den Hook im Ordner `src/renderer/composables`, und exportiere diesen mit `src/renderer/composables/index.ts`
  - Wrappe diesen Vuex-Operator in deinem Hook
- Importieren deinen Hook mit `import { yourHook } from '/@/composables'` in deiner Vue-Datei
- Verwende den Hook in der Vue-Datei ohne direkten Zugriff auf Vuex

### VSCode-Debugger

Das Projekt enthält Konfigurationen zum Debuggen mit VSCode. Du kannst Breakpoints setzen und den Code debuggen. Derzeit unterstützt die VSCode-Debugger-Methode jedoch nur das Debuggen des Hauptprozesses.

(Du kannst sowieso Chrome DevTools für den Renderer-Prozess nutzen)

Wir haben jetzt zwei Optionen:

1. Electron: Main (launch)
2. Electron: Main (attach)

Wenn du die erste Option zum Starten verwendest, wird der Debugger automatisch an die Instanz angehängt.

### Code committen

Dieses Projekt folgt den [konventionellen Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/). Kurz gesagt, die erste Zeile deiner Commit-Nachricht sollte so aussehen:

```
Commit-Typ: Commit-Beschreibung
```

Es gibt mehrere verfügbare Commit-Typen: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`.

Nach [diesem Gist](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716) hier:

> feat: (neue Funktion für den Benutzer, nichts neues für ein Build-Skript)
>
> fix: (Fehlerbehebung für den Benutzer, kein Fix für ein Build-Skript)
>
> docs: (Änderungen an der Dokumentation)
>
> style: (Formatierung, fehlende Semikolons usw.; keine Änderung am Production-Code)
>
> refactor: (Umstrukturierung des Production-Code, z.B. Umbenennung einer Variable)
>
> test: (Hinzufügen fehlender Tests, Umstrukturierung von Tests; keine Änderung am Production-Code)
>
> chore: (Aktualisierung von Grunt-Tasks usw.; keine Änderung am Production-Code)

**BEFOLGST DU DIESE RICHTLINIEN NICHT, WIRD DEIN COMMIT ABGELEHNT.**

### Kompilierungs-/Buildprozess

Der aktuelle Launcher erfordert zum Kompilieren derzeit nur 2 Befehle.

Zuerst musst du den Frontend-Code kompilieren:

```bash
pnpm build:renderer
```

Sofern sich der Code unter `xmcl-keystone-ui` nicht geändert hat, musst du diesen nicht erneut kompilieren.

Dann kannst du einfach Electron mit dem frisch kompilierten Frontend bündeln:

```bash
pnpm build:all
```

Solltest du einen Debug-Build haben wollen, kannst du stattdessen `pnpm build:dir` verwenden. So wird nur das Verzeichnisergebnis kompiliert, und nichts in die verschiedenen Release-Formate gepackt.
