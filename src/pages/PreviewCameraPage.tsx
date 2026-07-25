import CameraView from "@/components/Camera/CameraView";

export default function PreviewCameraPage() {
  return (
    <CameraView onCapture={(blob) => {
      console.log("Captured:", blob);
    }} />
  );
}

