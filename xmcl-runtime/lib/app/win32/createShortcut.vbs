' @file    This script is what actually produces the shortcut on Windows.
' @author  TheJaredWilcurt
' Code based on https://forums.techguy.org/threads/solved-vbscript-create-a-shortcut-within-a-folder.886401/
' and https://www.vbsedit.com/html/a239a3ac-e51c-4e70-859e-d2d8c2eb3135.asp

option explicit

dim strOutputPath, strFilePath, strArgs, strComment, strCwd, strIcon, strWindowMode, strHotkey
strOutputPath = Wscript.Arguments(0)
strFilePath = Wscript.Arguments(1)
strArgs = Wscript.Arguments(2)
strComment = Wscript.Arguments(3)
strCwd = Wscript.Arguments(4)
strIcon = Wscript.Arguments(5)
strWindowMode = Wscript.Arguments(6)
strHotkey = Wscript.Arguments(7)

sub createFile()
  dim objShell, objLink
  set objShell = CreateObject("WScript.Shell")
  ' objShell.Run "cmd /c yourcommands", 0, True
  set objLink = objShell.CreateShortcut(strOutputPath)
  objLink.TargetPath = strFilePath
  objLink.Arguments = strArgs
  objLink.Description = strComment
  objLink.WorkingDirectory = strCwd
  objLink.IconLocation = strIcon
  objLink.WindowStyle = strWindowMode
  objLink.Hotkey = strHotkey
  objLink.Save
end sub

call createFile()
