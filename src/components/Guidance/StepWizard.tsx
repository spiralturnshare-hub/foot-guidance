"use client";

import { useState, useRef } from "react";
import InstructionSlide from "./InstructionSlide";
// import { useAudio } from "@/hooks/useAudio";
import { getAssetPath } from "@/lib/basePath";

interface StepWizardProps {
    onComplete: () => void;
}

export default function StepWizard({ onComplete }: StepWizardProps) {
    const [step, setStep] = useState(0);
    // const { play } = useAudio();
    const isTransitioning = useRef(false);

    const handleNext = () => {
        if (isTransitioning.current) return;
        isTransitioning.current = true;
        setTimeout(() => { isTransitioning.current = false; }, 400);

        if (step === 0) {
            // play(getAssetPath("/assets/guidance1.m4a"));
            setStep(1);
        } else if (step === 1) {
            // play(getAssetPath("/assets/guidance2.m4a"));
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            setStep(4);
        } else if (step === 4) {
            onComplete();
        }
    };

    return (
        <div className="flex flex-col items-center h-[100dvh] overflow-hidden bg-white text-black">
            {step === 0 && (
                <div className="flex-1 flex flex-col items-center w-full max-w-2xl p-4">
                    <div className="flex-1 flex items-center justify-center">
                        <h1 className="text-2xl font-bold text-center leading-relaxed">
                            さぁ、ガイダンスに沿って、<br />
                            準備と撮影をして<br />
                            いきましょう！
                        </h1>
                    </div>
                    <div className="w-full pb-4">
                        <button
                            onClick={handleNext}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-xl shadow-lg"
                        >
                            次へ
                        </button>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="w-full flex-1 min-h-0">
                    <InstructionSlide
                        images={[getAssetPath("/assets/explain1.png")]}
                        message={
                            <button
                                onClick={handleNext}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-xl shadow-lg"
                            >
                                次へ
                            </button>
                        }
                    />
                </div>
            )}

            {step === 2 && (
                <div className="w-full flex-1 min-h-0">
                    <InstructionSlide
                        images={[getAssetPath("/assets/explain2.png")]}
                        message={
                            <button
                                onClick={handleNext}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-xl shadow-lg"
                            >
                                次へ
                            </button>
                        }
                    />
                </div>
            )}

            {step === 3 && (
                <div className="w-full flex-1 min-h-0">
                    <InstructionSlide
                        images={[getAssetPath("/assets/explain3.png")]}
                        message={
                            <button
                                onClick={handleNext}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-xl shadow-lg"
                            >
                                次へ
                            </button>
                        }
                    />
                </div>
            )}

            {step === 4 && (
                <div className="w-full flex-1 min-h-0">
                    <InstructionSlide
                        images={[getAssetPath("/assets/explain4.png")]}
                        message={
                            <button
                                onClick={handleNext}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-xl shadow-lg"
                            >
                                カメラ起動
                            </button>
                        }
                    />
                </div>
            )}
        </div>
    );
}
