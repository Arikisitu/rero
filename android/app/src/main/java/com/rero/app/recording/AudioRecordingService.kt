package com.rero.app.recording

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.rero.app.MainActivity
import com.rero.app.R
import java.io.File
import java.io.IOException

class AudioRecordingService : Service() {

    private var mediaRecorder: MediaRecorder? = null
    private var currentOutputFile: File? = null
    private var startTimeMs: Long = 0L
    private var isRecording = false
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null

    companion object {
        const val CHANNEL_ID = "rero_recording_channel"
        const val NOTIFICATION_ID = 4001

        const val ACTION_START = "com.rero.app.recording.ACTION_START"
        const val ACTION_STOP_SAVE = "com.rero.app.recording.ACTION_STOP_SAVE"
        const val ACTION_STOP_DISCARD = "com.rero.app.recording.ACTION_STOP_DISCARD"

        var activeService: AudioRecordingService? = null
            private set
    }

    override fun onCreate() {
        super.onCreate()
        activeService = this
        createNotificationChannel()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        when (action) {
            ACTION_START -> {
                if (!isRecording) {
                    startRecording()
                }
            }
            ACTION_STOP_SAVE -> {
                stopRecording(save = true)
                stopSelf()
            }
            ACTION_STOP_DISCARD -> {
                stopRecording(save = false)
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private fun startRecording() {
        requestAudioFocus()

        try {
            val dir = File(filesDir, "recordings")
            if (!dir.exists()) {
                dir.mkdirs()
            }

            val timestamp = System.currentTimeMillis()
            val file = File(dir, "rero_session_${timestamp}.m4a")
            currentOutputFile = file

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(applicationContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioEncodingBitRate(128000)
            recorder.setAudioSamplingRate(44100)
            recorder.setOutputFile(file.absolutePath)

            recorder.prepare()
            recorder.start()

            mediaRecorder = recorder
            isRecording = true
            startTimeMs = System.currentTimeMillis()

            AudioRecordingStorage.setRecordingStarted(
                this,
                file.absolutePath,
                startTimeMs
            )

            val notification = buildRecordingNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            cleanup()
            stopSelf()
        }
    }

    fun stopRecording(save: Boolean): String? {
        if (!isRecording) {
            return null
        }

        val duration = System.currentTimeMillis() - startTimeMs
        var resultPath: String? = null

        try {
            mediaRecorder?.stop()
        } catch (e: Exception) {
            e.printStackTrace()
        }

        try {
            mediaRecorder?.reset()
            mediaRecorder?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        mediaRecorder = null
        isRecording = false

        abandonAudioFocus()

        val file = currentOutputFile
        if (save && file != null && file.exists() && file.length() > 0) {
            resultPath = file.absolutePath
            AudioRecordingStorage.setRecordingStopped(this, "save", duration)
        } else {
            // Discard
            file?.delete()
            currentOutputFile = null
            AudioRecordingStorage.setRecordingStopped(this, "discard", duration)
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        return resultPath
    }

    private fun buildRecordingNotification(): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("rero_route", "Speaking Diary")
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val saveIntent = Intent(this, RecordingActionReceiver::class.java).apply {
            action = RecordingActionReceiver.ACTION_STOP_SAVE
        }
        val savePendingIntent = PendingIntent.getBroadcast(
            this,
            1,
            saveIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val discardIntent = Intent(this, RecordingActionReceiver::class.java).apply {
            action = RecordingActionReceiver.ACTION_STOP_DISCARD
        }
        val discardPendingIntent = PendingIntent.getBroadcast(
            this,
            2,
            discardIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🎙️ Rero Speaking Session")
            .setContentText("Recording in background · Tap to open")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(contentPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_save, "Stop & Save", savePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Discard", discardPendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rero Recording Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows recording controls and status while speaking"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun requestAudioFocus() {
        val manager = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(attr)
                .setOnAudioFocusChangeListener { focusChange ->
                    if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
                        // Incoming call or permanent audio focus loss: safely save current audio
                        stopRecording(save = true)
                        stopSelf()
                    }
                }
                .build()
            focusRequest = request
            manager.requestAudioFocus(request)
        }
    }

    private fun abandonAudioFocus() {
        val manager = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { manager.abandonAudioFocusRequest(it) }
            focusRequest = null
        }
    }

    private fun cleanup() {
        try {
            mediaRecorder?.reset()
            mediaRecorder?.release()
        } catch (_: Exception) {}
        mediaRecorder = null
        isRecording = false
        abandonAudioFocus()
    }

    override fun onDestroy() {
        super.onDestroy()
        activeService = null
        cleanup()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
