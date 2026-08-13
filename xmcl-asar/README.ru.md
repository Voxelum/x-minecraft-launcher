# @xmcl/app-&lt;платформа&gt;

<kbd>[<img title="Russia" alt="Russia" src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/1280px-Flag_of_Russia.svg.png" width="22">](README.ru.md)</kbd>

Предварительно собранные `app.asar` пакеты [X Minecraft Launcher](https://xmcl.app), по одному пакету на платформу.

Эти пакеты **не** предназначены для установки в качестве зависимости. Они существуют только для того, чтобы зеркалировать asar-нагрузку лаунчера через npm CDN, чтобы пользователи за Великим китайским файрволом (через [npmmirror.com](https://npmmirror.com)) могли получать горячие обновления и быстро загружать портативный установщик.

Один пакет публикуется для каждой платформы, каждый соответствует релизу лаунчера:

```
@xmcl/app-win        @xmcl/app-win-ia32
@xmcl/app-mac        @xmcl/app-mac-arm64
@xmcl/app-linux      @xmcl/app-linux-arm64
```

Каждый пакет содержит несжатый asar, его контрольную сумму и (на Windows) иконку exe:

```
app.asar
app.asar.sha256
icon.ico          # только для win пакетов
```

`package.json` также содержит пользовательское поле `electron`, фиксирующее точную версию Electron, под которую собран asar. Это поле используется портативным скриптом-установщиком ([`installer/install.ps1`](../installer/install.ps1)) для загрузки соответствующей предварительно собранной версии Electron из зеркала.

Потребители загружают **пакет tarball** (пофайловый `/files/` эндпоинт npmmirror доступен только по белому списку; tarballs не ограничен) и извлекают app.asar:

```
https://registry.npmmirror.com/@xmcl/app-win/-/app-win-<версия>.tgz
```

Публикация автоматизирована через конвейер релизов (`.github/workflows/deploy-release.yml`); asar-файлы создаются в CI и не сохраняются в репозитории. `package.json` здесь являются шаблоном - его `name`/`version`/`electron` перезаписываются для каждой платформы во время публикации.
