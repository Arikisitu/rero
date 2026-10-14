import { describe, expect, it } from 'vitest'
import {
  calculateBestStreak,
  calculateCurrentStreak,
  calculateStreakStats,
  calculateWeeklyDays,
  createWidgetSnapshot,
  diffCalendarDays,
  shiftDate,
  toLocalDateString,
  type ActivityRecord
} from './streak'

describe('Activity and Streak Engine', () => {
  it('correctly shifts calendar dates across month and year boundaries', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29') // Leap year
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31') // Year boundary
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('calculates calendar day differences accurately', () => {
    expect(diffCalendarDays('2026-10-14', '2026-10-13')).toBe(1)
    expect(diffCalendarDays('2026-10-14', '2026-10-14')).toBe(0)
    expect(diffCalendarDays('2026-10-01', '2026-09-30')).toBe(1)
  })

  it('calculates current streak when active today', () => {
    const dates = new Set(['2026-10-12', '2026-10-13', '2026-10-14'])
    const streak = calculateCurrentStreak(dates, '2026-10-14')
    expect(streak).toBe(3)
  })

  it('preserves current streak when active yesterday and today has not been done yet', () => {
    const dates = new Set(['2026-10-11', '2026-10-12', '2026-10-13'])
    // Today is 2026-10-14, which hasn't been done yet
    const streak = calculateCurrentStreak(dates, '2026-10-14')
    expect(streak).toBe(3)
  })

  it('resets current streak to 0 if neither today nor yesterday had activity', () => {
    const dates = new Set(['2026-10-10', '2026-10-11'])
    // Today is 2026-10-14, last active was 10-11 (missed 10-12 and 10-13)
    const streak = calculateCurrentStreak(dates, '2026-10-14')
    expect(streak).toBe(0)
  })

  it('counts multiple activities on the same date as ONE streak day', () => {
    const activities: ActivityRecord[] = [
      { id: '1', type: 'speaking_session', date: '2026-10-14', timestamp: 1000 },
      { id: '2', type: 'expression_practice', date: '2026-10-14', timestamp: 2000 },
      { id: '3', type: 'lesson_completed', date: '2026-10-14', timestamp: 3000 }
    ]
    const stats = calculateStreakStats([], activities, 1, '2026-10-14')
    expect(stats.currentStreak).toBe(1)
    expect(stats.totalActiveDays).toBe(1)
    expect(stats.todayCount).toBe(3)
    expect(stats.todayCompleted).toBe(true)
    expect(stats.dailyGoalMet).toBe(true)
  })

  it('merges existing diary entries and new activities into unified streak stats', () => {
    const entryDates = ['2026-10-12', '2026-10-13']
    const activities: ActivityRecord[] = [
      { id: '1', type: 'lesson_completed', date: '2026-10-14', timestamp: 1000 }
    ]
    const stats = calculateStreakStats(entryDates, activities, 1, '2026-10-14')
    expect(stats.currentStreak).toBe(3)
    expect(stats.bestStreak).toBe(3)
    expect(stats.totalActiveDays).toBe(3)
  })

  it('calculates the best streak across historical gaps', () => {
    // Streak 1: 4 days (Sept 1 to 4)
    // Streak 2: 2 days (Sept 10 to 11)
    // Streak 3: 3 days (Sept 20 to 22)
    const dates = new Set([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
      '2026-09-10', '2026-09-11',
      '2026-09-20', '2026-09-21', '2026-09-22'
    ])
    expect(calculateBestStreak(dates)).toBe(4)
  })

  it('calculates 7-day weekly activity array with correct day names', () => {
    // 2026-10-14 is Wednesday
    const dates = new Set(['2026-10-12', '2026-10-14']) // Mon & Wed active
    const weekly = calculateWeeklyDays(dates, '2026-10-14')
    expect(weekly).toHaveLength(7)
    expect(weekly[0].dayName).toBe('Mon')
    expect(weekly[0].completed).toBe(true)
    expect(weekly[1].dayName).toBe('Tue')
    expect(weekly[1].completed).toBe(false)
    expect(weekly[2].dayName).toBe('Wed')
    expect(weekly[2].completed).toBe(true)
    expect(weekly[2].isToday).toBe(true)
  })

  it('creates widget snapshots that omit transcripts and personal data', () => {
    const stats = calculateStreakStats(['2026-10-14'], [], 1, '2026-10-14')
    const snapshot = createWidgetSnapshot(stats)

    expect(snapshot.currentStreak).toBe(1)
    expect(snapshot.todayCompleted).toBe(true)
    expect(snapshot.weeklyDays).toHaveLength(7)
    expect(snapshot).not.toHaveProperty('transcripts')
    expect(snapshot).not.toHaveProperty('text')
    expect(snapshot).not.toHaveProperty('entries')
  })

  it('formats local date correctly', () => {
    const date = new Date(2026, 9, 14, 15, 30, 0) // Oct 14, 2026 local time
    expect(toLocalDateString(date)).toBe('2026-10-14')
  })

  it('migrates legacy users seamlessly when activities array is empty', () => {
    // Legacy user with 5 consecutive diary entries from previous days
    const legacyEntries = [
      '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'
    ]
    const stats = calculateStreakStats(legacyEntries, [], 1, '2026-10-14')
    expect(stats.currentStreak).toBe(5)
    expect(stats.bestStreak).toBe(5)
    expect(stats.totalActiveDays).toBe(5)
    expect(stats.todayCompleted).toBe(true)
  })

  it('supports full JSON backup and restore round-trip including activities', () => {
    const backupData = {
      version: 2,
      exportedAt: '2026-10-14T12:00:00.000Z',
      entries: [
        { id: 'e1', title: 'Morning diary', text: 'Spoke about morning routine', date: '2026-10-14', seconds: 45, expressions: [] }
      ],
      expressions: [
        { id: 'ex1', phrase: 'looking forward to', kind: 'Phrase', learned: true }
      ],
      activities: [
        { id: 'a1', type: 'speaking_session', date: '2026-10-14', timestamp: 1728900000000, detail: 'Morning diary' },
        { id: 'a2', type: 'lesson_completed', date: '2026-10-14', timestamp: 1728900050000, detail: 'Daily Reflection' }
      ]
    }

    const jsonString = JSON.stringify(backupData)
    const parsed = JSON.parse(jsonString)

    expect(parsed.version).toBe(2)
    expect(parsed.activities).toHaveLength(2)
    expect(parsed.activities[0].type).toBe('speaking_session')
    expect(parsed.activities[1].type).toBe('lesson_completed')

    // Verify stats calculated from restored data
    const restoredStats = calculateStreakStats(
      parsed.entries.map((e: { date: string }) => e.date),
      parsed.activities,
      1,
      '2026-10-14'
    )
    expect(restoredStats.currentStreak).toBe(1)
    expect(restoredStats.todayCount).toBe(2)
    expect(restoredStats.todayCompleted).toBe(true)
  })

  it('guarantees widget snapshot timestamp updates for widget refreshes', () => {
    const stats = calculateStreakStats(['2026-10-14'], [], 1, '2026-10-14')
    const before = Date.now()
    const snapshot = createWidgetSnapshot(stats)
    const after = Date.now()

    expect(snapshot.lastUpdated).toBeGreaterThanOrEqual(before)
    expect(snapshot.lastUpdated).toBeLessThanOrEqual(after)
    expect(snapshot.weeklyDays).toHaveLength(7)
    expect(snapshot.weeklyDays.some(d => d.isToday)).toBe(true)
  })
})
