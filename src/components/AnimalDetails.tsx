import type { SpeciesDefinition } from '@shared/types'
import { STAT_NAMES } from '@shared/types'
import { computeTotal } from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'
import AnimalStatRadar from './AnimalStatRadar'
import SexSymbol from './SexSymbol'

interface Props {
  species: SpeciesDefinition
  animalId: string
  onEdit: (animalId: string) => void
  onClose: () => void
  onSelectAnimal: (animalId: string) => void
}

type StatSource = 'sire' | 'dam' | 'both' | 'random'

// Icarus rolls each stat 40% Sire / 40% Dam / 20% random-or-mutation. A value
// that doesn't match either parent falls in that last 20% bucket, but nothing
// in the data distinguishes a random reroll from a true mutation within it.
function statSource(value: number, sireValue: number | null, damValue: number | null): StatSource {
  const sireMatch = sireValue !== null && value === sireValue
  const damMatch = damValue !== null && value === damValue
  if (sireMatch && damMatch) return 'both'
  if (sireMatch) return 'sire'
  if (damMatch) return 'dam'
  return 'random'
}

function sourceLabel(source: StatSource, sireName: string, damName: string): string {
  if (source === 'sire') return sireName
  if (source === 'dam') return damName
  if (source === 'both') return `${sireName} & ${damName}`
  return 'Random Roll / Mutation'
}

export default function AnimalDetails({ species, animalId, onEdit, onClose, onSelectAnimal }: Props): JSX.Element | null {
  const { data, deleteAnimal } = useAppData()
  const animal = data.animals.find((a) => a.id === animalId)
  if (!animal) return null

  const total = computeTotal(animal.stats)
  const sire = animal.sireId ? data.animals.find((a) => a.id === animal.sireId) ?? null : null
  const dam = animal.damId ? data.animals.find((a) => a.id === animal.damId) ?? null : null
  const prospect = animal.prospectId ? data.prospects.find((p) => p.id === animal.prospectId) ?? null : null
  const offspring = data.animals.filter((a) => a.sireId === animal.id || a.damId === animal.id)
  const status = animal.status ?? 'active'
  const hasParent = animal.sireId !== null || animal.damId !== null

  async function handleDelete(): Promise<void> {
    if (!confirm(`Delete ${animal!.name}? This cannot be undone.`)) return
    await deleteAnimal(animal!.id)
    onClose()
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer animal-details" onClick={(e) => e.stopPropagation()}>
        <div className="details-header">
          <h2>
            {animal.name} <span className={`status-cell status-${status}`}>· {status}</span>
          </h2>
          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Close
            </button>
            <button type="button" className="danger" onClick={handleDelete}>
              Delete
            </button>
            <button type="button" className="primary" onClick={() => onEdit(animal.id)}>
              Edit
            </button>
          </div>
        </div>

        <div className="form-grid">
          <div className="detail-field">
            <span className="detail-label">Sex</span>
            <span>
              <SexSymbol sex={animal.sex} /> {animal.sex}
            </span>
          </div>
          <div className="detail-field" title={BLOODLINE_DESCRIPTIONS[animal.bloodline]}>
            <span className="detail-label">Bloodline</span>
            <span>{animal.bloodline}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Phenotype</span>
            <span>{animal.phenotype ?? 'Base'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Sire</span>
            {sire ? (
              <button type="button" className="link-button" onClick={() => onSelectAnimal(sire.id)}>
                {sire.name}
              </button>
            ) : (
              <span>{animal.sireName ?? 'Wild Caught'}</span>
            )}
          </div>
          <div className="detail-field">
            <span className="detail-label">Dam</span>
            {dam ? (
              <button type="button" className="link-button" onClick={() => onSelectAnimal(dam.id)}>
                {dam.name}
              </button>
            ) : (
              <span>{animal.damName ?? 'Wild Caught'}</span>
            )}
          </div>
          <div className="detail-field">
            <span className="detail-label">Prospect</span>
            <span>{prospect?.name ?? 'Station'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Total</span>
            <span className="total-cell">{total}</span>
          </div>
        </div>

        <h3>Stats</h3>
        <div className="stat-radar-wrap">
          <AnimalStatRadar stats={animal.stats} />
        </div>
        <div className="stats-grid">
          {STAT_NAMES.map((stat) => (
            <div className="detail-field" key={stat} title={STAT_DESCRIPTIONS[stat]}>
              <span className="detail-label">{stat.charAt(0).toUpperCase() + stat.slice(1)}</span>
              <span>{animal.stats[stat]}</span>
            </div>
          ))}
        </div>

        <h3>Stat Inheritance</h3>
        {hasParent ? (
          <table className="inheritance-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Sire</th>
                <th>Dam</th>
                <th>{animal.name}</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {STAT_NAMES.map((stat) => {
                const value = animal.stats[stat]
                const sireValue = sire ? sire.stats[stat] : null
                const damValue = dam ? dam.stats[stat] : null
                const source = statSource(value, sireValue, damValue)
                return (
                  <tr key={stat}>
                    <td title={STAT_DESCRIPTIONS[stat]}>{stat.charAt(0).toUpperCase() + stat.slice(1)}</td>
                    <td>{sire ? sireValue : (animal.sireName ?? 'Wild Caught')}</td>
                    <td>{dam ? damValue : (animal.damName ?? 'Wild Caught')}</td>
                    <td>{value}</td>
                    <td className={`source-${source}`}>
                      {sourceLabel(source, sire?.name ?? animal.sireName ?? 'Sire', dam?.name ?? animal.damName ?? 'Dam')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="empty-state">{animal.sireName ?? animal.damName ?? 'Wild Caught'}</p>
        )}

        <h3>Offspring</h3>
        {offspring.length === 0 ? (
          <p className="empty-state">None recorded.</p>
        ) : (
          <ul className="offspring-list">
            {offspring.map((o) => (
              <li key={o.id}>
                <button type="button" className="link-button" onClick={() => onSelectAnimal(o.id)}>
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
