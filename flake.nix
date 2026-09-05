{
  description = "tauri dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs =
    { nixpkgs, rust-overlay, ... }:
    let
      system = "x86_64-linux";
      overlays = [ (import rust-overlay) ];
      pkgs = import nixpkgs { inherit system overlays; };
      lib = pkgs.lib;

      packageJson = lib.importJSON ./package.json;

      gstPlugins = with pkgs.gst_all_1; [
        gstreamer
        gst-plugins-base
        gst-plugins-good
        gst-plugins-bad
        gst-plugins-ugly
        gst-libav
      ];
      gstPluginPath = lib.makeSearchPathOutput "lib" "lib/gstreamer-1.0" gstPlugins;

      rustToolchain = pkgs.rust-bin.stable.latest.default.override {
        extensions = [
          "rust-src"
          "rust-analyzer"
          "clippy"
          "rustfmt"
        ];
      };
      rustPlatform = pkgs.makeRustPlatform {
        cargo = pkgs.rust-bin.stable.latest.minimal;
        rustc = pkgs.rust-bin.stable.latest.minimal;
      };
    in
    {
      packages.${system} = rec {
        default = youtube-history-viewer;

        youtube-history-viewer = rustPlatform.buildRustPackage (finalAttrs: {
          pname = "youtube-history-viewer";
          inherit (packageJson) version;
          src = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.difference ./. (
              lib.fileset.unions [
                (lib.fileset.maybeMissing ./node_modules)
                (lib.fileset.maybeMissing ./dist)
                (lib.fileset.maybeMissing ./src-tauri/target)
              ]
            );
          };

          cargoRoot = "src-tauri";
          buildAndTestSubdir = "src-tauri";
          cargoLock.lockFile = ./src-tauri/Cargo.lock;

          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit (finalAttrs) pname version src;
            pnpm = pkgs.pnpm;
            fetcherVersion = 4;
            hash = "sha256-VPbS/xevHRKfAmN7zfmVkMjmtJS4ZJDTBBNT0uN02Qw=";
          };

          nativeBuildInputs = with pkgs; [
            cargo-tauri.hook
            nodejs
            pnpm
            pnpmConfigHook
            pkg-config
            wrapGAppsHook3
          ];

          buildInputs = with pkgs; [
            librsvg
            webkitgtk_4_1
            gtk3
            libsoup_3
            openssl
            glib-networking
          ];

          preFixup = ''gappsWrapperArgs+=(--prefix GST_PLUGIN_SYSTEM_PATH_1_0 : "${gstPluginPath}")'';

          doCheck = false;

          meta = {
            description = "Browse, filter, and explore your YouTube watch history locally.";
            mainProgram = "youtube-history-viewer";
            platforms = lib.platforms.linux;
          };
        });
      };

      devShells.${system}.default = pkgs.mkShell {
        nativeBuildInputs = with pkgs; [
          rustToolchain
          pkg-config
          wrapGAppsHook3
          cargo-tauri
          nodejs
          pnpm
          glib-networking
        ];

        buildInputs = with pkgs; [
          librsvg
          webkitgtk_4_1
          gtk3
          libsoup_3
          openssl
          glib-networking
        ];

        env = {
          GIO_EXTRA_MODULES = "${pkgs.glib-networking}/lib/gio/modules";
          RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";
          GST_PLUGIN_SYSTEM_PATH_1_0 = lib.makeSearchPathOutput "lib" "lib/gstreamer-1.0" gstPlugins;
          __NV_DISABLE_EXPLICIT_SYNC = "1";
        };

        shellHook = ''
          export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH:$XDG_DATA_DIRS"

          echo "To get started run:"
          echo "  pnpm install"
          echo "For Desktop development, run:"
          echo "  pnpm tauri dev"
        '';
      };
    };
}
