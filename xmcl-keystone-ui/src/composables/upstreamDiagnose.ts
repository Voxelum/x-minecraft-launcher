import { injection } from '@/util/inject';
import { kInstance } from './instance';
import { InstanceInstallServiceKey, ModpackServiceKey, ModrinthSpecialUpstream, VersionServiceKey, findMatchedVersion } from '@xmcl/runtime-api';
import { clientModrinthV2 } from '@/util/clients';
import { ProjectVersion } from '@xmcl/modrinth';
import { useService } from './service';
import { kInstances } from './instances';
import { kLocalVersions } from './versionLocal';

export function useUpstreamDiagnose() {
  const { instance } = injection(kInstance)

  const upstream = computed(() => instance.value.upstream && instance.value.upstream.type === 'modrinth-special' ? instance.value.upstream : undefined)
  const update = shallowRef(undefined as undefined | ProjectVersion)

  async function checkUpgrade(upstream: ModrinthSpecialUpstream) {
    const latest = await clientModrinthV2.getLatestProjectVersion(upstream.sha1)
    if (latest.id !== upstream.versionId) {
      // has new update
      update.value = latest
    }
  }

  watch(upstream, (upstream) => { if (upstream) checkUpgrade(upstream) }, { immediate: true })
  const { installModapckFromMarket } = useService(ModpackServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  const { openModpack } = useService(ModpackServiceKey)
  const { edit } = injection(kInstances)
  const { versions } = injection(kLocalVersions)
  const { resolveLocalVersion } = useService(VersionServiceKey)

  async function upgrade() {
    if (update.value) {
      const latest = update.value

      const instancePath = instance.value.path
      const [result] = await installModapckFromMarket({
        market: 0,
        version: { versionId: latest.id },
      })

      const file = latest.files[0]
      const newUpstream = {
        type: 'modrinth-special',
        projectId: latest.project_id,
        versionId: latest.id,
        sha1: file.hashes.sha1,
      } as ModrinthSpecialUpstream

      const state = await openModpack(result)
      const files = state.files
      const config = state.config
      await installInstanceFiles({
        path: instancePath,
        files,
        upstream: newUpstream,
      })
      const options = {
        instancePath,
        runtime: {
          minecraft: config.runtime?.minecraft || '',
          forge: config.runtime?.forge,
          fabricLoader: config.runtime?.fabricLoader,
          quiltLoader: config.runtime?.quiltLoader,
          neoForged: config.runtime?.neoForged,
        },
        modpackVersion: config.modpackVersion,
        upstream: config.upstream,
      }
      await edit(options)

      const header = findMatchedVersion(versions.value,
        '',
        options.runtime.minecraft,
        options.runtime.forge,
        options.runtime.neoForged,
        options.runtime.fabricLoader,
        '',
        options.runtime.quiltLoader,
        '')
      const version = header ? await resolveLocalVersion(header.id) : undefined
    }
  }
}
