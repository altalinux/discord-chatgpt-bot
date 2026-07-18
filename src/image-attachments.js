const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_IMAGE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export function getImageAttachments(message) {
  return [...message.attachments.values()].filter((attachment) => isImageAttachment(attachment));
}

function isImageAttachment(attachment) {
  return attachment.contentType?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(attachment.name || "");
}

export function validateImageAttachments(imageAttachments, provider) {
  if (imageAttachments.length > MAX_IMAGE_ATTACHMENTS) {
    return `Please attach up to ${MAX_IMAGE_ATTACHMENTS} images per message.`;
  }

  const unsupportedAttachment = imageAttachments.find(
    (attachment) => !provider.supportedImageContentTypes.has(attachment.contentType),
  );

  if (unsupportedAttachment) {
    if (
      provider.name === "gemini" &&
      (unsupportedAttachment.contentType === "image/gif" || /\.gif$/i.test(unsupportedAttachment.name || ""))
    ) {
      return "Gemini does not support GIF images. Please attach a JPEG, PNG, or WebP image.";
    }
    const formats = provider.name === "gemini" ? "JPEG, PNG, or WebP" : "JPEG, PNG, WebP, or GIF";
    return `Unsupported image format. Please attach ${formats} images.`;
  }

  if (imageAttachments.some((attachment) => attachment.size > MAX_IMAGE_ATTACHMENT_BYTES)) {
    return "Each image must be 20 MB or smaller.";
  }

  return null;
}
