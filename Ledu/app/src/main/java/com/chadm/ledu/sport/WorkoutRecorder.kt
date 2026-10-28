package com.chadm.ledu.sport

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray

/**
 * Live workout recorder: GPS points (WGS-84) at full density, per-km split
 * timing, per-km voice announcement events, and Room persistence on stop.
 *
 * Lives inside SportViewModel so it survives rotation. The UI owns TTS
 * playback; this class only publishes announcement strings.
 */
class WorkoutRecorder(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    enum class Status { IDLE, RECORDING, PAUSED, SAVED }

    data class State(
        val status: Status = Status.IDLE,
        val sport: String = "run",
        val startAtMs: Long = 0L,
        val elapsedSec: Int = 0,
        val distanceM: Double = 0.0,
        /** WGS-84 points [lat, lon, altitude, timeSec]; one per accepted GPS fix. */
        val points: List<DoubleArray> = emptyList(),
        /** Per-km announcement lines, newest last. */
        val announcements: List<String> = emptyList(),
        val fixCount: Int = 0,
        /** Set after stop() saved the workout; navigates to its detail page. */
        val savedLogId: String? = null,
    )

    data class Result(
        val workout: WorkoutEntity,
        val splits: List<SplitEntity>,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state

    private var locationListener: LocationListener? = null
    private var ticker: Job? = null
    private var splits = mutableListOf<SplitEntity>()
    private var lastKmElapsedSec = 0

    /** Caller MUST hold ACCESS_FINE_LOCATION before calling this. */
    @SuppressLint("MissingPermission")
    fun start(sport: String) {
        if (_state.value.status == Status.RECORDING || _state.value.status == Status.PAUSED) return
        splits = mutableListOf()
        lastKmElapsedSec = 0
        _state.value = State(status = Status.RECORDING, sport = sport, startAtMs = System.currentTimeMillis())

        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val listener = LocationListener { location -> onLocation(location) }
        locationListener = listener
        try {
            // GPS is authoritative; network is a downtown-canyon fallback. Both WGS-84.
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper())
            lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000L, 0f, listener, Looper.getMainLooper())
        } catch (e: SecurityException) {
            // Permission revoked mid-recording: keep the timer, stop the fixes.
        } catch (e: IllegalArgumentException) {
            // Provider missing on this device: the other one still runs.
        }

        ticker = scope.launch {
            while (isActive) {
                val s = _state.value
                // Accumulate only while recording: paused time is excluded.
                if (s.status == Status.RECORDING) {
                    _state.value = s.copy(elapsedSec = s.elapsedSec + 1)
                }
                delay(1000)
            }
        }
    }

    /** Short press: freeze timer and distance accumulation; fixes ignored. */
    fun pause() {
        val s = _state.value
        if (s.status != Status.RECORDING) return
        _state.value = s.copy(status = Status.PAUSED)
    }

    fun resume() {
        val s = _state.value
        if (s.status != Status.PAUSED) return
        _state.value = s.copy(status = Status.RECORDING)
    }

    fun stop(): Result? {
        val s = _state.value
        if (s.status != Status.RECORDING && s.status != Status.PAUSED) return null
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        locationListener?.let { runCatching { lm.removeUpdates(it) } }
        locationListener = null
        ticker?.cancel()
        ticker = null

        // Accumulated active seconds; paused intervals are excluded.
        val elapsed = s.elapsedSec
        val logId = "local_" + s.startAtMs
        val avgPace = if (s.distanceM >= 100) (elapsed * 1000.0 / s.distanceM).toInt() else 0
        val calories = ((s.distanceM / 1000.0) * if (s.sport == "cycling") 25 else 62).toInt()
        val trackJson = encodeTrack(s.points)
        val paceLabel = if (s.sport == "cycling") "平均速度" else "平均配速"
        val paceValue = if (s.sport == "cycling") {
            if (avgPace > 0) String.format("%.1f", 3600.0 / avgPace) else "--"
        } else {
            String.format("%02d'%02d''", avgPace / 60, avgPace % 60)
        }
        val extras = JSONArray().apply {
            put(item("训练时长", formatDuration(elapsed)))
            put(item(paceLabel, paceValue))
            put(item("运动消耗", "$calories 千卡"))
        }

        val workout = WorkoutEntity(
            logId = logId,
            sport = s.sport,
            startTime = s.startAtMs,
            endTime = System.currentTimeMillis(),
            durationSec = elapsed,
            distanceM = s.distanceM,
            avgPaceSec = avgPace,
            calories = calories,
            headerDesc = null,
            trackJson = trackJson,
            extrasJson = extras.toString(),
            sourceFile = "local",
        )
        _state.value = s.copy(status = Status.SAVED, elapsedSec = elapsed, savedLogId = logId)
        return Result(workout, splits.toList())
    }

    /** Back to idle (after the UI navigated to the saved workout). */
    fun reset() {
        if (_state.value.status == Status.RECORDING) return
        locationListener = null
        ticker?.cancel()
        ticker = null
        _state.value = State()
    }

    private fun item(title: String, value: String): org.json.JSONObject =
        org.json.JSONObject().put("title", title).put("value", value)

    private fun onLocation(location: Location) {
        val s = _state.value
        // Paused: keep receiving so resume is instant, but discard fixes.
        if (s.status != Status.RECORDING) return
        if (location.hasAccuracy() && location.accuracy > 50f) return

        val last = s.points.lastOrNull()
        val d = if (last == null) 0.0 else haversineM(last[0], last[1], location.latitude, location.longitude)
        val dt = if (last == null) 0.0 else (location.time / 1000.0 - last[3])
        if (last != null) {
            // 50 m/s = 180 km/h: above any run/ride, below GPS-glitch jumps.
            if (dt > 0 && d / dt > 50.0) return
            if (d < 2.0) return // stationary noise
        }

        val points = s.points + doubleArrayOf(
            location.latitude, location.longitude, location.altitude, location.time / 1000.0,
        )
        val distance = s.distanceM + d
        val elapsed = s.elapsedSec
        var announcements = s.announcements
        val km = (distance / 1000).toInt()
        if (km > announcements.size) {
            val kmSec = (elapsed - lastKmElapsedSec).coerceAtLeast(0)
            val line = if (s.sport == "cycling") {
                val speed = if (kmSec > 0) String.format("%.1f", 3600.0 / kmSec) else "--"
                "第 $km 公里 · 均速 $speed 公里/时"
            } else {
                String.format("第 %d 公里 · %02d'%02d''", km, kmSec / 60, kmSec % 60)
            }
            announcements = announcements + line
            splits.add(
                SplitEntity(
                    workoutId = "local_" + s.startAtMs,
                    kmIndex = km,
                    durationSec = kmSec,
                    paceSec = kmSec,
                    heartRate = null,
                    endDistanceM = km * 1000.0,
                ),
            )
            lastKmElapsedSec = elapsed
        }
        _state.value = s.copy(
            points = points,
            distanceM = distance,
            elapsedSec = elapsed,
            announcements = announcements,
            fixCount = s.fixCount + 1,
        )
    }

    private fun encodeTrack(points: List<DoubleArray>): String? {
        if (points.size < 2) return null
        val out = JSONArray()
        for (p in points) {
            out.put(JSONArray().put(p[0]).put(p[1]).put(p[2]).put(p[3].toLong()))
        }
        return out.toString()
    }
}

internal fun haversineM(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6371000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

