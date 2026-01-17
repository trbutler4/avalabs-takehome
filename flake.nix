{
  description = "Node.js backend + React frontend demo application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            nodePackages.typescript
            vtsls
            yarn
          ];

          shellHook = ''
            echo "Node.js $(node --version)"
            echo "Yarn $(yarn --version)"
            echo "TypeScript $(tsc --version)"
          '';
        };
      }
    );
}
