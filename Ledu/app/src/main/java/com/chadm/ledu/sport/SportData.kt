package com.chadm.ledu.sport

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/**
 * One imported workout (running or cycling) from a Keep log JSON.
 * Distances are meters, durations seconds, timestamps epoch millis.
 */
@Entity(tableName = "workouts")
data class WorkoutEntity(
    @PrimaryKey val logId: String,
    /** "run" or "cycling". */
    val sport: String,
    val startTime: Long,
    val endTime: Long,
    val durationSec: Int,
    val distanceM: Double,
    /** Seconds per km (run pace; for cycling the inverse of avg speed). */
    val avgPaceSec: Int,
    val calories: Int,
    /** Raw Keep header line: date window, city, weather, temperature. */
    val headerDesc: String?,
    /** Track points as [[lat, lon, altitude, timestampSec], ...]; one per km plus start. */
    val trackJson: String?,
    /** Keep sportData grid rows: [{"title":..,"valueStr":..,"unit":..}, ...]. */
    val extrasJson: String?,
    /** Source file name, shown in import diagnostics. */
    val sourceFile: String,
)

@Entity(
    tableName = "splits",
    indices = [androidx.room.Index(value = ["workoutId", "kmIndex"], unique = true)],
)
data class SplitEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val workoutId: String,
    /** 1-based kilometer number. */
    val kmIndex: Int,
    /** Split duration in seconds (delta of cumulative totals). */
    val durationSec: Int,
    /** Split pace in seconds per km. */
    val paceSec: Int,
    val heartRate: Int?,
    val endDistanceM: Double,
)

@Dao
interface SportDao {

    @Query("SELECT * FROM workouts ORDER BY startTime DESC")
    fun workoutsFlow(): Flow<List<WorkoutEntity>>

    @Query("SELECT * FROM workouts WHERE logId = :logId")
    fun workoutFlow(logId: String): Flow<WorkoutEntity?>

    @Query("SELECT * FROM splits WHERE workoutId = :logId ORDER BY kmIndex ASC")
    fun splitsFlow(logId: String): Flow<List<SplitEntity>>

    @Query("SELECT COUNT(*) FROM workouts")
    suspend fun workoutCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertWorkout(workout: WorkoutEntity)

    @Query("DELETE FROM splits WHERE workoutId = :logId")
    suspend fun deleteSplits(logId: String)

    @Insert
    suspend fun insertSplits(splits: List<SplitEntity>)

    @Transaction
    suspend fun replaceWorkout(workout: WorkoutEntity, splits: List<SplitEntity>) {
        upsertWorkout(workout)
        deleteSplits(workout.logId)
        if (splits.isNotEmpty()) insertSplits(splits)
    }
}

@Database(entities = [WorkoutEntity::class, SplitEntity::class], version = 1, exportSchema = false)
abstract class SportDatabase : RoomDatabase() {

    abstract fun sportDao(): SportDao

    companion object {
        @Volatile
        private var instance: SportDatabase? = null

        fun get(context: Context): SportDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    SportDatabase::class.java,
                    "ledu_sport.db",
                ).build().also { instance = it }
            }
    }
}
