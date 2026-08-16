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


<div align="center">

### 🌐 Translations

| | | | | |
| :---: | :---: | :---: | :---: | :---: |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/1280px-Flag_of_the_United_States.svg.png" width="18"> English](../CONTRIBUTING.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Ukraine.svg/1280px-Flag_of_Ukraine.svg.png" width="18"> Українська](CONTRIBUTING.ua.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Flag_of_Poland.svg/1280px-Flag_of_Poland.svg.png" width="18"> Polski](CONTRIBUTING.pl.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/1280px-Flag_of_Germany.svg.png" width="18"> Deutsch](CONTRIBUTING.de.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Flag_of_Austria.svg/1280px-Flag_of_Austria.svg.png" width="18"> Österreich](CONTRIBUTING.de-AT.md) |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Switzerland.svg/1280px-Flag_of_Switzerland.svg.png" width="18"> Schweiz](CONTRIBUTING.de-CH.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/1280px-Flag_of_Brazil.svg.png" width="18"> Português (BR)](CONTRIBUTING.pt-BR.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Portugal.svg/1280px-Flag_of_Portugal.svg.png" width="18"> Português](CONTRIBUTING.pt.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Flag_of_Spain.svg/1280px-Flag_of_Spain.svg.png" width="18"> Español](CONTRIBUTING.es.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/1280px-Flag_of_France.svg.png" width="18"> Français](CONTRIBUTING.fr.md) |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Flag_of_Canada_%28Pantone%29.svg/1280px-Flag_of_Canada_%28Pantone%29.svg.png" width="18"> Français (CA)](CONTRIBUTING.fr-CA.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Flag_of_Italy.svg/1280px-Flag_of_Italy.svg.png" width="18"> Italiano](CONTRIBUTING.it.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Flag_of_the_Czech_Republic.svg/1280px-Flag_of_the_Czech_Republic.svg.png" width="18"> Čeština](CONTRIBUTING.cs.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Flag_of_Romania.svg/1280px-Flag_of_Romania.svg.png" width="18"> Română](CONTRIBUTING.ro.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Flag_of_Moldova.svg/1280px-Flag_of_Moldova.svg.png" width="18"> Moldova](CONTRIBUTING.mo.md) |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Flag_of_Belarus.svg/1280px-Flag_of_Belarus.svg.png" width="18"> Беларуская](CONTRIBUTING.be.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Flag_of_Estonia.svg/1280px-Flag_of_Estonia.svg.png" width="18"> Eesti](CONTRIBUTING.et.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Flag_of_Lithuania.svg/1280px-Flag_of_Lithuania.svg.png" width="18"> Lietuvių](CONTRIBUTING.lt.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Greece.svg/1280px-Flag_of_Greece.svg.png" width="18"> Ελληνικά](CONTRIBUTING.el.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Flag_of_Israel.svg/1280px-Flag_of_Israel.svg.png" width="18"> עברית](CONTRIBUTING.he.md) |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_Turkey.svg/1280px-Flag_of_Turkey.svg.png" width="18"> Türkçe](CONTRIBUTING.tr.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Flag_of_Saudi_Arabia.svg/1280px-Flag_of_Saudi_Arabia.svg.png" width="18"> العربية](CONTRIBUTING.ar.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Flag_of_Lebanon.svg/1280px-Flag_of_Lebanon.svg.png" width="18"> لبنان](CONTRIBUTING.ar-LB.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Flag_of_India.svg/1280px-Flag_of_India.svg.png" width="18"> हिन्दी](CONTRIBUTING.hi.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Flag_of_Japan.svg/1280px-Flag_of_Japan.svg.png" width="18"> 日本語](CONTRIBUTING.jp.md) |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Flag_of_South_Korea.svg/1280px-Flag_of_South_Korea.svg.png" width="18"> 한국어](CONTRIBUTING.ko.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Flag_of_the_People%27s_Republic_of_China.svg/1280px-Flag_of_the_People%27s_Republic_of_China.svg.png" width="18"> 简体中文](CONTRIBUTING.zh.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Flag_of_Denmark.svg/1280px-Flag_of_Denmark.svg.png" width="18"> Dansk](CONTRIBUTING.da.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Flag_of_Sweden.svg/1280px-Flag_of_Sweden.svg.png" width="18"> Svenska](CONTRIBUTING.sv.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Flag_of_Finland.svg/1280px-Flag_of_Finland.svg.png" width="18"> Suomi](CONTRIBUTING.fi.md) |
| [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Flag_of_Kazakhstan.svg/1280px-Flag_of_Kazakhstan.svg.png" width="18"> Қазақша](CONTRIBUTING.kz.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Flag_of_Hungary.svg/1280px-Flag_of_Hungary.svg.png" width="18"> Magyar](CONTRIBUTING.hu.md) | [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/1280px-Flag_of_Russia.svg.png" width="18"> Русский](CONTRIBUTING.ru.md) | | |

</div>

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