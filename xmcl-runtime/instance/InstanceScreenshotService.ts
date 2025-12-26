import {
  InstanceScreenshotService as IInstanceScreenshotService,
  InstanceScreenshotServiceKey,
} from "@xmcl/runtime-api";
import { existsSync } from "fs";
import { readdir, unlink } from "fs-extra";
import { extname, join } from "path"; // Импортирован extname
import { Inject, LauncherAppKey } from "~/app";
import { AbstractService, ExposeServiceKey } from "~/service";
import { LauncherApp } from "../app/LauncherApp";

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

  async getScreenshots(instancePath: string): Promise<string[]> {
    const screenshotsPath = join(instancePath, "screenshots");
    if (!existsSync(screenshotsPath)) {
      return [];
    }
    const entries = await readdir(screenshotsPath, { withFileTypes: true });

    // Filter out directories and non-image files
    const imageFiles = entries
      .filter((entry) => {
        if (!entry.isFile()) {
          return false;
        }
        const ext = extname(entry.name).toLowerCase(); // Теперь extname доступна
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .map((entry) => entry.name);

    const urls = imageFiles.map((file) => {
      const url = new URL("http://launcher/media");
      url.searchParams.append("path", join(screenshotsPath, file));
      return url.toString();
    });
    return urls;
  }

  async showScreenshot(url: string): Promise<void> {
    const parsed = new URL(url);
    const path = parsed.searchParams.get("path");
    if (path && existsSync(path)) {
      this.app.shell.showItemInFolder(path);
    }
  }

  async deleteScreenshot(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);
      const path = parsed.searchParams.get("path");
      if (path && existsSync(path)) {
        // Try to move to trash first
        try {
          // Исправлен вызов метода для перемещения в корзину
          await this.app.shell.moveItemToTrash(path);
          return true;
        } catch {
          // If trash fails, delete directly
          await unlink(path);
          return true;
        }
      }
      return false;
    } catch (e) {
      // Исправлен вызов this.error - передаем только объект ошибки
      this.error(e);
      return false;
    }
  }
}
