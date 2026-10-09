import type { UploadedImage } from '../services/image'
import type { DetectedObject } from '../services/objectDetection'
import { Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { LabelCorrection } from '../types/scene'
import { sameDetection } from '../services/labelCorrections'
import { objectDisplayName } from '../services/objectNames'

export function ImagePreview({ image, detections, onObjectSelect, selectedIndex, corrections = [], markersVisible = true }: { image: UploadedImage; detections: DetectedObject[]; onObjectSelect?: (object: DetectedObject, index: number) => void; selectedIndex?: number; corrections?: LabelCorrection[]; markersVisible?: boolean }) {
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
        ))}</>}
      </div>
      <figcaption>{image.name} · {width} × {height} pixels</figcaption>
    </figure>
  )
}
