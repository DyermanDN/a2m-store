/* =========================================================
   PLUIE - DATOS DEL CATÁLOGO
   Categorías: Árabe, Diseñador, Nicho (5 perfumes de cada una).
   ========================================================= */

const CATALOG_CATEGORIES = {
  arabe: 'Árabe',
  disenador: 'Diseñador',
  nicho: 'Nicho'
};

const CATALOG_FAMILIES = {
  floral: 'Floral',
  woody: 'Amaderado',
  amber: 'Ámbar',
  fresh: 'Fresco',
  gourmand: 'Gourmand',
  leather: 'Cuero'
};

const CATALOG_GENDERS = {
  women: 'Mujer',
  men: 'Hombre',
  unisex: 'Unisex'
};

const CATALOG_LINES = {
  arabe: [
    { id: 'all', label: 'Todos los árabes' },
    { id: 'khamrah', label: 'Colección Khamrah' },
    { id: 'club-de-nuit', label: 'Club de Nuit' },
    { id: 'yara', label: 'Línea Yara' },
    { id: 'asad', label: 'Línea Asad' },
    { id: 'oud-for-glory', label: "Bade'e Al Oud" }
  ],
  disenador: [
    { id: 'all', label: 'Todo Diseñador' },
    { id: 'private-blend', label: 'Private Blend' },
    { id: 'fresh-citrus', label: 'Cítricos & Riviera' },
    { id: 'amber-wood', label: 'Ámbar & Maderas' }
  ],
  nicho: [
    { id: 'all', label: 'Todo Nicho' },
    { id: 'leather', label: 'Cueros de Autor' },
    { id: 'woody', label: 'Sándalo & Maderas' },
    { id: 'marine', label: 'Acuáticos & Brisa' }
  ],
  all: [
    { id: 'all', label: 'Todas las fragancias' },
    { id: 'khamrah', label: 'Colección Khamrah' },
    { id: 'arabe', label: 'Perfumería Árabe' },
    { id: 'disenador', label: 'Diseñador' },
    { id: 'nicho', label: 'Perfumes Nicho' },
    { id: 'club-de-nuit', label: 'Club de Nuit' }
  ]
};

