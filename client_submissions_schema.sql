-- client_submissions table: Tracks client meal/snack photo submissions for coach review
CREATE TABLE public.client_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    submission_date date NOT NULL DEFAULT CURRENT_DATE,
    meal_type text, -- e.g., 'Breakfast', 'Lunch', 'Dinner', 'Snack'
    image_url text NOT NULL, -- URL to the stored image (e.g., Supabase Storage)
    client_notes text, -- Optional notes from the client
    coach_feedback text, -- Optional feedback from the coach
    status text DEFAULT 'pending'::text NOT NULL CHECK (status IN ('pending', 'reviewed', 'rejected')), -- Submission status
    submitted_at timestamp with time zone NOT NULL DEFAULT now(),
    reviewed_at timestamp with time zone, -- Timestamp when the coach reviewed it
    CONSTRAINT client_submissions_coach_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_client_submissions_client_date ON public.client_submissions(client_id, submission_date);
CREATE INDEX idx_client_submissions_coach_client ON public.client_submissions(coach_id, client_id);
CREATE INDEX idx_client_submissions_status ON public.client_submissions(status);

-- Enable RLS
ALTER TABLE public.client_submissions ENABLE ROW LEVEL SECURITY;

-- Clients can SELECT their own submissions regardless of status
CREATE POLICY "Allow clients read access to own submissions"
ON public.client_submissions
FOR SELECT
USING (auth.uid() = client_id);

-- Clients can INSERT their own submissions
CREATE POLICY "Allow clients insert access to own submissions"
ON public.client_submissions
FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Clients can UPDATE their own submissions ONLY IF status is 'pending'
CREATE POLICY "Allow clients update access to own pending submissions"
ON public.client_submissions
FOR UPDATE
USING (auth.uid() = client_id AND status = 'pending')
WITH CHECK (auth.uid() = client_id AND status = 'pending');

-- Clients can DELETE their own submissions ONLY IF status is 'pending'
CREATE POLICY "Allow clients delete access to own pending submissions"
ON public.client_submissions
FOR DELETE
USING (auth.uid() = client_id AND status = 'pending');

-- Coaches can manage (read, update feedback/status, delete) submissions for their clients
CREATE POLICY "Allow coaches full access to submissions for own clients"
ON public.client_submissions
FOR ALL
USING (auth.uid() = coach_id AND client_id IN (SELECT id FROM public.profiles WHERE coach_id = auth.uid()))
WITH CHECK (auth.uid() = coach_id AND client_id IN (SELECT id FROM public.profiles WHERE coach_id = auth.uid()));

-- Comments
COMMENT ON TABLE public.client_submissions IS 'Stores client meal/snack photo submissions for coach review.';
COMMENT ON COLUMN public.client_submissions.image_url IS 'URL to the image file stored in Supabase Storage or similar.';
COMMENT ON COLUMN public.client_submissions.status IS 'Status of the submission: pending, reviewed, rejected.';
COMMENT ON COLUMN public.client_submissions.reviewed_at IS 'Timestamp when the coach marked the submission as reviewed or rejected.';
