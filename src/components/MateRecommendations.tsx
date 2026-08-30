import { useEffect, useMemo, useState } from 'react'
import type { Bloodline, SpeciesDefinition } from '@shared/types'
import { BLOODLINES, STAT_NAMES, defaultScoreConfig } from '@shared/types'
import type { MatePair, TargetProfile } from '@shared/scoring'
import {
  RECOMMENDATION_CAP,
  computeBreedDownPairs,
  computeTargetProfile,
  favoredBloodline,
  filterMatePairsByBloodline,
  rankMatePairs
} from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  prospectId: string | null
}

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
  const [selectedBloodline, setSelectedBloodline] = useState<Bloodline | ''>('')

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
  const breedDownPairs = useMemo(
    () => computeBreedDownPairs(animals, species.id, scoreConfig, { forAnimalId: focusAnimalId || undefined }),
    [animals, species.id, scoreConfig, focusAnimalId]
  )

  // Re-defaults to this Classification's favored Bloodline whenever the
  // selected species changes, but otherwise leaves the user's choice alone.
  useEffect(() => {
    setSelectedBloodline(favoredBloodline(target) ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species.id])

  const bloodlineFiltered = useMemo(
    () => (selectedBloodline ? filterMatePairsByBloodline(pairs, selectedBloodline) : null),
    [pairs, selectedBloodline]
  )
  const outcrossPairs = useMemo(() => pairs.slice(0, RECOMMENDATION_CAP), [pairs])
  const selectedBloodlineTarget: TargetProfile = useMemo(
    () => ({ statTargets: target.statTargets, bloodlineTargets: selectedBloodline ? new Set([selectedBloodline]) : null }),
    [target, selectedBloodline]
  )
  const noBloodlineTarget: TargetProfile = useMemo(
    () => ({ statTargets: target.statTargets, bloodlineTargets: null }),
    [target]
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
        <select value={selectedBloodline} onChange={(e) => setSelectedBloodline(e.target.value as Bloodline | '')}>
          <option value="">No Bloodline filter</option>
          {BLOODLINES.map((b) => (
            <option key={b} value={b} title={BLOODLINE_DESCRIPTIONS[b]}>
              Favor {b}
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
        {selectedBloodline ? (
          <>
            Purebred and Crossbred are filtered on {selectedBloodline} — both parents carry it, or just one —
            up to 5 pairs each. Outcross ignores Bloodline entirely and ranks every pair on stats alone.{' '}
          </>
        ) : (
          <>Pick a Bloodline above to see Purebred/Crossbred pairs. Outcross always ranks every pair on stats alone.{' '}</>
        )}
        Within a group, ranked by Expected Hits — Icarus rolls each stat 40% Sire / 40% Dam / 20%
        random-or-mutation, so each stat target (10, or 0 for the Dump Stat) counts for up to 0.8 toward the
        total depending on how many parents already carry it. Chance of All Targets is the odds this pair hits
        every stat target at once. Both treat the unpredictable 20% roll as a 0% chance of landing on the
        target, so they're a floor, not the true odds. Ceiling Targets and predicted Score only break ties.
      </p>

      {pairs.length === 0 ? (
        <p className="empty-state">Not enough animals (need at least one Male and one Female) to suggest pairs.</p>
      ) : (
        <>
          {bloodlineFiltered && (
            <>
              <div className="mate-tier">
                <h3 title={`Both parents already carry ${selectedBloodline}.`}>Purebred</h3>
                {bloodlineFiltered.purebred.length === 0 ? (
                  <p className="empty-state">No Purebred pairs yet.</p>
                ) : (
                  <MatePairTable pairs={bloodlineFiltered.purebred} target={selectedBloodlineTarget} />
                )}
              </div>
              <div className="mate-tier">
                <h3 title={`One parent already carries ${selectedBloodline}.`}>Crossbred</h3>
                {bloodlineFiltered.crossbred.length === 0 ? (
                  <p className="empty-state">No Crossbred pairs yet.</p>
                ) : (
                  <MatePairTable pairs={bloodlineFiltered.crossbred} target={selectedBloodlineTarget} />
                )}
              </div>
            </>
          )}
          <div className="mate-tier">
            <h3 title="Ignores Bloodline entirely — ranked purely on stats.">Outcross</h3>
            <MatePairTable pairs={outcrossPairs} target={noBloodlineTarget} />
          </div>
        </>
      )}
    </div>
  )
}
