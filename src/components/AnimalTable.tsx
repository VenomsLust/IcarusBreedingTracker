import { useMemo, useState } from 'react'
import type { Animal, ProspectFilter, SpeciesDefinition } from '@shared/types'
import { STATION_FILTER, STAT_NAMES, defaultScoreConfig, matchesProspectFilter } from '@shared/types'
import { compareAnimalRank, computeTargetProfile, computeTotal } from '@shared/scoring'
import { buildExportRows, toExportJson, toExportXml } from '@shared/exportData'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'
import { downloadText } from '../lib/fileIO'
import SexSymbol from './SexSymbol'

interface Props {
  species: SpeciesDefinition
  prospectId: ProspectFilter
  onSelectAnimal: (animalId: string) => void
}

type SortKey = 'rank' | 'name' | 'sex' | 'bloodline' | 'prospect' | 'status' | 'total' | (typeof STAT_NAMES)[number]

export default function AnimalTable({ species, prospectId, onSelectAnimal }: Props): JSX.Element {
  const { data, deleteAnimal } = useAppData()
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [nameFilter, setNameFilter] = useState('')
  const [sexFilter, setSexFilter] = useState<'' | 'Male' | 'Female'>('')
  const [showInactive, setShowInactive] = useState(false)

  const animalsBySpecies = data.animals.filter(
    (a) => a.speciesId === species.id && matchesProspectFilter(a, prospectId)
  )
  const animalNameById = new Map(data.animals.map((a) => [a.id, a.name]))
  const prospectNameById = new Map(data.prospects.map((p) => [p.id, p.name]))
  const scoreConfig =
    data.classifications.find((c) => c.id === species.classificationId)?.scoreConfig ?? defaultScoreConfig()
  const target = computeTargetProfile(scoreConfig)

  const rows = useMemo(() => {
    const visible = animalsBySpecies
      .filter((a) => showInactive || (a.status ?? 'active') === 'active')
      .filter((a) => a.name.toLowerCase().includes(nameFilter.toLowerCase()))
      .filter((a) => !sexFilter || a.sex === sexFilter)
    const rankById = new Map(
      [...visible].sort((x, y) => compareAnimalRank(x, y, target)).map((a, i) => [a.id, i + 1])
    )
    return visible
      .map((a) => ({
        animal: a,
        rank: rankById.get(a.id)!,
        status: a.status ?? 'active',
        total: computeTotal(a.stats),
        prospectName: a.prospectId ? prospectNameById.get(a.prospectId) ?? '—' : 'Station'
      }))
      .sort((x, y) => {
        let cmp = 0
        if (sortKey === 'rank') cmp = y.rank - x.rank
        else if (sortKey === 'name') cmp = x.animal.name.localeCompare(y.animal.name)
        else if (sortKey === 'sex') cmp = x.animal.sex.localeCompare(y.animal.sex)
        else if (sortKey === 'bloodline') cmp = x.animal.bloodline.localeCompare(y.animal.bloodline)
        else if (sortKey === 'prospect') cmp = x.prospectName.localeCompare(y.prospectName)
        else if (sortKey === 'status') cmp = x.status.localeCompare(y.status)
        else if (sortKey === 'total') cmp = x.total - y.total
        else cmp = x.animal.stats[sortKey] - y.animal.stats[sortKey]
        return cmp * sortDir
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalsBySpecies, nameFilter, sexFilter, showInactive, sortKey, sortDir, scoreConfig])

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1)
    } else {
      setSortKey(key)
      setSortDir(-1)
    }
  }

  async function handleDelete(animal: Animal, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    if (!confirm(`Delete ${animal.name}? This cannot be undone.`)) return
    await deleteAnimal(animal.id)
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return ''
    return sortDir === 1 ? ' ▲' : ' ▼'
  }

  function handleExport(format: 'json' | 'xml'): void {
    const prospectLabel =
      prospectId === null
        ? 'All Prospects'
        : prospectId === STATION_FILTER
          ? 'Station'
          : data.prospects.find((p) => p.id === prospectId)?.name ?? 'Unknown Prospect'
    const exportRows = buildExportRows(rows.map((r) => r.animal), animalNameById, prospectNameById)
    const content =
      format === 'json'
        ? toExportJson(species.name, prospectLabel, exportRows)
        : toExportXml(species.name, prospectLabel, exportRows)
    const prospectSuffix =
      prospectLabel === 'All Prospects' ? '' : `-${prospectLabel.replace(/[^a-z0-9]+/gi, '_')}`
    const fileName = `${species.name}${prospectSuffix}-export.${format}`
    downloadText(fileName, content, format === 'json' ? 'application/json' : 'application/xml')
  }

  return (
    <div className="animal-table-wrap">
      <div className="filters">
        <input
          placeholder="Filter by name…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <select value={sexFilter} onChange={(e) => setSexFilter(e.target.value as '' | 'Male' | 'Female')}>
          <option value="">All sexes</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <label className="checkbox-label">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Include inactive
        </label>
        <span className="filters-spacer" />
        <button
          type="button"
          onClick={() => handleExport('json')}
          disabled={rows.length === 0}
          title="Export the animals currently shown below as JSON"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => handleExport('xml')}
          disabled={rows.length === 0}
          title="Export the animals currently shown below as XML"
        >
          Export XML
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">No animals match. Add one to get started.</p>
      ) : (
        <table className="animal-table">
          <thead>
            <tr>
              <th
                onClick={() => toggleSort('rank')}
                title="Favored Bloodline first, then lowest Dump Stat, then highest Total, then Name"
              >
                #{sortIndicator('rank')}
              </th>
              <th onClick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
              <th onClick={() => toggleSort('sex')}>Sex{sortIndicator('sex')}</th>
              <th>Sire</th>
              <th>Dam</th>
              <th onClick={() => toggleSort('bloodline')} title="Inherited trait affecting growth and behavior — hover a value for details">
                Bloodline{sortIndicator('bloodline')}
              </th>
              <th>Phenotype</th>
              {prospectId === null && (
                <th onClick={() => toggleSort('prospect')}>Prospect{sortIndicator('prospect')}</th>
              )}
              <th onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
              {STAT_NAMES.map((stat) => (
                <th
                  key={stat}
                  onClick={() => toggleSort(stat)}
                  title={STAT_DESCRIPTIONS[stat]}
                  className={target.statTargets[stat] === 0 ? 'dump-stat-header' : ''}
                >
                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                  {sortIndicator(stat)}
                </th>
              ))}
              <th onClick={() => toggleSort('total')}>Total{sortIndicator('total')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ animal, rank, status, total, prospectName }) => (
              <tr
                key={animal.id}
                className={status !== 'active' ? 'inactive-row' : ''}
                onClick={() => onSelectAnimal(animal.id)}
              >
                <td>{rank}</td>
                <td>{animal.name}</td>
                <td>
                  <SexSymbol sex={animal.sex} />
                </td>
                <td>{animal.sireId ? animalNameById.get(animal.sireId) ?? '—' : (animal.sireName ?? 'Wild Caught')}</td>
                <td>{animal.damId ? animalNameById.get(animal.damId) ?? '—' : (animal.damName ?? 'Wild Caught')}</td>
                <td
                  title={BLOODLINE_DESCRIPTIONS[animal.bloodline]}
                  className={target.bloodlineTargets?.has(animal.bloodline) ? 'target-hit' : ''}
                >
                  {animal.bloodline}
                </td>
                <td>{animal.phenotype ?? 'Base'}</td>
                {prospectId === null && <td>{prospectName}</td>}
                <td className={`status-cell status-${status}`}>{status}</td>
                {STAT_NAMES.map((stat) => {
                  const statTarget = target.statTargets[stat]
                  const hit = statTarget !== undefined && animal.stats[stat] === statTarget
                  return (
                    <td key={stat} className={hit ? 'target-hit' : ''}>
                      {animal.stats[stat]}
                    </td>
                  )
                })}
                <td className="total-cell">{total}</td>
                <td>
                  <button className="icon-button" onClick={(e) => handleDelete(animal, e)} title={`Delete ${animal.name}`}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
