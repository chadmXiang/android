package com.chadm.ledu.news

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.core.net.toUri
import androidx.lifecycle.viewmodel.compose.viewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun formatTime(ms: Long): String =
    SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(ms))

@Composable
fun NewsScreen(
    onOpenArticle: (Long) -> Unit,
    onManage: () -> Unit,
    onOpenNavigationDrawer: () -> Unit,
    viewModel: NewsViewModel = viewModel(),
) {
    val articles by viewModel.timeline.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val filter by viewModel.categoryFilter.collectAsState()

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onOpenNavigationDrawer) {
                Icon(Icons.Filled.Menu, contentDescription = "打开侧栏")
            }
            Spacer(Modifier.size(4.dp))
            Text("新闻", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onManage) { Text("订阅管理") }
            IconButton(onClick = { viewModel.refresh() }) {
                Icon(Icons.Filled.Refresh, contentDescription = "刷新")
            }
        }
        if (viewModel.refreshing) LinearProgressIndicator(Modifier.fillMaxWidth())
        viewModel.message?.let { message ->
            Text(
                message,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.clearMessage() }
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary,
            )
        }

        if (categories.isNotEmpty()) {
            LazyRow(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            ) {
                item {
                    FilterChip(
                        selected = filter == null,
                        onClick = { viewModel.setCategoryFilter(null) },
                        label = { Text("全部") },
                    )
                }
                items(categories) { category ->
                    FilterChip(
                        selected = filter == category,
                        onClick = {
                            viewModel.setCategoryFilter(if (filter == category) null else category)
                        },
                        label = { Text(category) },
                    )
                }
            }
        }
        if (articles.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    "暂无文章，去「发现」添加订阅",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            LazyColumn(
                Modifier
                    .weight(1f)
                    .widthIn(max = 820.dp)
                    .fillMaxWidth()
                    .align(Alignment.CenterHorizontally),
                contentPadding = PaddingValues(bottom = 16.dp),
            ) {
                items(articles, key = { it.id }) { article ->
                    ArticleRow(article = article, onClick = { onOpenArticle(article.id) })
                    HorizontalDivider(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        color = MaterialTheme.colorScheme.outlineVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ArticleRow(article: ArticleEntity, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                article.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = if (article.isRead) FontWeight.Medium else FontWeight.SemiBold,
                color = if (article.isRead) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 24.sp,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    article.feedTitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.size(6.dp))
                Text(
                    formatTime(article.publishedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        article.coverUrl?.takeIf { it.isNotBlank() }?.let { url ->
            Spacer(Modifier.size(16.dp))
            AsyncImage(
                model = resizedImageUrl(url, widthPx = with(LocalDensity.current) { 88.dp.roundToPx() }),
                contentDescription = null,
                modifier = Modifier
                    .size(width = 88.dp, height = 76.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

@Composable
fun ManageFeedsScreen(
    onBack: () -> Unit,
    viewModel: NewsViewModel = viewModel(),
) {
    val feeds by viewModel.feeds.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
            }
            Text("订阅管理", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Filled.Add, contentDescription = "添加订阅")
            }
        }
        viewModel.message?.let { message ->
            Text(
                message,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.clearMessage() }
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary,
            )
        }

        if (feeds.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("还没有订阅，点右上角 + 添加 RSS 源", style = MaterialTheme.typography.bodyMedium)
            }
        } else {
            // LingoWhale-style management: category filter chips on top,
            // vertically scrolling feed rows with a subscribe toggle.
            var selectedCategory by remember { mutableStateOf<String?>(null) }
            val categories = remember(feeds) {
                feeds.map { it.category?.takeIf { c -> c.isNotBlank() } ?: "未分类" }
                    .distinct()
                    .sortedBy { if (it == "未分类") "\uFFFF" else it }
            }
            val visible = remember(feeds, selectedCategory) {
                if (selectedCategory == null) feeds
                else feeds.filter { (it.category?.takeIf { c -> c.isNotBlank() } ?: "未分类") == selectedCategory }
            }
            LazyRow(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            ) {
                item {
                    FilterChip(
                        selected = selectedCategory == null,
                        onClick = { selectedCategory = null },
                        label = { Text("全部") },
                    )
                }
                items(categories, key = { it }) { category ->
                    FilterChip(
                        selected = selectedCategory == category,
                        onClick = { selectedCategory = if (selectedCategory == category) null else category },
                        label = { Text(category) },
                    )
                }
            }
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 16.dp),
            ) {
                items(visible, key = { it.id }) { feed ->
                    FeedRow(
                        feed = feed,
                        onUnsubscribe = { viewModel.unsubscribeFeed(feed.id) },
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        var url by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("添加 RSS 订阅") },
            text = {
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("RSS 地址") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.addFeed(url)
                        showAddDialog = false
                    },
                ) { Text("订阅") }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) { Text("取消") }
            },
        )
    }
}

