"use client";
import React, { useState, useRef, useEffect } from "react";

interface DraggableGuideProps {
    children?: React.ReactNode;
    className?: string; // CSS for base absolute position (e.g. top-[15%] left-1/2 -translate-x-1/2)
    guideClassName?: string; // CSS for size and style (e.g. w-[30%] h-[35%] border-2)
}

export default function DraggableGuide({
    children,
    className = "",
    guideClassName = ""
}: DraggableGuideProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        dragStartPos.current = {
            x: clientX - position.x,
            y: clientY - position.y,
        };
    };

    const stopDragging = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            if ("touches" in e && e.cancelable) {
                e.preventDefault();
            }

            const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            setPosition({
                x: clientX - dragStartPos.current.x,
                y: clientY - dragStartPos.current.y,
            });
        };

        if (isDragging) {
            window.addEventListener("mousemove", onMouseMove, { passive: false });
            window.addEventListener("mouseup", stopDragging);
            window.addEventListener("touchmove", onMouseMove, { passive: false });
            window.addEventListener("touchend", stopDragging);
        } else {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", stopDragging);
            window.removeEventListener("touchmove", onMouseMove);
            window.removeEventListener("touchend", stopDragging);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", stopDragging);
            window.removeEventListener("touchmove", onMouseMove);
            window.removeEventListener("touchend", stopDragging);
        };
    }, [isDragging]);

    return (
        <div className={`absolute pointer-events-none z-[60] ${className}`}>
            <div
                className={`cursor-move touch-none pointer-events-auto ${guideClassName}`}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                onMouseDown={onMouseDown}
                onTouchStart={onMouseDown}
            >
                {children}
            </div>
        </div>
    );
}
