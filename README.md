# UGC Generator

An AI-powered User Generated Content (UGC) platform that combines person and product images to create professional e-commerce quality photos.

## Features

- **AI Image Generation** - Combines person and product images using OpenRouter API (GPT-5 Image Mini)
- **Video Generation** - Generate showcase videos with Google's Veo 3.1
- **User Authentication** - Secure authentication with Clerk
- **Subscription Plans** - Tiered credit system (Free, Pro, Premium)
- **Cloud Storage** - Images stored on Cloudinary
- **Community Gallery** - Share and browse published generations

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Framer Motion
- React Router DOM
- Clerk React SDK

### Backend
- Node.js + Express 5
- TypeScript
- Prisma ORM
- PostgreSQL
- Cloudinary
- OpenRouter API
- Sentry (Error Tracking)

## Project Structure

```
ugc-project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── configs/        # Configuration files
│   │   └── assets/         # Static assets
│   └── ...
├── server/                 # Express backend
│   ├── controllers/        # Route handlers
│   ├── routes/             # API routes
│   ├── middlewares/        # Express middleware
│   ├── configs/            # Server configurations
│   ├── prisma/             # Database schema & migrations
│   └── ...
└── README.md
```

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Clerk account
- Cloudinary account
- OpenRouter API key

## Environment Variables

### Server (.env)
```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OPENROUTER_API_KEY=...
SENTRY_DSN=...
```

### Client (.env)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=http://localhost:3000
```

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd ugc-project
```

### 2. Install server dependencies
```bash
cd server
npm install
```

### 3. Set up the database
```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Install client dependencies
```bash
cd ../client
npm install
```

## Running the Application

### Development

**Start the server:**
```bash
cd server
npm run server
```

**Start the client:**
```bash
cd client
npm run dev
```

### Production

**Build the client:**
```bash
cd client
npm run build
```

**Start the server:**
```bash
cd server
npm start
```

## API Endpoints

### User Routes
- `GET /api/user/credits` - Get user credits
- `GET /api/user/projects` - Get all user projects
- `GET /api/user/projects/:projectId` - Get project by ID
- `POST /api/user/projects/:projectId/publish` - Toggle project visibility

### Project Routes
- `POST /api/project/create` - Create new project with image generation
- `POST /api/project/create-video/:projectId` - Generate video for project

### Webhook Routes
- `POST /api/clerk/webhooks` - Clerk webhook handler for user & subscription events

## Subscription Plans

| Plan | Credits | Price |
|------|---------|-------|
| Free | 20 | $0/month |
| Pro | 80 | $9/month |
| Premium | 240 | $19/month |

## License

ISC

## Author

Built with passion for AI-powered content creation.
