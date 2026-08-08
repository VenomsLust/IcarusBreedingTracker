import { useEffect, useState } from 'react'
import { useAppData } from './context/AppDataContext'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import AnimalTable from './components/AnimalTable'
import AnimalForm from './components/AnimalForm'
import SpeciesEditor from './components/SpeciesEditor'
import ProspectEditor from './components/ProspectEditor'
import MateRecommendations from './components/MateRecommendations'

type Tab = 'animals' | 'recommendations'
type AnimalFormState = { mode: 'add' } | { mode: 'edit'; animalId: string } | null
type SpeciesEditorState = { mode: 'add' } | { mode: 'edit'; speciesId: string } | null
type ProspectEditorState = { mode: 'add' } | { mode: 'edit'; prospectId: string } | null

export default function App(): JSX.Element {
  const { data } = useAppData()
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null)
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('animals')
  const [animalForm, setAnimalForm] = useState<AnimalFormState>(null)
  const [speciesEditor, setSpeciesEditor] = useState<SpeciesEditorState>(null)
  const [prospectEditor, setProspectEditor] = useState<ProspectEditorState>(null)

  useEffect(() => {
    if (selectedSpeciesId && data.species.some((s) => s.id === selectedSpeciesId)) return
    setSelectedSpeciesId(data.species[0]?.id ?? null)
  }, [data, selectedSpeciesId])

  useEffect(() => {
    if (selectedProspectId && !data.prospects.some((p) => p.id === selectedProspectId)) {
      setSelectedProspectId(null)
    }
  }, [data, selectedProspectId])

  const selectedSpecies = data.species.find((s) => s.id === selectedSpeciesId) ?? null

  function selectSpecies(id: string): void {
    setSelectedSpeciesId(id)
    setTab('animals')
    setAnimalForm(null)
  }

  return (
    <div className="app-root">
      <Toolbar />
      <div className="app-shell">
        <Sidebar
          species={data.species}
          selectedSpeciesId={selectedSpeciesId}
          onSelectSpecies={selectSpecies}
          onAddSpecies={() => setSpeciesEditor({ mode: 'add' })}
          onEditSpecies={(id) => setSpeciesEditor({ mode: 'edit', speciesId: id })}
          prospects={data.prospects}
          selectedProspectId={selectedProspectId}
          onSelectProspect={setSelectedProspectId}
          onAddProspect={() => setProspectEditor({ mode: 'add' })}
          onEditProspect={(id) => setProspectEditor({ mode: 'edit', prospectId: id })}
          animals={data.animals}
        />

        <main className="main-content">
          {!selectedSpecies ? (
            <div className="centered">
              <p>No species yet. Add one to get started, or Load a previously saved file above.</p>
              <button onClick={() => setSpeciesEditor({ mode: 'add' })}>Add species</button>
            </div>
          ) : (
            <>
              <header className="content-header">
                <h1>{selectedSpecies.name}</h1>
                <nav className="tabs">
                  <button className={tab === 'animals' ? 'active' : ''} onClick={() => setTab('animals')}>
                    Animals
                  </button>
                  <button
                    className={tab === 'recommendations' ? 'active' : ''}
                    onClick={() => setTab('recommendations')}
                  >
                    Mate Recommendations
                  </button>
                </nav>
                {tab === 'animals' && !animalForm && (
                  <button className="primary" onClick={() => setAnimalForm({ mode: 'add' })}>
                    + Add Animal
                  </button>
                )}
              </header>

              {animalForm ? (
                <AnimalForm
                  species={selectedSpecies}
                  animalId={animalForm.mode === 'edit' ? animalForm.animalId : null}
                  defaultProspectId={selectedProspectId}
                  onDone={() => setAnimalForm(null)}
                />
              ) : tab === 'animals' ? (
                <AnimalTable
                  species={selectedSpecies}
                  prospectId={selectedProspectId}
                  onEditAnimal={(id) => setAnimalForm({ mode: 'edit', animalId: id })}
                />
              ) : (
                <MateRecommendations species={selectedSpecies} prospectId={selectedProspectId} />
              )}
            </>
          )}
        </main>
      </div>

      {speciesEditor && (
        <SpeciesEditor
          speciesId={speciesEditor.mode === 'edit' ? speciesEditor.speciesId : null}
          onClose={() => setSpeciesEditor(null)}
          onSaved={(id) => {
            setSpeciesEditor(null)
            selectSpecies(id)
          }}
        />
      )}

      {prospectEditor && (
        <ProspectEditor
          prospectId={prospectEditor.mode === 'edit' ? prospectEditor.prospectId : null}
          onClose={() => setProspectEditor(null)}
          onSaved={(id) => {
            setProspectEditor(null)
            setSelectedProspectId(id)
          }}
        />
      )}
    </div>
  )
}
