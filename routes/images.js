/**
 * Image Serving Routes
 * Handles serving image files
 * Mounted at /_images
 *
 * Note: Upload and delete operations are handled by routes/imageApi.js (mounted at /_api)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const ImageService = require('../services/imageService');
const SchemaService = require('../services/schemaService');

/**
 * GET /_images/:table/:id/:filename
 * Serve an image file
 */
router.get('/:table/:id/:filename', async (req, res) => {
  try {
    const { table, id, filename } = req.params;

    // Validate table name (prevent directory traversal)
    const tableName = SchemaService.getTableName(table);
    if (!tableName) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }

    // Validate id (must be numeric)
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid row ID'
      });
    }

    // Validate filename (prevent directory traversal)
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    // Build file path
    const imageUrl = `/_images/${tableName}/${id}/${safeFilename}`;
    const filePath = ImageService.getImagePath(imageUrl);

    // Check if file exists
    const exists = await ImageService.imageExists(imageUrl);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Get metadata for content type
    const metadata = await ImageService.getImageMetadata(imageUrl);
    if (metadata && metadata.mimeType) {
      res.setHeader('Content-Type', metadata.mimeType);
    }

    // Set cache headers for images
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year

    // Send file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(404).json({
            success: false,
            error: 'Image not found'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error serving image:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

module.exports = router;
