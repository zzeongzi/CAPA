-- Function to parse reps from TEXT to INTEGER
-- This is a simplified parser. For more complex scenarios, a more robust parsing function or regex might be needed.
CREATE OR REPLACE FUNCTION internal_parse_reps_text_to_int(reps_text TEXT)
RETURNS INTEGER AS $$
DECLARE
    first_part TEXT;
BEGIN
    IF reps_text IS NULL THEN
        RETURN NULL;
    END IF;

    -- Check for non-numeric patterns like AMRAP, drop set, etc.
    IF reps_text ~* '^[A-Za-z]' THEN -- If it starts with a letter, assume it's text like AMRAP
        RETURN NULL;
    END IF;

    -- Attempt to get the first part if it's a range (e.g., "8-12")
    first_part := split_part(reps_text, '-', 1);
    
    -- Remove any non-digit characters from the first part (e.g. spaces)
    first_part := regexp_replace(first_part, '\D','','g');

    IF first_part = '' THEN
        RETURN NULL;
    END IF;
    
    BEGIN
        RETURN first_part::INTEGER;
    EXCEPTION WHEN others THEN
        -- If any conversion error occurs, return NULL
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to create a workout session from a template
CREATE OR REPLACE FUNCTION public.create_workout_session_from_template(
    p_template_id UUID,
    p_member_id UUID,
    p_trainer_id UUID,
    p_center_id UUID,
    p_session_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_workout_session_id UUID;
    template_name TEXT;
    template_exercise RECORD;
    new_workout_exercise_id UUID;
    parsed_reps INTEGER;
    set_count INTEGER;
    i INTEGER;
BEGIN
    -- 1. Check if member, trainer, and center exist (optional, depends on FK constraints, but good for early exit)
    IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
        RAISE EXCEPTION 'Member with ID % does not exist.', p_member_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_trainer_id) THEN
        RAISE EXCEPTION 'Trainer with ID % does not exist.', p_trainer_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.centers WHERE id = p_center_id) THEN
        RAISE EXCEPTION 'Center with ID % does not exist.', p_center_id;
    END IF;

    -- 2. Fetch template name and check if template exists
    SELECT name INTO template_name FROM public.workout_templates WHERE id = p_template_id AND center_id = p_center_id;
    IF template_name IS NULL THEN
        RAISE EXCEPTION 'Workout template with ID % not found or not associated with center ID %.', p_template_id, p_center_id;
    END IF;

    -- 3. Create workout_sessions entry
    INSERT INTO public.workout_sessions (
        member_id,
        trainer_id,
        center_id,
        session_date,
        notes,
        source_template_id, -- Assuming this column exists or will be added to workout_sessions
        session_order, 
        total_sessions_at_creation 
    )
    VALUES (
        p_member_id,
        p_trainer_id,
        p_center_id,
        p_session_date,
        'Workout created from template: ' || template_name,
        p_template_id, -- Store reference to the template
        NULL, -- Set to NULL or appropriate default
        NULL  -- Set to NULL or appropriate default
    )
    RETURNING id INTO new_workout_session_id;

    -- 4. Copy workout_template_exercises to workout_exercises and their sets to workout_sets
    FOR template_exercise IN
        SELECT *
        FROM public.workout_template_exercises wte
        WHERE wte.template_id = p_template_id
        ORDER BY wte.exercise_order
    LOOP
        -- Insert into workout_exercises
        INSERT INTO public.workout_exercises (
            session_id,
            exercise_id,
            notes,
            "order" -- "order" is a keyword, so it's quoted
        )
        VALUES (
            new_workout_session_id,
            template_exercise.exercise_id,
            template_exercise.notes,
            template_exercise.exercise_order
        )
        RETURNING id INTO new_workout_exercise_id;

        -- Parse reps and determine set count
        parsed_reps := internal_parse_reps_text_to_int(template_exercise.reps);
        set_count := template_exercise.sets;

        -- Insert sets into workout_sets
        IF set_count IS NOT NULL AND set_count > 0 THEN
            FOR i IN 1..set_count LOOP
                INSERT INTO public.workout_sets (
                    workout_exercise_id,
                    set_number,
                    reps, -- Storing the parsed integer value
                    weight,
                    completed,
                    notes -- notes from workout_template_exercises can be copied here if needed for each set, or keep NULL
                )
                VALUES (
                    new_workout_exercise_id,
                    i,
                    parsed_reps,
                    NULL, -- Weight is NULL by default
                    FALSE, -- Completed is false by default
                    NULL -- template_exercise.notes can be for the exercise overall, not per set. Or copy if desired.
                );
            END LOOP;
        END IF;
    END LOOP;

    -- 5. Return the ID of the new workout_sessions record
    RETURN new_workout_session_id;
