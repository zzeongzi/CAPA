

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."user_role" AS ENUM (
    'trainer',
    'member'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_unique_constraint"("target_table_name" "text", "target_column_name" "text", "target_schema_name" "text" DEFAULT 'public'::"text", "custom_constraint_name" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    constraint_name TEXT;
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = target_schema_name 
        AND table_name = target_table_name
    ) INTO table_exists;

    IF NOT table_exists THEN
        RETURN format('Error: Table %I.%I does not exist', target_schema_name, target_table_name);
    END IF;

    -- 컬럼 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = target_schema_name 
        AND table_name = target_table_name 
        AND column_name = target_column_name
    ) INTO column_exists;

    IF NOT column_exists THEN
        RETURN format('Error: Column %I does not exist in table %I.%I', 
            target_column_name, target_schema_name, target_table_name);
    END IF;

    -- 제약조건 이름 설정
    constraint_name := COALESCE(
        custom_constraint_name,
        target_table_name || '_' || target_column_name || '_key'
    );

    -- 제약조건 추가
    EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (%I)', 
        target_schema_name,
        target_table_name,
        constraint_name,
        target_column_name
    );

    RETURN format('Success: Unique constraint %I added to %I.%I.%I', 
        constraint_name, target_schema_name, target_table_name, target_column_name);

