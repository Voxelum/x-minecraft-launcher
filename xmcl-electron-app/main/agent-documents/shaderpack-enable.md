---
id: shaderpack-enable
description: Evaluate hardware, install a compatible shader mod and shader-pack zip, then enable and verify the correct loader configuration.
tags: [shader, shaderpack, gpu, iris, oculus, optifine, config, performance]
---
# Install and enable a shader pack

Installing a shader-pack zip is not enough. The selected instance also needs a compatible shader mod, and the pack must be selected in that mod's configuration.

## 1. Evaluate the computer and instance

1. Run `system info` before recommending a shader. Consider the active GPU first, then CPU, available memory, and disk space.
2. Inspect the selected instance runtime and `ls mods`. Identify the exact Minecraft version, mod loader, and any existing shader mod.
3. Inspect `ls shaderpacks` before searching or installing another pack.
4. Prefer a lighter shader or conservative preset when the active GPU is integrated, old, or has limited memory. Do not promise a frame rate from model names alone.

## 2. Ensure compatible shader support

1. If a shader mod is already installed and enabled, verify that it supports the selected Minecraft version and loader.
2. Otherwise search for a shader mod using the current-instance filters. Typical families include Iris and Oculus; OptiFine can also provide shader support. These names are examples, not compatibility guarantees.
3. Use provider project/version results as authoritative. Resolve an exact compatible `installRef`, then run `install-mod <installRef>`.
4. Do not install a second shader implementation when a compatible one is already present unless the user explicitly asks to replace it.

## 3. Install the shader-pack zip

1. Search with `modrinth search <query> --type shader` or the corresponding CurseForge commands. Keep the selected-instance Minecraft filters unless an unfiltered search is intentional.
2. Resolve an exact shader-pack `installRef`, then run `install-shaderpack <installRef>`.
3. Mod and shader-pack install commands only stage files. Stage all required files first, inspect `instance manifest status`, then run `instance manifest apply` once.
4. After applying, use `ls mods` and `ls shaderpacks` to obtain the exact installed filenames. Do not claim the shader is enabled yet.

## 4. Enable the installed pack in config

Choose the configuration owned by the installed shader implementation:

- Iris: `config/iris.properties`
- Oculus: `config/oculus.properties`
- OptiFine or the vanilla shader options bridge: `optionsshaders.txt`

Read the chosen file with `vfs_read`. Use `vfs_write.replacements` for exact small edits and pass the returned revision. Set `shaderPack` to the exact installed zip filename. For Iris or Oculus, also set `enableShaders=true`. Use full `content` only when deliberately creating or rewriting the complete file.

Do not edit Iris or Oculus config before its shader mod has been applied. If no implementation can be identified, inspect the installed mods and config files instead of guessing a config path.

## 5. Verify

1. Read the config again and verify the exact shader-pack filename and enabled flag.
2. Confirm `ls .` reports an enabled shader pack.
3. Explain that first launch may compile shaders and can take longer. If launch fails, inspect the passive game-exit status and then the instance VFS logs only when relevant.