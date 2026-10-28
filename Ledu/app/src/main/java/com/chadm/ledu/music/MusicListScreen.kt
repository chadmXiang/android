package com.chadm.ledu.music

import android.content.ActivityNotFoundException
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.MusicOff
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

/** Keep the note visible until album art loads, including missing media-store artwork. */
@Composable
private fun CoverArt(artUri: Any?, size: Int = 48) {
    Box(
        Modifier
            .size(size.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Filled.MusicNote,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size((size / 2).dp),
        )
        if (artUri != null) {
            AsyncImage(
                model = artUri,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MusicListScreen(
    onOpenPlayer: () -> Unit,
    onOpenPlaylist: (Long, String) -> Unit,
    onOpenNavigationDrawer: () -> Unit,
    viewModel: MusicViewModel = viewModel(),
) {
    val permission = rememberAudioPermissionState()
    var pickerError by remember { mutableStateOf<String?>(null) }
    val directoryPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            pickerError = null
            viewModel.selectScanDirectory(uri)
        }
    }
    val chooseDirectory: () -> Unit = {
        try {
            directoryPicker.launch(viewModel.scanDirectoryUri)
        } catch (_: ActivityNotFoundException) {
            pickerError = "设备没有可用的目录选择器"
        }
    }

    LaunchedEffect(permission.granted) {
        viewModel.refreshTracks(permission.granted)
    }

    var favoritesSelected by rememberSaveable { mutableStateOf(false) }
    var moreOpen by remember { mutableStateOf(false) }
    var createOpen by remember { mutableStateOf(false) }
    var deleteFor by remember { mutableStateOf<PlaylistEntity?>(null) }
    var menuForTrack by remember { mutableStateOf<AudioTrack?>(null) }
    val tracks = if (favoritesSelected) viewModel.favoriteTracks else viewModel.tracks
    val source = if (favoritesSelected) "我喜欢" else "本地歌曲"
    val playlists = viewModel.playlists
    val playingTrackId = viewModel.currentTrack?.id
    val colors = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(colors.primaryContainer, colors.surface))),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onOpenNavigationDrawer) {
                Icon(Icons.Filled.Menu, contentDescription = "打开侧栏")
            }
            Spacer(Modifier.width(8.dp))
            Text("我的音乐", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { moreOpen = true }) {
                Icon(Icons.Filled.MoreVert, contentDescription = "更多操作")
            }
        }
        LazyColumn(Modifier.weight(1f)) {
            item(key = "scan_directory") {
                Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
                    Text(
                        viewModel.scanDirectoryLabel?.let { "扫描目录：$it（含子目录）" }
                            ?: "扫描目录：尚未选择",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                    )
                    if (viewModel.scanning) {
                        LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp))
                        Text("正在扫描…", style = MaterialTheme.typography.bodySmall)
                    }
                    (pickerError ?: viewModel.scanMessage)?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                    }
                    if (!permission.granted && viewModel.scanDirectoryUri == null) {
                        Text("选择目录即可扫描，无需授予整个媒体库权限", style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(enabled = !viewModel.scanning, onClick = chooseDirectory) {
                        Text(if (viewModel.scanDirectoryUri == null) "选择扫描目录" else "更换扫描目录")
                    }
                }
            }
            item(key = "library_filters") {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    LibraryCard(
                        title = "本地歌曲",
                        count = viewModel.tracks.size,
                        icon = Icons.Filled.MusicNote,
                        selected = !favoritesSelected,
                        modifier = Modifier.weight(1f),
                        onClick = { favoritesSelected = false },
                    )
                    LibraryCard(
                        title = "我喜欢",
                        count = viewModel.favoriteTracks.size,
                        icon = Icons.Filled.Favorite,
                        selected = favoritesSelected,
                        modifier = Modifier.weight(1f),
                        onClick = { favoritesSelected = true },
                    )
                }
            }
            item(key = "playlists_header") {
                Row(
                    Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("我的歌单", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "${playlists.size}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                    )
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { createOpen = true }) {
                        Icon(Icons.Filled.Add, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("新建")
                    }
                }
            }
            if (playlists.isEmpty()) {
                item(key = "empty_playlists") {
                    Text(
                        "创建歌单，把喜欢的歌曲放在一起",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                    )
                }
            } else {
                itemsIndexed(playlists, key = { _, playlist -> "playlist_${playlist.id}" }) { _, pl ->
                    PlaylistCard(
                        pl = pl,
                        viewModel = viewModel,
                        onClick = { onOpenPlaylist(pl.id, pl.name) },
                        onDelete = { deleteFor = pl },
                    )
                }
            }
            item(key = "songs_header") {
                Row(
                    Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(source, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "共 ${tracks.size} 首",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.onSurfaceVariant,
                        )
                    }
                    TextButton(
                        enabled = tracks.isNotEmpty(),
                        onClick = {
                            viewModel.play(tracks, 0, source)
                            onOpenPlayer()
                        },
                    ) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("播放全部")
                    }
                }
            }
            if (tracks.isEmpty()) {
                item(key = "empty_songs") {
                    EmptyLibrary(favoritesSelected)
                }
            } else {
                itemsIndexed(tracks, key = { _, track -> "track_${track.id}" }) { index, track ->
                    SongRow(
                        track = track,
                        isCurrent = track.id == playingTrackId,
                        isPlaying = viewModel.isPlaying,
                        isFavorite = track.id in viewModel.favoriteTrackIds,
                        onClick = {
                            viewModel.play(tracks, index, source)
                            onOpenPlayer()
                        },
                        onFavorite = { viewModel.toggleFavorite(track) },
                        onMore = { menuForTrack = track },
                    )
                }
            }
            item(key = "bottom_spacing") { Spacer(Modifier.height(16.dp)) }
        }

        MiniPlayer(viewModel = viewModel, onOpenPlayer = onOpenPlayer)
    }

    if (moreOpen) {
        ModalBottomSheet(onDismissRequest = { moreOpen = false }) {
            Text(
                "更多操作",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(start = 24.dp, top = 8.dp, bottom = 16.dp),
            )
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clickable(enabled = !viewModel.scanning) {
                        moreOpen = false
                        chooseDirectory()
                    }
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Refresh, contentDescription = null, tint = colors.primary)
                Spacer(Modifier.width(16.dp))
                Text("扫描歌曲", style = MaterialTheme.typography.bodyLarge)
            }
            if (viewModel.scanDirectoryUri != null) {
                DropdownMenuItem(
                    text = { Text("重新扫描当前目录") },
                    enabled = !viewModel.scanning,
                    onClick = {
                        moreOpen = false
                        viewModel.refreshTracks(permission.granted)
                    },
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
    if (createOpen) {
        CreatePlaylistDialog(
            title = "新建歌单",
            onDismiss = { createOpen = false },
            onConfirm = { name ->
                viewModel.createPlaylist(name)
                createOpen = false
            },
        )
    }
    deleteFor?.let { playlist ->
        AlertDialog(
            onDismissRequest = { deleteFor = null },
            title = { Text("删除歌单") },
            text = { Text("确定删除「${playlist.name}」？只删除歌单，不删除本地歌曲。") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deletePlaylist(playlist.id)
                    deleteFor = null
                }) { Text("删除") }
            },
            dismissButton = {
                TextButton(onClick = { deleteFor = null }) { Text("取消") }
            },
        )
    }
    menuForTrack?.let { track ->
        AddToPlaylistDialog(
            track = track,
            viewModel = viewModel,
            onDismiss = { menuForTrack = null },
        )
    }
}

