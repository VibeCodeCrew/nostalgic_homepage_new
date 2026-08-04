# Third-party assets

## Icons

This extension uses scaled PNG icons derived from the **Windows XP High Resolution Icon Pack** by [marchmountain](https://github.com/marchmountain).

- Source repository: https://github.com/marchmountain/-Windows-XP-High-Resolution-Icon-Pack
- Original DeviantArt release: https://www.deviantart.com/marchmountain/art/Windows-XP-High-Resolution-Icon-Pack-916042853
- License: [CC0 1.0 Universal](https://github.com/marchmountain/-Windows-XP-High-Resolution-Icon-Pack/blob/main/LICENSE)

The Windows XP visual style and original icon designs are intellectual property of Microsoft Corporation. The icon pack above is a fan-made recreation/render released under CC0 by its author.

## Mac OS X theme icons

The `icons/mac/` set used by the macOS (Aqua) desktop theme is derived from the **Mac-X-Cheetah** icon theme by **Elbullazul**:

- Source: https://github.com/B00merang-Project/Mac-OS-X-Cheetah (mirror: https://github.com/VibeCodeCrew/Mac-OS-X-Cheetah)
- License: [GPL-3.0](https://github.com/B00merang-Project/Mac-OS-X-Cheetah/blob/master/LICENSE.md) — full license text ships as `icons/mac/LICENSE.md`
- Icons are fan-made recreations in the style of Mac OS X 10.0, converted to PNG and scaled to 64px. The Mac OS X visual style and original designs are intellectual property of Apple Inc.

## DOOM (game engine & game data)

The built-in **DOOM** app (folder `doom/`) runs the original Doom through a WebAssembly module:

- Engine: `doom/doomgeneric.wasm` + `doom/doomgeneric.js` + `doom/doomgeneric.data` — the Emscripten build of [doomgeneric](https://github.com/ozkl/doomgeneric) by ozkl (a portable fork of the original Doom source, with sound effects and music via Timidity), licensed under [GPL-2.0](https://github.com/ozkl/doomgeneric/blob/master/LICENSE). The prebuilt artifacts come from the author's demo page (https://ozkl.github.io/doomgeneric/); corresponding source code is available in the linked repository. The previous engine (Cloudflare's [doom-wasm](https://github.com/cloudflare/doom-wasm) Chocolate Doom build) was replaced because its SDL_mixer music hung on init.
- Music patches: `doomgeneric.data` bundles the freely redistributable Gravis GUS instrument patches (`dgguspat`) and `timidity.cfg` used by the Timidity MIDI renderer, as shipped with the doomgeneric Emscripten demo.
- Game data: the **DOOM1.WAD** shareware episode (© 1993 id Software, Inc.) is bundled inside `doomgeneric.data`. The shareware WAD may be redistributed unmodified. DOOM® is a registered trademark of ZeniMax Media Inc. in the US and/or other countries; this project is in no way affiliated with or approved by id Software or ZeniMax.
