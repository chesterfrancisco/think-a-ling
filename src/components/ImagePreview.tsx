import type { UploadedImage } from '../services/image'
import type { DetectedObject } from '../services/objectDetection'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LabelCorrection } from '../types/scene'
import { sameDetection } from '../services/labelCorrections'
import { objectDisplayName } from '../services/objectNames'
import { imagePoint, manualTagName, type ManualTag } from '../services/manualTags'

export function ImagePreview({ image, detections, onObjectSelect, selectedIndex, corrections = [], markersVisible = true, manualTags = [], onTagSelect, placingTag = false, onPlaceTag, onCancelTag }: { image: UploadedImage; detections: DetectedObject[]; onObjectSelect?: (object: DetectedObject, index: number) => void; selectedIndex?: number; corrections?: LabelCorrection[]; markersVisible?: boolean; manualTags?: ManualTag[]; onTagSelect?: (tag: ManualTag) => void; placingTag?: boolean; onPlaceTag?: (point: ManualTag['point']) => void; onCancelTag?: () => void }) {
  const placement = useRef<HTMLButtonElement>(null)
  const [cursor, setCursor] = useState({ x: .5, y: .5 })
  useEffect(() => { if (placingTag) placement.current?.focus() }, [placingTag])
  const width = image.element.naturalWidth
  const height = image.element.naturalHeight
  const labelFor = (object: DetectedObject) => corrections.find(item => sameDetection(item, object))?.label
  return (
    <figure>
      <div className="image-preview" style={{ '--image-ratio': width / height } as CSSProperties}>
        <img src={image.url} alt={`Uploaded image: ${image.name}`} />
        {markersVisible && <><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${detections.length} object bounding boxes`}>
          {detections.map((detection, index) => (
            <rect key={index} x={detection.box.x} y={detection.box.y}
              width={detection.box.width} height={detection.box.height}
              fill="none" stroke="#c6f432" strokeWidth={selectedIndex === index ? '3' : '2'} vectorEffect="non-scaling-stroke">
              <title>{detection.label} — {(detection.confidence * 100).toFixed(1)}%</title>
            </rect>
          ))}
        </svg>
        {detections.map((detection, index) => (
          <button key={index} className={'box-label detection-hotspot' + (selectedIndex === index ? ' is-focus' : '')} type="button" onClick={() => onObjectSelect?.(detection, index)}
            aria-pressed={selectedIndex === index}
            aria-label={`Ask about ${objectDisplayName(detection, detections, corrections)}${labelFor(detection) ? ', named by you' : ', AI prediction'}`} style={{
            left: `${(detection.box.x + detection.box.width / 2) / width * 100}%`,
            top: `${(detection.box.y + detection.box.height / 4) / height * 100}%`,
          }}><span className="hotspot-dot"><Plus size={17} /></span><span className={'hotspot-label' + ((detection.box.x + detection.box.width / 2) / width > .65 ? ' label-left' : '')}>{!labelFor(detection) && detection.confidence < .6 ? 'Maybe ' : ''}{objectDisplayName(detection, detections, corrections)}{labelFor(detection) ? ' · you' : ''}</span></button>
        ))}
        {manualTags.map(tag => <button key={tag.id} type="button" className="manual-tag-pin" data-tag-id={tag.id}
          aria-label={`Edit ${manualTagName(tag, manualTags, detections, corrections)}, added by you`} onClick={() => onTagSelect?.(tag)}
          style={{ left: `${tag.point.x * 100}%`, top: `${tag.point.y * 100}%` }}>
          <span className="manual-pin-dot"><Plus size={18} /></span><span className={'manual-pin-label' + (tag.point.x > .5 ? ' label-left' : '')}>{manualTagName(tag, manualTags, detections, corrections)} · you</span>
        </button>)}</>}
        {placingTag && <button ref={placement} type="button" className="tag-placement" aria-label="Place a tag on the photo" aria-describedby="tag-placement-help"
          onClick={event => onPlaceTag?.(event.detail === 0 ? cursor : imagePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))}
          onKeyDown={event => {
            const delta: Record<string, [number, number]> = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] }
            if (delta[event.key]) { event.preventDefault(); const [x, y] = delta[event.key]; setCursor(point => ({ x: Math.max(0, Math.min(1, point.x + x)), y: Math.max(0, Math.min(1, point.y + y)) })) }
            if (event.key === 'Escape') { event.preventDefault(); onCancelTag?.() }
          }}><span className="tag-crosshair" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}><Plus size={30} /></span></button>}
      </div>
      <figcaption>{image.name} · {width} × {height} pixels</figcaption>
    </figure>
  )
}
