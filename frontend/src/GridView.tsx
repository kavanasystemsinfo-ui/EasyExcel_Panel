import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMemo } from 'react'

type Row = {
  index: number
  cells: unknown[]
}

type Props = {
  sheetName: string
  header: string[]
  rows: unknown[][]
  total: number
  offset: number
  limit: number
  onPage: (offset: number) => void
}

function display(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export default function GridView({
  sheetName,
  header,
  rows,
  total,
  offset,
  limit,
  onPage,
}: Props) {
  const data = useMemo<Row[]>(
    () => rows.map((cells, position) => ({ index: offset + position + 1, cells })),
    [rows, offset],
  )

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const indexColumn: ColumnDef<Row> = {
      id: '#',
      header: '#',
      cell: (info) => String(info.row.original.index),
      size: 56,
    }
    const cellColumns: ColumnDef<Row>[] = header.map((title, columnIndex) => ({
      id: `col-${columnIndex}`,
      header: title || `Col ${columnIndex + 1}`,
      cell: (info) => display(info.row.original.cells[columnIndex]),
    }))
    return [indexColumn, ...cellColumns]
  }, [header])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  const firstRow = total === 0 ? 0 : offset + 1
  const lastRow = offset + data.length
  const canPrev = offset > 0
  const canNext = offset + limit < total

  return (
    <section className="grid" aria-label={`Contenido de ${sheetName}`}>
      <div className="grid-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((columnHeader) => (
                  <th key={columnHeader.id} scope="col">
                    {flexRender(columnHeader.column.columnDef.header, columnHeader.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {data.length === 0 ? (
              <tr>
                <td className="grid-empty" colSpan={columns.length}>
                  Hoja sin filas de datos
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="grid-footer">
        <span data-testid="grid-range">
          Filas {firstRow}–{lastRow} de {total}
        </span>
        <div className="grid-pager">
          <button type="button" disabled={!canPrev} onClick={() => onPage(offset - limit)}>
            Anterior
          </button>
          <button type="button" disabled={!canNext} onClick={() => onPage(offset + limit)}>
            Siguiente
          </button>
        </div>
      </div>
    </section>
  )
}
