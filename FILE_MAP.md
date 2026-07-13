# File and Function Map

This document provides an overview of the pages, components, and assets in the project.

## 1. Pages (`src/app/`)

| Route | File | Description |
| :--- | :--- | :--- |
| `/` | `page.tsx` | **Main Home Page.** Guides the user through a multi-step wizard (`StepWizard`), capture (`CameraView`), and preview (`PreviewModal`) before uploading. |
| `/capture` | `capture/page.tsx` | **Alternative Capture Page.** Uses `FootMeasurementTool` which features CSS-based guides and image pan/zoom capabilities. |
| `/login` | `login/page.tsx` | Login page (Placeholder). |
| `/manga` | `manga/page.tsx` | Manga viewer page (Placeholder). |
| `/upload` | `upload/page.tsx` | Manual upload page (Placeholder). |

## 2. Components (`src/components/`)

### Camera
- **`CameraView.tsx`**: The capture screen used on the Home page (`/`).
  - Features: Multi-step voice guidance, `footbase.jpg` overlay, and automatic metadata overlay (date, orderID) on the captured image.
- **`FootMeasurementTool.tsx`**: The capture screen used on the `/capture` page.
  - Features: Toggleable guides (CSS-based or `footbase.jpg` overlay), and post-capture editing (pan/zoom).

### Guidance & Review
- **`StepWizard.tsx`**: Initial instruction screens that play audio guidance before entering the camera mode on the Home page.
- **`InstructionSlide.tsx`**: A reusable slide component for displaying images and text in the wizard.
- **`PreviewModal.tsx`**: Displays the captured photo for confirmation before it is sent to the server.

## 3. Key Assets (`public/assets/`)

### Images
- **`footbase.jpg`**: The primary guide overlay showing foot positioning on A4 paper. Used in `CameraView`.
- **`ashiura.png`**: Icon used in the instruction bubbles.
- **`explain1.png` - `explain4.png`**: Illustrative images used in the `StepWizard`.

### Audio (Voice Guidance)
- **`step1.m4a` - `step4.m4a`**: Instructions for aligning the paper and feet (used in `CameraView`).
- **`capture.m4a`**: Final instruction to press the capture button.
- **`guidance1.m4a` - `guidance2.m4a`**: Preliminary instructions played during the `StepWizard`.

## 4. Utilities (`src/lib/`)
- **`basePath.ts`**: Contains `getAssetPath` utility, essential for prepending the `/spiral_turn_footcalc` prefix to all asset URLs in production (GitHub Pages).
- **`api.ts`**: Handles the image upload to the Gemini API.
