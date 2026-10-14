package com.rero.app.recording

import android.content.Context
import android.content.SharedPreferences

object AudioRecordingStorage {
    private const val PREFS_NAME = "rero_recording_prefs"
    private const val KEY_IS_RECORDING = "is_recording"
    private const val KEY_START_TIME = "start_time_ms"
    private const val KEY_AUDIO_PATH = "current_audio_path"
    private const val KEY_LAST_ACTION = "last_action"
    private const val KEY_DURATION_MS = "last_duration_ms"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun setRecordingStarted(context: Context, audioPath: String, startTimeMs: Long) {
        getPrefs(context).edit()
            .putBoolean(KEY_IS_RECORDING, true)
            .putLong(KEY_START_TIME, startTimeMs)
            .putString(KEY_AUDIO_PATH, audioPath)
            .putString(KEY_LAST_ACTION, "")
            .putLong(KEY_DURATION_MS, 0L)
            .apply()
    }

    fun setRecordingStopped(context: Context, action: String, durationMs: Long) {
        getPrefs(context).edit()
            .putBoolean(KEY_IS_RECORDING, false)
            .putString(KEY_LAST_ACTION, action)
            .putLong(KEY_DURATION_MS, durationMs)
            .apply()
    }

    fun isRecording(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IS_RECORDING, false)
    }

    fun getStartTimeMs(context: Context): Long {
        return getPrefs(context).getLong(KEY_START_TIME, 0L)
    }

    fun getCurrentAudioPath(context: Context): String {
        return getPrefs(context).getString(KEY_AUDIO_PATH, "") ?: ""
    }

    fun getLastAction(context: Context): String {
        return getPrefs(context).getString(KEY_LAST_ACTION, "") ?: ""
    }

    fun getLastDurationMs(context: Context): Long {
        return getPrefs(context).getLong(KEY_DURATION_MS, 0L)
    }

    fun clear(context: Context) {
        getPrefs(context).edit().clear().apply()
    }
}
