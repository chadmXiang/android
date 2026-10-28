package com.chadm.ledu.sport

import org.json.JSONArray
import org.json.JSONObject

/**
 * Parses a Keep sportlog detail JSON (the per-log export of the keep_export
 * logs directory, endpoint /minnow-webapp/v2/sportlog/{logId}) into Room
 * entities.
 *
 * Track points: the full geoPoints field is AES-encrypted by Keep with a key
 * that ships in a dynamically loaded class, so it cannot be decoded offline.
 * Instead we use sections[map].content.crossKmPoints — one real WGS-84
 * coordinate per kilometer (plus the start point), which every log carries.
 * Splits come from the same crossKmPoints (cumulative duration/distance),
 * heart rate is joined from the km1Lap section rows.
 */
object KeepLogParser {

    data class Parsed(val workout: WorkoutEntity, val splits: List<SplitEntity>)

    fun parse(text: String, sourceFile: String): Parsed? {
        val root = JSONObject(text)
        if (!root.optBoolean("ok")) return null
        val data = root.optJSONObject("data") ?: return null
        val basic = data.optJSONObject("basicInfo") ?: return null
        val logId = data.optString("logId").ifEmpty { basic.optString("sportLogId") }
        if (logId.isEmpty()) return null

        val sport = basic.optString("type")
        if (sport !in listOf("run", "cycling")) return null
        val startTime = basic.optLong("startTime")
        val endTime = basic.optLong("endTime")
        val distanceM = basic.optDouble("distance", 0.0)
        val avgPaceSec = basic.optInt("averagePace", 0)

        val sections = data.optJSONArray("sections") ?: JSONArray()
        var headerDesc: String? = null
        var trackJson: String? = null
        val splits = mutableListOf<SplitEntity>()
        val extras = mutableListOf<JSONObject>()

        for (i in 0 until sections.length()) {
            val section = sections.optJSONObject(i) ?: continue
            when (section.optString("type")) {
                "header" -> headerDesc = section.optJSONObject("content")?.optString("desc")
                "map" -> {
                    val content = section.optJSONObject("content") ?: continue
                    trackJson = encodeTrack(content.optJSONArray("crossKmPoints"))
                    parseSplits(content.optJSONArray("crossKmPoints"), logId, splits)
                }
                "sportData" -> {
                    val content = section.optJSONObject("content") ?: continue
                    val list = content.optJSONArray("list") ?: continue
                    for (j in 0 until list.length()) {
                        val item = list.optJSONObject(j) ?: continue
                        extras.add(
                            JSONObject()
                                .put("title", item.optString("title"))
                                .put("value", item.optString("valueStr"))
                                .put("unit", item.optString("unit")),
                        )
                    }
                }
            }
        }

        // Heart rate per kilometer from km1Lap rows: [kmNo, km, duration, pace, hr]
        val hrByKm = mutableMapOf<Int, Int>()
        for (i in 0 until sections.length()) {
            val section = sections.optJSONObject(i) ?: continue
            if (section.optString("type") != "km1Lap") continue
            val rows = section.optJSONObject("content")?.optJSONArray("rowValues") ?: continue
            for (j in 0 until rows.length()) {
                val row = rows.optJSONArray(j) ?: continue
                if (row.length() < 5) continue
                val km = row.optInt(0)
                val hr = row.optString(4)
                if (hr != "--" && hr.isNotEmpty()) hrByKm[km] = row.optInt(4)
            }
        }
        for (idx in splits.indices) {
            val hr = hrByKm[splits[idx].kmIndex]
            if (hr != null) splits[idx] = splits[idx].copy(heartRate = hr)
        }

        val calories = extras.firstOrNull {
            it.optString("title").contains("消耗")
        }?.optString("value")?.toDoubleOrNull()?.toInt() ?: 0

        val durationSec = extras.firstOrNull {
            it.optString("title").contains("时长")
        }?.optString("value")?.let(::parseDuration) ?: ((endTime - startTime) / 1000).toInt()

        val workout = WorkoutEntity(
            logId = logId,
            sport = sport,
            startTime = startTime,
            endTime = endTime,
            durationSec = durationSec,
            distanceM = distanceM,
            avgPaceSec = avgPaceSec,
            calories = calories,
            headerDesc = headerDesc,
            trackJson = trackJson,
            extrasJson = if (extras.isEmpty()) null else JSONArray(extras).toString(),
            sourceFile = sourceFile,
        )
        return Parsed(workout, splits)
    }

    /** "00:54:59" or "05:40" -> seconds. */
    private fun parseDuration(value: String): Int? {
        val parts = value.split(":")
        if (parts.size < 2) return null
        var total = 0
        for (p in parts) {
            val n = p.toIntOrNull() ?: return null
            total = total * 60 + n
        }
        return total
    }

    private fun encodeTrack(points: JSONArray?): String? {
        if (points == null || points.length() == 0) return null
        val out = JSONArray()
        for (i in 0 until points.length()) {
            val p = points.optJSONObject(i) ?: continue
            out.put(
                JSONArray()
                    .put(p.optDouble("latitude"))
                    .put(p.optDouble("longitude"))
                    .put(p.optDouble("altitude"))
                    .put(p.optLong("timestamp")),
            )
        }
        if (out.length() == 0) return null
        return out.toString()
    }

    private fun parseSplits(points: JSONArray?, logId: String, out: MutableList<SplitEntity>) {
        if (points == null || points.length() == 0) return
        var prevDuration = 0
        for (i in 0 until points.length()) {
            val p = points.optJSONObject(i) ?: continue
            val totalDuration = p.optLong("totalDuration").toInt()
            val km = p.optInt("kmNO", 0)
            if (km <= 0) continue
            val splitSec = (totalDuration - prevDuration).coerceAtLeast(0)
            out.add(
                SplitEntity(
                    workoutId = logId,
                    kmIndex = km,
                    durationSec = splitSec,
                    paceSec = p.optInt("kmPace", if (splitSec > 0) splitSec else 0),
                    heartRate = null,
                    endDistanceM = p.optDouble("totalDistance"),
                ),
            )
            prevDuration = totalDuration
        }
    }
}
