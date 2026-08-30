import { useRef, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { parseSaveFile, type ParsedSaveFile } from '@shared/gameImport/parseSaveFile'
import { readFileAsText } from '../lib/fileIO'
import HelpDialog from './HelpDialog'

interface Props {
  onImportParsed: (parsed: ParsedSaveFile) => void
}

export default function Toolbar({ onImportParsed }: Props): JSX.Element {
  const { dirty, error, fileName, loadFromFile, saveToFile, newDatabase, clearError } = useAppData()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  function handleNew(): void {
    if (dirty && !confirm('Discard unsaved changes and start a new, empty database?')) return
    newDatabase()
  }

  function handleLoadClick(): void {
    if (dirty && !confirm('Loading a file will discard unsaved changes. Continue?')) return
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await loadFromFile(file)
    } catch {
      // error already surfaced via context state
    }
  }

  function handleImportClick(): void {
    setImportError(null)
    importInputRef.current?.click()
  }

  async function handleImportFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setImportError(null)
    try {
      const text = await readFileAsText(file)
      const parsed = await parseSaveFile(text)
      if (parsed.creatures.length === 0) {
        setImportError('No creatures found in that file.')
        return
      }
      onImportParsed(parsed)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <header className="app-toolbar">
      <div className="app-toolbar-title">
        <strong>Icarus Breeding Tracker</strong>
        {fileName && <span className="file-name">{fileName}</span>}
        {dirty && (
          <span className="dirty-badge" title="You have unsaved changes">
            ● Unsaved changes
          </span>
        )}
      </div>
      <div className="app-toolbar-actions">
        <button type="button" onClick={handleNew}>
          New
        </button>
        <button type="button" onClick={handleLoadClick}>
          Load…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChosen}
          style={{ display: 'none' }}
        />
        <button type="button" className="primary" onClick={saveToFile}>
          Save
        </button>
        <button type="button" onClick={handleImportClick} disabled={importing} title="Import animals from a Mounts.json or Prospect save file">
          {importing ? 'Reading…' : 'Import from Save…'}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFileChosen}
          style={{ display: 'none' }}
        />
        <button type="button" className="help-button" onClick={() => setHelpOpen(true)} title="Help importing from a save file">
          ?
        </button>
      </div>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {(error || importError) && (
        <div className="toolbar-error">
          {error ?? importError}
          <button type="button" className="icon-button" onClick={error ? clearError : () => setImportError(null)}>
            ✕
          </button>
        </div>
      )}
    </header>
  )
}
