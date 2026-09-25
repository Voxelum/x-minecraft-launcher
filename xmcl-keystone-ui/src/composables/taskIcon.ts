import { BuiltinImages } from '@/constant'
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { Tasks } from '@xmcl/runtime-api'

export interface TaskIconInfo {
  type: 'image' | 'icon'
  src?: string
  icon?: string
  bgClass?: string
  color?: string
}

export function useTaskIcon() {
  const { instances } = injection(kInstances)

  function getTaskIcon(task?: Tasks): TaskIconInfo {
    if (!task) {
      return { type: 'icon', icon: 'assignment', bgClass: 'bg-primary/15 text-primary' }
    }

    // 1. Explicit icon on task
    if ('icon' in task && typeof (task as any).icon === 'string' && (task as any).icon) {
      return { type: 'image', src: (task as any).icon }
    }

    // 2. Instance install or duplicate
    if (task.type === 'installInstance') {
      const inst = instances.value.find((i) => i.path === task.instancePath)
      if (inst?.icon) {
        return { type: 'image', src: inst.icon }
      }
      return { type: 'image', src: BuiltinImages.craftingTable }
    }
    if (task.type === 'duplicateInstance') {
      return { type: 'icon', icon: 'content_copy', bgClass: 'bg-blue-500/15 text-blue-400' }
    }
    // НІ НУ НАВІЩО ТИ ТУТ ДИВИШСЯ....я просто пишу цю фігню вже 6 годину і хочу спати !
    // 3. Mod Loaders
    if (task.type === 'installForge') {
      return { type: 'image', src: BuiltinImages.forge }
    }
    if (task.type === 'installNeoForge') {
      return { type: 'image', src: BuiltinImages.neoForged }
    }
    if (task.type === 'installFabric') {
      return { type: 'image', src: BuiltinImages.fabric }
    }
    if (task.type === 'installQuilt') {
      return { type: 'image', src: BuiltinImages.quilt }
    }
    if (task.type === 'installOptifine') {
      return { type: 'image', src: BuiltinImages.optifine }
    }
    if (task.type === 'installLabyMod') {
      return { type: 'image', src: BuiltinImages.labyMod }
    }

    // 4. Vanilla Minecraft / Reinstall / Profile
    if (
      task.type === 'installVersion' ||
      task.type === 'installAssets' ||
      task.type === 'installLibraries' ||
      task.type === 'reinstall' ||
      task.type === 'installProfile'
    ) {
      return { type: 'image', src: BuiltinImages.minecraft }
    }

    // 5. Market files (Modrinth / CurseForge)
    if (task.type === 'installModrinthFile') {
      if ((task as any).icon) {
        return { type: 'image', src: (task as any).icon }
      }
      const filename = (task.filename || '').toLowerCase()
      if (filename.includes('shader') || filename.includes('iris') || filename.includes('oculus')) {
        return { type: 'image', src: BuiltinImages.iris }
      }
      if (filename.includes('resource') || filename.includes('texture')) {
        return { type: 'image', src: BuiltinImages.minecraft }
      }
      return { type: 'icon', icon: 'xmcl:modrinth', bgClass: 'bg-emerald-500/15 text-emerald-400' }
    }
    if (task.type === 'installCurseforgeFile') {
      if ((task as any).icon) {
        return { type: 'image', src: (task as any).icon }
      }
      return { type: 'icon', icon: 'xmcl:curseforge', bgClass: 'bg-amber-500/15 text-amber-400' }
    }

    // 6. Java Runtime
    if (task.type === 'installJre') {
      return { type: 'icon', icon: 'coffee', bgClass: 'bg-amber-500/15 text-amber-400' }
    }

    // 7. Updates
    if (task.type === 'downloaUpdate') {
      return { type: 'icon', icon: 'system_update', bgClass: 'bg-primary/15 text-primary' }
    }

    // 8. Modpack export
    if (task.type === 'exportModpack') {
      return { type: 'icon', icon: 'folder_zip', bgClass: 'bg-purple-500/15 text-purple-400' }
    }

    // 9. Authlib Injector
    if (task.type === 'installAuthlibInjector') {
      return { type: 'icon', icon: 'security', bgClass: 'bg-cyan-500/15 text-cyan-400' }
    }

    // 10. Bedrock
    if (task.type === 'installBedrock' || task.type === 'installBedrockVersion') {
      return { type: 'image', src: BuiltinImages.minecraft }
    }

    // 11. Mod metadata DB
    if (task.type === 'downloadModMetadataDb') {
      return { type: 'icon', icon: 'cloud_sync', bgClass: 'bg-indigo-500/15 text-indigo-400' }
    }

    // 12. Migrate Minecraft
    if (task.type === 'migrateMinecraft') {
      return { type: 'icon', icon: 'drive_file_move', bgClass: 'bg-teal-500/15 text-teal-400' }
    }

    // 13. Blueprint
    if (task.type === 'installBlueprint') {
      if ((task as any).icon) {
        return { type: 'image', src: (task as any).icon }
      }
      return { type: 'icon', icon: 'architecture', bgClass: 'bg-indigo-500/15 text-indigo-400' }
    }

    // Fallback
    return { type: 'icon', icon: 'downloading', bgClass: 'bg-primary/15 text-primary' }
  }

  return { getTaskIcon }
}