EXCEPTION
    WHEN duplicate_object THEN
        RETURN format('Notice: Constraint %I already exists on %I.%I.%I',
            constraint_name, target_schema_name, target_table_name, target_column_name);
    WHEN undefined_table THEN
        RETURN format('Error: Table %I.%I is not defined', 
            target_schema_name, target_table_name);
    WHEN undefined_column THEN
        RETURN format('Error: Column %I is not defined in table %I.%I', 
            target_column_name, target_schema_name, target_table_name);
    WHEN OTHERS THEN
        RETURN format('Error: %s', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."add_unique_constraint"("target_table_name" "text", "target_column_name" "text", "target_schema_name" "text", "custom_constraint_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_workout_session_and_decrement_pt"("p_member_id" "uuid", "p_trainer_id" "uuid", "p_center_id" "uuid", "p_session_date" timestamp with time zone, "p_notes" "text", "p_session_order" integer, "p_total_sessions_at_creation" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_session_id UUID;
    target_user_id UUID;
    membership_record RECORD;
    updated_rows INT;
BEGIN
    -- Get the user_id from members table using p_member_id (which is members.id)
    SELECT user_id INTO target_user_id
    FROM public.members
    WHERE id = p_member_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Member not found for id %', p_member_id;
    END IF;

    -- Find the relevant membership for the member using user_id
    SELECT id, remaining_sessions, total_sessions
    INTO membership_record
    FROM public.memberships
    WHERE member_id = target_user_id -- Use user_id to find membership
    ORDER BY created_at DESC
    LIMIT 1;

    -- Check if membership exists and has remaining sessions
    IF membership_record IS NULL THEN
        RAISE EXCEPTION 'Membership not found for member (user_id %) corresponding to member.id %', target_user_id, p_member_id;
    END IF;

    IF membership_record.remaining_sessions <= 0 THEN
        RAISE EXCEPTION 'No remaining PT sessions for member (user_id %)', target_user_id;
    END IF;

    -- Insert the workout session using p_member_id (members.id)
    INSERT INTO public.workout_sessions (
        member_id, trainer_id, center_id, session_date, notes, session_order, total_sessions_at_creation
    ) VALUES (
        p_member_id, p_trainer_id, p_center_id, p_session_date, p_notes, p_session_order, p_total_sessions_at_creation
    ) RETURNING id INTO new_session_id;

    -- Decrement remaining sessions in memberships table using membership_record.id
    UPDATE public.memberships
    SET remaining_sessions = remaining_sessions - 1
    WHERE id = membership_record.id;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    IF updated_rows = 0 THEN
         RAISE EXCEPTION 'Failed to decrement remaining sessions for membership_id %', membership_record.id;
    END IF;

    RETURN new_session_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;


ALTER FUNCTION "public"."create_workout_session_and_decrement_pt"("p_member_id" "uuid", "p_trainer_id" "uuid", "p_center_id" "uuid", "p_session_date" timestamp with time zone, "p_notes" "text", "p_session_order" integer, "p_total_sessions_at_creation" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_new_members"("p_center_id" "uuid", "p_months" integer DEFAULT 7) RETURNS TABLE("month_name" "text", "member_count" bigint)
    LANGUAGE "sql"
    AS $$
    SELECT 
        to_char(date_trunc('month', registration_date), 'YYYY-MM') AS month_name,
        COUNT(id) AS member_count
    FROM 
        public.members
    WHERE 
        center_id = p_center_id
        AND registration_date >= date_trunc('month', NOW() - (p_months - 1) * interval '1 month')
        AND registration_date < date_trunc('month', NOW() + interval '1 month')
    GROUP BY 
        date_trunc('month', registration_date)
    ORDER BY 
        date_trunc('month', registration_date) ASC
    LIMIT p_months;
$$;


ALTER FUNCTION "public"."get_monthly_new_members"("p_center_id" "uuid", "p_months" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_center_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT center_id FROM public.center_users WHERE user_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_center_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_chat_room"("user1_id" "uuid", "user2_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_room_id uuid;
  new_room_id uuid;
BEGIN
  -- Find a room where ONLY these two users are participants
  SELECT r.id INTO existing_room_id
  FROM chat_rooms r
  WHERE EXISTS (
      SELECT 1
      FROM chat_participants cp1
      WHERE cp1.room_id = r.id AND cp1.user_id = user1_id
  )
  AND EXISTS (
      SELECT 1
      FROM chat_participants cp2
      WHERE cp2.room_id = r.id AND cp2.user_id = user2_id
  )
  AND (
      SELECT COUNT(*)
      FROM chat_participants cp3
      WHERE cp3.room_id = r.id
  ) = 2
  LIMIT 1;

  -- If room exists, return its ID
  IF existing_room_id IS NOT NULL THEN
    RETURN existing_room_id;
  END IF;

  -- If room doesn't exist, create a new one
  INSERT INTO chat_rooms DEFAULT VALUES RETURNING id INTO new_room_id; -- Use DEFAULT VALUES

  -- Add participants to the new room
  INSERT INTO chat_participants (room_id, user_id) VALUES (new_room_id, user1_id);
  INSERT INTO chat_participants (room_id, user_id) VALUES (new_room_id, user2_id);

  -- Return the new room ID
  RETURN new_room_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_direct_chat_room"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_other_participant_id"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT user_id
  FROM public.chat_participants
  WHERE room_id = p_room_id AND user_id <> p_user_id -- != 대신 <> 사용 (표준 SQL)
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_other_participant_id"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_message_count"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COUNT(*)::integer
  FROM public.message_read_status mrs
  JOIN public.chat_messages cm ON mrs.message_id = cm.id
  WHERE cm.room_id = p_room_id
    AND mrs.user_id = p_user_id
    AND mrs.read_at IS NULL;
$$;


ALTER FUNCTION "public"."get_unread_message_count"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_chat_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sender_profile RECORD;
  recipient_id uuid;
  sender_name TEXT;
  participant_ids uuid[];
BEGIN
  -- 메시지 발신자 정보 조회
  SELECT id, first_name, last_name
  INTO sender_profile
  FROM public.profiles
  WHERE id = NEW.sender_id;

  sender_name := TRIM(COALESCE(sender_profile.first_name, '') || ' ' || COALESCE(sender_profile.last_name, ''));
  IF sender_name = '' THEN
    sender_name := '알 수 없는 사용자';
  END IF;

  -- 채팅방의 모든 참여자 ID 조회 (발신자 포함)
  SELECT array_agg(user_id) INTO participant_ids
  FROM public.chat_participants
  WHERE room_id = NEW.room_id;

  -- 각 수신자에게 알림 생성 및 읽음 상태 레코드 생성
  FOREACH recipient_id IN ARRAY participant_ids LOOP
    IF recipient_id != NEW.sender_id THEN
      -- 알림 생성
      INSERT INTO public.notifications (user_id, type, content, link, metadata)
      VALUES (
        recipient_id,
        'new_message',
        sender_name || '님으로부터 새 메시지가 도착했습니다.',
        '/chat/' || NEW.room_id,
        jsonb_build_object(
          'senderId', NEW.sender_id,
          'senderName', sender_name,
          'roomId', NEW.room_id
        )
      );

      -- 읽음 상태 레코드 생성 (아직 안 읽음)
      INSERT INTO public.message_read_status (message_id, user_id)
      VALUES (NEW.id, recipient_id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_chat_message_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_chat_room"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 해당 사용자를 채팅방 참여자 목록에서 제거
  DELETE FROM public.chat_participants
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- (선택 사항) 채팅방에 남은 참여자가 없으면 채팅방 자체 또는 관련 메시지 삭제 로직 추가 가능
  -- IF NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE room_id = p_room_id) THEN
  --   DELETE FROM public.chat_messages WHERE room_id = p_room_id;
  --   DELETE FROM public.chat_rooms WHERE id = p_room_id;
  -- END IF;
END;
$$;


ALTER FUNCTION "public"."leave_chat_room"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_chat_messages_as_read"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.message_read_status mrs
  SET read_at = now()
  FROM public.chat_messages cm
  WHERE mrs.message_id = cm.id
    AND cm.room_id = p_room_id
    AND mrs.user_id = p_user_id
    AND mrs.read_at IS NULL
    AND cm.sender_id != p_user_id; -- Ensure the user is not the sender
END;
$$;


ALTER FUNCTION "public"."mark_chat_messages_as_read"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."body_composition_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "measurement_date" "date" DEFAULT "now"() NOT NULL,
    "weight_kg" numeric,
    "skeletal_muscle_mass_kg" numeric,
    "body_fat_percentage" numeric,
    "bmi" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."body_composition_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."body_composition_logs"."member_id" IS 'ID of the member whose body composition was measured';



COMMENT ON COLUMN "public"."body_composition_logs"."measurement_date" IS 'Date of the measurement';



COMMENT ON COLUMN "public"."body_composition_logs"."weight_kg" IS 'Weight in kilograms';



COMMENT ON COLUMN "public"."body_composition_logs"."skeletal_muscle_mass_kg" IS 'Skeletal muscle mass in kilograms';



COMMENT ON COLUMN "public"."body_composition_logs"."body_fat_percentage" IS 'Body fat percentage';



COMMENT ON COLUMN "public"."body_composition_logs"."bmi" IS 'Body Mass Index';



COMMENT ON COLUMN "public"."body_composition_logs"."notes" IS 'Additional notes about the measurement';



CREATE TABLE IF NOT EXISTS "public"."center_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "center_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."center_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kakao_place_id" "text"
);


ALTER TABLE "public"."centers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb"
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category_l1" "text",
    "category_l2" "text",
    "target_muscles" "text"[]
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "center_id" "uuid" NOT NULL,
    "session_date" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "session_order" integer,
    "total_sessions_at_creation" integer
);


ALTER TABLE "public"."workout_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."latest_workout_sessions_view" AS
 SELECT "ranked_sessions"."member_id",
    "ranked_sessions"."session_date"
   FROM ( SELECT "workout_sessions"."member_id",
            "workout_sessions"."session_date",
            "row_number"() OVER (PARTITION BY "workout_sessions"."member_id" ORDER BY "workout_sessions"."session_date" DESC) AS "rn"
           FROM "public"."workout_sessions") "ranked_sessions"
  WHERE ("ranked_sessions"."rn" = 1);


ALTER TABLE "public"."latest_workout_sessions_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "center_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone_number" "text",
    "email" "text",
    "registration_date" "date" DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "profile_image_url" "text",
    "birth_date" "date",
    "gender" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "bio" "text",
    "managing_trainer_id" "uuid",
    "user_id" "uuid"
);


ALTER TABLE "public"."members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."members"."center_id" IS 'ID of the center the member belongs to';



COMMENT ON COLUMN "public"."members"."status" IS 'Membership status (e.g., active, inactive)';



CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "total_sessions" integer NOT NULL,
    "remaining_sessions" integer NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_read_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_read_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."my_trainer_members" (
    "trainer_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."my_trainer_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "last_name" "text",
    "phone_number" "text",
    "birth_date" "date",
    "gender" "text",
    "bio" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pt_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "membership_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'PT'::"text",
    "background_color" "text",
    "workout_session_id" "uuid"
);


ALTER TABLE "public"."pt_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pt_sessions"."background_color" IS 'Background color for the event in HEX format (e.g., #RRGGBBAA) or rgba() format';



CREATE TABLE IF NOT EXISTS "public"."session_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_status_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'noshow'::"text"])))
);


ALTER TABLE "public"."session_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "center_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "member_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text",
    "due_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tasks"."center_id" IS 'ID of the center this task belongs to';



COMMENT ON COLUMN "public"."tasks"."assigned_to" IS 'ID of the user (trainer) assigned to this task';



COMMENT ON COLUMN "public"."tasks"."member_id" IS 'ID of the member related to this task (optional)';



COMMENT ON COLUMN "public"."tasks"."priority" IS 'Priority of the task (high, medium, low)';



COMMENT ON COLUMN "public"."tasks"."due_date" IS 'Due date for the task';



COMMENT ON COLUMN "public"."tasks"."status" IS 'Status of the task (pending, in_progress, completed)';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "notes" "text",
    "order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workout_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "trainer_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "content" "text",
    "exercises" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workout_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_exercise_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text",
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workout_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_exercise_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "weight" numeric,
    "reps" integer,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workout_sets" OWNER TO "postgres";


ALTER TABLE ONLY "public"."body_composition_logs"
    ADD CONSTRAINT "body_composition_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."center_users"
    ADD CONSTRAINT "center_users_center_id_user_id_key" UNIQUE ("center_id", "user_id");



ALTER TABLE ONLY "public"."center_users"
    ADD CONSTRAINT "center_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."center_users"
    ADD CONSTRAINT "center_users_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."centers"
    ADD CONSTRAINT "centers_kakao_place_id_key" UNIQUE ("kakao_place_id");



ALTER TABLE ONLY "public"."centers"
    ADD CONSTRAINT "centers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_read_status"
    ADD CONSTRAINT "message_read_status_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_read_status"
    ADD CONSTRAINT "message_read_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."my_trainer_members"
    ADD CONSTRAINT "my_trainer_members_pkey" PRIMARY KEY ("trainer_id", "member_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pt_sessions"
    ADD CONSTRAINT "pt_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_status"
    ADD CONSTRAINT "session_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_media"
    ADD CONSTRAINT "workout_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_sets"
    ADD CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chat_participants_user_room_last_read" ON "public"."chat_participants" USING "btree" ("user_id", "room_id", "last_read_at");



CREATE INDEX "idx_exercises_category_l1" ON "public"."exercises" USING "btree" ("category_l1");



CREATE INDEX "idx_exercises_category_l2" ON "public"."exercises" USING "btree" ("category_l2");



CREATE INDEX "idx_exercises_name" ON "public"."exercises" USING "btree" ("name");



CREATE INDEX "idx_members_user_id" ON "public"."members" USING "btree" ("user_id");



CREATE INDEX "idx_message_read_status_message_id" ON "public"."message_read_status" USING "btree" ("message_id");



CREATE INDEX "idx_message_read_status_user_id_read_at" ON "public"."message_read_status" USING "btree" ("user_id", "read_at");



CREATE INDEX "idx_notifications_user_id_created_at" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_id_is_read" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_session_status_session_id" ON "public"."session_status" USING "btree" ("session_id");



CREATE INDEX "idx_workout_exercises_exercise_id" ON "public"."workout_exercises" USING "btree" ("exercise_id");



CREATE INDEX "idx_workout_exercises_session_id" ON "public"."workout_exercises" USING "btree" ("session_id");



CREATE INDEX "idx_workout_media_workout_exercise_id" ON "public"."workout_media" USING "btree" ("workout_exercise_id");



CREATE INDEX "idx_workout_sessions_member_date" ON "public"."workout_sessions" USING "btree" ("member_id", "session_date");



CREATE INDEX "idx_workout_sessions_trainer_date" ON "public"."workout_sessions" USING "btree" ("trainer_id", "session_date");



CREATE INDEX "idx_workout_sets_workout_exercise_id" ON "public"."workout_sets" USING "btree" ("workout_exercise_id");



CREATE OR REPLACE TRIGGER "on_new_chat_message_create_notification" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_chat_message_notification"();



ALTER TABLE ONLY "public"."body_composition_logs"
    ADD CONSTRAINT "body_composition_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."center_users"
    ADD CONSTRAINT "center_users_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."center_users"
    ADD CONSTRAINT "center_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_managing_trainer_id_fkey" FOREIGN KEY ("managing_trainer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_read_status"
    ADD CONSTRAINT "message_read_status_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_read_status"
    ADD CONSTRAINT "message_read_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."my_trainer_members"
    ADD CONSTRAINT "my_trainer_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."my_trainer_members"
    ADD CONSTRAINT "my_trainer_members_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pt_sessions"
    ADD CONSTRAINT "pt_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pt_sessions"
    ADD CONSTRAINT "pt_sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pt_sessions"
    ADD CONSTRAINT "pt_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pt_sessions"
    ADD CONSTRAINT "pt_sessions_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_status"
    ADD CONSTRAINT "session_status_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."pt_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_media"
    ADD CONSTRAINT "workout_media_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sets"
    ADD CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE CASCADE;



CREATE POLICY "Allow access to messages in own chats" ON "public"."chat_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_messages"."room_id") AND ("chat_participants"."user_id" = "auth"."uid"()))))) WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_messages"."room_id") AND ("chat_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Allow access to own participation" ON "public"."chat_participants" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow authenticated insert access" ON "public"."centers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read access" ON "public"."centers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update access" ON "public"."centers" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert centers" ON "public"."centers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to insert chat participants" ON "public"."chat_participants" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to insert chat rooms" ON "public"."chat_rooms" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read user roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to select all center_users" ON "public"."center_users" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to select all profiles" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow message sender to view read statuses" ON "public"."message_read_status" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_messages" "m"
  WHERE (("m"."id" = "message_read_status"."message_id") AND ("m"."sender_id" = "auth"."uid"())))));



