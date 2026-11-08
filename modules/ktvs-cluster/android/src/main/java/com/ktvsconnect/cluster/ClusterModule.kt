package com.ktvsconnect.cluster

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

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
      true
    }

    AsyncFunction("stopService") {
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      context.stopService(Intent(context, ClusterService::class.java))
      true
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
     * True when the phone already shares a key with the cluster. The original
     * app bonds the cluster before it writes to it, and a cluster that is not
     * bonded never answers the gatt connect.
     */
    AsyncFunction("isBonded") { macAddress: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      remoteDevice(context, macAddress).bondState == BluetoothDevice.BOND_BONDED
    }

    /**
     * Asks android for the pairing with the cluster and waits for the answer.
     * The system shows the pairing dialog, so the rider has to accept it.
     */
    AsyncFunction("bondDevice") { macAddress: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("no react context")
      val device = remoteDevice(context, macAddress)
      if (device.bondState == BluetoothDevice.BOND_BONDED) {
        return@AsyncFunction true
      }

      val latch = CountDownLatch(1)
      var bonded = false
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action != BluetoothDevice.ACTION_BOND_STATE_CHANGED) {
            return
          }
          val state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)
          if (state == BluetoothDevice.BOND_BONDED) {
            bonded = true
            latch.countDown()
          } else if (state == BluetoothDevice.BOND_NONE) {
            latch.countDown()
          }
        }
      }
      context.registerReceiver(
        receiver,
        IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
      )
      try {
        if (!device.createBond()) {
          return@AsyncFunction false
        }
        latch.await(BOND_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        bonded
      } finally {
        context.unregisterReceiver(receiver)
      }
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

  private fun remoteDevice(context: Context, macAddress: String): BluetoothDevice {
    val manager = context.getSystemService(BluetoothManager::class.java)
      ?: throw IllegalStateException("no bluetooth manager")
    val adapter = manager.adapter ?: throw IllegalStateException("no bluetooth adapter")
    return adapter.getRemoteDevice(macAddress)
  }

  companion object {
    private const val LOG_FILE_NAME = "ktvs-connect.log"
    private const val MAX_LOG_BYTES = 1024L * 1024L
    private const val MAX_LOG_LINES = 4000
    private const val BOND_TIMEOUT_SECONDS = 45L

    private var notificationListener: ((Map<String, Any>) -> Unit)? = null

    /** The notification service sends what it reads through here. */
    fun emitNotification(payload: Map<String, Any>) {
      notificationListener?.invoke(payload)
    }
  }
}
