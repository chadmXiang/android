package com.chadm.ledu.news

import android.content.Context
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
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.room.RoomDatabase
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "feeds")
data class FeedEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** RSS: the feed URL; YUJING: "yujing:<channel_id>" (also unique identity). */
    val url: String,
    val title: String,
    val siteLink: String = "",
    val lastSyncAt: Long = 0,
    /** Channel category from the LingoWhale catalog, e.g. AI / 科技; null for custom feeds. */
    val category: String? = null,
    /** "rss" (direct feed URL) or "yujing" (fetched via the LingoWhale API). */
    val sourceType: String = TYPE_RSS,
    val channelId: String? = null,
    val iconUrl: String? = null,
    val description: String = "",
) {
    companion object {
        const val TYPE_RSS = "rss"
        const val TYPE_YUJING = "yujing"
    }
}

@Entity(
    tableName = "articles",
    foreignKeys = [
        ForeignKey(
            entity = FeedEntity::class,
            parentColumns = ["id"],
            childColumns = ["feedId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("feedId"), Index(value = ["link"], unique = true)],
)
data class ArticleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val feedId: Long,
    val feedTitle: String,
    val title: String,
    val link: String,
    val publishedAt: Long,
    val description: String,
    val isRead: Boolean = false,
    /** LingoWhale entry id; null for direct-RSS articles. */
    val entryId: String? = null,
    /** Cover image url (LingoWhale surface_url); null for RSS. */
    val coverUrl: String? = null,
    /** Full article body (html for LingoWhale); null until first open. */
    val content: String? = null,
)

@Dao
interface NewsDao {

    @Query("SELECT * FROM feeds ORDER BY title ASC")
    fun feedsFlow(): Flow<List<FeedEntity>>

    @Query("SELECT * FROM feeds")
    suspend fun allFeeds(): List<FeedEntity>

    @Query("SELECT * FROM feeds WHERE url = :url")
    suspend fun feedByUrl(url: String): FeedEntity?

    @Query("SELECT * FROM feeds WHERE channelId = :channelId")
    suspend fun feedByChannelId(channelId: String): FeedEntity?

    @Insert
    suspend fun insertFeed(feed: FeedEntity): Long

    @Update
    suspend fun updateFeed(feed: FeedEntity)

    @Query("DELETE FROM feeds WHERE id = :id")
    suspend fun deleteFeed(id: Long)

    @Query("UPDATE feeds SET lastSyncAt = :ts WHERE id = :id")
    suspend fun markSynced(id: Long, ts: Long)

    /** Timeline restricted to one category (null = all), newest first. */
    @Query(
        """
        SELECT articles.* FROM articles
        JOIN feeds ON feeds.id = articles.feedId
        WHERE (:category IS NULL OR feeds.category = :category)
        ORDER BY publishedAt DESC
        LIMIT 1000
        """,
    )
    fun timelineFlow(category: String?): Flow<List<ArticleEntity>>

    @Query("SELECT DISTINCT category FROM feeds WHERE category IS NOT NULL ORDER BY category ASC")
    fun categoriesFlow(): Flow<List<String>>

    @Query("SELECT * FROM articles WHERE id = :id")
    fun articleFlow(id: Long): Flow<ArticleEntity?>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertArticles(articles: List<ArticleEntity>): List<Long>

    @Query("UPDATE articles SET isRead = 1 WHERE id = :id")
    suspend fun markRead(id: Long)

    @Query("UPDATE articles SET content = :content WHERE id = :id")
    suspend fun updateArticleContent(id: Long, content: String)
}

@Database(entities = [FeedEntity::class, ArticleEntity::class], version = 3, exportSchema = false)
abstract class NewsDatabase : RoomDatabase() {

    abstract fun newsDao(): NewsDao

    companion object {
        @Volatile
        private var instance: NewsDatabase? = null

        fun get(context: Context): NewsDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    NewsDatabase::class.java,
                    "ledu_news.db",
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .build()
                    .also { instance = it }
            }
    }
}

/**
 * v2 added feed columns (category/sourceType/channelId/iconUrl/description)
 * and articles.entryId; plain ALTER TABLE, data preserved.
 */
private val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE feeds ADD COLUMN category TEXT")
        db.execSQL("ALTER TABLE feeds ADD COLUMN sourceType TEXT NOT NULL DEFAULT 'rss'")
        db.execSQL("ALTER TABLE feeds ADD COLUMN channelId TEXT")
        db.execSQL("ALTER TABLE feeds ADD COLUMN iconUrl TEXT")
        db.execSQL("ALTER TABLE feeds ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE articles ADD COLUMN entryId TEXT")
    }
}

/**
 * v3 added articles.coverUrl (list covers) and articles.content (full body
 * stored on first open); plain ALTER TABLE, data preserved.
 */
private val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE articles ADD COLUMN coverUrl TEXT")
        db.execSQL("ALTER TABLE articles ADD COLUMN content TEXT")
    }
}
