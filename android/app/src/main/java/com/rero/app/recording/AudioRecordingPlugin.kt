package com.rero.app.recording

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File

@CapacitorPlugin(
    name = "AudioRecordingPlugin",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
        )
    ]
)
class AudioRecordingPlugin : Plugin() {

    @PluginMethod
    fun checkAudioPermissions(call: PluginCall) {
        val micGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val ret = JSObject()
        ret.put("granted", micGranted)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestAudioPermissions(call: PluginCall) {
        val micGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (micGranted) {
            val ret = JSObject()
            ret.put("granted", true)
            call.resolve(ret)
            return
        }

        requestPermissionForAlias("microphone", call, "checkMicPermissionCallback")
    }

    @PermissionCallback
    fun checkMicPermissionCallback(call: PluginCall) {
        val micGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val ret = JSObject()
        ret.put("granted", micGranted)
        call.resolve(ret)
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        val micGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (!micGranted) {
            call.reject("Microphone permission not granted")
            return
        }

        val intent = Intent(context, AudioRecordingService::class.java).apply {
            action = AudioRecordingService.ACTION_START
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }

        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        val discard = call.getBoolean("discard", false) ?: false
        val active = AudioRecordingService.activeService

        if (active != null) {
            val path = active.stopRecording(save = !discard)
            val dur = AudioRecordingStorage.getLastDurationMs(context)
            val ret = JSObject()
            ret.put("success", true)
            ret.put("audioFilePath", path ?: "")
            ret.put("durationMs", dur)
            ret.put("discarded", discard)
            call.resolve(ret)
        } else {
            // Service might have been stopped via notification action
            val path = AudioRecordingStorage.getCurrentAudioPath(context)
            val dur = AudioRecordingStorage.getLastDurationMs(context)
            val ret = JSObject()
            ret.put("success", true)
            ret.put("audioFilePath", if (discard) "" else path)
            ret.put("durationMs", dur)
            ret.put("discarded", discard)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun getRecordingState(call: PluginCall) {
        val isRec = AudioRecordingStorage.isRecording(context)
        val startTime = AudioRecordingStorage.getStartTimeMs(context)
        val path = AudioRecordingStorage.getCurrentAudioPath(context)
        val lastAction = AudioRecordingStorage.getLastAction(context)
        val lastDuration = AudioRecordingStorage.getLastDurationMs(context)

        val elapsed = if (isRec && startTime > 0) {
            System.currentTimeMillis() - startTime
        } else {
            lastDuration
        }

        val ret = JSObject()
        ret.put("isRecording", isRec)
        ret.put("durationMs", elapsed)
        ret.put("audioFilePath", path)
        ret.put("action", lastAction)
        call.resolve(ret)
    }

    @PluginMethod
    fun deleteAudioFile(call: PluginCall) {
        val filePath = call.getString("filePath") ?: ""
        if (filePath.isNotBlank()) {
            val file = File(filePath)
            if (file.exists()) {
                file.delete()
            }
        }
        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }
}
