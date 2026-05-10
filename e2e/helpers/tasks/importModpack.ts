/**
 * High-level task: import a modpack file via the AddInstance dialog.
 *
 * The launcher uses Electron's native dialog.showOpenDialog. We replace it
 * inside the main process via `app.evaluate()` so the test can pass a fixture
 * file path without driving an OS-level file picker.
 */
import { LauncherFixture } from '../../fixtures/launcher'
import { AppShell } from '../pom/AppShell'
import { shoot } from '../shoot'
import { openAddInstance } from './createInstance'

/** Stub Electron's open dialog to return the given file path on next call. */
export async function stubOpenDialog(
  launcher: LauncherFixture,
  filePath: string,
): Promise<void> {
  await launcher.app.evaluate(({ dialog }, paths) => {
    // @ts-expect-error — overwriting for tests
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths })
  }, [filePath])
}

export interface ImportModpackArgs {
  /** Absolute path to the .mrpack / .zip file. */
  modpackFile: string
  /** Optional override for the new instance name. */
  name?: string
}

export async function importModpack(
  launcher: LauncherFixture,
  args: ImportModpackArgs,
): Promise<void> {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }

  await openAddInstance(launcher)
  await shoot(ctx, '01-add-dialog', {
    caption: 'Step 1. Open **Create instance** and click **Import** in the bottom-left.',
  })

  await stubOpenDialog(launcher, args.modpackFile)
  await shell.addInstanceImport.click()

  // Wait for the modpack to load — the dialog repopulates the file tree and
  // the create button becomes enabled when parsing finishes.
  await shell.addInstanceCreate.waitFor({ state: 'visible', timeout: 60_000 })
  // Give the parser a beat to populate the preview.
  await launcher.main.waitForTimeout(800)
  await shoot(ctx, '02-modpack-loaded', {
    caption: 'Step 2. The modpack is parsed and shown in the **preview** panel.',
  })

  if (args.name) {
    await shell.addInstanceName.fill(args.name)
  }

  await shell.addInstanceCreate.click()
  await shell.addInstanceDialog
    .waitFor({ state: 'hidden', timeout: 5 * 60_000 })
    .catch(() => {})
  await shoot(ctx, '03-imported', {
    caption: 'Step 3. The modpack instance is created and appears in the side bar.',
  })
}
