---
id: instance-runtime-change
description: Change the selected instance Minecraft or mod-loader version, validate compatibility, clear conflicting runtimes, and install the resolved version.
tags: [instance, runtime, minecraft, version, upgrade, downgrade, loader, modloader, forge, neoforge, fabric, quilt]
---
# Change an instance Minecraft or mod-loader version

Runtime changes do not update mods or other instance content.

## 1. Choose a compatible target

Read `instance.json` and inspect installed mods. Use `version-metadata minecraft` to discover Minecraft versions. Then run `version-metadata loader <forge|neoforge|fabric|quilt> <minecraftVersion>` and choose an exact returned loader version.

## 2. Change only the mod loader

`instance runtime set --loader <forge|neoforge|fabric|quilt> --loader-version <exact-version>`

Use this when Minecraft stays unchanged. It clears conflicting loaders, OptiFine, and LabyMod. Then run `instance install`.

## 3. Change Minecraft and runtime together

Set the exact Minecraft and loader versions atomically:

```text
instance runtime set --minecraft 1.21.1 --loader fabric --loader-version <exact-version-from-version-metadata>
```

To remove every mod loader instead, run `instance runtime set --minecraft <version> --no-loader`. Runtime changes do not install files; always run `instance install` afterward.

## 4. Install and verify

1. Re-read `instance.json`, run `instance diagnose`, and review the returned mod diagnosis.
2. For incompatible mods, run `mod update check` without `--skip-version`; this may upgrade or downgrade a mod. Then run `mod update stage`, `instance manifest status`, and `instance manifest apply`.
3. Launch only when requested and inspect the new log if it fails.