CREATE POLICY "Allow own insert access" ON "public"."center_users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow own select access" ON "public"."center_users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow own update access" ON "public"."center_users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow read access to own chat rooms" ON "public"."chat_rooms" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_rooms"."id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow trainer access to own members" ON "public"."my_trainer_members" USING (("auth"."uid"() = "trainer_id")) WITH CHECK (("auth"."uid"() = "trainer_id"));



CREATE POLICY "Allow trainers to delete their own sessions" ON "public"."pt_sessions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "trainer_id"));



CREATE POLICY "Allow trainers to insert their own sessions" ON "public"."pt_sessions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "trainer_id"));



CREATE POLICY "Allow trainers to manage status for their sessions" ON "public"."session_status" USING (("auth"."uid"() = ( SELECT "workout_sessions"."trainer_id"
   FROM "public"."workout_sessions"
  WHERE ("workout_sessions"."id" = "session_status"."session_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "workout_sessions"."trainer_id"
   FROM "public"."workout_sessions"
  WHERE ("workout_sessions"."id" = "session_status"."session_id"))));



CREATE POLICY "Allow trainers to update exercises in their sessions" ON "public"."workout_exercises" FOR UPDATE TO "authenticated" USING ((( SELECT "workout_sessions"."trainer_id"
   FROM "public"."workout_sessions"
  WHERE ("workout_sessions"."id" = "workout_exercises"."session_id")) = "auth"."uid"())) WITH CHECK ((( SELECT "workout_sessions"."trainer_id"
   FROM "public"."workout_sessions"
  WHERE ("workout_sessions"."id" = "workout_exercises"."session_id")) = "auth"."uid"()));



CREATE POLICY "Allow trainers to update media in their sessions" ON "public"."workout_media" FOR UPDATE TO "authenticated" USING ((( SELECT "ws"."trainer_id"
   FROM ("public"."workout_sessions" "ws"
     JOIN "public"."workout_exercises" "we" ON (("ws"."id" = "we"."session_id")))
  WHERE ("we"."id" = "workout_media"."workout_exercise_id")) = "auth"."uid"())) WITH CHECK ((( SELECT "ws"."trainer_id"
   FROM ("public"."workout_sessions" "ws"
     JOIN "public"."workout_exercises" "we" ON (("ws"."id" = "we"."session_id")))
  WHERE ("we"."id" = "workout_media"."workout_exercise_id")) = "auth"."uid"()));



CREATE POLICY "Allow trainers to update sets in their sessions" ON "public"."workout_sets" FOR UPDATE TO "authenticated" USING ((( SELECT "ws"."trainer_id"
   FROM ("public"."workout_sessions" "ws"
     JOIN "public"."workout_exercises" "we" ON (("ws"."id" = "we"."session_id")))
  WHERE ("we"."id" = "workout_sets"."workout_exercise_id")) = "auth"."uid"())) WITH CHECK ((( SELECT "ws"."trainer_id"
   FROM ("public"."workout_sessions" "ws"
     JOIN "public"."workout_exercises" "we" ON (("ws"."id" = "we"."session_id")))
  WHERE ("we"."id" = "workout_sets"."workout_exercise_id")) = "auth"."uid"()));



CREATE POLICY "Allow trainers to update their assigned memberships" ON "public"."memberships" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "trainer_id")) WITH CHECK (("auth"."uid"() = "trainer_id"));



