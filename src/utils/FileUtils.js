export const handleFileChange = (e, setFile, setFileURL) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
        setFile(uploadedFile);
        const objectURL = URL.createObjectURL(uploadedFile);
        setFileURL(objectURL);
        console.log("File URL set:", objectURL);
    } else {
        console.error("No file selected!");
    }
};
