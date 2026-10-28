package com.chadm.ledu.music

import android.app.Application
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import java.io.FileNotFoundException
import java.io.IOException
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Cycle order: all -> one -> shuffle. */
enum class PlaybackMode { REPEAT_ALL, REPEAT_ONE, SHUFFLE }

/**
 * Holds one [MediaController] bound to [PlaybackService] and mirrors the
 * interesting player state into Compose state. The controller is the only
 * write path for playback commands.
 */
class MusicViewModel(app: Application) : AndroidViewModel(app) {

    private val repository = MusicRepository(app)
    private val database = MusicDatabase.get(app)
    private val playlistDao = database.playlistDao()
    private val favoriteDao = database.favoriteDao()
    private val scanPreferences = app.getSharedPreferences("music_scan", Context.MODE_PRIVATE)

    var scanDirectoryUri by mutableStateOf(
        scanPreferences.getString("tree_uri", null)?.let(Uri::parse),
    )
        private set
    var scanDirectoryLabel by mutableStateOf(scanPreferences.getString("tree_label", null))
        private set
    var scanning by mutableStateOf(false)
        private set
    var scanMessage by mutableStateOf<String?>(null)
        private set

    var tracks by mutableStateOf<List<AudioTrack>>(emptyList())
        private set
    var playlists by mutableStateOf<List<PlaylistEntity>>(emptyList())
        private set
    var favoriteTracks by mutableStateOf<List<AudioTrack>>(emptyList())
        private set
    var favoriteTrackIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var queueItems by mutableStateOf<List<MediaItem>>(emptyList())
        private set
    var queueTracks by mutableStateOf<List<AudioTrack>>(emptyList())
        private set
    private var queueTracksById: Map<String, AudioTrack> = emptyMap()
    var queueSource by mutableStateOf("")
        private set
    val currentMetadata: MediaMetadata?
        get() = queueItems.getOrNull(currentIndex)?.mediaMetadata
    val currentTrack: AudioTrack?
        get() = queueItems.getOrNull(currentIndex)?.mediaId?.let { id ->
            queueTracksById[id]
        }

    fun queueTrack(trackId: String): AudioTrack? = queueTracksById[trackId]

    var controller by mutableStateOf<MediaController?>(null)
        private set
    var currentIndex by mutableIntStateOf(0)
        private set
    var isPlaying by mutableStateOf(false)
        private set
    var positionMs by mutableLongStateOf(0L)
        private set
    var durationMs by mutableLongStateOf(0L)
        private set
    var playbackMode by mutableStateOf(PlaybackMode.REPEAT_ALL)
        private set

    private val listener = object : Player.Listener {
        override fun onTimelineChanged(timeline: Timeline, reason: Int) {
            syncQueueFromController()
            syncFromController()
        }

        override fun onPlaylistMetadataChanged(mediaMetadata: MediaMetadata) {
            syncQueueSource()
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int,
        ) {
            syncFromController()
        }

        override fun onIsPlayingChanged(playing: Boolean) {
            syncFromController()
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            syncFromController()
        }

        override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
            syncQueueFromController()
            syncFromController()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            syncFromController()
        }

