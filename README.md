# companion-module-projetech-studio

[Bitfocus Companion](https://bitfocus.io/companion) module for **Projetech Studio**, the event video switcher and player by Projetech Eventos. It talks to Projetech Studio over its vMix-compatible TCP API (port 8099): cut/fade, preview, playback, overlays, audio, recording, streaming, outputs and timer, with per-input tally.

Version 1.5 adds the ProLume clip grid of Projetech Studio 1.5 (_Modo ProLume_): trigger and select clips and columns, eject, layer opacity, volume, bypass, solo, transition and blend, the composition master, feedbacks for the clips on air, the selected cell, empty cells and ending clips, per-layer countdown variables, and ready-made 8 × 8 presets. With an older Projetech Studio the grid's buttons simply stay dark.

## Installing

In Companion 4 or newer, open _Modules_ and search for **Projetech Studio**, or import the `.tgz` package from the Projetech Studio download page (https://studio.projetech.com.br). Then add a connection with the IP of the computer running Projetech Studio and port 8099, and use the ready-made buttons under _Presets → Projetech Studio_.

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE).

The module id was `projetech-pmix` in early test builds (PMix is the product's code name). It is listed in `legacyIds`, so connections made with those builds move to this module.

## Development

Requires Node 22 and Yarn 4 (`corepack enable`).

```
yarn            # install
yarn build      # compile to dist/ (enough for Companion to load it)
yarn dev        # compile in watch mode
yarn lint       # eslint + prettier
yarn test       # build, then protocol tests against a local fake of the Projetech Studio API
yarn package    # build the distributable .tgz
```

To load it while developing: Companion 4.1+ → _Settings → Developer → Developer modules path_ → the folder that contains this one.

## Release

1. Bump `version` in `package.json` (`companion/manifest.json` keeps `0.0.0`, the build fills it in).
2. Tag `vX.Y.Z` (GitHub release or `git tag` + push).
3. Submit the tag at https://developer.bitfocus.io → _My Modules_ → this module → _Submit Version_.
