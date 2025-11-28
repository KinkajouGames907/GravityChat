export const customEmojis = {
    ':party_blob:': 'https://cdn.discordapp.com/emojis/1130998773562654841.gif?size=96&quality=lossless',
    ':cat_jam:': 'https://cdn.discordapp.com/emojis/1130998782555246662.gif?size=96&quality=lossless',
    ':doge_dance:': 'https://cdn.discordapp.com/emojis/1130998791556218940.gif?size=96&quality=lossless',
    ':pepe_business:': 'https://cdn.discordapp.com/emojis/1130998800557195324.webp?size=96&quality=lossless',
    ':this_is_fine:': 'https://cdn.discordapp.com/emojis/1130998809558171708.webp?size=96&quality=lossless',
    ':gravity_logo:': 'https://firebasestorage.googleapis.com/v0/b/gravity-chat-907.appspot.com/o/logo.png?alt=media' // Fallback/Placeholder
};

export const getCustomEmojiUrl = (shortcode) => {
    return customEmojis[shortcode];
};
