package com.andrei.reactnativeselectchars

import android.annotation.TargetApi
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.os.Build
import android.view.View
import android.widget.Magnifier

/** Platform loupe on API 28+, bounded direct redraw of the visible native viewport on API 24–27. */
internal class SelectionMagnifier(
  private val host: View,
  private val source: View,
  private val invalidateOverlay: () -> Unit,
) {
  private val density = host.resources.displayMetrics.density
  private var platform: PlatformMagnifier? = null
  private var fallback: LoupeGeometry? = null
  private val path = Path()
  private val bounds = RectF()
  private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = density
    color = 0x66000000
  }

  fun show(x: Float, y: Float) {
    if (!host.isAttachedToWindow || host.windowToken == null) { dismiss(); return }
    val geometry = LoupeGeometry.calculate(source.width, source.height, density, x, y) ?: return
    if (Build.VERSION.SDK_INT >= 28) {
      val magnifier = platform ?: PlatformMagnifier(source, density).also { platform = it }
      magnifier.show(geometry.sourceX, geometry.sourceY)
    } else {
      fallback = geometry
      invalidateOverlay()
    }
  }

  fun dismiss() {
    platform?.dismiss()
    platform = null
    if (fallback != null) { fallback = null; invalidateOverlay() }
  }

  fun drawFallback(canvas: Canvas) {
    val geometry = fallback ?: return
    bounds.set(geometry.left, geometry.top, geometry.left + geometry.width, geometry.top + geometry.height)
    path.reset()
    path.addRoundRect(bounds, 10f * density, 10f * density, Path.Direction.CW)
    canvas.save()
    canvas.clipPath(path)
    canvas.drawColor(Color.WHITE)
    canvas.translate(bounds.centerX() - geometry.sourceX * LoupeGeometry.ZOOM, bounds.centerY() - geometry.sourceY * LoupeGeometry.ZOOM)
    canvas.scale(LoupeGeometry.ZOOM, LoupeGeometry.ZOOM)
    host.background?.draw(canvas)
    // RecyclerView draws only its attached native chunks. No document bitmap, allocation or
    // new text layout is involved; the overlay is a sibling and cannot capture itself.
    source.draw(canvas)
    canvas.restore()
    canvas.drawRoundRect(bounds, 10f * density, 10f * density, border)
  }

  @TargetApi(28)
  private class PlatformMagnifier(view: View, density: Float) {
    @Suppress("DEPRECATION") // API 28 has Magnifier, while Builder was introduced in API 29.
    private val magnifier = if (Build.VERSION.SDK_INT >= 29) {
      Magnifier.Builder(view)
        .setSize((140f * density).toInt(), (56f * density).toInt())
        .setInitialZoom(LoupeGeometry.ZOOM)
        .setCornerRadius(10f * density)
        .setDefaultSourceToMagnifierOffset(0, (-72f * density).toInt())
        .build()
    } else Magnifier(view)
    private var lastX = Float.NaN
    private var lastY = Float.NaN

    fun show(x: Float, y: Float) {
      if (x == lastX && y == lastY) magnifier.update() else magnifier.show(x, y)
      lastX = x
      lastY = y
    }

    fun dismiss() = magnifier.dismiss()
  }
}
