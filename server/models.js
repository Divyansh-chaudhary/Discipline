import mongoose from 'mongoose'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
)

const settingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    calories: { type: Number, default: 2200 },
    protein: { type: Number, default: 150 },
    carbs: { type: Number, default: 250 },
    fat: { type: Number, default: 70 },
  },
  { timestamps: true },
)

const customFoodSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    servingLabel: { type: String, default: '1 serving' },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    source: { type: String, default: 'custom' },
    fdcId: { type: Number, default: null },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
)
customFoodSchema.index({ userId: 1, name: 1 })

const foodLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    name: { type: String, required: true },
    servings: { type: Number, default: 1 },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    source: { type: String, default: 'manual' },
    customFoodId: { type: String, default: null },
    fdcId: { type: Number, default: null },
  },
  { timestamps: true },
)
foodLogSchema.index({ userId: 1, date: 1 })

const workoutSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    name: { type: String, default: 'Session' },
    completedAt: { type: Number, default: null },
  },
  { timestamps: true },
)
workoutSchema.index({ userId: 1, date: 1 }, { unique: true })

const workoutSetSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    workoutId: { type: String, required: true, index: true },
    date: { type: String, default: '' },
    exercise: { type: String, required: true },
    reps: { type: Number, default: 0 },
    weight: { type: Number, default: 0 },
    setNumber: { type: Number, default: 1 },
  },
  { timestamps: true },
)
workoutSetSchema.index({ userId: 1, workoutId: 1 })

const plannedExerciseSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    sets: { type: Number, default: 3 },
    reps: { type: Number, default: 8 },
    weight: { type: Number, default: 0 },
  },
  { _id: false },
)

const workoutSplitSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    exercises: { type: [plannedExerciseSchema], default: [] },
  },
  { _id: false },
)

/** A weekly routine such as PPL or Upper / Lower, holding its own splits. */
const workoutTypeSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    active: { type: Boolean, default: false },
    splits: { type: [workoutSplitSchema], default: [] },
  },
  { timestamps: true },
)
workoutTypeSchema.index({ userId: 1, name: 1 })

/** Superseded by WorkoutType; still read once to migrate existing rows. */
const legacyTemplateSchema = new Schema(
  { _id: String, userId: String, name: String, exercises: [Schema.Types.Mixed], days: [Schema.Types.Mixed] },
  { strict: false },
)

const streakSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    id: { type: String, required: true },
    lastActiveDate: { type: String, default: null },
    current: { type: Number, default: 0 },
    best: { type: Number, default: 0 },
  },
  { timestamps: true },
)
streakSchema.index({ userId: 1, id: 1 }, { unique: true })

const profileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    key: { type: String, default: 'xp' },
    totalXp: { type: Number, default: 0 },
  },
  { timestamps: true },
)

const badgeSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    id: { type: String, required: true },
    unlockedAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: true },
)
badgeSchema.index({ userId: 1, id: 1 }, { unique: true })

const pulseDaySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    food: { type: Boolean, default: false },
    lift: { type: Boolean, default: false },
    protein: { type: Boolean, default: false },
    calories: { type: Boolean, default: false },
    starXp: { type: Schema.Types.Mixed, default: {} },
    streakXp: { type: Schema.Types.Mixed, default: {} },
    perfectXp: { type: Boolean, default: false },
  },
  { timestamps: true },
)
pulseDaySchema.index({ userId: 1, date: 1 }, { unique: true })

export const User = mongoose.model('User', userSchema)
export const Settings = mongoose.model('Settings', settingsSchema)
export const CustomFood = mongoose.model('CustomFood', customFoodSchema)
export const FoodLog = mongoose.model('FoodLog', foodLogSchema)
export const Workout = mongoose.model('Workout', workoutSchema)
export const WorkoutSet = mongoose.model('WorkoutSet', workoutSetSchema)
export const WorkoutType = mongoose.model('WorkoutType', workoutTypeSchema)
export const LegacyWorkoutTemplate = mongoose.model('WorkoutTemplate', legacyTemplateSchema)
export const Streak = mongoose.model('Streak', streakSchema)
export const Profile = mongoose.model('Profile', profileSchema)
export const Badge = mongoose.model('Badge', badgeSchema)
export const PulseDay = mongoose.model('PulseDay', pulseDaySchema)
