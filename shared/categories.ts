// Categorías de video de YouTube. Los IDs son fijos y vienen en cada video.

export const CATEGORIES: Record<string, string> = {
  '1': 'Cine y animación',
  '2': 'Autos y vehículos',
  '10': 'Música',
  '15': 'Mascotas y animales',
  '17': 'Deportes',
  '19': 'Viajes y eventos',
  '20': 'Videojuegos',
  '22': 'Gente y blogs',
  '23': 'Comedia',
  '24': 'Entretenimiento',
  '25': 'Noticias y política',
  '26': 'Consejos y estilo',
  '27': 'Educación',
  '28': 'Ciencia y tecnología',
  '29': 'ONG y activismo',
}

export const categoryName = (id: string | null) => (id && CATEGORIES[id]) || 'Sin categoría'

/** Lista ordenada por nombre, para los selectores. */
export const CATEGORY_OPTIONS = Object.entries(CATEGORIES)
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
