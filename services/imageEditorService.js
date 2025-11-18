/**
 * ImageEditorService
 *
 * Service for image editing operations using Sharp
 * Supports resize, crop, rotate, flip, format conversion, filters, and quality adjustment
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const AttachmentService = require('./attachmentService');

class ImageEditorService {
  /**
   * Apply image transformations based on operations object
   *
   * @param {string} inputPath - Path to input image
   * @param {string} outputPath - Path to output image
   * @param {Object} operations - Transformation operations
   * @returns {Promise<Object>} - Result with image metadata
   */
  static async applyTransformations(inputPath, outputPath, operations = {}) {
    try {
      let pipeline = sharp(inputPath);

      // Get original metadata
      const metadata = await pipeline.metadata();

      // Apply operations in specific order for best results

      // 1. Rotate (must be done before resize/crop)
      if (operations.rotate) {
        const angle = parseInt(operations.rotate);
        if (!isNaN(angle)) {
          pipeline = pipeline.rotate(angle);
        }
      }

      // 2. Flip/Mirror
      if (operations.flip === 'horizontal') {
        pipeline = pipeline.flop();
      } else if (operations.flip === 'vertical') {
        pipeline = pipeline.flip();
      } else if (operations.flip === 'both') {
        pipeline = pipeline.flip().flop();
      }

      // 3. Crop (before resize for better quality)
      if (operations.crop && operations.crop.width && operations.crop.height) {
        const crop = {
          left: parseInt(operations.crop.left) || 0,
          top: parseInt(operations.crop.top) || 0,
          width: parseInt(operations.crop.width),
          height: parseInt(operations.crop.height)
        };
        pipeline = pipeline.extract(crop);
      }

      // 4. Resize
      if (operations.resize && (operations.resize.width || operations.resize.height)) {
        const resizeOptions = {
          width: operations.resize.width ? parseInt(operations.resize.width) : null,
          height: operations.resize.height ? parseInt(operations.resize.height) : null,
          fit: operations.resize.fit || 'inside', // contain, cover, fill, inside, outside
          withoutEnlargement: operations.resize.withoutEnlargement !== false
        };
        pipeline = pipeline.resize(resizeOptions);
      }

      // 5. Filters
      if (operations.grayscale) {
        pipeline = pipeline.grayscale();
      }

      if (operations.blur) {
        const blurAmount = parseFloat(operations.blur);
        if (!isNaN(blurAmount) && blurAmount > 0) {
          pipeline = pipeline.blur(blurAmount);
        }
      }

      if (operations.sharpen) {
        const sharpenAmount = parseFloat(operations.sharpen);
        if (!isNaN(sharpenAmount) && sharpenAmount > 0) {
          pipeline = pipeline.sharpen(sharpenAmount);
        }
      }

      if (operations.negate) {
        pipeline = pipeline.negate();
      }

      if (operations.normalize) {
        pipeline = pipeline.normalize();
      }

      // 6. Brightness/Saturation/Hue
      if (operations.brightness !== undefined || operations.saturation !== undefined || operations.hue !== undefined) {
        pipeline = pipeline.modulate({
          brightness: operations.brightness !== undefined ? parseFloat(operations.brightness) : 1,
          saturation: operations.saturation !== undefined ? parseFloat(operations.saturation) : 1,
          hue: operations.hue !== undefined ? parseInt(operations.hue) : 0
        });
      }

      // 7. Contrast (using linear transformation)
      // Sharp's modulate() doesn't support contrast, so we use linear()
      if (operations.contrast && operations.contrast !== 1) {
        const contrast = parseFloat(operations.contrast);
        const a = contrast;
        const b = -(128 * (a - 1)) / 255;
        pipeline = pipeline.linear(a, b);
      }

      // 8. Format conversion and quality
      const format = operations.format || metadata.format || 'jpeg';
      const quality = operations.quality ? parseInt(operations.quality) : 90;

      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          break;
        case 'png':
          pipeline = pipeline.png({
            quality,
            compressionLevel: 9,
            adaptiveFiltering: true
          });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality });
          break;
        case 'gif':
          pipeline = pipeline.gif();
          break;
        case 'tiff':
          pipeline = pipeline.tiff({ quality });
          break;
        default:
          pipeline = pipeline.jpeg({ quality });
      }

      // Save to output
      await pipeline.toFile(outputPath);

      // Get new metadata
      const newMetadata = await sharp(outputPath).metadata();

      return {
        success: true,
        metadata: {
          width: newMetadata.width,
          height: newMetadata.height,
          format: newMetadata.format,
          size: (await fs.stat(outputPath)).size,
          space: newMetadata.space,
          channels: newMetadata.channels,
          depth: newMetadata.depth
        }
      };
    } catch (error) {
      console.error('Error applying transformations:', error);
      throw new Error(`Image transformation failed: ${error.message}`);
    }
  }

  /**
   * Edit an attachment image
   * Creates a new version of the image with transformations
   *
   * @param {number} attachmentId - Attachment ID
   * @param {Object} operations - Transformation operations
   * @param {Object} user - Current user
   * @param {boolean} replaceOriginal - Replace original or create new attachment
   * @returns {Promise<Object>} - Result with new attachment ID
   */
  static async editAttachmentImage(attachmentId, operations, user, replaceOriginal = false) {
    try {
      // Get attachment
      const attachment = await AttachmentService.getAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check if it's an image
      if (!attachment.fileType.startsWith('image/')) {
        throw new Error('Attachment is not an image');
      }

      // Check permissions
      const canAccess = await AttachmentService.canAccessAttachment(attachment, user);
      if (!canAccess) {
        throw new Error('Access denied');
      }

      // Get file paths
      const inputPath = path.join(process.cwd(), 'storage', 'uploads', attachment.filePath);

      // Determine output format
      const outputFormat = operations.format || path.extname(attachment.name).substring(1) || 'jpg';
      const baseFilename = path.basename(attachment.name, path.extname(attachment.name));

      let outputFilename, outputPath;

      if (replaceOriginal) {
        // Replace original file
        outputFilename = `${baseFilename}.${outputFormat}`;
        outputPath = path.join(path.dirname(inputPath), outputFilename);

        // If format changed, we need to backup the original first
        if (outputPath === inputPath) {
          // Same file, create temp backup
          const backupPath = `${inputPath}.backup`;
          await fs.copyFile(inputPath, backupPath);

          try {
            await this.applyTransformations(backupPath, outputPath, operations);
            await fs.unlink(backupPath);
          } catch (error) {
            // Restore backup if transformation fails
            await fs.copyFile(backupPath, inputPath);
            await fs.unlink(backupPath);
            throw error;
          }
        } else {
          // Different format, apply transformation and delete original
          await this.applyTransformations(inputPath, outputPath, operations);
          await fs.unlink(inputPath);
        }

        // Update attachment record
        const newSize = (await fs.stat(outputPath)).size;
        const newMetadata = await sharp(outputPath).metadata();

        const pool = require('../config/database');
        await pool.query(
          `UPDATE Attachment
           SET name = ?, fileType = ?, fileSize = ?, filePath = ?, updatedAt = NOW()
           WHERE id = ?`,
          [
            outputFilename,
            `image/${outputFormat}`,
            newSize,
            path.relative(path.join(process.cwd(), 'storage', 'uploads'), outputPath),
            attachmentId
          ]
        );

        return {
          success: true,
          attachmentId: attachmentId,
          replaced: true,
          metadata: {
            width: newMetadata.width,
            height: newMetadata.height,
            format: newMetadata.format,
            size: newSize
          }
        };
      } else {
        // Create new attachment
        const timestamp = Date.now();
        outputFilename = `${baseFilename}_edited_${timestamp}.${outputFormat}`;
        outputPath = path.join(path.dirname(inputPath), outputFilename);

        // Apply transformations
        await this.applyTransformations(inputPath, outputPath, operations);

        // Create new attachment record
        const [tableName, rowId] = attachment.rowLink.split('/');
        const outputFile = {
          originalname: outputFilename,
          filename: outputFilename,
          mimetype: `image/${outputFormat}`,
          size: (await fs.stat(outputPath)).size
        };

        const newAttachmentId = await AttachmentService.createAttachment(
          tableName,
          parseInt(rowId),
          outputFile,
          user
        );

        const newMetadata = await sharp(outputPath).metadata();

        return {
          success: true,
          attachmentId: newAttachmentId,
          replaced: false,
          metadata: {
            width: newMetadata.width,
            height: newMetadata.height,
            format: newMetadata.format,
            size: outputFile.size
          }
        };
      }
    } catch (error) {
      console.error('Error editing image:', error);
      throw error;
    }
  }

  /**
   * Get image metadata
   *
   * @param {number} attachmentId - Attachment ID
   * @param {Object} user - Current user
   * @returns {Promise<Object>} - Image metadata
   */
  static async getImageMetadata(attachmentId, user) {
    try {
      const attachment = await AttachmentService.getAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      if (!attachment.fileType.startsWith('image/')) {
        throw new Error('Attachment is not an image');
      }

      const canAccess = await AttachmentService.canAccessAttachment(attachment, user);
      if (!canAccess) {
        throw new Error('Access denied');
      }

      const filePath = path.join(process.cwd(), 'storage', 'uploads', attachment.filePath);
      const metadata = await sharp(filePath).metadata();

      return {
        success: true,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation,
          size: attachment.fileSize
        }
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail for preview
   *
   * @param {string} imagePath - Path to image
   * @param {number} maxWidth - Max width for thumbnail
   * @param {number} maxHeight - Max height for thumbnail
   * @returns {Promise<Buffer>} - Thumbnail buffer
   */
  static async generateThumbnail(imagePath, maxWidth = 800, maxHeight = 600) {
    try {
      const buffer = await sharp(imagePath)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      return buffer;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw error;
    }
  }
}

module.exports = ImageEditorService;
