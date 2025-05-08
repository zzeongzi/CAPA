import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-body-composition-logs function started');

serve(async (req: Request) => { // req 타입 명시

  // Handle CORS preflight request first
  if (req.method === 'OPTIONS') {
    // Explicitly return all necessary CORS headers for preflight
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': corsHeaders['Access-Control-Allow-Origin'], // Use value from shared config
        'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'],
        'Access-Control-Allow-Methods': corsHeaders['Access-Control-Allow-Methods'],
      },
    });
  }

  // Define response headers using shared corsHeaders for actual requests
  const responseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get user data
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
       console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: responseHeaders, // Use simplified headers
        status: 401,
      });
    }

    // Get user's center_id
    const { data: centerUserData, error: centerUserError } = await supabaseClient
      .from('center_users')
      .select('center_id')
      .eq('user_id', user.id)
      .single();

    if (centerUserError || !centerUserData) {
      console.error('Error fetching center user:', centerUserError);
      return new Response(JSON.stringify({ error: 'Failed to get user center information' }), {
        headers: responseHeaders, // Use simplified headers
        status: 500,
      });
    }
    const userCenterId = centerUserData.center_id;

    // Parse query parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('memberId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '10', 10);

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage - 1;

    // Build query
    let query = supabaseClient
      .from('body_composition_logs')
      .select(`
        id, member_id, measurement_date, weight_kg, skeletal_muscle_mass_kg, body_fat_percentage, bmi, notes, created_at,
        members ( id, name )
      `, { count: 'exact' })
      .eq('center_id', userCenterId); // Filter by user's center

    if (memberId && memberId !== 'all') {
      query = query.eq('member_id', memberId);
    }
    if (startDate) {
      query = query.gte('measurement_date', startDate);
    }
    if (endDate) {
      query = query.lte('measurement_date', endDate);
    }

    query = query.order('measurement_date', { ascending: false }).range(startIndex, endIndex);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching body composition logs:', error);
      throw error;
    }

    // Return response
    return new Response(JSON.stringify({ data, count }), {
      headers: responseHeaders, // Use simplified headers
      status: 200,
    });

  } catch (error: unknown) { // error 타입을 unknown으로 변경
    console.error('An unexpected error occurred:', error);
    // instanceof Error로 타입 확인 후 message 접근
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: responseHeaders, // Use simplified headers
      status: 500,
    });
  }
});