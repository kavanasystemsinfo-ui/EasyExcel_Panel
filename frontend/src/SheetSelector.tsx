import type { SheetInfo } from './api'

type Props = {
  sheets: SheetInfo[]
  active: string
  onSelect: (name: string) => void
}

export default function SheetSelector({ sheets, active, onSelect }: Props) {
  if (sheets.length === 0) return null
  return (
    <div className="sheet-tabs" role="tablist" aria-label="Hojas del libro">
      {sheets.map((sheet) => (
        <button
          key={sheet.name}
          role="tab"
          type="button"
          aria-selected={sheet.name === active}
          className={sheet.name === active ? 'tab is-active' : 'tab'}
          onClick={() => onSelect(sheet.name)}
        >
          {sheet.name}
          <span className="tab-count">{sheet.rows}</span>
        </button>
      ))}
    </div>
  )
}

