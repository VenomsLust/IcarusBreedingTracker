import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { Prospect } from '@shared/types'
import { useAppData } from '../context/AppDataContext'

interface Props {
  prospectId: string | null
  onClose: () => void
  onSaved: (prospectId: string) => void
}

function blankProspect(): Prospect {
  return { id: uuid(), name: '' }
}

export default function ProspectEditor({ prospectId, onClose, onSaved }: Props): JSX.Element {
  const { data, saveProspect, deleteProspect } = useAppData()
  const existing = prospectId ? data.prospects.find((p) => p.id === prospectId) ?? null : null
  const [form, setForm] = useState<Prospect>(existing ?? blankProspect())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const animalCount = data.animals.filter((a) => a.prospectId === form.id).length

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await saveProspect(form)
      onSaved(form.id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing) return
    const warning =
      animalCount > 0
        ? `Delete Prospect "${existing.name}"? ${animalCount} animal(s) assigned to it will become unassigned.`
        : `Delete Prospect "${existing.name}"?`
    if (!confirm(warning)) return
    try {
      await deleteProspect(existing.id)
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal prospect-editor" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{existing ? `Edit ${existing.name}` : 'Add Prospect'}</h2>
        {formError && <p className="error">{formError}</p>}

        <label>
          Prospect name
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {existing && (
            <button type="button" className="danger" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
