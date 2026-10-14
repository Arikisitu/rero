package com.rero.app.widget

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "StreakWidgetPlugin")
class StreakWidgetPlugin : Plugin() {

    @PluginMethod
    fun updateWidgetData(call: PluginCall) {
        val currentStreak = call.getInt("currentStreak") ?: 0
        val bestStreak = call.getInt("bestStreak") ?: 0
        val todayCompleted = call.getBoolean("todayCompleted") ?: false
        val todayCount = call.getInt("todayCount") ?: 0
        val dailyGoal = call.getInt("dailyGoal") ?: 1
        val weeklyDaysJson = call.getString("weeklyDaysJson") ?: "[]"

        WidgetStorage.saveWidgetData(
            context,
            currentStreak,
            bestStreak,
            todayCompleted,
            todayCount,
            dailyGoal,
            weeklyDaysJson
        )

        // Trigger remote widget views update
        StreakWidgetProvider.updateAllWidgets(context)
        WeeklyProgressWidgetProvider.updateAllWidgets(context)

        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun getWidgetData(call: PluginCall) {
        val data = WidgetStorage.getWidgetData(context)
        call.resolve(data)
    }

    @PluginMethod
    fun getInitialRoute(call: PluginCall) {
        val intent = activity?.intent
        val route = intent?.getStringExtra("rero_route") ?: ""
        // Clear route once retrieved so back-navigation doesn't re-trigger it
        intent?.removeExtra("rero_route")

        val ret = JSObject()
        ret.put("route", route)
        call.resolve(ret)
    }
}
