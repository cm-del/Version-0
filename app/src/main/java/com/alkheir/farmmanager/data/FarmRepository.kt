package com.alkheir.farmmanager.data

class FarmRepository(private val dao: FarmDao) {
    fun observeCycles() = dao.observeCycles()
    suspend fun addCycle(name: String, startDate: String) = dao.upsertCycle(FlockCycle(name = name, startDate = startDate))
}
