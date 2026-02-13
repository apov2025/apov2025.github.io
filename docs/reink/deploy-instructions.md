# Deployment Instructions for apov.sg/reink

## 📁 Server Setup

1. **Upload all files** to your server at `/public_html/reink/` (or equivalent):
   ```
   apov.sg/reink/
   ├── index.html
   ├── style.css  
   ├── script.js
   ├── api.php
   ├── .htaccess
   ├── reink17pro.png
   └── wallpapers/
       ├── photo-01.jpg
       ├── photo-02.jpg
       └── ... (all your images)
   ```

## 🔧 Server Requirements

- **PHP enabled** (for dynamic wallpaper loading)
- **Apache** with mod_rewrite enabled
- **File permissions**: 
  - Files: `644`
  - Directories: `755`
  - api.php: `644` (executable by web server)

## 🌐 Access

Once deployed, your site will be available at:
**https://apov.sg/reink**

## 📝 Adding New Wallpapers

Simply upload images to the `/wallpapers/` folder:
- Supported: JPG, PNG, GIF, WebP, SVG, BMP
- No code changes needed - automatic detection!

## 🔒 Security Notes

- `.htaccess` includes proper CORS headers
- Only image files are served from wallpapers directory
- Error handling prevents directory listing

## 🧪 Testing

1. Upload files to server
2. Visit `https://apov.sg/reink`
3. Check console for any API errors
4. Test wallpaper selection and upload functionality

## 🚨 Troubleshooting

**If wallpapers don't load:**
- Check PHP is enabled
- Verify file permissions
- Check server error logs
- Fallback will show default images

**If styling breaks:**
- Ensure all CSS/JS files uploaded
- Check file paths are correct
- Verify .htaccess is working