# Sandbox fixtures

This directory is copied verbatim into each test's launcher `gameData`
folder before the Electron app starts. Use it to ship pre-staged game
files, modpacks, vanilla folders, etc.

Add files like:
- `versions/<id>/<id>.json`           pre-installed Minecraft versions
- `instances/<name>/instance.json`    pre-existing instances
- `modpacks/sample.mrpack`            modpack import fixtures
- `vanilla/.minecraft/...`            "import vanilla" fixtures

Programmatic seeding lives in `helpers/sandbox.ts` (`seedSandbox()`).
