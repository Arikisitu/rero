/**
 * Rero Audio Recorder Bridge
 * Bridges React UI to the native Android background microphone service (Capacitor)
 * with graceful fallback to browser recording on web.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

export interface RecordingState {
  isRecording: boolean
  durationMs: number
  audioFilePath?: string
  action?: 'save' | 'discard' | 'stop'
}

interface AudioRecordingPluginInterface {
  startRecording(): Promise<{ success: boolean; audioFilePath?: string }>
  stopRecording(options: { discard?: boolean }): Promise<{
    success: boolean
    audioFilePath?: string
    durationMs: number
    discarded?: boolean
  }>
  getRecordingState(): Promise<RecordingState>
  deleteAudioFile(options: { filePath: string }): Promise<{ success: boolean }>
  hasPermissions(): Promise<{ granted: boolean }>
  requestPermissions(): Promise<{ granted: boolean }>
}

const AudioRecordingPlugin = registerPlugin<AudioRecordingPluginInterface>(
  'AudioRecordingPlugin',
  {
    web: {
      async startRecording() {
        return { success: true }
      },
      async stopRecording() {
        return { success: true, durationMs: 0, discarded: false }
      },
      async getRecordingState() {
        return { isRecording: false, durationMs: 0 }
      },
      async deleteAudioFile() {
        return { success: true }
      },
      async hasPermissions() {
        return { granted: true }
      },
      async requestPermissions() {
        return { granted: true }
      }
    }
  }
)

export const isNative = Capacitor.isNativePlatform()

/**
 * Starts native foreground audio recording service if on Android,
 * ensuring continuous recording while switching apps or with locked screen.
 */
export async function startNativeAudioRecording(): Promise<{
  success: boolean
  audioFilePath?: string
}> {
  if (!isNative) {
    return { success: true }
  }

  try {
    const perm = await AudioRecordingPlugin.requestPermissions()
    if (!perm.granted) {
      console.warn('Microphone permission not granted for native background service')
      return { success: false }
    }
    return await AudioRecordingPlugin.startRecording()
  } catch (err) {
    console.warn('Native startRecording error:', err)
    return { success: false }
  }
}

/**
 * Stops native background recording service, either saving or discarding.
 */
export async function stopNativeAudioRecording(discard = false): Promise<{
  success: boolean
  audioFilePath?: string
  durationMs: number
  discarded?: boolean
}> {
  if (!isNative) {
    return { success: true, durationMs: 0, discarded: discard }
  }

  try {
    return await AudioRecordingPlugin.stopRecording({ discard })
  } catch (err) {
    console.warn('Native stopRecording error:', err)
    return { success: false, durationMs: 0, discarded: discard }
  }
}

/**
 * Gets native recording status (e.g. if user stopped recording from notification).
 */
export async function getNativeRecordingState(): Promise<RecordingState> {
  if (!isNative) {
    return { isRecording: false, durationMs: 0 }
  }

  try {
    return await AudioRecordingPlugin.getRecordingState()
  } catch (err) {
    console.warn('Native getRecordingState error:', err)
    return { isRecording: false, durationMs: 0 }
  }
}

/**
 * Safely deletes a saved audio file from app-private storage.
 */
export async function deleteNativeAudioFile(filePath: string): Promise<boolean> {
  if (!isNative || !filePath) return true

  try {
    const res = await AudioRecordingPlugin.deleteAudioFile({ filePath })
    return Boolean(res.success)
  } catch (err) {
    console.warn('Native deleteAudioFile error:', err)
    return false
  }
}
