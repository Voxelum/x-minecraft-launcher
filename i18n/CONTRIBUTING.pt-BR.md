### Stack Tecnológica & Visão Geral

Aqui temos uma visão geral da cadeia de ferramentas e do ambiente de execução deste projeto.

Para o projeto completo:

- [Node.js >=18.17.0](https://nodejs.org/). O ambiente base das bibliotecas principais.
- [Electron 27](https://electron.atom.io). O ambiente de execução do launcher.
- [pnpm](https://pnpm.io/). Utilizado para o gerenciamento de pacotes do monorepo.
- [TypeScript](https://www.typescriptlang.org/). Todo o projeto utiliza o máximo possível de TypeScript.

Para o processo principal (Electron):

- [esbuild](https://esbuild.github.io/). Usamos o esbuild para compilar o TypeScript do processo principal.

Para o lado do renderizador (interface web front-end pura):

- [Vue](https://vuejs.org). Utilizado para construir as interfaces de usuário.
- [Vite](https://vitejs.dev/). Utilizado como sistema de compilação/build.
- [Vuetify](https://vuetifyjs.com/). Utilizado como biblioteca de componentes de UI.
- [Tailwind CSS / Windi CSS](https://windicss.org/). Utilizado para estilização e utilitários CSS.


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

### Estrutura do Projeto

- **xmcl-electron-app**: Implementa o ambiente de execução no Electron.
- **xmcl-keystone-ui**: A interface de usuário padrão do launcher. 100% compatível com navegadores, sem chamadas diretas de APIs do Electron.
- **xmcl-runtime**: O núcleo da arquitetura do launcher. Depende apenas do Node.js e não requer o ambiente do Electron.
- **xmcl-runtime-api**: O código compartilhado e a definição das APIs do runtime do XMCL.

### Conceito / Arquitetura

O inicializador é composto pelo modelo "servidor/cliente" ou "main/renderer". Eles se comunicam entre si através do IPC do Electron (`ipcMain` e `ipcRenderer`).

O **main** é o "backend" do launcher. Ele gerencia as janelas e todos os dados e estados persistentes da aplicação. Quando o estado/dado é modificado, ele transmite a alteração para os renderizadores e salva no disco.

O **renderer** é a interface web que se comunica com o main. As ações e entradas do usuário disparam chamadas para o main, que atualiza o estado de forma reativa.

### Como Começar a Desenvolver

Recomendamos fortemente o uso do **VSCode** para trabalhar no projeto.

#### Clonar o repositório

Clone o projeto incluindo os submódulos:

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

Se esquecer o parâmetro `--recurse-submodules`:

```bash
git submodule init
git submodule update
```

#### Instalação das dependências

Use o `pnpm` para instalar todas as dependências do monorepo:

```bash
pnpm install
```

#### Executar em modo de desenvolvimento

Para iniciar o processo principal e o renderizador com hot-reload:

```bash
pnpm dev
```

#### Verificação de tipos e Linting

```bash
pnpm check
pnpm lint
```
