class TodoApp {
    constructor() {
        // Check if configuration is valid
        if (!window.CONFIG_VALID) {
            return;
        }

        // Initialize Supabase
        this.supabase = window.supabase.createClient(
            window.ENV.SUPABASE_URL,
            window.ENV.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

        // App State
        this.currentUser = null;
        this.session = null;
        this.tasks = [];
        this.currentFilter = 'all';
        this.subscription = null;
        this.isLoading = false;

        // DOM Elements
        this.initElements();
        
        // Initialize App
        this.init();
    }

    initElements() {
        // Auth elements
        this.authContainer = document.getElementById('authContainer');
        this.appContainer = document.getElementById('appContainer');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.signInBtn = document.getElementById('signInBtn');
        this.signUpBtn = document.getElementById('signUpBtn');
        this.googleSignInBtn = document.getElementById('googleSignInBtn');
        this.signOutBtn = document.getElementById('signOutBtn');

        // App elements
        this.taskInput = document.getElementById('taskInput');
        this.prioritySelect = document.getElementById('prioritySelect');
        this.addTaskForm = document.getElementById('addTaskForm');
        this.tasksList = document.getElementById('tasksList');
        this.emptyState = document.getElementById('emptyState');
        this.userEmail = document.getElementById('userEmail');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.connectionStatus = document.getElementById('connectionStatus');
    }

    async init() {
        this.setupEventListeners();
        this.setupDarkMode();
        this.setupAuthListener();
        await this.checkAuth();
    }

    // Authentication
    setupAuthListener() {
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session);
            
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                this.session = session;
                this.showApp();
                await this.loadTasks();
                this.setupRealtimeSubscription();
            } else if (event === 'SIGNED_OUT') {
                this.handleSignOut();
            }
        });
    }

    async checkAuth() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                this.currentUser = session.user;
                this.session = session;
                this.showApp();
                await this.loadTasks();
                this.setupRealtimeSubscription();
            } else {
                this.showAuth();
            }
        } catch (error) {
            console.error('Error checking auth:', error);
            this.showAuth();
        }
    }

    setupEventListeners() {
        // Auth events
        this.signInBtn.addEventListener('click', () => this.handleSignIn());
        this.signUpBtn.addEventListener('click', () => this.handleSignUp());
        this.googleSignInBtn.addEventListener('click', () => this.handleGoogleSignIn());
        this.signOutBtn.addEventListener('click', () => this.handleSignOut());

        // App events
        this.addTaskForm.addEventListener('submit', (e) => this.handleAddTask(e));
        this.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFilter = e.target.dataset.filter;
                this.updateFilterButtons();
                this.renderTasks();
            });
        });

        // Prevent form resubmission on refresh
        if (window.history.replaceState) {
            window.history.replaceState(null, null, window.location.href);
        }
    }

    async handleSignIn() {
        if (this.isLoading) return;
        
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        
        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }

        this.setLoading(true);
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.showToast('Successfully signed in!', 'success');
            this.logAuthEvent('sign_in', true);
            
        } catch (error) {
            this.showToast(error.message, 'error');
            this.logAuthEvent('sign_in', false, error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async handleSignUp() {
        if (this.isLoading) return;
        
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        
        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        this.setLoading(true);
        
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/`
                }
            });

            if (error) throw error;

            this.showToast('Account created! Please check your email to verify.', 'success');
            this.logAuthEvent('sign_up', true);
            
        } catch (error) {
            this.showToast(error.message, 'error');
            this.logAuthEvent('sign_up', false, error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async handleGoogleSignIn() {
        if (!window.ENV.ENABLE_GOOGLE_AUTH) {
            this.showToast('Google authentication is not enabled', 'error');
            return;
        }

        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });

            if (error) throw error;
            
        } catch (error) {
            this.showToast(error.message, 'error');
            this.logAuthEvent('google_sign_in', false, error.message);
        }
    }

    async handleSignOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            this.session = null;
            this.tasks = [];
            
            if (this.subscription) {
                this.subscription.unsubscribe();
                this.subscription = null;
            }
            
            this.showAuth();
            this.showToast('Signed out successfully', 'success');
            this.logAuthEvent('sign_out', true);
            
        } catch (error) {
            this.showToast(error.message, 'error');
            console.error('Sign out error:', error);
        }
    }

    // View Management
    showAuth() {
        this.authContainer.classList.remove('hidden');
        this.appContainer.classList.add('hidden');
        document.title = 'Sign In - CollabTodo';
    }

    showApp() {
        this.authContainer.classList.add('hidden');
        this.appContainer.classList.remove('hidden');
        document.title = 'CollabTodo - Real-time Todo List';
        if (this.currentUser) {
            this.userEmail.textContent = this.currentUser.email;
        }
    }

    // Task Management
    async loadTasks() {
        if (!this.currentUser) return;
        
        this.setLoading(true);
        
        try {
            const { data, error } = await this.supabase
                .from('tasks')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('position', { ascending: true });

            if (error) throw error;

            this.tasks = data || [];
            this.renderTasks();
            this.updateStats();
            
        } catch (error) {
            this.showToast('Error loading tasks', 'error');
            console.error('Load tasks error:', error);
        } finally {
            this.setLoading(false);
        }
    }

    async handleAddTask(e) {
        e.preventDefault();
        
        if (this.isLoading) return;
        
        const taskText = this.taskInput.value.trim();
        const priority = this.prioritySelect.value;

        if (!taskText) {
            this.showToast('Please enter a task', 'error');
            return;
        }

        if (taskText.length > window.ENV.MAX_TASK_LENGTH) {
            this.showToast(`Task must be less than ${window.ENV.MAX_TASK_LENGTH} characters`, 'error');
            return;
        }

        this.setLoading(true);

        const newTask = {
            text: taskText,
            completed: false,
            priority: priority,
            user_id: this.currentUser.id,
            position: this.tasks.length,
            created_at: new Date().toISOString()
        };

        try {
            const { data, error } = await this.supabase
                .from('tasks')
                .insert([newTask])
                .select();

            if (error) throw error;

            this.taskInput.value = '';
            this.showToast('Task added successfully', 'success');
            this.logTaskEvent('create', data[0].id, true);
            
        } catch (error) {
            this.showToast('Error adding task', 'error');
            console.error('Add task error:', error);
            this.logTaskEvent('create', null, false, error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Verify user owns this task
        if (task.user_id !== this.currentUser.id) {
            this.showToast('Access denied', 'error');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('tasks')
                .update({ 
                    completed: !task.completed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId);

            if (error) throw error;
            
            this.logTaskEvent('toggle', taskId, true);
            
        } catch (error) {
            this.showToast('Error updating task', 'error');
            console.error('Toggle task error:', error);
            this.logTaskEvent('toggle', taskId, false, error.message);
        }
    }

    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Verify user owns this task
        if (task.user_id !== this.currentUser.id) {
            this.showToast('Access denied', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            this.showToast('Task deleted', 'success');
            this.logTaskEvent('delete', taskId, true);
            
        } catch (error) {
            this.showToast('Error deleting task', 'error');
            console.error('Delete task error:', error);
            this.logTaskEvent('delete', taskId, false, error.message);
        }
    }

    async updateTaskPositions(updatedTasks) {
        const updates = updatedTasks.map((task, index) => ({
            id: task.id,
            position: index,
            updated_at: new Date().toISOString()
        }));

        try {
            const { error } = await this.supabase
                .from('tasks')
                .upsert(updates);

            if (error) throw error;
            
            this.logTaskEvent('reorder', null, true);
            
        } catch (error) {
            this.showToast('Error reordering tasks', 'error');
            console.error('Reorder tasks error:', error);
            this.logTaskEvent('reorder', null, false, error.message);
        }
    }

    // Real-time
    setupRealtimeSubscription() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }

        this.subscription = this.supabase
            .channel(`user_${this.currentUser.id}_tasks`)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'tasks',
                    filter: `user_id=eq.${this.currentUser.id}`
                },
                (payload) => {
                    this.handleRealtimeUpdate(payload);
                }
            )
            .subscribe((status) => {
                this.updateConnectionStatus(status === 'SUBSCRIBED');
            });
    }

    handleRealtimeUpdate(payload) {
        const { eventType, new: newTask, old: oldTask } = payload;

        switch (eventType) {
            case 'INSERT':
                this.tasks.push(newTask);
                if (newTask.user_id === this.currentUser.id) {
                    this.showToast('New task added', 'info');
                }
                break;
            case 'UPDATE':
                const updateIndex = this.tasks.findIndex(t => t.id === newTask.id);
                if (updateIndex !== -1) {
                    this.tasks[updateIndex] = newTask;
                }
                break;
            case 'DELETE':
                this.tasks = this.tasks.filter(t => t.id !== oldTask.id);
                if (oldTask.user_id === this.currentUser.id) {
                    this.showToast('Task removed', 'info');
                }
                break;
        }

        this.tasks.sort((a, b) => a.position - b.position);
        this.renderTasks();
        this.updateStats();
    }

    // Drag and Drop
    setupDragAndDrop() {
        const taskElements = document.querySelectorAll('.task-item');
        
        taskElements.forEach(element => {
            element.addEventListener('dragstart', (e) => this.handleDragStart(e));
            element.addEventListener('dragend', (e) => this.handleDragEnd(e));
            element.addEventListener('dragover', (e) => this.handleDragOver(e));
            element.addEventListener('drop', (e) => this.handleDrop(e));
            element.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            element.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        });
    }

    handleDragStart(e) {
        this.draggedElement = e.target.closest('.task-item');
        this.draggedIndex = parseInt(this.draggedElement.dataset.index);
        this.draggedElement.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.draggedElement.innerHTML);
    }

    handleDragEnd(e) {
        this.draggedElement.classList.remove('dragging');
        
        const taskElements = document.querySelectorAll('.task-item');
        taskElements.forEach(elem => {
            elem.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDragEnter(e) {
        const taskElement = e.target.closest('.task-item');
        if (taskElement && taskElement !== this.draggedElement) {
            taskElement.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        const taskElement = e.target.closest('.task-item');
        if (taskElement) {
            taskElement.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        const dropElement = e.target.closest('.task-item');
        if (this.draggedElement !== dropElement && dropElement) {
            const dropIndex = parseInt(dropElement.dataset.index);
            const draggedTask = this.tasks[this.draggedIndex];
            
            // Remove dragged task from array
            this.tasks.splice(this.draggedIndex, 1);
            
            // Insert at new position
            this.tasks.splice(dropIndex, 0, draggedTask);
            
            // Update positions
            this.updateTaskPositions(this.tasks);
            this.renderTasks();
        }

        return false;
    }

    // Rendering
    renderTasks() {
        let filteredTasks = this.tasks;
        
        if (this.currentFilter === 'active') {
            filteredTasks = this.tasks.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filteredTasks = this.tasks.filter(t => t.completed);
        }

        if (filteredTasks.length === 0) {
            this.tasksList.innerHTML = '';
            this.emptyState.classList.remove('hidden');
        } else {
            this.emptyState.classList.add('hidden');
            this.tasksList.innerHTML = filteredTasks.map((task, index) => `
                <div class="task-item bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 cursor-move hover:shadow-md transition-all" 
                     draggable="true" 
                     data-index="${this.tasks.indexOf(task)}">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" 
                               class="checkbox-custom w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                               ${task.completed ? 'checked' : ''}
                               onchange="app.toggleTask('${task.id}')">
                        
                        <div class="flex-1">
                            <p class="${task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'} font-medium">
                                ${this.escapeHtml(task.text)}
                            </p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs px-2 py-1 rounded-full ${this.getPriorityClass(task.priority)}">
                                    ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </span>
                                <span class="text-xs text-gray-500 dark:text-gray-400">
                                    ${this.formatDate(task.created_at)}
                                </span>
                            </div>
                        </div>
                        
                        <button onclick="app.deleteTask('${task.id}')" 
                                class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-2">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
            this.setupDragAndDrop();
        }
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('pendingTasks').textContent = pending;
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.dataset.filter === this.currentFilter) {
                btn.classList.add('bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900', 'dark:text-indigo-300');
                btn.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
            } else {
                btn.classList.remove('bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900', 'dark:text-indigo-300');
                btn.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
            }
        });
    }

    // Dark Mode
    setupDarkMode() {
        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) {
            document.documentElement.classList.add('dark');
            this.updateDarkModeIcon(true);
        }
    }

    toggleDarkMode() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', isDark);
        this.updateDarkModeIcon(isDark);
    }

    updateDarkModeIcon(isDark) {
        const icon = this.darkModeToggle.querySelector('i');
        if (isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // Utility Functions
    getPriorityClass(priority) {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
            case 'medium':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
            case 'low':
                return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        
        if (hours < 1) {
            const minutes = Math.floor(diff / (1000 * 60));
            return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        } else {
            const days = Math.floor(hours / 24);
            return days === 1 ? 'Yesterday' : `${days}d ago`;
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = this.connectionStatus.querySelector('span:first-child');
        const statusText = this.connectionStatus.querySelector('span:last-child');
        
        if (connected) {
            statusDot.classList.remove('bg-red-500');
            statusDot.classList.add('bg-green-500');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.remove('bg-green-500');
            statusDot.classList.add('bg-red-500');
            statusText.textContent = 'Disconnected';
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        // Update button states
        const buttons = [this.signInBtn, this.signUpBtn, this.googleSignInBtn];
        buttons.forEach(btn => {
            if (loading) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Logging and Analytics
    async logAuthEvent(action, success, error = null) {
        if (!window.ENV.ENABLE_AUDIT_LOGGING) return;
        
        try {
            await this.supabase
                .from('auth_logs')
                .insert({
                    user_id: this.currentUser?.id || null,
                    action: action,
                    success: success,
                    error: error,
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                });
        } catch (error) {
            console.error('Failed to log auth event:', error);
        }
    }

    async logTaskEvent(action, taskId, success, error = null) {
        if (!window.ENV.ENABLE_AUDIT_LOGGING || !this.currentUser) return;
        
        try {
            await this.supabase
                .from('task_logs')
                .insert({
                    user_id: this.currentUser.id,
                    task_id: taskId,
                    action: action,
                    success: success,
                    error: error,
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                });
        } catch (error) {
            console.error('Failed to log task event:', error);
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const bgColor = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        }[type] || 'bg-gray-500';
        
        const icon = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        }[type] || 'fa-info-circle';
        
        toast.className = `toast ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[250px]`;
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span class="flex-1">${this.escapeHtml(message)}</span>
            <button onclick="this.parentElement.remove()" class="ml-2 hover:opacity-75">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toastContainer.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TodoApp();
});

// Make functions globally accessible for inline event handlers
window.toggleTask = (taskId) => window.app.toggleTask(taskId);
window.deleteTask = (taskId) => window.app.deleteTask(taskId);

// Handle unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    if (window.app) {
        window.app.showToast('An unexpected error occurred', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.app) {
        window.app.showToast('An unexpected error occurred', 'error');
    }
});