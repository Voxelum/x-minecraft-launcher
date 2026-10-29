import {
  InstanceScreenshotService as IInstanceScreenshotService,
  InstanceScreenshotServiceKey,
  SaveScreenshotDataOptions,
  ScreenshotItem,
} from "@xmcl/runtime-api";
import { constants, existsSync } from "fs";
import { lstat, mkdtemp, rename, rm } from "fs/promises";
import { assertScreenshotDirectory, safeScreenshotPath } from "./safeScreenshot";
import { copyFile, ensureDir, readdir, stat, unlink, writeFile } from "fs-extra";
import { basename, dirname, extname, join } from "path";
import { Inject, LauncherAppKey } from "~/app";
import { AbstractService, ExposeServiceKey } from "~/service";
import { LauncherApp } from "../app/LauncherApp";
import { InstanceService } from "./InstanceService";

const IMAGE_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
];

@ExposeServiceKey(InstanceScreenshotServiceKey)
export class InstanceScreenshotService
  extends AbstractService
  implements IInstanceScreenshotService
{
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app);
  }

  async getScreenshotItems(instancePath: string): Promise<ScreenshotItem[]> {
    const screenshotsPath = join(instancePath, "screenshots");
    if (!existsSync(screenshotsPath)) {
      return [];
    }
    const entries = await readdir(screenshotsPath, { withFileTypes: true });

    const imageFiles = entries
      .filter((entry) => {
        if (!entry.isFile()) {
          return false;
        }
        const ext = extname(entry.name).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .map((entry) => entry.name);

    const items: ScreenshotItem[] = [];
    for (const file of imageFiles) {
      const filePath = join(screenshotsPath, file);
      try {
        const fileStat = await stat(filePath);
        const url = new URL("http://launcher/media");
        url.searchParams.append("path", filePath);
        items.push({
          name: file,
          url: url.toString(),
          path: filePath,
          size: fileStat.size,
          createdAt: fileStat.mtimeMs || fileStat.birthtimeMs || 0,
        });
      } catch {
        // Skip unreadable files
      }
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  }

  async getScreenshots(instancePath: string): Promise<string[]> {
    const items = await this.getScreenshotItems(instancePath);
    return items.map((item) => item.url);
  }

  async showScreenshot(url: string): Promise<void> {
    const parsed = new URL(url);
    const path = parsed.searchParams.get("path");
    if (path && existsSync(path)) {
      this.app.shell.showItemInFolder(path);
    }
  }

  private async resolveScreenshot(url: string): Promise<string> {
    const instanceService = await this.app.registry.get(InstanceService);
    for (const instancePath of Object.keys(instanceService.state.all)) {
      try { return await safeScreenshotPath(instancePath, url); } catch { /* Try the next registered root. */ }
    }
    throw new Error("Screenshot is not in a registered instance");
  }

  async deleteScreenshot(url: string): Promise<boolean> {
    try {
      await unlink(await this.resolveScreenshot(url));
      return true;
    } catch (e) {
      this.error(e instanceof Error ? e : new Error(String(e)));
      return false;
    }
  }

  async deleteScreenshots(urls: string[]): Promise<number> {
    let count = 0;
    for (const url of urls) {
      const ok = await this.deleteScreenshot(url);
      if (ok) count++;
    }
    return count;
  }

  async saveScreenshotAs(url: string, targetPath: string, overwrite = false): Promise<boolean> {
    try {
      const sourcePath = await this.resolveScreenshot(url);
      // Directory selection is not permission to overwrite colliding files.
      // Only a single-file save dialog may explicitly authorize replacement.
      await assertScreenshotDirectory(dirname(targetPath));
      if (overwrite) {
        const info = await lstat(targetPath).catch((e: NodeJS.ErrnoException) => {
          if (e.code === "ENOENT") return undefined;
          throw e;
        });
        if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error("Unsafe export target");
        const stage = await mkdtemp(join(dirname(targetPath), ".xmcl-export-"));
        try {
          const staged = join(stage, "image");
          await copyFile(sourcePath, staged, constants.COPYFILE_EXCL);
          await assertScreenshotDirectory(dirname(targetPath));
          await rename(staged, targetPath);
        } finally { await rm(stage, { recursive: true, force: true }); }
      } else {
        await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
      }
      return true;
    } catch (e) {
      this.error(e instanceof Error ? e : new Error(String(e)));
      return false;
    }
  }

  async importScreenshots(instancePath: string, filePaths: string[]): Promise<string[]> {
    const instanceService = await this.app.registry.get(InstanceService);
    if (!instanceService.state.all[instancePath]) throw new Error("Unknown screenshot instance");
    const screenshotsPath = join(instancePath, "screenshots");
    await assertScreenshotDirectory(screenshotsPath);
    await ensureDir(screenshotsPath);
    const addedUrls: string[] = [];
    for (const source of filePaths) {
      try {
        if (!existsSync(source)) continue;
        const sourceExt = extname(source).toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(sourceExt)) continue;
        let base = basename(source);
        let dest = join(screenshotsPath, base);
        let counter = 1;
        const nameWithoutExt = basename(source, sourceExt);
        while (existsSync(dest)) {
          base = `${nameWithoutExt}_${counter}${sourceExt}`;
          dest = join(screenshotsPath, base);
          counter++;
        }
        await copyFile(source, dest, constants.COPYFILE_EXCL);
        const url = new URL("http://launcher/media");
        url.searchParams.append("path", dest);
        addedUrls.push(url.toString());
      } catch (e) {
        this.warn(`Failed to import screenshot ${source}: ${e}`);
      }
    }
    return addedUrls;
  }

  async setAsInstanceIcon(instancePath: string, url: string): Promise<void> {
    const instanceService = await this.app.registry.get(InstanceService);
    await instanceService.editInstance({ instancePath, icon: url });
  }

  async saveEditedScreenshot(options: SaveScreenshotDataOptions): Promise<ScreenshotItem> {
    const { instancePath, dataUrl, originalUrl, saveAsCopy } = options;
    const instanceService = await this.app.registry.get(InstanceService);
    if (!instanceService.state.all[instancePath]) {
      throw new Error("Unknown screenshot instance");
    }
    const screenshotsPath = join(instancePath, "screenshots");
    // Validate before creating directories or writing any file.
    await assertScreenshotDirectory(screenshotsPath);
    const originalPath = originalUrl ? await safeScreenshotPath(instancePath, originalUrl) : undefined;
    await ensureDir(screenshotsPath);

    const match = dataUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid image data URL format");
    }
    const buffer = Buffer.from(match[1], "base64");

    let destPath = "";
    let fileName = "";

    if (!saveAsCopy && originalPath) {
      destPath = originalPath;
      fileName = basename(originalPath);
    }

    if (!destPath) {
      let baseName = "screenshot_edited";
      let ext = ".png";
      if (originalUrl) {
        try {
          const parsed = new URL(originalUrl);
          const p = parsed.searchParams.get("path");
          if (p) {
            ext = extname(p) || ".png";
            baseName = `${basename(p, ext)}_edited`;
          }
        } catch {}
      } else {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, "-");
        baseName = `screenshot_${dateStr}`;
      }

      fileName = `${baseName}${ext}`;
      destPath = join(screenshotsPath, fileName);
      let counter = 1;
      while (existsSync(destPath)) {
        fileName = `${baseName}_${counter}${ext}`;
        destPath = join(screenshotsPath, fileName);
        counter++;
      }
    }

    if (originalPath && !saveAsCopy) {
      // Write the complete edit beside the screenshot before replacing it. A
      // failed write must not truncate the only copy of the user's original.
      const stage = await mkdtemp(join(screenshotsPath, ".xmcl-edit-"));
      try {
        const staged = join(stage, "image");
        await writeFile(staged, buffer, { flag: "wx" });
        await safeScreenshotPath(instancePath, originalUrl!);
        await rename(staged, destPath);
      } finally {
        await rm(stage, { recursive: true, force: true });
      }
    } else {
      // New copies must never clobber concurrent edits or imports.
      await writeFile(destPath, buffer, { flag: "wx" });
    }
    const fileStat = await stat(destPath);
    const url = new URL("http://launcher/media");
    url.searchParams.append("path", destPath);
    url.searchParams.append("t", String(fileStat.mtimeMs));

    return {
      name: fileName,
      path: destPath,
      url: url.toString(),
      size: fileStat.size,
      createdAt: fileStat.mtimeMs || fileStat.birthtimeMs || Date.now(),
    };
  }
}

