# Google Sheets Integration Setup

This guide will help you set up a Google Sheet to automatically receive enquiry form submissions from your customer map website.

## Step 1: Create a New Google Sheet

1. Go to https://sheets.google.com
2. Click "+ Blank" to create a new spreadsheet
3. Name it "Abacus Customer Enquiries" (or whatever you prefer)
4. Create the following column headers in Row 1:
   - A1: **Date & Time**
   - B1: **Customer Name**
   - C1: **Phone**
   - D1: **Email**
   - E1: **Postcode**
   - F1: **Request Type**
   - G1: **Message**
   - H1: **Installation Address**
   - I1: **Installation Customer**
   - J1: **Technologies**
   - K1: **Products**

## Step 2: Create Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code
3. Copy and paste this code:

```javascript
function doPost(e) {
  try {
    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Format the data for the spreadsheet
    const row = [
      data.submittedAt || new Date().toLocaleString('en-GB'),
      data.customerName || '',
      data.phone || '',
      data.email || '',
      data.postcode || '',
      data.type === 'phone' ? 'Phone Call' : 'Property Visit',
      data.message || '',
      data.installationAddress || '',
      data.installationCustomer || '',
      Array.isArray(data.technologies) ? data.technologies.join(', ') : data.technologies || '',
      data.product || ''
    ];
    
    // Append the row to the sheet
    sheet.appendRow(row);
    
    // Send professional email notification to sales team
    const requestType = data.type === 'phone' ? 'Phone Call Request' : 'Property Visit Request';
    const requestIcon = data.type === 'phone' ? '📞' : '🏠';
    
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6; 
      color: #1a202c !important;
      background: #f5f7fa !important;
      padding: 20px;
      -webkit-text-size-adjust: 100%;
    }
    .email-wrapper { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff !important;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #2E4591 0%, #1a5ba8 50%, #00ABED 100%) !important;
      color: #ffffff !important; 
      padding: 40px 30px;
      text-align: center;
    }
    .header-icon {
      font-size: 48px;
      margin-bottom: 15px;
      display: block;
    }
    .header h1 { 
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.5px;
      color: #ffffff !important;
    }
    .header .subtitle { 
      margin: 0;
      font-size: 15px;
      opacity: 0.95;
      font-weight: 400;
      color: #ffffff !important;
    }
    .alert-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.25) !important;
      color: #ffffff !important;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      margin-top: 12px;
      border: 2px solid rgba(255, 255, 255, 0.4);
    }
    .content { 
      padding: 35px 30px;
      background: #ffffff !important;
    }
    .section { 
      margin-bottom: 30px;
    }
    .section-title { 
      color: #2E4591 !important;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 3px solid #00ABED;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff !important;
    }
    .info-row {
      border-bottom: 1px solid #e8ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label { 
      font-weight: 600;
      color: #4a5568 !important;
      width: 140px;
      padding: 12px 12px 12px 0;
      vertical-align: top;
      font-size: 14px;
      background: #ffffff !important;
    }
    .info-value { 
      color: #1a202c !important;
      padding: 12px 0;
      font-size: 14px;
      background: #ffffff !important;
    }
    .info-value a {
      color: #0066cc !important;
      text-decoration: underline;
      font-weight: 500;
    }
    .highlight-badge { 
      display: inline-block;
      background: #fef3c7 !important;
      color: #92400e !important;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      border: 2px solid #fcd34d;
    }
    .message-box { 
      background: #e0f2fe !important;
      border-left: 4px solid #00ABED;
      padding: 20px;
      border-radius: 8px;
      font-style: italic;
      color: #1e293b !important;
      line-height: 1.7;
      margin-top: 10px;
    }
    .action-section {
      text-align: center;
      margin-top: 35px;
      padding-top: 25px;
      border-top: 2px solid #e8ecef;
      background: #ffffff !important;
    }
    .action-text {
      color: #4a5568 !important;
      font-size: 14px;
      margin-bottom: 15px;
    }
    .button { 
      display: inline-block;
      background: #2E4591 !important;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(46, 69, 145, 0.3);
      border: 2px solid #2E4591;
    }
    .footer { 
      background: #f7fafc !important;
      padding: 25px 30px;
      text-align: center;
      border-top: 1px solid #e8ecef;
    }
    .footer-text {
      margin: 0 0 8px 0;
      color: #4a5568 !important;
      font-size: 13px;
      line-height: 1.6;
    }
    .footer-logo {
      margin-top: 12px;
      opacity: 1;
      font-size: 12px;
      color: #64748b !important;
    }
    
    /* Dark mode overrides for email clients that support it */
    @media (prefers-color-scheme: dark) {
      body { background: #1a202c !important; }
      .email-wrapper { background: #ffffff !important; }
      .content { background: #ffffff !important; }
      .info-table { background: #ffffff !important; }
      .info-label { background: #ffffff !important; color: #4a5568 !important; }
      .info-value { background: #ffffff !important; color: #1a202c !important; }
      .action-section { background: #ffffff !important; }
      .section-title { color: #2E4591 !important; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <span class="header-icon">${requestIcon}</span>
      <h1>New Customer Enquiry</h1>
      <p class="subtitle">${requestType}</p>
      <div class="alert-badge">⏰ REQUIRES RESPONSE</div>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">
          <span>📋</span> Customer Contact Details
        </div>
        <table class="info-table">
          <tr class="info-row">
            <td class="info-label">Name:</td>
            <td class="info-value"><strong>${data.customerName}</strong></td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Phone:</td>
            <td class="info-value"><a href="tel:${data.phone}">${data.phone}</a></td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Email:</td>
            <td class="info-value"><a href="mailto:${data.email}">${data.email}</a></td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Postcode:</td>
            <td class="info-value">${data.postcode}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Request Type:</td>
            <td class="info-value"><span class="highlight-badge">${requestType}</span></td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Submitted:</td>
            <td class="info-value">${data.submittedAt}</td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">
          <span>🏡</span> Installation Interest
        </div>
        <table class="info-table">
          <tr class="info-row">
            <td class="info-label">Location:</td>
            <td class="info-value">${data.installationAddress}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Customer:</td>
            <td class="info-value">${data.installationCustomer}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Technologies:</td>
            <td class="info-value"><strong>${Array.isArray(data.technologies) ? data.technologies.join(', ') : data.technologies}</strong></td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Products:</td>
            <td class="info-value">${data.product}</td>
          </tr>
        </table>
      </div>
      
      ${data.message ? `
      <div class="section">
        <div class="section-title">
          <span>💬</span> Customer Message
        </div>
        <div class="message-box">
          "${data.message}"
        </div>
      </div>
      ` : ''}
      
      <div class="action-section">
        <p class="action-text">
          View all enquiries and manage your leads
        </p>
        <a href="${SpreadsheetApp.getActiveSpreadsheet().getUrl()}" class="button">
          📊 Open Enquiries Spreadsheet
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        <strong>Abacus Energy Solutions</strong><br>
        Customer Installation Map - Automated Notification
      </p>
      <p class="footer-logo">
        Powered by Abacus Installation Map System
      </p>
    </div>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: 'sales@abacusenergysolutions.co.uk',
      subject: `New ${requestType}: ${data.customerName} (${data.postcode})`,
      htmlBody: emailBody
    });
    
    // Return success
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Data added successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify email notifications work
function testPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        customerName: 'Test Customer',
        phone: '01234567890',
        email: 'test@example.com',
        postcode: 'L30 1RD',
        type: 'phone',
        message: 'This is a test message to verify the email notification system is working correctly.',
        installationAddress: '123 Test Street, Liverpool',
        installationCustomer: 'John Doe',
        technologies: ['Solar PV', 'Battery Storage'],
        product: '10kW Solar System with 10kWh Battery Storage',
        submittedAt: new Date().toLocaleString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      })
    }
  };
  
  const result = doPost(testData);
  Logger.log('Test completed. Check sales@abacusenergysolutions.com for the email.');
  return result;
}
```