        override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
            syncFromController()
        }

        override fun onRepeatModeChanged(repeatMode: Int) {
            syncFromController()
        }
    }

    init {
        val token = SessionToken(app, ComponentName(app, PlaybackService::class.java))
        val future = MediaController.Builder(app, token).buildAsync()
        future.addListener({
            val c = future.get()
            controller = c
            c.addListener(listener)
            syncQueueFromController()
            syncFromController()
        }, Runnable::run)
        viewModelScope.launch {
            playlistDao.playlistsFlow().collect { playlists = it }
        }
        viewModelScope.launch {
            favoriteDao.favoritesFlow().collect { snapshots ->
                favoriteTracks = snapshots.map { it.toAudioTrack() }
                favoriteTrackIds = snapshots.mapTo(mutableSetOf()) { it.trackId }
            }
        }
    }

    fun refreshTracks(hasAudioPermission: Boolean) {
        if (scanning) return
        val tree = scanDirectoryUri
        if (tree == null && !hasAudioPermission) {
            scanMessage = "请选择音乐目录，或授权读取本地音乐后刷新"
            return
        }
        scanTracks(tree, persistGrant = false)
    }

    fun selectScanDirectory(uri: Uri) {
        if (scanning) return
        scanTracks(uri, persistGrant = true)
    }

    private fun scanTracks(tree: Uri?, persistGrant: Boolean) {
        scanning = true
        scanMessage = null
        viewModelScope.launch {
            try {
                if (tree != null && persistGrant) {
                    getApplication<Application>().contentResolver.takePersistableUriPermission(
                        tree,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION,
                    )
                }
                val (result, label) = withContext(Dispatchers.IO) {
                    if (tree == null) {
                        FolderScanResult(repository.queryAll(), 0) to null
                    } else {
                        repository.queryTree(tree) to repository.folderLabel(tree)
                    }
                }
                if (tree != null) {
                    scanPreferences.edit()
                        .putString("tree_uri", tree.toString())
                        .putString("tree_label", label)
                        .apply()
                }
                tracks = result.tracks
                scanDirectoryUri = tree
                scanDirectoryLabel = label
                scanMessage = "扫描完成：找到 ${result.tracks.size} 首歌曲，跳过 ${result.skippedFiles} 个无效文件"
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: SecurityException) {
                scanMessage = if (tree == null) {
                    "无法读取本地音乐，请授予音乐权限或选择音乐目录"
                } else {
                    "目录访问权限已失效，请重新选择目录并允许访问；原音乐列表已保留"
                }
            } catch (_: FileNotFoundException) {
                scanMessage = "目录或文件已移动，或存储设备不可用，请连接存储设备后重新选择目录；原音乐列表已保留"
            } catch (_: IllegalArgumentException) {
                scanMessage = "目录提供程序不可用，请确认存储设备已连接并重新选择目录；原音乐列表已保留"
            } catch (_: IOException) {
                scanMessage = "读取音乐失败，请检查存储设备后重试；原音乐列表已保留"
            } catch (_: Exception) {
                scanMessage = "扫描失败，请确认目录可访问后重新选择；原音乐列表已保留"
            } finally {
                scanning = false
            }
        }
    }

    fun play(list: List<AudioTrack>, startIndex: Int, source: String = "本地歌曲") {
        if (list.isEmpty() || startIndex !in list.indices) return
        val c = controller ?: return
        val items = list.map { track ->
            MediaItem.Builder()
                .setUri(track.uri)
                .setMediaId(track.id)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(track.title)
                        .setArtist(track.artist)
                        .setAlbumTitle(track.album)
                        .setArtworkUri(track.artUri)
                        .setDurationMs(track.durationMs)
                        .setExtras(Bundle().apply {
                            putString("ledu.uri", track.uri.toString())
                            putLong("ledu.album_id", track.albumId)
                        })
                        .build(),
                )
                .build()
        }
        c.setPlaylistMetadata(MediaMetadata.Builder().setTitle(source).build())
        c.setMediaItems(items, startIndex, 0L)
        c.prepare()
        c.play()
        syncQueueFromController()
        syncFromController()
    }

    fun togglePlayPause() {
        val c = controller ?: return
        if (c.isPlaying) c.pause() else c.play()
    }

    fun seekToNext() {
        controller?.seekToNextMediaItem()
    }

    fun seekToPrevious() {
        controller?.seekToPreviousMediaItem()
    }

    fun seekTo(position: Long) {
        val c = controller ?: return
        val target = if (durationMs > 0L) position.coerceIn(0L, durationMs)
        else position.coerceAtLeast(0L)
        c.seekTo(target)
        syncFromController()
    }

    /** Cycles repeat-all -> repeat-one -> shuffle, applied to the session player. */
    fun cyclePlaybackMode() {
        val c = controller ?: return
        val next = when (playbackMode) {
            PlaybackMode.REPEAT_ALL -> PlaybackMode.REPEAT_ONE
            PlaybackMode.REPEAT_ONE -> PlaybackMode.SHUFFLE
            PlaybackMode.SHUFFLE -> PlaybackMode.REPEAT_ALL
        }
        when (next) {
            PlaybackMode.REPEAT_ALL -> {
                c.shuffleModeEnabled = false
                c.repeatMode = Player.REPEAT_MODE_ALL
            }
            PlaybackMode.REPEAT_ONE -> {
                c.shuffleModeEnabled = false
                c.repeatMode = Player.REPEAT_MODE_ONE
            }
            PlaybackMode.SHUFFLE -> {
                c.shuffleModeEnabled = true
                c.repeatMode = Player.REPEAT_MODE_ALL
            }
        }
        playbackMode = next
    }

    fun jumpToQueueIndex(index: Int) {
        val c = controller ?: return
        if (index in 0 until c.mediaItemCount) {
            c.seekTo(index, 0L)
            c.play()
        }
        syncFromController()
    }

    fun removeQueueItem(index: Int) {
        val c = controller ?: return
        if (index !in 0 until c.mediaItemCount) return
        c.removeMediaItem(index)
        if (c.mediaItemCount == 0) {
            c.stop()
            c.setPlaylistMetadata(MediaMetadata.EMPTY)
        }
        syncQueueFromController()
        syncFromController()
    }

    fun clearQueue() {
        val c = controller ?: return
        c.stop()
        c.clearMediaItems()
        c.setPlaylistMetadata(MediaMetadata.EMPTY)
        syncQueueFromController()
        syncFromController()
    }

    fun toggleFavorite(track: AudioTrack) {
        viewModelScope.launch {
            favoriteDao.toggle(
                FavoriteTrackEntity(
                    trackId = track.id,
                    uri = track.uri.toString(),
                    title = track.title,
                    artist = track.artist,
                    album = track.album,
                    albumId = track.albumId,
                    durationMs = track.durationMs,
                ),
            )
        }
    }

    // ---- playlists ----

    fun createPlaylist(name: String, onCreated: (Long) -> Unit = {}) {
        if (name.isBlank()) return
        viewModelScope.launch {
            val id = playlistDao.insertPlaylist(PlaylistEntity(name = name.trim()))
            onCreated(id)
        }
    }

    fun deletePlaylist(id: Long) {
        viewModelScope.launch { playlistDao.deletePlaylist(id) }
    }

    fun addToPlaylist(playlistId: Long, tracks: List<AudioTrack>) {
        if (tracks.isEmpty()) return
        viewModelScope.launch {
            playlistDao.insertItems(
                tracks.map {
                    PlaylistItemEntity(
                        playlistId = playlistId,
                        trackId = it.id,
                        uri = it.uri.toString(),
                        title = it.title,
                        artist = it.artist,
                        album = it.album,
                        albumId = it.albumId,
                        durationMs = it.durationMs,
                    )
                },
            )
        }
    }

    fun removeFromPlaylist(playlistId: Long, trackId: String) {
        viewModelScope.launch { playlistDao.deleteItem(playlistId, trackId) }
    }

    fun playlistItemsFlow(playlistId: Long) = playlistDao.itemsFlow(playlistId)

    private fun syncQueueSource() {
        val c = controller ?: return
        queueSource = if (c.mediaItemCount == 0) ""
        else c.playlistMetadata.title?.toString().orEmpty().ifBlank { "本地歌曲" }
    }

    private fun syncQueueFromController() {
        val c = controller ?: return
        queueItems = List(c.mediaItemCount) { c.getMediaItemAt(it) }
        queueTracks = queueItems.mapNotNull { item ->
            val id = item.mediaId.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val metadata = item.mediaMetadata
            val uri = metadata.extras?.getString("ledu.uri") ?: return@mapNotNull null
            AudioTrack(
                id = id,
                title = metadata.title?.toString().orEmpty(),
                artist = metadata.artist?.toString().orEmpty(),
                album = metadata.albumTitle?.toString().orEmpty(),
                albumId = metadata.extras?.getLong("ledu.album_id") ?: 0L,
                durationMs = metadata.durationMs?.coerceAtLeast(0L) ?: 0L,
                uri = Uri.parse(uri),
            )
        }
        queueTracksById = queueTracks.associateBy { it.id }
        syncQueueSource()
    }

    /** Polled from the player screen while playing. */
    fun syncFromController() {
        val c = controller ?: return
        isPlaying = c.isPlaying
        currentIndex = if (c.mediaItemCount > 0) c.currentMediaItemIndex else -1
        positionMs = if (c.mediaItemCount > 0) c.currentPosition.coerceAtLeast(0L) else 0L
        durationMs = if (c.mediaItemCount == 0) 0L
        else if (c.duration > 0L) c.duration else currentMetadata?.durationMs ?: 0L
        playbackMode = when {
            c.shuffleModeEnabled -> PlaybackMode.SHUFFLE
            c.repeatMode == Player.REPEAT_MODE_ONE -> PlaybackMode.REPEAT_ONE
            else -> PlaybackMode.REPEAT_ALL
        }
    }

    override fun onCleared() {
        controller?.release()
        controller = null
        super.onCleared()
    }
}
