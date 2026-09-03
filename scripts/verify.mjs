import { chromium } from 'playwright-core'

const BASE = process.env.APP_URL || 'http://127.0.0.1:4173'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
const page = await context.newPage()
const failures = []

function assert(cond, msg) {
  if (!cond) failures.push(msg)
  else console.log('ok  ', msg)
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  assert(await page.getByRole('heading', { name: /August|September|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i }).count() > 0, 'Today heading renders')

  page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`))

  await page.getByRole('button', { name: 'Log food' }).click()
  await page.locator('#food-name').waitFor()
  await page.locator('#food-name').fill('Overnight oats')
  await page.locator('#food-cal').fill('420')
  await page.locator('#food-p').fill('18')
  await page.locator('#food-c').fill('62')
  await page.locator('#food-f').fill('12')
  await page.getByRole('button', { name: 'Add to today' }).click()
  await page.locator('.name', { hasText: 'Overnight oats' }).waitFor()
  assert(await page.locator('.name', { hasText: 'Overnight oats' }).count() > 0, 'Manual food appears in diary')
  assert(await page.getByText(/kcal left|kcal over/).count() > 0, 'Remaining calories update')

  await page.getByRole('link', { name: 'Foods' }).click()
  await page.getByRole('button', { name: 'New' }).click()
  await page.locator('#food-name').fill('Greek yogurt')
  await page.locator('#food-serving').fill('170 g')
  await page.locator('#food-cal').fill('100')
  await page.locator('#food-p').fill('17')
  await page.locator('#food-c').fill('6')
  await page.locator('#food-f').fill('0')
  await page.getByRole('button', { name: 'Save to pantry' }).click()
  await page.locator('.name', { hasText: 'Greek yogurt' }).waitFor()
  assert(await page.locator('.name', { hasText: 'Greek yogurt' }).count() > 0, 'Custom food saved')
  assert(await page.locator('#usda-q').count() > 0, 'USDA search shown while online')

  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('button', { name: 'From pantry' }).click()
  await page.getByRole('button', { name: /Greek yogurt/ }).click()
  await page.locator('.quantity-stepper input').fill('2')
  await page.getByRole('button', { name: /Add 1 to today/ }).click()
  assert(await page.getByText('Greek yogurt').count() > 0, 'Pantry food logged to today')

  await page.getByRole('link', { name: 'Lift' }).click()
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.locator('#ex-name').fill('Bench press')
  await page.locator('#ex-reps').fill('5')
  await page.locator('#ex-w').fill('80')
  await page.getByRole('button', { name: 'Add with first set' }).click()
  await page.getByRole('heading', { name: 'Bench press' }).waitFor()
  assert(await page.getByRole('heading', { name: 'Bench press' }).count() > 0, 'Exercise added')
  await page.getByRole('button', { name: '+ Set' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.set-row').length >= 2)
  assert(await page.locator('.set-row').count() >= 2, 'Second set added')
  await page.getByRole('link', { name: 'My workout types' }).click()
  await page.locator('#type-name').fill('PPL')
  await page.getByRole('button', { name: 'Create workout type' }).click()
  await page.getByRole('heading', { name: 'PPL' }).waitFor()
  assert(await page.getByRole('heading', { name: 'PPL' }).count() > 0, 'Workout type page opens after create')

  await page.locator('#split-name').fill('Push')
  await page.getByRole('button', { name: '+ Add split' }).click()
  await page.getByRole('link', { name: /Push/ }).click()
  await page.getByRole('heading', { name: 'Push' }).waitFor()

  await page.locator('#new-exercise').fill('Incline press')
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByText('Incline press').first().waitFor()
  assert(await page.getByText('Incline press').count() > 0, 'Exercise planned inside split')

  await page.getByRole('button', { name: 'Start today' }).click()
  await page.getByRole('heading', { name: 'Incline press' }).waitFor()
  assert(await page.getByRole('heading', { name: 'Incline press' }).count() > 0, 'Split loads into today')
  assert(await page.getByRole('heading', { name: /PPL · Push/ }).count() > 0, 'Session named from split')

  await page.getByRole('link', { name: 'Log' }).click()
  assert(await page.getByText('Overnight oats').count() > 0, 'History shows food')
  assert(await page.getByText('Bench press').count() > 0, 'History shows workout')

  await page.getByRole('link', { name: 'Setup' }).click()
  assert(await page.getByRole('heading', { name: 'Settings' }).count() > 0, 'Settings screen')
  assert(await page.getByText(/Add to Home Screen|Install/).count() > 0, 'Install hint present')

  await context.setOffline(true)
  await page.getByRole('link', { name: 'Foods' }).click()
  assert(await page.getByText('Search needs internet').count() > 0, 'Search hidden/blocked offline')
  assert(await page.locator('#usda-q').count() === 0, 'USDA input hidden offline')

  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Log food' }).click()
  await page.locator('#food-name').waitFor()
  await page.locator('#food-name').fill('Banana')
  await page.locator('#food-cal').fill('105')
  await page.getByRole('button', { name: 'Add to today' }).click()
  await page.locator('.name', { hasText: 'Banana' }).waitFor()
  assert(await page.locator('.name', { hasText: 'Banana' }).count() > 0, 'Diary still works offline')

  await page.getByRole('link', { name: 'Lift' }).click()
  await page.getByRole('button', { name: 'Add exercise' }).waitFor()
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.locator('#ex-name').fill('Row')
  await page.getByRole('button', { name: 'Add with first set' }).click()
  await page.getByRole('heading', { name: 'Row' }).waitFor()
  assert(await page.getByRole('heading', { name: 'Row' }).count() > 0, 'Workout still works offline')
} catch (err) {
  failures.push(err instanceof Error ? err.stack || err.message : String(err))
  try {
    await page.screenshot({ path: 'scripts/verify-fail.png', fullPage: true })
    console.error('screenshot scripts/verify-fail.png')
    console.error('url', page.url())
    console.error('body snippet', (await page.locator('body').innerText()).slice(0, 800))
  } catch {
    /* ignore debug failures */
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('\nFAILED')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('\nAll UI checks passed')
