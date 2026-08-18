# Installer Module

`@xmcl/installer` builds and executes resumable Minecraft installation workflows.

The API has three layers:

1. Domain resolvers describe Minecraft files, loader recipes, and diagnostics.
2. Workflows resolve multi-stage domain work into executable install manifests.
3. Runtimes execute domain-neutral file, Java, and filesystem tasks.

## Install Files

Pure resolvers return `InstallFile` values that can be combined into a manifest:

```ts
import { MinecraftFolder } from '@xmcl/core'
import {
  createDefaultNodeInstallRuntime,
  executeInstallManifest,
  resolveLibraryInstallFiles,
} from '@xmcl/installer'

const minecraft = MinecraftFolder.from('C:/Minecraft')
const files = resolveLibraryInstallFiles(version.libraries, minecraft, options)

await executeInstallManifest({
  schemaVersion: 1,
  tasks: [{ id: 'libraries', type: 'files', files }],
}, createDefaultNodeInstallRuntime())
```

Common file resolvers include:

- `resolveMinecraftVersionJsonInstallFile`
- `resolveMinecraftJarInstallFile`
- `resolveLibraryInstallFiles`
- `resolveAssetMetadataInstallManifest`
- `resolveAssetObjectInstallFiles`
- `resolveAssetInstallFiles`

## Install Workflows

Use an `InstallWorkflow` when later work depends on metadata or files produced by an earlier stage. A workflow is a stateful object with an asynchronous `next()` method; it is not an async generator.

```ts
import {
  createDefaultNodeInstallRuntime,
  createModernForgeInstallWorkflow,
  executeInstallWorkflow,
} from '@xmcl/installer'

const result = await executeInstallWorkflow(
  createModernForgeInstallWorkflow(options),
  createDefaultNodeInstallRuntime(),
)
```

Available workflows include:

- `createFabricInstallWorkflow`
- `createQuiltInstallWorkflow`
- `createLabyModInstallWorkflow`
- `createProfileInstallWorkflow`
- `createModernForgeInstallWorkflow`
- `createJavaRuntimeInstallWorkflow`
- `createZuluRuntimeInstallWorkflow`

`runInstallWorkflow` is the lower-level stage runner for applications that execute each generated manifest through their own service boundary.

## Manifest Tasks

An `InstallManifest` contains independent tasks connected by `dependsOn`:

- `files` validates and downloads files, retrying invalid results.
- `java` tries command strategies in order and validates their outputs.
- `materialize` applies filesystem operations transactionally and validates outputs before commit.

Materialize outputs are postconditions, not cache keys. Materialize operations run whenever their stage is reached so permissions, links, extracted layouts, and removals are restored even when an individual output file already exists.

The `ensure-directory` operation preserves an existing directory and creates it only when absent. Operations that write files already ensure their own parent directories, so workflows emit `ensure-directory` only when the directory itself is part of the required layout.

## Runtime Adapters

`createDefaultNodeInstallRuntime` uses `@xmcl/file-transfer` for downloads. Applications can replace downloading, checksums, or Java execution while retaining the standard filesystem implementation:

```ts
import {
  createNodeInstallRuntime,
  executeInstallManifest,
} from '@xmcl/installer'

const runtime = createNodeInstallRuntime({
  signal: controller.signal,
  checksum: (path, algorithm) => checksumWorker(path, algorithm),
  download: (files) => downloader.download(files),
})

await executeInstallManifest(plan, runtime)
```

The runtime contract is domain-neutral. Mirror selection, proxy handling, concurrency, progress tracking, and process execution remain application concerns.

## Domain Recipes

These APIs resolve serializable application-level recipes rather than executable task graphs:

- `resolveVersionInstallManifest`
- `resolveVersionRepairManifest`
- `resolveJavaInstallManifest`

Applications consume a recipe and use the lower-level resolvers and workflows to execute it. Java fallback metadata is resolved only when that fallback is attempted.

## Diagnostics

Diagnostics inspect an installation without mutating it:

- `diagnoseInstallation`
- `diagnoseServerInstallation`
- `diagnoseProfile`
- `diagnoseProcessorOutputs`
- `diagnoseLibraries`
- `diagnoseVersionAssets`

## Browser Entry Point

The browser entry point exposes serializable recipes, errors, and metadata helpers from the `*.browser` modules. Node filesystem executors and workflows are available only from the main entry point.