# Discipline

Calorie, macro, and workout diary. **MongoDB Atlas is the source of truth.** The browser talks only to a local Node API (`/api`); it never connects to MongoDB directly.

## Run

```bash
cp .env.example .env   # then put your Atlas URI and JWT_SECRET in .env (gitignored)
npm install
npm run dev
```

That starts Vite and the Express API together. Open the Vite URL (usually `http://localhost:5173`), register an account, and log food.

- Atlas URI lives **only** in `.env` (already gitignored). Never put it in frontend code.
- If Mongoose cannot connect, allow your current IP — or `0.0.0.0/0` for development — in Atlas **Network Access**.
- USDA search still needs `VITE_USDA_API_KEY` in `.env` and a network connection.

## Offline

IndexedDB keeps an **outbox of pending mutations only**. While offline you can still write; the header shows `Offline · N queued`. When you are back online the queue drains in order and the chip shows `Syncing…` then `Synced`.
