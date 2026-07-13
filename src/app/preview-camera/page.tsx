"use client";
import { Suspense } from "react";
import CameraView from "@/components/Camera/CameraView";

function PreviewCameraContent() {
  return (
    <CameraView onCapture={(blob) => {
      console.log("Captured:", blob);
    }} />
  );
}

export default function PreviewCameraPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PreviewCameraContent />
    </Suspense>
  );
}
