package com.thereprocase.bambubridge.viewing

/** One pending deadline, rather than waking the service every five seconds.
 * All methods and scheduled callbacks run on the monitor's serial executor.
 */
internal class MonitorWatchdog(
    private val now: () -> Long,
    private val schedule: (Long, () -> Unit) -> (() -> Unit),
    private val expired: () -> Unit,
) {
    private var cancel: (() -> Unit)? = null
    private var generation = 0
    private var opened = 0L
    private var lastMessage = 0L
    private var hasSnapshot = false

    fun start() {
        stop()
        opened = now(); lastMessage = opened; hasSnapshot = false
        arm(generation, 15_000)
    }

    fun received(snapshot: Boolean = false) {
        lastMessage = now()
        hasSnapshot = hasSnapshot || snapshot
    }

    fun stop() {
        ++generation
        cancel?.invoke(); cancel = null
    }

    private fun arm(current: Int, delay: Long) {
        cancel = schedule(delay) {
            if (generation == current) {
                cancel = null
                val deadline = if (hasSnapshot) lastMessage + 65_000 else opened + 15_000
                val remaining = deadline - now()
                if (remaining > 0) arm(current, remaining)
                else { stop(); expired() }
            }
        }
    }
}
