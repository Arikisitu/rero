package com.rero.app.widget

import android.content.Context
import android.content.SharedPreferences
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

data class WeeklyDayItem(
    val day: String,
    val active: Boolean,
    val isToday: Boolean
)

object WidgetStorage {
    private const val PREFS_NAME = "rero_widget_prefs"
    private const val KEY_CURRENT_STREAK = "current_streak"
    private const val KEY_BEST_STREAK = "best_streak"
    private const val KEY_TODAY_COMPLETED = "today_completed"
    private const val KEY_TODAY_COUNT = "today_count"
    private const val KEY_DAILY_GOAL = "daily_goal"
    private const val KEY_WEEKLY_DAYS = "weekly_days_json"
    private const val KEY_LAST_UPDATED = "last_updated"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun saveWidgetData(
        context: Context,
        currentStreak: Int,
        bestStreak: Int,
        todayCompleted: Boolean,
        todayCount: Int,
        dailyGoal: Int,
        weeklyDaysJson: String
    ) {
        getPrefs(context).edit()
            .putInt(KEY_CURRENT_STREAK, currentStreak)
            .putInt(KEY_BEST_STREAK, bestStreak)
            .putBoolean(KEY_TODAY_COMPLETED, todayCompleted)
            .putInt(KEY_TODAY_COUNT, todayCount)
            .putInt(KEY_DAILY_GOAL, dailyGoal)
            .putString(KEY_WEEKLY_DAYS, weeklyDaysJson)
            .putLong(KEY_LAST_UPDATED, System.currentTimeMillis())
            .apply()
    }

    fun getCurrentStreak(context: Context): Int {
        return getPrefs(context).getInt(KEY_CURRENT_STREAK, 0)
    }

    fun getBestStreak(context: Context): Int {
        return getPrefs(context).getInt(KEY_BEST_STREAK, 0)
    }

    fun isTodayCompleted(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_TODAY_COMPLETED, false)
    }

    fun getTodayCount(context: Context): Int {
        return getPrefs(context).getInt(KEY_TODAY_COUNT, 0)
    }

    fun getDailyGoal(context: Context): Int {
        return getPrefs(context).getInt(KEY_DAILY_GOAL, 1)
    }

    fun getWeeklyDays(context: Context): List<WeeklyDayItem> {
        val jsonStr = getPrefs(context).getString(KEY_WEEKLY_DAYS, "[]") ?: "[]"
        val list = mutableListOf<WeeklyDayItem>()
        try {
            val arr = JSONArray(jsonStr)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val day = obj.optString("day", "")
                val active = obj.optBoolean("active", false)
                val isToday = obj.optBoolean("isToday", false)
                list.add(WeeklyDayItem(day, active, isToday))
            }
        } catch (_: Exception) {
            // Fallback default 7 days
            val fallbackDays = listOf("M", "T", "W", "T", "F", "S", "S")
            fallbackDays.forEach { list.add(WeeklyDayItem(it, false, false)) }
        }
        return list
    }

    fun getWidgetData(context: Context): JSObject {
        val prefs = getPrefs(context)
        val obj = JSObject()
        obj.put("currentStreak", prefs.getInt(KEY_CURRENT_STREAK, 0))
        obj.put("bestStreak", prefs.getInt(KEY_BEST_STREAK, 0))
        obj.put("todayCompleted", prefs.getBoolean(KEY_TODAY_COMPLETED, false))
        obj.put("todayCount", prefs.getInt(KEY_TODAY_COUNT, 0))
        obj.put("dailyGoal", prefs.getInt(KEY_DAILY_GOAL, 1))
        obj.put("lastUpdated", prefs.getLong(KEY_LAST_UPDATED, 0L))
        try {
            val arr = JSONArray(prefs.getString(KEY_WEEKLY_DAYS, "[]") ?: "[]")
            val jsArr = JSArray()
            for (i in 0 until arr.length()) {
                jsArr.put(arr.getJSONObject(i))
            }
            obj.put("weeklyDays", jsArr)
        } catch (_: Exception) {
            obj.put("weeklyDays", JSArray())
        }
        return obj
    }
}
