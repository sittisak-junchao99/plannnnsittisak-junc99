# Team-Based Transport Planner

A comprehensive web application for managing transport operations with team collaboration features.

## 🚀 Tech Stack

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Hook Form** + **Zod** for form validation
- **TanStack Query** for data fetching
- **Lucide React** for icons

### Backend & Database
- **Supabase** (PostgreSQL) with RLS/RBAC
- **Supabase Auth** for authentication
- **Edge Functions** (TypeScript/Deno)
- **PostgREST** for direct CRUD operations
- **Materialized Views** for performance

### Deployment
- **Frontend**: Vercel
- **Backend & DB**: Supabase

## 📁 Project Structure

```
transport-planner/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and configurations
│   │   ├── types/          # TypeScript type definitions
│   │   └── styles/         # Global styles
│   ├── public/             # Static assets
│   └── package.json
├── backend/                 # Edge Functions
│   ├── functions/          # Supabase Edge Functions
│   └── scripts/            # Utility scripts
├── db/                     # Database migrations
│   └── migrations/         # SQL migration files
├── config/                 # Configuration files
│   ├── env.example
│   └── supabase.config.ts
└── docs/                   # Documentation
```

## 🎯 Development Milestones

### Phase 1: Foundation (Week 1-2)
- [x] Project setup and folder structure
- [x] Database schema and migrations
- [x] Supabase configuration
- [x] Authentication system
- [x] Basic UI components

### Phase 2: Core Features (Week 3-4)
- [ ] Driver & Vehicle management
- [ ] Customer & Route management
- [ ] Schedule creation and management
- [ ] Daily schedule instances

### Phase 3: Advanced Features (Week 5-6)
- [ ] Conflict detection system
- [ ] Smart suggestions engine
- [ ] Team collaboration features
- [ ] Notification system

### Phase 4: Optimization & Deployment (Week 7-8)
- [ ] Performance optimization
- [ ] Export functionality
- [ ] Testing and bug fixes
- [ ] Production deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase CLI

### Local Development

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd transport-planner
cd frontend && npm install
```

2. **Setup Supabase**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Start local development
supabase start
```

3. **Environment Variables**
```bash
cp config/env.example frontend/.env.local
# Edit .env.local with your Supabase credentials
```

4. **Run migrations**
```bash
supabase db reset
```

5. **Start development server**
```bash
cd frontend
npm run dev
```

### Environment Variables

Create `frontend/.env.local`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🔐 Authentication & Authorization

### User Roles
- **Admin**: Full system access
- **Planner**: Route and schedule management
- **Viewer**: Read-only access

### Row Level Security (RLS)
All tables implement RLS policies based on user roles and data ownership.

## 📊 Key Features

### Core Management
- **Driver Management**: Track driver information, licenses, and status
- **Vehicle Fleet**: Manage vehicles, types, and maintenance status
- **Customer Relations**: Customer information and contact management
- **Route Planning**: Define routes with GPS coordinates

### Advanced Scheduling
- **Master Templates**: Create recurring schedule patterns
- **Daily Overrides**: Modify specific dates without affecting templates
- **Conflict Detection**: Automatic detection of scheduling conflicts
- **Smart Suggestions**: AI-powered route optimization

### Team Collaboration
- **Route Responsibility**: Assign route ownership to team members
- **Support Offers**: Team members can offer assistance
- **Real-time Alerts**: Notifications for conflicts and changes
- **Audit Trail**: Complete change tracking

### Reporting & Analytics
- **Export Reports**: Generate various report types
- **Performance Metrics**: Track efficiency and costs
- **Conflict Analysis**: Historical conflict patterns
- **Usage Statistics**: System usage analytics

## 🛠️ Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow React best practices
- Implement proper error handling
- Write meaningful commit messages

### Database
- All migrations must be idempotent
- Use proper indexing for performance
- Implement comprehensive RLS policies
- Include audit logging for critical tables

### API Design
- RESTful endpoints via PostgREST
- Edge Functions for complex operations
- Proper error responses
- Rate limiting where appropriate

## 🚀 Deployment

### Frontend (Vercel)
```bash
# Build and deploy
npm run build
vercel --prod
```

### Backend (Supabase)
```bash
# Deploy Edge Functions
supabase functions deploy

# Run migrations
supabase db push
```

## 📝 API Documentation

### Core Endpoints
- `GET /drivers` - List all drivers
- `POST /drivers` - Create new driver
- `GET /routes` - List routes with filters
- `POST /route_schedules` - Create schedule template

### Edge Functions
- `/detect-conflicts` - Check for scheduling conflicts
- `/smart-suggestions` - Get route optimization suggestions
- `/export-report` - Generate and export reports
- `/send-notifications` - Bulk notification sending

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📈 Performance Considerations

- Materialized views for complex queries
- Proper indexing strategy
- Query optimization
- Caching strategies
- Lazy loading for large datasets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- Review the troubleshooting guide

---

**Built with ❤️ for efficient transport management**