export function createFallbackMediaStream({ includeVideo = false } = {}) {
    const stream = new MediaStream();
    const cleanups = [];

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const destination = audioContext.createMediaStreamDestination();

            gainNode.gain.value = 0.00001;
            oscillator.connect(gainNode);
            gainNode.connect(destination);
            oscillator.start();

            const silentTrack = destination.stream.getAudioTracks()[0];
            if (silentTrack) {
                silentTrack.enabled = false;
                stream.addTrack(silentTrack);
                cleanups.push(() => {
                    try { silentTrack.stop(); } catch (_) { }
                    try { oscillator.stop(); } catch (_) { }
                    try { audioContext.close(); } catch (_) { }
                });
            } else {
                try { oscillator.stop(); } catch (_) { }
                try { audioContext.close(); } catch (_) { }
            }
        }
    } catch (_) {
        // Ignore fallback audio errors and continue with best-effort stream.
    }

    if (includeVideo) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const canvasStream = canvas.captureStream(1);
            const blackTrack = canvasStream.getVideoTracks()[0];
            if (blackTrack) {
                blackTrack.enabled = false;
                stream.addTrack(blackTrack);
                cleanups.push(() => {
                    try { blackTrack.stop(); } catch (_) { }
                });
            }
        } catch (_) {
            // Ignore fallback video errors.
        }
    }

    return {
        stream,
        cleanup: () => {
            cleanups.forEach((fn) => fn());
        }
    };
}
