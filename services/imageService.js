/**
 * Image Service
 * Handles image upload, storage, and deletion for image fields in tables
 */

const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const SchemaService = require('./schemaService');
const PermissionService = require('./permissionService');

class ImageService {
  /**
   * Configure multer storage for image fields
   * Creates directory structure: storage/images/TableName/
   */
  static getMulterStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const { table } = req.params;

          if (!table) {
            return cb(new Error('Table is required for image upload'));
          }

          // Normalize table name
          const tableName = SchemaService.getTableName(table);
          if (!tableName) {
            return cb(new Error(`Table ${table} not found`));
          }

          // Create directory structure: storage/images/TableName/
          const uploadDir = path.join(process.cwd(), 'storage', 'images', tableName);

          // Create directory recursively if it doesn't exist
          await fs.mkdir(uploadDir, { recursive: true });

          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        // Use timestamp and random string to avoid conflicts
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}_${random}${ext}`);
      }
    });
  }

  /**
   * Get multer upload middleware for images
   * Only accepts image files with size limits
   */
  static getUploadMiddleware() {
    const storage = ImageService.getMulterStorage();

    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size for images
      },
      fileFilter: (req, file, cb) => {
        // Only accept image files
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml'
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)'));
        }
      }
    });
  }

  /**
   * Upload image and update field value
   * @param {string} table - Table name
   * @param {number} id - Row ID
   * @param {string} field - Field name
   * @param {Object} file - Multer file object
   * @param {Object} user - Current user
   * @returns {Promise<string>} - Image URL
   */
  static async uploadImage(table, id, field, file, user) {
    try {
      const tableName = SchemaService.getTableName(table);
      if (!tableName) {
        throw new Error(`Table ${table} not found`);
      }

      // Check if field exists and has image renderer
      const fieldDef = SchemaService.getFieldConfig(tableName, field);
      if (!fieldDef) {
        throw new Error(`Field ${field} not found in table ${tableName}`);
      }

      if (fieldDef.renderer !== 'image') {
        throw new Error(`Field ${field} is not an image field`);
      }

      // Check permissions
      if (!PermissionService.hasPermission(user, tableName, 'update')) {
        throw new Error('Permission denied');
      }

      // Get existing row to check if there's an old image to delete
      const [rows] = await pool.query(
        `SELECT ${field} FROM ${tableName} WHERE id = ?`,
        [id]
      );

      const existingRow = rows[0];
      if (!existingRow) {
        throw new Error('Row not found');
      }

      // Delete old image if exists
      if (existingRow[field]) {
        await ImageService.deleteImageFile(existingRow[field]);
      }

      // Build relative URL for storage (e.g., "/_images/Person/123456_abc.jpg")
      const imageUrl = `/_images/${tableName}/${file.filename}`;

      // Update database with new image URL
      await pool.query(
        `UPDATE ${tableName} SET ${field} = ?, updatedAt = NOW() WHERE id = ?`,
        [imageUrl, id]
      );

      return imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  /**
   * Delete image field value and file
   * @param {string} table - Table name
   * @param {number} id - Row ID
   * @param {string} field - Field name
   * @param {Object} user - Current user
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteImage(table, id, field, user) {
    try {
      const tableName = SchemaService.getTableName(table);
      if (!tableName) {
        throw new Error(`Table ${table} not found`);
      }

      // Check permissions
      if (!PermissionService.hasPermission(user, tableName, 'update')) {
        throw new Error('Permission denied');
      }

      // Get existing image URL
      const [rows] = await pool.query(
        `SELECT ${field} FROM ${tableName} WHERE id = ?`,
        [id]
      );

      const existingRow = rows[0];
      if (!existingRow) {
        throw new Error('Row not found');
      }

      if (!existingRow[field]) {
        return true; // No image to delete
      }

      // Delete file
      await ImageService.deleteImageFile(existingRow[field]);

      // Update database to remove image URL
      await pool.query(
        `UPDATE ${tableName} SET ${field} = NULL, updatedAt = NOW() WHERE id = ?`,
        [id]
      );

      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  /**
   * Delete image file from filesystem
   * @param {string} imageUrl - Image URL (e.g., "/_images/Person/123456_abc.jpg")
   * @returns {Promise<void>}
   */
  static async deleteImageFile(imageUrl) {
    try {
      if (!imageUrl) return;

      // Extract path from URL (remove /_images/ prefix)
      const relativePath = imageUrl.replace(/^\/_images\//, '');
      const filePath = path.join(process.cwd(), 'storage', 'images', relativePath);

      // Check if file exists before deleting
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (error) {
        // File doesn't exist or can't be accessed - that's ok
        console.log('Image file not found or already deleted:', filePath);
      }
    } catch (error) {
      console.error('Error deleting image file:', error);
      // Don't throw - we want to continue even if file deletion fails
    }
  }

  /**
   * Get image file path from URL
   * @param {string} imageUrl - Image URL (e.g., "/_images/Person/123456_abc.jpg")
   * @returns {string} - Absolute file path
   */
  static getImagePath(imageUrl) {
    if (!imageUrl) return null;

    // Extract path from URL (remove /_images/ prefix)
    const relativePath = imageUrl.replace(/^\/_images\//, '');
    return path.join(process.cwd(), 'storage', 'images', relativePath);
  }

  /**
   * Check if image file exists
   * @param {string} imageUrl - Image URL
   * @returns {Promise<boolean>} - True if file exists
   */
  static async imageExists(imageUrl) {
    try {
      if (!imageUrl) return false;

      const filePath = ImageService.getImagePath(imageUrl);
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get image metadata
   * @param {string} imageUrl - Image URL
   * @returns {Promise<Object|null>} - Image metadata (size, mime type, etc.)
   */
  static async getImageMetadata(imageUrl) {
    try {
      if (!imageUrl) return null;

      const filePath = ImageService.getImagePath(imageUrl);
      const stats = await fs.stat(filePath);

      // Determine MIME type from extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };

      return {
        size: stats.size,
        mimeType: mimeTypes[ext] || 'application/octet-stream',
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return null;
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size (e.g., "1.5 MB")
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get image field metadata using Sharp
   * @param {string} table - Table name
   * @param {number} id - Row ID
   * @param {string} field - Field name
   * @param {Object} user - Current user
   * @returns {Promise<Object>} - Image metadata
   */
  static async getImageFieldMetadata(table, id, field, user) {
    try {
      const tableName = SchemaService.getTableName(table);
      if (!tableName) {
        throw new Error(`Table ${table} not found`);
      }

      // Check if field exists and has image renderer
      const fieldDef = SchemaService.getFieldConfig(tableName, field);
      if (!fieldDef) {
        throw new Error(`Field ${field} not found in table ${tableName}`);
      }

      if (fieldDef.renderer !== 'image') {
        throw new Error(`Field ${field} is not an image field`);
      }

      // Check permissions
      if (!PermissionService.hasPermission(user, tableName, 'read')) {
        throw new Error('Permission denied');
      }

      // Get image URL from database
      const [rows] = await pool.query(
        `SELECT ${field} FROM ${tableName} WHERE id = ?`,
        [id]
      );

      if (!rows || rows.length === 0) {
        throw new Error('Row not found');
      }

      const imageUrl = rows[0][field];
      if (!imageUrl) {
        throw new Error('No image in this field');
      }

      // Get file path and metadata
      const filePath = ImageService.getImagePath(imageUrl);
      const metadata = await sharp(filePath).metadata();
      const stats = await fs.stat(filePath);

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
          size: stats.size
        }
      };
    } catch (error) {
      console.error('Error getting image field metadata:', error);
      throw error;
    }
  }

  /**
   * Edit image field using Sharp transformations
   * @param {string} table - Table name
   * @param {number} id - Row ID
   * @param {string} field - Field name
   * @param {Object} operations - Sharp transformation operations
   * @param {Object} user - Current user
   * @param {boolean} replaceOriginal - Replace original or create new file
   * @returns {Promise<Object>} - Result with new image URL
   */
  static async editImageField(table, id, field, operations, user, replaceOriginal = false) {
    try {
      const tableName = SchemaService.getTableName(table);
      if (!tableName) {
        throw new Error(`Table ${table} not found`);
      }

      // Check if field exists and has image renderer
      const fieldDef = SchemaService.getFieldConfig(tableName, field);
      if (!fieldDef) {
        throw new Error(`Field ${field} not found in table ${tableName}`);
      }

      if (fieldDef.renderer !== 'image') {
        throw new Error(`Field ${field} is not an image field`);
      }

      // Check permissions
      if (!PermissionService.hasPermission(user, tableName, 'update')) {
        throw new Error('Permission denied');
      }

      // Get current image URL
      const [rows] = await pool.query(
        `SELECT ${field} FROM ${tableName} WHERE id = ?`,
        [id]
      );

      if (!rows || rows.length === 0) {
        throw new Error('Row not found');
      }

      const imageUrl = rows[0][field];
      if (!imageUrl) {
        throw new Error('No image in this field');
      }

      // Get input file path
      const inputPath = ImageService.getImagePath(imageUrl);

      // Determine output format
      const outputFormat = operations.format || path.extname(inputPath).substring(1) || 'jpg';
      const baseFilename = path.basename(inputPath, path.extname(inputPath));
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);

      let outputFilename, outputPath, newImageUrl;

      if (replaceOriginal) {
        // Replace original file
        outputFilename = `${baseFilename}.${outputFormat}`;
        outputPath = path.join(path.dirname(inputPath), outputFilename);

        // If same file, create temp backup
        if (outputPath === inputPath) {
          const backupPath = `${inputPath}.backup`;
          await fs.copyFile(inputPath, backupPath);

          try {
            await ImageService.applyTransformations(backupPath, outputPath, operations);
            await fs.unlink(backupPath);
          } catch (error) {
            // Restore backup if transformation fails
            await fs.copyFile(backupPath, inputPath);
            await fs.unlink(backupPath);
            throw error;
          }
        } else {
          // Different format, apply transformation and delete original
          await ImageService.applyTransformations(inputPath, outputPath, operations);
          await fs.unlink(inputPath);
        }

        newImageUrl = `/_images/${tableName}/${outputFilename}`;
      } else {
        // Create new file
        outputFilename = `${timestamp}_${random}_edited.${outputFormat}`;
        outputPath = path.join(path.dirname(inputPath), outputFilename);

        // Apply transformations
        await ImageService.applyTransformations(inputPath, outputPath, operations);

        newImageUrl = `/_images/${tableName}/${outputFilename}`;
      }

      // Update database with new image URL
      await pool.query(
        `UPDATE ${tableName} SET ${field} = ?, updatedAt = NOW() WHERE id = ?`,
        [newImageUrl, id]
      );

      // Get new metadata
      const newMetadata = await sharp(outputPath).metadata();
      const stats = await fs.stat(outputPath);

      return {
        success: true,
        imageUrl: newImageUrl,
        replaced: replaceOriginal,
        metadata: {
          width: newMetadata.width,
          height: newMetadata.height,
          format: newMetadata.format,
          size: stats.size
        }
      };
    } catch (error) {
      console.error('Error editing image field:', error);
      throw error;
    }
  }

  /**
   * Apply image transformations using Sharp
   * @param {string} inputPath - Input file path
   * @param {string} outputPath - Output file path
   * @param {Object} operations - Transformation operations
   * @returns {Promise<Object>} - Result with metadata
   */
  static async applyTransformations(inputPath, outputPath, operations = {}) {
    try {
      let pipeline = sharp(inputPath);

      // Get original metadata
      const metadata = await pipeline.metadata();

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
          fit: operations.resize.fit || 'inside',
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
          size: (await fs.stat(outputPath)).size
        }
      };
    } catch (error) {
      console.error('Error applying transformations:', error);
      throw new Error(`Image transformation failed: ${error.message}`);
    }
  }
}

module.exports = ImageService;
