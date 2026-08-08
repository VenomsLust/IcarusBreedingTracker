import { useMemo, useState } from 'react'
import type { SpeciesDefinition } from '@shared/types'
import { STAT_NAMES } from '@shared/types'
import { rankMatePairs, sortMatePairsByCategory, type MateCategory, type MatePair } from '@shared/scoring'
import { BLOODLINE_DESCRIPTIONS, STAT_DESCRIPTIONS } from '@shared/descriptions'
import { useAppData } from '../context/AppDataContext'

interface Props {
  species: SpeciesDefinition
  prospectId: string | null
}

const TOP_N = 5

const CATEGORY_INFO: Record<MateCategory, { label: string; description: string }> = {
  genotype: {
    label: 'Genotype',
    description: 'Best raw stat performance (Vigor, Fitness, Physique, Reflex, Toughness, Adaptation, Instinct).'
  },
  bloodline: {
    label: 'Bloodline',
    description: 'Best predicted Bloodline bonus for the offspring.'
  },
  phenotype: {
    label: 'Phenotype',
    description: 'Best predicted Phenotype bonus for the offspring.'
  }
}

function CategoryTable({
  category,
  pairs,
  hasBonusesConfigured
}: {
  category: MateCategory
  pairs: MatePair[]
  hasBonusesConfigured: boolean
}): JSX.Element {
  const info = CATEGORY_INFO[category]
  const top = sortMatePairsByCategory(pairs, category).slice(0, TOP_N)

  return (
    <section className="mate-category">
      <h3>{info.label}</h3>
      <p className="hint">{info.description}</p>
      {category !== 'genotype' && !hasBonusesConfigured && (
        <p className="hint">No {info.label} bonuses configured for this species — ranked by overall Score instead.</p>
      )}

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
    </section>
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

  const pairs = useMemo(
    () => rankMatePairs(animals, species, { forAnimalId: focusAnimalId || undefined }),
    [animals, species, focusAnimalId]
  )

  if (!prospectId) {
    return (
      <p className="empty-state">
        Select a specific Prospect in the sidebar to see mate recommendations — animals on different
        Prospects can't be bred together.
      </p>
    )
  }

  const hasBloodlineBonuses = Object.keys(species.scoreConfig.bloodlineBonuses).length > 0
  const hasPhenotypeBonuses = Object.keys(species.scoreConfig.phenotypeBonuses).length > 0

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

      <CategoryTable category="genotype" pairs={pairs} hasBonusesConfigured={true} />
      <CategoryTable category="bloodline" pairs={pairs} hasBonusesConfigured={hasBloodlineBonuses} />
      <CategoryTable category="phenotype" pairs={pairs} hasBonusesConfigured={hasPhenotypeBonuses} />
    </div>
  )
}
