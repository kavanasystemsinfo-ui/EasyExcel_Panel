/**
 * Render minimalista de markdown para las respuestas del copiloto.
 *
 * El texto del modelo es dato NO confiable (puede reproducir contenido de
 * celdas del Excel): primero se escapa todo el HTML y después se aplican
 * las etiquetas propias de markdown. Así ningún <img onerror=...> llega
 * vivo al dangerouslySetInnerHTML del panel.
 */
export function renderRespuesta(texto: string): string {
  const escapado = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escapado
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br/>')
}
