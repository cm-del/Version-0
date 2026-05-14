package com.alkheir.farmmanager.data

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [FlockCycle::class, DailyLog::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun farmDao(): FarmDao
}
