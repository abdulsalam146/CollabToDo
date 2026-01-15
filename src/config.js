// Environment configuration
// In production, replace this with your build process to inject actual environment variables

window.ENV = {
    // Supabase Configuration
    // These should be replaced with your actual credentials during build/deployment
    SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co',
    SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'your-anon-key',
    
    // App Configuration
    APP_NAME: 'CollabTodo',
    VERSION: '1.0.0',
    
    // Feature Flags
    ENABLE_GOOGLE_AUTH: true,
    ENABLE_ANALYTICS: false,
    ENABLE_AUDIT_LOGGING: true,
    
    // Security Settings
    MAX_TASK_LENGTH: 1000,
    SESSION_TIMEOUT: 3600000, // 1 hour in milliseconds
    
    // Development/Production
    IS_DEVELOPMENT: import.meta.env?.DEV || false
};

// Validate required environment variables
function validateConfig() {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missing = required.filter(key => 
        !window.ENV[key] || 
        window.ENV[key].includes('your-') || 
        window.ENV[key].includes('example')
    );
    
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        console.error('Please set up your .env file with the required Supabase credentials');
        
        // Show error message in development
        if (window.ENV.IS_DEVELOPMENT) {
            document.body.innerHTML = `
                <div class="min-h-screen flex items-center justify-center bg-gray-50">
                    <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                        <div class="text-center">
                            <i class="fas fa-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
                            <h2 class="text-2xl font-bold text-gray-900 mb-2">Configuration Required</h2>
                            <p class="text-gray-600 mb-4">Please configure your Supabase credentials</p>
                            <div class="bg-gray-100 rounded-lg p-4 text-left">
                                <p class="text-sm font-mono text-gray-700 mb-2">Create a .env file with:</p>
                                <pre class="text-xs bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key</pre>
                            </div>
                            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        return false;
    }
    
    // Validate URL format
    try {
        new URL(window.ENV.SUPABASE_URL);
    } catch (e) {
        console.error('Invalid SUPABASE_URL format');
        return false;
    }
    
    return true;
}

// Security check for HTTPS in production
function checkHTTPS() {
    if (!window.ENV.IS_DEVELOPMENT && location.protocol !== 'https:') {
        console.warn('Application should be served over HTTPS in production');
    }
}

// Initialize configuration
window.CONFIG_VALID = validateConfig();
checkHTTPS();

// Export for use in other modules
if (window.CONFIG_VALID) {
    console.log(`✅ ${window.ENV.APP_NAME} v${window.ENV.VERSION} - Configuration loaded`);
}
