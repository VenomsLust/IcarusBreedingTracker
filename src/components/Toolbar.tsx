import { useRef } from 'react'
import { useAppData } from '../context/AppDataContext'

export default function Toolbar(): JSX.Element {
  const { dirty, error, fileName, loadFromFile, saveToFile, newDatabase, clearError } = useAppData()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      </div>
      {error && (
        <div className="toolbar-error">
          {error}
          <button type="button" className="icon-button" onClick={clearError}>
            ✕
          </button>
        </div>
      )}
    </header>
  )
}
