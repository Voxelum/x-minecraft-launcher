export function useDrop (
  callback: (files: File[]) => void,
) {
  function onDrop (event: DragEvent) {
    if (!event.dataTransfer) return
    event.preventDefault()
    const length = event.dataTransfer.files.length
    if (length > 0) {
      const files = [] as File[]
      for (let i = 0; i < length; ++i) {
        files.push(event.dataTransfer.files[i])
      }
      if (files.length > 0) {
        callback(files)
      }
    }
  }
  return { onDrop }
}
