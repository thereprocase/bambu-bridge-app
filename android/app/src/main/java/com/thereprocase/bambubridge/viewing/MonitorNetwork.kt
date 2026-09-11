package com.thereprocase.bambubridge.viewing

/** Default-network ownership; use callbacks rather than polling connectivity. */
internal class MonitorNetwork<T> {
    private var current: T? = null
    val canConnect: Boolean get() = current != null

    fun available(network: T): Boolean {
        if (current == network) return false
        current = network
        return true
    }

    fun lost(network: T): Boolean {
        if (current != network) return false
        current = null
        return true
    }
}
