function prepareImagesForSave(images) {
    let promises = images.map(image => {
        const imageRef = storage.ref().child('images/' + Date.now() + '-' + image.name);
        return imageRef.putString(image.dataUrl, 'data_url').then(snapshot => {
            return snapshot.ref.getDownloadURL();
        });
    });
    return Promise.all(promises);
}