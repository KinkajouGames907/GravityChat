import JSZip from 'jszip';

const GITHUB_API = 'https://api.github.com';
const OWNER = import.meta.env.VITE_GITHUB_OWNER;
const REPO = import.meta.env.VITE_GITHUB_REPO;
const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
const PAT = import.meta.env.VITE_GITHUB_PAT;

const EXCLUDED_PATTERNS = [
    '__MACOSX/',
    '.DS_Store',
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'Thumbs.db',
];

function githubHeaders() {
    return {
        'Authorization': `Bearer ${PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

function shouldExclude(filePath) {
    return EXCLUDED_PATTERNS.some(pattern => filePath.includes(pattern));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getFileSHA(filePath) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Failed to get SHA for ${filePath}: ${err.message || res.status}`);
    }
    const data = await res.json();
    return data.sha;
}

async function putFileToGitHub(filePath, base64Content, commitMessage, sha) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}`;
    const body = {
        message: commitMessage,
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
    };

    const res = await fetch(url, {
        method: 'PUT',
        headers: githubHeaders(),
        body: JSON.stringify(body),
    });

    // Handle SHA conflict: re-fetch SHA and retry once
    if (res.status === 409 || res.status === 422) {
        const freshSha = await getFileSHA(filePath);
        const retryRes = await fetch(url, {
            method: 'PUT',
            headers: githubHeaders(),
            body: JSON.stringify({ ...body, sha: freshSha }),
        });
        if (!retryRes.ok) {
            const err = await retryRes.json().catch(() => ({}));
            throw new Error(`Conflict on ${filePath} after retry: ${err.message || retryRes.status}`);
        }
        return retryRes.json();
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Rate limit check
        if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
            const resetTime = res.headers.get('X-RateLimit-Reset');
            const resetDate = resetTime ? new Date(Number(resetTime) * 1000).toLocaleTimeString() : 'soon';
            throw new Error(`GitHub rate limit exceeded. Try again after ${resetDate}.`);
        }
        throw new Error(`Failed to push ${filePath}: ${err.message || res.status}`);
    }

    return res.json();
}

/**
 * Verifies that the GitHub PAT and repo config are valid.
 * @returns {Promise<{ valid: boolean, repoName: string | null, error: string | null }>}
 */
export async function verifyGitHubConfig() {
    try {
        if (!PAT || !OWNER || !REPO) {
            return {
                valid: false,
                repoName: null,
                error: 'Missing GitHub configuration. Check VITE_GITHUB_PAT, VITE_GITHUB_OWNER, and VITE_GITHUB_REPO.',
            };
        }

        const res = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}`, {
            headers: githubHeaders(),
        });

        if (res.status === 401) return { valid: false, repoName: null, error: 'Invalid GitHub token (401 Unauthorized).' };
        if (res.status === 404) return { valid: false, repoName: null, error: 'Repository not found (404). Check VITE_GITHUB_OWNER and VITE_GITHUB_REPO.' };
        if (!res.ok) return { valid: false, repoName: null, error: `GitHub API error: ${res.status}` };

        const data = await res.json();
        return { valid: true, repoName: data.full_name, error: null };
    } catch (err) {
        return { valid: false, repoName: null, error: err.message };
    }
}

/**
 * Extracts a ZIP file and pushes all valid files to the configured GitHub repository.
 * @param {File} zipFile - The ZIP File object from an <input type="file">
 * @param {string} commitMessage - Git commit message
 * @param {function} onProgress - ({ current, total, fileName, status }) => void
 * @returns {Promise<{ pushedFiles: string[], skippedFiles: string[], errors: string[] }>}
 */
export async function pushZipToGitHub(zipFile, commitMessage, onProgress) {
    if (!PAT || !OWNER || !REPO) {
        throw new Error('GitHub configuration is incomplete. Please set the required environment variables.');
    }

    const zip = await JSZip.loadAsync(zipFile);

    // Collect all file entries (not directories), filter excluded patterns
    const allEntries = [];
    zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && !shouldExclude(relativePath)) {
            allEntries.push({ relativePath, zipEntry });
        }
    });

    if (allEntries.length === 0) {
        throw new Error('No valid files found in ZIP. The archive may be empty or contain only excluded files (node_modules, .env, dist, etc.).');
    }

    // Detect and strip common top-level folder prefix
    // e.g. "GravityChat-main/src/App.jsx" → "src/App.jsx"
    let prefix = '';
    const firstPath = allEntries[0].relativePath;
    const slashIdx = firstPath.indexOf('/');
    if (slashIdx > 0) {
        const candidate = firstPath.substring(0, slashIdx + 1);
        if (allEntries.every(e => e.relativePath.startsWith(candidate))) {
            prefix = candidate;
        }
    }

    const total = allEntries.length;
    const pushedFiles = [];
    const skippedFiles = [];
    const errors = [];

    for (let i = 0; i < allEntries.length; i++) {
        const { relativePath, zipEntry } = allEntries[i];
        const cleanPath = prefix ? relativePath.slice(prefix.length) : relativePath;

        if (!cleanPath) {
            skippedFiles.push(relativePath);
            continue;
        }

        onProgress?.({ current: i + 1, total, fileName: cleanPath, status: 'processing' });

        try {
            const base64Content = await zipEntry.async('base64');
            const sha = await getFileSHA(cleanPath);
            await putFileToGitHub(cleanPath, base64Content, commitMessage, sha);
            pushedFiles.push(cleanPath);
            onProgress?.({ current: i + 1, total, fileName: cleanPath, status: 'done' });
        } catch (err) {
            console.error(`Error pushing ${cleanPath}:`, err);
            errors.push(`${cleanPath}: ${err.message}`);
            onProgress?.({ current: i + 1, total, fileName: cleanPath, status: 'error' });
        }

        // Throttle to respect GitHub secondary rate limits
        if (i < allEntries.length - 1) {
            await delay(150);
        }
    }

    return { pushedFiles, skippedFiles, errors };
}