CREATE POLICY "Allow trainers to update their own workout sessions" ON "public"."workout_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "trainer_id")) WITH CHECK (("auth"."uid"() = "trainer_id"));



CREATE POLICY "Allow users to access their own notifications" ON "public"."notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to access their own read status" ON "public"."message_read_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to delete centers" ON "public"."centers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow users to view their center connections" ON "public"."center_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own role" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."center_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_read_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."my_trainer_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pt_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "사용자는 자신의 역할을 볼 수 있음" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "사용자는 자신의 프로필을 볼 수 있음" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "사용자는 자신의 프로필을 수정할 수 있음" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "사용자는 자신이 참여한 채팅방에 메시지를 보" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_messages"."room_id") AND ("chat_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "사용자는 자신이 참여한 채팅방을 볼 수 있음" ON "public"."chat_participants" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "사용자는 자신이 참여한 채팅방을 볼 수 있음" ON "public"."chat_rooms" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_participants"."id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "사용자는 자신이 참여한 채팅방의 메시지를 볼 " ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_messages"."room_id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "트레이너가 멤버십 정보를 생성할 수 있도록 허" ON "public"."memberships" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "trainer_id"));



CREATE POLICY "트레이너는 워크아웃 로그를 작성할 수 있음" ON "public"."workout_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "trainer_id"));



