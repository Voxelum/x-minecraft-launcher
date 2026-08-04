---
id: sodium-neoforge-black-screen
description: Troubleshoot a NeoForge black screen involving Sodium by testing compatible Sodium versions before checking and updating NeoForge.
tags: [sodium, neoforge, black-screen, shader, iris, compatibility, troubleshooting]
---
# Troubleshoot a Sodium black screen on NeoForge

Use this when a NeoForge instance with Sodium opens to a black screen.

## 1. Try another Sodium version

1. Check the latest `game.log`, `instance.json`, and `ls mods` to confirm the exact Minecraft, NeoForge, and Sodium versions.
2. Run `mod update check` without `--skip-version`. Choose a compatible Sodium version; it may be an upgrade or downgrade.
3. Stage only the Sodium replacement, review `instance manifest status`, then run `instance manifest apply` once. Keep Iris, shader packs, and unrelated mods unchanged.
4. Launch once and inspect the new log. For this failure, switch the Sodium version first.

## 2. Then check NeoForge

1. If Sodium versions still fail, run `version-metadata loader neoforge <minecraftVersion> --refresh`; it returns the newest version first.
2. If the instance is not current, run `instance runtime set --loader neoforge --loader-version <exact-version-from-list>`, followed by `instance install`.
3. Repair reported mod incompatibilities with `mod update check`, `mod update stage`, `instance manifest status`, and `instance manifest apply`.
4. Launch once and report the tested Sodium/NeoForge combination if the black screen remains.