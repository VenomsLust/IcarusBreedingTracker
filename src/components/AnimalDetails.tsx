import type { SpeciesDefinition } from '@shared/types'
import { STAT_NAMES, defaultScoreConfig } from '@shared/types'
import { computeScore, computeTotal } from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  animalId: string
  onEdit: (animalId: string) => void
  onClose: () => void
  onSelectAnimal: (animalId: string) => void
}

export default function AnimalDetails({ species, animalId, onEdit, onClose, onSelectAnimal }: Props): JSX.Element | null {
  const { data, deleteAnimal } = useAppData()
  const animal = data.animals.find((a) => a.id === animalId)
  if (!animal) return null

  const scoreConfig =
    data.classifications.find((c) => c.id === species.classificationId)?.scoreConfig ?? defaultScoreConfig()
  const total = computeTotal(animal.stats)
  const score = computeScore(animal.stats, animal.bloodline, animal.phenotype, scoreConfig)
  const sire = animal.sireId ? data.animals.find((a) => a.id === animal.sireId) ?? null : null
  const dam = animal.damId ? data.animals.find((a) => a.id === animal.damId) ?? null : null
  const prospect = animal.prospectId ? data.prospects.find((p) => p.id === animal.prospectId) ?? null : null
  const offspring = data.animals.filter((a) => a.sireId === animal.id || a.damId === animal.id)
  const status = animal.status ?? 'active'

  async function handleDelete(): Promise<void> {
    if (!confirm(`Delete ${animal!.name}? This cannot be undone.`)) return
    await deleteAnimal(animal!.id)
    onClose()
  }

  return (
    <div className="animal-details">
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
          <span>{animal.sex}</span>
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
            <span>Wild Caught</span>
          )}
        </div>
        <div className="detail-field">
          <span className="detail-label">Dam</span>
          {dam ? (
            <button type="button" className="link-button" onClick={() => onSelectAnimal(dam.id)}>
              {dam.name}
            </button>
          ) : (
            <span>Wild Caught</span>
          )}
        </div>
        <div className="detail-field">
          <span className="detail-label">Prospect</span>
          <span>{prospect?.name ?? 'Unassigned'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">Total</span>
          <span>{total}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">Score</span>
          <span className="score-cell">{score}</span>
        </div>
      </div>

      <h3>Stats</h3>
      <div className="stats-grid">
        {STAT_NAMES.map((stat) => (
          <div className="detail-field" key={stat} title={STAT_DESCRIPTIONS[stat]}>
            <span className="detail-label">{stat.charAt(0).toUpperCase() + stat.slice(1)}</span>
            <span>{animal.stats[stat]}</span>
          </div>
        ))}
      </div>

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
  )
}
