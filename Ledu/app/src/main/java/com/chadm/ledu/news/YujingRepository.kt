package com.chadm.ledu.news

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * Client for the LingoWhale (yujing) public API. Mirrors the reverse-engineered
 * shapes from the mitm capture: guest access, POST+JSON, cursor pagination.
 *
 * Endpoints used:
 *  - feed/subscription  {channel_ids, limit, cursor} -> feed_list (articles)
 *  - entry_detail/get   {entry_id, entry_type:7}     -> resource (full text)
 */
class YujingRepository(private val context: Context) {

    private val dao = NewsDatabase.get(context).newsDao()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * Pulls the article stream for the given yujing feeds (each entry carries
     * its channel_id, so one call serves any mix of channels). Stops at the
     * first page whose entries are all already stored (IGNORE dedupe by
     * entryId) or after [maxPages] pages. Returns stored count.
     */
    suspend fun syncChannels(feeds: List<FeedEntity>, maxPages: Int = 3): Int =
        withContext(Dispatchers.IO) {
            if (feeds.isEmpty()) return@withContext 0
            val feedByChannel = feeds.associateBy { it.channelId!! }
            var cursor = ""
            var stored = 0
            var pages = 0
            while (pages < maxPages) {
                val payload = JSONObject()
                    .put("sort_type", 2)
                    .put("channel_ids", JSONArray(feeds.map { it.channelId }))
                    .put("limit", 50)
                    .put("cursor", cursor)
                    .put("filter_unread", false)
                    .put("feed_style", 3)
                    .toString()
                val json = runCatching { post("feed/subscription", payload) }
                    .getOrElse {
                        Log.w(TAG, "feed/subscription failed", it)
                        return@withContext stored
                    }
                val data = json.optJSONObject("data") ?: run {
                    Log.w(TAG, "feed/subscription missing data: $json")
                    return@withContext stored
                }

                val entries = data.optJSONArray("feed_list") ?: break
                var newThisPage = 0
                for (i in 0 until entries.length()) {
                    val e = entries.getJSONObject(i)
                    val channel = e.optJSONObject("channel") ?: continue
                    val feed = feedByChannel[channel.optString("channel_id")] ?: continue
                    val entryId = e.optString("entry_id")
                    val entity = ArticleEntity(
                        feedId = feed.id,
                        feedTitle = channel.optString("name").ifBlank { feed.title },
                        title = e.optString("title"),
                        // yujing entries have no URL; a stable per-entry value keeps
                        // the unique(link) index meaningful ("" would collide on row 2)
                        link = "yujing:$entryId",
                        publishedAt = e.optLong("pub_time") * 1000,
                        description = stripHighlight(e.optString("abstract")),
                        entryId = entryId,
                        coverUrl = e.optString("surface_url").ifBlank { null },
                    )
                    // unique link dedupes already-seen articles
                    val rowId = dao.insertArticles(listOf(entity))[0]
                    if (rowId != -1L) newThisPage++
                }
                stored += newThisPage
                if (newThisPage == 0) break // reached overlap with stored data
                if (!data.optBoolean("has_more", false)) break
                cursor = data.optString("cursor", "")
                pages++
            }
            stored
        }

    /** Fetches the full text of one article via entry_detail; returns null on failure. */
    suspend fun fetchContent(entryId: String): String? = withContext(Dispatchers.IO) {
        val payload = JSONObject()
            .put("entry_id", entryId)
            .put("entry_type", 7)
            .toString()
        runCatching { post("entry_detail/get", payload) }
            .mapCatching { json ->
                json.getJSONObject("data").getJSONObject("resource").optString("html")
            }
            .getOrNull()
            ?.takeIf { it.isNotBlank() }
    }

    /**
     * Builds and sends one POST. Throws on transport failure, non-2xx status,
     * or app-level error code (code != 0) so callers treat it as a failed sync
     * instead of parsing a missing "data" object.
     *
     * Guest identity: the server keys an anonymous account to the imei /
     * anonymous-id headers (verified by replaying captured traffic). We mint
     * one "IMEI-<hex>" value per install and keep it in SharedPreferences.
     */
    private fun post(path: String, payload: String): JSONObject {
        val request = Request.Builder()
            .url("$BASE/$path")
            .header("User-Agent", "LingoWhale_2.1.0")
            .header("Content-Type", "application/json")
            .header("imei", guestId)
            .header("anonymous-id", guestId)
            .header("web-site", "android")
            .header("app-version", "2.1.0")
            .header("trace-id", java.util.UUID.randomUUID().toString().replace("-", "").take(20))
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException("HTTP ${response.code} for $path")
            val json = JSONObject(text)
            val code = json.optInt("code", -1)
            if (code != 0) {
                throw IllegalStateException("$path code=$code ${json.optString("msg")}")
            }
            return json
        }
    }

    private val guestId: String by lazy {
        val prefs = context.getSharedPreferences("ledu_prefs", Context.MODE_PRIVATE)
        prefs.getString("yujing_guest_id", null) ?: run {
            val id = "IMEI-" + List(16) { "0123456789abcdef".random() }.joinToString("")
            prefs.edit().putString("yujing_guest_id", id).apply()
            id
        }
    }

    private fun stripHighlight(s: String): String = s.replace("</?hl>".toRegex(), "")

    companion object {
        private const val TAG = "YujingRepository"
        private const val BASE = "https://api-public.lingowhale.com/api/lingowhale/v1"
    }
}
