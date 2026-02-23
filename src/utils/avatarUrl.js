export function resolveAvatarUrl(rawUrl) {
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!url) return '';

    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }

    const gsMatch = url.match(/^gs:\/\/([^/]+)\/(.+)$/i);
    if (gsMatch) {
        const bucket = gsMatch[1];
        const objectPath = gsMatch[2].split('/').map(encodeURIComponent).join('%2F');
        return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectPath}?alt=media`;
    }

    const driveFileMatch = url.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
    if (driveFileMatch) {
        return `https://drive.google.com/uc?export=view&id=${driveFileMatch[1]}`;
    }

    const driveIdMatch = url.match(/[?&]id=([^&]+)/i);
    if (/^https?:\/\/drive\.google\.com\//i.test(url) && driveIdMatch) {
        return `https://drive.google.com/uc?export=view&id=${driveIdMatch[1]}`;
    }

    if (/^https?:\/\/(?:www\.)?dropbox\.com\//i.test(url)) {
        const normalized = new URL(url);
        normalized.searchParams.set('raw', '1');
        normalized.searchParams.delete('dl');
        return normalized.toString();
    }

    return url;
}