CREATE POLICY "트레이너는 자신의 PT 세션을 볼 수 있음" ON "public"."pt_sessions" FOR SELECT USING (("auth"."uid"() = "trainer_id"));



CREATE POLICY "트레이너는 자신의 PT 세션을 수정할 수 있음" ON "public"."pt_sessions" FOR UPDATE USING (("auth"."uid"() = "trainer_id"));



CREATE POLICY "트레이너는 자신의 회원권 정보를 볼 수 있음" ON "public"."memberships" FOR SELECT USING (("auth"."uid"() = "trainer_id"));



CREATE POLICY "트레이너는 자신이 작성한 워크아웃 로그를 볼 " ON "public"."workout_logs" FOR SELECT USING (("auth"."uid"() = "trainer_id"));



CREATE POLICY "트레이너는 자신이 작성한 워크아웃 로그를 수" ON "public"."workout_logs" FOR UPDATE USING (("auth"."uid"() = "trainer_id"));



CREATE POLICY "회원은 자신의 PT 세션을 볼 수 있음" ON "public"."pt_sessions" FOR SELECT USING (("auth"."uid"() = "member_id"));



CREATE POLICY "회원은 자신의 워크아웃 로그를 볼 수 있음" ON "public"."workout_logs" FOR SELECT USING (("auth"."uid"() = "member_id"));



