/**
 * Image Service
 * Handles image upload, storage, and deletion for image fields in tables
 */

const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const multer = require('multer');
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
      const fieldDef = SchemaService.getFieldDefinition(tableName, field);
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
}

module.exports = ImageService;
