package com.thereprocase.bambubridge.viewing

import android.content.Context
import android.os.SystemClock
import android.view.Gravity
import android.view.TextureView
import android.widget.FrameLayout
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import okhttp3.HttpUrl
import java.util.concurrent.atomic.AtomicBoolean

/** Uses the same scoped, pinned HTTPS client as the rest of the paired app. */
@androidx.media3.common.util.UnstableApi
class HlsCamera(
    context: Context,
    private val transport: ViewingTransport,
    private val url: HttpUrl,
    private val frame: (Double, Int, Int) -> Unit,
    private val failure: (String) -> Unit,
) : FrameLayout(context) {
    private val texture = TextureView(context)
    private var videoWidth = 1280
    private var videoHeight = 720
    private val closed = AtomicBoolean(false)
    private val player = ExoPlayer.Builder(context).build()
    @Volatile private var lastFrame = SystemClock.elapsedRealtime()
    private var windowAt = lastFrame
    private var frames = 0
    private var first = true
    private val watchdog = object : Runnable {
        override fun run() {
            if (closed.get()) return
            if (SystemClock.elapsedRealtime() - lastFrame > 15000) fail("network")
            else postDelayed(this, 2000)
        }
    }

    init {
        require(url.isHttps)
        addView(texture, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.CENTER))
        val client = transport.client(url).newBuilder().addInterceptor { chain ->
            val request = chain.request()
            HlsScope.requireAllowed(url, request.url)
            chain.proceed(request.newBuilder().header("Authorization", "Bearer ${transport.token}").build())
        }.build()
        val source = HlsMediaSource.Factory(OkHttpDataSource.Factory(client)).createMediaSource(
            MediaItem.Builder().setUri(url.toString()).setLiveConfiguration(
                MediaItem.LiveConfiguration.Builder().setTargetOffsetMs(1500).build()).build())
        player.setVideoTextureView(texture)
        player.addListener(object : Player.Listener {
            override fun onVideoSizeChanged(size: VideoSize) {
                videoWidth = size.width; videoHeight = size.height; fit()
            }
            override fun onPlayerError(error: PlaybackException) {
                fail(ViewingTransport.failure(error))
            }
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) fail("network")
            }
        })
        player.setVideoFrameMetadataListener { _, _, _, _ ->
            val now = SystemClock.elapsedRealtime()
            lastFrame = now; frames++
            if (first || now - windowAt >= 1000) {
                val fps = if (now > windowAt) frames * 1000.0 / (now - windowAt) else 0.0
                val initial = first; first = false; frames = 0; windowAt = now
                post { if (!closed.get()) frame(if (initial) 0.0 else fps, videoWidth, videoHeight) }
            }
        }
        player.setMediaSource(source); player.prepare(); player.playWhenReady = true
        postDelayed(watchdog, 2000)
    }

    private fun fail(state: String) {
        if (!closed.get()) { close(); failure(state) }
    }
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) { fit() }
    private fun fit() {
        if (width <= 0 || height <= 0 || videoWidth <= 0 || videoHeight <= 0) return
        val factor = minOf(width.toFloat()/videoWidth, height.toFloat()/videoHeight)
        texture.layoutParams = LayoutParams((videoWidth*factor).toInt(), (videoHeight*factor).toInt(), Gravity.CENTER)
    }
    fun close() {
        if (closed.getAndSet(true)) return
        removeCallbacks(watchdog); player.release(); transport.close()
    }
}
