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
        val active = AudioRecordingService.activeService
        if (active != null) {
            when (action) {
                ACTION_STOP_SAVE -> {
                    active.stopRecording(save = true)
                    active.stopSelf()
                }
                ACTION_STOP_DISCARD -> {
                    active.stopRecording(save = false)
                    active.stopSelf()
                }
            }
        } else {
            val serviceIntent = Intent(context, AudioRecordingService::class.java).apply {
                this.action = action
            }
            try {
                context.startService(serviceIntent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
