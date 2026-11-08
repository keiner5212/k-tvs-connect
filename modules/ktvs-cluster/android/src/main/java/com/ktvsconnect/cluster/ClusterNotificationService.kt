package com.ktvsconnect.cluster

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Reads the notifications of the phone so the cluster can show the name of the
 * caller and the title of the song. The user has to give the app the access
 * to the notifications in the system settings.
 */
class ClusterNotificationService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) {
      return
    }
    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText =
        extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val packageName = sbn.packageName ?: return
    val album = extras.getCharSequence("android.media.extra.ALBUM")?.toString().orEmpty()
    val isCall = extras.getString("android.intent.extra.NOTIFICATION_CATEGORY") == "call"
    val isMedia = extras.containsKey(android.app.Notification.EXTRA_MEDIA_SESSION)

    ClusterModule.emitNotification(
        mapOf(
            "package" to packageName,
            "title" to title,
            "text" to if (bigText.isNotEmpty()) bigText else text,
            "album" to album,
            "isCall" to isCall,
            "isMedia" to isMedia,
        )
    )
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    if (sbn == null) {
      return
    }
    ClusterModule.emitNotification(
        mapOf(
            "package" to (sbn.packageName ?: return),
            "title" to "",
            "text" to "",
            "album" to "",
            "isCall" to false,
            "isMedia" to false,
        )
    )
  }
}
