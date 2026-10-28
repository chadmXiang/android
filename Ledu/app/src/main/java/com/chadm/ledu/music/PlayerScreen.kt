package com.chadm.ledu.music

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LibraryAdd
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun PlayerScreen(
    onBack: () -> Unit,
    viewModel: MusicViewModel = viewModel(),
) {
    val controller = viewModel.controller
    var queueOpen by remember { mutableStateOf(false) }
    var playlistTracks by remember { mutableStateOf<List<AudioTrack>?>(null) }
    val current = viewModel.currentTrack
    val metadata = viewModel.currentMetadata
    val colors = MaterialTheme.colorScheme

    LaunchedEffect(controller, viewModel.isPlaying) {
        viewModel.syncFromController()
        while (viewModel.isPlaying && currentCoroutineContext().isActive) {
            delay(500)
            viewModel.syncFromController()
        }
    }

    BoxWithConstraints(
        Modifier.fillMaxSize().background(
            Brush.verticalGradient(listOf(colors.primaryContainer.copy(alpha = 0.65f), colors.surface)),
        ),
    ) {
        val landscape = maxWidth > maxHeight
        val discSize = if (landscape) {
            minOf(maxWidth * 0.36f, (maxHeight - 112.dp).coerceAtLeast(80.dp), 360.dp)
        } else {
            minOf(maxWidth * 0.76f, (maxHeight - 310.dp).coerceAtLeast(80.dp), 360.dp)
        }

        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                }
                Column(
                    Modifier.weight(1f).padding(horizontal = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        metadata?.title?.toString()?.ifBlank { "未知歌曲" }
                            ?: if (controller == null) "正在连接播放服务…" else "未在播放",
                        style = MaterialTheme.typography.titleLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        metadata?.artist?.toString().orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                IconButton(
                    onClick = { current?.let { playlistTracks = listOf(it) } },
                    enabled = current != null,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.Filled.PlaylistAdd, contentDescription = "添加当前歌曲到歌单")
                }
            }

            if (viewModel.queueItems.isEmpty()) {
                Column(
                    Modifier.weight(1f).fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        Icons.Filled.MusicNote, contentDescription = null,
                        tint = colors.primary, modifier = Modifier.size(72.dp),
                    )
                    Spacer(Modifier.height(20.dp))
                    Text(if (controller == null) "正在连接…" else "播放队列为空")
                    Spacer(Modifier.height(8.dp))
                    Text("返回音乐库，选择本地歌曲开始播放", color = colors.onSurfaceVariant)
                    TextButton(onClick = onBack, modifier = Modifier.heightIn(min = 48.dp)) {
                        Text("返回音乐库")
                    }
                }
            } else if (landscape) {
                Row(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(28.dp),
                ) {
                    PlayerDisc(metadata?.artworkUri, Modifier.size(discSize))
                    Column(
                        Modifier.weight(1f).verticalScroll(rememberScrollState()),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        TrackActions(viewModel)
                        Spacer(Modifier.height(12.dp))
                        PlayerSeekBar(viewModel)
                        ControlRow(viewModel, onOpenQueue = { queueOpen = true })
                    }
                }
            } else {
                Box(
                    Modifier.weight(1f).fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    PlayerDisc(metadata?.artworkUri, Modifier.size(discSize))
                }
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    TrackActions(viewModel)
                    Spacer(Modifier.height(12.dp))
                    PlayerSeekBar(viewModel)
                    ControlRow(viewModel, onOpenQueue = { queueOpen = true })
                }
            }
        }
    }

    if (queueOpen) QueueSheet(viewModel, onDismiss = { queueOpen = false })
    playlistTracks?.let { tracks ->
        PlayerPlaylistDestinationDialog(tracks, viewModel, onDismiss = { playlistTracks = null })
    }
}

