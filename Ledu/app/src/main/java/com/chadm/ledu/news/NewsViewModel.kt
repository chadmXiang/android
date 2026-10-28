package com.chadm.ledu.news

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch

class NewsViewModel(app: Application) : AndroidViewModel(app) {

    private val repository = RssRepository(app)
    private val yujing = YujingRepository(app)

    val feeds = repository.feedsFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Categories present among subscribed feeds, for the filter chips. */
    val categories = repository.categoriesFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** null = all categories; otherwise the timeline is filtered to it. */
    val categoryFilter = MutableStateFlow<String?>(null)

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val timeline = categoryFilter
        .flatMapLatest { repository.timelineFlow(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun setCategoryFilter(category: String?) {
        categoryFilter.value = category
    }

    var refreshing by mutableStateOf(false)
        private set

    /** One-line toast-like status message; null when idle. */
    var message by mutableStateOf<String?>(null)

    init {
        viewModelScope.launch {
            refreshing = true
            // NonCancellable: leaving the news tab must not abort first-launch
            // seeding half-way; the flag in RssRepository makes it once-only.
            val seeded = withContext(NonCancellable) { repository.ensureDefaultFeeds() }
            val synced = repository.syncAll()
            val yujingSynced = syncYujing()
            refreshing = false
            if (seeded > 0) message = "已导入 $seeded 个默认订阅，同步 ${synced + yujingSynced} 条"
        }
    }

    fun refresh() {
        if (refreshing) return
        viewModelScope.launch {
            refreshing = true
            val rss = repository.syncAll()
            val yj = syncYujing()
            message = if (rss + yj == 0) "没有新增文章" else "已同步 ${rss + yj} 条"
            refreshing = false
        }
    }

    private suspend fun syncYujing(): Int {
        val channels = repository.allFeeds().filter { it.sourceType == FeedEntity.TYPE_YUJING }
        return yujing.syncChannels(channels)
    }

    fun addFeed(url: String) {
        if (url.isBlank()) {
            message = "地址不能为空"
            return
        }
        viewModelScope.launch {
            refreshing = true
            val result = repository.addFeed(url)
            message = result.fold(
                onSuccess = { feed -> "已订阅：${feed.title}" },
                onFailure = { throwable -> "订阅失败：${throwable.message}" },
            )
            refreshing = false
        }
    }

    /** Subscribes a LingoWhale catalog channel and pulls its stream right away. */
    fun subscribeChannel(channelId: String, name: String, category: String, iconUrl: String?) {
        viewModelScope.launch {
            if (repository.feedByChannelId(channelId) != null) {
                message = "已订阅过 $name"
                return@launch
            }
            val feed = repository.insertFeed(
                FeedEntity(
                    url = "yujing:$channelId",
                    title = name,
                    category = category,
                    sourceType = FeedEntity.TYPE_YUJING,
                    channelId = channelId,
                    iconUrl = iconUrl,
                ),
            )
            val stored = yujing.syncChannels(listOf(feed))
            message = "已订阅 $name，同步 $stored 条"
        }
    }

    /** Unsubscribes a feed; CASCADE removes its articles from the timeline. */
    fun unsubscribeFeed(id: Long) {
        viewModelScope.launch { repository.deleteFeed(id) }
    }

    /** Loads the full body for a yujing article (kept abstract until first open). */
    fun loadArticleContent(article: ArticleEntity) {
        val entryId = article.entryId ?: return
        if (article.content != null) return // full body already stored
        viewModelScope.launch {
            val content = yujing.fetchContent(entryId) ?: run {
                message = "全文加载失败"
                return@launch
            }
            repository.updateArticleContent(article.id, content)
        }
    }

    fun markRead(id: Long) {
        viewModelScope.launch { repository.markRead(id) }
    }

    fun articleFlow(id: Long) = repository.articleFlow(id)

    fun clearMessage() {
        message = null
    }
}
