export type ActivityType = 'speaking_session' | 'expression_practice' | 'lesson_completed'

export interface ActivityRecord {
  id: string
  type: ActivityType
  date: string // YYYY-MM-DD
  timestamp: number
  detail?: string
}

export interface DayStatus {
  date: string // YYYY-MM-DD
  dayName: string // 'Mon', 'Tue', etc.
  dayShort: string // 'M', 'T', 'W', etc.
  isToday: boolean
  completed: boolean
  count: number
}

export interface StreakStats {
  currentStreak: number
  bestStreak: number
  totalActiveDays: number
  todayCompleted: boolean
  todayCount: number
  dailyGoal: number
  dailyGoalMet: boolean
  weeklyDays: DayStatus[]
  lastActiveDate: string | null
}

export interface WidgetSyncSnapshot {
  currentStreak: number
  bestStreak: number
  todayCompleted: boolean
  dailyGoal: number
  todayCount: number
  weeklyDays: { day: string; active: boolean; isToday: boolean }[]
  lastUpdated: number
}

export const ACTIVITIES_STORE = 'rero.activities.v1'

/**
 * Returns YYYY-MM-DD using local time (not UTC), avoiding timezone off-by-one errors.
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Shifts a YYYY-MM-DD string by a given number of days.
 */
export function shiftDate(dateStr: string, daysDelta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + daysDelta)
  return toLocalDateString(date)
}

/**
 * Returns difference in calendar days (dateA - dateB).
 */
export function diffCalendarDays(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number)
  const [y2, m2, d2] = dateB.split('-').map(Number)
  const utc1 = Date.UTC(y1, m1 - 1, d1)
  const utc2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24))
}

/**
 * Calculates current streak from an array or Set of active YYYY-MM-DD dates.
 * If today has activity: counts today + contiguous previous days.
 * If today has no activity yet: counts contiguous days ending yesterday (streak is preserved until end of today).
 */
export function calculateCurrentStreak(activeDates: Set<string>, todayStr: string = toLocalDateString()): number {
  if (activeDates.size === 0) return 0

  let cursor = todayStr
  let count = 0

  if (activeDates.has(cursor)) {
    while (activeDates.has(cursor)) {
      count++
      cursor = shiftDate(cursor, -1)
    }
    return count
  }

  // Today is not active yet: check if yesterday was active
  const yesterday = shiftDate(todayStr, -1)
  if (activeDates.has(yesterday)) {
    cursor = yesterday
    while (activeDates.has(cursor)) {
      count++
      cursor = shiftDate(cursor, -1)
    }
    return count
  }

  return 0
}

/**
 * Calculates the best (longest) streak across all active dates in history.
 */
export function calculateBestStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0

  const sorted = Array.from(activeDates).sort()
  let maxStreak = 0
  let current = 0
  let prevDate: string | null = null

  for (const date of sorted) {
    if (!prevDate) {
      current = 1
    } else {
      const diff = diffCalendarDays(date, prevDate)
      if (diff === 1) {
        current++
      } else if (diff > 1) {
        current = 1
      }
    }
    if (current > maxStreak) {
      maxStreak = current
    }
    prevDate = date
  }

  return maxStreak
}

/**
 * Generates 7-day weekly status for the week containing today (Monday - Sunday).
 */
export function calculateWeeklyDays(activeDates: Set<string>, todayStr: string = toLocalDateString()): DayStatus[] {
  const [y, m, d] = todayStr.split('-').map(Number)
  const today = new Date(y, m - 1, d)
  
  // In JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday.
  // We want Monday (0) to Sunday (6) in display.
  const currentDayOfWeek = today.getDay()
  const daysSinceMonday = (currentDayOfWeek + 6) % 7 // Monday = 0, Sunday = 6
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysSinceMonday)

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayShorts = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const result: DayStatus[] = []

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const curStr = toLocalDateString(cur)
    const completed = activeDates.has(curStr)
    result.push({
      date: curStr,
      dayName: dayNames[i],
      dayShort: dayShorts[i],
      isToday: curStr === todayStr,
      completed,
      count: completed ? 1 : 0
    })
  }

  return result
}

/**
 * Main calculation engine that unifies historical diary entry dates and recorded activities.
 * Ensures multiple activities on the same date count as 1 streak day.
 */
export function calculateStreakStats(
  entryDates: string[],
  activities: ActivityRecord[],
  dailyGoal: number = 1,
  todayStr: string = toLocalDateString()
): StreakStats {
  const activeDates = new Set<string>()

  // 1. Add valid entry dates (from Speaking Diary)
  for (const d of entryDates) {
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      activeDates.add(d)
    }
  }

  // 2. Add activity dates (speaking, expressions, lessons)
  let todayCount = 0
  for (const act of activities) {
    if (act.date && /^\d{4}-\d{2}-\d{2}$/.test(act.date)) {
      activeDates.add(act.date)
      if (act.date === todayStr) {
        todayCount++
      }
    }
  }

  // Count entry dates today if not already counted via activities
  const entryCountToday = entryDates.filter(d => d === todayStr).length
  const totalTodayActions = Math.max(todayCount, entryCountToday)

  const currentStreak = calculateCurrentStreak(activeDates, todayStr)
  const bestStreak = Math.max(calculateBestStreak(activeDates), currentStreak)
  const weeklyDays = calculateWeeklyDays(activeDates, todayStr)
  const todayCompleted = activeDates.has(todayStr)
  const dailyGoalMet = totalTodayActions >= dailyGoal

  // Determine last active date
  let lastActiveDate: string | null = null
  if (activeDates.size > 0) {
    const sorted = Array.from(activeDates).sort()
    lastActiveDate = sorted[sorted.length - 1]
  }

  return {
    currentStreak,
    bestStreak,
    totalActiveDays: activeDates.size,
    todayCompleted,
    todayCount: totalTodayActions,
    dailyGoal,
    dailyGoalMet,
    weeklyDays,
    lastActiveDate
  }
}

/**
 * Builds the widget synchronization snapshot without any sensitive or diary text.
 */
export function createWidgetSnapshot(stats: StreakStats): WidgetSyncSnapshot {
  return {
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    todayCompleted: stats.todayCompleted,
    dailyGoal: stats.dailyGoal,
    todayCount: stats.todayCount,
    weeklyDays: stats.weeklyDays.map(d => ({
      day: d.dayShort,
      active: d.completed,
      isToday: d.isToday
    })),
    lastUpdated: Date.now()
  }
}
