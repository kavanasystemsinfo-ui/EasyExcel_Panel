import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Grafico } from './charts'

const PALETA = ['#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b']

type Props = { graficos: Grafico[] }

function ChartsPanel({ graficos }: Props) {
  const [id, setId] = useState(graficos[0]?.id ?? '')
  const activo = graficos.find((g) => g.id === id) ?? graficos[0]
  if (!activo) return null

  return (
    <section className="charts-card" aria-label="Gráficos">
      <header className="panel-head">
        <h3>Gráficos</h3>
        <select
          aria-label="Serie del gráfico"
          value={activo.id}
          onChange={(event) => setId(event.target.value)}
        >
          {graficos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.titulo}
            </option>
          ))}
        </select>
      </header>
      <div className="charts-body">
        <ResponsiveContainer width="100%" height={260}>
          {activo.tipo === 'barras' ? (
            <BarChart data={activo.puntos} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="valor" name="Registros" radius={[4, 4, 0, 0]}>
                {activo.puntos.map((_, index) => (
                  <Cell key={index} fill={PALETA[index % PALETA.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={activo.puntos}
                dataKey="valor"
                nameKey="etiqueta"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {activo.puntos.map((_, index) => (
                  <Cell key={index} fill={PALETA[index % PALETA.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default ChartsPanel