export type TaskOperationType = 'update' | 'download' | 'install' | 'export' | 'duplicate'

export interface TaskOperationInfo {
  type: TaskOperationType
  label: string
  icon: string
  color: string
  badgeBg: string
  iconAnimClass: string
}

export function useTaskOperation() {
  const { t } = useI18n()

  function getTaskOperation(task?: Tasks): TaskOperationInfo {
    if (!task) {
      return {
        type: 'download',
        label: t('task.op.download'),
        icon: 'arrow_downward',
        color: 'primary',
        badgeBg: 'bg-primary/20 text-primary border border-primary/30',
        iconAnimClass: 'task-anim-download',
      }
    }

    // 1. Update operations
    if (
      task.type === 'downloaUpdate' ||
      task.type === 'downloadModMetadataDb' ||
      (task as any).operation === 'update' ||
      (task as any).isUpdate ||
      (task.type === 'installInstance' && (task as any).isUpdate)
    ) {
      return {
        type: 'update',
        label: t('task.op.update'),
        icon: 'sync',
        color: 'warning',
        badgeBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        iconAnimClass: 'task-anim-rotate',
      }
    }

    // 2. Export operation
    if (task.type === 'exportModpack') {
      return {
        type: 'export',
        label: t('task.op.export'),
        icon: 'file_upload',
        color: 'purple',
        badgeBg: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
        iconAnimClass: 'task-anim-upload',
      }
    }

    // 3. Duplicate operation
    if (task.type === 'duplicateInstance') {
      return {
        type: 'duplicate',
        label: t('task.op.duplicate'),
        icon: 'content_copy',
        color: 'blue',
        badgeBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        iconAnimClass: '',
      }
    }

    // 4. Mod / Resource / Shader / Blueprint Downloads
    if (
      task.type === 'installModrinthFile' ||
      task.type === 'installCurseforgeFile' ||
      task.type === 'installBlueprint' ||
      (task.type === 'installInstance' && (task as any).fileName)
    ) {
      return {
        type: 'download',
        label: t('task.op.download'),
        icon: 'arrow_downward',
        color: 'primary',
        badgeBg: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
        iconAnimClass: 'task-anim-download',
      }
    }

    // 5. Version / Loader / Runtime Installs
    return {
      type: 'install',
      label: t('task.op.install'),
      icon: 'build',
      color: 'teal',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      iconAnimClass: 'task-anim-pulse',
    }
  }

  return { getTaskOperation }
}
