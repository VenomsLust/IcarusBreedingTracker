interface Props {
  onClose: () => void
}

export default function HelpDialog({ onClose }: Props): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Importing from a save file</h2>

        <h3>Where are my save files?</h3>
        <p>
          Paste this into the file picker's address bar to jump straight there:
          <br />
          <code>%LOCALAPPDATA%\Icarus\Saved\PlayerData\&lt;your Steam ID&gt;\</code>
        </p>
        <ul>
          <li>
            <code>Mounts.json</code> - everything parked at your Station.
          </li>
          <li>
            <code>Prospects\&lt;name&gt;.json</code> - everything deployed on that Prospect.
          </li>
        </ul>

        <h3>What happens when I import?</h3>
        <p>
          You'll see a review of every creature found in the file, classified as <strong>Add</strong> (new),{' '}
          <strong>Update</strong> (a tracked animal's non-genetic info changed, like a new save-file link or a
          previously unresolved parent), <strong>Conflict</strong> (its stats, bloodline, or sex disagree with what's
          tracked - pick Replace or Append), or <strong>Unchanged</strong>. Nothing is applied until you click Import
          Selected.
        </p>

        <h3>Unrecognized creature types</h3>
        <p>
          Common creatures are pre-mapped and import automatically. Anything else asks you to pick a Species once -
          it's remembered for every import after that.
        </p>

        <h3>Tip: skip re-navigating every time</h3>
        <p>
          Browsers can't be told to default there ahead of time, but most (Chrome and Edge included) reopen their
          file picker near the last folder you browsed to on this site. Navigate to your PlayerData folder once and
          later imports should start you off close by.
        </p>

        <div className="form-actions">
          <button type="button" className="primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
