'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type ActionModalProps = {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  coachId: string;
};

export function ActionModal({ requestId, open, onOpenChange, onSuccess, coachId }: ActionModalProps) {
  const [action, setAction] = useState<'approve' | 'deny' | 'counter'>('approve');
  const [refundAmount, setRefundAmount] = useState('');
  const [counterPlanId, setCounterPlanId] = useState('');
  const [responseMessage, setResponseMessage] = useState('');

  const { data: plans } = useQuery({
    queryKey: ['coach-plans', coachId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('coach_plans')
        .select('id, name')
        .eq('coach_id', coachId)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    }
  });

  const handleSubmit = async () => {
    try {
      const response = await fetch(`/api/coach/cancel-requests/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          response: responseMessage,
          refundAmount: action === 'approve' ? parseFloat(refundAmount) : undefined,
          counterOfferPlanId: action === 'counter' ? counterPlanId : undefined
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success(`Request ${action}d successfully`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('Error processing request', {
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Process Cancellation Request</DialogTitle>
          <DialogDescription>
            Choose how to handle this cancellation request
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={(value: any) => setAction(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve with Refund</SelectItem>
                <SelectItem value="deny">Deny Request</SelectItem>
                <SelectItem value="counter">Counter Offer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === 'approve' && (
            <div className="space-y-2">
              <Label>Refund Amount</Label>
              <Input 
                type="number" 
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter refund amount"
              />
            </div>
          )}

          {action === 'counter' && (
            <div className="space-y-2">
              <Label>Alternative Plan</Label>
              <Select value={counterPlanId} onValueChange={setCounterPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Response Message</Label>
            <Textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="Optional message to client"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
