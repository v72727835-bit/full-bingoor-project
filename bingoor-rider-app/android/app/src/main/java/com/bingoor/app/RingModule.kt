package com.bingoor.app

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The loud booking / order bell.
 *
 * - [ensureChannel] creates the "ring" notification channel: our long bell sound
 *   on the ALARM stream, so it plays loud even when the phone is on silent, the
 *   screen is off or the app is closed. The server sends every ring push on it.
 * - start()/stop() loop the same bell while the app is open and a ring is showing.
 */
class RingModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "BingoorRing"

  @ReactMethod
  fun start() {
    val app = ctx.applicationContext
    synchronized(lock) {
      if (player?.isPlaying == true) return
      stopLocked(app)
      player = MediaPlayer().apply {
        setAudioAttributes(alarmAudio())
        setDataSource(app, soundUri(app))
        isLooping = true
        setOnPreparedListener { it.start() }
        prepareAsync()
      }
      vibrator(app)?.let { v ->
        val pattern = longArrayOf(0, 800, 500)
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, 0), alarmAudio())
        else @Suppress("DEPRECATION") v.vibrate(pattern, 0)
      }
    }
  }

  @ReactMethod
  fun stop() {
    synchronized(lock) { stopLocked(ctx.applicationContext) }
  }

  /** Ask once to be left out of battery saving, so rings still arrive when the app has been closed for a while. */
  @SuppressLint("BatteryLife")
  @ReactMethod
  fun allowBackgroundRinging() {
    val app = ctx.applicationContext
    val pm = app.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    if (pm.isIgnoringBatteryOptimizations(app.packageName)) return
    // Ask only once per install; the person can still change it later in Settings.
    val prefs = app.getSharedPreferences("bingoor_ring", Context.MODE_PRIVATE)
    if (prefs.getBoolean("asked_battery", false)) return
    prefs.edit().putBoolean("asked_battery", true).apply()
    try {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${app.packageName}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      app.startActivity(intent)
    } catch (_: Exception) {
      // Some phones hide this screen; ringing still works, just less reliably after long idle.
    }
  }

  override fun invalidate() {
    stop()
    super.invalidate()
  }

  companion object {
    /** Bump the id if the sound or importance changes: Android never updates an existing channel. */
    const val CHANNEL_ID = "bingoor_ring_v1"
    private val lock = Any()
    private var player: MediaPlayer? = null

    private fun soundUri(context: Context): Uri = Uri.parse("android.resource://${context.packageName}/raw/bingoor_ring")

    private fun alarmAudio(): AudioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    private fun vibrator(context: Context): Vibrator? =
      if (Build.VERSION.SDK_INT >= 31) (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
      else @Suppress("DEPRECATION") (context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)

    private fun stopLocked(context: Context) {
      player?.let { p ->
        try { if (p.isPlaying) p.stop() } catch (_: Exception) {}
        p.release()
      }
      player = null
      vibrator(context)?.cancel()
    }

    /** Create the ring channel (safe to call on every start). */
    fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return
      val channel = NotificationChannel(CHANNEL_ID, "New bookings & orders (loud bell)", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Rings loudly for a new job until you open the app, even on silent or with the screen off."
        setSound(soundUri(context), alarmAudio())
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 800, 500, 800, 500, 800)
        enableLights(true)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
      }
      nm.createNotificationChannel(channel)
    }
  }
}
