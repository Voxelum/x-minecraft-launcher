# Gamepad Support and CLI Launch Guide

This guide explains how to configure Xbox gamepad and other controller support in X Minecraft Launcher, as well as how to launch instances directly from the command line.

## Overview

X Minecraft Launcher supports launching Minecraft with gamepad/controller support in two ways:

1. **Command Line Interface (CLI)**: Launch instances directly without opening the launcher UI (similar to PrismLauncher)
2. **Wrapper Commands**: Execute tools like gamemode, Steam Input, or gamepad mapping software when launching

## Command Line Interface (CLI)

You can launch Minecraft instances directly from the command line, similar to PrismLauncher's `-l` option. This is especially useful for:
- Steam Big Picture mode integration
- Desktop shortcuts
- Automation scripts
- Launching with gamepad-only navigation

### Usage

```bash
# Windows
xmcl.exe launch "<user-id>" "<instance-path>"

# Linux
xmcl launch "<user-id>" "<instance-path>"

# macOS
"/Applications/X Minecraft Launcher.app/Contents/MacOS/X Minecraft Launcher" launch "<user-id>" "<instance-path>"
```

### Parameters

- **user-id**: Your user account ID (find in launcher settings)
- **instance-path**: Full path to the instance folder

### Examples

```bash
# Windows
"C:\Program Files\X Minecraft Launcher\xmcl.exe" launch "your-user-id" "C:\Users\YourName\AppData\Roaming\xmcl\instances\MyInstance"

# Linux
/usr/bin/xmcl launch "your-user-id" "/home/username/.xmcl/instances/MyInstance"

# macOS
"/Applications/X Minecraft Launcher.app/Contents/MacOS/X Minecraft Launcher" launch "your-user-id" "/Users/username/Library/Application Support/xmcl/instances/MyInstance"
```

### Creating Launch Shortcuts

The launcher can create desktop shortcuts for you:

1. Click the dropdown menu on the launch button for your instance
2. Select "Create Shortcut" 
3. Choose the location for the shortcut
4. The shortcut will launch the instance directly using the CLI command

You can also add these shortcuts to Steam for controller navigation!

## Configuration: Wrapper Commands

There are two main options for adding gamepad support via wrapper commands:

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

#### Gamescope with Gamemode (combined wrapper)
```bash
gamescope -W 1920 -H 1080 -f -- gamemode
```
Note: The `--` separator tells gamescope to wrap the command that follows. This runs Minecraft through both gamescope and gamemode.

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

2. **Steam Big Picture Mode / Steam Deck**:
   
   **Method 1: Launch directly via CLI**
   - Create a desktop shortcut for your instance (right-click instance → Create Shortcut)
   - Add the shortcut to Steam as a non-Steam game
   - Steam will handle controller input for both launcher and game
   
   **Method 2: Add launcher to Steam**
   - Add X Minecraft Launcher executable to Steam as a non-Steam game
   - Set launch options: `launch "your-user-id" "path/to/instance"`
   - Configure controller mapping in Steam Input
   - Launch directly into your instance from Steam

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
   gamescope -W 1920 -H 1080 -f
   ```
   
   Or combine with gamemode (the `--` passes the remaining command to gamescope's wrapped execution):
   ```bash
   gamescope -W 1920 -H 1080 -f -- gamemode
   ```

3. **Steam Input** (best compatibility):
   - Create a desktop shortcut or use CLI launch command
   - Add to Steam as a non-Steam game with launch options:
     ```bash
     launch "your-user-id" "/path/to/instance"
     ```
   - Enable Steam Input for the game
   - Optionally set Prepend Command to: `steam-runtime`

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
