export interface UploadedImage {
  file: File
  name: string
  url: string
  element: HTMLImageElement
}

export async function loadImage(file: File): Promise<UploadedImage> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or BMP image.')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const element = new Image()
    element.src = url
    await element.decode()
    if (element.naturalWidth * element.naturalHeight > 25_000_000) {
      throw new Error('Choose an image with at most 25 megapixels.')
    }
    return { file, name: file.name, url, element }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error instanceof Error && error.message.includes('megapixels')
      ? error : new Error('This image could not be decoded. Try another image.')
  }
}
