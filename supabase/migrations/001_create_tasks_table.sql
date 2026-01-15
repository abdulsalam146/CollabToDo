-- Create tasks table
CREATE TABLE tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text text NOT NULL,
    completed boolean DEFAULT false,
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    position integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Add constraints for data integrity
    CONSTRAINT tasks_user_id_not_null CHECK (user_id IS NOT NULL),
    CONSTRAINT tasks_text_not_empty CHECK (length(trim(text)) > 0),
    CONSTRAINT tasks_text_max_length CHECK (length(trim(text)) <= 1000),
    CONSTRAINT tasks_position_non_negative CHECK (position >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_user_position ON tasks(user_id, position);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_completed ON tasks(completed);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- 1. Users can only access their own tasks
CREATE POLICY "Users can only access their own tasks" ON tasks
    FOR ALL USING (auth.uid() = user_id);

-- 2. More granular policies for different operations
CREATE POLICY "Users can insert their own tasks" ON tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON tasks
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Deny anonymous access completely
CREATE POLICY "Deny anonymous users" ON tasks
    FOR ALL USING (auth.role() != 'anon');

-- Create audit logs table
CREATE TABLE task_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
    action text NOT NULL,
    success boolean DEFAULT true,
    error text,
    ip_address inet,
    user_agent text,
    timestamp timestamptz DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own task logs" ON task_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task logs" ON task_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create auth logs table
CREATE TABLE auth_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    success boolean DEFAULT true,
    error text,
    ip_address inet,
    user_agent text,
    timestamp timestamptz DEFAULT now()
);

-- Enable RLS on auth logs
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own auth logs" ON auth_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert auth logs" ON auth_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create database function for secure task creation
CREATE OR REPLACE FUNCTION create_user_task(
    task_text text,
    task_priority text DEFAULT 'medium'
)
RETURNS uuid AS $$ DECLARE
    new_task_id uuid;
    max_position integer;
BEGIN
    -- Validate input
    IF task_text IS NULL OR length(trim(task_text)) = 0 THEN
        RAISE EXCEPTION 'Task text cannot be empty';
    END IF;
    
    IF length(trim(task_text)) > 1000 THEN
        RAISE EXCEPTION 'Task text too long';
    END IF;
    
    IF task_priority NOT IN ('low', 'medium', 'high') THEN
        RAISE EXCEPTION 'Invalid priority';
    END IF;
    
    -- Get the next position for this user
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position
    FROM tasks
    WHERE user_id = auth.uid();
    
    -- Insert the new task
    INSERT INTO tasks (user_id, text, priority, position)
    VALUES (auth.uid(), trim(task_text), task_priority, max_position)
    RETURNING id INTO new_task_id;
    
    RETURN new_task_id;
END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_user_task TO authenticated;

-- Create function for updating task position
CREATE OR REPLACE FUNCTION update_task_position(
    task_id uuid,
    new_position integer
)
RETURNS boolean AS $$ BEGIN
    -- Update task position if user owns it
    UPDATE tasks
    SET position = new_position, updated_at = now()
    WHERE id = task_id AND user_id = auth.uid();
    
    RETURN FOUND;
END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_task_position TO authenticated;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
 $$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for task statistics
CREATE OR REPLACE VIEW user_task_stats AS
SELECT 
    user_id,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE completed = true) as completed_tasks,
    COUNT(*) FILTER (WHERE completed = false) as pending_tasks,
    MAX(created_at) as last_activity
FROM tasks
GROUP BY user_id;

-- Enable RLS on the view
ALTER VIEW user_task_stats SET (security_invoker = true);
