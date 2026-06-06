# @xmcl/yauzl

A fork of [`yauzl`](https://github.com/thejoshwolfe/yauzl) v2.10.0 maintained for the XMCL launcher.

## Why fork?

Upstream `yauzl` rejects any archive whose end-of-central-directory record (EOCDR) reports a disk number other than `0`, even when the value is the ZIP64 sentinel `0xFFFF`. ZIP64 archives produced by tools such as [PackSquash](https://github.com/ComunidadAylas/PackSquash) legitimately set the legacy disk-number field to `0xFFFF` and store the real value (which is `0`) inside the ZIP64 EOCDR record. As a result, every PackSquash-optimised resource pack fails to parse on the launcher with:

```
multi-disk zip files are not supported: found disk number: 65535
```

This fork:

1. Treats `0xFFFF` in the legacy EOCDR as the ZIP64 sentinel and defers the multi-disk check to the ZIP64 EOCDR.
2. Validates the ZIP64 EOCDR's *number of this disk* field (offset 16, 4 bytes) and continues to reject true multi-disk archives.

Everything else is byte-for-byte identical to upstream 2.10.0. The public API is unchanged so this package is a drop-in replacement for `yauzl`.

Upstream tracking issues:

- https://github.com/thejoshwolfe/yauzl/issues/123
- https://github.com/thejoshwolfe/yauzl/pull/142

## License

MIT — see [`LICENSE.upstream`](./LICENSE.upstream) for the original yauzl copyright.