4. Click the **Save** icon (💾) and name it "Sheet Webhook"

## Step 3: Deploy the Script

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Fill in the settings:
   - **Description**: "Customer Enquiry Webhook"
   - **Execute as**: Me (your Google account)
   - **Who has access**: **Anyone** (important!)
4. Click **Deploy**
5. You may need to authorize the app:
   - Click **Authorize access**
   - Choose your Google account
   - Click **Advanced** → **Go to Sheet Webhook (unsafe)** → **Allow**
6. Copy the **Web app URL** (it looks like: `https://script.google.com/macros/s/AKfycby.../exec`)

## Step 4: Connect to Your Website

1. Open `app.js` in your website folder
2. Find this line near the top (around line 17):
   ```javascript
   const GOOGLE_SHEETS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
   ```
3. Replace `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` with your Web app URL:
   ```javascript
   const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
   ```
4. Save the file

## Step 5: Test It!

1. Open your website (`index-new.html`)
2. Click on an installation marker
3. Click "Request Call" or "Request Visit"
4. Fill out the form and submit
5. Check your Google Sheet - a new row should appear with the enquiry details!

## Troubleshooting

**No data appearing in sheet:**
- Make sure you deployed as "Anyone" can access
- Check the Web app URL is correct in `app.js`
- Try the `testPost()` function in Apps Script to verify it works

