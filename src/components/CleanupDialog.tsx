import { useMemo, useState } from 'react'
import type { Animal, SpeciesDefinition } from '@shared/types'
import { findRemovableDeceased } from '@shared/cleanup'
import { useAppData } from '../context/AppDataContext'
import SexSymbol from './SexSymbol'

interface Props {
  animals: Animal[]
  species: SpeciesDefinition[]
  onClose: () => void
}

export default function CleanupDialog({ animals, species, onClose }: Props): JSX.Element {
  const { deleteAnimals } = useAppData()
  const speciesNameById = new Map(species.map((s) => [s.id, s.name]))

  const candidates = useMemo(
    () =>
      [...findRemovableDeceased(animals)].sort((a, b) => {
        const speciesCmp = (speciesNameById.get(a.speciesId) ?? '').localeCompare(
          speciesNameById.get(b.speciesId) ?? ''
        )
        return speciesCmp !== 0 ? speciesCmp : a.name.localeCompare(b.name)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animals]
  )

  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.map((a) => a.id)))
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(): void {
    setSelected((prev) => (prev.size === candidates.length ? new Set() : new Set(candidates.map((a) => a.id))))
  }

  async function handleDelete(): Promise<void> {
    if (selected.size === 0) return
    if (!confirm(`Permanently delete ${selected.size} deceased animal(s)? This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAnimals([...selected])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cleanup-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Clean Up Deceased Animals</h2>
        <p className="hint">
          Deceased animals with no offspring on record — safe to remove without losing any pedigree
          information.
        </p>
        {error && <p className="error">{error}</p>}

        {candidates.length === 0 ? (
          <p className="empty-state">Nothing to clean up.</p>
        ) : (
          <table className="animal-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selected.size === candidates.length}
                    onChange={toggleAll}
                    title="Select all"
                  />
                </th>
                <th>Name</th>
                <th>Species</th>
                <th>Sex</th>
                <th>Bloodline</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((a) => (
                <tr key={a.id} onClick={() => toggle(a.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>{a.name}</td>
                  <td>{speciesNameById.get(a.speciesId) ?? '—'}</td>
                  <td>
                    <SexSymbol sex={a.sex} />
                  </td>
                  <td>{a.bloodline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="danger"
            disabled={selected.size === 0 || deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting…' : `Delete ${selected.size} Selected`}
          </button>
        </div>
      </div>
    </div>
  )
}
