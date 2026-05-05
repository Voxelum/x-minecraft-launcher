# @xmcl/instance

Core instance management functionality for Minecraft launchers. This package provides functional utilities for managing Minecraft instances without coupling to specific launcher implementations.

## Features

- **Instance Discovery**: Scan and discover files in Minecraft instances
- **Multi-launcher Support**: Parse instances from MultiMC, Modrinth, CurseForge, and Vanilla launchers
- **File Delta Computation**: Calculate differences between instance file states
- **Manifest Generation**: Create instance manifests for sharing and synchronization
- **Functional Design**: Pure functions without class-based architecture
- **Framework Agnostic**: No coupling to specific launcher frameworks

## Installation

```bash
npm install @xmcl/instance
```

## Basic Usage

### Instance File Discovery

```typescript
import { discoverInstanceFiles, createDefaultFileFilter } from '@xmcl/instance'

const logger = {
  warn: (msg) => console.warn(msg),
  log: (msg) => console.log(msg)
}

// Discover all files in an instance
const files = await discoverInstanceFiles('/path/to/instance', logger, createDefaultFileFilter())
```

### Parse Different Launcher Formats

```typescript
import {
  parseMultiMCInstance,
  parseModrinthInstance,
  parseCurseforgeInstance,
  parseVanillaInstance
} from '@xmcl/instance'

// Parse MultiMC instance
const mmcInstance = await parseMultiMCInstance('/path/to/mmc/instance')

// Parse Modrinth instance
const modrinthInstance = await parseModrinthInstance('/path/to/modrinth/instance')

// Parse CurseForge instance
const cfInstance = await parseCurseforgeInstance('/path/to/cf/instance')

// Parse Vanilla instances
const vanillaInstances = await parseVanillaInstance('/path/to/.minecraft')
```

### Generate Instance Manifest

```typescript
import { generateInstanceManifest } from '@xmcl/instance'

const manifest = await generateInstanceManifest(
  { path: '/path/to/instance', hashes: ['sha1', 'md5'] },
  instance,
  worker,
  resourceManager,
  logger
)
```

### Compute File Deltas

```typescript
import { computeFileUpdates } from '@xmcl/instance'

const updates = await computeFileUpdates(
  '/path/to/instance',
  oldFiles,
  newFiles,
  lastInstallTime,
  fileSystem
)
```

## Core Concepts

### Functional Design

This package follows functional programming principles:

- Pure functions without side effects
- Immutable data structures
- Interface-based abstractions for dependencies
- No class-based architecture

### Abstraction Interfaces

The package defines abstractions for external dependencies:

- `Logger`: For logging operations
- `ChecksumWorker`: For computing file hashes
- `ResourceManager`: For managing resource metadata
- `FileSystem`: For file system operations

This allows the package to be used with any implementation of these interfaces.

### Instance Types

- **MultiMC**: Supports MultiMC and PolyMC launcher formats
- **Modrinth**: Supports Modrinth App instances
- **CurseForge**: Supports CurseForge launcher instances
- **Vanilla**: Supports official Minecraft launcher profiles

## API Reference

### Types

- `Instance`: Core instance data structure
- `InstanceFile`: Represents a file in an instance
- `InstanceManifest`: Instance manifest for sharing
- `RuntimeVersions`: Runtime version requirements
- `CreateInstanceOptions`: Options for creating instances

### Functions

- `discoverInstanceFiles()`: Discover files in instance directory
- `decorateInstanceFiles()`: Add metadata to discovered files
- `generateInstanceManifest()`: Create instance manifest
- `computeFileUpdates()`: Calculate file differences
- `parseMultiMCInstance()`: Parse MultiMC instance
- `parseModrinthInstance()`: Parse Modrinth instance
- `parseCurseforgeInstance()`: Parse CurseForge instance
- `parseVanillaInstance()`: Parse Vanilla launcher profiles

## License

MIT