**Authorization issues:**
- Re-deploy the script
- Make sure you authorized your Google account
- Check that the script has permission to access the sheet

**Data not formatted correctly:**
- Make sure your column headers match exactly
- The script will still work even if headers don't match, data will just appear in the corresponding columns

## What Gets Sent to Google Sheets

Each enquiry submission includes:
- **Date & Time**: When the enquiry was submitted (British format: DD/MM/YYYY HH:MM)
- **Customer Name**: Name of person enquiring
- **Phone**: Their phone number
- **Email**: Their email address
- **Postcode**: Their postcode
- **Request Type**: "Phone Call" or "Property Visit"
- **Message**: Any additional message they included
- **Installation Address**: The address of the installation they're interested in
- **Installation Customer**: The name of the customer who had the installation
- **Technologies**: What technologies were installed (Solar PV, Battery, Heat Pump, etc.)
- **Products**: Specific products installed

## Email Notification Features

The script above automatically sends a professional HTML email to **sales@abacusenergysolutions.co.uk** for every new enquiry.

### Email Includes:
- 📞/🏠 Request type icon and header
- Customer contact details (name, phone, email, postcode)
- Installation details they're interested in
- Customer message (if provided)
- Direct link to view all enquiries in Google Sheets
- Professional Abacus branding with your brand colors

### To Test Email Notifications:
1. In the Apps Script editor, select the `testPost` function from the dropdown
2. Click the "Run" button
3. Check sales@abacusenergysolutions.co.uk inbox
4. You should receive a test email

### Subject Line Format:
`New Phone Call Request: John Smith (L30 1RD)`

This makes it easy to identify and prioritize enquiries at a glance!

## Data Privacy

- The Google Sheet contains personal information (names, phone numbers, emails)
- Keep the sheet private and only share with authorized team members
- Consider Google Workspace for better security and compliance
- Enquiries are also stored in Firebase Firestore as a backup

## Summary

✅ **Website form submitted** → Sent to Google Apps Script
✅ **Apps Script receives data** → Adds new row to Google Sheet
✅ **Optional email notification** → Team gets notified instantly
✅ **Backup in localStorage** → Data saved even if Google Sheets fails

Your enquiry system is now fully integrated with Google Sheets! 🎉
