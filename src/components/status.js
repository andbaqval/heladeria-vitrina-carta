export function statusLabel(status) {
  return status === 'agotado'
    ? 'Agotado hoy'
    : status === 'temporada'
      ? 'Fuera de temporada'
      : 'En vitrina';
}

export function statusClass(status) {
  return status === 'agotado'
    ? 'status sold'
    : status === 'temporada'
      ? 'status season'
      : 'status available';
}
