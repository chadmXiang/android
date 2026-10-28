package com.chadm.ledu.sport

import android.content.Context
import android.graphics.Color
import androidx.compose.ui.unit.dp
import android.view.ViewGroup
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import com.amap.api.maps.AMapOptions
import com.amap.api.maps.CameraUpdateFactory
import com.amap.api.maps.MapView
import com.amap.api.maps.model.BitmapDescriptorFactory
import com.amap.api.maps.model.LatLng
import com.amap.api.maps.model.MarkerOptions
import com.amap.api.maps.model.Marker
import com.amap.api.maps.model.Polyline
import com.amap.api.maps.model.PolylineOptions
import com.amap.api.maps.model.TextOptions
import kotlinx.coroutines.delay

/** True when the AMap key is still the placeholder -> draw the track locally. */
fun amapKeyPlaceholder(context: Context): Boolean {
    val info = context.packageManager.getApplicationInfo(
        context.packageName, android.content.pm.PackageManager.GET_META_DATA,
    )
    val key = info.metaData?.getString("com.amap.api.v2.apikey") ?: ""
    return key.isEmpty() || key == "TODO_KEY" || key.startsWith("TODO")
}

/**
 * WGS-84 -> GCJ-02 (Amap/Chinese map offset). Standard public formula, ~50m
 * accuracy; input/output in degrees.
 */
fun wgs84ToGcj02(lat: Double, lng: Double): DoubleArray {
    val a = 6378245.0
    val ee = 0.00669342162296594323
    var dLat = transformLat(lng - 105.0, lat - 35.0)
    var dLng = transformLng(lng - 105.0, lat - 35.0)
    val radLat = lat / 180.0 * Math.PI
    var magic = Math.sin(radLat)
    magic = 1 - ee * magic * magic
    val sqrtMagic = Math.sqrt(magic)
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI)
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI)
    return doubleArrayOf(lat + dLat, lng + dLng)
}

private fun transformLat(x: Double, y: Double): Double {
    var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0
    return ret
}

private fun transformLng(x: Double, y: Double): Double {
    var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0
    return ret
}

/**
 * Map showing the workout track. With a valid Amap key: AMap MapView with a
 * GCJ-02 polyline, start/end markers and one badge per completed km. Otherwise
 * (placeholder key) a self-drawn Canvas track so the screen still works
 * offline.
 */
@Composable
fun TrackMap(
    points: List<DoubleArray>,
    follow: Boolean = false,
    modifier: Modifier = Modifier,
    replay: ReplayState? = null,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val useAmap = remember { !amapKeyPlaceholder(context) }
    if (useAmap) {
        // Callers that only constrain width (detail screens) get a square
        // map; the live record screen passes an explicit size.
        AmapTrack(points, follow, if (follow) modifier else modifier.aspectRatio(1.0f), replay)
    } else {
        CanvasTrack(points, modifier.aspectRatio(1.0f))
    }
}

/**
 * Drives the track replay animation on the detail map: [generation]
 * increments to (re)start from the beginning, [playing] pauses/resumes.
 */
class ReplayState {
    var playing by androidx.compose.runtime.mutableStateOf(false)
    var generation by androidx.compose.runtime.mutableStateOf(0)
    var finished by androidx.compose.runtime.mutableStateOf(false)
}

/** One completed-kilometer point on the track (GCJ-02, ready for AMap). */
private data class KmMark(val km: Int, val gcj: LatLng, val afterIdx: Int)

/**
 * Cumulative-distance km crossings along raw WGS-84 points, with linear
 * interpolation between the two GPS fixes that straddle each full km.
 */
private fun computeKmMarks(points: List<DoubleArray>): List<KmMark> {
    val marks = mutableListOf<KmMark>()
    var cum = 0.0
    var nextKm = 1000.0
    for (i in 1 until points.size) {
        val seg = haversineM(points[i - 1], points[i])
        if (seg <= 0.0) continue
        while (nextKm <= cum + seg) {
            val t = (nextKm - cum) / seg
            val lat = points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t
            val lng = points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t
            val c = wgs84ToGcj02(lat, lng)
            marks.add(KmMark((nextKm / 1000).toInt(), LatLng(c[0], c[1]), i))
            nextKm += 1000.0
        }
        cum += seg
    }
    return marks
}

