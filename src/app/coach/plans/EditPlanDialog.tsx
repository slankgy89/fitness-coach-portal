'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';

// Re-use the Plan type (consider moving to a shared types file later)
type CoachPlan = {
  id: string;
  coach_id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  name: string;
  description: string | null;
  price: number; // Price in cents
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  features: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

interface EditPlanDialogProps {
  plan: CoachPlan;
  onPlanUpdated: (updatedPlan: CoachPlan) => void; // Callback after successful update
  children: React.ReactNode; // To wrap the trigger button
}

export function EditPlanDialog({ plan, onPlanUpdated, children }: EditPlanDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: plan.name,
    description: plan.description || '',
    price: (plan.price / 100).toFixed(2), // Convert cents to dollars for display
    currency: plan.currency,
    interval: plan.interval,
    interval_count: plan.interval_count.toString(),
    features: plan.features?.join(', ') || '',
  });

  // Reset form data if the plan prop changes (e.g., opening dialog for a different plan)
  useEffect(() => {
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: (plan.price / 100).toFixed(2),
      currency: plan.currency,
      interval: plan.interval,
      interval_count: plan.interval_count.toString(),
      features: plan.features?.join(', ') || '',
    });
    setError(null); // Clear errors when dialog opens for a new plan
  }, [plan, isOpen]); // Depend on isOpen to reset when dialog opens

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
     if (name === 'interval_count') {
        const numValue = parseInt(value, 10);
        if (value === '' || (!isNaN(numValue) && numValue > 0)) {
             setFormData(prev => ({ ...prev, [name]: value }));
        } else if (!isNaN(numValue) && numValue <= 0) {
             setFormData(prev => ({ ...prev, [name]: value })); // Allow invalid input temporarily
        }
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
     if (name === 'interval') {
        setFormData(prev => ({ ...prev, [name]: value as CoachPlan['interval'] }));
     } else {
        setFormData(prev => ({ ...prev, [name]: value }));
     }
  };

  const handleUpdatePlan = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const priceInCents = Math.round(parseFloat(formData.price) * 100);
    const intervalCount = parseInt(formData.interval_count, 10);

    // Validation
    if (isNaN(priceInCents) || priceInCents <= 0) { setError("Please enter a valid positive price."); setIsSubmitting(false); return; }
    if (isNaN(intervalCount) || intervalCount <= 0) { setError("Please enter a valid positive interval count."); setIsSubmitting(false); return; }

    const featuresArray = formData.features.split(',').map(f => f.trim()).filter(f => f);

    // Construct payload - only include fields that can be updated via this dialog
    const updatePayload: any = {
        name: formData.name,
        description: formData.description || null, // Send null if empty
        features: featuresArray.length > 0 ? featuresArray : null,
        // Include price/interval only if they differ from original plan
    };

    let priceOrIntervalChanged = false;
    if (priceInCents !== plan.price) {
        updatePayload.price = priceInCents;
        priceOrIntervalChanged = true;
    }
     if (formData.currency !== plan.currency) {
        updatePayload.currency = formData.currency;
        priceOrIntervalChanged = true;
    }
    if (formData.interval !== plan.interval) {
        updatePayload.interval = formData.interval;
        priceOrIntervalChanged = true;
    }
    if (intervalCount !== plan.interval_count) {
        updatePayload.interval_count = intervalCount;
        priceOrIntervalChanged = true;
    }
    // Ensure currency is sent if price/interval changes
     if (priceOrIntervalChanged && !updatePayload.currency) {
         updatePayload.currency = formData.currency;
     }


    try {
      const response = await fetch(`/api/coach/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to update plan');
      }

      const data = await response.json();
      onPlanUpdated(data.plan); // Call the callback with the updated plan data
      setIsOpen(false); // Close dialog on success

    } catch (err: any) {
      console.error("Update plan error:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Plan: {plan.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpdatePlan} className="grid gap-4 py-4">
          {/* Edit Form Fields - Pre-filled */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-name" className="text-right">Name</Label>
            <Input id="edit-name" name="name" value={formData.name} onChange={handleInputChange} required className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-description" className="text-right">Description</Label>
            <Textarea id="edit-description" name="description" value={formData.description} onChange={handleInputChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-price" className="text-right">Price</Label>
            <Input id="edit-price" name="price" type="number" step="0.01" min="0.50" value={formData.price} onChange={handleInputChange} required className="col-span-3" placeholder="e.g., 49.99" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-currency" className="text-right">Currency</Label>
            <Select name="currency" value={formData.currency} onValueChange={(value) => handleSelectChange('currency', value)}>
              <SelectTrigger className="col-span-3"> <SelectValue placeholder="Select currency" /> </SelectTrigger>
              <SelectContent> <SelectItem value="usd">USD</SelectItem> <SelectItem value="cad">CAD</SelectItem> <SelectItem value="eur">EUR</SelectItem> <SelectItem value="gbp">GBP</SelectItem> </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-interval-count" className="text-right">Billing Cycle</Label>
            <div className="col-span-3 grid grid-cols-2 gap-2">
              <Input id="edit-interval-count" name="interval_count" type="number" min="1" value={formData.interval_count} onChange={handleInputChange} required className="w-full" placeholder="e.g., 3" />
              <Select name="interval" value={formData.interval} onValueChange={(value) => handleSelectChange('interval', value)}>
                <SelectTrigger className="w-full"> <SelectValue placeholder="Select interval" /> </SelectTrigger>
                <SelectContent> <SelectItem value="day">Day(s)</SelectItem> <SelectItem value="week">Week(s)</SelectItem> <SelectItem value="month">Month(s)</SelectItem> <SelectItem value="year">Year(s)</SelectItem> </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-features" className="text-right">Features</Label>
            <Textarea id="edit-features" name="features" value={formData.features} onChange={handleInputChange} className="col-span-3" placeholder="Comma-separated, e.g., Feature 1, Feature 2" />
          </div>
          {error && <p className="col-span-4 text-red-500 text-sm">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
