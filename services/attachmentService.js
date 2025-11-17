/**
 * Attachment Service
 * Handles file upload, storage, preview, and deletion for attachments
 */

const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const multer = require('multer');
const SchemaService = require('./schemaService');
const PermissionService = require('./permissionService');

class AttachmentService {
  /**
   * Configure multer storage dynamically based on table and rowId
   * Creates directory structure: uploads/TableName/id/
   */
  static getMulterStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const { table, id } = req.params;

          if (!table || !id) {
            return cb(new Error('Table and ID are required for file upload'));
          }

          // Normalize table name
          const tableName = SchemaService.getTableName(table);
          if (!tableName) {
            return cb(new Error(`Table ${table} not found`));
          }

          // Create directory structure: uploads/TableName/id/
          const uploadDir = path.join(process.cwd(), 'uploads', tableName, id);

          // Create directory recursively if it doesn't exist
          await fs.mkdir(uploadDir, { recursive: true });

          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        // Use original filename with timestamp to avoid conflicts
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        // Sanitize filename
        const sanitized = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${sanitized}_${timestamp}${ext}`);
      }
    });
  }

  /**
   * Get multer upload middleware
   * Supports multiple file types with size limits
   */
  static getUploadMiddleware() {
    const storage = AttachmentService.getMulterStorage();

    return multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
      },
      fileFilter: (req, file, cb) => {
        // Accept all file types for now
        // Could add restrictions here if needed
        cb(null, true);
      }
    });
  }

  /**
   * Create attachment record in database
   * @param {string} table - Parent table name
   * @param {number} id - Parent row ID
   * @param {Object} file - Multer file object
   * @param {Object} user - Current user
   * @returns {Promise<number>} - Attachment ID
   */
  static async createAttachment(table, id, file, user) {
    try {
      const tableName = SchemaService.getTableName(table);
      if (!tableName) {
        throw new Error(`Table ${table} not found`);
      }

      // Create rowLink: "TableName/id"
      const rowLink = `${tableName}/${id}`;

      // Relative path for storage
      const relativePath = path.join('uploads', tableName, id.toString(), file.filename);

      // Insert attachment record
      const [result] = await pool.query(
        `INSERT INTO Attachment (rowLink, name, fileType, fileSize, filePath, ownerId, granted, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          rowLink,
          file.originalname,
          file.mimetype,
          file.size,
          relativePath,
          user?.id || null,
          'shared' // Inherit parent's permissions
        ]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error creating attachment:', error);
      throw error;
    }
  }

  /**
   * Get all attachments for a specific row
   * @param {string} table - Parent table name
   * @param {number} id - Parent row ID
   * @param {Object} user - Current user
   * @returns {Promise<Array>} - List of attachments
   */
  static async getAttachments(table, id, user) {
    try {
      const tableName = SchemaService.getTableName(table);
      if (!tableName) {
        throw new Error(`Table ${table} not found`);
      }

      // Check if user has permission to read the parent table
      if (!PermissionService.hasPermission(user, tableName, 'read')) {
        throw new Error('Access denied');
      }

      const rowLink = `${tableName}/${id}`;

      const [rows] = await pool.query(
        `SELECT id, rowLink, name, fileType, fileSize, filePath, createdAt, updatedAt
         FROM Attachment
         WHERE rowLink = ?
         ORDER BY createdAt DESC`,
        [rowLink]
      );

      return rows;
    } catch (error) {
      console.error('Error getting attachments:', error);
      throw error;
    }
  }

  /**
   * Get a single attachment by ID
   * @param {number} attachmentId - Attachment ID
   * @returns {Promise<Object|null>} - Attachment record
   */
  static async getAttachmentById(attachmentId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, rowLink, name, fileType, fileSize, filePath, ownerId, granted
         FROM Attachment
         WHERE id = ?`,
        [attachmentId]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error getting attachment by ID:', error);
      throw error;
    }
  }

  /**
   * Delete attachment (file and database record)
   * @param {number} attachmentId - Attachment ID
   * @param {Object} user - Current user
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteAttachment(attachmentId, user) {
    try {
      // Get attachment record
      const attachment = await AttachmentService.getAttachmentById(attachmentId);

      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Parse rowLink to get table and id
      const [tableName, rowId] = attachment.rowLink.split('/');

      // Check if user has permission to delete
      if (!PermissionService.hasPermission(user, tableName, 'update')) {
        throw new Error('Access denied');
      }

      // Delete file from filesystem
      const filePath = path.join(process.cwd(), attachment.filePath);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
        // Continue even if file deletion fails
      }

      // Delete database record
      await pool.query('DELETE FROM Attachment WHERE id = ?', [attachmentId]);

      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
  }

  /**
   * Check if file type supports preview
   * @param {string} mimeType - File MIME type
   * @returns {string} - Preview type: 'image', 'audio', 'video', 'pdf', 'none'
   */
  static getPreviewType(mimeType) {
    if (!mimeType) return 'none';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'pdf';

    return 'none';
  }

  /**
   * Get file icon based on MIME type
   * @param {string} mimeType - File MIME type
   * @returns {string} - Icon emoji
   */
  static getFileIcon(mimeType) {
    if (!mimeType) return '📄';

    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';

    return '📄';
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size (e.g., "1.5 MB")
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if user can access attachment (based on parent row permissions)
   * @param {Object} attachment - Attachment record
   * @param {Object} user - Current user
   * @returns {Promise<boolean>} - Access granted
   */
  static async canAccessAttachment(attachment, user) {
    try {
      // Parse rowLink to get table
      const [tableName] = attachment.rowLink.split('/');

      // Check table-level read permission
      return PermissionService.hasPermission(user, tableName, 'read');
    } catch (error) {
      console.error('Error checking attachment access:', error);
      return false;
    }
  }
}

module.exports = AttachmentService;
