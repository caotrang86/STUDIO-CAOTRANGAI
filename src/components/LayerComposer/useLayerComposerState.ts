// ... existing code ...
    const duplicateSelectedLayers = () => {
        if (selectedLayers.length === 0) return []; beginInteraction();
        let newLayers = [...layers]; const newSelectedIds: string[] = [];
        const topMostSelectedIndex = layers.findIndex(l => l.id === selectedLayers[0].id);
        const layersToDuplicate = [...selectedLayers].reverse(); 
        for(const layerToDup of layersToDuplicate) {
             const newLayer: Layer = Object.assign({}, layerToDup, { id: Math.random().toString(36).substring(2, 9), x: layerToDup.x + 20, y: layerToDup.y + 20 });
            newLayers.splice(topMostSelectedIndex, 0, newLayer); newSelectedIds.push(newLayer.id);
        }
        setLayers(newLayers); const newHistory = history.slice(0, historyIndex + 1); newHistory.push(newLayers);
        setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
        interactionStartHistoryState.current = null; setSelectedLayerIds(newSelectedIds);
        return newLayers.filter(l => newSelectedIds.includes(l.id));
    };

    const handleDuplicateForDrag = (): Layer[] => {
// ... existing code ...
