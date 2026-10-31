/** Track processes rather than paths: one instance may have a client and server. */
export class TrayRunningInstances {
  private readonly pathsByPid = new Map<number, string>()

  add(pid: number, path: string) {
    this.pathsByPid.set(pid, path)
  }

  delete(pid: number) {
    this.pathsByPid.delete(pid)
  }

  has(path: string) {
    return [...this.pathsByPid.values()].includes(path)
  }
}
