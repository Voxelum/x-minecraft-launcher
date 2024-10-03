### Stos technologiczny i trochę informacji ogólnych

Oto przegląd narzędzi i środowiska wykonawczego tego projektu

Dla całego projektu mamy:

- [Node.js >=18.17.0](https://nodejs.org/). Podstawowe środowisko bibliotek.
- [Electron 27](https://electron.atom.io). Faktyczne środowisko wykonawcze launchera.
- [pnpm](https://pnpm.io/). Używany do zarządzania pakietami w monorepo.
- [TypeScript](https://www.typescriptlang.org/). Cały projekt używa TypeScript w jak największym stopniu.

Dla procesu głównego (Electron) mamy:

- [esbuild](https://esbuild.github.io/). Używamy esbuild do budowania naszego głównego procesu TypeScript.

Dla strony renderującej, która jest czystym frontendem:

- [Vue](https://vuejs.org). Używany do budowania interfejsów użytkownika.
- [Vite](https://vitejs.dev/). Używany jako nasz system budowania.
- [Vuetify](https://vuetifyjs.com/). Używany jako biblioteka komponentów.
- [Windi CSS](https://windicss.org/). Używany do narzędzi CSS.
- [Vue Composition API](https://github.com/vuejs/composition-api). Pomost dla API kompozycyjnego dla Vue 2. Gdy Vuetify zostanie zaktualizowany do Vue 3, Vue zostanie zaktualizowany i to zostanie usunięte.

### Struktura projektu

![diagram](/assets/diagram.svg)

- xmcl
  - Połączone repozytorium git [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) jest submodułem git w tym projekcie.
  - Implementuje podstawową logikę instalacji i uruchamiania Minecraft i udostępnia je jako bibliotekę.
- xmcl-electron-app
  - Używa Electron do implementacji środowiska wykonawczego.
  - Bezpośrednio zależy od xmcl-runtime.
  - Pośrednio zależy od xmcl-keystone-ui (tymczasowo, może zostać usunięte później?)
- xmcl-keystone-ui
  - Główny domyślny interfejs użytkownika launchera.
  - 100% kompatybilny z przeglądarką. W tym projekcie nie są używane żadne API Electron.
- xmcl-runtime
  - Główna implementacja architektury launchera. Zależy tylko od Node.js i nie wymaga środowiska wykonawczego Electron.
- xmcl-runtime-api
  - To jest współdzielony kod i API dla środowiska wykonawczego XMCL. Może być używany dla aplikacji renderującej (strona przeglądarki)

### Koncepcja/Struktura

Launcher składa się z "serwera/klienta" lub "main/renderer". Komunikują się ze sobą za pomocą [ipcMain](https://electronjs.org/docs/api/ipc-main) i [ipcRenderer](https://electronjs.org/docs/api/ipc-renderer) Electrona.

Main jest "backendem" launchera. Zarządza oknami i wszystkimi trwałymi danymi/stanem aplikacji. Zarządza stanem za pomocą [Vuex](https://vuex.vuejs.org/). Gdy stan/dane zostają zmodyfikowane przez [commit Vuex](https://vuex.vuejs.org/guide/mutations.html), wysyła komunikat ipc zawierający [informacje o mutacji](https://vuex.vuejs.org/guide/mutations.html) do wszystkich rendererów. Jednocześnie uruchamia akcję zapisu zmodyfikowanego modułu, aby zapisać zmiany na dysku.

Renderer jest/są po prostu przeglądarką/przeglądarkami, które komunikują się z main. Utrzymuje kopię store. (Może to być pełna kopia lub częściowa kopia) Dane wejściowe użytkownika uruchamiają [akcję](https://vuex.vuejs.org/guide/actions.html) lub [commit](https://vuex.vuejs.org/guide/mutations.html), które zostaną zsynchronizowane z main. Jednak nie wymaga to żadnych dodatkowych działań od programisty. Lokalne commity i akcje będą automatycznie wysyłane do main. Programista może traktować renderer jak normalną aplikację vue.

### Zalecana instrukcja czytania kodu

Jeśli jesteś zainteresowany konkretną logiką strony, możesz przejść do `xmcl-keystone-ui/src/windows/main/views`. Pliki `.vue` w tym folderze są głównymi komponentami używanymi w launcherze. Prefiks pliku to domena interfejsu użytkownika.

Zobacz kilka przykładów:

1. `AppSideBar.vue` to komponent paska bocznego, a `AppSideBarInstanceItem.vue` to komponent używany w `AppSideBar.vue` reprezentujący instancję.
2. `Curseforge.vue` to komponent strony CurseForge, a `CurseforgeCategories.vue` to karta kategorii używana na stronie `Curseforge.vue`.

Jeśli jesteś zainteresowany podstawową logiką, możesz przejść do `xmcl-runtime/services/`. Każdy plik w tym miejscu reprezentuje usługę dla konkretnej domeny/aspektu logiki launchera. W trakcie tego procesu powinieneś również zwrócić uwagę na odpowiadające im pliki w `xmcl-runtime-api/services/`, które deklarują interfejs rzeczywistych usług.

Kilka przykładów:

1. `xmcl-runtime/services/InstanceService.ts` zawiera implementację API do dodawania/usuwania/aktualizacji instancji. `xmcl-runtime-api/services/InstanceService.ts` zawiera interfejs `InstanceService`
2. `xmcl-runtime/services/InstanceVersionService.ts` zawiera implementację API do sprawdzania stanu wersji instancji. Określi, której wersji będzie używać instancja i czy powinniśmy zainstalować tę wersję.
3. `xmcl-runtime/services/InstallService.ts` zawiera implementację API do instalacji Minecraft/Forge/Fabric itp.
4. `xmcl-runtime/services/LaunchService.ts` zawiera implementację API do uruchamiania instancji.

## Jak wnieść wkład

Zdecydowanie zalecamy używanie VSCode do otwierania projektu.

### Pierwsze kroki

#### Klonowanie

Sklonuj projekt z flagą submodułu `--recurse-submodules`.

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

Jeśli zapomnisz dodać flagę `--recurse-submodules`, musisz ręcznie zainicjować i zaktualizować submoduł git.

```bash
git submodule init
git submodule update
```

#### Instalacja

Zainstaluj projekt używając [pnpm](https://pnpm.io):

```
pnpm install
```

<details>
  <summary> Rozwiązanie problemu wolnej instalacji zależności (takich jak Electron) w Chinach kontynentalnych </summary>

  Otwórz git bash i przed `pnpm i` dodaj `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`. Użyj krajowego lustra npm i Electron dostarczanego przez Alibabę.

  Ostatecznie wprowadzone polecenie to:

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>

#### Ustawianie zmiennych środowiskowych

Powinieneś ustawić `CURSEFORGE_API_KEY` tworząc plik `.env` w `xmcl-electron-app`. Ten plik `.env` jest dodany do pliku `.gitignore`.

**NIE UJAWNIAJ SWOJEGO KLUCZA API CURSEFORGE**

#### Uruchamianie Launchera

Następnie możesz uruchomić launcher

#### Dla VSCode

Przejdź do sekcji `Run and Debug`, użyj profilu `Electron: Main (launch)` aby uruchomić electron. (Skrót klawiszowy F5)

#### Dla innych niż VSCode

Otwórz jeden terminal

```bash
# Uruchom serwer dev dla UI
npm run dev:renderer
```

Otwórz inny terminal

``` bash
# Uruchom obserwowanie kodu procesu głównego
npm run dev:main
```

#### "Gorąca" zmiana kodu

Masz zmianę w kodzie i chcesz zaktualizować zmianę w działającej instancji launchera.

##### Dla procesu przeglądarki

Vite zapewnia hot reload, powinien aktualizować się automatycznie. Jeśli coś pójdzie nie tak, możesz odświeżyć przeglądarkę za pomocą `Ctrl+R`.

##### Dla procesu głównego

Jeśli używasz VSCode do uruchomienia launchera, po zmianie kodu możesz nacisnąć przycisk przeładowania w debuggerze VSCode.

Jeśli nie używasz VSCode do uruchomienia, powinien zamknąć Electron i automatycznie przeładować.

### Znalazłeś coś nieprawidłowego w rdzeniu launchera

Rdzeń launchera znajduje się w [oddzielnym projekcie](https://github.com/voxelum/minecraft-launcher-core-node) napisanym w TypeScript.

Proszę otworzyć problem tam, jeśli zidentyfikujesz jakikolwiek problem z nim związany.

#### Zalecany sposób interakcji z Vuex

- Utwórz nowy plik dla hooka w folderze `src/renderer/composables` i wyeksportuj hook przez `src/renderer/composables/index.ts`
  - Opakuj operacje Vuex w swoim hooku
- Importuj swój hook przez `import { yourHook } from '/@/composables'` w pliku Vue
- Używaj hooka w pliku Vue bez bezpośredniego dostępu do Vuex

### Debugger VSCode

Projekt zawiera konfiguracje debuggera VSCode. Możesz dodać punkt przerwania w linii i debugować. Obecnie metoda debuggera VSCode obsługuje tylko debugowanie w procesie głównym.

(Możesz używać Chrome DevTools dla procesu renderującego w każdym razie)

Mamy teraz dwie opcje:

1. Electron: Main (launch)
2. Electron: Main (attach)

Jeśli użyjesz pierwszej opcji do uruchomienia, automatycznie dołączy debugger do instancji.

### Commitowanie kodu

Ten projekt przestrzega [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/). Krótko mówiąc, pierwsza linia twojej wiadomości commit powinna wyglądać tak:

```
typ commita: opis commita
```

Dostępnych jest kilka typów commitów: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`.

Odnosząc się do [tego gista](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

> feat: (nowa funkcja dla użytkownika, nie nowa funkcja dla skryptu budującego)
>
> fix: (poprawka błędu dla użytkownika, nie poprawka dla skryptu budującego)
>
> docs: (zmiany w dokumentacji)
>
> style: (formatowanie, brakujące średniki itp.; brak zmian w kodzie produkcyjnym)
>
> refactor: (refaktoryzacja kodu produkcyjnego, np. zmiana nazwy zmiennej)
>
> test: (dodawanie brakujących testów, refaktoryzacja testów; brak zmian w kodzie produkcyjnym)
>
> chore: (aktualizacja zadań grunt itp.; brak zmian w kodzie produkcyjnym)

**Twój commit zostanie odrzucony, jeśli nie będziesz przestrzegać tych zasad.**

### Jak budować

Obecny launcher wymaga uruchomienia 2 poleceń do zbudowania

Najpierw musisz zbudować kod frontendu:

```bash
pnpm build:renderer
```

Chyba że kod w `xmcl-keystone-ui` uległ zmianie, nie musisz budować tego ponownie.

Następnie możesz zbudować Electron z dołączonym właśnie zbudowanym frontendem:

```bash
pnpm build:all
```

Jeśli chcesz wersję debugową, możesz użyć `pnpm build:dir`, które zbuduje tylko katalog wynikowy i nie spakuje ich do różnych formatów wydania.