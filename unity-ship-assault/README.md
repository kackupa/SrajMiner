# Ore Frontier: Boarding Action

An original, small Unity 2022.3 prototype set aboard a frontier carrier. It is a separate experiment from the Phaser mining game. It contains one short top-down assault: enter through the stern airlock, clear three security teams, and reach the bridge to take command from the captain. The ship, characters, and effects are made from runtime primitives; no third-party art or audio is used.

## Open and play

1. In Unity Hub, add this folder as a project and open it with a Unity 2022.3 editor.
2. Open `Assets/Scenes/Boarding.unity` and press Play. The scene builds itself at runtime.
3. Move with WASD; aim with the mouse. Left mouse fires the blaster, right mouse or Space swings the energy blade, and F emits a short-range gravity pulse. Defeat each security team to open its shutter. At the captain, press E to commandeer the bridge. Press R after victory or defeat to restart.

The gravity pulse stuns and pushes nearby guards. Combat is deliberately simple: six guards, one health pool, no inventory or save data. The captain is an objective, not a combat target.

## Verification

The project was authored without a Unity editor installed in this environment, so it has **not** been imported, compiled, or playtested in Unity. Open it in Unity to check package import, C# compilation, movement, combat, shutters, bridge interaction, and restart. The existing browser game has separate tests and build results in the root README.
