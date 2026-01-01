"use client";
import dynamic from 'next/dynamic';

const SafeChatWidget = dynamic(() => import('./ChatWidget'), {
    ssr: false,
    // No loading fallback needed for general usage, or standard one if desired
});

export default SafeChatWidget;
