import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, FileText } from 'lucide-react';

const TERMS_VERSION = '2026-02-23';

const TERMS_SECTIONS = [
    {
        title: '1. Acceptance of Terms',
        body: [
            'By accessing or using GravityChat, you agree to these Terms of Service and all applicable laws.',
            'If you do not agree, do not use the service.',
        ],
    },
    {
        title: '2. Eligibility and Account Responsibility',
        body: [
            'You are responsible for activities performed through your account and for maintaining account security.',
            'Do not share authentication credentials or attempt to bypass platform safeguards.',
        ],
    },
    {
        title: '3. Acceptable Use',
        body: [
            'You must not use GravityChat to harass, threaten, impersonate, distribute malware, or violate law.',
            'You must not attempt unauthorized access, exploit vulnerabilities, or interfere with service operation.',
        ],
    },
    {
        title: '4. Content and Moderation',
        body: [
            'You retain ownership of your content, but grant GravityChat a limited license to host and deliver it.',
            'Content that violates policy may be removed. Accounts may be suspended or terminated for abuse.',
        ],
    },
    {
        title: '5. Servers, Roles, and Administration',
        body: [
            'Server owners and moderators may manage membership, channels, and roles under server-specific rules.',
            'Platform staff may act on severe abuse, security incidents, or legal requirements.',
        ],
    },
    {
        title: '6. Security and Abuse',
        body: [
            'You may not scrape user data, automate abuse, or attempt to defeat anti-abuse and security controls.',
            'Security reports should be sent responsibly and must not include public exploitation.',
        ],
    },
    {
        title: '7. Service Changes',
        body: [
            'GravityChat may change, suspend, or discontinue features at any time.',
            'We may update these terms; continued use after updates means acceptance.',
        ],
    },
    {
        title: '8. Disclaimer and Liability',
        body: [
            'The service is provided on an "as is" basis without warranties to the maximum extent permitted by law.',
            'GravityChat is not liable for indirect, incidental, or consequential damages.',
        ],
    },
    {
        title: '9. Contact',
        body: [
            'For legal or policy questions, contact the service administrator for your deployment.',
        ],
    },
];

const PRIVACY_SECTIONS = [
    {
        title: '1. Information We Process',
        body: [
            'Account profile data: display name, email, avatar, and account identifiers.',
            'Service data: server membership, channels, messages, media attachments, and moderation reports.',
            'Operational data: timestamps, device/browser metadata, and abuse-prevention signals.',
        ],
    },
    {
        title: '2. How We Use Data',
        body: [
            'To provide chat, server, moderation, and notification features.',
            'To secure accounts, prevent abuse, and investigate suspicious activity.',
            'To maintain service reliability, diagnose failures, and improve product quality.',
        ],
    },
    {
        title: '3. Legal Bases',
        body: [
            'We process data based on contract performance, legitimate interests in safety and operations, and legal obligations.',
        ],
    },
    {
        title: '4. Data Sharing',
        body: [
            'We do not sell personal data.',
            'Data may be processed by infrastructure providers (for example Firebase services) for storage, auth, and delivery.',
            'Data may be disclosed where required by law or to protect users and platform security.',
        ],
    },
    {
        title: '5. Retention',
        body: [
            'Data is retained only as long as necessary for service operation, legal compliance, and abuse prevention.',
            'Retention windows may vary by data type and moderation requirements.',
        ],
    },
    {
        title: '6. Your Controls',
        body: [
            'You can update profile details, adjust privacy/safety settings, and request account deletion.',
            'Some records may be retained where legally required or needed for security investigations.',
        ],
    },
    {
        title: '7. Security Measures',
        body: [
            'Transport encryption, access controls, abuse monitoring, and client integrity protections are used to reduce risk.',
            'No system is perfectly secure; keep your identity provider account protected with strong security settings.',
        ],
    },
    {
        title: '8. Children and Sensitive Data',
        body: [
            'Do not submit sensitive personal data unless explicitly required for a supported feature.',
            'If your region requires parental consent for minors, use is limited to compliant users only.',
        ],
    },
    {
        title: '9. Policy Updates',
        body: [
            `This policy version is ${TERMS_VERSION}. We may update policy text as product and legal requirements evolve.`,
        ],
    },
];

function LegalSection({ title, body }) {
    return (
        <section style={{ marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {title}
            </h4>
            {body.map((line, index) => (
                <p
                    key={`${title}-${index}`}
                    style={{ margin: index === body.length - 1 ? 0 : '0 0 8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                >
                    {line}
                </p>
            ))}
        </section>
    );
}

export default function LegalDocumentsModal({ isOpen, onClose, initialTab = 'tos', mobile = false }) {
    const [activeTab, setActiveTab] = useState(initialTab === 'privacy' ? 'privacy' : 'tos');

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab === 'privacy' ? 'privacy' : 'tos');
        }
    }, [isOpen, initialTab]);

    const sections = useMemo(() => (
        activeTab === 'tos' ? TERMS_SECTIONS : PRIVACY_SECTIONS
    ), [activeTab]);

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 14000,
                    backgroundColor: 'rgba(0, 0, 0, 0.78)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: mobile ? 0 : '16px',
                }}
                onClick={(event) => {
                    if (event.target === event.currentTarget) onClose();
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    style={{
                        width: mobile ? '100%' : 'min(860px, 100%)',
                        height: mobile ? '100%' : 'min(88vh, 760px)',
                        borderRadius: mobile ? 0 : '14px',
                        overflow: 'hidden',
                        background: 'linear-gradient(180deg, rgba(14, 17, 20, 0.98), rgba(10, 12, 16, 0.98))',
                        border: mobile ? 'none' : '1px solid var(--glass-border)',
                        boxShadow: mobile ? 'none' : '0 26px 70px rgba(0,0,0,0.58)',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <header style={{
                        padding: mobile ? '14px 14px 10px' : '16px 18px 12px',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(148, 163, 184, 0.14)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            flexShrink: 0,
                        }}>
                            {activeTab === 'tos' ? <FileText size={17} /> : <Shield size={17} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {activeTab === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                Version {TERMS_VERSION}
                            </p>
                        </div>
                        <button onClick={onClose} className="icon-btn" style={{ width: '32px', height: '32px' }}>
                            <X size={18} />
                        </button>
                    </header>

                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        padding: mobile ? '10px 12px' : '10px 18px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        flexShrink: 0,
                    }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tos')}
                            className={activeTab === 'tos' ? 'glossy-button' : 'secondary-button'}
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            Terms
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('privacy')}
                            className={activeTab === 'privacy' ? 'glossy-button' : 'secondary-button'}
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                            Privacy
                        </button>
                    </div>

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: mobile ? '14px 14px 18px' : '16px 22px 22px',
                    }}>
                        {sections.map((section) => (
                            <LegalSection key={section.title} title={section.title} body={section.body} />
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}

export { TERMS_VERSION };
