---
id: marketplace-resource-install
description: Discover compatible marketplace (modrinth/curseforge) resources, stage exact files, review pending changes, and apply them once.
tags: [marketplace, modrinth, curseforge, mod, resourcepack, shaderpack, modpack, datapack, install]
---
# Install resources from a marketplace

Use current command and provider results as authoritative for available versions and compatibility. Run `help modrinth`, `help curseforge`, or help for a specific command when its syntax or provider surface is unclear.

## 1. Check the target and hardware

1. Inspect the selected instance runtime and its existing resources before searching.
2. Before recommending shaders, high-resolution resource packs, large modpacks, or performance-heavy mods, run `system info` and account for CPU, memory, disk, and GPU capabilities.
3. Use `version-metadata loader` to inspect mod-loader versions. When the selected instance runtime must change, run `instance runtime set` with exact versions, followed by `instance install`.

## 2. Search with compatible filters

1. `modrinth search` requires an explicit `--type <mod|resourcepack|shader|modpack|datapack>`.
2. Modrinth and CurseForge search and version commands default to the selected instance Minecraft version and mod loader and report their effective filters. Use `--all` only when intentionally requesting unfiltered results.
3. Use `--compact` with `modrinth project` and `curseforge project` unless the full provider payload is explicitly needed.

## 3. Resolve exact install references

1. Select a compatible version or file and use the exact provider `installRef` returned by a Modrinth or CurseForge search, version, or file result.
2. Resource install commands accept exactly one provider `installRef` or local file path.
3. Never pass search filters such as `--game-version` or `--loader` to an install command, and never pass a marketplace slug as a bare local path.

## 4. Stage and apply once

1. `install-mod`, `install-resourcepack`, `install-shaderpack`, and `install-save` only stage pending changes. Staging does not require confirmation, and staged files are not installed yet.
2. Stage every requested resource, then inspect the complete pending set with `instance manifest status`.
3. Run `instance manifest apply` once after review. Applying requires user confirmation.
4. After an apply that changes mods, inspect its `modDiagnosis` result for dependency incompatibilities or duplicates before continuing. Treat a `pending` diagnosis as inconclusive. The same diagnosis is retained as passive launcher context.