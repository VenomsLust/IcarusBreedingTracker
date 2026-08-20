import { useMemo, useState } from 'react'
import type { SpeciesDefinition } from '@shared/types'
import { STAT_NAMES, defaultScoreConfig } from '@shared/types'
import { computeTargetProfile, rankMatePairs } from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  prospectId: string | null
}

const TOP_N = 10

function formatChance(p: number): string {
  if (p <= 0) return '0%'
  if (p < 0.001) return '<0.1%'
  return `${(p * 100).toFixed(1)}%`
}

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
  const target = useMemo(() => computeTargetProfile(scoreConfig), [scoreConfig])

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

      <p className="hint">
        Ranked by Expected Hits — Icarus rolls each stat/Bloodline 40% Sire / 40% Dam / 20% random-or-mutation,
        so each target (10 in a stat, 0 in the Dump Stat, or the top Bloodline) counts for up to 0.8 toward
        the total depending on how many parents already carry it. Chance of All Targets is the odds this
        pair hits every target at once. Both treat the unpredictable 20% roll as a 0% chance of landing on
        the target, so they're a floor, not the true odds. Ceiling Targets and predicted Score only break
        ties.
      </p>

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
              <th title="How many of the 7 stats (10, or 0 for the Dump Stat) plus top Bloodline this pairing can reach at best">
                Ceiling Targets
              </th>
              <th title="Sum of each target's actual hit odds (40% Sire + 40% Dam per target already carried by a parent) — floor odds, excludes the 20% random/mutation roll">
                Expected Hits
              </th>
              <th title="Floor odds this pair hits every target at once, assuming independence — excludes the 20% random/mutation roll">
                Chance of All Targets
              </th>
              <th>Predicted Score</th>
            </tr>
          </thead>
          <tbody>
            {top.map(({ male, female, estimate }) => (
              <tr key={`${male.id}-${female.id}`}>
                <td>{male.name}</td>
                <td>{female.name}</td>
                {STAT_NAMES.map((stat) => {
                  const statTarget = target.statTargets[stat]
                  const hit = statTarget !== undefined && estimate.stats[stat] === statTarget
                  return (
                    <td key={stat} className={hit ? 'target-hit' : ''}>
                      {estimate.stats[stat]}
                    </td>
                  )
                })}
                <td
                  title={BLOODLINE_DESCRIPTIONS[estimate.bloodline]}
                  className={target.bloodlineTargets?.has(estimate.bloodline) ? 'target-hit' : ''}
                >
                  {estimate.bloodline}
                </td>
                <td>{estimate.phenotype ?? 'Base'}</td>
                <td>
                  {estimate.targets.hit}/{estimate.targets.possible}
                </td>
                <td>
                  {estimate.odds.expectedHits.toFixed(1)}/{estimate.targets.possible}
                </td>
                <td>{formatChance(estimate.odds.probabilityAllHit)}</td>
                <td className="score-cell">{estimate.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
