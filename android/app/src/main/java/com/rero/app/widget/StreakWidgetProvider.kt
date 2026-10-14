package com.rero.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import com.rero.app.MainActivity
import com.rero.app.R

class StreakWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val currentStreak = WidgetStorage.getCurrentStreak(context)
            val todayCompleted = WidgetStorage.isTodayCompleted(context)

            val views = RemoteViews(context.packageName, R.layout.widget_streak_compact)
            views.setTextViewText(R.id.widget_streak_number, currentStreak.toString())
            views.setTextViewText(
                R.id.widget_streak_unit,
                if (currentStreak == 1) "day" else "days"
            )

            if (todayCompleted) {
                views.setTextViewText(R.id.widget_streak_status, "✓ Completed today")
                views.setTextColor(R.id.widget_streak_status, Color.parseColor("#258B67"))
            } else {
                views.setTextViewText(R.id.widget_streak_status, "Speak today →")
                views.setTextColor(R.id.widget_streak_status, Color.parseColor("#6A4FB6"))
            }

            // Clicking widget launches Rero directly into Speaking Diary
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("rero_route", "Speaking Diary")
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_compact_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val component = ComponentName(context, StreakWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            for (id in ids) {
                updateAppWidget(context, manager, id)
            }
        }
    }
}
