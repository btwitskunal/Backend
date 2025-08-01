# Excel Upload API Server

A secure, high-performance backend server for Excel file upload and validation with comprehensive security features.

## 🚀 Features

- **Secure File Upload**: Excel file validation with size and type restrictions
- **Data Validation**: Dynamic validation against template-defined rules
- **Error Reporting**: Detailed Excel error reports for failed uploads
- **Database Integration**: MySQL database with dynamic schema management
- **Authentication**: Session-based authentication with CSRF protection
- **Rate Limiting**: Protection against abuse with configurable limits
- **Comprehensive Logging**: Structured logging for monitoring and debugging
- **Performance Optimization**: Batch processing and caching for large files

## 🔒 Security Features

- **Input Sanitization**: All user inputs are sanitized and validated
- **SQL Injection Prevention**: Parameterized queries and column name sanitization
- **File Upload Security**: Type validation, size limits, and safe filename generation
- **CSRF Protection**: Cross-site request forgery protection
- **Rate Limiting**: Request rate limiting to prevent abuse
- **Security Headers**: Comprehensive security headers
- **Session Management**: Secure session configuration
- **Error Handling**: Sanitized error messages without information disclosure

## 📋 Prerequisites

- Node.js >= 16.0.0
- MySQL >= 5.7
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_database_name
   DB_CONNECTION_LIMIT=10
   DB_QUEUE_LIMIT=0

   # Server Configuration
   PORT=4000
   NODE_ENV=development

   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOADS_DIR=uploads
   REPORTS_DIR=reports

   # Security Configuration
   SESSION_SECRET=your-super-secret-session-key-change-this-in-production
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   BCRYPT_ROUNDS=12

   # CORS Configuration (for production)
   ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
   ```

4. **Database Setup**
   - Create a MySQL database
   - The application will automatically create the required table structure

5. **Template Configuration**
   - Place your `template.xlsx` file in the root directory
   - The application will automatically sync the database schema with the template

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Health Check
```bash
curl http://localhost:4000/health
```

## 📡 API Endpoints

### Authentication Required Endpoints

#### POST /upload
Upload and validate Excel files.

**Headers:**
- `Content-Type: multipart/form-data`
- `X-CSRF-Token: <csrf-token>` (if CSRF protection is enabled)

**Body:**
- `file`: Excel file (.xlsx, .xls)

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully. All rows inserted.",
  "rowsInserted": 100
}
```

### Public Endpoints

#### GET /template
Get template definition.

#### GET /template/download
Download the template file.

#### GET /reports/{filename}
Download error reports.

#### GET /health
Health check endpoint.

## 🔧 Configuration

### File Upload Settings
- **Max File Size**: Configurable via `MAX_FILE_SIZE` environment variable (default: 10MB)
- **Allowed Types**: Excel files (.xlsx, .xls)
- **Batch Processing**: Configurable batch size for database operations

### Security Settings
- **Rate Limiting**: 10 requests per 15 minutes per IP
- **Session Timeout**: 24 hours
- **CSRF Protection**: Enabled by default
- **Security Headers**: Comprehensive security headers

### Database Settings
- **Connection Pool**: Configurable connection limits
- **Auto Schema Sync**: Automatic schema synchronization with template changes
- **Batch Operations**: Optimized for large datasets

## 📊 Monitoring and Logging

The application includes comprehensive logging:

- **Application Logs**: `logs/app.log`
- **Error Logs**: `logs/error.log`
- **Debug Logs**: `logs/debug.log` (development only)

Log levels: INFO, WARN, ERROR, DEBUG

## 🧪 Testing

```bash
# Run security audit
npm run security-check

# Run linting
npm run lint
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify database credentials in `.env`
   - Ensure MySQL server is running
   - Check network connectivity

2. **File Upload Errors**
   - Verify file type is Excel (.xlsx, .xls)
   - Check file size limits
   - Ensure proper authentication

3. **Template Sync Issues**
   - Verify `template.xlsx` exists in root directory
   - Check file permissions
   - Review template format

### Performance Optimization

- **Large Files**: Use batch processing (configurable batch size)
- **High Concurrency**: Adjust database connection pool settings
- **Memory Usage**: Monitor and adjust file size limits

## 🔐 Security Best Practices

1. **Environment Variables**: Never commit `.env` files to version control
2. **Secrets**: Use strong, unique secrets for production
3. **HTTPS**: Always use HTTPS in production
4. **Regular Updates**: Keep dependencies updated
5. **Monitoring**: Monitor logs for security events
6. **Backup**: Regular database backups

## 📈 Performance Considerations

- **Batch Processing**: Large files are processed in configurable batches
- **Caching**: Validation maps are cached for performance
- **Connection Pooling**: Optimized database connection management
- **Streaming**: Large file processing with memory efficiency

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the logs for error details
- Create an issue with detailed information 