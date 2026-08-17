import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { SpeciesDefinition } from '@shared/types'
import { useAppData } from '../context/AppDataContext'

interface Props {
  speciesId: string | null
  onClose: () => void
  onSaved: (speciesId: string) => void
}

export default function SpeciesEditor({ speciesId, onClose, onSaved }: Props): JSX.Element {
  const { data, saveSpecies, deleteSpecies } = useAppData()
  const existing = speciesId ? data.species.find((s) => s.id === speciesId) ?? null : null
  const [form, setForm] = useState<SpeciesDefinition>(
    existing ?? { id: uuid(), name: '', classificationId: data.classifications[0]?.id ?? '' }
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const animalCount = data.animals.filter((a) => a.speciesId === form.id).length

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await saveSpecies(form)
      onSaved(form.id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing) return
    if (!confirm(`Delete species "${existing.name}"?`)) return
    try {
      await deleteSpecies(existing.id)
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal species-editor" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{existing ? `Edit ${existing.name}` : 'Add Species'}</h2>
        {formError && <p className="error">{formError}</p>}

        <label>
          Species name
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>

        <label>
          Classification
          <select
            required
            value={form.classificationId}
            onChange={(e) => setForm((f) => ({ ...f, classificationId: e.target.value }))}
          >
            {data.classifications.length === 0 && <option value="">No Classifications yet</option>}
            {data.classifications.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          Classification determines the scoring formula (stat weights, Bloodline and Phenotype bonuses) used for
          this species' Score and Mate Recommendations. Manage Classifications from the sidebar.
        </p>

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {existing && (
            <button
              type="button"
              className="danger"
              onClick={handleDelete}
              disabled={animalCount > 0}
              title={animalCount > 0 ? `Cannot delete: ${animalCount} animal(s) use this species` : undefined}
            >
              Delete
            </button>
          )}
          <button type="submit" className="primary" disabled={saving || data.classifications.length === 0}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
