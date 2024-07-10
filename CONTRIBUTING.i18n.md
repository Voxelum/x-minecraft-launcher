
# Getting Started with Localization

## Pre-requirements

- [Git](https://git-scm.com/). You **must** install git to getting stared
- [VSCode](https://code.visualstudio.com/). The highly recommended editor for translator to translate. It have integrated UI tool to help you find the translation key.
- [Node.js >=18.17.0](https://nodejs.org/). If you want to test your translation locally, you need this. You can just install latest version.
- [pnpm](https://pnpm.io/installation). If you want to test your translation locally, you need this. You can follow its installation page to install.

## Getting Started

### Fork & Clone

You need to fork & clone the project using git.

Suppose you already fork the project in Github to your repo:

```bash
git clone --recurse-submodules https://github.com/your-id/x-minecraft-launcher
```

### Install

**Optional**, install the project using [pnpm](https://pnpm.io):

Under the folder you cloned, e.g. `x-minecraft-launcher`, run command

```
pnpm install
```

### Install i18n Extension

**Optional** if you are using VSCode.

Install the i18n-ally (lokalise.i18n-ally) extension. The VSCode might hint you to install recommended extensions, which should already include this extension.

### Found the locale file

You need to find the corresponding locale yaml file under

- xmcl-keystone-ui/locales
- xmcl-electron-app/main/locales

The file name is the locale code. You can reference [this document](http://man.hubwiz.com/docset/electron.docset/Contents/Resources/Documents/docs/api/locales.html) to choice the locale.

### Test your translation result

**Optional**. You need to first install the project. See [#Install](#install) section above.

In VSCode, click the button on the sidebar `Run and Debug`, select the `Electron: Main (launch)`, and click play button.

Or, you can try to press `F5` which might be the hotkey for this operation.

This should start the launcher. You can switch to your language in setting page to test.

### Adding new language

**Optional**.
If you are adding a new language, you need to also go to the `assets\locales.json` and add the new language key value there.

Suppose you want to add `French` (`fr`), you can open the file `assets\locales.json`

```json
{
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "en": "English",
  "ru": "Русский язык",
  "es-ES": "Español"
}
```

adding a new line at the end

```json
{
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "en": "English",
  "ru": "Русский язык",
  "es-ES": "Español",
  "fr": "French"
}
```

### Send Pull Request

Please follow the [github guide](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) about how to send pull request.

