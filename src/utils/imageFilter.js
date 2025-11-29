import * as nsfwjs from 'nsfwjs';

let model = null;

/**
 * Loads the NSFWJS model.
 */
export const loadModel = async () => {
    if (model) return model;
    try {
        model = await nsfwjs.load();
        return model;
    } catch (error) {
        console.error("Failed to load NSFW model:", error);
        return null;
    }
};

/**
 * Checks an image element for NSFW content.
 * @param {HTMLImageElement} imgElement - The image element to check.
 * @returns {Promise<{isNSFW: boolean, reason: string, predictions: any[]}>}
 */
export const checkImage = async (imgElement) => {
    const model = await loadModel();
    if (!model) {
        // If model fails to load, we default to allowing (or blocking, depending on strictness).
        // For now, let's allow but log.
        console.warn("NSFW model not loaded, skipping check.");
        return { isNSFW: false, reason: null, predictions: [] };
    }

    try {
        const predictions = await model.classify(imgElement);

        // Check for high probability of NSFW content
        // Categories: Porn, Hentai, Sexy, Neutral, Drawing
        const nsfwCategories = ['Porn', 'Hentai', 'Sexy'];

        // We can adjust the threshold. 0.6 (60%) is a reasonable starting point.
        const threshold = 0.6;

        const nsfwPrediction = predictions.find(p =>
            nsfwCategories.includes(p.className) && p.probability > threshold
        );

        if (nsfwPrediction) {
            return {
                isNSFW: true,
                reason: `Detected ${nsfwPrediction.className} content (${(nsfwPrediction.probability * 100).toFixed(1)}%)`,
                predictions
            };
        }

        return { isNSFW: false, reason: null, predictions };
    } catch (error) {
        console.error("Error classifying image:", error);
        return { isNSFW: false, reason: "Classification error", predictions: [] };
    }
};

/**
 * Helper to load an image from a URL or Data URI into an HTMLImageElement for checking.
 * @param {string} src - Image source URL or Data URI.
 * @returns {Promise<HTMLImageElement>}
 */
export const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
};
