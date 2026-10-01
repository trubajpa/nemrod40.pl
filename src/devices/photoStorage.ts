// Enable only after the bucket, access rules and CORS have been configured.
export const photoStorageEnabled = import.meta.env.VITE_PHOTO_STORAGE_ENABLED === 'true';
export const photoStorageUnavailableMessage = 'Przesyłanie zdjęć będzie dostępne po konfiguracji magazynu';
