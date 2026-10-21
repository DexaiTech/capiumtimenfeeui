export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif';
const AVATAR_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

/** A reason to refuse a picture before sending it, or null. The API checks the content again. */
export function pictureRefusal(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const extension = file.name.includes('.') ? (file.name.split('.').pop() ?? '').toLowerCase() : '';
  const isImage = file.type.startsWith('image/') || AVATAR_EXTENSIONS.includes(extension);
  if (!isImage || (extension && !AVATAR_EXTENSIONS.includes(extension))) {
    return 'Use a PNG, JPG, WebP or GIF picture.';
  }
  if (file.size === 0) return 'That picture is empty.';
  if (file.size > AVATAR_MAX_BYTES) return 'The picture is larger than 2 MB.';
  return null;
}
