/**
 * Read an image File, center-crop to a square, downscale to `size`px, and return
 * a compact JPEG data URI suitable for storing as a user avatar.
 * Rejects if the file isn't a readable image.
 */
export function resizeToAvatar(file, size = 160, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please choose an image file (JPG or PNG).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const s = Math.min(img.width, img.height)
        const ox = (img.width - s) / 2
        const oy = (img.height - s) / 2
        ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
