/**
 * NotificationService
 *
 * Service for sending email notifications about records to users who have access.
 * Handles:
 * - Finding users with access to a specific record
 * - Formatting email content with record data
 * - Sending emails via nodemailer
 */

const nodemailer = require('nodemailer');
const pool = require('../config/database');
const schema = require('../schema');
const EntityService = require('./entityService');
const PermissionService = require('./permissionService');
const SchemaService = require('./schemaService');
const { getTableData } = require('./tableDataService');
const { GRANTED_VALUES, extractRoleFromGranted, isPublishedRole } = require('../constants/permissions');

class NotificationService {
  /**
   * Get SMTP transporter configured from environment variables
   * @returns {Object} - Nodemailer transporter
   */
  static getTransporter() {
    // Check if email is configured
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      throw new Error('Email not configured. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env');
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Get all users who have access to a specific record
   * Based on the record's granted value and table permissions
   *
   * @param {string} tableName - Name of the table
   * @param {number} recordId - ID of the record
   * @param {Object} sender - The user sending the notification (optional, for filtering)
   * @param {Object} options - Options: { includeSender: boolean }
   * @returns {Promise<Array>} - Array of users with email addresses
   */
  static async getRecipients(tableName, recordId, sender = null, options = {}) {
    const { includeSender = false } = options;

    // Get the record to check its granted value
    const [rows] = await pool.query(
      `SELECT granted, ownerId FROM ${tableName} WHERE id = ?`,
      [recordId]
    );

    if (rows.length === 0) {
      throw new Error('Record not found');
    }

    const record = rows[0];
    const recipients = [];

    // Logic based on granted value
    if (record.granted === GRANTED_VALUES.DRAFT) {
      // Draft: only owner can access
      if (record.ownerId) {
        const [ownerRows] = await pool.query(
          'SELECT id, email, givenName, familyName FROM Person WHERE id = ? AND email IS NOT NULL AND email != ""',
          [record.ownerId]
        );
        if (ownerRows.length > 0) {
          recipients.push(ownerRows[0]);
        }
      }
    } else if (record.granted === GRANTED_VALUES.SHARED) {
      // Shared: all users with table read permission
      // Get all roles that have read permission on this table
      const tableConfig = schema.tables[tableName];
      const tableGrants = tableConfig?.granted || schema.defaultConfigTable.granted;

      const rolesWithAccess = [];
      for (const role in tableGrants) {
        if (tableGrants[role].includes('read')) {
          rolesWithAccess.push(role);
        }
      }

      if (rolesWithAccess.length > 0) {
        // Get all users with these roles (considering role inheritance)
        // We need to find users whose roles include any of the rolesWithAccess
        const [userRows] = await pool.query(
          `SELECT id, email, givenName, familyName, roles
           FROM Person
           WHERE email IS NOT NULL AND email != ""`,
          []
        );

        // Filter users who have access based on role inheritance
        for (const user of userRows) {
          const userRoles = PermissionService.getUserAllRoles(user);
          const hasAccess = rolesWithAccess.some(role => userRoles.includes(role));
          if (hasAccess) {
            recipients.push(user);
          }
        }
      }
    } else if (isPublishedRole(record.granted)) {
      // Published @role: all users with that role or descendants
      const requiredRole = extractRoleFromGranted(record.granted);

      const [userRows] = await pool.query(
        `SELECT id, email, givenName, familyName, roles
         FROM Person
         WHERE email IS NOT NULL AND email != ""`,
        []
      );

      // Filter users who have the required role (or inherit it)
      for (const user of userRows) {
        const userRoles = PermissionService.getUserAllRoles(user);
        if (userRoles.includes(requiredRole)) {
          recipients.push(user);
        }
      }
    } else {
      // Default: empty or unknown granted value - accessible to all
      const [userRows] = await pool.query(
        `SELECT id, email, givenName, familyName
         FROM Person
         WHERE email IS NOT NULL AND email != ""`,
        []
      );
      recipients.push(...userRows);
    }

    // Filter out sender if needed
    if (!includeSender && sender && sender.id) {
      return recipients.filter(user => user.id !== sender.id);
    }

    return recipients;
  }

  /**
   * Format record data into HTML email
   *
   * @param {string} tableName - Name of the table
   * @param {Object} record - The record data
   * @param {Object} sender - User sending the notification
   * @param {string} customMessage - Optional custom message
   * @param {Array} includeRelations - Array of relation arrayNames to include
   * @returns {string} - HTML email content
   */
  static formatRecordEmail(tableName, record, sender, customMessage = '', includeRelations = []) {
    const appName = schema.appName || 'Schema2';
    const tableConfig = schema.tables[tableName] || {};
    const displayFields = tableConfig.displayFields || schema.defaultConfigTable.displayFields;

    // Build record title
    let recordTitle = '';
    if (displayFields && displayFields.length > 0) {
      recordTitle = displayFields
        .map(field => record[field])
        .filter(val => val)
        .join(' ');
    }
    if (!recordTitle) {
      recordTitle = `${tableName} #${record.id}`;
    }

    // Build URL to record
    const recordUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/_crud/${tableName}/${record.id}`;

    // Get all fields from schema
    const fields = SchemaService.getTableFields(tableName);

    // Build fields HTML
    let fieldsHtml = '';
    for (const fieldName in fields) {
      const fieldConfig = fields[fieldName];

      // Skip system fields and special fields
      if (['id', 'ownerId', 'createdAt', 'updatedAt', 'granted'].includes(fieldName)) {
        continue;
      }

      // Skip fields with no value
      if (record[fieldName] === null || record[fieldName] === undefined || record[fieldName] === '') {
        continue;
      }

      let displayValue = record[fieldName];

      // Check if there's a rendered version of this field (prefixed with _)
      const renderedFieldName = `_${fieldName}`;
      if (record[renderedFieldName] !== null && record[renderedFieldName] !== undefined && record[renderedFieldName] !== '') {
        // Use the rendered value
        displayValue = record[renderedFieldName];
      } else {
        // Format value based on type (fallback if no renderer)
        if (fieldConfig.type === 'datetime' || fieldConfig.type === 'date') {
          displayValue = new Date(displayValue).toLocaleString('fr-FR');
        } else if (fieldConfig.type === 'integer' && fieldConfig.relation) {
          // Check if there's a relation loaded with a label
          if (record._relations && record._relations[fieldName] && record._relations[fieldName]._label) {
            displayValue = record._relations[fieldName]._label;
          } else {
            // Skip relation fields that don't have a label (they show as IDs)
            continue;
          }
        } else if (typeof displayValue === 'object') {
          displayValue = JSON.stringify(displayValue);
        }
      }

      // Get field label (use field name as fallback)
      const fieldLabel = fieldConfig.label || fieldName;

      fieldsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">
            ${fieldLabel}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${displayValue}
          </td>
        </tr>
      `;
    }

    // Build relations HTML
    let relationsHtml = '';
    if (includeRelations && includeRelations.length > 0) {
      for (const relationArrayName of includeRelations) {
        // Relations are in record._relations[arrayName]
        const relationData = record._relations && record._relations[relationArrayName];
        if (relationData && Array.isArray(relationData) && relationData.length > 0) {
          const relationItems = relationData;

          // Try to find the table name for this relation
          let relationTableName = relationArrayName;
          for (const [otherTableName, otherTableConfig] of Object.entries(schema.tables)) {
            for (const [otherFieldName, otherFieldConfig] of Object.entries(otherTableConfig.fields || {})) {
              if (otherFieldConfig.relation === tableName &&
                  (otherFieldConfig.arrayName === relationArrayName || otherFieldName + 's' === relationArrayName)) {
                relationTableName = otherTableName;
                break;
              }
            }
          }

          relationsHtml += `
  <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin-bottom: 15px;">
    <h4 style="margin: 0 0 12px 0; color: #555; font-size: 16px;">
      📎 ${relationTableName} (${relationItems.length})
    </h4>
    <ul style="margin: 0; padding-left: 20px;">
      ${relationItems.map(item => {
        const label = item._label || item.name || item.title || `#${item.id}`;
        return `<li style="margin-bottom: 6px;">${label}</li>`;
      }).join('')}
    </ul>
  </div>
          `;
        }
      }
    }

    // Build email HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Notification - ${recordTitle}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 10px 0; color: #007bff;">📧 Notification</h2>
    <p style="margin: 0; color: #666;">
      ${sender ? `${sender.givenName || ''} ${sender.familyName || ''}`.trim() : 'Un utilisateur'}
      vous partage cette fiche
    </p>
  </div>

  ${customMessage ? `
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0;"><strong>Message :</strong></p>
    <p style="margin: 10px 0 0 0;">${customMessage}</p>
  </div>
  ` : ''}

  <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin: 0 0 15px 0; color: #333;">
      ${recordTitle}
    </h3>
    <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
      ${tableName} #${record.id}
    </p>

    <table style="width: 100%; border-collapse: collapse;">
      ${fieldsHtml}
    </table>
  </div>

  ${relationsHtml}

  <div style="text-align: center; margin: 30px 0;">
    <a href="${recordUrl}"
       style="display: inline-block; background-color: #007bff; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold;">
      🔗 Voir la fiche
    </a>
  </div>

  <div style="border-top: 1px solid #ddd; padding-top: 15px; margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
    <p style="margin: 0;">
      Cet email a été envoyé depuis ${appName}<br>
      <a href="${process.env.BASE_URL || 'http://localhost:3000'}" style="color: #007bff;">
        ${process.env.BASE_URL || 'http://localhost:3000'}
      </a>
    </p>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Send email notification
   *
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} html - Email HTML content
   * @returns {Promise<Object>} - Nodemailer send result
   */
  static async sendEmail(to, subject, html) {
    const transporter = this.getTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    return await transporter.sendMail(mailOptions);
  }

  /**
   * Main method: Notify all users with access to a record
   *
   * @param {string} tableName - Name of the table
   * @param {number} recordId - ID of the record
   * @param {Object} sender - User sending the notification
   * @param {Object} options - Options: { includeSender: boolean, customMessage: string, includeRelations: array }
   * @returns {Promise<Object>} - Result with count of sent emails
   */
  static async notifyRecord(tableName, recordId, sender, options = {}) {
    const { includeSender = false, customMessage = '', includeRelations = [] } = options;

    // Get the record using tableDataService with renderer enabled
    // This will include rendered fields with _ prefix (e.g., _description for markdown)
    const response = await getTableData(sender, tableName, {
      id: recordId,
      relation: 'all',
      compact: true,
      renderer: true
    });

    if (!response.success || !response.rows || response.rows.length === 0) {
      throw new Error('Record not found');
    }

    const record = response.rows[0];

    // Get recipients
    const recipients = await this.getRecipients(tableName, recordId, sender, { includeSender });

    if (recipients.length === 0) {
      return {
        success: true,
        message: 'Aucun destinataire trouvé',
        sent: 0,
        recipients: []
      };
    }

    // Build email subject and content
    const tableConfig = schema.tables[tableName] || {};
    const displayFields = tableConfig.displayFields || schema.defaultConfigTable.displayFields;

    let recordTitle = '';
    if (displayFields && displayFields.length > 0) {
      recordTitle = displayFields
        .map(field => record[field])
        .filter(val => val)
        .join(' ');
    }
    if (!recordTitle) {
      recordTitle = `${tableName} #${record.id}`;
    }

