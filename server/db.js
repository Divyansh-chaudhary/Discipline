import mongoose from 'mongoose'

export let dbReady = false
export let dbError = null

export async function connectDb(uri) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 20000,
    // Serverless invocations are short-lived and single-request; a small pool
    // connects faster and avoids exhausting Atlas connection limits.
    maxPoolSize: 5,
    minPoolSize: 0,
  })
  dbReady = true
  dbError = null
}

export function markDbDown(err) {
  dbReady = false
  dbError = err instanceof Error ? err.message : String(err)
}
