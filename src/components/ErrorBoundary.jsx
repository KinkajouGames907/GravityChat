import { Component } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught:', error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'var(--app-vh)',
                    backgroundColor: '#0f0c29',
                    color: 'white',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: '24px' }} />
                    <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px', maxWidth: '400px' }}>
                        GravityChat encountered an unexpected error. Click below to try again.
                    </p>
                    {import.meta.env.DEV && this.state.error && (
                        <pre style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: '16px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            maxWidth: '600px',
                            overflow: 'auto',
                            marginBottom: '24px',
                            color: '#ef4444',
                            textAlign: 'left'
                        }}>
                            {this.state.error.toString()}
                        </pre>
                    )}
                    <button
                        onClick={this.handleRetry}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#5865f2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
