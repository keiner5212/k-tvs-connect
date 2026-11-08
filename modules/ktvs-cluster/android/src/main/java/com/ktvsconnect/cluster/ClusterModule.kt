package com.ktvsconnect.cluster

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ClusterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KtvsCluster")

    Events("notification")

    OnCreate {
      notificationListener = { payload -> sendEvent("notification", payload) }
    }

    OnDestroy {
      notificationListener = null
    }

    AsyncFunction("startService") { title: String, text: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      val intent = Intent(context, ClusterService::class.java)
      intent.putExtra(ClusterService.EXTRA_TITLE, title)
      intent.putExtra(ClusterService.EXTRA_TEXT, text)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    AsyncFunction("stopService") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      context.stopService(Intent(context, ClusterService::class.java))
    }

    AsyncFunction("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    AsyncFunction("openBatteryOptimizationSettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        intent.data = Uri.parse("package:${context.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      } catch (error: android.content.ActivityNotFoundException) {
        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(fallback)
      }
      true
    }

    /**
     * The log of a ride has to survive the app being closed, and it has to be
     * readable from a computer, so it goes to the external files folder.
     */
    AsyncFunction("appendLog") { line: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      val file = logFile(context)
      file.appendText(line + "\n")
      if (file.length() > MAX_LOG_BYTES) {
        val kept = file.readLines().takeLast(MAX_LOG_LINES)
        file.writeText(kept.joinToString("\n") + "\n")
      }
      true
    }

    AsyncFunction("readLog") { maxLines: Int ->
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      val file = logFile(context)
      if (!file.exists()) {
        return@AsyncFunction ""
      }
      file.readLines().takeLast(maxLines).joinToString("\n")
    }

    AsyncFunction("clearLog") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      logFile(context).delete()
      true
    }

    /** True when the user let the app read the notifications of the phone. */
    AsyncFunction("isNotificationAccessGranted") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    AsyncFunction("openNotificationAccessSettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }

  private fun logFile(context: Context): java.io.File {
    val folder = context.getExternalFilesDir(null) ?: context.filesDir
    if (!folder.exists()) {
      folder.mkdirs()
    }
    return java.io.File(folder, LOG_FILE_NAME)
  }

  companion object {
    private const val LOG_FILE_NAME = "ktvs-connect.log"
    private const val MAX_LOG_BYTES = 1024L * 1024L
    private const val MAX_LOG_LINES = 4000

    private var notificationListener: ((Map<String, Any>) -> Unit)? = null

    /** The notification service sends what it reads through here. */
    fun emitNotification(payload: Map<String, Any>) {
      notificationListener?.invoke(payload)
    }
  }
}
