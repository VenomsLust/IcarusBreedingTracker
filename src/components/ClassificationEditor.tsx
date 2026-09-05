import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { Bloodline, Classification, ScoreConfig, StatName } from '@shared/types'
import { BLOODLINES, BUILTIN_CLASSIFICATION_NAMES, BUILTIN_CLASSIFICATION_SCORE_CONFIGS, STAT_NAMES, dumpStatScoreConfig } from '@shared/types'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  classificationId: string | null
  onClose: () => void
  onSaved: (classificationId: string) => void
}

interface PhenotypeBonusRow {
  uiId: string
  name: string
  bonus: string
}

// A Dump Stat is required (Icarus mechanics don't allow every stat to max
// out on one animal), so a new Classification starts with one already
// picked rather than an invalid all-equal state.
function blankClassification(): Classification {
  return { id: uuid(), name: '', scoreConfig: dumpStatScoreConfig('instinct') }
}

/**
 * "Simple" mode can only represent a single dump stat (weight -1, everyone
 * else 1). If the weights don't fit that shape (custom per-stat weights),
 * default to Advanced instead of silently misrepresenting them.
 */
function detectDumpStat(statWeights: ScoreConfig['statWeights']): { fitsSimple: boolean; dumpStat: StatName | null } {
  const negatives = STAT_NAMES.filter((s) => statWeights[s] === -1)
  const positives = STAT_NAMES.filter((s) => statWeights[s] === 1)
  if (negatives.length === 0 && positives.length === STAT_NAMES.length) {
    return { fitsSimple: true, dumpStat: null }
  }
  if (negatives.length === 1 && positives.length === STAT_NAMES.length - 1) {
    return { fitsSimple: true, dumpStat: negatives[0] }
  }
  return { fitsSimple: false, dumpStat: null }
}

// Only exact matches on one of the built-in names have a known-good default
// to reset to — a renamed or custom Classification has nothing to fall back
// to, so "Set to Default" stays hidden for those.
function builtinDefaultFor(name: string): ScoreConfig | null {
  const trimmed = name.trim() as (typeof BUILTIN_CLASSIFICATION_NAMES)[number]
  return (BUILTIN_CLASSIFICATION_NAMES as readonly string[]).includes(trimmed)
    ? BUILTIN_CLASSIFICATION_SCORE_CONFIGS[trimmed]
    : null
}

