package com.chadm.ledu.sport

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.remember
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.json.JSONArray
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutDetailScreen(logId: String, onBack: () -> Unit) {
    val vm: SportViewModel = viewModel()
    val workout by vm.workout(logId).collectAsState(initial = null)
    val splits by vm.splits(logId).collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(if (workout?.sport == "cycling") "骑行详情" else "跑步详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { padding ->
        val w = workout ?: return@Scaffold
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { HeaderCard(w) }
            val track = parseTrack(w.trackJson)
            if (track != null && track.size >= 2) {
                item {
                    Column {
                        Text(
                            "运动轨迹",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(8.dp))
                        val replay = remember { ReplayState() }
                        TrackMap(track, modifier = Modifier.fillMaxWidth(), replay = replay)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 8.dp),
                        ) {
                            Button(
                                onClick = {
                                    if (replay.playing) {
                                        replay.playing = false
                                    } else {
                                        // First run or a finished run restarts
                                        // from the beginning; a paused run
                                        // resumes where it stopped.
                                        if (replay.generation == 0 || replay.finished) {
                                            replay.generation++
                                            replay.finished = false
                                        }
                                        replay.playing = true
                                    }
                                },
                            ) {
                                Text(
                                    when {
                                        replay.playing -> "暂停回放"
                                        replay.finished -> "重播"
                                        else -> "回放轨迹"
                                    }
                                )
                            }
                            if (replay.generation > 0) {
                                OutlinedButton(
                                    onClick = {
                                        replay.generation++
                                        replay.finished = false
                                        replay.playing = true
                                    },
                                ) {
                                    Text("从头重播")
                                }
                            }
                        }
                        Text(
                            if (w.sourceFile == "local") "本次记录的 GPS 轨迹（逐点采样）"
                            else "每公里一个定位点（Keep 全量轨迹加密，此处为可解部分）",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }
            item { DataGrid(w.extrasJson) }
            if (splits.isNotEmpty()) {
                item {
                    Text(
                        "分段数据",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                item { SplitsTable(w.sport, splits) }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun HeaderCard(w: WorkoutEntity) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (w.sport == "cycling") Icons.Filled.DirectionsBike else Icons.Filled.DirectionsRun,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    toDate(w.startTime).format(FULL_FMT),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
            Spacer(Modifier.height(12.dp))
            Text(
                formatDistance(w.distanceM),
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                (if (w.distanceM >= 1000) "公里" else "米") + " · ${formatDuration(w.durationSec)}",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
            )
            if (!w.headerDesc.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    w.headerDesc,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                )
            }
        }
    }
}

@Composable
private fun DataGrid(extrasJson: String?) {
    if (extrasJson == null) return
    val rows = rememberRows(extrasJson)
    if (rows.isEmpty()) return
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for (i in rows.indices step 3) {
                Row(Modifier.fillMaxWidth()) {
                    for (j in 0 until 3) {
                        val idx = i + j
                        if (idx < rows.size) {
                            val (title, value, unit) = rows[idx]
                            Column(Modifier.weight(1f)) {
                                Text(
                                    title,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                )
                                Text(
                                    buildString {
                                        append(value)
                                        if (unit != null && unit != "null") append(" ").append(unit)
                                    },
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        } else {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun rememberRows(extrasJson: String): List<Triple<String, String, String?>> =
    androidx.compose.runtime.remember(extrasJson) {
        try {
            val arr = JSONArray(extrasJson)
            List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                Triple(o.optString("title"), o.optString("value"), o.optString("unit").ifEmpty { null })
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

@Composable
private fun SplitsTable(sport: String, splits: List<SplitEntity>) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth()) {
                Text("公里", Modifier.weight(0.6f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("用时", Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("配速", Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("心率", Modifier.weight(0.8f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.End)
            }
            val best = splits.filter { it.paceSec > 0 }.minOfOrNull { it.paceSec } ?: 0
            splits.forEach { s ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${s.kmIndex}",
                        Modifier.weight(0.6f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        formatDuration(s.durationSec),
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        formatPace(s.paceSec, if (sport == "cycling") "cycling" else "run"),
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (s.paceSec in 1..best) FontWeight.Bold else FontWeight.Normal,
                        color = if (s.paceSec in 1..best) MaterialTheme.colorScheme.primary else Color.Unspecified,
                    )
                    Text(
                        s.heartRate?.toString() ?: "--",
                        Modifier.weight(0.8f),
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.End,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
