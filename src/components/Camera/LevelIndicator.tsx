"use client";

import { useEffect, useState, useCallback } from "react";

interface LevelIndicatorProps {
  onLevelChange?: (isLevel: boolean) => void;
}

export default function LevelIndicator({ onLevelChange }: LevelIndicatorProps) {
  const [orientation, setOrientation] = useState({ beta: 0, gamma: 0 });
  const [isLevel, setIsLevel] = useState(false);

  // Sync level status to parent
  useEffect(() => {
    onLevelChange?.(isLevel);
  }, [isLevel, onLevelChange]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const { beta, gamma } = event;
    if (beta !== null && gamma !== null) {
      setOrientation({ beta, gamma });

      // Check if level (threshold approx 2 degrees)
      const levelThreshold = 2;
      const currentlyLevel = Math.abs(beta) < levelThreshold && Math.abs(gamma) < levelThreshold;

      if (currentlyLevel && !isLevel) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(50);
        }
      }
      setIsLevel(currentlyLevel);
    }
  }, [isLevel]);

  /*
  useEffect(() => {
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [handleOrientation]);
  */

  // Map beta/gamma to pixel offset
  // Assume a range of -10 to 10 degrees maps to -30 to 30 pixels
  const maxDeg = 10;
  const maxOffset = 30;

  const offsetX = Math.max(-maxOffset, Math.min(maxOffset, (orientation.gamma / maxDeg) * maxOffset));
  const offsetY = Math.max(-maxOffset, Math.min(maxOffset, (orientation.beta / maxDeg) * maxOffset));

  return (
    <div id="level-indicator" className="relative w-24 h-24 flex items-center justify-center pointer-events-none">
      {/* Outer fixed circle (gray dotted) */}
      <div className="absolute w-16 h-16 border-2 border-dotted border-gray-500 rounded-full" />

      {/* Inner moving circle (white solid, turns green when level) */}
      <div
        className={`absolute w-12 h-12 border-2 rounded-full transition-colors duration-200 ${
          isLevel ? "border-green-500 bg-green-500/30" : "border-white"
        }`}
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px)`
        }}
      />
    </div>
  );
}

/**
 * Helper to request DeviceOrientation permissions on iOS.
 * Should be called from a user-initiated event (like a button click).
 */
export async function requestLevelPermission() {
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    // @ts-ignore
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      // @ts-ignore
      const permissionState = await DeviceOrientationEvent.requestPermission();
      return permissionState === "granted";
    } catch (error) {
      console.error("DeviceOrientation permission error:", error);
      return false;
    }
  }
  return true; // Not required on non-iOS
}
