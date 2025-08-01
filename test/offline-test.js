const { FileValidator, InputSanitizer, SQLSanitizer, DataValidator } = require('../utils/validation');
const config = require('../utils/config');

console.log('🔒 Testing Security Utilities (Offline)...\n');

// Test 1: File Validation
console.log('1. Testing File Validation...');
const validFile = 'test.xlsx';
const invalidFile = 'test.txt';
const largeFile = 'large.xlsx';

console.log(`   Valid file (${validFile}): ${FileValidator.validateFileType(validFile) ? '✅' : '❌'}`);
console.log(`   Invalid file (${invalidFile}): ${!FileValidator.validateFileType(invalidFile) ? '✅' : '❌'}`);
console.log(`   File size validation: ${FileValidator.validateFileSize(1024) ? '✅' : '❌'}`);

// Test 2: Input Sanitization
console.log('\n2. Testing Input Sanitization...');
const dirtyInput = '<script>alert("xss")</script>Dirty Input';
const sanitizedInput = InputSanitizer.sanitizeString(dirtyInput);
console.log(`   Original: "${dirtyInput}"`);
console.log(`   Sanitized: "${sanitizedInput}"`);
console.log(`   Sanitization working: ${sanitizedInput !== dirtyInput ? '✅' : '❌'}`);

// Test 3: SQL Sanitization
console.log('\n3. Testing SQL Sanitization...');
const dirtyColumn = 'user_id; DROP TABLE users; --';
const sanitizedColumn = SQLSanitizer.sanitizeColumnName(dirtyColumn);
console.log(`   Original column: "${dirtyColumn}"`);
console.log(`   Sanitized column: "${sanitizedColumn}"`);
console.log(`   SQL injection prevention: ${sanitizedColumn !== dirtyColumn ? '✅' : '❌'}`);

// Test 4: Data Validation
console.log('\n4. Testing Data Validation...');
const validRow = ['John', 'Doe', 'john@example.com'];
const invalidRow = ['John']; // Missing columns
const templateColumns = ['FirstName', 'LastName', 'Email'];

const validResult = DataValidator.validateRowData(validRow, templateColumns);
const invalidResult = DataValidator.validateRowData(invalidRow, templateColumns);

console.log(`   Valid row validation: ${validResult.length === 0 ? '✅' : '❌'}`);
console.log(`   Invalid row validation: ${invalidResult.length > 0 ? '✅' : '❌'}`);

// Test 5: Configuration
console.log('\n5. Testing Configuration...');
console.log(`   Server port: ${config.server.port}`);
console.log(`   Environment: ${config.server.nodeEnv}`);
console.log(`   Max file size: ${config.upload.maxFileSize} bytes`);
console.log(`   Allowed file types: ${config.upload.allowedFileTypes.join(', ')}`);

console.log('\n🎉 Offline security tests completed!');
console.log('\n📝 Next steps:');
console.log('1. Create a .env file with your database credentials');
console.log('2. Start the server: npm start');
console.log('3. Run the full security test: node test/security-test.js'); 