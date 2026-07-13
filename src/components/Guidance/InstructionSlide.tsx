interface InstructionSlideProps {
    images: string[];
    message: React.ReactNode;
}

export default function InstructionSlide({ images, message }: InstructionSlideProps) {
    return (
        <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-white">
            <div className="flex-1 p-4 min-h-0">
                <div className="flex items-center justify-center w-full h-full">
                    {images.map((src, idx) => (
                        <div key={idx} className="w-full h-full shadow-md rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center p-2">
                            <img
                                src={src}
                                alt={`Instruction ${idx + 1}`}
                                className="max-w-full max-h-full object-contain block"
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="w-full">
                    {message}
                </div>
            </div>
        </div>
    );
}
