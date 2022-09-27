# Instance Update/Undo Design

This doc describe the instance update/undo design for modpack and instance locking.

## Modpack Update

User want to update the instance via new modpack version from modrinth and curseforge. At the same time, user might also have some tweak over the old version modpack.

Update the modpack content to instance can be tricky.

The launcher won't be able to fully solve the problem, but it will cover the major scenario of the modpack update.

### Mod File Level Diff

Mods files are all in jar format, we can consider the file content is immutable. So, we can atomic compute the file change over the mod files.

Suppose we have the modpack with such content, adding three mods to the instance.

```diff
A.jar
B.jar
C.jar
```

Suppose the user edit the instance by adding two extra mods

```diff
A.jar
B.jar
C.jar
+ D.jar
+ E.jar
```

Suppose the new modpack has such files

```
A.jar
C.jar
X.jar
```

Let compute the diff between the original modpack and new modpack

```diff
+ X.jar
- C.jar
```

Now apply the diff to the user space to get the correct state

```diff
A.jar
B.jar
- C.jar
D.jar
E.jar
+ X.jar
```

#### Conflict

Suppose the new modpack also add a file named `D.jar`:

```diff
A.jar
B.jar
- C.jar
+ D.jar
+ X.jar
```

If the new `D.jar` has the same content (sha1) with the file added by user, it will just keep the `D.jar` there.

If the user's `D.jar` and the new modpack's `D.jar` are two different files, it will keep both of them but **renaming** user's `D.jar` to a new identical name.
It will have `CONFLICT` and 6-digit file sha1 hex in suffix.

```diff
A.jar
B.jar
- C.jar
+ D.jar
+ D.CONFLICT.abcdef.jar
+ X.jar
```

The launcher will hint user about any conflicts. The user can resolve them in mods file or edit the mod list in launcher.

#### Undo/Downgrade

The launcher should support undo between modpack version. This is just the revert operation of update.

After the upgrade, it should lock the new modpack content

```diff
A.jar
C.jar
X.jar
```

And the user space is:

```diff
A.jar
B.jar
D.jar
E.jar
X.jar
```

The undo should calculate the diff between new and old modpack
content:

```diff
A.jar
+ B.jar
C.jar
- X.jar
```

Then apply the diff to the user space:

```diff
A.jar
B.jar
C.jar
D.jar
E.jar
- X.jar
```

And now the mods are recover to the state before update.

#### Undo/Downgrade with Conflict

We start from user space with conflict

```diff
A.jar
B.jar
C.jar
D.jar
D.CONFLICT.abcdef.jar
X.jar
```

Apply the inverse operation

```diff
A.jar
B.jar
+ C.jar
- D.jar
- X.jar
```

it will become:

```diff
A.jar
B.jar
C.jar
- D.jar
D.CONFLICT.abcdef.jar
- X.jar
```

The launcher may or may not restore the conflict file name,
as this file name won't affect the launching.

### File Content Level Diff

Most of the config file are in text. The V1 won't cover the diff apply over the text files if they are different. The launcher will create backup file beside the non-binary files.

> This function should be OPTIONAL! User can disable the backup behavior to use git!

Suppose we have such config in the original modpack

```diff
configs/a.toml
configs/b.toml
.xyz/config.json
.abc/ConfigFile.ini
```

And the user edits two of them, and add a new extra text file

```diff
+ configs/a.toml
configs/b.toml
+ .xyz/config.json
.abc/ConfigFile.ini
+ custom.json
```

The new modpack edit an old file and add a new config file 

```diff
+ configs/a.toml
configs/b.toml
+ configs/c.toml
.xyz/config.json
.abc/ConfigFile.ini
```

It will backup the user-edit config file and use the modpack config files: 

```diff
+ configs/a.toml # this is the modpack version
+ configs/a.backup.toml # this is the user version
configs/b.toml
+ configs/c.toml
.xyz/config.json
.abc/ConfigFile.ini
custom.json
```

#### Undo

The undo won't work well as it will keep the `.backup` file even after the undo.

### Implementation Design

As the design described above, we should save the file list with sha1 for each modpack version.

The implementation of file hashes will be:

1. User import or download the modpack
2. During the import, the launcher parses all the files with download url or zip url () and store the list, containing file sha1 and file path relative to the instance root.
3. Store this metadata in our file metadata database.

In the instance config json (`instance.json`), the current modpack file version id will be stored. It will use the modpack file version to determine which modpack file is the instance based on.

## Common Instance Locking and Undo

Suppose just have an instance, and it runs pretty well...

User want to add some mods to the instance, or want to update some mods. This can be risky. As new mod or update mod can break the Minecraft, crashing is a headache.

This problem is similar but different to the modpack-based instance update new version.

In both cases, users want to undo the change, but in this case, users want to lock the mod list (or config files) at the moment of instance working well.

So, the launcher should provide a functionality to lock mod list. (Why not config file also? Because that can be hard and easy to get wrong! For config file level backup, use git instead!)

### Implementation Design

Launcher will provide a function to create a lock file named `instance-lock.json` (like `package-lock.json` right?).

It will store the `sha1`, `filePath` (relative to the instance) list to the mods. It will also have the optional `downloads` contains the download url of the file here.
