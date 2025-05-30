{
  description = "Node.JS development by v1mkss";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      mkDevShell = system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          isLinux = system == "x86_64-linux" || system == "aarch64-linux";

          linuxDeps = with pkgs;[
            alsa-lib # Audio
            atk # Accessibility
            cairo # Graphics
            cups # Needed for electron
            dbus # Inter-process communication
            expat # XML parsing
            fontconfig # Font management
            freetype # Font rendering
            gdk-pixbuf # Image loading
            glib # Core libraries
            gobject-introspection # Object system introspection
            gtk3 # GUI Toolkit
            hicolor-icon-theme # Standard icon theme infrastructure
            libdrm # Direct Rendering Manager
            libgbm # Open source 3D graphics library
            libGL # OpenGL
            libglvnd # OpenGL vendor-neutral dispatch
            libxkbcommon # XKB
            mesa # OpenGL implementation
            nspr # Netscape Portable Runtime
            nss # Network Security Services
            pango # Text layout
            qt6.qtbase # Qt6 base
            stdenv.cc.cc.lib # Essential C++ runtime
            udev # Device management
            vulkan-loader # Vulkan support
            xorg.libX11 # X11 core
            xorg.libXcomposite # X11 compositing
            xorg.libXcursor # X11 cursors
            xorg.libXdamage # X11 damage reporting
            xorg.libXext # X11 extensions
            xorg.libXfixes # X11 fixes extension
            xorg.libXi # X11 input extension
            xorg.libxshmfence # X11 shared memory fences
            xorg.libXrandr # X11 RandR extension (screen config)
            xorg.libXrender # X11 rendering extension
            xorg.libXScrnSaver # X11 screen saver extension
            xorg.libXtst # X11 test extension (automation, etc.)
            xorg.libxcb # X protocol C binding
            xorg.libXxf86vm # XFree86 Video Mode extension
          ];

          buildInputs =
            [ pkgs.nodejs pkgs.pnpm ]
            ++ (if isLinux then linuxDeps else []);

          # Helper to construct LD_LIBRARY_PATH from linuxDeps
          ldLibraryPath =
            if isLinux then
              pkgs.lib.makeLibraryPath linuxDeps
            else "";
        in
        pkgs.mkShell {
          buildInputs = buildInputs;

          shellHook = ''
            # Set LD_LIBRARY_PATH to include all Linux-specific libraries
            if [ -n "${ldLibraryPath}" ]; then
              export LD_LIBRARY_PATH="${ldLibraryPath}:$LD_LIBRARY_PATH"
            fi

            echo "Development environment ready!"
          '';
        };
    in
    {
      devShells = nixpkgs.lib.genAttrs supportedSystems (system: {
        default = mkDevShell system;
      });
    };
}
