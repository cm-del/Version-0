package com.alkheir.farmmanager.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface FarmDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCycle(cycle: FlockCycle): Long

    @Query("SELECT * FROM flock_cycles ORDER BY id DESC")
    fun observeCycles(): Flow<List<FlockCycle>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addDailyLog(log: DailyLog)

    @Query("SELECT * FROM daily_logs WHERE cycleId = :cycleId ORDER BY date DESC")
    fun observeDailyLogs(cycleId: Long): Flow<List<DailyLog>>
}
