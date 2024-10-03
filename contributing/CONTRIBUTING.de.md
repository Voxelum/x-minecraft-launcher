### Tech-Stack & Hintergrundinformationen

Hier haben wir einen Überblick über die Toolchain & Laufzeitumgebung dieses Projekts

Für das gesamte Projekt haben wir:

- [Node.js >=18.17.0](https://nodejs.org/). Die Basisumgebung der Kernbibliotheken.
- [Electron 27](https://electron.atom.io). Die eigentliche Laufzeitumgebung des Launchers.
- [pnpm](https://pnpm.io/). Verwendet für die Paketverwaltung im Monorepo.
- [TypeScript](https://www.typescriptlang.org/). Das gesamte Projekt verwendet so viel TypeScript wie möglich.

Für den Hauptprozess (Electron) haben wir:

- [esbuild](https://esbuild.github.io/). Wir verwenden esbuild, um unseren Hauptprozess-TypeScript zu kompilieren.

Für die Renderer-Seite, die das reine Frontend ist:

- [Vue](https://vuejs.org). Wird verwendet, um Benutzeroberflächen zu erstellen.
- [Vite](https://vitejs.dev/). Wird als unser Build-System verwendet.
- [Vuetify](https://vuetifyjs.com/). Wird als Komponentenbibliothek verwendet.
- [Windi CSS](https://windicss.org/). Wird für CSS-Tools verwendet.
- [Vue Composition API](https://github.com/vuejs/composition-api). Die Brücke für die Kompositions-API für Vue 2. Sobald Vuetify auf Vue 3 aktualisiert wird, wird Vue aktualisiert und dies wird entfernt.

### Projektstruktur

![Diagramm](/assets/diagram.svg)

- xmcl
  - Das verknüpfte Git-Repo [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) ist ein Git-Submodul in diesem Projekt.
  - Implementiert die Kern-Minecraft-Installations- und Startlogik und stellt sie als Bibliothek zur Verfügung.
- xmcl-electron-app
  - Verwendet Electron zur Implementierung der Laufzeitumgebung.
  - Hängt direkt von xmcl-runtime ab.
  - Hängt implizit von xmcl-keystone-ui ab (vorübergehend, könnte später entfernt werden?)
- xmcl-keystone-ui
  - Die Haupt-Standard-UI des Launchers.
  - 100% browserkompatibel. Keine Electron-API in diesem Projekt involviert.
- xmcl-runtime
  - Die Kernimplementierung der Launcher-Architektur. Hängt nur von Node.js ab und erfordert keine Electron-Laufzeitumgebung.
- xmcl-runtime-api
  - Dies ist der gemeinsam genutzte Code & API für die XMCL-Laufzeitumgebung. Er kann für Renderer-Apps (Browserseite) verwendet werden.

### Konzept/Struktur

Der Launcher besteht aus "Server/Client" oder "Main/Renderer". Sie kommunizieren miteinander über Electrons [ipcMain](https://electronjs.org/docs/api/ipc-main) und [ipcRenderer](https://electronjs.org/docs/api/ipc-renderer).

Main ist das "Backend" des Launchers. Es verwaltet die Fenster und alle persistenten Daten/Zustände der App. Es verwaltet den Zustand mit [Vuex](https://vuex.vuejs.org/). Sobald der Zustand/die Daten durch einen [Vuex-Commit](https://vuex.vuejs.org/guide/mutations.html) geändert wurden, sendet es eine ipc-Nachricht mit den [Mutations-Informationen](https://vuex.vuejs.org/guide/mutations.html) an alle Renderer. Gleichzeitig löst es die Speicheraktion des geänderten Moduls aus, um die Änderung auf der Festplatte zu schreiben.

Der Renderer ist/sind einfach Browser, die mit main kommunizieren. Er unterhält eine Kopie des Stores. (Es kann eine vollständige Kopie oder eine Teilkopie sein) Die Eingabe des Benutzers löst eine [Aktion](https://vuex.vuejs.org/guide/actions.html) oder einen [Commit](https://vuex.vuejs.org/guide/mutations.html) aus, und er wird mit main synchronisiert. Allerdings erfordert es keine zusätzlichen Aktionen vom Entwickler. Der lokale Commit und die Aktion werden automatisch an main gesendet. Der Entwickler kann den Renderer wie eine normale vue-Anwendung behandeln.

### Empfohlene Anleitung zum Lesen des Codes

Wenn Sie an einer spezifischen Seitenlogik interessiert sind, können Sie zu `xmcl-keystone-ui/src/windows/main/views` gehen. Die `.vue`-Dateien in diesem Ordner sind die Hauptkomponenten, die im Launcher verwendet werden. Das Präfix der Datei ist die Domäne der UI.

Hier einige Beispiele:

1. `AppSideBar.vue` ist die Seitenleistenkomponente, und `AppSideBarInstanceItem.vue` ist die Komponente, die in `AppSideBar.vue` verwendet wird und eine Instanz repräsentiert.
2. `Curseforge.vue` ist die CurseForge-Seitenkomponente, und `CurseforgeCategories.vue` ist die Kategoriekarte, die auf der `Curseforge.vue`-Seite verwendet wird.

Wenn Sie an der Kernlogik interessiert sind, können Sie zu `xmcl-runtime/services/` gehen. Jede Datei darunter repräsentiert einen Dienst für einen spezifischen Bereich/Aspekt der Launcher-Logik. Während dieses Prozesses sollten Sie auch auf die entsprechenden Dateien unter `xmcl-runtime-api/services/` achten, die die Schnittstelle der tatsächlichen Dienste deklarieren.

Einige Beispiele:

1. `xmcl-runtime/services/InstanceService.ts` enthält die API-Implementierung zum Hinzufügen/Entfernen/Aktualisieren von Instanzen. `xmcl-runtime-api/services/InstanceService.ts` enthält die Schnittstelle des `InstanceService`
2. `xmcl-runtime/services/InstanceVersionService.ts` enthält die API-Implementierung zur Überprüfung des Gesundheitszustands der Instanzversion. Es wird bestimmen, welche Version die Instanz verwenden wird und ob wir diese Version installieren sollten.
3. `xmcl-runtime/services/InstallService.ts` enthält die API-Implementierung zur Installation von Minecraft/Forge/Fabric usw.
3. `xmcl-runtime/services/LaunchService.ts` enthält die API-Implementierung zum Starten einer Instanz.

## Beitragen

Es wird dringend empfohlen, VSCode zum Öffnen des Projekts zu verwenden.

### Erste Schritte

#### Klonen

Klonen Sie das Projekt mit der Submodul-Flag `--recurse-submodules`.

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

Wenn Sie vergessen haben, die Flag `--recurse-submodules` hinzuzufügen, müssen Sie das Git-Submodul manuell initialisieren und aktualisieren.

```bash
git submodule init
git submodule update
```

#### Installation

Installieren Sie das Projekt mit [pnpm](https://pnpm.io):

```
pnpm install
```

<details>
  <summary> Lösung für langsame Abhängigkeitsinstallation (wie Electron) in Festland-China </summary>

  Öffnen Sie Ihre Git Bash und fügen Sie vor `pnpm i` `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"` hinzu. Verwenden Sie den inländischen npm- und Electron-Spiegel, der von Alibaba bereitgestellt wird.

  Der letztendlich eingegebene Befehl lautet also

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>

#### Umgebungsvariablen setzen

Sie sollten `CURSEFORGE_API_KEY` setzen, indem Sie eine `.env`-Datei unter `xmcl-electron-app` erstellen. Diese `.env`-Datei wird in der `.gitignore`-Datei hinzugefügt.

**GEBEN SIE IHREN CURSEFORGE API-SCHLÜSSEL NICHT PREIS**

#### Launcher starten

Dann können Sie den Launcher ausführen

#### Für VSCode

Gehen Sie zum Abschnitt `Run and Debug`, verwenden Sie das Profil `Electron: Main (launch)`, um electron zu starten. (Hotkey F5)

#### Für nicht-VSCode

Öffnen Sie ein Terminal

```bash
# Starten Sie einen Dev-Server für die UI
npm run dev:renderer
```

Öffnen Sie ein anderes Terminal

``` bash
# Starten Sie die Überwachung des Hauptprozesscodes
npm run dev:main
```

#### "Heiße" Codeänderung

Sie haben eine Codeänderung und möchten die Änderung in der laufenden Launcher-Instanz aktualisieren.

##### Für den Browserprozess

Vite bietet Hot Reload, es sollte sich automatisch aktualisieren. Wenn etwas schief geht, können Sie den Browser mit `Strg+R` aktualisieren.

##### Für den Hauptprozess

Wenn Sie VSCode verwenden, um den Launcher zu starten, können Sie nach der Codeänderung die Reload-Schaltfläche im VSCode-Debugger drücken.

Wenn Sie VSCode nicht zum Starten verwenden, sollte es Electron schließen und automatisch neu laden.

### Etwas Falsches im Launcher-Kern gefunden

Der Launcher-Kern befindet sich in einem [separaten Projekt](https://github.com/voxelum/minecraft-launcher-core-node), das in TypeScript geschrieben wurde.

Bitte öffnen Sie dort ein Issue, wenn Sie ein Problem damit identifizieren.

#### Empfohlene Weise der Interaktion mit Vuex

- Erstellen Sie eine neue Datei für den Hook im Ordner `src/renderer/composables` und exportieren Sie den Hook durch `src/renderer/composables/index.ts`
  - Umhüllen Sie Vuex-Operationen in Ihrem Hook
- Importieren Sie Ihren Hook mit `import { yourHook } from '/@/composables'` in Ihrer Vue-Datei
- Verwenden Sie den Hook in der Vue-Datei ohne direkten Zugriff auf Vuex

### VSCode-Debugger

Das Projekt enthält VSCode-Debugger-Konfigurationen. Sie können Haltepunkte in der Zeile hinzufügen und debuggen. Derzeit unterstützt die VSCode-Debugger-Methode nur das Debuggen im Hauptprozess.

(Sie können Chrome DevTools für den Renderer-Prozess sowieso verwenden)

Wir haben jetzt zwei Optionen:

1. Electron: Main (launch)
2. Electron: Main (attach)

Wenn Sie die erste Option zum Starten verwenden, wird der Debugger automatisch an die Instanz angehängt.

### Ihren Code committen

Dieses Projekt folgt den [konventionellen Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/). Kurz gesagt, die erste Zeile Ihrer Commit-Nachricht sollte sein:

```
Commit-Typ: Commit-Beschreibung
```

Es gibt mehrere verfügbare Commit-Typen: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`.

Bezugnehmend auf [diesen Gist](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

> feat: (neue Funktion für den Benutzer, keine neue Funktion für Build-Skript)
>
> fix: (Fehlerbehebung für den Benutzer, keine Korrektur für ein Build-Skript)
>
> docs: (Änderungen an der Dokumentation)
>
> style: (Formatierung, fehlende Semikolons usw.; keine Änderung am Produktionscode)
>
> refactor: (Refaktorierung des Produktionscodes, z.B. Umbenennung einer Variable)
>
> test: (Hinzufügen fehlender Tests, Refaktorierung von Tests; keine Änderung am Produktionscode)
>
> chore: (Aktualisierung von Grunt-Aufgaben usw.; keine Änderung am Produktionscode)

**IHR COMMIT WIRD ABGELEHNT, WENN SIE DIESE REGELN NICHT BEFOLGEN.**

### Wie man baut

Der aktuelle Launcher erfordert die Ausführung von 2 Befehlen zum Bauen

Zuerst müssen Sie den Frontend-Code bauen:

```bash
pnpm build:renderer
```

Sofern sich der Code unter `xmcl-keystone-ui` nicht geändert hat, müssen Sie dies nicht erneut bauen.

Dann können Sie Electron mit dem gerade gebauten Frontend bündeln:

```bash
pnpm build:all
```

Wenn Sie einen Debug-Build möchten, können Sie `pnpm build:dir` verwenden, das nur das Verzeichnisergebnis baut und sie nicht in verschiedene Release-Formate packt.
