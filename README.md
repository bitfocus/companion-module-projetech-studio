# companion-module-projetech-studio

[Bitfocus Companion](https://bitfocus.io/companion) module for **Projetech Studio**, the event video switcher and player by Projetech Eventos. It talks to Projetech Studio over its vMix-compatible TCP API (port 8099): cut/fade, preview, playback, overlays, audio, recording, streaming, outputs and timer, with per-input tally.

Version 1.5 adds the **Modo ProLume** clip grid of Projetech Studio 1.5: trigger and select clips and columns, eject, layer opacity, volume, bypass, solo, transition and blend, the composition master, feedbacks for the clips on air, the selected cell, empty cells and ending clips, per-layer countdown variables, and ready-made 8 × 8 presets. With an older Projetech Studio the grid's buttons simply stay dark.

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
3. Submit the tag at https://developer.bitfocus.io → _My Connections_ → this module → _Submit Version_.

---

## Português

Módulo do Companion para o **Projetech Studio**. Instalação, pela página _Modules_ do Companion 4 ou mais novo: pesquise **Projetech Studio** (depois que a versão for aprovada pela Bitfocus) ou importe o pacote `.tgz` da página de download (https://studio.projetech.com.br). Depois crie a conexão com o IP do PC do Projetech Studio e a porta 8099, e use os botões prontos em _Presets → Projetech Studio_.

A versão 1.5 traz o **Modo ProLume** (a grade de clipes do Projetech Studio 1.5): disparar e selecionar clipes e colunas, ejetar, opacidade, volume, bypass, solo, transição e blend das camadas, o master da composição, feedbacks de clipe no ar, célula selecionada, célula vazia e clipe terminando, o tempo restante de cada camada e presets prontos de 8 × 8 (categorias _Modo ProLume: clipes_, _colunas_ e _camadas_).
