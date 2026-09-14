package com.thereprocase.bambubridge.viewing

import org.junit.Assert.*
import org.junit.Test

class MonitorNetworkTest {
    @Test fun initialOfflineStateWaitsForAnAvailableNetwork() {
        val network = MonitorNetwork<Int>()
        assertFalse(network.canConnect)
        assertTrue(network.available(1))
        assertTrue(network.canConnect)
        assertFalse(network.available(1))
    }

    @Test fun oldNetworkLossCannotInterruptANewDefaultNetwork() {
        val network = MonitorNetwork<Int>()
        network.available(1)
        assertTrue(network.available(2))
        assertFalse(network.lost(1))
        assertTrue(network.canConnect)
    }

    @Test fun networkLossStopsRetriesUntilConnectivityReturns() {
        val network = MonitorNetwork<Int>()
        network.available(1)
        assertTrue(network.lost(1))
        assertFalse(network.canConnect)
        assertFalse(network.lost(1))
        assertTrue(network.available(1))
        assertTrue(network.canConnect)
    }
}
