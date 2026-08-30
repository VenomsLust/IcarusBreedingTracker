import { useMemo, useState } from 'react'
import type { SpeciesDefinition } from '@shared/types'
import { STAT_NAMES, defaultScoreConfig } from '@shared/types'
import type { MatePair, TargetProfile } from '@shared/scoring'
import { computeBreedDownPairs, computeTargetProfile, groupMatePairsByBloodlineTier, rankMatePairs } from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  prospectId: string | null
}

const TOP_N = 10

const BLOODLINE_TIERS = [
  { key: 'purebred', label: 'Purebred', hint: 'Both parents already carry a top Bloodline.' },
  { key: 'crossbred', label: 'Crossbred', hint: 'One parent already carries a top Bloodline.' },
  { key: 'outcross', label: 'Outcross', hint: 'Neither parent carries a top Bloodline — ranked on stats alone.' }
] as const

function formatChance(p: number): string {
  if (p <= 0) return '0%'
  if (p < 0.001) return '<0.1%'
  return `${(p * 100).toFixed(1)}%`
}

function MatePairTable({ pairs, target }: { pairs: MatePair[]; target: TargetProfile }): JSX.Element {
  return (
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
          <th title="How many of the 7 stats (10, or 0 for the Dump Stat) this pairing can reach at best">
            Ceiling Targets
          </th>
          <th title="Sum of each stat target's actual hit odds (40% Sire + 40% Dam per target already carried by a parent) — floor odds, excludes the 20% random/mutation roll">
            Expected Hits
          </th>
          <th title="Floor odds this pair hits every stat target at once, assuming independence — excludes the 20% random/mutation roll">
            Chance of All Targets
          </th>
          <th>Predicted Score</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map(({ male, female, estimate }) => (
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
  )
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
  const tiers = useMemo(() => groupMatePairsByBloodlineTier(pairs, target), [pairs, target])
  const breedDownPairs = useMemo(
    () => computeBreedDownPairs(animals, species.id, scoreConfig, { forAnimalId: focusAnimalId || undefined }),
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

      {breedDownPairs && breedDownPairs.length > 0 && (
        <div className="mate-tier">
          <h3 title="A breeder's first step — Icarus never averages stats, so a 10 everywhere else is worthless on an animal that still passes on a nonzero Dump Stat.">
            Breed Down
          </h3>
          <p className="hint">
            Ranked by each parent's own current Dump Stat (lower is better, summed across the pair), then by
            their combined Total excluding the Dump Stat as a tie-breaker. This section drops once a Male and a
            Female each already carry 0 in the Dump Stat — that's a usable base breeding pair.
          </p>
          <MatePairTable pairs={breedDownPairs} target={target} />
        </div>
      )}

      <p className="hint">
        {tiers && (
          <>
            Pairs are grouped by Bloodline tier — Purebred (both parents carry a top Bloodline), Crossbred (one
            does), Outcross (neither, ranked on stats alone) — up to 5 pairs each.{' '}
          </>
        )}
        Within a group, ranked by Expected Hits — Icarus rolls each stat 40% Sire / 40% Dam / 20%
        random-or-mutation, so each stat target (10, or 0 for the Dump Stat) counts for up to 0.8 toward the
        total depending on how many parents already carry it. Chance of All Targets is the odds this pair hits
        every stat target at once. Both treat the unpredictable 20% roll as a 0% chance of landing on the
        target, so they're a floor, not the true odds. Ceiling Targets and predicted Score only break ties.
      </p>

      {pairs.length === 0 ? (
        <p className="empty-state">Not enough animals (need at least one Male and one Female) to suggest pairs.</p>
      ) : tiers ? (
        BLOODLINE_TIERS.map(({ key, label, hint }) => (
          <div key={key} className="mate-tier">
            <h3 title={hint}>{label}</h3>
            {tiers[key].length === 0 ? (
              <p className="empty-state">No {label} pairs yet.</p>
            ) : (
              <MatePairTable pairs={tiers[key]} target={target} />
            )}
          </div>
        ))
      ) : (
        <MatePairTable pairs={pairs.slice(0, TOP_N)} target={target} />
      )}
    </div>
  )
}
