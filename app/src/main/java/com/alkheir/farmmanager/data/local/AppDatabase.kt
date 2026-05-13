package com.alkheir.farmmanager.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.alkheir.farmmanager.data.model.CycleEntity
import com.alkheir.farmmanager.data.model.DailyLogEntity
import com.alkheir.farmmanager.data.model.FinancialTransactionEntity
import com.alkheir.farmmanager.data.model.InventoryItemEntity

@Database(
    entities = [
        CycleEntity::class,
        DailyLogEntity::class,
        InventoryItemEntity::class,
        FinancialTransactionEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase()

