// server/src/utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import "dotenv/config";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image buffer lên Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Folder path (e.g., "asset/folder/avatars")
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<string>} - Public URL của image
 */
export async function uploadImage(buffer, folder, options = {}) {
  try {
    // Xử lý ảnh với Sharp trước khi upload
    const processedBuffer = await sharp(buffer)
      .rotate()
      .webp({ quality: options.quality || 85 })
      .toBuffer();

    const result = await cloudinary.uploader.upload(
      `data:image/webp;base64,${processedBuffer.toString("base64")}`,
      {
        folder,
        resource_type: "image",
        format: "webp",
        ...options,
      }
    );

    return result.secure_url;
  } catch (error) {
    console.error("[Cloudinary] Upload image error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Upload image với resize
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Folder path
 * @param {Object} resizeOptions - { width, height, fit }
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<string>} - Public URL
 */
export async function uploadImageWithResize(buffer, folder, resizeOptions = {}, options = {}) {
  try {
    let processedBuffer = sharp(buffer).rotate();

    if (resizeOptions.width || resizeOptions.height) {
      processedBuffer = processedBuffer.resize(
        resizeOptions.width || null,
        resizeOptions.height || null,
        {
          fit: resizeOptions.fit || "inside",
          withoutEnlargement: resizeOptions.withoutEnlargement !== false,
        }
      );
    }

    processedBuffer = await processedBuffer
      .webp({ quality: options.quality || 85 })
      .toBuffer();

    const result = await cloudinary.uploader.upload(
      `data:image/webp;base64,${processedBuffer.toString("base64")}`,
      {
        folder,
        resource_type: "image",
        format: "webp",
        ...options,
      }
    );

    return result.secure_url;
  } catch (error) {
    console.error("[Cloudinary] Upload image with resize error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Upload video buffer lên Cloudinary
 * @param {Buffer} buffer - Video buffer
 * @param {string} folder - Folder path (e.g., "asset/folder/exercise_videos")
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<string>} - Public URL của video
 */
export async function uploadVideo(buffer, folder, options = {}) {
  try {
    const result = await cloudinary.uploader.upload(
      `data:video/mp4;base64,${buffer.toString("base64")}`,
      {
        folder,
        resource_type: "video",
        ...options,
      }
    );

    return result.secure_url;
  } catch (error) {
    console.error("[Cloudinary] Upload video error:", error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }
}

/**
 * Xóa file từ Cloudinary bằng public_id hoặc URL
 * @param {string} publicIdOrUrl - Public ID hoặc URL của file
 * @param {string} resourceType - "image" hoặc "video"
 * @returns {Promise<boolean>} - true nếu xóa thành công
 */
export async function deleteFile(publicIdOrUrl, resourceType = "image") {
  try {
    let publicId = publicIdOrUrl;

    // Nếu là URL, extract public_id
    if (publicIdOrUrl.startsWith("http")) {
      const urlParts = publicIdOrUrl.split("/");
      const folderAndFile = urlParts.slice(-2).join("/");
      publicId = folderAndFile.replace(/\.[^/.]+$/, ""); // Bỏ extension
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return result.result === "ok";
  } catch (error) {
    console.error("[Cloudinary] Delete file error:", error);
    return false;
  }
}

/**
 * Extract public_id từ Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID hoặc null
 */
export function extractPublicId(url) {
  if (!url || !url.includes("cloudinary.com")) return null;
  try {
    const urlParts = url.split("/");
    const versionIndex = urlParts.findIndex((part) => /^v\d+$/.test(part));
    if (versionIndex !== -1 && versionIndex < urlParts.length - 1) {
      const folderAndFile = urlParts.slice(versionIndex + 1).join("/");
      return folderAndFile.replace(/\.[^/.]+$/, "");
    }
    return null;
  } catch {
    return null;
  }
}

export default cloudinary;

