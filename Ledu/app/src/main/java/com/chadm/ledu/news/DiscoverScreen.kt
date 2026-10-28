package com.chadm.ledu.news

import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.json.JSONObject

/** One channel from the embedded LingoWhale catalog asset. */
data class CatalogChannel(
    val id: String,
    val name: String,
    val category: String,
    val type: String, // "rss" | "wechat"
    val subs: Long,
    val icon: String,
    val desc: String,
)

/**
 * Channel discovery: vertical categories and curated channel rows from
 * assets/channels_catalog.json, with inline subscribe/unsubscribe.
 * Articles show up in the news timeline right away (sync on subscribe).
 */
@Composable
fun DiscoverScreen(
    onOpenNavigationDrawer: () -> Unit,
    viewModel: NewsViewModel = viewModel(),
) {
    val context = LocalContext.current
    val catalog = remember { loadCatalog(context) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }

    val feeds by viewModel.feeds.collectAsState()
    val subscribedChannelIds = remember(feeds) {
        feeds.mapNotNull { it.channelId }.toSet()
    }
    val feedIdByChannel = remember(feeds) {
        feeds.mapNotNull { f -> f.channelId?.let { it to f.id } }.toMap()
    }


    LaunchedEffect(Unit) { viewModel.clearMessage() }

    var keyword by remember { mutableStateOf("") }
    val visibleChannels = remember(selectedCategory, keyword) {
        catalog.channels
            .filter { selectedCategory == null || it.category == selectedCategory }
            .filter { keyword.isBlank() || it.name.contains(keyword) || it.desc.contains(keyword) }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val compact = maxWidth < 600.dp
        Column(Modifier.fillMaxSize()) {
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
            Text("发现", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text(
                "已订阅 ${subscribedChannelIds.size} 个频道",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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
        OutlinedTextField(
            value = keyword,
            onValueChange = { keyword = it },
            placeholder = { Text("搜索频道") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                unfocusedBorderColor = Color.Transparent,
            ),
            singleLine = true,
            shape = RoundedCornerShape(28.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 12.dp),
        )
        // LingoWhale-style two-pane selection: vertical category rail on the
        // left, scrollable channel list on the right.
        Row(Modifier.weight(1f)) {
            LazyColumn(
                Modifier
                    .width(if (compact) 80.dp else 128.dp)
                    .fillMaxHeight()
                    .background(MaterialTheme.colorScheme.surfaceContainerLow),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                item {
                    CategoryItem(
                        label = "全部",
                        selected = selectedCategory == null,
                        onClick = { selectedCategory = null },
                        compact = compact,
                    )
                }
                items(catalog.categories, key = { it }) { category ->
                    CategoryItem(
                        label = category,
                        selected = selectedCategory == category,
                        onClick = { selectedCategory = if (selectedCategory == category) null else category },
                        compact = compact,
                    )
                }
            }
            LazyColumn(
                Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                contentPadding = PaddingValues(
                    start = 12.dp, end = 12.dp,
                    top = 4.dp, bottom = 12.dp,
                ),
            ) {
                items(visibleChannels, key = { it.id }) { channel ->
                    ChannelRow(
                        channel = channel,
                        subscribed = channel.id in subscribedChannelIds,
                        compact = compact,
                        onSubscribe = { viewModel.subscribeChannel(channel.id, channel.name, channel.category, channel.icon) },
                        onUnsubscribe = {
                            feedIdByChannel[channel.id]?.let { viewModel.unsubscribeFeed(it) }
                        },
                    )
                }
            }
        }
        }
    }
}

@Composable
private fun ChannelRow(
    channel: CatalogChannel,
    compact: Boolean,
    subscribed: Boolean,
    onSubscribe: () -> Unit,
    onUnsubscribe: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = if (compact) 12.dp else 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ChannelIcon(channel, compact)
        Spacer(Modifier.size(if (compact) 8.dp else 12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                channel.name + if (channel.type == "rss") " · RSS" else " · 公众号",
                style = if (compact) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            ChannelDetails(channel)
        }
        Spacer(Modifier.size(6.dp))
        ChannelSubscriptionButton(subscribed, onSubscribe, onUnsubscribe)
    }
}

@Composable
private fun ChannelIcon(channel: CatalogChannel, compact: Boolean) {
    val modifier = Modifier.size(if (compact) 40.dp else 48.dp).clip(RoundedCornerShape(10.dp))
    if (channel.icon.startsWith("http")) {
        AsyncImage(
            model = channel.icon,
            contentDescription = null,
            modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant),
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier.background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                channel.name.take(1),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun ChannelDetails(channel: CatalogChannel) {
    if (channel.desc.isNotBlank()) {
        Text(
            channel.desc,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
    Text(
        formatCount(channel.subs) + " 人已订阅",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun ChannelSubscriptionButton(
    subscribed: Boolean,
    onSubscribe: () -> Unit,
    onUnsubscribe: () -> Unit,
) {
    TextButton(
        onClick = if (subscribed) onUnsubscribe else onSubscribe,
        modifier = Modifier.heightIn(min = 48.dp),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            if (subscribed) "已订阅" else "订阅",
            modifier = Modifier
                .background(
                    if (subscribed) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainerLow,
                    RoundedCornerShape(16.dp),
                )
                .padding(horizontal = 10.dp, vertical = 6.dp),
            color = if (subscribed) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
        )
    }
}

@Composable
private fun CategoryItem(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    compact: Boolean,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 2.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent)
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .heightIn(min = if (compact) 48.dp else 56.dp)
            .padding(horizontal = 4.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (selected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            maxLines = if (compact) 2 else 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}


private fun formatCount(n: Long): String = when {
    n >= 10000 -> String.format("%.1f万", n / 10000.0)
    else -> n.toString()
}

private class Catalog(val categories: List<String>, val channels: List<CatalogChannel>)

private fun loadCatalog(context: android.content.Context): Catalog {
    val text = context.assets.open("channels_catalog.json").bufferedReader().use { it.readText() }
    val root = JSONObject(text)
    val categories = buildList {
        val arr = root.getJSONArray("categories")
        for (i in 0 until arr.length()) add(arr.getString(i))
    }
    val channels = buildList {
        val arr = root.getJSONArray("channels")
        for (i in 0 until arr.length()) {
            val c = arr.getJSONObject(i)
            add(
                CatalogChannel(
                    id = c.getString("id"),
                    name = c.getString("name"),
                    category = c.getString("category"),
                    type = c.getString("type"),
                    subs = c.optLong("subs"),
                    icon = c.optString("icon"),
                    desc = c.optString("desc"),
                ),
            )
        }
    }
    return Catalog(categories, channels)
}
