export class GFW {
  inside = false

  constructor(readonly signal: Promise<boolean>) {
    signal.then(inside => { this.inside = inside })
  }
}
