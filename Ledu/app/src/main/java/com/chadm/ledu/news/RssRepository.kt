package com.chadm.ledu.news

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Fetches subscribed feeds over HTTP and stores parsed items in Room. */
class RssRepository(private val context: Context) {

    private val dao = NewsDatabase.get(context).newsDao()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun feedsFlow(): Flow<List<FeedEntity>> = dao.feedsFlow()

    fun timelineFlow(category: String?): Flow<List<ArticleEntity>> = dao.timelineFlow(category)

    fun articleFlow(id: Long): Flow<ArticleEntity?> = dao.articleFlow(id)

    fun categoriesFlow(): Flow<List<String>> = dao.categoriesFlow()

    suspend fun allFeeds(): List<FeedEntity> = dao.allFeeds()

    suspend fun feedByChannelId(channelId: String): FeedEntity? = dao.feedByChannelId(channelId)

    suspend fun insertFeed(feed: FeedEntity): FeedEntity =
        feed.copy(id = dao.insertFeed(feed))

    suspend fun updateArticleContent(id: Long, content: String) = dao.updateArticleContent(id, content)

    suspend fun deleteFeed(id: Long) = dao.deleteFeed(id)

    suspend fun markRead(id: Long) = dao.markRead(id)

    /** Adds (or refreshes) one subscription; the feed title comes from the feed itself. */
    suspend fun addFeed(rawUrl: String, category: String? = null): Result<FeedEntity> = withContext(Dispatchers.IO) {
        runCatching {
            val url = normalize(rawUrl)
            val parsed = fetchAndParse(url)
            val existing = dao.feedByUrl(url)
            val entity = FeedEntity(
                id = existing?.id ?: 0L,
                url = url,
                title = parsed.feed.title.ifBlank { url },
                siteLink = parsed.feed.siteLink,
                lastSyncAt = System.currentTimeMillis(),
                category = existing?.category ?: category,
            )
            val feedId = if (existing == null) {
                dao.insertFeed(entity)
            } else {
                dao.updateFeed(entity)
                existing.id
            }
            storeItems(feedId, entity.title, parsed.items)
            entity.copy(id = feedId)
        }
    }

    /** Refreshes every direct-RSS subscription sequentially; yujing feeds are not ours. */
    suspend fun syncAll(): Int = withContext(Dispatchers.IO) {
        val feeds = dao.allFeeds().filter { it.sourceType == FeedEntity.TYPE_RSS }
        var stored = 0
        for (feed in feeds) {
            val result = runCatching {
                val parsed = fetchAndParse(feed.url)
                val count = storeItems(feed.id, feed.title, parsed.items)
                dao.markSynced(feed.id, System.currentTimeMillis())
                count
            }
            result.fold(
                onSuccess = { stored += it },
                onFailure = { Log.w(TAG, "sync failed for ${feed.url}", it) },
            )
        }
        stored
    }

    /**
     * Seeds the curated default feeds once, on first launch. The completion
     * flag is written only after the whole list has been attempted, so a run
     * cancelled mid-way (VM cleared on tab switch) retries the missing feeds
     * on the next launch, while a finished run never resurrects feeds the
     * user removed deliberately. Returns feeds added this round.
     */
    suspend fun ensureDefaultFeeds(): Int = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("news_prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_DEFAULTS_SEEDED, false)) return@withContext 0
        var added = 0
        for (default in DEFAULT_FEEDS) {
            val result = runCatching { addFeed(default.url, default.category).getOrThrow() }
            result.fold(
                onSuccess = { added++ },
                onFailure = { Log.w(TAG, "default feed unavailable: ${default.url}", it) },
            )
        }
        prefs.edit().putBoolean(KEY_DEFAULTS_SEEDED, true).apply()
        added
    }

    private fun fetchAndParse(url: String): RssParser.Result {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "Ledu/1.0 (RSS reader)")
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("HTTP ${response.code} for $url")
            val body = response.body ?: throw IOException("empty body for $url")
            return RssParser.parse(body.byteStream())
        }
    }

    private suspend fun storeItems(feedId: Long, feedTitle: String, items: List<RssParser.ItemInfo>): Int {
        val now = System.currentTimeMillis()
        val entities = items
            .filter { it.link.isNotBlank() }
            .map {
                ArticleEntity(
                    feedId = feedId,
                    feedTitle = feedTitle,
                    title = it.title,
                    link = it.link,
                    publishedAt = if (it.publishedAt > 0) it.publishedAt else now,
                    description = it.description,
                )
            }
        if (entities.isEmpty()) return 0
        dao.insertArticles(entities) // unique link index dedupes already-seen items
        return entities.size
    }

    private fun normalize(url: String): String {
        val trimmed = url.trim()
        return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "https://$trimmed"
    }

    companion object {
        private const val TAG = "RssRepository"
        private const val KEY_DEFAULTS_SEEDED = "default_feeds_seeded"
    }
}
