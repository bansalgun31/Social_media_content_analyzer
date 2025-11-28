# Social Media Content Analyzer

A full-stack TypeScript application to extract, process, and analyze social media content from uploaded files and documents. It provides parsers for PDFs, DOCX, TXT, OCR, and integrates server-side processing with a React + Vite frontend.

## Features
- File upload and validation (`multer` + `storage.ts`)
- Parsers: PDF (`pdf-parse`), DOCX (`mammoth`), TXT, OCR (`tesseract.js`)
- Text processing and batch processing utilities
- Simple Express server with API routes and controllers
- TypeScript, Vite, React, Tailwind UI component library
- Drizzle ORM + Neon/Postgres support (see `drizzle-kit` script)

## Repository Structure
- `client/` — Vite + React frontend (TypeScript, Tailwind)
  - `src/` — application source
  - `components/` — shared UI components
- `server/` — Express server entry and routes
  - `controllers/` — controllers (`uploadController.ts`, etc.)
  - `routes.ts` — API route definitions
  - `storage.ts` — storage helpers
- `utils/` — parsers and processing helpers (`pdfParser.ts`, `ocrParser.ts`, `textProcessor.ts`)
- `shared/` — shared types and schemas (`schema.ts`)
- `test/data/` — sample/test files

## Tech Stack
- Node.js, TypeScript
- Express for server-side routing
- Vite + React for frontend
- Tailwind CSS for styling
- Drizzle ORM + `drizzle-kit` for database migrations
- OCR and parsing: `tesseract.js`, `pdf-parse`, `mammoth`

## Prerequisites
- Node.js 18+ (LTS recommended)
- A Postgres-compatible database (Neon, Postgres) if you will use persistent DB features

## Install
Open PowerShell in the project root and run:

```powershell
npm install
```

## Available Scripts
Run these from the project root in PowerShell.

- Start development server (server + Vite):

```powershell
npm run dev
```

- Build the frontend and bundle the server into `dist`:

```powershell
npm run build
```

- Start production (after `npm run build`):

```powershell
npm run start
```

- TypeScript check:

```powershell
npm run check
```

- Push Drizzle migrations:

```powershell
npm run db:push
```

## Environment Variables
Create a `.env` file in the project root (or use your host's environment mechanism). Common variables used by the project may include:

- `PORT` — Server port (default 3000)
- `DATABASE_URL` — Postgres connection string for Drizzle/Neon
- `STORAGE_DIR` — Local directory to persist uploaded files (if used)
- `NODE_ENV` — `development` or `production`

Note: Check `server/index.ts` and `storage.ts` for exact environment keys required by this codebase.

## Development Notes
- The server entrypoint is `server/index.ts`. It starts an Express app and loads routes from `routes.ts`.
- Upload handling is implemented with `multer` and validated via `utils/fileValidator.ts`.
- Parsers live in `utils/` (`pdfParser.ts`, `docxParser.ts`, `ocrParser.ts`, `txtParser.ts`). Batch processing helper is `utils/batchProcessor.ts`.

## Testing / Samples
- Add sample files to `test/data/` and exercise the upload endpoints.

## Contributing
- Fork the repo, create a branch for your feature/fix, and open a pull request.
- Keep changes focused and include tests where appropriate.

## License
This project is licensed under the MIT License.
 
---

If you'd like, I can also:
- Add a short `CONTRIBUTING.md` with PR guidelines
- Add example `.env.example` showing expected env vars
- Create a minimal GitHub Actions workflow to run `npm run check`

If you want any of those, tell me which and I will add them.
