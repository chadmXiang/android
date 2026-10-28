package com.chadm.ledu.sport

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
private val DATE_FMT = DateTimeFormatter.ofPattern("M月d日 EEEE", java.util.Locale.CHINESE)

internal val FULL_FMT = DateTimeFormatter.ofPattern("yyyy年M月d日")

private fun zone() = ZoneId.systemDefault()

internal fun toDate(ms: Long): LocalDate = Instant.ofEpochMilli(ms).atZone(zone()).toLocalDate()

internal fun formatDistance(m: Double): String =
    if (m >= 1000) String.format("%.2f", m / 1000) else m.toInt().toString()

internal fun formatDuration(sec: Int): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    val s = sec % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
}

internal fun formatPace(secPerKm: Int, sport: String): String =
    if (sport == "cycling") {
        if (secPerKm > 0) String.format("%.1f", 3600.0 / secPerKm) else "--"
    } else {
        String.format("%02d'%02d''", secPerKm / 60, secPerKm % 60)
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SportHomeScreen(
    onOpenNavigationDrawer: () -> Unit,
    onOpenWorkout: (String) -> Unit,
    onOpenImport: () -> Unit,
) {
    val vm: SportViewModel = viewModel()
    val workouts by vm.workouts.collectAsState()

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("运动") },
                navigationIcon = {
                    IconButton(onClick = onOpenNavigationDrawer) {
                        Icon(Icons.Filled.Menu, contentDescription = "菜单")
                    }
                },
                actions = {
                    IconButton(onClick = onOpenImport) {
                        Icon(Icons.Filled.Download, contentDescription = "导入")
                    }
                },
            )
        },
    ) { padding ->
        // Two tabs: live recording, and imported/historical data.
        var tab by rememberSaveable { mutableStateOf(0) }
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tab) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("记录") })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("数据") })
            }
            when (tab) {
                0 -> SportRecordScreen(onOpenWorkout = onOpenWorkout)
                else -> SportDataContent(
                    workouts = workouts,
                    onOpenWorkout = onOpenWorkout,
                    onOpenImport = onOpenImport,
                )
            }
        }
    }
}

/** "Data" tab: scoped summary + sport filter + year chart drill-down + list. */
@Composable
private fun SportDataContent(
    workouts: List<WorkoutEntity>,
    onOpenWorkout: (String) -> Unit,
    onOpenImport: () -> Unit,
) {
    var sportFilter by rememberSaveable { mutableStateOf("all") }
    if (workouts.isEmpty()) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                Icons.Filled.DirectionsRun,
                contentDescription = null,
                modifier = Modifier.size(72.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(16.dp))
            Text("还没有运动记录", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                "先在「记录」页开始一次运动，或导入 Keep 导出的日志（JSON）",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))
            FilledTonalButton(onClick = onOpenImport) {
                Icon(Icons.Filled.Download, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("导入数据")
            }
        }
        return
    }

    val filtered = workouts.filter { sportFilter == "all" || it.sport == sportFilter }
    // -1 = all years (grand total); picking a year or month scopes the
    // summary cards and the list below.
    var year by rememberSaveable { mutableStateOf(-1) }
    val years = workouts.map { toDate(it.startTime).year }.distinct().sorted()
    var month by rememberSaveable { mutableStateOf(-1) } // -1 = whole year
    val listed = filtered.filter { w ->
        val d = toDate(w.startTime)
        (year == -1 || d.year == year) && (month == -1 || d.monthValue == month)
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Scope cards follow the selected year/month/sport so switching
        // the period actually changes the numbers.
        item { SummaryCards(listed) }
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SportChip("全部", "all", sportFilter) { sportFilter = "all" }
                SportChip("跑步", "run", sportFilter) { sportFilter = "run" }
                SportChip("骑行", "cycling", sportFilter) { sportFilter = "cycling" }
            }
        }
        item { YearBarChart(filtered, year, years, month) { y, m -> year = y; month = m } }
        if (listed.isEmpty()) {
            item {
                Text(
                    "该时间段没有记录",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp).fillMaxWidth(),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        } else {
            items(listed, key = { it.logId }) { w ->
                WorkoutRow(w) { onOpenWorkout(w.logId) }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun SportChip(label: String, key: String, current: String, onClick: () -> Unit) {
    FilterChip(selected = current == key, onClick = onClick, label = { Text(label) })
}

@Composable
private fun SummaryCards(workouts: List<WorkoutEntity>) {
    val km = workouts.sumOf { it.distanceM } / 1000
    val totalSec = workouts.sumOf { it.durationSec }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        StatCard("距离", if (km >= 100) String.format("%.0f", km) else String.format("%.1f", km), "公里", Modifier.weight(1.2f))
        StatCard("次数", workouts.size.toString(), "次", Modifier.weight(1f))
        StatCard("总时长", formatDuration(totalSec), "", Modifier.weight(1.2f))
    }
}

@Composable
private fun StatCard(title: String, value: String, unit: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    value,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    softWrap = false,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    unit,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    softWrap = false,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
        }
    }
}

