package com.thereprocase.bambubridge.viewing

import org.junit.Assert.*
import org.junit.Test

class MonitorWatchdogTest {
    private class Clock {
        data class Task(val at: Long, val run: () -> Unit, var cancelled: Boolean = false)
        var now = 0L
        var wakes = 0
        var expirations = 0
        val tasks = mutableListOf<Task>()
        val watchdog = MonitorWatchdog({ now }, { delay, block ->
            val task = Task(now + delay, block); tasks.add(task)
            val cancel: () -> Unit = { task.cancelled = true }
            cancel
        }, { expirations++ })
        fun advance(to: Long) {
            while (true) {
                val next = tasks.filter { !it.cancelled && it.at <= to }.minByOrNull { it.at } ?: break
                tasks.remove(next); now = next.at; wakes++; next.run()
            }
            now = to
        }
    }

    @Test fun heartbeatsCannotExtendTheFirstSnapshotDeadline() {
        val c = Clock(); c.watchdog.start()
        c.advance(10_000); c.watchdog.received()
        c.advance(14_999); assertEquals(0, c.expirations)
        c.advance(15_000); assertEquals(1, c.expirations)
    }

    @Test fun silentEstablishedSocketExpires65SecondsAfterLastMessage() {
        val c = Clock(); c.watchdog.start(); c.watchdog.received(true)
        c.advance(30_000); c.watchdog.received()
        c.advance(94_999); assertEquals(0, c.expirations)
        c.advance(95_000); assertEquals(1, c.expirations)
    }

    @Test fun frequentTelemetryDoesNotScheduleWorkForEveryMessageOrEveryFiveSeconds() {
        val c = Clock(); c.watchdog.start(); c.watchdog.received(true)
        for (second in 1..3600) { c.advance(second * 1000L); c.watchdog.received() }
        assertEquals(0, c.expirations)
        assertTrue("healthy connection should need fewer than 60 deadline checks per hour", c.wakes < 60)
        assertEquals(1, c.tasks.count { !it.cancelled })
    }

    @Test fun cancelledCallbackCannotExpireAReplacementSocket() {
        val c = Clock(); c.watchdog.start()
        val stale = c.tasks.single().run
        c.advance(5000); c.watchdog.start(); c.watchdog.received(true)
        stale()
        c.advance(69_999); assertEquals(0, c.expirations)
        c.advance(70_000); assertEquals(1, c.expirations)
    }

    @Test fun stopLeavesNoRecurringChecks() {
        val c = Clock(); c.watchdog.start(); c.watchdog.stop()
        c.advance(3_600_000)
        assertEquals(0, c.wakes); assertEquals(0, c.expirations)
    }
}
