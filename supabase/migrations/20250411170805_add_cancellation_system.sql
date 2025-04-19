-- Add requires_approval column to coach_plans
ALTER TABLE coach_plans ADD COLUMN requires_approval BOOLEAN DEFAULT TRUE;

-- Create cancellation_requests table
CREATE TABLE cancellation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES coach_plans(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied', 'countered')),
  client_reason TEXT,
  coach_response TEXT,
  processed_at TIMESTAMPTZ,
  refund_amount DECIMAL(10,2),
  counter_offer_plan_id UUID REFERENCES coach_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_subscription FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE -- Corrected table name
);

-- Create index for faster coach queries
CREATE INDEX idx_cancellation_requests_coach ON cancellation_requests(coach_id, status);

-- Create view for pending requests
CREATE VIEW pending_cancellations AS
SELECT cr.*, p.email as client_email, cp.name as plan_name
FROM cancellation_requests cr
JOIN profiles p ON cr.client_id = p.id
JOIN coach_plans cp ON cr.plan_id = cp.id
WHERE cr.status = 'pending';
