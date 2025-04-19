'use client';

import { useState, useEffect } from 'react'; // Import useEffect
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionModal } from '@/components/cancellation/ActionModal';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type CancellationRequest = {
  id: string;
  plan_name: string;
  client_email: string;
  requested_at: string;
  client_reason?: string;
  status: string;
  coach_id: string; // Added coach_id for passing to modal
};

export default function CancellationRequestsPage() {
  const supabase = createClient();
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Store coach ID

  // Fetch current user ID once
  useEffect(() => {
      const getUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
      };
      getUser();
  }, [supabase]);


  const { data: requests, isLoading, refetch } = useQuery<CancellationRequest[]>({
    queryKey: ['cancellation-requests', currentUserId], // Include user ID in query key
    queryFn: async () => {
      if (!currentUserId) return []; // Don't fetch if user ID isn't available yet
      const { data, error } = await supabase
        .from('pending_cancellations') // Use the view for pending requests
        .select('*')
        .eq('coach_id', currentUserId) // Filter by current coach's ID
        .order('requested_at', { ascending: false });

      if (error) throw error;
      return data || []; // Return empty array if data is null
    },
    enabled: !!currentUserId, // Only run query when currentUserId is available
  });

  const handleActionComplete = () => {
    refetch(); // Refetch data after action
    setIsModalOpen(false);
    setSelectedRequest(null); // Clear selected request
  };


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Cancellation Requests</h1>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : requests?.length === 0 ? (
        <p className="text-muted-foreground">No pending cancellation requests</p>
      ) : (
        <div className="space-y-4">
          {requests?.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{request.plan_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {request.client_email} - {format(new Date(request.requested_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {/* Use status from request data */}
                  <Badge variant={request.status === 'pending' ? 'secondary' : 'outline'}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {request.client_reason && (
                    <div>
                      <h4 className="font-medium mb-1">Client Reason</h4>
                      <p className="text-sm">{request.client_reason}</p>
                    </div>
                  )}
                  {/* Only show button if status is pending */}
                  {request.status === 'pending' && (
                     <div className="flex space-x-2">
                       <Button
                         size="sm"
                         onClick={() => {
                           setSelectedRequest(request);
                           setIsModalOpen(true);
                         }}
                       >
                         Process Request
                       </Button>
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Render Modal outside the map loop */}
      {selectedRequest && currentUserId && (
        <ActionModal
          requestId={selectedRequest.id}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onSuccess={handleActionComplete}
          coachId={currentUserId} // Pass the current coach's ID
        />
      )}
    </div>
  );
}
