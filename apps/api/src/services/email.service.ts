import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../logger.js';

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    if (config.email.enabled) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort,
        secure: config.email.smtpSecure,
        auth: {
          user: config.email.smtpUser,
          pass: config.email.smtpPassword,
        },
      });

      logger.info({ host: config.email.smtpHost, port: config.email.smtpPort }, 'Email service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize email service');
      this.transporter = null;
    }
  }

  isEnabled(): boolean {
    return config.email.enabled && this.transporter !== null;
  }

  /**
   * Send an ebook file to Kindle email
   */
  async sendEbookToKindle(filePath: string, fileName: string): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.debug('Email service is disabled, skipping ebook send');
      return false;
    }

    if (!config.email.fromEmail) {
      logger.warn('Email FROM address not configured, cannot send ebook');
      return false;
    }

    try {
      logger.info({ fileName, kindleEmail: config.email.kindleEmail }, 'Sending ebook to Kindle');

      await this.transporter!.sendMail({
        from: config.email.fromEmail,
        to: config.email.kindleEmail,
        subject: `Ebook: ${fileName}`,
        text: `Your ebook "${fileName}" has been sent to your Kindle.`,
        attachments: [
          {
            filename: fileName,
            path: filePath,
          },
        ],
      });

      logger.info({ fileName, kindleEmail: config.email.kindleEmail }, 'Ebook sent to Kindle successfully');
      return true;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to send ebook to Kindle');
      return false;
    }
  }

  /**
   * Check if a file is an ebook based on extension
   */
  isEbook(fileName: string): boolean {
    const ebookExtensions = ['.epub', '.mobi', '.azw', '.azw3', '.pdf', '.djvu', '.fb2'];
    const lowerFileName = fileName.toLowerCase();
    return ebookExtensions.some(ext => lowerFileName.endsWith(ext));
  }
}

export const emailService = new EmailService();

