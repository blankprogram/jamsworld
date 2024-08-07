export const loadFonts = async () => {
    try {
        await document.fonts.ready;
        const fontFaces = Array.from(document.fonts);
        const additionalFonts = ['Arial', 'Courier New', 'Times New Roman', 'Verdana'];
        const allFonts = [...fontFaces.map(fontFace => fontFace.family), ...additionalFonts];
        return [...new Set(allFonts)];
    } catch (error) {
        console.error('Error fetching fonts:', error);
        return [];
    }
};