export default function ClassificationEditor({ classificationId, onClose, onSaved }: Props): JSX.Element {
  const { data, saveClassification, deleteClassification } = useAppData()
  const existing = classificationId ? data.classifications.find((c) => c.id === classificationId) ?? null : null
  const [form, setForm] = useState<Classification>(existing ?? blankClassification())
  const [phenotypeRows, setPhenotypeRows] = useState<PhenotypeBonusRow[]>(() =>
    Object.entries((existing ?? form).scoreConfig.phenotypeBonuses).map(([name, bonus]) => ({
      uiId: uuid(),
      name,
      bonus: String(bonus)
    }))
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [view, setView] = useState<'simple' | 'advanced'>(
    () => (detectDumpStat((existing ?? form).scoreConfig.statWeights).fitsSimple ? 'simple' : 'advanced')
  )

  const speciesCount = data.species.filter((s) => s.classificationId === form.id).length

  function buildPhenotypeBonuses(): Record<string, number> {
    const phenotypeBonuses: Record<string, number> = {}
    for (const row of phenotypeRows) {
      const name = row.name.trim()
      if (!name) continue
      const bonus = Number(row.bonus)
      phenotypeBonuses[name] = Number.isNaN(bonus) ? 0 : bonus
    }
    return phenotypeBonuses
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    const finalForm: Classification = {
      ...form,
      scoreConfig: { ...form.scoreConfig, phenotypeBonuses: buildPhenotypeBonuses() }
    }
    try {
      await saveClassification(finalForm)
      onSaved(finalForm.id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing) return
    if (!confirm(`Delete classification "${existing.name}"?`)) return
    try {
      await deleteClassification(existing.id)
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
  }

  function updateWeight(stat: StatName, value: string): void {
    const num = Number(value)
    setForm((f) => ({
      ...f,
      scoreConfig: { ...f.scoreConfig, statWeights: { ...f.scoreConfig.statWeights, [stat]: Number.isNaN(num) ? 0 : num } }
    }))
  }

  function setDumpStat(dumpStat: StatName): void {
    const statWeights = Object.fromEntries(
      STAT_NAMES.map((s) => [s, s === dumpStat ? -1 : 1])
    ) as ScoreConfig['statWeights']
    setForm((f) => ({ ...f, scoreConfig: { ...f.scoreConfig, statWeights } }))
  }

  function updateBonus(bloodline: Bloodline, value: string): void {
    setForm((f) => {
      const bloodlineBonuses = { ...f.scoreConfig.bloodlineBonuses }
      if (value.trim() === '') {
        delete bloodlineBonuses[bloodline]
      } else {
        const num = Number(value)
        if (!Number.isNaN(num)) bloodlineBonuses[bloodline] = num
      }
      return { ...f, scoreConfig: { ...f.scoreConfig, bloodlineBonuses } }
    })
  }

  function addPhenotypeRow(): void {
    setPhenotypeRows((rows) => [...rows, { uiId: uuid(), name: '', bonus: '0' }])
  }

  function updatePhenotypeRow(uiId: string, patch: Partial<Pick<PhenotypeBonusRow, 'name' | 'bonus'>>): void {
    setPhenotypeRows((rows) => rows.map((r) => (r.uiId === uiId ? { ...r, ...patch } : r)))
  }

  function removePhenotypeRow(uiId: string): void {
    setPhenotypeRows((rows) => rows.filter((r) => r.uiId !== uiId))
  }

  function resetToDefault(): void {
    const builtinDefault = builtinDefaultFor(form.name)
    if (!builtinDefault) return
    setForm((f) => ({ ...f, scoreConfig: builtinDefault }))
    setPhenotypeRows([])
    setView(detectDumpStat(builtinDefault.statWeights).fitsSimple ? 'simple' : 'advanced')
  }

  const builtinDefault = builtinDefaultFor(form.name)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal classification-editor" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{existing ? `Edit ${existing.name}` : 'Add Classification'}</h2>
        {formError && <p className="error">{formError}</p>}

        <label>
          Classification name
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>

        {builtinDefault && (
          <button
            type="button"
            onClick={resetToDefault}
            title={`Reset the stat weights and Bloodline bonuses to the recommended default for ${form.name.trim()}`}
          >
            Set to Default
          </button>
        )}

        <h3>Stat weights</h3>
        <p className="hint">
          Positive weight marks a stat you're breeding for; negative marks the Dump Stat you're breeding down.
          Drives Stat Total target highlighting and Mate Recommendations.
        </p>

        <div className="view-toggle">
          <button type="button" className={view === 'simple' ? 'active' : ''} onClick={() => setView('simple')}>
            Simple
          </button>
          <button type="button" className={view === 'advanced' ? 'active' : ''} onClick={() => setView('advanced')}>
            Advanced
          </button>
        </div>

        {view === 'simple' ? (
          <div className="stats-grid">
            <label>
              Dump stat
              <select
                value={detectDumpStat(form.scoreConfig.statWeights).dumpStat ?? STAT_NAMES[0]}
                onChange={(e) => setDumpStat(e.target.value as StatName)}
              >
                {STAT_NAMES.map((stat) => (
                  <option key={stat} value={stat} title={STAT_DESCRIPTIONS[stat]}>
                    {stat.charAt(0).toUpperCase() + stat.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="stats-grid">
            {STAT_NAMES.map((stat) => (
              <label key={stat} title={STAT_DESCRIPTIONS[stat]}>
                {stat.charAt(0).toUpperCase() + stat.slice(1)} weight
                <input
                  type="number"
                  value={form.scoreConfig.statWeights[stat]}
                  onChange={(e) => updateWeight(stat, e.target.value)}
                />
              </label>
            ))}
          </div>
        )}

        <h3>Bloodline bonuses</h3>
        <div className="bloodline-grid">
          {BLOODLINES.map((b) => (
            <label key={b} title={BLOODLINE_DESCRIPTIONS[b]}>
              {b}
              <input
                type="number"
                placeholder="0"
                value={form.scoreConfig.bloodlineBonuses[b] ?? ''}
                onChange={(e) => updateBonus(b, e.target.value)}
              />
            </label>
          ))}
        </div>

        <h3>Phenotype bonuses</h3>
        <p className="hint">
          Optional — give a specific Phenotype a bonus if you're breeding to target it. Must match the
          Phenotype text on the animal exactly (case-sensitive).
        </p>
        <div className="phenotype-bonus-list">
          {phenotypeRows.map((row) => (
            <div key={row.uiId} className="phenotype-bonus-row">
              <input
                placeholder="Phenotype name"
                value={row.name}
                onChange={(e) => updatePhenotypeRow(row.uiId, { name: e.target.value })}
              />
              <input
                type="number"
                placeholder="0"
                value={row.bonus}
                onChange={(e) => updatePhenotypeRow(row.uiId, { bonus: e.target.value })}
              />
              <button type="button" className="icon-button" onClick={() => removePhenotypeRow(row.uiId)} title="Remove">
                🗑
              </button>
            </div>
          ))}
          <button type="button" onClick={addPhenotypeRow}>
            + Add phenotype
          </button>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {existing && (
            <button
              type="button"
              className="danger"
              onClick={handleDelete}
              disabled={speciesCount > 0}
              title={speciesCount > 0 ? `Cannot delete: ${speciesCount} species use this classification` : undefined}
            >
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
