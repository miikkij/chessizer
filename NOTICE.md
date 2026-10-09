# Licensing and source availability

Copyright (c) 2025 Jouni Miikki. Original copyright and permission notices are preserved in [LICENSES/MIT-original.txt](LICENSES/MIT-original.txt).

Chessizer, as a combined application, is distributed under the GNU General Public License, version 3 or (at your option) any later version: **GPL-3.0-or-later**. See [LICENSE](LICENSE) for the full terms. This program comes without warranty.

The original MIT permission continues to apply to the original Chessizer code that was offered under it. This does not change the license of third-party dependencies or grant permission to distribute the combined application as MIT-only.

## Third-party components

- The browser board uses [Chessground](https://github.com/lichess-org/chessground), including its board and piece assets, under GPL-3.0-or-later. Its maintainers require GPL-compatible distribution of the combined application and source availability to users.
- The optional WAV service uses [python-chess](https://github.com/niklasf/python-chess), under GPL-3.0-or-later.
- Other dependencies retain their respective copyright notices and license terms. `pnpm build` generates `dist/THIRD_PARTY_LICENSES.md` from the dependencies included in the browser bundle. The Python packages' license texts are included in their installed distributions.

## Distributing a build

Keep the generated license report, the GPL license, this notice and the original MIT notice with the build. The build copies these notices from their canonical repository files into `dist/`.

Provide recipients with the corresponding source for the exact version you distribute, including local modifications, configuration, lockfiles and build scripts. The project source is [miikkij/chessizer](https://github.com/miikkij/chessizer); a private repository link alone is insufficient for recipients who cannot access it. Before publishing a hosted build, make its matching source accessible to its users or accompany the build with that source. Changing the repository's visibility and deploying a demo are separate publishing actions.

This repository does not relicense third-party assets or withdraw permissions already granted by the original MIT notice.
