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

module.exports = router;