/** Great-circle distance in meters for a [lat, lng] pair. */
private fun haversineM(a: DoubleArray, b: DoubleArray): Double {
    val r = 6371000.0
    val dLat = Math.toRadians(b[0] - a[0])
    val dLng = Math.toRadians(b[1] - a[1])
    val s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(Math.toRadians(a[0])) * Math.cos(Math.toRadians(b[0])) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    return 2 * r * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

@Composable
private fun AmapTrack(
    points: List<DoubleArray>,
    follow: Boolean,
    modifier: Modifier = Modifier,
    replay: ReplayState? = null,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val mapView = remember {
        MapView(context, AMapOptions().apply { zoomControlsEnabled(false) }).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
    }
    androidx.compose.ui.viewinterop.AndroidView(
        factory = { mapView },
        modifier = modifier,
    )
    androidx.compose.runtime.DisposableEffect(Unit) {
        mapView.onCreate(null)
        val map = mapView.map
        if (follow) {
            // Blue dot for the live position while recording.
            runCatching { map.isMyLocationEnabled = true }
        }
        onDispose {
            runCatching { map.isMyLocationEnabled = false }
            mapView.onDestroy()
        }
    }
    val gcj = remember(points) {
        points.map { p ->
            val c = wgs84ToGcj02(p[0], p[1])
            LatLng(c[0], c[1])
        }
    }
    val kmMarks = remember(points) { computeKmMarks(points) }
    // Overlays owned by the static (detail) view; the replay coroutine
    // redraws the polyline every frame (Polyline.setPoints is a no-op on
    // this SDK build) and reveals the km badges one by one.
    var trackLine by remember { androidx.compose.runtime.mutableStateOf<Polyline?>(null) }
    var headMarker by remember { androidx.compose.runtime.mutableStateOf<Marker?>(null) }
    var kmTexts by remember { androidx.compose.runtime.mutableStateOf<List<com.amap.api.maps.model.Text>>(emptyList()) }
    // Index into kmMarks of the next badge the replay will reveal; equals
    // kmMarks.size while everything is shown (initial static render).
    var kmRevealIdx by remember(points) { androidx.compose.runtime.mutableStateOf(kmMarks.size) }
    // Live track updates: mutate the polyline in place, follow the latest fix.
    androidx.compose.runtime.LaunchedEffect(points) {
        val map = mapView.map
        if (gcj.isEmpty()) return@LaunchedEffect
        if (gcj.size == 1) {
            map.moveCamera(CameraUpdateFactory.newLatLngZoom(gcj.first(), if (follow) 18f else 15f))
            return@LaunchedEffect
        }
        if (follow) {
            // Live mode: rebuild the one polyline + trailing marker per
            // update; map.clear() keeps overlays from piling up at 1 Hz.
            map.clear()
            map.addPolyline(
                PolylineOptions()
                    .addAll(gcj)
                    .width(12f)
                    .color(Color.parseColor("#2CD9D2"))
                    .setDottedLine(false),
            )
            map.addMarker(
                MarkerOptions().position(gcj.last())
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED)),
            )
            addKmBadges(map, kmMarks)
            map.moveCamera(CameraUpdateFactory.newLatLngZoom(gcj.last(), 18f))
        } else {
            // Static detail view: draw once and fit the bounds.
            trackLine = map.addPolyline(
                PolylineOptions()
                    .addAll(gcj)
                    .width(12f)
                    .color(Color.parseColor("#2CD9D2"))
                    .setDottedLine(false),
            )
            map.addMarker(
                MarkerOptions().position(gcj.first())
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN)),
            )
            map.addMarker(
                MarkerOptions().position(gcj.last())
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED)),
            )
            kmTexts = addKmBadges(map, kmMarks)
            val builder = com.amap.api.maps.model.LatLngBounds.Builder()
            gcj.forEach { builder.include(it) }
            // Defer until the MapView is laid out: newLatLngBounds is a
            // no-op when the map has no measured size yet.
            mapView.post {
                map.moveCamera(CameraUpdateFactory.newLatLngBounds(builder.build(), 100))
            }
        }
    }
    if (replay != null && !follow && gcj.size >= 2) {
        // Index of the last point currently shown by the replay; starts at
        // "full track" so the initial render is the complete line.
        var playIdx by remember(points) { androidx.compose.runtime.mutableStateOf(gcj.size) }
        androidx.compose.runtime.LaunchedEffect(replay.generation, replay.playing) {
            if (replay.generation == 0 || !replay.playing) return@LaunchedEffect
            // Polyline.setPoints is a no-op on this SDK build, so every
            // frame removes and re-adds the polyline instead (same pattern
            // the live follow mode already uses without flicker).
            val map = mapView.map
            fun drawUpTo(idx: Int) {
                trackLine?.remove()
                trackLine = map.addPolyline(
                    PolylineOptions()
                        .addAll(ArrayList(gcj.subList(0, idx)))
                        .width(12f)
                        .color(Color.parseColor("#2CD9D2"))
                        .setDottedLine(false),
                )
            }
            fun revealBadgesUpTo(idx: Int) {
                while (kmRevealIdx < kmMarks.size && kmMarks[kmRevealIdx].afterIdx <= idx) {
                    kmTexts = kmTexts + addKmBadges(map, listOf(kmMarks[kmRevealIdx]))
                    kmRevealIdx++
                }
            }
            if (playIdx >= gcj.size) {
                // Restart: shrink the line to its first point, hide all km
                // badges (they reappear as the head passes each mark) and
                // move the head marker back to the start.
                playIdx = 1
                drawUpTo(1)
                kmTexts.forEach { it.remove() }
                kmTexts = emptyList()
                kmRevealIdx = 0
                if (headMarker == null) {
                    headMarker = map.addMarker(
                        MarkerOptions().position(gcj.first())
                            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE)),
                    )
                }
                headMarker?.position = gcj.first()
            }
            // Fixed wall-clock duration for the whole track regardless of
            // its real duration; ~20s reads well at any length.
            val stepMs = (REPLAY_TOTAL_MS / gcj.size).coerceAtLeast(16L)
            while (playIdx < gcj.size && replay.playing) {
                kotlinx.coroutines.delay(stepMs)
                playIdx++
                drawUpTo(playIdx)
                revealBadgesUpTo(playIdx)
            }
            if (playIdx >= gcj.size) {
                // Safety net: show any badge the loop did not reach.
                revealBadgesUpTo(gcj.size)
                replay.playing = false
                replay.finished = true
            }
        }
    }
}

