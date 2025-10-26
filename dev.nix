{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [
    pkgs.sudo
    pkgs.nano
    pkgs.python3
    pkgs.python3Packages.pip
    pkgs.zip
    pkgs.unzip
    pkgs.docker
    # Optional: Include SAM CLI directly
  ];
  shellHook = ''
    export PATH="$HOME/.local/bin:$PATH"
  '';
}
