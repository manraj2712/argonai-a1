// Keys are built only from ids we generated, never from anything the client sent.
export const objectKeys = {
  original: (ownerId: string, imageId: string) => `originals/${ownerId}/${imageId}`,
  normalized: (ownerId: string, imageId: string) => `normalized/${ownerId}/${imageId}.jpg`,
  thumbnail: (ownerId: string, imageId: string) => `thumbnails/${ownerId}/${imageId}.webp`,
};
