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

class WeeklyProgressWidgetProvider : AppWidgetProvider() {

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
        private val DAY_NAME_IDS = intArrayOf(
            R.id.widget_day_name_0,
            R.id.widget_day_name_1,
            R.id.widget_day_name_2,
            R.id.widget_day_name_3,
            R.id.widget_day_name_4,
            R.id.widget_day_name_5,
            R.id.widget_day_name_6
        )

        private val DAY_DOT_IDS = intArrayOf(
            R.id.widget_day_dot_0,
            R.id.widget_day_dot_1,
            R.id.widget_day_dot_2,
            R.id.widget_day_dot_3,
            R.id.widget_day_dot_4,
            R.id.widget_day_dot_5,
            R.id.widget_day_dot_6
        )

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val currentStreak = WidgetStorage.getCurrentStreak(context)
            val todayCompleted = WidgetStorage.isTodayCompleted(context)
            val weeklyDays = WidgetStorage.getWeeklyDays(context)

            val views = RemoteViews(context.packageName, R.layout.widget_weekly_large)

            val streakUnit = if (currentStreak == 1) "day" else "days"
            views.setTextViewText(
                R.id.widget_large_streak_text,
                "$currentStreak $streakUnit streak"
            )

            if (todayCompleted) {
                views.setTextViewText(
                    R.id.widget_large_status,
                    "✓ Completed today · Keep growing!"
                )
                views.setTextColor(R.id.widget_large_status, Color.parseColor("#258B67"))
            } else {
                views.setTextViewText(
                    R.id.widget_large_status,
                    "🎙️ Practice speaking today"
                )
                views.setTextColor(R.id.widget_large_status, Color.parseColor("#7A7289"))
            }

            // Populate the 7 weekly days
            for (i in 0 until 7) {
                if (i < weeklyDays.size) {
                    val item = weeklyDays[i]
                    views.setTextViewText(DAY_NAME_IDS[i], item.day)

                    if (item.active) {
                        views.setImageViewResource(DAY_DOT_IDS[i], R.drawable.widget_dot_active)
                    } else {
                        views.setImageViewResource(DAY_DOT_IDS[i], R.drawable.widget_dot_inactive)
                    }

                    if (item.isToday) {
                        views.setTextColor(DAY_NAME_IDS[i], Color.parseColor("#6A4FB6"))
                    } else {
                        views.setTextColor(DAY_NAME_IDS[i], Color.parseColor("#7A7289"))
                    }
                }
            }

            // Clicking widget launches Rero directly into Speaking Diary
            val openDiaryIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("rero_route", "Speaking Diary")
            }
            val diaryPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                openDiaryIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_large_root, diaryPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_large_action_btn, diaryPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val component = ComponentName(context, WeeklyProgressWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            for (id in ids) {
                updateAppWidget(context, manager, id)
            }
        }
    }
}
