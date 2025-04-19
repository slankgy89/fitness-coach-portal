'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function CancelRequestForm({ subscriptionId }: { subscriptionId: string }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/client/cancel-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId,
          reason
        }),
      });

      if (!response.ok) {
        // Attempt to parse error message from response
        let errorMessage = 'Failed to submit request';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
            // Fallback if response is not JSON
            errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast.success('Request Submitted', {
        description: 'Your cancellation request has been sent to your coach for approval.',
      });
      // Optionally clear the form or disable it after success
      setReason(''); 

    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to submit request'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Request Cancellation</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reason" className="block text-sm font-medium mb-1">
            Reason (optional)
          </label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Let your coach know why you want to cancel..."
            rows={3}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : 'Submit Request'}
        </Button>
      </form> {/* Ensure this is the correct closing tag */}
    </div>
  );
}
