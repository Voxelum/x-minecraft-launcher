# Launcher Scenarios

These scenarios are all based on user have already installed the launcher

## Open Globally

Open launcher globally. For example

1. Open from taskbar in windows
2. Open from in windows search
3. Open from clicking dock app icon in MacOs

There is no argument provided to launch. (process.argv should ends with the execution program path) 

In this case, we should open the last "set to global" launcher.

## Open From Local File

The `.xmclq` file is the basic file extension for json content of metadata.

Open launcher from a file with custom extension to launch a brand new (maybe) launcher UI.

This is usually customized and provided by a server. It should contain the full metadata to recover the launcher UI.

### From Offline Bundle

The `.xmcl` file is the file extension for offline bundle of the launcher.

This is a zip file contains all the content (html, js, images) of the new launcher UI.

## Open From URL

Open from url in browser which return a JSON metadata of the launcher UI.
