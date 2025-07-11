export const supabaseConfig = {
  // Database configuration
  database: {
    host: 'localhost',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  },
  
  // Auth configuration
  auth: {
    site_url: 'http://localhost:3000',
    additional_redirect_urls: [
      'http://localhost:3000/auth/callback'
    ],
    jwt_expiry: 3600,
    enable_signup: true,
    enable_confirmations: false,
  },
  
  // API configuration
  api: {
    enabled: true,
    port: 54321,
    schemas: ['public'],
    extra_search_path: ['public'],
    max_rows: 1000,
  },
  
  // Storage configuration
  storage: {
    enabled: true,
    image_transformation: {
      enabled: true,
    },
  },
  
  // Edge Functions configuration
  edge_functions: {
    enabled: true,
    inspector_port: 8083,
  },
  
  // Analytics configuration
  analytics: {
    enabled: false,
  },
}