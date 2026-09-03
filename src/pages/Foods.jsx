import { useState } from 'react'
import { FoodFields, emptyFood, parseFoodFields } from '../components/FoodFields.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { localDateKey } from '../lib/dates.js'
import { fmtCal, fmtG, round1 } from '../lib/format.js'
import { searchUsda } from '../lib/usda.js'
import { useData } from '../sync/DataContext.jsx'

export function Foods() {
  const { online, customFoods, saveFood, removeFood, addLog } = useData()
  const foods = customFoods

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const [searchMeta, setSearchMeta] = useState(null)
  const [searching, setSearching] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyFood)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyFood)
    setError('')
    setSheet('edit')
  }

  const openEdit = (food) => {
    setEditingId(food.id)
    setForm({
      name: food.name,
      servingLabel: food.servingLabel || '1 serving',
      servings: '1',
      calories: String(food.calories ?? ''),
      protein: String(food.protein ?? ''),
      carbs: String(food.carbs ?? ''),
      fat: String(food.fat ?? ''),
    })
    setError('')
    setSheet('edit')
  }

  const persistFood = async () => {
    const parsed = parseFoodFields(form, { deriveCalories: true })
    if (!parsed.name) {
      setError('Name is required.')
      return
    }
    await saveFood(
      {
        name: parsed.name,
        servingLabel: parsed.servingLabel,
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
      },
      editingId,
    )
    setSheet(null)
  }

  const runSearch = async (text = query) => {
    if (!text.trim()) return
    setSearching(true)
    setError('')
    const result = await searchUsda(text)
    setHits(result.foods)
    setSearchMeta(result)
    setSearching(false)
    if (result.error && result.foods.length === 0) {
      setError(result.error)
    }
  }

  const fromUsda = (hit) => ({
    name: hit.brand ? `${hit.name} (${hit.brand})` : hit.name,
    servingLabel: hit.servingLabel,
    servings: '1',
    calories: String(hit.calories ?? ''),
    protein: String(hit.protein ?? ''),
    carbs: String(hit.carbs ?? ''),
    fat: String(hit.fat ?? ''),
  })

  const saveUsda = async (hit) => {
    const parsed = parseFoodFields(fromUsda(hit))
    await saveFood({
      name: parsed.name,
      servingLabel: parsed.servingLabel,
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
      source: 'usda',
      fdcId: hit.fdcId,
    })
  }

  const logUsda = async (hit) => {
    const parsed = parseFoodFields(fromUsda(hit))
    await addLog({
      date: localDateKey(),
      name: parsed.name,
      servings: 1,
      calories: round1(parsed.calories),
      protein: round1(parsed.protein),
      carbs: round1(parsed.carbs),
      fat: round1(parsed.fat),
      source: 'usda',
      fdcId: hit.fdcId,
    })
  }

  return (
    <div className="page">
      <PageHead kicker="Pantry" title="Foods" sub="Saved to your account. Search USDA only when you have a connection." />

      {online ? (
        <div className="card stack">
          <div className="field">
            <label htmlFor="usda-q">USDA search</label>
            <input
              id="usda-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="chicken thigh, rice, yogurt"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
            />
          </div>
          <button className="primary full" disabled={searching || !query.trim()} onClick={() => runSearch()}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          {searchMeta?.source === 'cache' ? (
            <p className="tiny">Showing cached results — USDA was unavailable.</p>
          ) : null}
          {error ? <p className="warn">{error}</p> : null}
        </div>
      ) : (
        <p className="search-note">Search needs internet. Your pantry and diary still queue offline.</p>
      )}

      {hits.length > 0 ? (
        <>
          <div className="section-title">
            <h2>Results</h2>
          </div>
          <div className="list">
            {hits.map((hit) => (
              <div className="row" key={hit.fdcId} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="name">{hit.name}</div>
                  <div className="meta">
                    {hit.servingLabel} · {fmtCal(hit.calories)} kcal · P {fmtG(hit.protein)} C {fmtG(hit.carbs)} F {fmtG(hit.fat)}
                  </div>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="secondary" onClick={() => saveUsda(hit)}>
                      Save
                    </button>
                    <button className="primary" onClick={() => logUsda(hit)}>
                      Log today
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="section-title">
        <h2>My foods</h2>
        <button className="secondary" onClick={openCreate}>
          New
        </button>
      </div>

      {foods.length === 0 ? (
        <div className="empty card">Add a custom food once, tap it forever — even offline.</div>
      ) : (
        <div className="list">
          {foods.map((food) => (
            <div className="row" key={food.id}>
              <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => openEdit(food)}>
                <div className="name">{food.name}</div>
                <div className="meta">
                  {food.servingLabel || '1 serving'} · {fmtCal(food.calories)} kcal
                </div>
              </button>
              <button className="icon-btn" aria-label={`Delete ${food.name}`} onClick={() => removeFood(food.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {sheet === 'edit' ? (
        <Sheet
          title={editingId ? 'Edit food' : 'New food'}
          onClose={() => setSheet(null)}
          footer={
            <>
              {error ? <p className="warn">{error}</p> : null}
              <button className="primary full" onClick={persistFood}>
                Save to pantry
              </button>
            </>
          }
        >
          <FoodFields value={form} onChange={setForm} />
        </Sheet>
      ) : null}
    </div>
  )
}