/** Numbered badge per completed km, drawn as AMap text overlays. */
private fun addKmBadges(map: com.amap.api.maps.AMap, marks: List<KmMark>): List<com.amap.api.maps.model.Text> {
    return marks.map { m ->
        map.addText(
            TextOptions()
                .text("${m.km}")
                .position(m.gcj)
                .fontColor(Color.WHITE)
                .backgroundColor(Color.parseColor("#0E7C74"))
                .fontSize(64)
                .zIndex(10f),
        )
    }
}

/** Total wall-clock duration of one full replay animation. */
private const val REPLAY_TOTAL_MS = 20_000L

/** Offline fallback: the track drawn on a Canvas with padding insets. */
@Composable
private fun CanvasTrack(points: List<DoubleArray>, modifier: Modifier = Modifier) {
    androidx.compose.material3.Surface(
        modifier = modifier,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        color = androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant,
    ) {
        if (points.size < 2) return@Surface
        Canvas(Modifier.fillMaxWidth().aspectRatio(1.0f)) {
            val minLat = points.minOf { it[0] }
            val maxLat = points.maxOf { it[0] }
            val minLng = points.minOf { it[1] }
            val maxLng = points.maxOf { it[1] }
            val pad = 40f
            val w = size.width - 2 * pad
            val h = size.height - 2 * pad
            val latSpan = (maxLat - minLat).coerceAtLeast(1e-6)
            val lngSpan = (maxLng - minLng).coerceAtLeast(1e-6)
            val scale = minOf(w / lngSpan, h / latSpan)
            fun toOffset(p: DoubleArray): Offset {
                val x = pad + (p[1] - minLng) * scale + (w - lngSpan * scale) / 2
                val y = size.height - (pad + (p[0] - minLat) * scale + (h - latSpan * scale) / 2)
                return Offset(x.toFloat(), y.toFloat())
            }
            val path = Path()
            path.moveTo(toOffset(points[0]).x, toOffset(points[0]).y)
            for (i in 1 until points.size) {
                val o = toOffset(points[i])
                path.lineTo(o.x, o.y)
            }
            drawPath(
                path,
                color = androidx.compose.ui.graphics.Color(0xFF2CD9D2),
                style = Stroke(width = 8f, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
            drawCircle(androidx.compose.ui.graphics.Color(0xFF31C787), radius = 10f, center = toOffset(points[0]))
            drawCircle(androidx.compose.ui.graphics.Color(0xFFF35252), radius = 10f, center = toOffset(points.last()))
        }
    }
}

