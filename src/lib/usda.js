import { round1 } from './format.js'

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'

const ENERGY_IDS = new Set([1008, 2047, 2048])
const PROTEIN_IDS = new Set([1003])
const CARB_IDS = new Set([1005])
const FAT_IDS = new Set([1004])

function nutrientByIds(nutrients, ids) {
  for (const n of nutrients) {
    const id = n.nutrientId ?? Number(n.nutrientNumber)
    if (ids.has(id) && n.value != null) {
      const unit = String(n.unitName || '').toUpperCase()
      if (ids === ENERGY_IDS && (unit === 'KJ' || unit === 'KJOULES')) {
        return n.value / 4.184
      }
      return n.value
    }
  }
  return null
}

function nutrientByName(nutrients, names) {
  const lower = names.map((n) => n.toLowerCase())
  for (const n of nutrients) {
    const name = String(n.nutrientName || '').toLowerCase()
    if (lower.some((want) => name === want || name.startsWith(want))) {
      if (n.value == null) continue
      const unit = String(n.unitName || '').toUpperCase()
      if (name.includes('energy') && (unit === 'KJ' || unit === 'KJOULES')) {
        return n.value / 4.184
      }
      return n.value
    }
  }
  return null
}

export function mapUsdaFood(food) {
  const nutrients = food.foodNutrients || []
  const calories =
    nutrientByIds(nutrients, ENERGY_IDS) ??
    nutrientByName(nutrients, ['energy']) ??
    0
  const protein =
    nutrientByIds(nutrients, PROTEIN_IDS) ??
    nutrientByName(nutrients, ['protein']) ??
    0
  const carbs =
    nutrientByIds(nutrients, CARB_IDS) ??
    nutrientByName(nutrients, ['carbohydrate']) ??
    0
  const fat =
    nutrientByIds(nutrients, FAT_IDS) ??
    nutrientByName(nutrients, ['total lipid', 'total fat', 'fat']) ??
    0

  const servingSize = food.servingSize
  const servingUnit = food.servingSizeUnit || 'g'
  const household = food.householdServingFullText
  const branded = String(food.dataType || '').toLowerCase() === 'branded'

  let servingLabel
  if (household) servingLabel = household
  else if (servingSize) servingLabel = `${servingSize} ${servingUnit}`
  else servingLabel = '100 g'

  return {
    fdcId: food.fdcId,
    name: food.description || 'Untitled food',
    brand: food.brandOwner || food.brandName || '',
    servingLabel,
    calories: round1(calories),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    dataType: food.dataType || (branded ? 'Branded' : ''),
  }
}

export async function searchUsda(query) {
  const trimmed = query.trim()
  if (!trimmed) return { foods: [], source: 'empty' }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { foods: [], source: 'offline', error: 'USDA search needs a connection.' }
  }

  const apiKey = import.meta.env.VITE_USDA_API_KEY
  if (!apiKey) {
    return {
      foods: [],
      source: 'no-key',
      error: 'Add VITE_USDA_API_KEY in a local .env to search USDA.',
    }
  }

  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('query', trimmed)
    url.searchParams.set('pageSize', '12')
    url.searchParams.set('api_key', apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`USDA ${res.status}`)
    }
    const data = await res.json()
    const foods = (data.foods || []).map(mapUsdaFood)
    return { foods, source: 'network' }
  } catch (err) {
    return {
      foods: [],
      source: 'error',
      error: err instanceof Error ? err.message : 'USDA search failed',
    }
  }
}
