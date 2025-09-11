# Social Media Content Analyzer 

The **Social Media Content Analyzer** is a full-stack web application that extracts text from uploaded PDF or image files and suggests improvements for better social media engagement.  

This project was built as part of a technical assessment to demonstrate skills in full-stack development, file handling, text extraction (OCR), and simple UI/UX design.

---

##Features
-  **File Upload** – Upload PDFs or images via drag-and-drop or file picker.
-  **PDF Parsing** – Extracts text from PDF documents while keeping formatting.
-  **OCR Support** – Extracts text from images using `tesseract.js`.
-  **Loading & Error Handling** – User feedback while files are processed.
-  **Engagement Suggestions** – Simple recommendations to improve social media posts (hashtags, emojis, CTA).
-  **Deployed** – Backend hosted on Replit, frontend on Netlify.

---

##  Tech Stack
**Frontend**
- React
- Tailwind CSS
- Axios
- React Dropzone

**Backend**
- Node.js + Express
- Multer (file upload)
- pdf-parse (PDF text extraction)
- tesseract.js (OCR for images)
- CORS

---

## Setup Instructions

### Clone the Repository
```bash
git clone <your-repo-link>
cd Social_media_content_analyzer
