package com.chadm.ledu.sport

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.speech.tts.TextToSpeech
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * "Record" tab: live GPS tracking with start/stop, per-km voice
 * announcements (TTS), running / cycling toggle, and a live track preview.
 * Recording state lives in SportViewModel so it survives rotation.
 */
@Composable
fun SportRecordScreen(
    onOpenWorkout: (String) -> Unit,
    vm: SportViewModel = viewModel(),
) {
    val context = LocalContext.current
    val state by vm.recorder.state.collectAsState()
    var sport by rememberSaveable { mutableStateOf("run") }

    fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    var permissionGranted by remember { mutableStateOf(hasLocationPermission()) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        permissionGranted = result.values.any { it }
    }

    // TTS for per-km announcements; falls back to the on-screen list silently.
    var ttsReady by remember { mutableStateOf(false) }
    val tts = remember {
        var instance: TextToSpeech? = null
        instance = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                runCatching { instance?.language = Locale.CHINA }
                ttsReady = true
            }
        }
        instance
    }
    DisposableEffect(Unit) {
        onDispose {
            runCatching { tts?.shutdown() }
        }
    }
    LaunchedEffect(state.announcements.size) {
        val latest = state.announcements.lastOrNull() ?: return@LaunchedEffect
        if (ttsReady) {
            runCatching { tts?.speak(latest, TextToSpeech.QUEUE_FLUSH, null, latest) }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        Spacer(Modifier.height(12.dp))
        if (state.status == WorkoutRecorder.Status.IDLE) {
            Text(
                "选择运动类型，开始后自动记录轨迹并每公里报时",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FilterChip(
                    selected = sport == "run",
                    onClick = { sport = "run" },
                    label = { Text("跑步") },
                )
                FilterChip(
                    selected = sport == "cycling",
                    onClick = { sport = "cycling" },
                    label = { Text("骑行") },
                )
            }
            Spacer(Modifier.height(28.dp))
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .clickable {
                            if (!permissionGranted) {
                                permissionLauncher.launch(
                                    arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION,
                                    ),
                                )
                            } else {
                                vm.recorder.start(sport)
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(44.dp),
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "开始${if (sport == "run") "跑步" else "骑行"}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
            }
        } else {
            // ---- Live recording panel ----
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "距离",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            if (state.distanceM >= 100) String.format("%.2f", state.distanceM / 1000.0) else "--",
                            style = MaterialTheme.typography.displayMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            softWrap = false,
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            if (state.distanceM >= 100) "公里" else "",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        LiveStat("时间", formatDuration(state.elapsedSec))
                        val avgPace = if (state.distanceM >= 100) (state.elapsedSec * 1000.0 / state.distanceM).toInt() else 0
                        LiveStat(
                            if (state.sport == "cycling") "均速" else "配速",
                            if (avgPace > 0) {
                                if (state.sport == "cycling") String.format("%.1f 公里/时", 3600.0 / avgPace)
                                else String.format("%02d'%02d''", avgPace / 60, avgPace % 60)
                            } else "--",
                        )
                        LiveStat("GPS", "${state.fixCount} 点")
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Card(modifier = Modifier.fillMaxWidth()) {
                Box(modifier = Modifier.height(260.dp).fillMaxWidth()) {
                    TrackMap(points = state.points, follow = true, modifier = Modifier.fillMaxSize())
                }
            }
            if (state.announcements.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text("每公里报时", style = MaterialTheme.typography.titleSmall)
                state.announcements.takeLast(4).forEach { line ->
                    Text(
                        line,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
            }
            if (state.status != WorkoutRecorder.Status.SAVED) {
                Spacer(Modifier.height(20.dp))
                if (state.status == WorkoutRecorder.Status.RECORDING) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        HoldCircleButton(
                            icon = Icons.Filled.Pause,
                            containerColor = MaterialTheme.colorScheme.primary,
                            onShort = { vm.recorder.pause() },
                            onHold = { vm.stopAndSaveWorkout() },
                        )
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "轻点暂停 · 长按结束",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    // Paused: two explicit controls side by side.
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(48.dp),
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(116.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.primary)
                                    .clickable { vm.recorder.resume() },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Filled.PlayArrow,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.size(44.dp),
                                )
                            }
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "继续",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        Column(
                            modifier = Modifier.weight(1f),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            HoldCircleButton(
                                icon = Icons.Filled.Stop,
                                containerColor = MaterialTheme.colorScheme.error,
                                onShort = {},
                                onHold = { vm.stopAndSaveWorkout() },
                            )
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "长按结束",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
        if (state.status == WorkoutRecorder.Status.SAVED && state.savedLogId != null) {
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { onOpenWorkout(state.savedLogId!!) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("查看本次运动记录")
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "已保存。返回后可再次开始新的运动。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (!permissionGranted && state.status == WorkoutRecorder.Status.IDLE) {
            Spacer(Modifier.height(12.dp))
            Text(
                "需要定位权限记录轨迹；未授权时仅计时。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun LiveStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, softWrap = false)
    }
}

private const val HOLD_TO_END_MS = 1200L

/**
 * Circular control with a deliberate hold action: a short press fires
 * [onShort], holding for HOLD_TO_END_MS fires [onHold]. An error-colored
 * progress ring fills while holding so the hold action is explicit.
 */
@Composable
private fun HoldCircleButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    containerColor: androidx.compose.ui.graphics.Color,
    iconColor: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color.White,
    onShort: () -> Unit,
    onHold: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val holdProgress = remember { androidx.compose.animation.core.Animatable(0f) }

    Box(
        modifier = Modifier
            .size(116.dp)
            .pointerInput(Unit) {
                val slop = viewConfiguration.touchSlop
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    var endFired = false
                    var canceled = false
                    val holdJob = scope.launch {
                        holdProgress.snapTo(0f)
                        holdProgress.animateTo(
                            1f,
                            androidx.compose.animation.core.tween(HOLD_TO_END_MS.toInt()),
                        )
                    }
                    // AwaitPointerEventScope is a restricted coroutine: the
                    // hold timer must race outside it, in the UI scope.
                    val timer = scope.launch {
                        kotlinx.coroutines.delay(HOLD_TO_END_MS)
                        endFired = true
                        holdJob.cancel()
                        onHold()
                    }
                    try {
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id }
                            if (change == null || !change.pressed) break
                            // A drag that leaves the button cancels the tap.
                            val delta = change.position - down.position
                            if (kotlin.math.abs(delta.x) > slop || kotlin.math.abs(delta.y) > slop) {
                                canceled = true
                                break
                            }
                        }
                    } finally {
                        timer.cancel()
                        holdJob.cancel()
                        scope.launch { holdProgress.snapTo(0f) }
                    }
                    if (!endFired && !canceled) onShort()
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        // Hold progress ring.
        val ringColor = MaterialTheme.colorScheme.error
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = 7.dp.toPx()
            val inset = stroke + 2.dp.toPx()
            val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
            drawArc(
                color = ringColor,
                startAngle = -90f,
                sweepAngle = 360f * holdProgress.value,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = androidx.compose.ui.graphics.drawscope.Stroke(stroke),
            )
        }
        Surface(
            shape = androidx.compose.foundation.shape.CircleShape,
            color = containerColor,
            modifier = Modifier.size(96.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(40.dp),
                )
            }
        }
    }
}
