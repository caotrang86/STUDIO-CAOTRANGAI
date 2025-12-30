// ... existing code ...
    const handleRefDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(true); };
    const handleRefDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false); };
    const handleRefDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // FIX: Explicitly cast file to any or File to avoid 'unknown' errors
            const files = Array.from(e.dataTransfer.files).filter((file: any) => file.type.startsWith('image/'));
            const remainingSlots = 4 - referenceImages.length;
            const filesToAdd = files.slice(0, remainingSlots);
            filesToAdd.forEach((file: any) => {
                const reader = new FileReader();
                reader.onloadend = () => { setReferenceImages(prev => [...prev, reader.result as string]); };
                reader.readAsDataURL(file as Blob);
            });
        }
    };

    const handleGallerySelect = (imageUrl: string) => {
// ... existing code ...
