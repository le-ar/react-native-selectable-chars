package com.andrei.reactnativeselectchars

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SelectionGestureTest {
  @Test fun onlyAnOrdinaryActivePointerSequenceMayClearSelectionOnTap() {
    val gesture = SelectionGesture()
    assertFalse(gesture.canClearOnTap)
    gesture.down()
    assertTrue(gesture.canClearOnTap)
    assertFalse(gesture.isDragging)
    gesture.finish()
    assertFalse(gesture.canClearOnTap)
  }

  @Test fun longPressDragAndItsStaleUpCannotBeReinterpretedAsATap() {
    val gesture = SelectionGesture()
    gesture.down()
    gesture.drag()
    assertTrue(gesture.isDragging)
    assertFalse(gesture.canClearOnTap)
    gesture.finish()
    assertFalse(gesture.isDragging)
    assertFalse(gesture.canClearOnTap)
    gesture.finish() // A delayed UP after cancellation still belongs to the old sequence.
    assertFalse(gesture.canClearOnTap)
    gesture.down()
    assertTrue(gesture.canClearOnTap)
  }

  @Test fun handleDragAndCancellationReleaseOwnershipBeforeTheNextGesture() {
    val gesture = SelectionGesture()
    gesture.down()
    gesture.drag()
    gesture.finish() // clear, disable, detach and pointer cancel share this terminal state.
    assertFalse(gesture.isDragging)
    assertFalse(gesture.canClearOnTap)
    gesture.down()
    assertTrue(gesture.canClearOnTap)
  }
}
