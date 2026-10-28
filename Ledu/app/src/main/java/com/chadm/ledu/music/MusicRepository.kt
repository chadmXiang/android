package com.chadm.ledu.music

import android.content.ContentUris
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import android.provider.DocumentsContract
import java.io.IOException
import java.util.ArrayDeque
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** One offline audio track with a stable identity and a readable playback URI. */
data class AudioTrack(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: Long,
    val durationMs: Long,
    val uri: Uri,
) {
    /** Album art via the legacy albumart provider; null when unknown. */
    val artUri: Uri?
        get() = if (albumId > 0) ContentUris.withAppendedId(ALBUM_ART_URI, albumId) else null

    companion object {
        val ALBUM_ART_URI: Uri = Uri.parse("content://media/external/audio/albumart")
    }
}

data class FolderScanResult(val tracks: List<AudioTrack>, val skippedFiles: Int)

/** Reads indexed audio or the actual documents below a user-authorized directory. */
class MusicRepository(private val context: Context) {

    fun queryAll(): List<AudioTrack> {
        val tracks = mutableListOf<AudioTrack>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
        )
        // Skip ringtones/notification clips shorter than 5 seconds.
        val selection = "${MediaStore.Audio.Media.DURATION} >= ?"
        context.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            arrayOf("5000"),
            "${MediaStore.Audio.Media.TITLE} ASC",
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
            val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                tracks += AudioTrack(
                    id = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id).toString(),
                    title = cursor.getString(titleCol) ?: "未知歌曲",
                    // MediaStore uses "<unknown>" for missing tags; show a friendly label instead.
                    artist = cursor.getString(artistCol)?.let { raw ->
                        if (raw == MediaStore.UNKNOWN_STRING) "未知艺术家" else raw
                    } ?: "未知艺术家",
                    album = cursor.getString(albumCol)?.let { raw ->
                        if (raw == MediaStore.UNKNOWN_STRING) "" else raw
                    } ?: "",
                    albumId = cursor.getLong(albumIdCol),
                    durationMs = cursor.getLong(durationCol),
                    uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id),
                )
            }
        }
        return tracks
    }

    fun folderLabel(tree: Uri): String {
        val id = DocumentsContract.getTreeDocumentId(tree)
        if (tree.authority == "com.android.externalstorage.documents") {
            val volume = id.substringBefore(':')
            val path = id.substringAfter(':', "")
            return "${if (volume == "primary") "内部存储" else volume}/$path"
        }
        val document = DocumentsContract.buildDocumentUriUsingTree(tree, id)
        context.contentResolver.query(
            document, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) return cursor.getString(0) ?: id
        }
        return id
    }

    suspend fun queryTree(tree: Uri): FolderScanResult {
        val resolver = context.contentResolver
        val authority = requireNotNull(tree.authority)
        val pending = ArrayDeque<String>()
        val visited = mutableSetOf<String>()
        val tracks = mutableListOf<AudioTrack>()
        var skipped = 0
        pending.add(DocumentsContract.getTreeDocumentId(tree))
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
        while (pending.isNotEmpty()) {
            currentCoroutineContext().ensureActive()
            val parent = pending.pollLast() ?: break
            if (!visited.add(parent)) continue
            val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
            val cursor = resolver.query(children, projection, null, null, null)
                ?: throw IOException("Directory provider returned no cursor")
            cursor.use {
                val idColumn = it.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                val nameColumn = it.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val mimeColumn = it.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
                while (it.moveToNext()) {
                    currentCoroutineContext().ensureActive()
                    val id = it.getString(idColumn)
                    val name = it.getString(nameColumn).orEmpty()
                    val mime = it.getString(mimeColumn).orEmpty()
                    if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
                        pending.add(id)
                    } else if (mime.startsWith("audio/") || name.substringAfterLast('.', "").lowercase() in AUDIO_EXTENSIONS) {
                        if (!visited.add(id)) continue
                        val uri = DocumentsContract.buildDocumentUriUsingTree(tree, id)
                        val track = readDocumentAudio(
                            DocumentsContract.buildDocumentUri(authority, id).toString(), uri, name,
                        )
                        if (track == null) skipped++ else tracks.add(track)
                    }
                }
            }
        }
        return FolderScanResult(tracks.sortedBy { it.title.lowercase() }, skipped)
    }

    private fun readDocumentAudio(id: String, uri: Uri, name: String): AudioTrack? {
        val metadata = MediaMetadataRetriever()
        try {
            metadata.setDataSource(context, uri)
            val duration = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
                ?: return null
            if (duration < 5000L || metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO) != "yes") {
                return null
            }
            fun text(key: Int): String? = metadata.extractMetadata(key)
                ?.takeUnless { it.isBlank() || it == MediaStore.UNKNOWN_STRING }
            return AudioTrack(
                id = id,
                title = text(MediaMetadataRetriever.METADATA_KEY_TITLE) ?: name.substringBeforeLast('.').ifBlank { "未知歌曲" },
                artist = text(MediaMetadataRetriever.METADATA_KEY_ARTIST) ?: "未知艺术家",
                album = text(MediaMetadataRetriever.METADATA_KEY_ALBUM).orEmpty(),
                albumId = 0L,
                durationMs = duration,
                uri = uri,
            )
        } catch (error: SecurityException) {
            throw error
        } catch (_: IllegalArgumentException) {
            return null
        } catch (_: IOException) {
            return null
        } catch (_: RuntimeException) {
            return null
        } finally {
            metadata.release()
        }
    }

    companion object {
        private val AUDIO_EXTENSIONS = setOf("mp3", "m4a", "aac", "flac", "ogg", "opus", "wav", "wma", "amr", "ape", "aiff", "mid", "midi")
    }
}

fun formatDuration(ms: Long): String {
    if (ms <= 0) return "0:00"
    val totalSeconds = ms / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
