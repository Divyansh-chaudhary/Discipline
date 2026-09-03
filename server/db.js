import mongoose from 'mongoose'

export let dbReady = false
export let dbError = null

export async function connectDb(uri) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  dbReady = true
  dbError = null
}

export function markDbDown(err) {
  dbReady = false
  dbError = err instanceof Error ? err.message : String(err)
}
