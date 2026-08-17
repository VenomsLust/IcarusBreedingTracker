import { useMemo, useState } from 'react'
import type { SpeciesDefinition } from '@shared/types'
import { STAT_NAMES, defaultScoreConfig } from '@shared/types'
import { rankMatePairs } from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  prospectId: string | null
}

const TOP_N = 10

export default function MateRecommendations({ species, prospectId }: Props): JSX.Element {
  const { data } = useAppData()
  const [focusAnimalId, setFocusAnimalId] = useState<string>('')

  // Retired/deceased animals aren't breeding candidates, so they're excluded
  // here too — otherwise picking one in the "Best mates for" dropdown would
  // always yield an empty result.
  const animals = data.animals.filter(
    (a) => a.speciesId === species.id && a.prospectId === prospectId && (a.status ?? 'active') === 'active'
  )
  const scoreConfig =
    data.classifications.find((c) => c.id === species.classificationId)?.scoreConfig ?? defaultScoreConfig()

  const pairs = useMemo(
    () => rankMatePairs(animals, species.id, scoreConfig, { forAnimalId: focusAnimalId || undefined }),
    [animals, species.id, scoreConfig, focusAnimalId]
  )

  if (!prospectId) {
    return (
      <p className="empty-state">
        Select a specific Prospect in the sidebar to see mate recommendations — animals on different
        Prospects can't be bred together.
      </p>
    )
  }

  const top = pairs.slice(0, TOP_N)

  return (
    <div className="mate-recommendations">
      <div className="filters">
        <select value={focusAnimalId} onChange={(e) => setFocusAnimalId(e.target.value)}>
          <option value="">Best pairs overall</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              Best mates for {a.name}
            </option>
          ))}
        </select>
      </div>

      <p className="hint">Ranked by total predicted Score (stats + Bloodline bonus + Phenotype bonus).</p>

      {top.length === 0 ? (
        <p className="empty-state">Not enough animals (need at least one Male and one Female) to suggest pairs.</p>
      ) : (
        <table className="animal-table">
          <thead>
            <tr>
              <th>Male</th>
              <th>Female</th>
              {STAT_NAMES.map((stat) => (
                <th key={stat} title={STAT_DESCRIPTIONS[stat]}>
                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                </th>
              ))}
              <th title="Inherited trait affecting growth and behavior — hover a value for details">Bloodline</th>
              <th>Phenotype</th>
              <th>Predicted Score</th>
            </tr>
          </thead>
          <tbody>
            {top.map(({ male, female, estimate }) => (
              <tr key={`${male.id}-${female.id}`}>
                <td>{male.name}</td>
                <td>{female.name}</td>
                {STAT_NAMES.map((stat) => (
                  <td key={stat}>{estimate.stats[stat]}</td>
                ))}
                <td title={BLOODLINE_DESCRIPTIONS[estimate.bloodline]}>{estimate.bloodline}</td>
                <td>{estimate.phenotype ?? 'Base'}</td>
                <td className="score-cell">{estimate.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
