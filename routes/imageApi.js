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
 * GET /_api/:table/:id/image/:field/preview
 * Generate a preview with transformations (without saving)
 * Query params: width, height, fit, rotate, flip, grayscale, blur, sharpen, brightness, contrast, saturation, format, quality
 */
router.get('/:table/:id/image/:field/preview', async (req, res) => {
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

    // Parse operations from query params
    const operations = {};

    if (req.query.width || req.query.height) {
      operations.resize = {
        width: req.query.width ? parseInt(req.query.width) : null,
        height: req.query.height ? parseInt(req.query.height) : null,
        fit: req.query.fit || 'inside'
      };
    }

    if (req.query.rotate) {
      operations.rotate = parseInt(req.query.rotate);
    }

    if (req.query.flip) {
      operations.flip = req.query.flip;
    }

    if (req.query.grayscale === 'true') {
      operations.grayscale = true;
    }

    if (req.query.blur) {
      operations.blur = parseFloat(req.query.blur);
    }

    if (req.query.sharpen) {
      operations.sharpen = parseFloat(req.query.sharpen);
    }

    if (req.query.brightness) {
      operations.brightness = parseFloat(req.query.brightness);
    }

    if (req.query.contrast) {
      operations.contrast = parseFloat(req.query.contrast);
    }

    if (req.query.saturation) {
      operations.saturation = parseFloat(req.query.saturation);
    }

    if (req.query.format) {
      operations.format = req.query.format;
    }

    if (req.query.quality) {
      operations.quality = parseInt(req.query.quality);
    }

    // Check field definition
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
    const inputPath = ImageService.getImagePath(imageUrl);
    const sharp = require('sharp');

    // Apply transformations and send as buffer
    let pipeline = sharp(inputPath);

    if (operations.rotate) {
      pipeline = pipeline.rotate(operations.rotate);
    }

    if (operations.flip) {
      if (operations.flip === 'horizontal') pipeline = pipeline.flop();
      if (operations.flip === 'vertical') pipeline = pipeline.flip();
      if (operations.flip === 'both') pipeline = pipeline.flip().flop();
    }

    if (operations.resize) {
      pipeline = pipeline.resize(operations.resize);
    }

    if (operations.grayscale) {
      pipeline = pipeline.grayscale();
    }

    if (operations.blur) {
      pipeline = pipeline.blur(operations.blur);
    }

    if (operations.sharpen) {
      pipeline = pipeline.sharpen(operations.sharpen);
    }

    if (operations.brightness !== undefined || operations.saturation !== undefined) {
      pipeline = pipeline.modulate({
        brightness: operations.brightness !== undefined ? operations.brightness : 1,
        saturation: operations.saturation !== undefined ? operations.saturation : 1,
        hue: 0
      });
    }

    if (operations.contrast && operations.contrast !== 1) {
      const a = operations.contrast;
      const b = -(128 * (a - 1)) / 255;
      pipeline = pipeline.linear(a, b);
    }

    const format = operations.format || 'jpeg';
    const quality = operations.quality || 90;

    switch (format) {
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        pipeline = pipeline.jpeg({ quality });
    }

    const buffer = await pipeline.toBuffer();

    res.set('Content-Type', `image/${format}`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed'
    });
  }
});

/**
 * GET /_api/:table/:id/image/:field/versions
 * List all versions of an image
 */
router.get('/:table/:id/image/:field/versions', async (req, res) => {
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

    // Get versions
    const versions = await ImageService.listImageVersions(table, id, field, user);

    res.json({
      success: true,
      versions: versions
    });
  } catch (error) {
    console.error('Error listing image versions:', error);
    res.status(error.message === 'Permission denied' ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /_api/:table/:id/image/:field/version
 * Switch to a specific version of an image
 * Body: { filename: "image_v2.jpg" }
 */
router.post('/:table/:id/image/:field/version', async (req, res) => {
  try {
    const { table: tableParam, id, field } = req.params;
    const { filename } = req.body;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }

    // Switch to version
    const imageUrl = await ImageService.switchToVersion(table, id, field, filename, user);

    res.json({
      success: true,
      message: 'Version switched successfully',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error switching version:', error);
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
