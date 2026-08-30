import type { Stats, StatName } from '@shared/types'
import { STAT_NAMES } from '@shared/types'
import { STAT_DESCRIPTIONS } from '@shared/descriptions'

const STAT_LABELS: Record<StatName, string> = {
  vigor: 'VIG',
  fitness: 'FIT',
  physique: 'PHY',
  reflex: 'REF',
  toughness: 'TGH',
  adaptation: 'ADP',
  instinct: 'INS'
}

const MAX_STAT = 10
const RING_COUNT = 5
const SIZE = 280
const CENTER = SIZE / 2
const RADIUS = 96
const LABEL_RADIUS = RADIUS + 24

// Axes are laid out clockwise from the top in STAT_NAMES order, matching the
// in-game genetics chart layout (Vigor at 12 o'clock, then Fitness, Physique...).
function pointAt(index: number, radius: number): [number, number] {
  const angle = (-90 + (index * 360) / STAT_NAMES.length) * (Math.PI / 180)
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

interface Props {
  stats: Stats
}

export default function AnimalStatRadar({ stats }: Props): JSX.Element {
  const dataPoints = STAT_NAMES.map((stat, i) =>
    pointAt(i, (Math.min(Math.max(stats[stat], 0), MAX_STAT) / MAX_STAT) * RADIUS)
  )
  const shapePoints = dataPoints.map((p) => p.join(',')).join(' ')

  return (
    <svg className="stat-radar" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Stat radar chart">
      {Array.from({ length: RING_COUNT }, (_, ring) => {
        const r = (RADIUS * (ring + 1)) / RING_COUNT
        const points = STAT_NAMES.map((_, i) => pointAt(i, r).join(',')).join(' ')
        return <polygon key={ring} className="stat-radar-ring" points={points} />
      })}
      {STAT_NAMES.map((stat, i) => {
        const [x, y] = pointAt(i, RADIUS)
        return <line key={stat} className="stat-radar-axis" x1={CENTER} y1={CENTER} x2={x} y2={y} />
      })}
      <polygon className="stat-radar-shape" points={shapePoints} />
      {dataPoints.map(([x, y], i) => (
        <circle key={STAT_NAMES[i]} className="stat-radar-dot" cx={x} cy={y} r={3} />
      ))}
      {STAT_NAMES.map((stat, i) => {
        const [x, y] = pointAt(i, LABEL_RADIUS)
        return (
          <text key={stat} className="stat-radar-label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            <title>{STAT_DESCRIPTIONS[stat]}</title>
            {STAT_LABELS[stat]}
          </text>
        )
      })}
    </svg>
  )
}
