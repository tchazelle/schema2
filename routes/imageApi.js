/**
 * Image API Routes
 * Handles image upload and deletion operations for image fields in tables
 * Mounted at /_api
 */

const express = require('express');
const router = express.Router();
const ImageService = require('../services/imageService');
const SchemaService = require('../services/schemaService');

/**
 * POST /_api/:table/:id/image/:field
 * Upload an image to a specific field in a row
 */
router.post('/:table/:id/image/:field', async (req, res) => {
  try {
    const { table: tableParam, id, field } = req.params;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    // Use multer middleware for image upload
    const upload = ImageService.getUploadMiddleware();

    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'Image upload failed'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided'
        });
      }

      try {
        // Upload image and update field
        const imageUrl = await ImageService.uploadImage(
          table,
          id,
          field,
          req.file,
          user
        );

        // Get metadata
        const metadata = await ImageService.getImageMetadata(imageUrl);

        res.json({
          success: true,
          message: 'Image uploaded successfully',
          imageUrl: imageUrl,
          metadata: metadata
        });
      } catch (error) {
        console.error('Error uploading image:', error);

        // If we uploaded a file but failed to update DB, clean up the file
        if (req.file && req.file.path) {
          try {
            const fs = require('fs').promises;
            await fs.unlink(req.file.path);
          } catch (cleanupError) {
            console.error('Error cleaning up file:', cleanupError);
          }
        }

        res.status(error.message === 'Permission denied' ? 403 : 500).json({
          success: false,
          error: error.message
        });
      }
    });
  } catch (error) {
    console.error('Error in image upload:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /_api/:table/:id/image/:field
 * Delete an image from a specific field in a row
 */
router.delete('/:table/:id/image/:field', async (req, res) => {
  try {
    const { table: tableParam, id, field } = req.params;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    // Delete image
    await ImageService.deleteImage(table, id, field, user);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(error.message === 'Permission denied' ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /_api/:table/:id/image/:field/metadata
 * Get image metadata using Sharp
 */
router.get('/:table/:id/image/:field/metadata', async (req, res) => {
  try {
    const { table: tableParam, id, field } = req.params;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    // Get metadata
    const result = await ImageService.getImageFieldMetadata(table, id, field, user);

    res.json(result);
  } catch (error) {
    console.error('Error getting image metadata:', error);
    res.status(error.message === 'Permission denied' ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /_api/:table/:id/image/:field/edit
 * Edit image using Sharp transformations
 */
router.post('/:table/:id/image/:field/edit', async (req, res) => {
  try {
    const { table: tableParam, id, field } = req.params;
    const user = req.user;
    const { operations, replaceOriginal } = req.body;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    // Edit image
    const result = await ImageService.editImageField(
      table,
      id,
      field,
      operations,
      user,
      replaceOriginal
    );

    res.json(result);
  } catch (error) {
    console.error('Error editing image:', error);
    res.status(error.message === 'Permission denied' ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /_api/:table/:id/image/:field/download
 * Download image from field
 */
router.get('/:table/:id/image/:field/download', async (req, res) => {
  try {
    const { table: tableParam, id, field } = req.params;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    // Check if field exists and has image renderer
    const fieldDef = SchemaService.getFieldConfig(table, field);
    if (!fieldDef) {
      return res.status(404).json({
        success: false,
        error: `Field ${field} not found in table ${table}`
      });
    }

    if (fieldDef.renderer !== 'image') {
      return res.status(400).json({
        success: false,
        error: `Field ${field} is not an image field`
      });
    }

    // Check permissions
    const PermissionService = require('../services/permissionService');
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    // Get image URL from database
    const pool = require('../config/database');
    const [rows] = await pool.query(
      `SELECT ${field} FROM ${table} WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Row not found'
      });
    }

    const imageUrl = rows[0][field];
    if (!imageUrl) {
      return res.status(404).json({
        success: false,
        error: 'No image in this field'
      });
    }

    // Get file path
    const filePath = ImageService.getImagePath(imageUrl);
    const path = require('path');
    const filename = path.basename(filePath);

    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
