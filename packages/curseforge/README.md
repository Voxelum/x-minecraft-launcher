# Curseforge API

[![npm version](https://img.shields.io/npm/v/@xmcl/curseforge.svg)](https://www.npmjs.com/package/@xmcl/curseforge)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/curseforge.svg)](https://npmjs.com/@xmcl/curseforge)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/curseforge)](https://packagephobia.now.sh/result?p=@xmcl/curseforge)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide the curseforge API wrapper in https://docs.curseforge.com/

## Usage

This package is depending on undici for HTTP in nodejs, and the browser version will use browser `fetch` instead of undici.

### Find Curseforge Mods by search keyword

You can search curseforge mods by keyword

```ts
import { CurseforgeV1Client, SearchOptions } from '@xmcl/curseforge'

const api = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY)
const searchOptions: SearchOptions = {
   categoryId: 6, // 6 is mod,
   searchFilter: 'search-keyword',
};
const result = await api.searchMods(searchOptions)
const pageSize = result.pagination.pageSize
const total = result.pagination.total
const totalPages = Math.ceil(total / pageSize)
const mods: Mod[] = result.data // mod details
```

### The Mod detail

You can get the mod detail by mod id

```ts
import { CurseforgeV1Client } from '@xmcl/curseforge'
const api = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY)
const mod = await api.getMod(123)
console.log(mod.id) // 123
console.log(mod.name) // The mod name
console.log(mod.authors) // [{ id: 123, name: 'The author name' }]
console.log(mod.summary) // The mod summary
```

### Get Mod File List

```ts
// sample code for get file list for a mod
const api = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY)
const { data: files, pagination } = await api.getModFiles({
   modId: 1, // your mod id
   gameVersion: '1.16.5', // support minecraft 1.16.5, optional
   modLoaderType: FileModLoaderType.Fabric, // only fabric, optional
})
const pageSize = pagination.pageSize
const index = pagination.index
const total = pagination.total // total count
const pages = Math.ceil(total / pageSize) // total pages
const firstFile = files[0]
```
