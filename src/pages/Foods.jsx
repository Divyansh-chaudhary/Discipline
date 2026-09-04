import { useState } from 'react'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { FoodFields, emptyFood, parseFoodFields } from '../components/FoodFields.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { useBusy, useBusyKey } from '../lib/busy.js'
import { localDateKey } from '../lib/dates.js'
import { fmtCal, fmtG, round1 } from '../lib/format.js'
import { searchUsda } from '../lib/usda.js'
import { useData } from '../sync/DataContext.jsx'

function referenceForFood(food) {
  if (food.referenceQuantity != null) {
    return { quantity: Number(food.referenceQuantity) || 1, unit: food.referenceUnit || 'serving' }
  }
  const match = String(food.servingLabel || '').match(/^\s*(\d+(?:\.\d+)?)\s*(.+?)\s*$/)
  return match ? { quantity: Number(match[1]), unit: match[2] } : { quantity: 1, unit: 'serving' }
}

export function Foods() {
  const { online, customFoods, saveFood, removeFood, addLog } = useData()
  const foods = customFoods

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const [searchMeta, setSearchMeta] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyFood)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [searching, runSearchBusy] = useBusy()
  const [saving, runSave] = useBusy()
  const [hitBusy, runHit] = useBusyKey()
  const [removingId, runRemove] = useBusyKey()

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyFood, servingLabel: '' })
    setError('')
    setSheet('edit')
  }

  const openEdit = (food) => {
    const reference = referenceForFood(food)
    setEditingId(food.id)
    setForm({
      name: food.name,
      servingLabel: food.servingLabel || '1 serving',
      referenceQuantity: String(reference.quantity),
      referenceUnit: reference.unit,
      servings: '1',
      calories: String(food.calories ?? ''),
      protein: String(food.protein ?? ''),
      carbs: String(food.carbs ?? ''),
      fat: String(food.fat ?? ''),
    })
    setError('')
    setSheet('edit')
  }

  const persistFood = () =>
    runSave(async () => {
      const parsed = parseFoodFields(form, { deriveCalories: true })
      if (!parsed.name) {
        setError('Name is required.')
        return
      }
      await saveFood(
        {
          name: parsed.name,
          servingLabel: parsed.servingLabel,
          referenceQuantity: parsed.referenceQuantity,
          referenceUnit: parsed.referenceUnit,
          calories: parsed.calories,
          protein: parsed.protein,
          carbs: parsed.carbs,
          fat: parsed.fat,
        },
        editingId,
      )
      setSheet(null)
    })

  const runSearch = (text = query) => {
    if (!text.trim()) return
    runSearchBusy(async () => {
      setError('')
      const result = await searchUsda(text)
      setHits(result.foods)
      setSearchMeta(result)
      if (result.error && result.foods.length === 0) {
        setError(result.error)
      }
    })
  }

  const fromUsda = (hit) => ({
    name: hit.brand ? `${hit.name} (${hit.brand})` : hit.name,
    servingLabel: hit.servingLabel,
    referenceQuantity: '1',
    referenceUnit: 'serving',
    servings: '1',
    calories: String(hit.calories ?? ''),
    protein: String(hit.protein ?? ''),
    carbs: String(hit.carbs ?? ''),
    fat: String(hit.fat ?? ''),
  })

  const saveUsda = (hit) =>
    runHit(`save-${hit.fdcId}`, async () => {
      const parsed = parseFoodFields(fromUsda(hit))
      await saveFood({
        name: parsed.name,
        servingLabel: parsed.servingLabel,
        referenceQuantity: parsed.referenceQuantity,
        referenceUnit: parsed.referenceUnit,
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
        source: 'usda',
        fdcId: hit.fdcId,
      })
    })

  const logUsda = (hit) =>
    runHit(`log-${hit.fdcId}`, async () => {
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
    })

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
              disabled={searching}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
            />
          </div>
          <BusyButton
            className="primary full"
            busy={searching}
            busyLabel="Searching…"
            disabled={!query.trim()}
            onClick={() => runSearch()}
          >
            Search
          </BusyButton>
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
                    <BusyButton
                      className="secondary"
                      busy={hitBusy === `save-${hit.fdcId}`}
                      busyLabel="Saving…"
                      disabled={Boolean(hitBusy)}
                      onClick={() => saveUsda(hit)}
                    >
                      Save
                    </BusyButton>
                    <BusyButton
                      className="primary"
                      busy={hitBusy === `log-${hit.fdcId}`}
                      busyLabel="Logging…"
                      disabled={Boolean(hitBusy)}
                      onClick={() => logUsda(hit)}
                    >
                      Log today
                    </BusyButton>
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
                  Per {referenceForFood(food).quantity} {referenceForFood(food).unit} · {fmtCal(food.calories)} kcal
                </div>
              </button>
              <button
                className={`icon-btn${removingId === food.id ? ' is-busy' : ''}`}
                aria-label={`Delete ${food.name}`}
                disabled={Boolean(removingId)}
                onClick={() => runRemove(food.id, () => removeFood(food.id))}
              >
                {removingId === food.id ? <Spinner size={12} /> : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      {sheet === 'edit' ? (
        <Sheet
          title={editingId ? 'Edit food' : 'New food'}
          onClose={() => !saving && setSheet(null)}
          footer={
            <>
              {error ? <p className="warn">{error}</p> : null}
              <BusyButton className="primary full" busy={saving} busyLabel="Saving…" onClick={persistFood}>
                Save to pantry
              </BusyButton>
            </>
          }
        >
          <p className="sub">Enter the amount these macros describe, such as 100 g. You’ll enter the actual amount when logging it.</p>
          <FoodFields value={form} onChange={setForm} showReference />
        </Sheet>
      ) : null}
    </div>
  )
}
