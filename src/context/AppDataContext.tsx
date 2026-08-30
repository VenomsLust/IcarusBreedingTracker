import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Animal, AppData, Classification, Prospect, SpeciesDefinition } from '@shared/types'
import {
  applyDeleteAnimal,
  applyDeleteAnimals,
  applyDeleteClassification,
  applyDeleteProspect,
  applyDeleteSpecies,
  applyImportAnimals,
  applySaveAnimal,
  applySaveClassification,
  applySaveProspect,
  applySaveSpecies,
  parseAppData,
  reduceToDiff
} from '@shared/validation'
import { seedAppData } from '@shared/seedData'
import { downloadText, readFileAsText } from '../lib/fileIO'

interface AppDataContextValue {
  data: AppData
  dirty: boolean
  error: string | null
  fileName: string | null
  saveAnimal: (animal: Animal) => Promise<void>
  importAnimals: (animals: Animal[]) => Promise<void>
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

// Browser local storage keeps working state alive across reloads/tab closes
// without the user having to remember to Save. It's per-browser-profile
// though (not portable, and gone if the user clears site data) — the
// exported save file is still the only durable, shareable copy.
const STORAGE_DATA_KEY = 'icarus-breeding-tracker/data'
const STORAGE_FILENAME_KEY = 'icarus-breeding-tracker/fileName'
const STORAGE_DIRTY_KEY = 'icarus-breeding-tracker/dirty'

function readStoredData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_DATA_KEY)
    if (raw) return parseAppData(raw)
  } catch (err) {
    console.warn('Failed to restore saved data from local storage — starting fresh.', err)
  }
  return seedAppData()
}

function readStoredFileName(): string | null {
  try {
    return localStorage.getItem(STORAGE_FILENAME_KEY)
  } catch {
    return null
  }
}

function readStoredDirty(): boolean {
  try {
    return localStorage.getItem(STORAGE_DIRTY_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppDataProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, setData] = useState<AppData>(readStoredData)
  const [dirty, setDirty] = useState(readStoredDirty)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(readStoredFileName)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('Failed to persist data to local storage', err)
    }
  }, [data])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DIRTY_KEY, String(dirty))
    } catch {
      // Best-effort — local storage may be unavailable (e.g. private browsing).
    }
  }, [dirty])

  useEffect(() => {
    try {
      if (fileName) localStorage.setItem(STORAGE_FILENAME_KEY, fileName)
      else localStorage.removeItem(STORAGE_FILENAME_KEY)
    } catch {
      // Best-effort — local storage may be unavailable (e.g. private browsing).
    }
  }, [fileName])

  // The exported file is the only portable copy, so still warn before a
  // navigation/close would leave changes stranded in this browser only.
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

  async function importAnimals(animals: Animal[]): Promise<void> {
    setData(applyImportAnimals(data, animals))
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
    downloadText(name, JSON.stringify(reduceToDiff(data), null, 2))
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
    importAnimals,
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
