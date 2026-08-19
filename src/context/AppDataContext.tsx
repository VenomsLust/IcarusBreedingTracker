import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Animal, AppData, Classification, Prospect, SpeciesDefinition } from '@shared/types'
import {
  applyDeleteAnimal,
  applyDeleteAnimals,
  applyDeleteClassification,
  applyDeleteProspect,
  applyDeleteSpecies,
  applySaveAnimal,
  applySaveClassification,
  applySaveProspect,
  applySaveSpecies,
  parseAppData
} from '@shared/validation'
import { seedAppData } from '@shared/seedData'
import { downloadText, readFileAsText } from '../lib/fileIO'

interface AppDataContextValue {
  data: AppData
  dirty: boolean
  error: string | null
  fileName: string | null
  saveAnimal: (animal: Animal) => Promise<void>
  deleteAnimal: (animalId: string) => Promise<void>
  deleteAnimals: (animalIds: string[]) => Promise<void>
  saveSpecies: (species: SpeciesDefinition) => Promise<void>
  deleteSpecies: (speciesId: string) => Promise<void>
  saveClassification: (classification: Classification) => Promise<void>
  deleteClassification: (classificationId: string) => Promise<void>
  saveProspect: (prospect: Prospect) => Promise<void>
  deleteProspect: (prospectId: string) => Promise<void>
  loadFromFile: (file: File) => Promise<void>
  saveToFile: () => void
  newDatabase: () => void
  clearError: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, setData] = useState<AppData>(seedAppData)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // There's no autosave in the browser build — data only lives in memory
  // until the user hits Save — so warn before a navigation/close would
  // silently discard it.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent): void {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  async function saveAnimal(animal: Animal): Promise<void> {
    setData(applySaveAnimal(data, animal))
    setDirty(true)
  }

  async function deleteAnimal(animalId: string): Promise<void> {
    setData(applyDeleteAnimal(data, animalId))
    setDirty(true)
  }

  async function deleteAnimals(animalIds: string[]): Promise<void> {
    setData(applyDeleteAnimals(data, animalIds))
    setDirty(true)
  }

  async function saveSpecies(species: SpeciesDefinition): Promise<void> {
    setData(applySaveSpecies(data, species))
    setDirty(true)
  }

  async function deleteSpecies(speciesId: string): Promise<void> {
    setData(applyDeleteSpecies(data, speciesId))
    setDirty(true)
  }

  async function saveClassification(classification: Classification): Promise<void> {
    setData(applySaveClassification(data, classification))
    setDirty(true)
  }

  async function deleteClassification(classificationId: string): Promise<void> {
    setData(applyDeleteClassification(data, classificationId))
    setDirty(true)
  }

  async function saveProspect(prospect: Prospect): Promise<void> {
    setData(applySaveProspect(data, prospect))
    setDirty(true)
  }

  async function deleteProspect(prospectId: string): Promise<void> {
    setData(applyDeleteProspect(data, prospectId))
    setDirty(true)
  }

  async function loadFromFile(file: File): Promise<void> {
    try {
      const raw = await readFileAsText(file)
      const next = parseAppData(raw)
      setData(next)
      setDirty(false)
      setFileName(file.name)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  function saveToFile(): void {
    const name = fileName ?? 'icarus-breeding-data.json'
    downloadText(name, JSON.stringify(data, null, 2))
    setDirty(false)
    setFileName(name)
  }

  function newDatabase(): void {
    setData(seedAppData())
    setDirty(false)
    setFileName(null)
    setError(null)
  }

  function clearError(): void {
    setError(null)
  }

  const value: AppDataContextValue = {
    data,
    dirty,
    error,
    fileName,
    saveAnimal,
    deleteAnimal,
    deleteAnimals,
    saveSpecies,
    deleteSpecies,
    saveClassification,
    deleteClassification,
    saveProspect,
    deleteProspect,
    loadFromFile,
    saveToFile,
    newDatabase,
    clearError
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
