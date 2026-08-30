import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { Animal, AnimalStatus, Bloodline, SpeciesDefinition } from '@shared/types'
import { BLOODLINES, STAT_NAMES, emptyStats } from '@shared/types'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  animalId: string | null
  defaultProspectId: string | null
  onDone: () => void
}

function blankAnimal(speciesId: string, prospectId: string | null): Animal {
  return {
    id: uuid(),
    speciesId,
    name: '',
    sex: 'Female',
    sireId: null,
    damId: null,
    bloodline: 'Wild',
    phenotype: null,
    stats: emptyStats(),
    status: 'active',
    prospectId
  }
}

export default function AnimalForm({ species, animalId, defaultProspectId, onDone }: Props): JSX.Element {
  const { data, saveAnimal, deleteAnimal } = useAppData()
  const existing = animalId ? data.animals.find((a) => a.id === animalId) ?? null : null
  const [form, setForm] = useState<Animal>(existing ?? blankAnimal(species.id, defaultProspectId))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const candidateParents = data.animals.filter((a) => a.speciesId === species.id && a.id !== form.id)
  const sireCandidates = candidateParents.filter((a) => a.sex === 'Male')
  const damCandidates = candidateParents.filter((a) => a.sex === 'Female')

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await saveAnimal(form)
      onDone()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing) return
    if (!confirm(`Delete ${existing.name}? This cannot be undone.`)) return
    await deleteAnimal(existing.id)
    onDone()
  }

  function updateStat(stat: (typeof STAT_NAMES)[number], value: string): void {
    const num = Math.max(0, Math.min(10, Number(value) || 0))
    setForm((f) => ({ ...f, stats: { ...f.stats, [stat]: num } }))
  }

  return (
    <form className="animal-form" onSubmit={handleSubmit}>
      <h2>{existing ? `Edit ${existing.name}` : `Add ${species.name.replace(/s$/, '')}`}</h2>

      {formError && <p className="error">{formError}</p>}

      <div className="form-grid">
        <label>
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>

        <label>
          Sex
          <select value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value as Animal['sex'] }))}>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
        </label>

        <label>
          Sire
          <select
            value={form.sireId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, sireId: e.target.value || null }))}
          >
            <option value="">Wild Caught</option>
            {sireCandidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Dam
          <select
            value={form.damId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, damId: e.target.value || null }))}
          >
            <option value="">Wild Caught</option>
            {damCandidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label title={BLOODLINE_DESCRIPTIONS[form.bloodline]}>
          Bloodline
          <select
            value={form.bloodline}
            onChange={(e) => setForm((f) => ({ ...f, bloodline: e.target.value as Bloodline }))}
          >
            {BLOODLINES.map((b) => (
              <option key={b} value={b} title={BLOODLINE_DESCRIPTIONS[b]}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label>
          Phenotype
          <input
            placeholder="Base"
            value={form.phenotype ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phenotype: e.target.value || null }))}
          />
        </label>

        <label>
          Status
          <select
            value={form.status ?? 'active'}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AnimalStatus }))}
          >
            <option value="active">Active</option>
            <option value="retired">Retired</option>
            <option value="deceased">Deceased</option>
          </select>
        </label>

        <label>
          Prospect
          <select
            value={form.prospectId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, prospectId: e.target.value || null }))}
          >
            <option value="">Station</option>
            {data.prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3>Stats</h3>
      <div className="stats-grid">
        {STAT_NAMES.map((stat) => (
          <label key={stat} title={STAT_DESCRIPTIONS[stat]}>
            {stat.charAt(0).toUpperCase() + stat.slice(1)}
            <input
              type="number"
              min={0}
              max={10}
              value={form.stats[stat]}
              onChange={(e) => updateStat(stat, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="form-actions">
        <button type="button" onClick={onDone}>
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
  )
}
