"use client";
import dynamic from 'next/dynamic';

const SafeChatWidget = dynamic(() => import('./ChatWidget'), {
    ssr: false,
    ssr: false,
    loading: () => null
});

export default SafeChatWidget;
