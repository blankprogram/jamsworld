export const handleFileChange = (e, setFile, setFileURL, setImageDimensions) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
        setFile(uploadedFile);
        const objectURL = URL.createObjectURL(uploadedFile);
        setFileURL(objectURL);

        const img = new Image();
        img.onload = () => {
            setImageDimensions({ width: img.width, height: img.height });
        };
        img.src = objectURL;
    } else {
        console.error("No file selected!");
    }
};