# Contribute

Feel free to contribute to the project. You can fork the project and make PR to here just like any other github project.

- [Contribute](#contribute)
  - [Getting Started](#getting-started)
    - [Pre-requirements](#pre-requirements)
    - [Setup Dev Workspace](#setup-dev-workspace)
    - [How to Dev](#how-to-dev)
    - [How to Build](#how-to-build)
    - [Commit You Code](#commit-you-code)
    - [Before Submit PR](#before-submit-pr)

## Getting Started

Introduce how to setup environment, modify code and submit PR.

### Pre-requirements

- Node.js >=18.17.0
- pnpm (can be setup by node [corepack](https://nodejs.org/api/corepack.html))

### Setup Dev Workspace

Use git to clone the project 

```sh
git clone https://github.com/Voxelum/minecraft-launcher-core-node
```

If you don't have `pnpm`, you can use corepack to setup

```sh
corepack enable
```

Now you should have `pnpm` installed. You can run the install command to install dependencies

```sh
pnpm install
```

### How to Dev

The code are split into separated projects, which layed in under `packages` folder. Most of them are really simple (only one `index.ts` file or few files).

For pure library developer, we recommend you to have TDD (Test Driven Development) style to develop. You can add some test first, and then add the code to pass the test.

We are using the [vitest](https://vitest.dev/) as the test framework. You can run it by `pnpm run test` or `pnpm vitest` to run the test in watch mode.

Please see vitest document for more detailed operations.

### How to Build

You can run build the project locally to make sure it pass the PR validation. The build is separated in 3 parts:

1. Build esm mjs files
2. Build cjs js files
3. Build typescript dts files

You need to leverage the pnpm recursive option to run the build command. 

```sh
pnpm build:cjs --parallel # build cjs
pnpm build:esm --parallel # build mjs
pnpm build:type --parallel # build dts
```

### Commit You Code

Make sure you commit your code using the [conventional commit format](https://www.conventionalcommits.org/en/v1.0.0-beta.2/). The github action will use your commit message to generate changelog and bump version. They are important.

### Before Submit PR

Make sure you run `pnpm lint` to pass lint so the PR validation can pass.
