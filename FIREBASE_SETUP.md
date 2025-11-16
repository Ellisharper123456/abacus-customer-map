# Firebase Setup Guide for Abacus Customer Map

Your website is now configured to use Firebase as a cloud database. This means all installations will be stored online and visible to anyone who visits the website!

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it "Abacus Customer Map" (or whatever you like)
4. Disable Google Analytics (not needed)
5. Click "Create project"

## Step 2: Set Up Firestore Database

1. In your Firebase console, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose **"Start in production mode"**
4. Select a location (choose closest to UK, like `europe-west2` for London)
5. Click "Enable"

## Step 3: Configure Security Rules

1. In Firestore, click the "Rules" tab
2. Replace the rules with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow everyone to READ installations
    match /installations/{installId} {
      allow read: if true;
      // Only allow authenticated users to write (you can add authentication later)
      allow write: if true;
    }
    
    // Allow everyone to write enquiries
    match /enquiries/{enquiryId} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish"

**Security Note:** Currently anyone can add/delete installations. After testing, you should add Firebase Authentication to restrict admin functions.

## Step 4: Get Your Firebase Config

1. In Firebase console, click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon `</>`
5. Register your app (name it "Abacus Map")
6. Copy the `firebaseConfig` object

## Step 5: Update Your Website

1. Open `app.js`
2. Find this section near the top:

```javascript
// Firebase Configuration - REPLACE WITH YOUR OWN CONFIG
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

3. Replace it with YOUR config from Firebase
4. Save the file

## Step 6: Test It!

1. Open `index-new.html` in your browser
2. Enable admin mode (password: `abacus2025`)
3. Add an installation
4. Open the website on a different device or browser
5. You should see the same installation!

## How It Works Now

✅ **Admin adds installation** → Saved to Firebase cloud database
✅ **Anyone visits website** → Loads installations from Firebase
✅ **Works across all devices** → Data is synced globally
✅ **No localStorage dependency** → Data persists even if browser cache is cleared

## Troubleshooting

**"Firebase connected successfully"** - Good! Database is working
**"Database connection failed"** - Check your Firebase config in app.js

**Can't see installations on other devices:**
- Make sure Firebase rules are set to allow read
- Check the browser console for errors (F12)

**Data not saving:**
- Check Firebase rules allow write
- Verify your Firebase config is correct

## Free Tier Limits

Firebase free tier includes:
- 50,000 reads per day
- 20,000 writes per day
- 1GB storage

This is more than enough for your use case!

## Next Steps (Optional)

1. **Add Authentication** - Restrict admin functions to logged-in users only
2. **Cloud Storage** - Store images in Firebase Storage instead of base64
3. **Real-time Updates** - Make installations appear instantly without refreshing

Let me know if you need help with any of these!
