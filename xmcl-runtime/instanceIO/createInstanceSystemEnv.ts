import { InstanceSystemEnv } from '@xmcl/instance';
import { existsSync, readFile, readdir, stat } from 'fs-extra';
import { join, relative, sep } from 'path';
import { pathToFileURL } from 'url';
import { Logger } from '~/logger';

export function createInstanceSystemEnv(logger: Logger) {
  const result: InstanceSystemEnv = {
    join,
    relative,
    stat,
    readdir,
    existsSync,
    readFile,
    pathToFileURL,
    sep,
    logger,
  }

  return result
}