@Composable
private fun FeedRow(feed: FeedEntity, onUnsubscribe: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHighest),
            contentAlignment = Alignment.Center,
        ) {
            if (feed.iconUrl != null) {
                AsyncImage(
                    model = feed.iconUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Text(
                    feed.title.take(1),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
        Spacer(Modifier.size(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                feed.title,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                feed.description.ifBlank { feed.siteLink.ifBlank { feed.url } },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        FilledTonalButton(
            onClick = onUnsubscribe,
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
        ) { Text("已订阅") }
    }
}

@Composable
private fun SourceTypeBadge(sourceType: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            if (sourceType == FeedEntity.TYPE_YUJING) "语鲸" else "RSS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    }
}

@Composable
fun ArticleScreen(
    articleId: Long,
    onBack: () -> Unit,
    viewModel: NewsViewModel = viewModel(),
) {
    val article by viewModel.articleFlow(articleId).collectAsState(initial = null)
    val context = LocalContext.current

    LaunchedEffect(articleId) { viewModel.markRead(articleId) }

    val a = article
    if (a == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("加载中…", style = MaterialTheme.typography.bodyMedium)
        }
        return
    }

    // Yujing articles store only the abstract until opened; pull full body once.
    LaunchedEffect(a.id) { viewModel.loadArticleContent(a) }

    val body = a.content ?: a.description
    val blocks = remember(body) {
        ArticleBodyParser.parseHtml(body).ifEmpty {
            ArticleBodyParser.parsePlainText(body).ifEmpty {
                listOf(ArticleBlock.Paragraph(RssParser.stripHtml(body)))
            }
        }
    }
    val loadingBody = a.entryId != null && a.content == null

    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        val imageWidthPx = with(LocalDensity.current) { minOf(maxWidth, 760.dp).roundToPx() }
        // centered reading column: full width on phones, capped on the wide
        // car display so line lengths stay readable
        Column(
            Modifier
                .widthIn(max = 760.dp)
                .fillMaxWidth(),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                }
                Spacer(Modifier.weight(1f))
                // yujing links are synthetic ids, not openable URLs
                if (a.link.isNotBlank() && a.entryId == null) {
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, a.link.toUri()))
                    }) { Text("浏览器打开") }
                }
            }

            Text(
                a.title,
                modifier = Modifier.padding(top = 12.dp),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                lineHeight = 34.sp,
            )
            Row(
                Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    a.feedTitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.size(12.dp))
                Text(
                    formatTime(a.publishedAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(Modifier.height(24.dp))

            blocks.forEach { block ->
                when (block) {
                    is ArticleBlock.Paragraph -> Text(
                        block.text,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 17.sp,
                            lineHeight = 30.sp,
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    is ArticleBlock.Image -> AsyncImage(
                        model = resizedImageUrl(block.url, widthPx = imageWidthPx),
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentScale = ContentScale.Fit,
                    )
                }
                if (block is ArticleBlock.Paragraph) Spacer(Modifier.height(20.dp))
            }

            if (loadingBody) {
                Spacer(Modifier.height(24.dp))
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                    )
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "正在加载全文…",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(28.dp))
            Text(
                "— 完 —",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
            Spacer(Modifier.height(40.dp))
        }
    }
}
