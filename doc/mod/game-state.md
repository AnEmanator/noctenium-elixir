# Using tera-game-state

`tera-game-state` tracks common game events and exposes a higher-level abstraction layer
with both events and state variables. Require it (or use the `mod.game` accessor, which
resolves to it) and it loads as a normal library dependency.

Please note that it is generally encouraged to rely on `tera-game-state` as much as
possible, in order to avoid duplicate processing of packets and to reduce the number of
incompatibilities (and, in consequence, the required maintenance effort for you as a module
developer) introduced by breaking changes in game updates. It provides a thoroughly tested
abstraction layer, so it is very likely to properly handle all possible edge cases,
resulting in more robust code.

As an example, you should always use `mod.game.on('enter_game', () => ...);` instead of
hooking `S_LOGIN` if possible.

The `tera-game-state` docs are in that mod's own `doc/` folder under `mods/`.
