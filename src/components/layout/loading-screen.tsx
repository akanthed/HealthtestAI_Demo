
"use client";

import { useState, useEffect } from "react";
import { quotes } from "@/lib/quotes";
import { Logo } from "@/components/icons/logo";

export default function LoadingScreen() {
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
        }, 3500); // Rotate every 3.5 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="flex flex-col items-center justify-center text-center p-4">
                <div className="relative flex items-center justify-center h-16 w-16 mb-6">
                    <div className="absolute h-full w-full animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
                    <Logo className="h-8 w-8 text-primary" />
                </div>
                
                <div className="w-full max-w-md">
                    <p className="text-lg font-medium text-foreground transition-opacity duration-500">
                        "{quotes[currentQuoteIndex].quote}"
                    </p>
                    <p className="mt-4 text-sm text-muted-foreground italic">
                        - {quotes[currentQuoteIndex].author}
                    </p>
                </div>
            </div>
        </div>
    );
}
