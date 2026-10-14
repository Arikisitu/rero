package com.rero.app.recording

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class RecordingActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_STOP_SAVE = "com.rero.app.recording.ACTION_STOP_SAVE"
        const val ACTION_STOP_DISCARD = "com.rero.app.recording.ACTION_STOP_DISCARD"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val serviceIntent = Intent(context, AudioRecordingService::class.java).apply {
            this.action = action
        }
        context.startService(serviceIntent)
    }
}
