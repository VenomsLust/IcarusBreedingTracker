import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useAppData } from '../context/AppDataContext'
import type { ParsedSaveFile } from '@shared/gameImport/parseSaveFile'
import { applyRows, buildRows, resolveSpecies, unresolvedClassNames, type RowDecision } from '@shared/gameImport/diff'

interface Props {
  parsed: ParsedSaveFile
  onClose: () => void
}

interface RowState {
  include: boolean
  conflictResolution?: 'replace' | 'append'
}

function fieldValueLabel(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return Object.entries(value as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(', ')
  return String(value)
}

export default function ImportDialog({ parsed, onClose }: Props): JSX.Element {
  const { data, saveSpecies, saveProspect, importAnimals } = useAppData()
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missingClassNames = useMemo(
    () => unresolvedClassNames(parsed.creatures, data.species),
    [parsed.creatures, data.species]
  )
  const rows = useMemo(() => buildRows(parsed.creatures, data), [parsed.creatures, data])

  const existingProspect = parsed.prospectGameId
    ? data.prospects.find((p) => p.name === parsed.prospectGameId) ?? null
    : null

  function rowState(i: number, action: (typeof rows)[number]['action']): RowState {
    return rowStates[i] ?? { include: action === 'add' || action === 'update' }
  }

  function setRowState(i: number, patch: Partial<RowState>): void {
    setRowStates((prev) => ({ ...prev, [i]: { ...rowState(i, rows[i].action), ...patch } }))
  }

  async function mapClassName(className: string, speciesId: string): Promise<void> {
    const species = data.species.find((s) => s.id === speciesId)
    if (!species) return
    await saveSpecies({ ...species, gameClassNames: [...(species.gameClassNames ?? []), className] })
  }

  async function handleImport(): Promise<void> {
    setImporting(true)
    setError(null)
    try {
      let targetProspectId: string | null = null
      if (parsed.prospectGameId) {
        if (existingProspect) {
          targetProspectId = existingProspect.id
        } else {
          const created = { id: uuid(), name: parsed.prospectGameId }
          await saveProspect(created)
          targetProspectId = created.id
        }
      }

      const decisions: RowDecision[] = rows.map((row, i) => {
        const state = rowState(i, row.action)
        return { row, include: state.include, conflictResolution: state.conflictResolution }
      })
      const animals = applyRows(data, decisions, uuid, targetProspectId)
      await importAnimals(animals)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const counts = { add: 0, update: 0, conflict: 0, unchanged: 0 }
  for (const row of rows) counts[row.action]++
  const selectedCount = rows.filter((row, i) => rowState(i, row.action).include).length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal import-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Import from Save File</h2>
        <p className="hint">
          Found {parsed.creatures.length} creature{parsed.creatures.length === 1 ? '' : 's'}
          {parsed.prospectGameId ? ` deployed in "${parsed.prospectGameId}"` : ' at the Station'}.{' '}
          {counts.add} new, {counts.update} to update, {counts.conflict} conflict
          {counts.conflict === 1 ? '' : 's'}, {counts.unchanged} unchanged.
        </p>

        {error && <p className="error">{error}</p>}

        {missingClassNames.length > 0 && (
          <>
            <h3>Map unrecognized creature types</h3>
            <p className="hint">Pick which Species each of these belongs to - remembered for future imports.</p>
            <div className="import-mapping-list">
              {missingClassNames.map((className) => (
                <label key={className}>
                  {className}
                  <select defaultValue="" onChange={(e) => e.target.value && mapClassName(className, e.target.value)}>
                    <option value="" disabled>
                      Select a Species…
                    </option>
                    {data.species.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="import-row-header">
          <h3>Review</h3>
          <label className="checkbox-label">
            <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />
            Show unchanged
          </label>
        </div>

        <table className="animal-table import-diff-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Species</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.action === 'unchanged' && !showUnchanged) return null
              const species = row.speciesId ? data.species.find((s) => s.id === row.speciesId) : null
              const state = rowState(i, row.action)
              return (
                <tr key={i} className={row.action === 'conflict' ? 'source-random' : ''}>
                  <td>
                    {row.action !== 'unchanged' && row.speciesId && (
                      <input
                        type="checkbox"
                        checked={state.include}
                        disabled={row.action === 'conflict' && !state.conflictResolution}
                        onChange={(e) => setRowState(i, { include: e.target.checked })}
                      />
                    )}
                  </td>
                  <td>{row.detected.name}</td>
                  <td>{species?.name ?? <em>unmapped</em>}</td>
                  <td className={`status-cell status-${row.action === 'conflict' ? 'deceased' : row.action === 'add' ? 'active' : 'retired'}`}>
                    {row.action}
                  </td>
                  <td>
                    {row.action === 'add' && 'New animal'}
                    {row.action === 'update' &&
                      row.changes.map((c) => (
                        <div key={c.field}>
                          {c.field}: {fieldValueLabel(c.from)} → {fieldValueLabel(c.to)}
                        </div>
                      ))}
                    {row.action === 'conflict' && (
                      <>
                        {row.conflicts.map((c) => (
                          <div key={c.field}>
                            {c.field}: {fieldValueLabel(c.from)} → {fieldValueLabel(c.to)}
                          </div>
                        ))}
                        <div className="form-actions">
                          <button
                            type="button"
                            className={state.conflictResolution === 'replace' ? 'primary' : ''}
                            onClick={() => setRowState(i, { include: true, conflictResolution: 'replace' })}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className={state.conflictResolution === 'append' ? 'primary' : ''}
                            onClick={() => setRowState(i, { include: true, conflictResolution: 'append' })}
                          >
                            Append
                          </button>
                        </div>
                      </>
                    )}
                    {row.action === 'unchanged' && 'No changes'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={importing || selectedCount === 0} onClick={handleImport}>
            {importing ? 'Importing…' : `Import Selected (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}
