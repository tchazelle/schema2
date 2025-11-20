/**
 * Attachment Routes
 * Handles file upload, download, listing, and deletion for attachments
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
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

    // Check if file is markdown and inline preview is requested
    const isMarkdown = attachment.name.match(/\.(md|markdown)$/i);
    if (inline && isMarkdown) {
      try {
        // Read markdown file
        const markdownContent = await fs.readFile(filePath, 'utf8');

        // Dynamically import marked (ES Module)
        const { marked } = await import('marked');

        // Configure marked to support GFM (GitHub Flavored Markdown) including tables
        marked.setOptions({
          gfm: true,
          breaks: true,
          tables: true
        });

        // Convert markdown to HTML
        const htmlContent = marked.parse(markdownContent);

        // Send HTML wrapped in a nice template
        const htmlPage = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${attachment.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background-color: #fff;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    code {
      background-color: rgba(27, 31, 35, 0.05);
      border-radius: 3px;
      padding: 0.2em 0.4em;
      font-family: 'Courier New', Courier, monospace;
      font-size: 85%;
    }
    pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
      line-height: 1.45;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      border-radius: 0;
    }
    blockquote {
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid #dfe2e5;
      margin: 0 0 16px 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    table th, table td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    table tr {
      background-color: #fff;
      border-top: 1px solid #c6cbd1;
    }
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    ul, ol {
      padding-left: 2em;
      margin-bottom: 16px;
    }
    li + li {
      margin-top: 0.25em;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlPage);
        return;
      } catch (error) {
        console.error('Error converting markdown:', error);
        // Fall through to normal file sending if conversion fails
      }
    }

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

/**
 * POST /_api/attachments/:id/copy-to-image-field
 * Copy an attachment image to an image field of the parent row
 * Body: { fieldName: "image" }
 */
router.post('/attachments/:id/copy-to-image-field', async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldName } = req.body;
    const user = req.user;

    if (!fieldName) {
      return res.status(400).json({
        success: false,
        error: 'Le nom du champ image est requis (fieldName)'
      });
    }

    // Get attachment
    const attachment = await AttachmentService.getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }

    // Check if attachment is an image
    if (!attachment.fileType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'L\'attachment n\'est pas une image'
      });
    }

    // Parse rowLink to get table and row ID
    const [tableName, rowId] = attachment.rowLink.split('/');
    if (!tableName || !rowId) {
      return res.status(400).json({
        success: false,
        error: 'Format rowLink invalide'
      });
    }

    // Check if user has permission to update the parent row
    if (!PermissionService.hasPermission(user, tableName, 'update')) {
      return res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
    }

    // Check if field exists and is an image field
    const fieldDef = SchemaService.getFieldConfig(tableName, fieldName);
    if (!fieldDef) {
      return res.status(404).json({
        success: false,
        error: `Le champ ${fieldName} n'existe pas dans la table ${tableName}`
      });
    }

    if (fieldDef.renderer !== 'image') {
      return res.status(400).json({
        success: false,
        error: `Le champ ${fieldName} n'est pas un champ image`
      });
    }

    // Copy file from storage/uploads to storage/images
    const sourceFilePath = path.join(process.cwd(), 'storage', 'uploads', attachment.filePath);
    const destinationDir = path.join(process.cwd(), 'storage', 'images', tableName, rowId);

    // Create destination directory if it doesn't exist
    await fs.mkdir(destinationDir, { recursive: true });

    // Get filename and extension
    const filename = path.basename(sourceFilePath);
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);

    // Create destination filename (use original filename or sanitize)
    const destinationFilename = filename;
    const destinationFilePath = path.join(destinationDir, destinationFilename);

    // Copy file
    await fs.copyFile(sourceFilePath, destinationFilePath);

    // Build image URL for database
    const imageUrl = `/_images/${tableName}/${rowId}/${destinationFilename}`;

    // Update database field
    const pool = require('../config/database');
    await pool.query(
      `UPDATE \`${tableName}\` SET ${fieldName} = ?, updatedAt = NOW() WHERE id = ?`,
      [imageUrl, rowId]
    );

    res.json({
      success: true,
      message: 'Image copiée avec succès vers le champ image',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Error copying attachment to image field:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la copie de l\'image'
    });
  }
});

module.exports = router;