CREATE POLICY "회원은 자신의 회원권 정보를 볼 수 있음" ON "public"."memberships" FOR SELECT USING (("auth"."uid"() = "trainer_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."body_composition_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."center_users";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."centers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_rooms";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."exercises";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."memberships";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."message_read_status";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."my_trainer_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pt_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."session_status";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_roles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workout_exercises";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workout_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workout_media";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workout_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workout_sets";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."add_unique_constraint"("target_table_name" "text", "target_column_name" "text", "target_schema_name" "text", "custom_constraint_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_unique_constraint"("target_table_name" "text", "target_column_name" "text", "target_schema_name" "text", "custom_constraint_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_unique_constraint"("target_table_name" "text", "target_column_name" "text", "target_schema_name" "text", "custom_constraint_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_workout_session_and_decrement_pt"("p_member_id" "uuid", "p_trainer_id" "uuid", "p_center_id" "uuid", "p_session_date" timestamp with time zone, "p_notes" "text", "p_session_order" integer, "p_total_sessions_at_creation" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_workout_session_and_decrement_pt"("p_member_id" "uuid", "p_trainer_id" "uuid", "p_center_id" "uuid", "p_session_date" timestamp with time zone, "p_notes" "text", "p_session_order" integer, "p_total_sessions_at_creation" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workout_session_and_decrement_pt"("p_member_id" "uuid", "p_trainer_id" "uuid", "p_center_id" "uuid", "p_session_date" timestamp with time zone, "p_notes" "text", "p_session_order" integer, "p_total_sessions_at_creation" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_new_members"("p_center_id" "uuid", "p_months" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_new_members"("p_center_id" "uuid", "p_months" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_new_members"("p_center_id" "uuid", "p_months" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_center_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_center_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_center_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat_room"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat_room"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat_room"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_other_participant_id"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_other_participant_id"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_other_participant_id"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_message_count"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_message_count"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_message_count"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_chat_message_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_chat_message_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_chat_message_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_chat_room"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_chat_room"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_chat_room"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_chat_messages_as_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_chat_messages_as_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_chat_messages_as_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."body_composition_logs" TO "anon";
GRANT ALL ON TABLE "public"."body_composition_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."body_composition_logs" TO "service_role";



GRANT ALL ON TABLE "public"."center_users" TO "anon";
GRANT ALL ON TABLE "public"."center_users" TO "authenticated";
GRANT ALL ON TABLE "public"."center_users" TO "service_role";



GRANT ALL ON TABLE "public"."centers" TO "anon";
GRANT ALL ON TABLE "public"."centers" TO "authenticated";
GRANT ALL ON TABLE "public"."centers" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."workout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."latest_workout_sessions_view" TO "anon";
GRANT ALL ON TABLE "public"."latest_workout_sessions_view" TO "authenticated";
GRANT ALL ON TABLE "public"."latest_workout_sessions_view" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."message_read_status" TO "anon";
GRANT ALL ON TABLE "public"."message_read_status" TO "authenticated";
GRANT ALL ON TABLE "public"."message_read_status" TO "service_role";



GRANT ALL ON TABLE "public"."my_trainer_members" TO "anon";
GRANT ALL ON TABLE "public"."my_trainer_members" TO "authenticated";
GRANT ALL ON TABLE "public"."my_trainer_members" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pt_sessions" TO "anon";
GRANT ALL ON TABLE "public"."pt_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."pt_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."session_status" TO "anon";
GRANT ALL ON TABLE "public"."session_status" TO "authenticated";
GRANT ALL ON TABLE "public"."session_status" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."workout_exercises" TO "anon";
GRANT ALL ON TABLE "public"."workout_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."workout_logs" TO "anon";
GRANT ALL ON TABLE "public"."workout_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_logs" TO "service_role";



GRANT ALL ON TABLE "public"."workout_media" TO "anon";
GRANT ALL ON TABLE "public"."workout_media" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_media" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sets" TO "anon";
GRANT ALL ON TABLE "public"."workout_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sets" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
