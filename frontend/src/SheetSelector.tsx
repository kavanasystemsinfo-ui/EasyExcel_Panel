import type { SheetInfo } from './api'

type Props = {
  sheets: SheetInfo[]
  active: string
  onSelect: (name: string) => void
}

function SheetSelector({ sheets, active, onSelect }: Props) {
  return (
    <div className="sheet-tabs" role="tablist" aria-label="Hojas del libro">
      {sheets.map((sheet) => {
        const isActive = sheet.name === active
        return (
          <button
            key={sheet.name}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`sheet-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(sheet.name)}
          >
            <span className="sheet-dot" aria-hidden="true" />
            <span className="sheet-tab-name">{sheet.name}</span>
            <span className="sheet-tab-count">{sheet.rows}</span>
          </button>
        )
      })}
    </div>
  )
}

export default SheetSelector
