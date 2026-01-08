"use client";
import dynamic from 'next/dynamic';

const SafeChatWidget = dynamic(() => import('./ChatWidget'), {
    ssr: false,
    loading: () => (
        <div style={{
            width: '100%',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxSizing: 'border-box'
        }}>
            {/* Header Skeleton */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }}></div>
                <div style={{ width: '120px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }}></div>
            </div>

            {/* Bubbles */}
            <div style={{ height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', width: '80%' }}></div>
            <div style={{ height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', width: '60%', alignSelf: 'flex-end', opacity: 0.7 }}></div>
            <div style={{ height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', width: '70%' }}></div>

            {/* Input Skeleton */}
            <div style={{ marginTop: 'auto', height: '54px', width: '100%', borderRadius: '16px', background: 'rgba(255,255,255,0.05)' }}></div>
        </div>
    )
});

export default SafeChatWidget;
