package com.ktvsconnect.cluster

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ClusterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KtvsCluster")

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
  }
}
