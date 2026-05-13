package com.alkheir.farmmanager.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cycles")
data class CycleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val barnName: String,
    val breed: String,
    val startDate: String,
    val initialChicks: Int,
    val isActive: Boolean = true,
    val synced: Boolean = false
)

@Entity(tableName = "daily_logs")
data class DailyLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val cycleId: Long,
    val date: String,
    val mortalityCount: Int,
    val feedKg: Double,
    val temperatureC: Double,
    val humidity: Double,
    val notes: String = "",
    val synced: Boolean = false
)

@Entity(tableName = "inventory_items")
data class InventoryItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val category: String,
    val quantity: Double,
    val unit: String,
    val reorderLevel: Double,
    val synced: Boolean = false
)

@Entity(tableName = "financial_transactions")
data class FinancialTransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val cycleId: Long?,
    val date: String,
    val type: String,
    val category: String,
    val amount: Double,
    val note: String = "",
    val synced: Boolean = false
)
