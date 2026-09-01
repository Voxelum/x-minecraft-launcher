# Interface InstallManifest

A domain-agnostic executable install manifest.

Workflows may understand Minecraft, loaders, profiles, or asset indexes;
manifests and executors must not. A manifest only describes files, processes, and
deterministic filesystem materialization.
## 🏷️ Properties

### schemaVersion

```ts
schemaVersion: 1
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L98" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:98</a>
</p>


### tasks

```ts
tasks: InstallTask[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L99" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:99</a>
</p>


