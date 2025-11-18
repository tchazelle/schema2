/**
 * Image Editor Routes
 * Handles image editing operations using Sharp
 */

const express = require('express');
const router = express.Router();
const ImageEditorService = require('../services/imageEditorService');
const UIService = require('../services/uiService');

/**
 * GET /_api/attachments/:id/image-metadata
 * Get image metadata for editing
 */
router.get('/attachments/:id/image-metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await ImageEditorService.getImageMetadata(id, user);
    res.json(result);
  } catch (error) {
    console.error('Error getting image metadata:', error);
    if (error.message === 'Attachment not found') {
      res.status(404).json({ success: false, error: 'Attachment not found' });
    } else if (error.message === 'Access denied') {
      res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    } else if (error.message === 'Attachment is not an image') {
      res.status(400).json({ success: false, error: 'Attachment is not an image' });
    } else {
      res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
    }
  }
});

/**
 * POST /_api/attachments/:id/edit-image
 * Apply image transformations
 *
 * Body:
 * {
 *   operations: {
 *     resize: { width: 800, height: 600, fit: 'inside' },
 *     crop: { left: 0, top: 0, width: 100, height: 100 },
 *     rotate: 90,
 *     flip: 'horizontal' | 'vertical' | 'both',
 *     grayscale: true,
 *     blur: 5,
 *     sharpen: 2,
 *     negate: true,
 *     normalize: true,
 *     brightness: 1.2,
 *     contrast: 1.1,
 *     saturation: 1.5,
 *     hue: 180,
 *     format: 'jpeg' | 'png' | 'webp' | 'avif',
 *     quality: 90
 *   },
 *   replaceOriginal: false
 * }
 */
router.post('/attachments/:id/edit-image', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { operations = {}, replaceOriginal = false } = req.body;

    const result = await ImageEditorService.editAttachmentImage(
      id,
      operations,
      user,
      replaceOriginal
    );

    res.json({
      ...result,
      message: replaceOriginal
        ? 'Image updated successfully'
        : 'New edited image created successfully'
    });
  } catch (error) {
    console.error('Error editing image:', error);
    if (error.message === 'Attachment not found') {
      res.status(404).json({ success: false, error: 'Attachment not found' });
    } else if (error.message === 'Access denied') {
      res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    } else if (error.message === 'Attachment is not an image') {
      res.status(400).json({ success: false, error: 'Attachment is not an image' });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Image editing failed'
      });
    }
  }
});

/**
 * GET /_api/attachments/:id/preview
 * Generate a preview with transformations (without saving)
 * Query params: same as operations above
 */
router.get('/attachments/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

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

    // Get attachment
    const AttachmentService = require('../services/attachmentService');
    const attachment = await AttachmentService.getAttachmentById(id);

    if (!attachment) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    if (!attachment.fileType.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Attachment is not an image' });
    }

    const canAccess = await AttachmentService.canAccessAttachment(attachment, user);
    if (!canAccess) {
      return res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    }

    const path = require('path');
    const sharp = require('sharp');
    const inputPath = path.join(process.cwd(), 'storage', 'uploads', attachment.filePath);

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

    // Apply brightness, saturation (and hue if provided)
    // Note: Sharp's modulate() doesn't support contrast directly - it needs linear() or normalize()
    if (operations.brightness !== undefined || operations.saturation !== undefined) {
      pipeline = pipeline.modulate({
        brightness: operations.brightness !== undefined ? operations.brightness : 1,
        saturation: operations.saturation !== undefined ? operations.saturation : 1,
        hue: 0
      });
    }

    // Apply contrast using linear transformation
    // linear() applies: output = (input * a) + b
    // For contrast adjustment: a = contrast, b = -(128 * (contrast - 1)) / 255
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

module.exports = router;
