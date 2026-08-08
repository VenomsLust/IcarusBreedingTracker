import type { Animal, Prospect, SpeciesDefinition } from '@shared/types'

interface Props {
  species: SpeciesDefinition[]
  selectedSpeciesId: string | null
  onSelectSpecies: (id: string) => void
  onAddSpecies: () => void
  onEditSpecies: (id: string) => void
  prospects: Prospect[]
  selectedProspectId: string | null
  onSelectProspect: (id: string | null) => void
  onAddProspect: () => void
  onEditProspect: (id: string) => void
  animals: Animal[]
}

function isActive(animal: Animal): boolean {
  return (animal.status ?? 'active') === 'active'
}

export default function Sidebar({
  species,
  selectedSpeciesId,
  onSelectSpecies,
  onAddSpecies,
  onEditSpecies,
  prospects,
  selectedProspectId,
  onSelectProspect,
  onAddProspect,
  onEditProspect,
  animals
}: Props): JSX.Element {
  return (
    <aside className="sidebar">
      <h2>Prospect</h2>
      <ul className="species-list">
        <li className={selectedProspectId === null ? 'active' : ''}>
          <button className="species-name" onClick={() => onSelectProspect(null)}>
            All Prospects
          </button>
          <span className="count-badge">{animals.length}</span>
        </li>
        {prospects.map((p) => (
          <li key={p.id} className={p.id === selectedProspectId ? 'active' : ''}>
            <button className="species-name" onClick={() => onSelectProspect(p.id)}>
              {p.name}
            </button>
            <span className="count-badge">{animals.filter((a) => a.prospectId === p.id).length}</span>
            <button className="icon-button" title={`Edit ${p.name}`} onClick={() => onEditProspect(p.id)}>
              ✎
            </button>
          </li>
        ))}
      </ul>
      <button className="add-species" onClick={onAddProspect}>
        + Add Prospect
      </button>

      <h2 className="section-spacer">Species</h2>
      <ul className="species-list">
        {species.map((s) => (
          <li key={s.id} className={s.id === selectedSpeciesId ? 'active' : ''}>
            <button className="species-name" onClick={() => onSelectSpecies(s.id)}>
              {s.name}
            </button>
            <span className="count-badge" title="Active animals of this species">
              {animals.filter((a) => a.speciesId === s.id && isActive(a)).length}
            </span>
            <button
              className="icon-button"
              title={`Edit ${s.name} scoring`}
              onClick={() => onEditSpecies(s.id)}
            >
              ✎
            </button>
          </li>
        ))}
      </ul>
      <button className="add-species" onClick={onAddSpecies}>
        + Add Species
      </button>
    </aside>
  )
}
