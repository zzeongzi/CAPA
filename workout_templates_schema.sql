-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Define workout_templates Table
CREATE TABLE public.workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES auth.users(id),
    center_id UUID NOT NULL REFERENCES public.centers(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to update updated_at on workout_templates modification
CREATE TRIGGER update_workout_templates_updated_at
BEFORE UPDATE ON public.workout_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Define workout_template_exercises Table
CREATE TABLE public.workout_template_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id),
    sets INTEGER,
    reps TEXT, -- e.g., "8-12", "15", "AMRAP"
    rest_period_seconds INTEGER,
    notes TEXT,
    exercise_order INTEGER NOT NULL, -- Renamed from 'order'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Define Row Level Security (RLS) Policies

-- For workout_templates
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage their own workout templates"
ON public.workout_templates
FOR ALL
TO authenticated -- Or specify a 'trainer' role if you have one
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

-- Example of a read-only policy for other authenticated users (if needed in future, e.g. for shared templates)
-- CREATE POLICY "Authenticated users can view workout templates"
-- ON public.workout_templates
-- FOR SELECT
-- TO authenticated
-- USING (true); -- Adjust this condition based on sharing logic, e.g., a sharing table or a public flag

-- For workout_template_exercises
ALTER TABLE public.workout_template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage exercises for their own templates"
ON public.workout_template_exercises
FOR ALL
TO authenticated -- Or specify a 'trainer' role
USING (
    (SELECT wt.trainer_id FROM public.workout_templates wt WHERE wt.id = template_id) = auth.uid()
)
WITH CHECK (
    (SELECT wt.trainer_id FROM public.workout_templates wt WHERE wt.id = template_id) = auth.uid()
);

-- Example of a read-only policy for workout_template_exercises (if templates are shared)
-- CREATE POLICY "Authenticated users can view exercises for accessible templates"
-- ON public.workout_template_exercises
-- FOR SELECT
-- TO authenticated
-- USING (
--   (SELECT EXISTS (
--     SELECT 1 FROM public.workout_templates wt
--     WHERE wt.id = template_id
--     -- Add template accessibility logic here, e.g. AND wt.is_public = true OR wt.trainer_id = auth.uid()
--   ))
-- );


-- 4. Define Indexes
CREATE INDEX idx_workout_templates_trainer_id ON public.workout_templates(trainer_id);
CREATE INDEX idx_workout_templates_center_id ON public.workout_templates(center_id); -- Added for consistency

CREATE INDEX idx_workout_template_exercises_template_id ON public.workout_template_exercises(template_id);
CREATE INDEX idx_workout_template_exercises_exercise_id ON public.workout_template_exercises(exercise_id);

COMMENT ON COLUMN public.workout_template_exercises.reps IS 'e.g., "8-12", "15", "AMRAP"';
COMMENT ON COLUMN public.workout_template_exercises.exercise_order IS 'Order of the exercise within the template';

-- Note: Ensure you have a 'trainer' role or adjust RLS policies to 'authenticated' if not using specific roles yet.
-- If using specific roles like 'trainer', the user creating/managing templates must be part of that role.
-- The RLS policies assume that `auth.uid()` returns the UUID of the currently authenticated user.
-- Consider adding `ON DELETE SET NULL` or `ON DELETE RESTRICT` for `exercise_id` if exercises should not be deleted when referenced,
-- or handle this at the application level. Current setup allows exercise deletion, which might orphan template exercises.
-- Consider adding an index on `workout_templates(name)` if templates are often searched by name.
-- Consider adding a composite index on `workout_template_exercises(template_id, exercise_order)` if ordering is frequently used in queries.

SELECT 'Workout templates schema created successfully.';
