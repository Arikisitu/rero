import { Capacitor, registerPlugin } from '@capacitor/core'
import type { WidgetSyncSnapshot } from './streak'

export interface StreakWidgetPluginInterface {
  updateWidgetData(options: {
    currentStreak: number
    bestStreak: number
    todayCompleted: boolean
    todayCount: number
    dailyGoal: number
    weeklyDaysJson: string
  }): Promise<{ success: boolean }>
  getWidgetData(): Promise<unknown>
  getInitialRoute(): Promise<{ route: string }>
}

export const StreakWidget = registerPlugin<StreakWidgetPluginInterface>('StreakWidgetPlugin')

/**
 * Syncs non-sensitive streak stats to native SharedPreferences for Android widgets.
 * Never includes diary transcripts or personal text.
 */
export async function syncWidgetWithStats(snapshot: WidgetSyncSnapshot): Promise<void> {
  // Store locally in browser for offline inspection & verification
  try {
    localStorage.setItem('rero.widget.snapshot.v1', JSON.stringify(snapshot))
  } catch {
    // ignore
  }

  if (!Capacitor.isNativePlatform()) {
    return
  }

  try {
    await StreakWidget.updateWidgetData({
      currentStreak: snapshot.currentStreak,
      bestStreak: snapshot.bestStreak,
      todayCompleted: snapshot.todayCompleted,
      todayCount: snapshot.todayCount,
      dailyGoal: snapshot.dailyGoal,
      weeklyDaysJson: JSON.stringify(snapshot.weeklyDays)
    })
  } catch (error) {
    console.warn('Could not sync data to native widget:', error)
  }
}

/**
 * Checks if the Android app was launched via a widget tap that specified a target screen.
 */
export async function checkInitialWidgetRoute(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const res = await StreakWidget.getInitialRoute()
    return res?.route || null
  } catch {
    return null
  }
}
