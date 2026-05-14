package com.alkheir.farmmanager.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "flock_cycles")
data class FlockCycle(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val startDate: String,
    val status: String = "ACTIVE"
)

@Entity(tableName = "daily_logs")
data class DailyLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val cycleId: Long,
    val date: String,
    val mortality: Int,
    val feedKg: Double,
    val notes: String
)
