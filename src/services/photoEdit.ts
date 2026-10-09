export interface PhotoEdits { rotation: number; flip: boolean; left: number; top: number; width: number; height: number; brightness: number; contrast: number }
export const defaultPhotoEdits: PhotoEdits = { rotation: 0, flip: false, left: 0, top: 0, width: 100, height: 100, brightness: 100, contrast: 100 }
export function renderEditedPhoto(image: HTMLImageElement, edits: PhotoEdits, output: HTMLCanvasElement) {
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
  const w = Math.max(1, Math.round(image.naturalWidth * scale)), h = Math.max(1, Math.round(image.naturalHeight * scale))
  const rotated = document.createElement('canvas'), swap = edits.rotation % 180 !== 0
  rotated.width = swap ? h : w; rotated.height = swap ? w : h
  const ctx = rotated.getContext('2d')!
  ctx.translate(rotated.width / 2, rotated.height / 2); ctx.rotate(edits.rotation * Math.PI / 180); ctx.scale(edits.flip ? -1 : 1, 1)
  ctx.drawImage(image, -w / 2, -h / 2, w, h)
  const x = rotated.width * Math.max(0, Math.min(90, edits.left)) / 100, y = rotated.height * Math.max(0, Math.min(90, edits.top)) / 100
  const cw = Math.max(1, Math.min(rotated.width - x, rotated.width * edits.width / 100)), ch = Math.max(1, Math.min(rotated.height - y, rotated.height * edits.height / 100))
  output.width = Math.round(cw); output.height = Math.round(ch)
  const target = output.getContext('2d')!
  target.filter = `brightness(${Math.max(50, Math.min(150, edits.brightness))}%) contrast(${Math.max(50, Math.min(150, edits.contrast))}%)`
  target.drawImage(rotated, x, y, cw, ch, 0, 0, output.width, output.height)
}
