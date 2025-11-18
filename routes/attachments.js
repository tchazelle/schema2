/**
 * Attachment Routes
 * Handles file upload, download, listing, and deletion for attachments
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const AttachmentService = require('../services/attachmentService');
const PermissionService = require('../services/permissionService');
const SchemaService = require('../services/schemaService');
const UIService = require('../services/uiService');
const schema = require('../schema');

/**
 * POST /_api/:table/:id/attachments
 * Upload a file attachment to a specific row
 */
router.post('/:table/:id/attachments', async (req, res) => {
  try {
    const { table: tableParam, id } = req.params;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json(UIService.jsonError(UIService.messages.TABLE_NOT_FOUND));
    }

    // Check if table has attachments enabled
    const tableConfig = schema.tables[table];
    if (!tableConfig.hasAttachmentsTab) {
      return res.status(400).json({
        success: false,
        error: `Table ${table} does not support attachments`
      });
    }

    // Check if user has permission to update the parent row
    if (!PermissionService.hasPermission(user, table, 'update')) {
      return res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    }

    // Use multer middleware for file upload
    const upload = AttachmentService.getUploadMiddleware();

    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      try {
        // Create attachment record
        const attachmentId = await AttachmentService.createAttachment(
          table,
          id,
          req.file,
          user
        );

        // Get the created attachment
        const attachment = await AttachmentService.getAttachmentById(attachmentId);

        res.json({
          success: true,
          message: 'File uploaded successfully',
          attachment: {
            id: attachment.id,
            fileName: attachment.name, // Database field is 'name', API uses 'fileName' for backward compatibility
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            fileSizeFormatted: AttachmentService.formatFileSize(attachment.fileSize),
            previewType: AttachmentService.getPreviewType(attachment.fileType, attachment.name),
            icon: AttachmentService.getFileIcon(attachment.fileType),
            downloadUrl: `/_api/attachments/${attachment.id}/download`,
            createdAt: attachment.createdAt
          }
        });
      } catch (error) {
        console.error('Error creating attachment record:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create attachment record'
        });
      }
    });
  } catch (error) {
    console.error('Error in attachment upload:', error);
    res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
  }
});

/**
 * GET /_api/:table/:id/attachments
 * Get all attachments for a specific row
 */
router.get('/:table/:id/attachments', async (req, res) => {
  try {
    const { table: tableParam, id } = req.params;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);
    if (!table) {
      return res.status(404).json(UIService.jsonError(UIService.messages.TABLE_NOT_FOUND));
    }

    // Check if table has attachments enabled
    const tableConfig = schema.tables[table];
    if (!tableConfig.hasAttachmentsTab) {
      return res.status(400).json({
        success: false,
        error: `Table ${table} does not support attachments`
      });
    }

    // Get attachments
    const attachments = await AttachmentService.getAttachments(table, id, user);

    // Format attachments with preview info
    const formattedAttachments = attachments.map(att => ({
      id: att.id,
      fileName: att.name, // Database field is 'name', API uses 'fileName' for backward compatibility
      fileType: att.fileType,
      fileSize: att.fileSize,
      fileSizeFormatted: AttachmentService.formatFileSize(att.fileSize),
      previewType: AttachmentService.getPreviewType(att.fileType, att.name),
      icon: AttachmentService.getFileIcon(att.fileType),
      downloadUrl: `/_api/attachments/${att.id}/download`,
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      granted: att.granted
    }));

    res.json({
      success: true,
      table: table,
      id: id,
      count: formattedAttachments.length,
      attachments: formattedAttachments
    });
  } catch (error) {
    console.error('Error getting attachments:', error);
    if (error.message === 'Access denied') {
      res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    } else {
      res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
    }
  }
});

/**
 * GET /_api/attachments/:id/download
 * Download or preview an attachment file
 */
router.get('/attachments/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const inline = req.query.inline === '1'; // Preview vs download

    // Get attachment
    const attachment = await AttachmentService.getAttachmentById(id);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }

    // Check access permissions
    const canAccess = await AttachmentService.canAccessAttachment(attachment, user);
    if (!canAccess) {
      return res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    }

    // Build file path (prepend storage/uploads/ to the stored path)
    const filePath = path.join(process.cwd(), 'storage', 'uploads', attachment.filePath);

    // Set content type
    res.setHeader('Content-Type', attachment.fileType);

    // Set disposition (inline for preview, attachment for download)
    if (inline) {
      res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
    }

    // Send file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(404).json({
            success: false,
            error: 'File not found on disk'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading attachment:', error);
    if (!res.headersSent) {
      res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
    }
  }
});

/**
 * DELETE /_api/attachments/:id
 * Delete an attachment
 */
router.delete('/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Delete attachment
    await AttachmentService.deleteAttachment(id, user);

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    if (error.message === 'Attachment not found') {
      res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    } else if (error.message === 'Access denied') {
      res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    } else {
      res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
    }
  }
});

module.exports = router;
