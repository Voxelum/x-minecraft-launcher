# Gamepad Support Guide

This guide explains how to configure Xbox gamepad and other controller support in X Minecraft Launcher.

## Overview

X Minecraft Launcher supports launching Minecraft with gamepad/controller support through **wrapper commands**. These commands are executed before the game launches, allowing you to use tools like gamemode, Steam Input, or other gamepad mapping software.

## Configuration

There are two main options for adding gamepad support:

### 1. Prepend Command (Recommended for Gamepads)

The **Prepend Command** wraps the entire Minecraft launch command with another program. This is ideal for gamepad launchers and compatibility layers.

**Location:**
- **Global Settings**: Settings → Global → Prepend Command
- **Instance Settings**: Instance Settings → Java → Prepend Command

**Examples:**

#### Linux with Gamemode
```bash
gamemode
```

#### Steam Runtime (for Steam Input support)
```bash
steam-runtime
```

#### MangoHud (for performance overlay)
```bash
mangohud
```

#### Gamescope (for better controller support and resolution scaling)
```bash
gamescope -W 1920 -H 1080 -f
```

#### Multiple commands (chain with &&)
```bash
gamemode && mangohud
```

### 2. Pre-Execute Command

The **Pre-Execute Command** runs a separate command *before* launching Minecraft. This is useful for setup scripts or preparatory tasks.

**Location:**
- **Global Settings**: Settings → Global → Pre-Execute Command
- **Instance Settings**: Instance Settings → Launch → Pre-Execute Command

**Examples:**

#### Start a background service
```bash
systemctl start gamepad-service
```

#### Run a setup script
```bash
/path/to/setup-gamepad.sh
```

## Common Gamepad Solutions

### Windows

1. **Xbox Controllers**: Native support in most Minecraft versions with mods like:
   - [MidnightControls](https://modrinth.com/mod/midnightcontrols)
   - [Controllable](https://www.curseforge.com/minecraft/mc-mods/controllable)

2. **Steam Big Picture Mode**:
   - Add X Minecraft Launcher to Steam as a non-Steam game
   - Configure controller mapping in Steam Input
   - Launch through Steam with Big Picture mode

### Linux

1. **Install gamemode** (recommended for better performance):
   ```bash
   # Arch/Manjaro
   sudo pacman -S gamemode
   
   # Ubuntu/Debian
   sudo apt install gamemode
   
   # Fedora
   sudo dnf install gamemode
   ```

2. **Use gamescope** for better controller compatibility:
   ```bash
   # Install gamescope
   sudo pacman -S gamescope  # Arch
   sudo apt install gamescope  # Ubuntu
   ```
   
   Then set Prepend Command to:
   ```bash
   gamescope -W 1920 -H 1080 -f -- gamemode
   ```

3. **Steam Input** (best compatibility):
   - Install Steam
   - Add X Minecraft Launcher to Steam
   - Enable Steam Input for the game
   - Set Prepend Command to: `steam-runtime`

### macOS

1. **Xbox/PS Controllers**: Use native macOS controller support
2. Install controller mods like MidnightControls or Controllable in your instance
3. Controllers should work automatically once mods are installed

## Controller Mods

For the best gamepad experience, install a controller mod in your Minecraft instance:

### Fabric/Quilt
- [MidnightControls](https://modrinth.com/mod/midnightcontrols) - Full controller support with customizable bindings

### Forge
- [Controllable](https://www.curseforge.com/minecraft/mc-mods/controllable) - Xbox/PlayStation controller support
- [LambdaControls](https://modrinth.com/mod/lambdacontrols) - Cross-platform controller support

## Troubleshooting

### Controller not detected
1. Ensure your controller is properly connected and working in your OS
2. Install a controller mod (MidnightControls or Controllable)
3. Try using Steam Input if other methods don't work

### Performance issues
- Use `gamemode` on Linux for better performance
- Add `mangohud` to monitor FPS and resource usage
- Consider using `gamescope` for better compositor handling

### Button mapping issues
- Use Steam Input for custom button mappings
- Configure mappings in your controller mod settings (in-game)
- On Linux, you can use `antimicrox` or `sc-controller` for custom mappings

## Advanced Configuration

### Environment Variables

You can also set environment variables in the **Launch → Java → Environment Variables** section:

```
SDL_GAMECONTROLLERCONFIG=/path/to/gamecontrollerdb.txt
```

### Custom Scripts

For complex setups, create a shell script and use it as the Prepend Command:

```bash
#!/bin/bash
# setup-gamepad.sh

# Start required services
systemctl start gamepad-service

# Set environment variables
export SDL_GAMECONTROLLERCONFIG=/path/to/config

# Execute the actual launch command
exec "$@"
```

Make it executable:
```bash
chmod +x setup-gamepad.sh
```

Then set Prepend Command to:
```bash
/path/to/setup-gamepad.sh
```

## Notes

- Changes to global settings apply to all instances by default
- Instance-specific settings override global settings
- You can reset instance settings to use global settings using the reset button
- The Prepend Command is executed as a wrapper around the entire launch command
- The Pre-Execute Command runs separately before the launch process

## See Also

- [Instance Settings Documentation](https://docs.xmcl.app/en/guide/instances)
- [MidnightControls Mod](https://modrinth.com/mod/midnightcontrols)
- [Controllable Mod](https://www.curseforge.com/minecraft/mc-mods/controllable)
- [Steam Input Documentation](https://partner.steamgames.com/doc/features/steam_controller)
