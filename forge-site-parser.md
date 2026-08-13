# Forge Site Parser

[![npm version](https://img.shields.io/npm/v/@xmcl/forge-installer.svg)](https://www.npmjs.com/package/@xmcl/forge-installer)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/forge-installer.svg)](https://npmjs.com/@xmcl/forge-installer)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/forge-installer)](https://packagephobia.now.sh/result?p=@xmcl/forge-installer)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide a parser to parse forge website (files.minecraftforge.net).

For detail please see the [github repository](https://github.com/Voxelum/minecraft-launcher-core-node).

## 🤝 Interfaces

<div class="definition-grid interface"><a href="forge-site-parser/ForgeWebPage">ForgeWebPage</a></div>

## 🏭 Functions

### parse

```ts
parse(content: string): ForgeWebPage
```
Parse the html string of forge webpage
#### Parameters

- **content**: `string`
#### Return Type

- `ForgeWebPage`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/forge-site-parser/index.ts#L78" target="_blank" rel="noreferrer">packages/forge-site-parser/index.ts:78</a>
</p>