    const subject = `Notification : ${recordTitle}`;
    const html = this.formatRecordEmail(tableName, record, sender, customMessage, includeRelations);

    // Send emails
    const results = [];
    const errors = [];

    for (const recipient of recipients) {
      try {
        await this.sendEmail(recipient.email, subject, html);
        results.push({
          email: recipient.email,
          name: `${recipient.givenName || ''} ${recipient.familyName || ''}`.trim(),
          success: true
        });
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        results.push({
          email: recipient.email,
          name: `${recipient.givenName || ''} ${recipient.familyName || ''}`.trim(),
          success: false,
          error: error.message
        });
        errors.push(error);
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: errors.length === 0,
      message: errors.length === 0
        ? `${successCount} email(s) envoyé(s) avec succès`
        : `${successCount}/${recipients.length} email(s) envoyé(s), ${errors.length} erreur(s)`,
      sent: successCount,
      total: recipients.length,
      recipients: results
    };
  }

  /**
   * Get preview of recipients for a record (without sending)
   *
   * @param {string} tableName - Name of the table
   * @param {number} recordId - ID of the record
   * @param {Object} sender - User sending the notification
   * @param {Object} options - Options: { includeSender: boolean, customMessage: string, includeRelations: array }
   * @returns {Promise<Object>} - Object with recipients, email preview, and available relations
   */
  static async getRecipientsPreview(tableName, recordId, sender, options = {}) {
    const { customMessage = '', includeRelations = [] } = options;
    const recipients = await this.getRecipients(tableName, recordId, sender, options);

    // Get the record with rendered fields and all relations for preview
    const response = await getTableData(sender, tableName, {
      id: recordId,
      relation: 'all',
      compact: true,
      renderer: true
    });

    let emailPreview = null;
    let availableRelations = [];

    if (response.success && response.rows && response.rows.length > 0) {
      const record = response.rows[0];

      // Find available 1:n relations (reverse relations where this table is the "1")
      // Search through all other tables to find fields that point to this table
      // Relations are stored in record._relations object
      for (const [otherTableName, otherTableConfig] of Object.entries(schema.tables)) {
        if (!otherTableConfig.fields) continue;

        for (const [otherFieldName, otherFieldConfig] of Object.entries(otherTableConfig.fields)) {
          // Check if this field is a relation pointing to our table
          if (otherFieldConfig.relation === tableName && otherFieldConfig.arrayName) {
            const arrayName = otherFieldConfig.arrayName;

            // Check if this relation is present in the record and has data
            // Relations are in record._relations[arrayName]
            const relationData = record._relations && record._relations[arrayName];
            if (relationData && Array.isArray(relationData) && relationData.length > 0) {
              // Avoid duplicates
              const exists = availableRelations.some(rel => rel.arrayName === arrayName);
              if (!exists) {
                availableRelations.push({
                  arrayName: arrayName,
                  table: otherTableName,
                  isStrong: otherFieldConfig.relationshipStrength === 'Strong',
                  count: relationData.length
                });
              }
            }
          }
        }
      }

      emailPreview = this.formatRecordEmail(tableName, record, sender, customMessage, includeRelations);
    }

    return {
      recipients: recipients.map(user => ({
        id: user.id,
        name: `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email,
        email: user.email
      })),
      emailPreview,
      availableRelations
    };
  }
}

module.exports = NotificationService;