END;
$$;

-- Example usage (ensure these UUIDs exist in your DB):
-- SELECT public.create_workout_session_from_template(
--     'your_template_id_here',      -- p_template_id
--     'your_member_id_here',        -- p_member_id (from public.members)
--     'your_auth_user_id_here',     -- p_trainer_id (from auth.users)
--     'your_center_id_here',        -- p_center_id (from public.centers)
--     NOW()                         -- p_session_date
-- );

-- Notes:
-- 1. `source_template_id` column: Added a `source_template_id UUID NULLABLE REFERENCES public.workout_templates(id)` 
--    column to `public.workout_sessions` table. This is useful for tracking which template a session originated from.
--    If you don't want this, remove it from the INSERT statement.
--    ALTER TABLE public.workout_sessions ADD COLUMN source_template_id UUID NULLABLE REFERENCES public.workout_templates(id);
--
-- 2. `reps` field in `workout_sets`: The `internal_parse_reps_text_to_int` function attempts to convert TEXT reps 
--    (like "8-12", "10", "AMRAP") from `workout_template_exercises` into an INTEGER for `workout_sets.reps`.
--    - "8-12" becomes 8.
--    - "10" becomes 10.
--    - "AMRAP" or any text starting with a letter becomes NULL.
--    - Empty or non-convertible strings become NULL.
--    This is a simplification. If you need to store the original text like "8-12" or "AMRAP" for each set, 
--    the `workout_sets.reps` column should be TEXT type, or you might need an additional `target_reps_text` column.
--
-- 3. Error Handling: Basic checks for existence of member, trainer, center, and template are included.
--
-- 4. Security: Set to `SECURITY DEFINER`. The definer (usually the user creating the function, often a superuser or admin)
--    must have necessary permissions on all accessed tables. This allows the function to run with elevated privileges
--    if needed, bypassing RLS of the calling user. Ensure RLS policies on the tables are also configured
--    appropriately if you intend for callers to operate within their own RLS. For this setup, SECURITY DEFINER
--    is common for functions that orchestrate data across multiple tables like this.
--
-- 5. `workout_exercises.order`: The function reads from `wte.exercise_order` and inserts into `"order"` for `workout_exercises`.
--
-- 6. `workout_sets.notes`: The `notes` from `workout_template_exercises` is for the overall exercise in the template.
--    The `workout_sets.notes` column is set to NULL for each set. You could choose to copy `template_exercise.notes`
--    to each set's notes if that behavior is desired.
--
-- 7. Nullable columns in `workout_sessions` (`session_order`, `total_sessions_at_creation`): These are set to NULL
--    as they are specific to PT session decrement logic not applicable here.

SELECT 'Function create_workout_session_from_template created successfully.';
SELECT 'Helper function internal_parse_reps_text_to_int created successfully.';

-- Remember to add the `source_template_id` column to `workout_sessions` if you keep that part:
-- ALTER TABLE public.workout_sessions ADD COLUMN source_template_id UUID NULLABLE REFERENCES public.workout_templates(id) ON DELETE SET NULL;
-- CREATE INDEX idx_workout_sessions_source_template_id ON public.workout_sessions(source_template_id);