@Composable
private fun PlayerDisc(artwork: Any?, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val radius = size.minDimension / 2f
            drawCircle(
                Brush.radialGradient(
                    listOf(colors.primaryContainer, colors.primary.copy(alpha = 0.65f), colors.primaryContainer),
                    radius = radius,
                ),
                radius = radius,
            )
            for (ring in 0..12) {
                drawCircle(
                    colors.onPrimaryContainer.copy(alpha = 0.08f),
                    radius = radius * (0.48f + ring * 0.037f),
                    style = Stroke(width = 1.dp.toPx()),
                )
            }
            drawArc(
                colors.surface.copy(alpha = 0.45f), startAngle = 205f, sweepAngle = 56f,
                useCenter = false, style = Stroke(width = 3.dp.toPx()),
            )
        }
        Box(
            Modifier.fillMaxSize(0.72f).clip(CircleShape).background(colors.surface.copy(alpha = 0.85f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.MusicNote, contentDescription = null,
                tint = colors.primary, modifier = Modifier.fillMaxSize(0.38f),
            )
            if (artwork != null) {
                AsyncImage(
                    model = artwork, contentDescription = "专辑封面",
                    contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Box(Modifier.size(12.dp).clip(CircleShape).background(colors.surface))
    }
}

@Composable
private fun TrackActions(viewModel: MusicViewModel) {
    val track = viewModel.currentTrack
    Row(
        Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text("本地音乐", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.size(16.dp))
        FavoriteButton(track, viewModel)
    }
}

@Composable
private fun FavoriteButton(track: AudioTrack?, viewModel: MusicViewModel) {
    val favorite = track?.id in viewModel.favoriteTrackIds
    IconButton(
        onClick = { track?.let { viewModel.toggleFavorite(it) } },
        enabled = track != null,
        modifier = Modifier.size(48.dp),
    ) {
        Icon(
            if (favorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
            contentDescription = if (favorite) "取消喜欢" else "喜欢这首歌",
            tint = if (favorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun PlayerSeekBar(viewModel: MusicViewModel) {
    val currentId = viewModel.queueItems.getOrNull(viewModel.currentIndex)?.mediaId
    var dragging by remember(currentId, viewModel.currentIndex) { mutableStateOf(false) }
    var dragPosition by remember(currentId, viewModel.currentIndex) { mutableLongStateOf(0L) }
    val duration = viewModel.durationMs.coerceAtLeast(0L)
    val position = if (dragging) dragPosition else viewModel.positionMs
    Slider(
        value = position.coerceIn(0L, duration).toFloat(),
        onValueChange = { dragging = true; dragPosition = it.toLong() },
        onValueChangeFinished = {
            if (dragging) viewModel.seekTo(dragPosition)
            dragging = false
        },
        enabled = duration > 0L,
        valueRange = 0f..duration.coerceAtLeast(1L).toFloat(),
        modifier = Modifier.fillMaxWidth(),
    )
    Row(Modifier.fillMaxWidth()) {
        Text(formatDuration(position), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.weight(1f))
        Text(formatDuration(duration), style = MaterialTheme.typography.bodySmall)
    }
    Spacer(Modifier.height(16.dp))
}

@Composable
private fun ControlRow(viewModel: MusicViewModel, onOpenQueue: () -> Unit) {
    Row(
        Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = { viewModel.cyclePlaybackMode() }, modifier = Modifier.size(48.dp)) {
            Icon(
                when (viewModel.playbackMode) {
                    PlaybackMode.SHUFFLE -> Icons.Filled.Shuffle
                    PlaybackMode.REPEAT_ONE -> Icons.Filled.RepeatOne
                    PlaybackMode.REPEAT_ALL -> Icons.Filled.Repeat
                },
                contentDescription = when (viewModel.playbackMode) {
                    PlaybackMode.SHUFFLE -> "随机播放"
                    PlaybackMode.REPEAT_ONE -> "单曲循环"
                    PlaybackMode.REPEAT_ALL -> "列表循环"
                },
                tint = MaterialTheme.colorScheme.primary,
            )
        }
        IconButton(onClick = { viewModel.seekToPrevious() }, modifier = Modifier.size(48.dp)) {
            Icon(Icons.Filled.SkipPrevious, contentDescription = "上一首", modifier = Modifier.size(32.dp))
        }
        FilledIconButton(
            onClick = { viewModel.togglePlayPause() }, modifier = Modifier.size(64.dp), shape = CircleShape,
        ) {
            Icon(
                if (viewModel.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (viewModel.isPlaying) "暂停" else "播放",
                modifier = Modifier.size(36.dp),
            )
        }
        IconButton(onClick = { viewModel.seekToNext() }, modifier = Modifier.size(48.dp)) {
            Icon(Icons.Filled.SkipNext, contentDescription = "下一首", modifier = Modifier.size(32.dp))
        }
        IconButton(onClick = onOpenQueue, modifier = Modifier.size(48.dp)) {
            Icon(Icons.Filled.QueueMusic, contentDescription = "当前播放队列")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QueueSheet(viewModel: MusicViewModel, onDismiss: () -> Unit) {
    var confirmClear by remember { mutableStateOf(false) }
    var playlistTracks by remember { mutableStateOf<List<AudioTrack>?>(null) }
    val maxListHeight = LocalConfiguration.current.screenHeightDp.dp * 0.6f
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("当前播放", style = MaterialTheme.typography.titleLarge)
                Text(
                    if (viewModel.queueItems.isEmpty()) "0 首"
                    else "${viewModel.queueSource} · ${viewModel.queueItems.size} 首",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(
                onClick = { playlistTracks = viewModel.queueTracks.toList() },
                enabled = viewModel.queueTracks.isNotEmpty(), modifier = Modifier.size(48.dp),
            ) {
                Icon(Icons.Filled.LibraryAdd, contentDescription = "保存队列到歌单")
            }
            IconButton(
                onClick = { confirmClear = true }, enabled = viewModel.queueItems.isNotEmpty(),
                modifier = Modifier.size(48.dp),
            ) {
                Icon(Icons.Filled.DeleteOutline, contentDescription = "清空播放队列")
            }
        }
        if (viewModel.queueItems.isEmpty()) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("队列已清空")
                Spacer(Modifier.height(8.dp))
                Text("播放已停止，可返回音乐库重新选歌", color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 48.dp)) { Text("返回播放器") }
            }
        } else {
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = maxListHeight)) {
                itemsIndexed(viewModel.queueItems) { index, item ->
                    val isCurrent = index == viewModel.currentIndex
                    val snapshot = viewModel.queueTrack(item.mediaId)
                    Row(
                        Modifier.fillMaxWidth().clickable { viewModel.jumpToQueueIndex(index) }
                            .padding(start = 12.dp, end = 4.dp).heightIn(min = 68.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(32.dp), contentAlignment = Alignment.Center) {
                            if (isCurrent) {
                                Icon(
                                    Icons.Filled.PlayArrow, contentDescription = "当前歌曲",
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            } else {
                                Text("${index + 1}", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                            Text(
                                item.mediaMetadata.title?.toString().orEmpty().ifBlank { "未知歌曲" },
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                                color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                item.mediaMetadata.artist?.toString().orEmpty(),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        }
                        FavoriteButton(snapshot, viewModel)
                        IconButton(
                            onClick = { viewModel.removeQueueItem(index) }, modifier = Modifier.size(48.dp),
                        ) {
                            Icon(Icons.Filled.Close, contentDescription = "从队列移除")
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(20.dp))
    }

    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text("清空播放队列？") },
            text = { Text("播放将停止，歌单和喜欢的歌曲不会被删除。") },
            confirmButton = {
                TextButton(onClick = { viewModel.clearQueue(); confirmClear = false }) { Text("清空") }
            },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("取消") } },
        )
    }
    playlistTracks?.let { tracks ->
        PlayerPlaylistDestinationDialog(tracks, viewModel, onDismiss = { playlistTracks = null })
    }
}

@Composable
private fun PlayerPlaylistDestinationDialog(
    tracks: List<AudioTrack>,
    viewModel: MusicViewModel,
    onDismiss: () -> Unit,
) {
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    val maxListHeight = LocalConfiguration.current.screenHeightDp.dp * 0.4f
    if (creating) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("新建歌单并添加") },
            text = {
                OutlinedTextField(
                    value = name, onValueChange = { name = it }, singleLine = true,
                    label = { Text("歌单名称") }, modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    enabled = name.isNotBlank(),
                    onClick = {
                        viewModel.createPlaylist(name) { id -> viewModel.addToPlaylist(id, tracks) }
                        onDismiss()
                    },
                ) { Text("创建并添加") }
            },
            dismissButton = { TextButton(onClick = { creating = false }) { Text("返回") } },
        )
    } else {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("添加到歌单 · ${tracks.size} 首") },
            text = {
                if (viewModel.playlists.isEmpty()) {
                    Text("还没有歌单，创建一个来保存这些歌曲")
                } else {
                    LazyColumn(Modifier.fillMaxWidth().heightIn(max = maxListHeight)) {
                        items(viewModel.playlists, key = { it.id }) { playlist ->
                            Row(
                                Modifier.fillMaxWidth().clickable {
                                    viewModel.addToPlaylist(playlist.id, tracks)
                                    onDismiss()
                                }.heightIn(min = 56.dp).padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.QueueMusic, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.size(12.dp))
                                Text(playlist.name, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { creating = true }) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Text("新建歌单")
                }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
        )
    }
}
