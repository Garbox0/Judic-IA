import React from 'react';
import { ShieldCheck } from 'lucide-react';
import './security-badges.css';

const CloudflareLogo = () => (
    <svg
        width="22"
        height="14"
        viewBox="0 0 24 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="badge-brand-svg"
        aria-hidden="true"
    >
        <path fill="#F38020" d="M24 7.332A8.001 8.001 0 0 0 8.35 4.162a6.96 6.96 0 0 0-6.565 3.504 3.996 3.996 0 0 0 1.442 7.514H19.667c2.21 0 4-1.79 4-3.999V7.332z" transform="translate(0, 0)" />
    </svg>
);

const NortonLogo = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="badge-brand-svg"
        aria-hidden="true"
    >
        <circle cx="50" cy="50" r="50" fill="#FDB913" />
        <path fill="#000000" d="M74.3 35l-28 28-11.3-11.3c-1.6-1.6-4.1-1.6-5.7 0s-1.6 4.1 0 5.7l14.1 14.1c0.8 0.8 1.8 1.2 2.8 1.2s2-0.4 2.8-1.2l30.8-30.8c1.6-1.6 1.6-4.1 0-5.7s-4.1-1.6-5.5 0z" />
    </svg>
);

const ClamAVLogo = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="badge-brand-svg"
        aria-hidden="true"
    >
        <circle cx="64" cy="74" r="50" fill="#E1251B" />
        <path d="M15 15C15 15 10 35 25 55C15 45 8 25 15 15Z" fill="#E1251B" stroke="#000" strokeWidth="2" />
        <path d="M113 15C113 15 118 35 103 55C113 45 120 25 113 15Z" fill="#E1251B" stroke="#000" strokeWidth="2" />
        <ellipse cx="45" cy="70" rx="15" ry="12" fill="white" stroke="black" strokeWidth="2" />
        <ellipse cx="83" cy="70" rx="15" ry="12" fill="white" stroke="black" strokeWidth="2" />
        <path d="M35 60C45 50 55 65 60 75" stroke="black" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M93 60C83 50 73 65 68 75" stroke="black" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
);

const QualysLogo = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="badge-brand-svg"
        aria-hidden="true"
    >
        <path d="M12 2L4 5V11C4 16.03 7.42 20.73 12 22C16.58 20.73 20 16.03 20 11V5L12 2Z" fill="#ED1C24" />
        <path fillRule="evenodd" clipRule="evenodd" d="M12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.6569 17 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12Z" fill="white" />
    </svg>
);

const E2ELogo = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="badge-brand-svg" aria-hidden="true">
        <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="2" />
        <path d="M9 11V9C9 7.343 10.343 6 12 6C13.657 6 15 7.343 15 9V11" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <rect x="8" y="11" width="8" height="6" rx="1" fill="#10B981" />
    </svg>
);

const ISOLogo = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="badge-brand-svg" aria-hidden="true">
        <path d="M12 2L4 5V11C4 16.03 7.42 20.73 12 22C16.58 20.73 20 16.03 20 11V5L12 2Z" fill="#3B82F6" fillOpacity="0.2" stroke="#3B82F6" strokeWidth="2" />
        <path d="M12 7V17M7 12H17" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const LawLogo = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="badge-brand-svg" aria-hidden="true">
        <path d="M12 3v18M12 3l-8 4M12 3l8 4M4 17c0 0-2 0-2-5s2-5 2-5M20 17c0 0 2 0 2-5s-2-5-2-5M7 17h10" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 7v10M20 7v10" stroke="#8B5CF6" strokeWidth="2" />
    </svg>
);

const SecurityBadges = ({ className = "" }) => {
    return (
        <div className={`security-badges-container-wrapper ${className}`}>
            <div className="security-badges-card-premium">
                <div className="security-badges-header-minimal">
                    <ShieldCheck size={18} className="security-header-icon-minimal" />
                    <span>Plataforma Segura y Certificada</span>
                </div>

                <div className="badges-grid-layout">
                    <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" className="trust-badge-pill" title="Cloudflare Protected">
                        <CloudflareLogo />
                        <span>Cloudflare</span>
                    </a>

                    <a href="https://safeweb.norton.com/report?url=https://www.judic-ia.com/" target="_blank" rel="noopener noreferrer" className="trust-badge-pill" title="Norton Verified">
                        <NortonLogo />
                        <span>Norton</span>
                    </a>

                    <a href="https://www.ssllabs.com/ssltest/analyze.html?d=judic-ia.com" target="_blank" rel="noopener noreferrer" className="trust-badge-pill" title="SSL Labs A+ (Qualys)">
                        <QualysLogo />
                        <span>SSL Labs A+</span>
                    </a>

                    <div className="trust-badge-pill" title="ClamAV Anti-Malware">
                        <ClamAVLogo />
                        <span>ClamAV</span>
                    </div>

                    <a href="https://observatory.mozilla.org/analyze/www.judic-ia.com" target="_blank" rel="noopener noreferrer" className="trust-badge-pill mozilla" title="Mozilla Observatory A+">
                        <div className="mozilla-badge-mini">A+</div>
                        <span>Mozilla Score</span>
                    </a>

                    <div className="trust-badge-pill" title="End-to-End Encryption">
                        <E2ELogo />
                        <span>Cifrado E2E</span>
                    </div>

                    <div className="trust-badge-pill" title="ISO 27001 Aligned">
                        <ISOLogo />
                        <span>Aligned 27001</span>
                    </div>

                    <div className="trust-badge-pill" title="Ley 25.326 Cumplimiento">
                        <LawLogo />
                        <span>Ley 25.326</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityBadges;
