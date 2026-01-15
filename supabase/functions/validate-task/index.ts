import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { taskId, action } = await req.json()

    if (!taskId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing taskId or action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate action
    const validActions = ['read', 'update', 'delete']
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user owns this task
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('user_id, text, priority')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (task.user_id !== user.id) {
      // Log unauthorized access attempt
      await supabaseAdmin
        .from('auth_logs')
        .insert({
          user_id: user.id,
          action: `unauthorized_${action}_attempt`,
          success: false,
          error: `User attempted to ${action} task they don't own: ${taskId}`,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
          timestamp: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Additional validation based on action
    if (action === 'update' || action === 'delete') {
      // Check if task can be modified (e.g., not older than 24 hours for deletion)
      const { data: taskDetails } = await supabaseAdmin
        .from('tasks')
        .select('created_at')
        .eq('id', taskId)
        .single()

      if (taskDetails) {
        const taskAge = Date.now() - new Date(taskDetails.created_at).getTime()
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours

        if (action === 'delete' && taskAge > maxAge) {
          return new Response(
            JSON.stringify({ error: 'Tasks older than 24 hours cannot be deleted' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Log successful validation
    await supabaseAdmin
      .from('task_logs')
      .insert({
        user_id: user.id,
        task_id: taskId,
        action: `validate_${action}`,
        success: true,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Task validation successful',
        task: {
          id: taskId,
          text: task.text,
          priority: task.priority
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Validation error:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