const CATALOG_PRODUCTS = [
  /* ==========================================
     CATEGORÍA: ÁRABE - COLECCIÓN KHAMRAH (5 MODELOS)
     ========================================== */
  {
    id: 'khamrah',
    name: 'Khamrah Original',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'khamrah',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'gourmand',
    sizes: [{ ml: 100, price: 55 }],
    image: 'assets/catalog/khamrah.webp',
    badge: 'Más vendido',
    rank: 1,
    added: '2026-10-15',
    notes: ['Canela', 'Nuez moscada', 'Praliné', 'Dátiles', 'Vainilla', 'Haba tonka'],
    desc: 'El perfume árabe más aclamado. Una mezcla suntuosa de canela cálida, nuez moscada y praliné sobre un fondo licoroso de dátiles dulces y vainilla cremosa. Potente y con una estela inconfundible.'
  },
  {
    id: 'khamrah-qahwa',
    name: 'Khamrah Qahwa',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'khamrah',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'gourmand',
    sizes: [{ ml: 100, price: 60 }],
    image: 'assets/catalog/khamrah.webp',
    badge: 'Top Ventas 2026',
    rank: 2,
    added: '2026-10-25',
    notes: ['Café arábigo tostado', 'Cardamomo', 'Jengibre', 'Praliné', 'Dátiles confitados', 'Haba tonka'],
    desc: 'La evolución de culto de Khamrah con una embriagadora nota de café árabe recién tostado, cardamomo aromático y jengibre sobre el licor de praliné característico.'
  },
  {
    id: 'khamrah-dukhan',
    name: 'Khamrah Dukhan (Édition Noire)',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'khamrah',
    outOfStock: true,
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'amber',
    sizes: [{ ml: 100, price: 65 }],
    image: 'assets/catalog/khamrah.webp',
    badge: 'Edición Especial',
    rank: 3,
    added: '2026-10-28',
    notes: ['Incienso ahumado', 'Dátiles al ron', 'Haba tonka negra', 'Ámbar profundo', 'Madera de cedro'],
    desc: 'La faceta más oscura y misteriosa de la saga Khamrah. Suavidad dulce envuelta en un velo de humo de incienso, maderas nobles y licor añejado en barrica.'
  },
  {
    id: 'khamrah-dallah',
    name: 'Khamrah Dallah Royal',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'khamrah',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'gourmand',
    sizes: [{ ml: 100, price: 58 }],
    image: 'assets/catalog/khamrah.webp',
    badge: 'Exclusivo',
    rank: 4,
    added: '2026-11-01',
    notes: ['Cardamomo verde', 'Flor de café', 'Canela dorada', 'Praliné blanco', 'Vainilla bourbon'],
    desc: 'Homenaje a la tradicional jarra ceremonial árabe (Dallah). Abre con cardamomo verde fresco y especias doradas, fusionándose con una delicada flor de café y vainilla suave.'
  },
  {
    id: 'khamrah-crystal',
    name: 'Khamrah Elixir Crystal',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'khamrah',
    concentration: 'Extrait de parfum',
    gender: 'unisex',
    family: 'gourmand',
    sizes: [{ ml: 100, price: 62 }],
    image: 'assets/catalog/khamrah.webp',
    badge: 'Extracto Puro',
    rank: 5,
    added: '2026-11-02',
    notes: ['Canela cristalizada', 'Almendra dulce', 'Crema de dátiles', 'Ámbar blanco', 'Benjuí'],
    desc: 'Máxima concentración y proyección de lujo. Una textura cremosa de dátiles con almendra dulce, canela cristalizada y una base sedosa de ámbar blanco.'
  },

  /* ==========================================
     CATEGORÍA: ÁRABE - OTRAS LÍNEAS DE PRESTIGIO
     ========================================== */
  {
    id: 'club-de-nuit',
    name: 'Club de Nuit Intense Man',
    brand: 'Armaf',
    category: 'arabe',
    line: 'club-de-nuit',
    concentration: 'Eau de toilette',
    gender: 'men',
    family: 'fresh',
    sizes: [{ ml: 105, price: 48 }],
    image: 'assets/catalog/club-de-nuit.webp',
    badge: 'Más vendido',
    rank: 6,
    added: '2026-09-20',
    notes: ['Limón', 'Grosella negra', 'Abedul ahumado', 'Jazmín', 'Almizcle', 'Ámbar gris'],
    desc: 'Un titán de la perfumería masculina oriental. Salida cítrica electrizante con limón y grosella negra, seguida por un corazón ahumado de madera de abedul y un secado magnético de almizcle.'
  },
  {
    id: 'asad',
    name: 'Asad',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'asad',
    concentration: 'Eau de parfum',
    gender: 'men',
    family: 'amber',
    sizes: [{ ml: 100, price: 45 }],
    image: 'assets/catalog/asad.webp',
    badge: 'Nuevo',
    rank: 7,
    added: '2026-10-01',
    notes: ['Pimienta negra', 'Piña dulce', 'Tabaco rubio', 'Café', 'Pachulí', 'Ámbar seco'],
    desc: 'Una composición audaz y varonil con acordes de pimienta negra y piña fresca, evolucionando hacia un corazón aromático de café tostado, tabaco especiado y ámbar profundo.'
  },
  {
    id: 'yara',
    name: 'Yara',
    brand: 'Lattafa',
    category: 'arabe',
    line: 'yara',
    concentration: 'Eau de parfum',
    gender: 'women',
    family: 'floral',
    sizes: [{ ml: 100, price: 42 }],
    image: 'assets/catalog/yara.webp',
    badge: 'Nuevo',
    rank: 8,
    added: '2026-10-10',
    notes: ['Orquídea', 'Heliotropo', 'Frutas tropicales', 'Acorde gourmand', 'Vainilla', 'Almizcle'],
    desc: 'La fragancia femenina viral de Lattafa. Suave, cremosa y aterciopelada como un postre de fresas con crema batida, orquídeas exóticas y vainilla acariciante.'
  },
  {
    id: 'oud-for-glory',
    name: "Bade'e Al Oud (Oud for Glory)",
    brand: 'Lattafa',
    category: 'arabe',
    line: 'oud-for-glory',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'woody',
    sizes: [{ ml: 100, price: 50 }],
    image: 'assets/catalog/oud-for-glory.webp',
    badge: 'Popular',
    rank: 9,
    added: '2026-08-15',
    notes: ['Azafrán oriental', 'Nuez moscada', 'Lavanda', 'Oud ahumado', 'Pachulí', 'Almizcle'],
    desc: 'Opulencia y misterio oriental en un frasco. Abre con azafrán y nuez moscada refinada, abriendo paso a un majestuoso acorde de madera de oud oscuro y pachulí terroso.'
  },

  /* ==========================================
     CATEGORÍA: DISEÑADOR (5 PERFUMES)
     ========================================== */
  {
    id: 'tobacco-vanille',
    name: 'Tobacco Vanille',
    brand: 'Tom Ford',
    category: 'disenador',
    line: 'private-blend',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'amber',
    sizes: [{ ml: 50, price: 300 }],
    image: 'assets/tobacco-vanille.webp',
    cutout: true,
    badge: 'Más vendido',
    rank: 6,
    added: '2025-06-01',
    notes: ['Hoja de tabaco', 'Vainilla', 'Cacao', 'Haba tonka'],
    desc: 'Tabaco especiado combinado con cremosa vainilla y notas de cacao. Rico, cálido y envolvente, con la atmósfera sosegada de un salón privado al anochecer.'
  },
  {
    id: 'lost-cherry',
    name: 'Lost Cherry',
    brand: 'Tom Ford',
    category: 'disenador',
    line: 'private-blend',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'gourmand',
    sizes: [{ ml: 50, price: 405 }],
    image: 'assets/lost-cherry.webp',
    cutout: true,
    badge: 'Más vendido',
    rank: 11,
    added: '2025-09-01',
    notes: ['Cereza negra', 'Almendra amarga', 'Rosa', 'Haba tonka tostada'],
    desc: 'La cereza negra y la almendra amarga se abren hacia un corazón floral exquisito. Un fondo cálido de haba tonka y maderas nobles aporta profundidad a este gourmand de autor.'
  },
  {
    id: 'neroli-portofino',
    name: 'Neroli Portofino',
    brand: 'Tom Ford',
    category: 'disenador',
    line: 'fresh-citrus',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'fresh',
    sizes: [{ ml: 50, price: 300 }],
    image: 'assets/neroli-portofino.webp',
    cutout: true,
    rank: 12,
    added: '2025-01-15',
    notes: ['Neroli', 'Bergamota', 'Mandarina', 'Azahar'],
    desc: 'Cítricos vibrantes y neroli que evocan la luz de la Riviera Italiana. La flor de azahar brinda a esta composición fresca un delicado acabado floral.'
  },
  {
    id: 'oud-wood',
    name: 'Oud Wood',
    brand: 'Tom Ford',
    category: 'disenador',
    line: 'amber-wood',
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'woody',
    sizes: [{ ml: 50, price: 300 }],
    image: 'assets/oud-wood.webp',
    cutout: true,
    rank: 13,
    added: '2024-11-01',
    notes: ['Oud', 'Cardamomo', 'Sándalo', 'Ámbar'],
    desc: 'Maderas ahumadas y cardamomo que dan paso a una base ambarina y acogedora. Una composición sofisticada de textura rica y calidez persistente.'
  },
  {
    id: 'rose-prick',
    name: 'Rose Prick',
    brand: 'Tom Ford',
    category: 'disenador',
    line: 'private-blend',
    outOfStock: true,
    concentration: 'Eau de parfum',
    gender: 'unisex',
    family: 'floral',
    sizes: [{ ml: 50, price: 405 }],
    image: 'assets/rose-prick.webp',
    cutout: true,
    rank: 14,
    added: '2025-03-01',
    notes: ['Rosa de Bulgaria', 'Pimienta de Sichuan', 'Pachulí', 'Haba tonka'],
    desc: 'Un ramo de rosas contrastado con pimienta de Sichuan y suavizado por la calidez del haba tonka. El pachulí aporta un elegante contrapunto terroso.'
  },

  /* ==========================================
     CATEGORÍA: NICHO (5 PERFUMES)
     ========================================== */
  {
    id: 'cuir-noir',
    name: 'Cuir Noir',
    brand: 'PLUIE Atelier',
    category: 'nicho',
    line: 'leather',
    concentration: 'Eau de parfum',
    gender: 'men',
    family: 'leather',
    sizes: [{ ml: 30, price: 110 }, { ml: 50, price: 160 }, { ml: 100, price: 235 }],
    image: 'assets/catalog/cuir-noir.webp',
    badge: 'Nuevo',
    rank: 15,
    added: '2026-10-20',
    notes: ['Pimienta negra', 'Azafrán', 'Gamuza', 'Alquitrán de abedul'],
    desc: 'Gamuza suave acariciada por azafrán, con un matiz seco y ahumado de abedul. Intenso, íntimo y de larga duración sobre la piel.'
  },
  {
    id: 'santal-blanc',
    name: 'Santal Blanc',
    brand: 'PLUIE Atelier',
    category: 'nicho',
    line: 'woody',
    concentration: 'Eau de parfum',
    gender: 'women',
    family: 'woody',
    sizes: [{ ml: 30, price: 95 }, { ml: 50, price: 140 }, { ml: 100, price: 210 }],
    image: 'assets/catalog/santal-blanc.webp',
    badge: 'Nuevo',
    rank: 16,
    added: '2026-10-05',
    notes: ['Leche de higo', 'Sándalo', 'Cardamomo', 'Almizcle blanco'],
    desc: 'Sándalo cremoso con un toque de cardamomo sobre suave almizcle blanco. Un aroma limpio, sedoso y perfecto para usar a diario.'
  },
  {
    id: 'ambre-nuit',
    name: 'Ambre Nuit',
    brand: 'PLUIE Atelier',
    category: 'nicho',
    line: 'woody',
    outOfStock: true,
    concentration: 'Extrait de parfum',
    gender: 'unisex',
    family: 'amber',
    sizes: [{ ml: 30, price: 110 }, { ml: 50, price: 160 }, { ml: 100, price: 235 }],
    image: 'assets/catalog/ambre-nuit.webp',
    rank: 17,
    added: '2026-02-10',
    notes: ['Pimienta rosa', 'Ládano', 'Benjuí', 'Vaina de vainilla'],
    desc: 'Ámbar resinoso y vainilla pura con un toque chispeante de pimienta rosa. Denso, luminoso y con una estela magnética que perdura.'
  },
  {
    id: 'brume-iris',
    name: "Brume d'Iris",
    brand: 'PLUIE Atelier',
    category: 'nicho',
    line: 'woody',
    concentration: 'Eau de parfum',
    gender: 'women',
    family: 'floral',
    sizes: [{ ml: 30, price: 95 }, { ml: 50, price: 140 }, { ml: 100, price: 210 }],
    image: 'assets/catalog/brume-iris.webp',
    rank: 18,
    added: '2026-04-02',
    notes: ['Iris', 'Pera', 'Hoja de violeta', 'Almizcle de cachemira'],
    desc: 'Iris empolvado iluminado por pera jugosa y hoja de violeta, reposando sobre suave almizcle de cachemira. Un floral sutil y refinado.'
  },
  {
    id: 'sel-marin',
    name: 'Sel Marin',
    brand: 'PLUIE Atelier',
    category: 'nicho',
    line: 'marine',
    concentration: 'Eau de toilette',
    gender: 'men',
    family: 'fresh',
    sizes: [{ ml: 30, price: 85 }, { ml: 50, price: 125 }, { ml: 100, price: 185 }],
    image: 'assets/catalog/sel-marin.webp',
    badge: 'Nuevo',
    rank: 19,
    added: '2026-09-12',
    notes: ['Sal marina', 'Toronja', 'Salvia', 'Madera a la deriva'],
    desc: 'Brisa marina, toronja chispeante y salvia aromática sobre maderas bañadas por el sol. Fresco, limpio y revitalizante para los días cálidos.'
  }
];

if (typeof window !== 'undefined') {
  window.CATALOG_CATEGORIES = CATALOG_CATEGORIES;
  window.CATALOG_FAMILIES = CATALOG_FAMILIES;
  window.CATALOG_GENDERS = CATALOG_GENDERS;
  window.CATALOG_LINES = CATALOG_LINES;
  window.CATALOG_PRODUCTS = CATALOG_PRODUCTS;
}
