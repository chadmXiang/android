package com.chadm.ledu.music
import android.content.Context
import android.net.Uri
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

/** A user playlist. Songs are stored as snapshots so lists render offline. */
@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(
    tableName = "playlist_items",
    foreignKeys = [
        ForeignKey(
            entity = PlaylistEntity::class,
            parentColumns = ["id"],
            childColumns = ["playlistId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("playlistId"), Index(value = ["playlistId", "trackId"], unique = true)],
)
data class PlaylistItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val playlistId: Long,
    /** Canonical track identity, independent of the URI used for playback. */
    val trackId: String,
    val uri: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: Long,
    val durationMs: Long,
    val addedAt: Long = System.currentTimeMillis(),
) {
    fun toAudioTrack(): AudioTrack = AudioTrack(
        id = trackId,
        title = title,
        artist = artist,
        album = album,
        albumId = albumId,
        durationMs = durationMs,
        uri = Uri.parse(uri),
    )
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY createdAt DESC")
    fun playlistsFlow(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlist_items WHERE playlistId = :playlistId ORDER BY id")
    fun itemsFlow(playlistId: Long): Flow<List<PlaylistItemEntity>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertPlaylist(playlist: PlaylistEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertItems(items: List<PlaylistItemEntity>)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylist(id: Long)

    @Query("DELETE FROM playlist_items WHERE playlistId = :playlistId AND trackId = :trackId")
    suspend fun deleteItem(playlistId: Long, trackId: String)
}

@Entity(tableName = "favorite_tracks")
data class FavoriteTrackEntity(
    @PrimaryKey val trackId: String,
    val uri: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: Long,
    val durationMs: Long,
    val addedAt: Long = System.currentTimeMillis(),
) {
    fun toAudioTrack(): AudioTrack = AudioTrack(
        id = trackId,
        title = title,
        artist = artist,
        album = album,
        albumId = albumId,
        durationMs = durationMs,
        uri = Uri.parse(uri),
    )
}

@Dao
abstract class FavoriteDao {
    @Query("SELECT * FROM favorite_tracks ORDER BY addedAt DESC, trackId DESC")
    abstract fun favoritesFlow(): Flow<List<FavoriteTrackEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM favorite_tracks WHERE trackId = :trackId)")
    protected abstract suspend fun contains(trackId: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    protected abstract suspend fun insert(track: FavoriteTrackEntity)

    @Query("DELETE FROM favorite_tracks WHERE trackId = :trackId")
    protected abstract suspend fun delete(trackId: String)

    @Transaction
    open suspend fun toggle(track: FavoriteTrackEntity) {
        if (contains(track.trackId)) delete(track.trackId) else insert(track)
    }
}

@Database(
    entities = [PlaylistEntity::class, PlaylistItemEntity::class, FavoriteTrackEntity::class],
    version = 3,
    exportSchema = false,
)
abstract class MusicDatabase : RoomDatabase() {

    abstract fun playlistDao(): PlaylistDao
    abstract fun favoriteDao(): FavoriteDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `favorite_tracks` (" +
                        "`trackId` INTEGER NOT NULL, `title` TEXT NOT NULL, " +
                        "`artist` TEXT NOT NULL, `album` TEXT NOT NULL, " +
                        "`albumId` INTEGER NOT NULL, `durationMs` INTEGER NOT NULL, " +
                        "`addedAt` INTEGER NOT NULL, PRIMARY KEY(`trackId`))",
                )
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE `playlist_items_new` (" +
                        "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`playlistId` INTEGER NOT NULL, `trackId` TEXT NOT NULL, " +
                        "`uri` TEXT NOT NULL, `title` TEXT NOT NULL, " +
                        "`artist` TEXT NOT NULL, `album` TEXT NOT NULL, " +
                        "`albumId` INTEGER NOT NULL, `durationMs` INTEGER NOT NULL, " +
                        "`addedAt` INTEGER NOT NULL, " +
                        "FOREIGN KEY(`playlistId`) REFERENCES `playlists`(`id`) " +
                        "ON UPDATE NO ACTION ON DELETE CASCADE)",
                )
                db.execSQL(
                    "INSERT INTO `playlist_items_new` " +
                        "(`id`, `playlistId`, `trackId`, `uri`, `title`, `artist`, " +
                        "`album`, `albumId`, `durationMs`, `addedAt`) " +
                        "SELECT `id`, `playlistId`, " +
                        "'content://media/external/audio/media/' || `trackId`, " +
                        "'content://media/external/audio/media/' || `trackId`, " +
                        "`title`, `artist`, `album`, `albumId`, `durationMs`, `addedAt` " +
                        "FROM `playlist_items`",
                )
                db.execSQL("DROP TABLE `playlist_items`")
                db.execSQL("ALTER TABLE `playlist_items_new` RENAME TO `playlist_items`")
                db.execSQL("CREATE INDEX `index_playlist_items_playlistId` ON `playlist_items` (`playlistId`)")
                db.execSQL(
                    "CREATE UNIQUE INDEX `index_playlist_items_playlistId_trackId` " +
                        "ON `playlist_items` (`playlistId`, `trackId`)",
                )
                db.execSQL(
                    "CREATE TABLE `favorite_tracks_new` (" +
                        "`trackId` TEXT NOT NULL, `uri` TEXT NOT NULL, " +
                        "`title` TEXT NOT NULL, `artist` TEXT NOT NULL, `album` TEXT NOT NULL, " +
                        "`albumId` INTEGER NOT NULL, `durationMs` INTEGER NOT NULL, " +
                        "`addedAt` INTEGER NOT NULL, PRIMARY KEY(`trackId`))",
                )
                db.execSQL(
                    "INSERT INTO `favorite_tracks_new` " +
                        "(`trackId`, `uri`, `title`, `artist`, `album`, `albumId`, `durationMs`, `addedAt`) " +
                        "SELECT 'content://media/external/audio/media/' || `trackId`, " +
                        "'content://media/external/audio/media/' || `trackId`, " +
                        "`title`, `artist`, `album`, `albumId`, `durationMs`, `addedAt` " +
                        "FROM `favorite_tracks`",
                )
                db.execSQL("DROP TABLE `favorite_tracks`")
                db.execSQL("ALTER TABLE `favorite_tracks_new` RENAME TO `favorite_tracks`")
            }
        }

        @Volatile
        private var instance: MusicDatabase? = null

        fun get(context: Context): MusicDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    MusicDatabase::class.java,
                    "ledu_music.db",
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3).build().also { instance = it }
            }
    }
}
