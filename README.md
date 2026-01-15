CollabTodo - Real-time Collaborative Todo App
A modern, real-time collaborative todo application built with vanilla JavaScript, Tailwind CSS, and Supabase.

Features
✅ User authentication (email/password & Google OAuth)
✅ Real-time synchronization across devices
✅ Drag-and-drop task ordering
✅ Dark/light mode toggle
✅ Task priority levels
✅ Task filtering (All, Active, Completed)
✅ Row-level security for data isolation
✅ Audit logging
✅ Responsive design
✅ PWA ready
Tech Stack
Frontend: Vanilla JavaScript, Tailwind CSS
Backend: Supabase (PostgreSQL, Auth, Real-time)
Deployment: Vite, Edge Functions
Quick Start
Prerequisites
Node.js 16+
Supabase account
Installation
Clone the repository
git clone https://github.com/yourusername/collabtodo.gitcd collabtodo
Install dependencies
bash

npm install
Set up Supabase
Create a new project at supabase.com
Run the SQL migration in supabase/migrations/001_create_tasks_table.sql
Copy your project URL and anon key
Configure environment variables
bash

cp .env.example .env
# Edit .env with your Supabase credentials
Start development server
bash

npm run dev
Open your browser
Navigate to http://localhost:3000
Environment Variables
Create a .env file in the root directory:

bash

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENABLE_GOOGLE_AUTH=true
VITE_ENABLE_AUDIT_LOGGING=true
Database Setup
Run the following SQL in your Supabase SQL editor:

sql

-- See: supabase/migrations/001_create_tasks_table.sql
Deployment
Build for Production
bash

npm run build
Deploy to Netlify/Vercel
Connect your repository
Set environment variables in your deployment platform
Deploy!
Deploy Edge Functions
bash

npm run supabase:login
npm run supabase:link
npm run supabase:deploy
Security Features
Row Level Security: Users can only access their own data
Input Validation: All inputs are sanitized and validated
HTTPS Only: Production deployments require HTTPS
Audit Logging: Track all user actions
Rate Limiting: Prevent abuse
CORS Protection: Secure cross-origin requests
Contributing
Fork the repository
Create a feature branch
Make your changes
Add tests if applicable
Submit a pull request
License
This project is licensed under the MIT License - see the LICENSE file for details.

Support
If you encounter any issues:

Check the Issues page
Create a new issue with detailed information
Join our Discord community
Roadmap
 Mobile app (React Native)
 Team collaboration features
 Advanced analytics
 Task templates
 Integration with calendar apps


---

## 🚀 Setup Instructions

### 1. **Local Development**
```bash
# Clone and setup
git clone <repository-url>
cd collabtodo
npm install

# Setup environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development
npm run dev
2. Supabase Setup
Create a Supabase project
Run the SQL migration
Enable Google OAuth (optional)
Deploy Edge Functions
3. Production Deployment
bash

# Build
npm run build

# Deploy to your preferred platform
# Don't forget to set environment variables!