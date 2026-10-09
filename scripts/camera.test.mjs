import test from 'node:test'
import assert from 'node:assert/strict'
import { CameraService, cameraError, LIVE_DETECTION_INTERVAL_MS } from '../src/services/camera.ts'

function environment(t, getUserMedia, secure = true) {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const originalSecure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: secure })
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else delete globalThis.navigator
    if (originalSecure) Object.defineProperty(globalThis, 'isSecureContext', originalSecure)
    else delete globalThis.isSecureContext
  })
}
function stream() {
  const track = { readyState: 'live', stop() { this.readyState = 'ended' } }
  return { track, getTracks: () => [track] }
}
test('late camera permission grants are stopped after leaving the camera', async t => {
  let grant
  const value = stream()
  environment(t, () => new Promise(resolve => { grant = resolve }))
  const camera = new CameraService()
  const pending = camera.start('environment')
  camera.stop()
  grant(value)
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(value.track.readyState, 'ended')
})
test('switching camera releases the old track and requests video only', async t => {
  const streams = [stream(), stream()]
  const requests = []
  environment(t, async constraints => { requests.push(constraints); return streams[requests.length - 1] })
  const camera = new CameraService()
  await camera.start('user')
  await camera.start('device:rear-camera')
  assert.equal(streams[0].track.readyState, 'ended')
  assert.deepEqual(requests[0].video.facingMode, { ideal: 'user' })
  assert.deepEqual(requests[1].video.deviceId, { exact: 'rear-camera' })
  assert.ok(requests.every(request => request.audio === false))
  camera.stop()
  assert.equal(streams[1].track.readyState, 'ended')
  assert.ok(LIVE_DETECTION_INTERVAL_MS >= 500)
})
test('insecure and unsupported contexts fail before requesting any media', async t => {
  let calls = 0
  environment(t, () => { calls++; throw new Error('Unexpected request') }, false)
  await assert.rejects(new CameraService().start('user'), /HTTPS or localhost/)
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
  await assert.rejects(new CameraService().start('user'), /does not support/)
  assert.equal(calls, 0)
})
test('camera errors explain permission, absent device, busy device and constraints', () => {
  assert.match(cameraError(new DOMException('', 'NotAllowedError')), /permission was denied/)
  assert.match(cameraError(new DOMException('', 'NotFoundError')), /No camera/)
  assert.match(cameraError(new DOMException('', 'NotReadableError')), /another app/)
  assert.match(cameraError(new DOMException('', 'OverconstrainedError')), /another camera/)
})
