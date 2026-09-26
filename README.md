# Noctenium Elixir

Due to Classic+ being shut down, this project is defunct. It is released as-is.
Please see the [LICENSE](LICENSE) for more information.

A modding framework for the **Europe Classic+** private server. It allows you
to run any Toolbox or Proxy mod against the server's own closed-source proxy
"Noctenium".

Noctenium Elixir runs inside its own mod manager - just like normal Toolbox.
You must navigate to the Settings tab, point to your Classic+ Binaries folder,
then click "Install". This process adds a small preload inside the game,
forwarding Noctenium's already-decrypted packet stream out to Noctenium Elixir
over an authenticated loopback socket.

**Windows 10+ x64 only.**

## Setup

1. Install [Node.js](https://nodejs.org/) 24 or newer.
2. Download this repository (or `git clone` it).
3. Run `NocteniumElixir.exe` (GUI) or `NocteniumElixirCLI.exe` (terminal). The `_NoAdmin`
   variants skip the admin elevation.
4. Open **Settings -> Noctenium bridge**, set your Classic+ **Game Binaries** folder (the one
   with `noctenium.exe`), and click **Install / update**. This copies the game-side
   preload into `Binaries\noctenium\` and hooks it into `bunfig.toml`.
5. Manage mods on **My Mods**. Install them manually, do not rely on **Get More Mods**.
6. Hit **Start**. The status light next to the button goes yellow (waiting), then green
   once the game connects. Launch the game as usual.

The light is red if the bridge port is already taken; green means the game preload is
connected.

## Updating

Noctenium Elixir checks for a new version each time it starts, downloads what changed, and
restarts itself into it. If it can't reach the update server it carries on with the version you
have. Mods are updated separately. Either can be turned off on the **Settings** tab.

## Developing

### Mod authors

Start with [`doc/main.md`](doc/main.md) and `bin/mod.js`. The mod API is unchanged from
upstream Toolbox.

### Contributing

Enable the pre-commit format+lint hook once per clone:

```sh
git config core.hooksPath .githooks
```

| command                                   | action                                    |
| ----------------------------------------- | ----------------------------------------- |
| `npm run lint`                            | ESLint over the repo                      |
| `npm run format` / `npm run format:check` | Prettier over `bin/`, `bridge/`, `tests/` |
| `npm test`                                | Electron host self-test                   |
| `npm run test:installer`                  | game-side installer self-test             |

First-party code is tracked under `packages/` and linked in as npm workspaces; the
deprecated `tera-*` names are shims under `compat/`. The bridge adapter lives in
`bin/noctenium-preload/`, the game-side preload and its installer in `bridge/`.
See [`architecture/`](architecture/) for the full picture.

The executable launchers just run `bin/index-gui.js` / `bin/index-cli.js`.

Follow [Conventional Commits](https://www.conventionalcommits.org/) and bump `version` in
`package.json` with each change.

## Credits

Built on the open-source Proxy / Toolbox framework by Caali, Pinkie Pie, and meishu.
