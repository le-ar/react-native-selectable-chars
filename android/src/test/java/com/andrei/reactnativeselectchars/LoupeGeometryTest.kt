package com.andrei.reactnativeselectchars

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LoupeGeometryTest {
  @Test fun sourceNearTheTopPlacesTheLoupeBelowTheFinger() {
    val geometry = LoupeGeometry.calculate(400, 800, 1f, 200f, 10f)!!
    assertTrue(geometry.top > geometry.sourceY)
    assertEquals(140f, geometry.width, 0f)
    assertEquals(56f, geometry.height, 0f)
    assertEquals(1.5f, LoupeGeometry.ZOOM, 0f)
  }

  @Test fun sourceNearTheBottomPlacesTheLoupeAboveTheFinger() {
    val geometry = LoupeGeometry.calculate(400, 800, 1f, 200f, 790f)!!
    assertTrue(geometry.top + geometry.height < geometry.sourceY)
  }

  @Test fun loupeAndSourceRemainBoundedAtEveryViewportEdgeAndDensity() {
    for (density in listOf(1f, 2f, 3.5f)) {
      for (x in listOf(-50f, 0f, 400f, 1000f)) for (y in listOf(-100f, 0f, 800f, 1000f)) {
        val geometry = LoupeGeometry.calculate(400, 800, density, x, y)!!
        assertTrue(geometry.left >= 0f && geometry.left + geometry.width <= 400f)
        assertTrue(geometry.top >= 0f && geometry.top + geometry.height <= 800f)
        assertTrue(geometry.sourceX in 0f..400f && geometry.sourceY in 0f..800f)
      }
    }
  }

  @Test fun tinyAndUnlaidOutViewsCannotRequestAnUnboundedWindow() {
    assertNull(LoupeGeometry.calculate(0, 100, 3f, 5f, 5f))
    assertNull(LoupeGeometry.calculate(100, 0, 3f, 5f, 5f))
    for (size in listOf(1, 10, 30)) {
      val geometry = LoupeGeometry.calculate(size, size, 3f, -100f, 1000f)!!
      assertTrue(geometry.width > 0f && geometry.height > 0f)
      assertTrue(geometry.left >= 0f && geometry.left + geometry.width <= size)
      assertTrue(geometry.top >= 0f && geometry.top + geometry.height <= size)
    }
  }
}