@Composable
private fun LibraryCard(
    title: String,
    count: Int,
    icon: ImageVector,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
        border = if (selected) BorderStroke(1.dp, MaterialTheme.colorScheme.primary)
        else null,
    ) {
        Column(
            Modifier.heightIn(min = 112.dp).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(28.dp),
            )
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(
                "$count 首",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun EmptyLibrary(favoritesSelected: Boolean) {
    Box(
        Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                if (favoritesSelected) Icons.Filled.FavoriteBorder else Icons.Filled.MusicOff,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                if (favoritesSelected) "还没有喜欢的歌曲，点歌曲右侧的爱心收藏"
                else "所选目录没有可播放的歌曲，请放入音频文件后重新扫描或更换目录",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}


@Composable
private fun SongRow(
    track: AudioTrack,
    isFavorite: Boolean,
    isCurrent: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
    onFavorite: () -> Unit,
    onMore: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            CoverArt(track.artUri)
            if (isCurrent && isPlaying) {
                Icon(
                    Icons.Filled.PlayArrow,
                    contentDescription = "正在播放",
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(20.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape),
                    tint = MaterialTheme.colorScheme.onPrimary,
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                track.title,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = if (isCurrent) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface,
            )
            Text(
                "${track.artist} · ${formatDuration(track.durationMs)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        IconButton(onClick = onFavorite) {
            Icon(
                if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                contentDescription = if (isFavorite) "取消喜欢 ${track.title}" else "喜欢 ${track.title}",
                tint = if (isFavorite) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = onMore) {
            Icon(Icons.Filled.MoreVert, contentDescription = "更多")
        }
    }
}

/** Dialog offering existing playlists + inline creation, then adds the track. */
@Composable
private fun AddToPlaylistDialog(
    track: AudioTrack,
    viewModel: MusicViewModel,
    onDismiss: () -> Unit,
) {
    var showCreate by remember { mutableStateOf(false) }
    if (showCreate) {
        CreatePlaylistDialog(
            title = "新建歌单并添加",
            onDismiss = { showCreate = false },
            onConfirm = { name ->
                viewModel.createPlaylist(name) { id ->
                    viewModel.addToPlaylist(id, listOf(track))
                }
                onDismiss()
            },
        )
        return
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("收藏到歌单") },
        text = {
            val playlists = viewModel.playlists
            if (playlists.isEmpty()) {
                Text("还没有歌单")
            } else {
                LazyColumn(
                    Modifier.heightIn(max = LocalConfiguration.current.screenHeightDp.dp * 0.45f),
                ) {
                    itemsIndexed(playlists, key = { _, pl -> pl.id }) { _, pl ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .clickable {
                                    viewModel.addToPlaylist(pl.id, listOf(track))
                                    onDismiss()
                                }
                                .padding(vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Filled.QueueMusic,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.width(12.dp))
                            Text(
                                pl.name,
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { showCreate = true }) { Text("新建歌单") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("取消") }
        },
    )
}

@Composable
private fun CreatePlaylistDialog(
    title: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                singleLine = true,
                placeholder = { Text("歌单名称") },
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name) },
                enabled = name.isNotBlank(),
            ) { Text("确定") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("取消") }
        },
    )
}


@Composable
private fun PlaylistCard(
    pl: PlaylistEntity,
    viewModel: MusicViewModel,
    onClick: () -> Unit,
    onDelete: () -> Unit,
) {
    val itemsFlow = remember(viewModel, pl.id) { viewModel.playlistItemsFlow(pl.id) }
    val items by itemsFlow.collectAsState(initial = emptyList())
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.QueueMusic,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                pl.name,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${items.size} 首歌曲",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Box {
            IconButton(onClick = { menuOpen = true }) {
                Icon(Icons.Filled.MoreVert, contentDescription = "更多")
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(
                    text = { Text("删除歌单") },
                    onClick = {
                        menuOpen = false
                        onDelete()
                    },
                )
            }
        }
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** Kugou-style persistent bottom bar shown whenever the session has media. */
@Composable
private fun MiniPlayer(viewModel: MusicViewModel, onOpenPlayer: () -> Unit) {
    val item = viewModel.queueItems.getOrNull(viewModel.currentIndex) ?: return
    Surface(tonalElevation = 3.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onOpenPlayer() }
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CoverArt(item.mediaMetadata.artworkUri)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    item.mediaMetadata.title?.toString() ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    item.mediaMetadata.artist?.toString() ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(onClick = { viewModel.togglePlayPause() }) {
                Icon(
                    if (viewModel.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (viewModel.isPlaying) "暂停" else "播放",
                )
            }
            IconButton(onClick = { viewModel.seekToNext() }) {
                Icon(Icons.Filled.SkipNext, contentDescription = "下一首")
            }
        }
    }
}

// Permission only gates the legacy indexed library; directory grants are independent.

private class AudioPermissionState(val granted: Boolean)

@Composable
private fun rememberAudioPermissionState(): AudioPermissionState {
    val context = androidx.compose.ui.platform.LocalContext.current
    val granted = androidx.core.content.ContextCompat.checkSelfPermission(
        context,
        audioPermission(),
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    return AudioPermissionState(granted)
}

private fun audioPermission(): String =
    if (android.os.Build.VERSION.SDK_INT >= 33) {
        android.Manifest.permission.READ_MEDIA_AUDIO
    } else {
        android.Manifest.permission.READ_EXTERNAL_STORAGE
    }