/** Distance bars per year (all-years view) or per month (one year); tap to drill down. */
@Composable
private fun YearBarChart(
    workouts: List<WorkoutEntity>,
    year: Int,
    years: List<Int>,
    selectedMonth: Int,
    onPick: (year: Int, month: Int) -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.padding(16.dp)) {

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            ) {
                Text(
                    "全部",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = if (year == -1) FontWeight.Bold else FontWeight.Normal,
                    color = if (year == -1) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .clickable { onPick(-1, -1) }
                        .padding(horizontal = 6.dp),
                )
                years.forEach { y ->
                    Text(
                        if (y == year) "${year}年" else "$y",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (y == year) FontWeight.Bold else FontWeight.Normal,
                        color = if (y == year) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .clickable { onPick(y, -1) }
                            .padding(horizontal = 6.dp),
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            if (year == -1) {
                // All-years view: one distance bar per year, tap to drill in.
                val perYear = years.map { y ->
                    y to workouts.filter { toDate(it.startTime).year == y }
                        .sumOf { it.distanceM / 100 }.toInt()
                }
                val max = (perYear.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
                Row(
                    Modifier.fillMaxWidth().height(120.dp),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    perYear.forEach { (y, dm) ->
                        Column(
                            Modifier.weight(1f).clickable { onPick(y, -1) },
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height((100f * dm / max).dp)
                                    .background(
                                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.35f),
                                        shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp),
                                    ),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "$y",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    String.format(
                        "全部年份合计 %.1f 公里 · %d 次 · 点柱子按年筛选",
                        perYear.sumOf { it.second } / 10.0,
                        workouts.size,
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                val perMonth = IntArray(12)
                workouts.forEach { w ->
                    val d = toDate(w.startTime)
                    if (d.year == year) perMonth[d.monthValue - 1] += (w.distanceM / 100).toInt()
                }
                val max = (perMonth.maxOrNull() ?: 1).coerceAtLeast(1)
                Row(
                    Modifier.fillMaxWidth().height(120.dp),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    perMonth.forEachIndexed { i, dm ->
                        val m = i + 1
                        val selected = selectedMonth == m
                        Column(
                            Modifier.weight(1f).clickable { onPick(year, if (selected) -1 else m) },
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height((100f * dm / max).dp)
                                    .background(
                                        color = if (selected) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.primary.copy(alpha = 0.35f),
                                        shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp),
                                    ),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "$m",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (selected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                val total = perMonth.sum() / 10.0
                val label = if (selectedMonth == -1) {
                    String.format("%d 年合计 %.1f 公里 · %d 次", year, total, workouts.count { toDate(it.startTime).year == year })
                } else {
                    String.format("%d 年 %d 月 · 点柱子取消筛选", year, selectedMonth)
                }
                Text(
                    label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun WorkoutRow(w: WorkoutEntity, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(48.dp),
            ) {
                Icon(
                    if (w.sport == "cycling") Icons.Filled.DirectionsBike else Icons.Filled.DirectionsRun,
                    contentDescription = null,
                    modifier = Modifier.padding(10.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "${toDate(w.startTime).format(DATE_FMT)} ${if (w.sport == "cycling") "骑行" else "跑步"}",
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                Row {
                    Text(
                        "${formatDistance(w.distanceM)} ${if (w.distanceM >= 1000) "公里" else "米"}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        formatDuration(w.durationSec),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(12.dp))
                    val paceLabel = if (w.sport == "cycling") "均速" else "配速"
                    Text(
                        "$paceLabel ${formatPace(w.avgPaceSec, w.sport)}${if (w.sport == "cycling") " km/h" else ""}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/** SAF picker + import progress. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SportImportScreen(onBack: () -> Unit, onDone: (imported: Int) -> Unit) {
    val vm: SportViewModel = viewModel()
    val state by vm.importState.collectAsState()
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocumentTree(),
    ) { uri ->
        if (uri != null) {
            runCatching {
                // Keep permission across restarts
                val flags = android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                vm.getApplication<android.app.Application>().contentResolver
                    .takePersistableUriPermission(uri, flags)
            }
            vm.importFromTree(uri)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("导入 Keep 数据") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "选择保存 Keep 运动日志的文件夹",
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "每个记录是一个 JSON 文件（来自 keep_export 导出）。按 logId 去重，重复导入安全。",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))
            FilledTonalButton(
                onClick = { launcher.launch(null) },
                enabled = !state.running,
            ) {
                Icon(Icons.Filled.Download, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(if (state.running) "导入中…" else "选择文件夹")
            }
            if (state.running || state.found > 0) {
                Spacer(Modifier.height(32.dp))
                if (state.found > 0) {
                    LinearProgressIndicator(
                        progress = { state.imported.toFloat() / state.found },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Spacer(Modifier.height(12.dp))
                Text(
                    buildString {
                        append("找到 ${state.found} 个文件")
                        append(" · 导入 ${state.imported}")
                        if (state.failed > 0) append(" · 失败 ${state.failed}")
                        if (state.done) append("\n完成")
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                if (state.done && state.imported > 0) {
                    Spacer(Modifier.height(16.dp))
                    FilledTonalButton(onClick = { onDone(state.imported) }) {
                        Text("查看运动记录")
                    }
                }
            }
        }
    }
}
